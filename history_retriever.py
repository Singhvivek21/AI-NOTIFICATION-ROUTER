from schemas import EngagementSummary, HistoryEvidence
import logging
import re
from typing import Any, List

import pandas as pd
from pydantic import BaseModel, Field

from csv_loader import csv_loader

# Configure module-level logger
logger = logging.getLogger(__name__)

# ==========================================
# PYDANTIC MODELS FOR STRUCTURED EVIDENCE
# ==========================================

# ==========================================
# HISTORY RETRIEVER SERVICE
# ==========================================

class HistoryRetriever:
    """
    Retrieves and analyzes historical messages and events for a user.
    Designed modularly to allow replacing deterministic matching with 
    vector/embedding-based search in the future.
    Uses purely pandas-based deterministic methods for the V1 implementation.
    """

    def __init__(self):
        # Threshold for Jaccard similarity when comparing text
        self.similarity_threshold = 0.3

    def _safe_get(self, row: pd.Series, column: str, default: Any = "") -> Any:
        """Safely extract a value from a pandas Series, handling missing columns/NaNs."""
        if column in row.index and pd.notna(row[column]):
            return row[column]
        return default

    def _jaccard_similarity(self, text1: str, text2: str) -> float:
        """
        Calculates a simple Jaccard similarity between two text strings.
        Useful for deterministic keyword overlap. Can be replaced by TF-IDF 
        or BERT embeddings in future iterations.
        """
        if not isinstance(text1, str) or not isinstance(text2, str):
            return 0.0
            
        # Tokenize simply by alphanumeric boundaries
        words1 = set(re.findall(r'\w+', text1.lower()))
        words2 = set(re.findall(r'\w+', text2.lower()))
        
        if not words1 or not words2:
            return 0.0
            
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        return intersection / union

    def retrieve_evidence(self, user_id: str, current_msg_row: pd.Series) -> HistoryEvidence:
        """
        Retrieves relevant historical messages and their aggregated engagement metrics
        for the given user based on the incoming message context.
        """
        logger.debug(f"Retrieving historical evidence for user: {user_id}")
        
        history_df = csv_loader.get_message_history()
        events_df = csv_loader.get_message_events()
        
        # 1. Base filter: isolate history for the specific user
        if history_df.empty or 'user_id' not in history_df.columns:
            return HistoryEvidence(engagement_summary=EngagementSummary())
            
        user_history = history_df[history_df['user_id'] == user_id]
        if user_history.empty:
            return HistoryEvidence(engagement_summary=EngagementSummary())

        # Extract attributes from the current incoming message to match against
        sender_id = self._safe_get(current_msg_row, 'sender_user_id', '')
        business_id = self._safe_get(current_msg_row, 'business_id', '')
        group_id = self._safe_get(current_msg_row, 'group_id', '')
        current_text = self._safe_get(current_msg_row, 'message_text', '')

        # Use a set to keep indices unique if a message matches multiple criteria
        relevant_indices = set()
        
        # 2. Match messages from the same personal sender
        if sender_id and 'sender_user_id' in user_history.columns:
            sender_matches = user_history[user_history['sender_user_id'] == sender_id]
            relevant_indices.update(sender_matches.index.tolist())

        # 3. Match messages from the same business account
        if business_id and 'business_id' in user_history.columns:
            biz_matches = user_history[user_history['business_id'] == business_id]
            relevant_indices.update(biz_matches.index.tolist())

        # 4. Match messages from the same group
        if group_id and 'group_id' in user_history.columns:
            group_matches = user_history[user_history['group_id'] == group_id]
            relevant_indices.update(group_matches.index.tolist())

        # 5. Match messages with similar text content (fallback for semantic search)
        if current_text and 'message_text' in user_history.columns:
            for idx, row in user_history.iterrows():
                hist_text = self._safe_get(row, 'message_text', '')
                if self._jaccard_similarity(current_text, hist_text) >= self.similarity_threshold:
                    relevant_indices.add(idx)

        # 6. Finalize top matches
        # Sort indices descending to prioritize the most recent history assuming index order corresponds to time.
        sorted_indices = sorted(list(relevant_indices), reverse=True)
        top_indices = sorted_indices[:5] # Default to top 5 evidence IDs
        relevant_history = user_history.loc[top_indices]
        
        evidence_ids = relevant_history['message_id'].tolist() if 'message_id' in relevant_history.columns else []

        # 7. Join with events to calculate engagement specifically on these retrieved messages
        eng_summary = EngagementSummary()
        if evidence_ids and not events_df.empty and 'message_id' in events_df.columns:
            relevant_events = events_df[
                (events_df['message_id'].isin(evidence_ids)) & 
                (events_df['user_id'] == user_id)
            ]
            
            if not relevant_events.empty and 'event_type' in relevant_events.columns:
                counts = relevant_events['event_type'].value_counts().to_dict()
                eng_summary.opened = counts.get('opened', 0)
                eng_summary.dismissed = counts.get('dismissed', 0)
                eng_summary.muted = counts.get('muted', 0)
                eng_summary.replied = counts.get('replied', 0)
                eng_summary.reported = counts.get('reported', 0)

        # 8. Synthesize human/LLM readable summary
        evidence_summary = self._generate_summary(relevant_history, eng_summary)

        return HistoryEvidence(
            evidence_message_ids=evidence_ids,
            evidence_summary=evidence_summary,
            engagement_summary=eng_summary
        )

    def _generate_summary(self, relevant_history: pd.DataFrame, eng_summary: EngagementSummary) -> str:
        """
        Constructs a concise text summary of the historical context.
        This provides a quick digest for the LLM to understand past relationships.
        """
        if relevant_history.empty:
            return "No relevant historical messages found for this context."

        total_found = len(relevant_history)
        summary_parts = [f"Found {total_found} historically relevant message(s)."]
        
        # Prioritize warning signals
        if eng_summary.reported > 0 or eng_summary.muted > 0:
            summary_parts.append(f"WARNING: User has previously muted ({eng_summary.muted}) or reported ({eng_summary.reported}) similar messages or this sender.")
        elif eng_summary.replied > 0 or eng_summary.opened > 0:
            summary_parts.append(f"User has historically engaged (opened: {eng_summary.opened}, replied: {eng_summary.replied}) with similar content.")
        elif eng_summary.dismissed > 0:
            summary_parts.append(f"User tends to dismiss ({eng_summary.dismissed}) this type of message.")
        else:
            summary_parts.append("No notable engagement events recorded for these historical messages.")
            
        return " ".join(summary_parts)

# Export a single instance to be used by the application context builders
history_retriever = HistoryRetriever()
