from schemas import CalibratedDecision, HistoryEvidence, MediaAnalysis, MessageContext, RoutingDecision
import logging
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from constants import Action, MessageType

# Configure module-level logger
logger = logging.getLogger(__name__)

# ==========================================
# PYDANTIC MODELS FOR STRUCTURED OUTPUT
# ==========================================

# ==========================================
# CONFIDENCE CALIBRATOR SERVICE
# ==========================================

class ConfidenceCalibrator:
    """
    Production-grade deterministic calibration engine.
    
    LLMs (even with reflection) can be notoriously overconfident or underconfident.
    This module anchors the LLM's raw confidence score against hard, deterministic
    heuristics derived from the dataset constraints.
    """

    def calibrate(
        self,
        initial_decision: RoutingDecision,
        reflected_decision: RoutingDecision,
        context: MessageContext,
        history: HistoryEvidence,
        media: Optional[MediaAnalysis] = None
    ) -> CalibratedDecision:
        """
        Calculates the final confidence score by adjusting the LLM's reflected 
        confidence based on 10 deterministic factors.
        """
        logger.info(f"Calibrating confidence for message_id: {context.message_id}")
        
        base_confidence = reflected_decision.confidence
        adjustment = 0.0
        calibration_notes = []

        # Factor 1 & 2: Trust Score & Spam Probability Check
        trust = context.features.trust_score
        spam = context.features.spam_probability
        
        if trust > 0.7:
            adjustment += 0.05
        elif spam > 0.7:
            if reflected_decision.action != Action.MUTE:
                adjustment -= 0.15
                calibration_notes.append("High spam probability penalized non-mute action.")
            else:
                adjustment += 0.05 # High confidence in muting spam

        # Factor 3: Notification Priority 
        priority = context.features.notification_priority
        if priority > 0.8 and reflected_decision.action == Action.NOTIFY:
            adjustment += 0.05
        elif priority < 0.2 and reflected_decision.action == Action.NOTIFY:
            adjustment -= 0.10
            calibration_notes.append("Low priority penalized notify action.")

        # Factor 4: User Engagement
        engagement = context.features.engagement_score
        if engagement > 0.7:
            adjustment += 0.05

        # Factor 5 & 6: Historical Evidence Strength & Number of IDs
        num_evidence = len(history.evidence_message_ids)
        if num_evidence > 0:
            adjustment += min(0.10, num_evidence * 0.02) # Up to +0.10 for rich history
            
            # Check historical engagement strength
            eng_sum = history.engagement_summary
            positive_eng = eng_sum.opened + eng_sum.replied
            negative_eng = eng_sum.muted + eng_sum.dismissed + (eng_sum.reported * 2)
            
            if positive_eng > negative_eng and reflected_decision.action == Action.NOTIFY:
                adjustment += 0.05
            elif negative_eng > positive_eng and reflected_decision.action == Action.NOTIFY:
                adjustment -= 0.10
                calibration_notes.append("Historical negative engagement contradicts notify decision.")

        # Factor 7: Reflection Agreement
        if (initial_decision.action == reflected_decision.action and 
            initial_decision.message_type == reflected_decision.message_type):
            adjustment += 0.10 # Both agents agreed independently
            calibration_notes.append("Strong multi-agent consensus.")
        else:
            adjustment -= 0.10 # Agents disagreed, inherently lowers certainty
            calibration_notes.append("Agents disagreed during reflection; confidence penalized.")

        # Factor 8: Business Verification
        if context.business:
            if context.business.is_verified:
                adjustment += 0.05
            elif context.business.report_count > 0 and reflected_decision.action != Action.MUTE:
                adjustment -= 0.10
                calibration_notes.append("Unverified business with reports penalized.")

        # Factor 9: Group Trust
        if context.group:
            if context.group.is_admin or context.group.sender_role == 'admin':
                adjustment += 0.05
            if context.group.is_muted and reflected_decision.action == Action.NOTIFY:
                adjustment -= 0.15
                calibration_notes.append("Group is globally muted by user.")

        # Factor 10: Ambiguity Detection
        # High trust AND high spam indicates an ambiguous/conflicting state
        if trust > 0.5 and spam > 0.5:
            adjustment -= 0.15
            calibration_notes.append("Highly ambiguous context (mixed trust/spam signals).")

        # Apply total adjustment
        final_confidence = base_confidence + adjustment
        
        # Clamp between 0.0 and 1.0
        final_confidence = max(0.0, min(1.0, final_confidence))

        # Augment reason with calibration notes if any significant penalties occurred
        final_reason = reflected_decision.reason
        if calibration_notes and adjustment < 0:
            final_reason += f" [Calibration: {' '.join(calibration_notes)}]"

        logger.info(f"Calibrated confidence from {base_confidence} to {final_confidence:.2f}")

        return CalibratedDecision(
            action=reflected_decision.action,
            message_type=reflected_decision.message_type,
            reason=final_reason,
            confidence=final_confidence,
            evidence_message_ids=reflected_decision.evidence_message_ids
        )

# Export a singleton instance
confidence_calibrator = ConfidenceCalibrator()
