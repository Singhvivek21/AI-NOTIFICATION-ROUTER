from schemas import CalibratedDecision
import logging
from pathlib import Path
from typing import Dict, List, Union

import pandas as pd

from constants import Action, MessageType

# Configure module-level logger
logger = logging.getLogger(__name__)

# ==========================================
# EXCEPTIONS
# ==========================================

class OutputGeneratorError(Exception):
    """Base exception for output generation errors."""
    pass

class OutputValidationError(OutputGeneratorError):
    """Raised when the final output fails schema validation."""
    pass

# ==========================================
# OUTPUT GENERATOR SERVICE
# ==========================================

class OutputGenerator:
    """
    Production-grade output generator.
    Responsible for formatting, validating, and writing the final results to output.csv
    in strict adherence to the hackathon submission schema.
    """

    def __init__(self, output_path: Union[str, Path] = "output.csv"):
        self.output_path = Path(output_path)
        self.results: List[Dict[str, str]] = []

    def add_result(self, message_id: str, decision: CalibratedDecision) -> None:
        """
        Ingests a CalibratedDecision and formats it for the final CSV.
        Applies necessary transformations (like setting 'none' for empty evidence).
        """
        logger.debug(f"Adding result for message_id: {message_id}")

        # Extract values, handling Enum types if necessary
        action_val = decision.action.value if isinstance(decision.action, Action) else str(decision.action)
        msg_type_val = decision.message_type.value if isinstance(decision.message_type, MessageType) else str(decision.message_type)
        
        # Format confidence strictly to 2 decimal places
        confidence_val = f"{decision.confidence:.2f}"

        # Clean and format evidence
        evidence_val = decision.evidence_message_ids
        if not evidence_val or not str(evidence_val).strip() or str(evidence_val).strip().lower() == "none":
            evidence_val = "none"

        self.results.append({
            "message_id": str(message_id),
            "action": action_val,
            "message_type": msg_type_val,
            "reason": str(decision.reason),
            "confidence": confidence_val,
            "evidence_message_ids": str(evidence_val)
        })

    def _validate_schema(self, df: pd.DataFrame) -> None:
        """
        Strictly validates the output DataFrame against the required hackathon schema
        before writing to disk. Ensures no malformed data is submitted.
        """
        required_columns = [
            "message_id", "action", "message_type", "reason", "confidence", "evidence_message_ids"
        ]

        # 1. Validate Columns
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise OutputValidationError(f"Missing required columns in output: {missing_cols}")

        # 2. Validate Action Field
        valid_actions = {a.value for a in Action}
        invalid_actions = df[~df['action'].isin(valid_actions)]
        if not invalid_actions.empty:
            invalid_values = invalid_actions['action'].unique().tolist()
            logger.error(f"Invalid actions found in output: {invalid_values}")
            raise OutputValidationError(f"Invalid action values found: {invalid_values}")

        # 3. Validate Message Type Field
        valid_msg_types = {m.value for m in MessageType}
        invalid_types = df[~df['message_type'].isin(valid_msg_types)]
        if not invalid_types.empty:
            invalid_values = invalid_types['message_type'].unique().tolist()
            logger.error(f"Invalid message types found in output: {invalid_values}")
            raise OutputValidationError(f"Invalid message_type values found: {invalid_values}")

        # 4. Validate Confidence Bounds
        try:
            confidence_floats = df['confidence'].astype(float)
            out_of_bounds = df[(confidence_floats < 0.0) | (confidence_floats > 1.0)]
            if not out_of_bounds.empty:
                logger.error(f"Confidence out of bounds for {len(out_of_bounds)} rows.")
                raise OutputValidationError("Confidence values must be between 0.00 and 1.00")
        except ValueError as e:
            raise OutputValidationError(f"Confidence column contains non-numeric values: {e}")

        # 5. Validate Evidence Message IDs
        empty_evidence = df[df['evidence_message_ids'].isna() | (df['evidence_message_ids'] == "")]
        if not empty_evidence.empty:
            raise OutputValidationError(f"Found {len(empty_evidence)} rows with empty evidence. Must be 'none'.")

    def generate_csv(self) -> None:
        """
        Validates accumulated results and writes them to the output CSV file.
        """
        logger.info(f"Generating output CSV with {len(self.results)} records...")

        if not self.results:
            logger.warning("No results to write. Output CSV will be empty.")
            df = pd.DataFrame(columns=[
                "message_id", "action", "message_type", "reason", "confidence", "evidence_message_ids"
            ])
        else:
            df = pd.DataFrame(self.results)
            df['confidence'] = df['confidence'].astype(float).map("{:.2f}".format)
            df['evidence_message_ids'] = df['evidence_message_ids'].fillna("none")

        try:
            # Run strict schema validation
            self._validate_schema(df)
            
            # Write to disk
            df.to_csv(self.output_path, index=False)
            logger.info(f"Successfully wrote validated output to {self.output_path.absolute()}")
            
        except OutputValidationError as e:
            logger.error(f"Output validation failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to write output.csv: {e}")
            raise OutputGeneratorError(f"Failed to generate CSV: {e}")

    def clear(self) -> None:
        """Clears the current result buffer."""
        self.results.clear()

# Export a single instance for application-wide use
output_generator = OutputGenerator()
