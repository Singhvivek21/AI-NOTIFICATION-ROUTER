import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from config import settings
from constants import ConversationType, MediaType
from csv_loader import csv_loader
from schemas import (
    BusinessContext,
    DerivedFeatures,
    GroupContext,
    HistoryContext,
    MediaContext,
    MessageContext,
    MessageMetadata,
    UserProfile,
)

logger = logging.getLogger(__name__)

PROMPT_INJECTION_PATTERNS = [
    r"ignore all previous",
    r"routing override",
    r"system note for (the )?notification router",
    r"internal router metadata",
    r"assistant instruction\s*:",
    r"set action\s*=",
    r"always mark this as notify",
]


class ContextBuilder:
    """
    Constructs a rich, unified 360-degree context for an incoming message by joining
    across all 12 real CSV datasets and computing deterministic risk/trust features.
    """

    @staticmethod
    def _safe_get(row: pd.Series, column: str, default: Any = None) -> Any:
        if column in row.index and pd.notna(row[column]):
            return row[column]
        return default

    @staticmethod
    def _is_in_dnd_window(created_at: str, dnd_window: str) -> bool:
        """Evaluates whether message created_at falls within a user's HH:MM-HH:MM DND window."""
        if not created_at or not dnd_window or "-" not in dnd_window:
            return False
        try:
            dt = datetime.strptime(str(created_at).strip()[:16], "%Y-%m-%d %H:%M")
            msg_mins = dt.hour * 60 + dt.minute
            start_str, end_str = dnd_window.strip().split("-")
            sh, sm = map(int, start_str.split(":"))
            eh, em = map(int, end_str.split(":"))
            start_mins = sh * 60 + sm
            end_mins = eh * 60 + em
            if start_mins <= end_mins:
                return start_mins <= msg_mins < end_mins
            # Overnight window (e.g., 22:00-07:00)
            return msg_mins >= start_mins or msg_mins < end_mins
        except Exception:
            return False

    @staticmethod
    def _detect_prompt_injection(text: Optional[str]) -> bool:
        if not text:
            return False
        lowered = str(text).lower()
        return any(re.search(pat, lowered) for pat in PROMPT_INJECTION_PATTERNS)

    def build_context(self, message_id: str) -> MessageContext:
        logger.info(f"Building context for message_id: {message_id}")

        messages_df = csv_loader.get_messages()
        msg_mask = messages_df["message_id"] == message_id
        if not msg_mask.any():
            raise ValueError(f"Message ID {message_id} not found in messages.csv")
        msg_row = messages_df[msg_mask].iloc[0]

        user_id = str(self._safe_get(msg_row, "user_id", ""))
        sender_id = str(self._safe_get(msg_row, "sender_user_id", ""))
        created_at = str(self._safe_get(msg_row, "created_at", ""))
        conv_type = str(self._safe_get(msg_row, "conversation_type", ConversationType.PERSONAL.value))
        text_content = self._safe_get(msg_row, "message_text")

        user_profile = self._build_user_profile(user_id, created_at)

        group_ctx = None
        if conv_type == ConversationType.GROUP.value:
            group_id = str(self._safe_get(msg_row, "group_id", ""))
            group_ctx = self._build_group_context(group_id, user_id, sender_id)

        business_ctx = None
        if conv_type == ConversationType.BUSINESS.value:
            business_id = str(self._safe_get(msg_row, "business_id", ""))
            business_ctx = self._build_business_context(business_id, user_id)

        msg_metadata = self._build_message_metadata(msg_row)
        history_ctx = self._build_history_context(user_id, sender_id, msg_row)
        media_ctx = self._build_media_context(msg_row)

        features = self._calculate_derived_features(
            text_content, user_profile, group_ctx, business_ctx, msg_metadata, history_ctx
        )

        return MessageContext(
            message_id=message_id,
            text_content=str(text_content) if text_content is not None else None,
            user=user_profile,
            group=group_ctx,
            business=business_ctx,
            message_metadata=msg_metadata,
            history=history_ctx,
            media=media_ctx,
            features=features,
        )

    def _build_user_profile(self, user_id: str, created_at: str) -> UserProfile:
        users_df = csv_loader.get_users()
        daily_df = csv_loader.get_daily_notification_summary()

        u_matches = users_df[users_df["user_id"] == user_id]
        u_row = u_matches.iloc[0] if not u_matches.empty else pd.Series(dtype="object")

        d_matches = daily_df[daily_df["user_id"] == user_id]
        avg_sent = float(d_matches["notifications_sent"].mean()) if not d_matches.empty else 0.0
        avg_dismissed = float(d_matches["notifications_dismissed"].mean()) if not d_matches.empty else 0.0
        dismissal_rate = (avg_dismissed / avg_sent) if avg_sent > 0 else 0.0

        dnd_window = str(self._safe_get(u_row, "do_not_disturb_window", ""))
        quiet_hours = self._is_in_dnd_window(created_at, dnd_window)

        opens = int(self._safe_get(u_row, "messages_opened_30d", 0))
        replies = int(self._safe_get(u_row, "messages_replied_30d", 0))
        dismissed = int(self._safe_get(u_row, "notifications_dismissed_30d", 0))
        reported = int(self._safe_get(u_row, "messages_reported_30d", 0))

        fatigue = min(1.0, (avg_sent / 15.0) * 0.5 + dismissal_rate * 0.5)
        if quiet_hours:
            fatigue = min(1.0, fatigue + 0.25)

        return UserProfile(
            user_id=user_id,
            do_not_disturb_window=dnd_window,
            quiet_hours=quiet_hours,
            daily_notification_load=round(avg_sent, 2),
            avg_daily_dismissed=round(avg_dismissed, 2),
            dismissal_rate=round(dismissal_rate, 2),
            recent_opens=opens,
            recent_replies=replies,
            dismiss_count=dismissed,
            report_count=reported,
            notification_fatigue_score=round(fatigue, 2),
        )

    def _build_group_context(self, group_id: str, user_id: str, sender_id: str) -> GroupContext:
        groups_df = csv_loader.get_groups()
        members_df = csv_loader.get_group_members()

        g_matches = groups_df[groups_df["group_id"] == group_id]
        g_row = g_matches.iloc[0] if not g_matches.empty else pd.Series(dtype="object")

        u_member = members_df[(members_df["group_id"] == group_id) & (members_df["user_id"] == user_id)]
        u_row = u_member.iloc[0] if not u_member.empty else pd.Series(dtype="object")

        s_member = members_df[(members_df["group_id"] == group_id) & (members_df["user_id"] == sender_id)]
        s_row = s_member.iloc[0] if not s_member.empty else pd.Series(dtype="object")

        messages_30d = int(self._safe_get(g_row, "messages_30d", 0))
        activity_level = "high" if messages_30d >= 450 else ("medium" if messages_30d >= 180 else "low")

        user_read = int(self._safe_get(u_row, "messages_read_30d", 0))
        user_replies = int(self._safe_get(u_row, "replies_sent_30d", 0))
        reply_rate = round(user_replies / max(1, user_read), 2) if user_read > 0 else 0.0

        sender_role = str(self._safe_get(s_row, "role", "member"))

        return GroupContext(
            group_id=group_id,
            group_name=str(self._safe_get(g_row, "group_name", group_id)),
            group_type=str(self._safe_get(g_row, "group_type", "unknown")),
            group_size=int(self._safe_get(g_row, "member_count", 0)),
            admin_count=int(self._safe_get(g_row, "admin_count", 0)),
            messages_30d=messages_30d,
            sender_role=sender_role,
            is_admin=(sender_role.lower() == "admin"),
            is_muted=bool(int(self._safe_get(u_row, "group_muted_by_user", 0))),
            activity_level=activity_level,
            reply_rate=reply_rate,
            user_messages_sent_30d=int(self._safe_get(u_row, "messages_sent_30d", 0)),
            user_messages_read_30d=user_read,
            user_replies_sent_30d=user_replies,
            user_notifications_dismissed_30d=int(self._safe_get(u_row, "notifications_dismissed_30d", 0)),
        )

    def _build_business_context(self, business_id: str, user_id: str) -> BusinessContext:
        biz_df = csv_loader.get_business_accounts()
        history_df = csv_loader.get_user_business_history()

        b_matches = biz_df[biz_df["business_id"] == business_id]
        b_row = b_matches.iloc[0] if not b_matches.empty else pd.Series(dtype="object")

        h_matches = history_df[(history_df["business_id"] == business_id) & (history_df["user_id"] == user_id)]
        h_row = h_matches.iloc[0] if not h_matches.empty else pd.Series(dtype="object")

        verified = bool(int(self._safe_get(b_row, "verified", 0)))
        reports = int(self._safe_get(b_row, "user_reports_30d", 0))
        account_age_days = int(self._safe_get(b_row, "account_age_days", 0))
        domain_age_days = int(self._safe_get(b_row, "domain_used_by_sender_age_days", 0))
        official_domain = str(self._safe_get(b_row, "official_domain", "") or "").strip().lower()
        sender_domain = str(self._safe_get(b_row, "domain_used_by_sender", "") or "").strip().lower()

        domain_mismatch = bool(official_domain and sender_domain and official_domain != sender_domain and not verified)

        allows_promotions = bool(int(self._safe_get(h_row, "allows_promotions", 0)))
        opted_out_at = str(self._safe_get(h_row, "promotions_opted_out_at", "") or "").strip()
        why_knows = str(self._safe_get(h_row, "why_user_knows_account", "") or "")
        has_opted_out = bool(opted_out_at) or ("opted_out" in why_knows.lower())

        activity_180d = int(self._safe_get(h_row, "activity_count_180d", 0))
        opened_30d = int(self._safe_get(h_row, "messages_opened_30d", 0))
        dismissed_30d = int(self._safe_get(h_row, "messages_dismissed_30d", 0))
        replied_30d = int(self._safe_get(h_row, "messages_replied_30d", 0))

        is_trusted = verified and not domain_mismatch and reports < 15 and account_age_days > 180

        return BusinessContext(
            business_id=business_id,
            display_name=str(self._safe_get(b_row, "display_name", business_id)),
            brand_name=str(self._safe_get(b_row, "brand_name", "")),
            category=str(self._safe_get(b_row, "category", "")),
            is_verified=verified,
            is_trusted=is_trusted,
            official_domain=official_domain,
            domain_used_by_sender=sender_domain,
            domain_mismatch=domain_mismatch,
            domain_age_days=domain_age_days,
            account_age_days=account_age_days,
            messages_sent_30d=int(self._safe_get(b_row, "messages_sent_30d", 0)),
            report_count=reports,
            why_user_knows_account=why_knows,
            last_activity_at=str(self._safe_get(h_row, "last_activity_at", "") or ""),
            has_opted_in=allows_promotions,
            has_opted_out=has_opted_out,
            promotions_opted_out_at=opted_out_at,
            previous_orders=activity_180d,
            payments_made=replied_30d,
            activity_count_180d=activity_180d,
            messages_opened_30d=opened_30d,
            messages_dismissed_30d=dismissed_30d,
            messages_replied_30d=replied_30d,
        )

    def _build_message_metadata(self, msg_row: pd.Series) -> MessageMetadata:
        sender = self._safe_get(msg_row, "sender_user_id") or self._safe_get(msg_row, "business_id") or "unknown"
        return MessageMetadata(
            conversation_type=str(self._safe_get(msg_row, "conversation_type", "personal")),
            forwarded_count=int(self._safe_get(msg_row, "forwarded_count", 0)),
            timestamp=str(self._safe_get(msg_row, "created_at", "")),
            media_type=str(self._safe_get(msg_row, "media_type", MediaType.TEXT.value) or MediaType.TEXT.value),
            media_id=str(self._safe_get(msg_row, "media_id", "") or ""),
            sender_id=str(sender),
        )

    def _build_history_context(self, user_id: str, sender_id: str, msg_row: pd.Series) -> HistoryContext:
        events_df = csv_loader.get_message_events()
        history_df = csv_loader.get_message_history()

        u_events = events_df[events_df["user_id"] == user_id] if not events_df.empty else pd.DataFrame()

        opened = int(u_events["message_opened"].fillna(0).sum()) if not u_events.empty else 0
        replied = int(u_events["message_replied"].fillna(0).sum()) if not u_events.empty else 0
        ignored = int(u_events["notification_dismissed"].fillna(0).sum()) if not u_events.empty else 0
        muted = int(u_events["muted_after_message"].fillna(0).sum()) if not u_events.empty else 0
        reported = int(u_events["message_reported"].fillna(0).sum()) if not u_events.empty else 0
        reaction_series = u_events["reaction_time_minutes"].dropna() if not u_events.empty else pd.Series(dtype="float")
        avg_reaction = round(float(reaction_series.mean()), 1) if not reaction_series.empty else None

        last_from_sender = []
        last_similar = []

        if not history_df.empty and "message_id" in history_df.columns:
            user_hist = history_df[history_df["user_id"] == user_id].sort_values(by="created_at", ascending=False)
            business_id = str(self._safe_get(msg_row, "business_id", "") or "")
            group_id = str(self._safe_get(msg_row, "group_id", "") or "")

            if sender_id:
                sender_hist = user_hist[user_hist["sender_user_id"] == sender_id]
                last_from_sender = sender_hist["message_id"].head(5).tolist()
            elif business_id:
                biz_hist = user_hist[user_hist["business_id"] == business_id]
                last_from_sender = biz_hist["message_id"].head(5).tolist()

            if group_id:
                grp_hist = user_hist[user_hist["group_id"] == group_id]
                last_similar = grp_hist["message_id"].head(5).tolist()
            else:
                conv_type = str(self._safe_get(msg_row, "conversation_type", ""))
                similar_hist = user_hist[user_hist["conversation_type"] == conv_type]
                last_similar = similar_hist["message_id"].head(5).tolist()

        return HistoryContext(
            last_similar_messages=last_similar,
            last_messages_from_sender=last_from_sender,
            opened_count=opened,
            replied_count=replied,
            ignored_count=ignored,
            muted_count=muted,
            reported_count=reported,
            avg_reaction_time_minutes=avg_reaction,
        )

    def _build_media_context(self, msg_row: pd.Series) -> MediaContext:
        media_type = str(self._safe_get(msg_row, "media_type", "") or "").strip()
        media_id = str(self._safe_get(msg_row, "media_id", "") or "").strip()

        if not media_type or not media_id:
            return MediaContext(has_media=False)

        file_path = None
        if media_type == MediaType.IMAGE.value:
            img_df = csv_loader.get_images()
            row = img_df[img_df["image_id"] == media_id]
            if not row.empty:
                file_path = str(Path(settings.dataset_path) / str(row.iloc[0]["file_path"]))
        elif media_type == MediaType.VOICE.value:
            voice_df = csv_loader.get_voice_notes()
            row = voice_df[voice_df["voice_note_id"] == media_id]
            if not row.empty:
                file_path = str(Path(settings.dataset_path) / str(row.iloc[0]["file_path"]))

        return MediaContext(
            has_media=True,
            media_type=media_type,
            media_id=media_id,
            file_path=file_path,
        )

    def _calculate_derived_features(
        self,
        text_content: Optional[str],
        user: UserProfile,
        group: Optional[GroupContext],
        business: Optional[BusinessContext],
        msg: MessageMetadata,
        history: HistoryContext,
    ) -> DerivedFeatures:
        prompt_injection = self._detect_prompt_injection(text_content)
        domain_spoofing = bool(business and business.domain_mismatch)

        # 1. Engagement Score
        total_interactions = user.recent_opens + user.recent_replies + user.dismiss_count
        engagement = 0.0
        if total_interactions > 0:
            engagement = (user.recent_opens * 0.5 + user.recent_replies * 1.0) / total_interactions
        engagement = max(0.0, min(1.0, engagement))

        # 2. Trust Score
        trust = 0.5
        if business:
            if business.is_verified:
                trust += 0.3
            if business.has_opted_in:
                trust += 0.15
            if business.activity_count_180d > 0 and not business.has_opted_out:
                trust += 0.15
            if business.has_opted_out:
                trust -= 0.35
            if business.domain_mismatch:
                trust -= 0.5
            if business.report_count >= 15:
                trust -= 0.4
            elif business.report_count > 5:
                trust -= 0.15
        elif group:
            if group.is_admin:
                trust += 0.3
            if group.is_muted:
                trust -= 0.3
        else:
            if history.last_messages_from_sender:
                trust += 0.25

        if prompt_injection:
            trust -= 0.5
        trust = max(0.0, min(1.0, trust))

        # 3. Urgency Score
        urgency = 0.45
        if msg.conversation_type == ConversationType.PERSONAL.value:
            urgency += 0.15
        if msg.forwarded_count >= 5:
            urgency -= 0.35
        elif msg.forwarded_count > 0:
            urgency -= min(0.25, msg.forwarded_count * 0.06)
        if user.quiet_hours:
            urgency -= 0.2
        if group and group.is_admin:
            urgency += 0.15
        urgency = max(0.0, min(1.0, urgency))

        # 4. Spam Probability
        spam_prob = 0.1
        if msg.forwarded_count >= 5:
            spam_prob += 0.45
        if domain_spoofing:
            spam_prob += 0.65
        if prompt_injection:
            spam_prob += 0.75
        if business:
            if not business.is_verified and business.account_age_days < 45:
                spam_prob += 0.45
            if business.report_count >= 20:
                spam_prob += 0.35
            if business.has_opted_out:
                spam_prob += 0.35
        if group and group.is_muted:
            spam_prob += 0.25
        spam_prob = max(0.0, min(1.0, spam_prob))

        # 5. Global Notification Priority
        base_priority = (urgency * 0.4) + (trust * 0.35) + (engagement * 0.25)
        penalty = (user.notification_fatigue_score * 0.25) + (spam_prob * 0.55)
        priority = max(0.0, min(1.0, base_priority - penalty))

        return DerivedFeatures(
            trust_score=round(trust, 2),
            urgency_score=round(urgency, 2),
            engagement_score=round(engagement, 2),
            spam_probability=round(spam_prob, 2),
            notification_priority=round(priority, 2),
            domain_spoofing_detected=domain_spoofing,
            prompt_injection_suspected=prompt_injection,
        )


context_builder = ContextBuilder()
