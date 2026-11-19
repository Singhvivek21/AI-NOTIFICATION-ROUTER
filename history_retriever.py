import logging
import re
from typing import Any, List, Tuple

import pandas as pd

from csv_loader import csv_loader
from schemas import EngagementSummary, HistoryEvidence

logger = logging.getLogger(__name__)


class HistoryRetriever:
    """
    Retrieves and scores historical messages and binary engagement events for a user
    using message_history.csv and message_events.csv.
    """

    def __init__(self):
        self.similarity_threshold = 0.25

    def _safe_get(self, row: pd.Series, column: str, default: Any = "") -> Any:
        if column in row.index and pd.notna(row[column]):
            return row[column]
        return default

    def _jaccard_similarity(self, text1: str, text2: str) -> float:
        if not isinstance(text1, str) or not isinstance(text2, str):
            return 0.0
        words1 = set(re.findall(r"\w+", text1.lower()))
        words2 = set(re.findall(r"\w+", text2.lower()))
        if not words1 or not words2:
            return 0.0
        return len(words1 & words2) / len(words1 | words2)

    def retrieve_evidence(self, user_id: str, current_msg_row: pd.Series) -> HistoryEvidence:
        logger.debug(f"Retrieving historical evidence for user: {user_id}")

        history_df = csv_loader.get_message_history()
        events_df = csv_loader.get_message_events()

        if history_df.empty or "user_id" not in history_df.columns:
            return HistoryEvidence(engagement_summary=EngagementSummary())

        user_history = history_df[history_df["user_id"] == user_id]
        if user_history.empty:
            return HistoryEvidence(engagement_summary=EngagementSummary())

        sender_id = str(self._safe_get(current_msg_row, "sender_user_id", "") or "")
        business_id = str(self._safe_get(current_msg_row, "business_id", "") or "")
        group_id = str(self._safe_get(current_msg_row, "group_id", "") or "")
        current_text = str(self._safe_get(current_msg_row, "message_text", "") or "")

        scored_matches: List[Tuple[float, str, int]] = []
        for idx, row in user_history.iterrows():
            score = 0.0
            row_sender = str(self._safe_get(row, "sender_user_id", "") or "")
            row_biz = str(self._safe_get(row, "business_id", "") or "")
            row_group = str(self._safe_get(row, "group_id", "") or "")
            row_text = str(self._safe_get(row, "message_text", "") or "")
            created_at = str(self._safe_get(row, "created_at", "") or "")

            if sender_id and row_sender == sender_id:
                score += 3.0
            if business_id and row_biz == business_id:
                score += 3.5
            if group_id and row_group == group_id:
                score += 2.0

            sim = self._jaccard_similarity(current_text, row_text)
            if sim >= self.similarity_threshold:
                score += sim * 4.0

            if score > 0:
                scored_matches.append((score, created_at, idx))

        if not scored_matches:
            return HistoryEvidence(
                evidence_message_ids=[],
                evidence_summary="No relevant historical messages found for this user and sender.",
                engagement_summary=EngagementSummary(),
            )

        scored_matches.sort(key=lambda x: (x[0], x[1]), reverse=True)
        top_indices = [idx for _, _, idx in scored_matches[:3]]
        relevant_history = user_history.loc[top_indices]
        evidence_ids = relevant_history["message_id"].astype(str).tolist()

        # Aggregate binary indicator columns from message_events.csv
        eng_summary = EngagementSummary()
        if evidence_ids and not events_df.empty and "message_id" in events_df.columns:
            relevant_events = events_df[
                (events_df["message_id"].isin(evidence_ids)) & (events_df["user_id"] == user_id)
            ]
            if not relevant_events.empty:
                eng_summary.opened = int(relevant_events["message_opened"].fillna(0).sum())
                eng_summary.replied = int(relevant_events["message_replied"].fillna(0).sum())
                eng_summary.dismissed = int(relevant_events["notification_dismissed"].fillna(0).sum())
                eng_summary.muted = int(relevant_events["muted_after_message"].fillna(0).sum())
                eng_summary.reported = int(relevant_events["message_reported"].fillna(0).sum())

        evidence_summary = self._generate_summary(relevant_history, eng_summary)

        return HistoryEvidence(
            evidence_message_ids=evidence_ids,
            evidence_summary=evidence_summary,
            engagement_summary=eng_summary,
        )

    def _generate_summary(self, relevant_history: pd.DataFrame, eng_summary: EngagementSummary) -> str:
        if relevant_history.empty:
            return "No relevant historical messages found for this context."

        total_found = len(relevant_history)
        summary_parts = [f"Found {total_found} historically relevant message(s)."]

        if eng_summary.reported > 0 or eng_summary.muted > 0:
            summary_parts.append(
                f"WARNING: User has previously muted ({eng_summary.muted}) or reported ({eng_summary.reported}) similar messages or this sender."
            )
        elif eng_summary.replied > 0 or eng_summary.opened > 0:
            summary_parts.append(
                f"User has historically engaged (opened: {eng_summary.opened}, replied: {eng_summary.replied}) with similar content."
            )
        elif eng_summary.dismissed > 0:
            summary_parts.append(
                f"User tends to dismiss ({eng_summary.dismissed}) this type of message."
            )
        else:
            summary_parts.append("No notable engagement events recorded for these historical messages.")

        return " ".join(summary_parts)


history_retriever = HistoryRetriever()
