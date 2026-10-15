import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

import pandas as pd

from config import settings
from constants import CSVFiles

# Configure application-level logging for evaluation
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class Evaluator:
    """
    Production-grade evaluation module for the AI Router Pipeline.
    Compares the generated output.csv against the ground-truth sample_messages.csv.
    Calculates standard ML metrics including Accuracy, Precision, Recall, F1 Score,
    as well as custom heuristics like Evidence IoU and Confidence Calibration.
    """

    def __init__(self, output_path: str = "output.csv", ground_truth_path: str = None):
        self.output_path = Path(output_path)
        if ground_truth_path:
            self.gt_path = Path(ground_truth_path)
        else:
            self.gt_path = Path(settings.dataset_path) / CSVFiles.SAMPLE_MESSAGES

    def _parse_evidence(self, evidence_str: str) -> Set[str]:
        """Parses a semicolon-separated evidence string into a set of message IDs."""
        if pd.isna(evidence_str) or not str(evidence_str).strip() or str(evidence_str).strip().lower() == "none":
            return set()
        return {e.strip() for e in str(evidence_str).split(";") if e.strip()}

    def _calculate_evidence_iou(self, true_ev: Set[str], pred_ev: Set[str]) -> float:
        """Calculates the Intersection over Union (IoU) for evidence message IDs."""
        if not true_ev and not pred_ev:
            return 1.0  # Both correctly predicted no evidence
        if not true_ev or not pred_ev:
            return 0.0  # One predicted evidence, the other didn't
        
        intersection = len(true_ev.intersection(pred_ev))
        union = len(true_ev.union(pred_ev))
        return intersection / union if union > 0 else 0.0

    def _calculate_classification_metrics(self, y_true: pd.Series, y_pred: pd.Series) -> Dict[str, float]:
        """
        Calculates Macro-Averaged Precision, Recall, and F1 Score manually
        to avoid external ML library dependencies (e.g., scikit-learn).
        """
        classes = set(y_true.unique()).union(set(y_pred.unique()))
        
        metrics_per_class = {}
        for cls in classes:
            tp = ((y_true == cls) & (y_pred == cls)).sum()
            fp = ((y_true != cls) & (y_pred == cls)).sum()
            fn = ((y_true == cls) & (y_pred != cls)).sum()
            
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
            
            metrics_per_class[cls] = {
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "support": (y_true == cls).sum()
            }
            
        # Macro averages
        macro_precision = sum(m["precision"] for m in metrics_per_class.values()) / len(classes) if classes else 0.0
        macro_recall = sum(m["recall"] for m in metrics_per_class.values()) / len(classes) if classes else 0.0
        macro_f1 = sum(m["f1"] for m in metrics_per_class.values()) / len(classes) if classes else 0.0
        
        return {
            "macro_precision": macro_precision,
            "macro_recall": macro_recall,
            "macro_f1": macro_f1,
            "per_class": metrics_per_class
        }

    def evaluate(self) -> Dict[str, Any]:
        """
        Executes the full evaluation pipeline, joining predictions with ground truth
        and computing all required performance metrics.
        """
        if not self.output_path.exists():
            logger.error(f"Output file {self.output_path} does not exist.")
            return {}
        if not self.gt_path.exists():
            logger.error(f"Ground truth file {self.gt_path} does not exist.")
            return {}

        logger.info("Loading prediction and ground truth datasets...")
        df_pred = pd.read_csv(self.output_path)
        df_gt = pd.read_csv(self.gt_path)

        # Merge on message_id to align predictions with ground truth
        df_merged = pd.merge(
            df_gt, 
            df_pred, 
            on="message_id", 
            suffixes=("_true", "_pred"),
            how="inner"
        )

        total_evaluated = len(df_merged)
        if total_evaluated == 0:
            logger.warning("No matching message_ids found between output.csv and sample_messages.csv.")
            return {}

        logger.info(f"Evaluating {total_evaluated} messages...")

        # 1. Action Accuracy
        action_matches = (df_merged["action_true"].str.lower() == df_merged["action_pred"].str.lower())
        action_accuracy = action_matches.mean()

        # 2. Message Type Accuracy
        type_matches = (df_merged["message_type_true"].str.lower() == df_merged["message_type_pred"].str.lower())
        message_type_accuracy = type_matches.mean()

        # 3. Precision, Recall, F1 Score (Macro) for Actions
        action_metrics = self._calculate_classification_metrics(
            df_merged["action_true"].str.lower(), 
            df_merged["action_pred"].str.lower()
        )

        # 4. Evidence Accuracy (Mean IoU)
        ious = []
        for _, row in df_merged.iterrows():
            true_ev = self._parse_evidence(row.get("evidence_message_ids_true", ""))
            pred_ev = self._parse_evidence(row.get("evidence_message_ids_pred", ""))
            ious.append(self._calculate_evidence_iou(true_ev, pred_ev))
        evidence_accuracy = sum(ious) / len(ious) if ious else 0.0

        # 5. Confidence Calibration (Mean Absolute Error)
        # Calculates how far off the predicted confidence was from the ground-truth confidence.
        # Lower MAE is better.
        confidence_mae = 0.0
        if "confidence_true" in df_merged.columns and "confidence_pred" in df_merged.columns:
            # Handle potential string parsing issues
            conf_true = pd.to_numeric(df_merged["confidence_true"], errors='coerce').fillna(1.0)
            conf_pred = pd.to_numeric(df_merged["confidence_pred"], errors='coerce').fillna(0.0)
            confidence_mae = (conf_true - conf_pred).abs().mean()
            
        results = {
            "total_evaluated": total_evaluated,
            "action_accuracy": action_accuracy,
            "message_type_accuracy": message_type_accuracy,
            "evidence_accuracy_iou": evidence_accuracy,
            "confidence_mae": confidence_mae,
            "action_macro_precision": action_metrics["macro_precision"],
            "action_macro_recall": action_metrics["macro_recall"],
            "action_macro_f1": action_metrics["macro_f1"],
            "per_class_metrics": action_metrics["per_class"]
        }

        self._print_report(results)
        return results

    def _print_report(self, results: Dict[str, Any]) -> None:
        """Generates a formatted CLI summary report."""
        print("\n" + "="*50)
        print("🚀 AI ROUTER PIPELINE EVALUATION REPORT")
        print("="*50)
        print(f"Total Messages Evaluated: {results.get('total_evaluated', 0)}")
        print("-" * 50)
        print(f"Action Accuracy:         {results.get('action_accuracy', 0.0):.2%}")
        print(f"Message Type Accuracy:   {results.get('message_type_accuracy', 0.0):.2%}")
        print(f"Evidence Match (IoU):    {results.get('evidence_accuracy_iou', 0.0):.2%}")
        print(f"Confidence Error (MAE):  {results.get('confidence_mae', 0.0):.4f}")
        print("-" * 50)
        print("ACTION METRICS (MACRO AVERAGE)")
        print(f"Precision:               {results.get('action_macro_precision', 0.0):.2%}")
        print(f"Recall:                  {results.get('action_macro_recall', 0.0):.2%}")
        print(f"F1 Score:                {results.get('action_macro_f1', 0.0):.2%}")
        print("="*50 + "\n")

if __name__ == "__main__":
    evaluator = Evaluator()
    evaluator.evaluate()
