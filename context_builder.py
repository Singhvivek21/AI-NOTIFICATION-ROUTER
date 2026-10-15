from schemas import BusinessContext, DerivedFeatures, GroupContext, HistoryContext, MediaContext, MessageContext, MessageMetadata, UserProfile
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from pydantic import BaseModel, Field

from config import settings
from constants import ConversationType, MediaType
from csv_loader import csv_loader

logger = logging.getLogger(__name__)

# ==========================================
# PYDANTIC MODELS FOR STRUCTURED CONTEXT
# ==========================================

# ==========================================
# CONTEXT BUILDER SERVICE
# ==========================================

class ContextBuilder:
    """
    Constructs a rich, unified context for an incoming message by joining data 
    across all available CSV datasets. Calculates derived heuristic features 
    to assist the LLM in reasoning.
    """

    @staticmethod
    def _safe_get(row: pd.Series, column: str, default: Any = None) -> Any:
        """Safely extract a value from a pandas Series, handling missing columns/NaNs."""
        if column in row.index and pd.notna(row[column]):
            return row[column]
        return default

    def build_context(self, message_id: str) -> MessageContext:
        """
        Main entry point. Given a message_id, orchestrates the retrieval and 
        assembly of the complete MessageContext object.
        """
        logger.info(f"Building context for message_id: {message_id}")
        
        # 1. Fetch base message
        messages_df = csv_loader.get_messages()
        msg_mask = messages_df['message_id'] == message_id
        if not msg_mask.any():
            raise ValueError(f"Message ID {message_id} not found in messages.csv")
        msg_row = messages_df[msg_mask].iloc[0]

        user_id = self._safe_get(msg_row, 'user_id', "")
        sender_id = self._safe_get(msg_row, 'sender_user_id', "")
        conv_type = self._safe_get(msg_row, 'conversation_type', ConversationType.PERSONAL.value)
        
        # 2. Build sub-contexts
        user_profile = self._build_user_profile(user_id)
        
        group_ctx = None
        if conv_type == ConversationType.GROUP.value:
            group_id = self._safe_get(msg_row, 'group_id', "")
            group_ctx = self._build_group_context(group_id, user_id, sender_id)
            
        business_ctx = None
        if conv_type == ConversationType.BUSINESS.value:
            business_id = self._safe_get(msg_row, 'business_id', "")
            business_ctx = self._build_business_context(business_id, user_id)
            
        msg_metadata = self._build_message_metadata(msg_row)
        history_ctx = self._build_history_context(user_id, sender_id, msg_row)
        media_ctx = self._build_media_context(msg_row)
        
        # 3. Calculate derived heuristic features
        features = self._calculate_derived_features(
            user_profile, group_ctx, business_ctx, msg_metadata, history_ctx
        )

        return MessageContext(
            message_id=message_id,
            text_content=self._safe_get(msg_row, 'message_text'),
            user=user_profile,
            group=group_ctx,
            business=business_ctx,
            message_metadata=msg_metadata,
            history=history_ctx,
            media=media_ctx,
            features=features
        )

    def _build_user_profile(self, user_id: str) -> UserProfile:
        users_df = csv_loader.get_users()
        daily_df = csv_loader.get_daily_notification_summary()
        
        u_row = users_df[users_df['user_id'] == user_id].iloc[0] if not users_df[users_df['user_id'] == user_id].empty else pd.Series()
        d_row = daily_df[daily_df['user_id'] == user_id].iloc[0] if not daily_df[daily_df['user_id'] == user_id].empty else pd.Series()

        daily_load = int(self._safe_get(d_row, 'notification_load', 0))
        quiet_hours = bool(self._safe_get(u_row, 'quiet_hours', False))
        
        # Heuristic: Fatigue increases linearly with load, spikes if in quiet hours
        fatigue = min(1.0, daily_load / 50.0)
        if quiet_hours:
            fatigue = min(1.0, fatigue + 0.3)

        return UserProfile(
            user_id=user_id,
            quiet_hours=quiet_hours,
            daily_notification_load=daily_load,
            recent_opens=int(self._safe_get(u_row, 'recent_opens', 0)),
            recent_replies=int(self._safe_get(u_row, 'recent_replies', 0)),
            dismiss_count=int(self._safe_get(u_row, 'dismiss_count', 0)),
            report_count=int(self._safe_get(u_row, 'report_count', 0)),
            notification_fatigue_score=round(fatigue, 2)
        )

    def _build_group_context(self, group_id: str, user_id: str, sender_id: str) -> GroupContext:
        groups_df = csv_loader.get_groups()
        members_df = csv_loader.get_group_members()
        
        g_row = groups_df[groups_df['group_id'] == group_id].iloc[0] if not groups_df[groups_df['group_id'] == group_id].empty else pd.Series()
        
        # Current user's relationship to group
        u_member = members_df[(members_df['group_id'] == group_id) & (members_df['user_id'] == user_id)]
        u_row = u_member.iloc[0] if not u_member.empty else pd.Series()
        
        # Sender's relationship to group
        s_member = members_df[(members_df['group_id'] == group_id) & (members_df['user_id'] == sender_id)]
        s_row = s_member.iloc[0] if not s_member.empty else pd.Series()

        return GroupContext(
            group_type=str(self._safe_get(g_row, 'group_type', 'unknown')),
            group_size=int(self._safe_get(g_row, 'size', 0)),
            sender_role=str(self._safe_get(s_row, 'role', 'member')),
            is_admin=bool(self._safe_get(s_row, 'role', '') == 'admin'),
            is_muted=bool(self._safe_get(u_row, 'mute_state', False)),
            activity_level=str(self._safe_get(g_row, 'recent_activity', 'medium')),
            reply_rate=float(self._safe_get(u_row, 'reply_rate', 0.0))
        )

    def _build_business_context(self, business_id: str, user_id: str) -> BusinessContext:
        biz_df = csv_loader.get_business_accounts()
        history_df = csv_loader.get_user_business_history()
        
        b_row = biz_df[biz_df['business_id'] == business_id].iloc[0] if not biz_df[biz_df['business_id'] == business_id].empty else pd.Series()
        h_row = history_df[(history_df['business_id'] == business_id) & (history_df['user_id'] == user_id)]
        h_row = h_row.iloc[0] if not h_row.empty else pd.Series()

        verified = bool(self._safe_get(b_row, 'verification', False))
        reports = int(self._safe_get(b_row, 'reports', 0))

        return BusinessContext(
            is_verified=verified,
            is_trusted=verified and (reports == 0),
            previous_orders=int(self._safe_get(h_row, 'orders', 0)),
            payments_made=int(self._safe_get(h_row, 'payments', 0)),
            has_opted_in=bool(self._safe_get(h_row, 'opt_ins', False)),
            has_opted_out=bool(self._safe_get(h_row, 'opt_outs', False)),
            account_age_days=int(self._safe_get(b_row, 'account_age', 0)),
            report_count=reports
        )

    def _build_message_metadata(self, msg_row: pd.Series) -> MessageMetadata:
        return MessageMetadata(
            conversation_type=self._safe_get(msg_row, 'conversation_type', 'personal'),
            forwarded_count=int(self._safe_get(msg_row, 'forwarded_count', 0)),
            timestamp=str(self._safe_get(msg_row, 'created_at', '')),
            media_type=self._safe_get(msg_row, 'media_type', MediaType.TEXT.value) or MediaType.TEXT.value,
            sender_id=self._safe_get(msg_row, 'sender_user_id', self._safe_get(msg_row, 'business_id', 'unknown'))
        )

    def _build_history_context(self, user_id: str, sender_id: str, msg_row: pd.Series) -> HistoryContext:
        events_df = csv_loader.get_message_events()
        history_df = csv_loader.get_message_history()
        
        # Filter events for this user
        u_events = events_df[events_df['user_id'] == user_id] if not events_df.empty else pd.DataFrame()
        
        opened = len(u_events[u_events['event_type'] == 'opened']) if not u_events.empty else 0
        ignored = len(u_events[u_events['event_type'] == 'dismissed']) if not u_events.empty else 0
        muted = len(u_events[u_events['event_type'] == 'muted']) if not u_events.empty else 0
        reported = len(u_events[u_events['event_type'] == 'reported']) if not u_events.empty else 0

        last_from_sender = []
        last_similar = []
        
        if not history_df.empty and 'message_id' in history_df.columns:
            # Deterministic retrieval: Messages from the same sender
            if 'sender_user_id' in history_df.columns:
                sender_hist = history_df[
                    (history_df['user_id'] == user_id) & 
                    (history_df['sender_user_id'] == sender_id)
                ]
                last_from_sender = sender_hist['message_id'].tail(3).tolist()
            
            # Deterministic retrieval: Similar messages based on conversation and media type proxy
            conv_type = self._safe_get(msg_row, 'conversation_type')
            media_type = self._safe_get(msg_row, 'media_type')
            if 'conversation_type' in history_df.columns and 'media_type' in history_df.columns:
                similar_hist = history_df[
                    (history_df['user_id'] == user_id) & 
                    (history_df['conversation_type'] == conv_type) & 
                    (history_df['media_type'] == media_type)
                ]
                last_similar = similar_hist['message_id'].tail(3).tolist()

        return HistoryContext(
            last_similar_messages=last_similar, 
            last_messages_from_sender=last_from_sender, 
            opened_count=opened,
            ignored_count=ignored,
            muted_count=muted,
            reported_count=reported
        )

    def _build_media_context(self, msg_row: pd.Series) -> MediaContext:
        media_type = self._safe_get(msg_row, 'media_type', "")
        media_id = self._safe_get(msg_row, 'media_id', "")
        
        if not media_type or pd.isna(media_type) or not media_id:
            return MediaContext(has_media=False)
            
        file_path = None
        if media_type == MediaType.IMAGE.value:
            img_df = csv_loader.get_images()
            row = img_df[img_df['media_id'] == media_id]
            if not row.empty:
                file_path = str(Path(settings.media_path) / str(row.iloc[0]['file_path']))
        elif media_type == MediaType.VOICE.value:
            voice_df = csv_loader.get_voice_notes()
            row = voice_df[voice_df['media_id'] == media_id]
            if not row.empty:
                file_path = str(Path(settings.media_path) / str(row.iloc[0]['file_path']))

        return MediaContext(
            has_media=True,
            media_type=media_type,
            file_path=file_path
        )

    def _calculate_derived_features(
        self, 
        user: UserProfile, 
        group: Optional[GroupContext], 
        business: Optional[BusinessContext], 
        msg: MessageMetadata, 
        history: HistoryContext
    ) -> DerivedFeatures:
        """
        Calculates heuristics purely in Python to guide the LLM's attention.
        These are floating point scores between 0.0 and 1.0.
        """
        # 1. Engagement Score
        total_interactions = user.recent_opens + user.recent_replies + user.dismiss_count
        engagement = 0.0
        if total_interactions > 0:
            engagement = (user.recent_opens * 0.5 + user.recent_replies * 1.0) / total_interactions
        engagement = max(0.0, min(1.0, engagement))

        # 2. Trust Score
        trust = 0.5 # Baseline neutral
        if business:
            if business.is_verified: trust += 0.3
            if business.has_opted_in: trust += 0.2
            if business.previous_orders > 0 or business.payments_made > 0: trust += 0.3
            if business.has_opted_out: trust -= 0.6
            if business.report_count > 0: trust -= (business.report_count * 0.2)
        elif group:
            if group.is_admin: trust += 0.3
            if group.is_muted: trust -= 0.3
            if group.sender_role == 'admin': trust += 0.2
        else: # Personal
            if history.opened_count > 0 or history.last_messages_from_sender: trust += 0.2
            
        if history.reported_count > 0: trust -= 0.5
        if history.muted_count > 0: trust -= 0.3
        trust = max(0.0, min(1.0, trust))

        # 3. Urgency Score
        urgency = 0.5
        if msg.conversation_type == ConversationType.PERSONAL.value:
            urgency += 0.2
        if msg.forwarded_count > 0:
            urgency -= min(0.4, msg.forwarded_count * 0.1)
        if user.quiet_hours:
            urgency -= 0.4
        if len(history.last_messages_from_sender) > 0 and engagement > 0.5:
            urgency += 0.2
        urgency = max(0.0, min(1.0, urgency))

        # 4. Spam Probability
        spam_prob = 0.1
        if msg.forwarded_count >= 5: spam_prob += 0.5
        if business and not business.is_verified and business.account_age_days < 30: spam_prob += 0.4
        if user.report_count > 5: spam_prob += 0.2
        if history.muted_count > 5: spam_prob += 0.2
        spam_prob = max(0.0, min(1.0, spam_prob))
        
        # 5. Global Notification Priority
        base_priority = (urgency * 0.4) + (trust * 0.3) + (engagement * 0.3)
        penalty = (user.notification_fatigue_score * 0.3) + (spam_prob * 0.5)
        priority = max(0.0, min(1.0, base_priority - penalty))

        return DerivedFeatures(
            trust_score=round(trust, 2),
            urgency_score=round(urgency, 2),
            engagement_score=round(engagement, 2),
            spam_probability=round(spam_prob, 2),
            notification_priority=round(priority, 2)
        )

# Export a single instance to be used by the application
context_builder = ContextBuilder()
