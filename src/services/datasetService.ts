import api from './api';
import type { RoutingDecision, MessageType } from './notificationService';
import type { ScenarioData } from './simulationService';
import type { RoutingAction } from '../components/shared/DecisionCard';

export interface DatasetFileSummary {
  file: string;
  rows: number;
  columns: string[];
}

export interface DailyTrendPoint {
  date: string;
  sent: number;
  dismissed: number;
}

export interface DatasetOverview {
  counts: {
    incomingMessages: number;
    messageHistory: number;
    messageEvents: number;
    users: number;
    groups: number;
    groupMembers: number;
    businessAccounts: number;
    verifiedBusinesses: number;
    spoofedBusinesses: number;
    userBusinessHistory: number;
    sampleMessages: number;
    images: number;
    voiceNotes: number;
    dailySummaryRows: number;
    promptInjections: number;
    domainSpoofs: number;
    withMedia: number;
    liveGeminiCount: number;
  };
  actionCounts: Record<RoutingAction, number>;
  typeCounts: Record<string, number>;
  channelCounts: {
    personal: number;
    group: number;
    business: number;
  };
  dailyTrend: DailyTrendPoint[];
  benchmark: {
    totalSamples: number;
    actionAccuracy: number;
    typeAccuracy: number;
  };
  avgConfidence: number;
  geminiConfigured: boolean;
  files: DatasetFileSummary[];
}

export interface MessageEventDetail {
  user_id: string;
  message_id: string;
  message_opened: boolean;
  message_replied: boolean;
  reaction_time_minutes: number | null;
  notification_dismissed: boolean;
  muted_after_message: boolean;
  message_reported: boolean;
}

export interface HistoricalMatchDetail {
  message_id: string;
  created_at: string;
  conversation_type: string;
  message_text: string;
  media_type: string;
  media_id: string;
  forwarded_count: number;
  similarity: number;
  event: MessageEventDetail | null;
}

export interface UserDailyRow {
  user_id: string;
  date: string;
  notifications_sent: number;
  notifications_dismissed: number;
}

export interface BusinessAccountEntity {
  business_id: string;
  display_name: string;
  brand_name: string;
  category: string;
  verified: boolean;
  official_domain: string;
  domain_used_by_sender: string;
  account_age_days: number;
  user_reports_30d: number;
  domain_used_by_sender_age_days: number;
  domain_mismatch: boolean;
}

export interface UserBusinessHistoryDetail {
  user_id: string;
  business_id: string;
  why_user_knows_account: string;
  allows_promotions: boolean;
  promotions_opted_out_at: string;
  activity_count_180d: number;
  messages_opened_30d: number;
  messages_dismissed_30d: number;
  messages_replied_30d: number;
}

export interface GroupEntity {
  group_id: string;
  group_name: string;
  group_type: string;
  member_count: number;
  admin_count: number;
  messages_last_30d: number;
}

export interface GroupMemberDetail {
  group_id: string;
  user_id: string;
  role: string;
  group_muted_by_user: boolean;
  messages_read_30d: number;
  replies_sent_30d: number;
}

export interface FullMessageContextDTO {
  message: {
    message_id: string;
    user_id: string;
    created_at: string;
    conversation_type: 'personal' | 'group' | 'business';
    sender_user_id: string;
    group_id: string;
    business_id: string;
    message_text: string;
    media_type: string;
    media_id: string;
    forwarded_count: number;
  };
  resolvedSenderName: string;
  resolvedChannelName: string;
  isVerifiedSender: boolean;
  user: {
    user_id: string;
    do_not_disturb_window: string;
    in_quiet_hours: boolean;
    messages_opened_30d: number;
    messages_replied_30d: number;
    notifications_dismissed_30d: number;
    messages_reported_30d: number;
    avg_daily_sent: number;
    avg_daily_dismissed: number;
    dismissal_rate: number;
    fatigue_score: number;
    daily_trend: UserDailyRow[];
  };
  business: (BusinessAccountEntity & {
    user_history: UserBusinessHistoryDetail | null;
    has_opted_out: boolean;
  }) | null;
  group: (GroupEntity & {
    user_membership: GroupMemberDetail | null;
    sender_membership: GroupMemberDetail | null;
    sender_is_admin: boolean;
    group_muted_by_user: boolean;
    user_reply_rate: number;
  }) | null;
  media: {
    has_media: boolean;
    media_type: string;
    media_id: string;
    file_path: string | null;
  };
  history: {
    matches: HistoricalMatchDetail[];
    evidence_ids: string[];
    summary: string;
    engagement: {
      opened: number;
      replied: number;
      dismissed: number;
      muted: number;
      reported: number;
    };
  };
  features: {
    trustScore: number;
    urgency: number;
    spamProbability: number;
    engagementScore: number;
    notificationPriority: number;
    domainSpoofingDetected: boolean;
    promptInjectionSuspected: boolean;
    riskFlags: string[];
  };
}

export interface UserEntity {
  user_id: string;
  do_not_disturb_window: string;
  messages_opened_30d: number;
  messages_replied_30d: number;
  notifications_dismissed_30d: number;
  messages_reported_30d: number;
  avg_daily_sent: number;
  avg_daily_dismissed: number;
  daily_trend: UserDailyRow[];
}

export interface SampleMessageDTO {
  message_id: string;
  user_id: string;
  created_at: string;
  conversation_type: 'personal' | 'group' | 'business';
  sender_user_id: string;
  group_id: string;
  business_id: string;
  message_text: string;
  media_type: string;
  media_id: string;
  forwarded_count: number;
  action: RoutingAction;
  message_type: MessageType;
  reason: string;
  confidence: number;
  evidence_message_ids: string;
  resolvedSenderName: string;
  riskFlags: string[];
  predictedAction: RoutingAction;
  predictedType: MessageType;
  actionMatched: boolean;
}

export interface EntitiesResponse {
  businesses: BusinessAccountEntity[];
  users: UserEntity[];
  groups: GroupEntity[];
  images: Array<{ image_id: string; file_path: string }>;
  voiceNotes: Array<{ voice_note_id: string; file_path: string }>;
}

export const datasetService = {
  getOverview: async (): Promise<DatasetOverview> => {
    const res = await api.get<DatasetOverview>('/dataset/overview');
    return res.data;
  },

  getMessages: async (params?: {
    search?: string;
    channel?: string;
    action?: string;
    tag?: string;
  }): Promise<{ total: number; items: ScenarioData[] }> => {
    const res = await api.get<{ total: number; items: ScenarioData[] }>('/messages', { params });
    return res.data;
  },

  getMessageContext: async (
    id: string
  ): Promise<{ context: FullMessageContextDTO; decision: RoutingDecision }> => {
    const res = await api.get<{ context: FullMessageContextDTO; decision: RoutingDecision }>(
      `/messages/${encodeURIComponent(id)}/context`
    );
    return res.data;
  },

  routeWithGemini: async (
    id: string
  ): Promise<{ decision: RoutingDecision; context: FullMessageContextDTO }> => {
    const res = await api.post<{ decision: RoutingDecision; context: FullMessageContextDTO }>(
      `/messages/${encodeURIComponent(id)}/route`
    );
    return res.data;
  },

  getSamples: async (): Promise<{ total: number; items: SampleMessageDTO[] }> => {
    const res = await api.get<{ total: number; items: SampleMessageDTO[] }>('/samples');
    return res.data;
  },

  getEntities: async (): Promise<EntitiesResponse> => {
    const res = await api.get<EntitiesResponse>('/entities');
    return res.data;
  },

  getOutputDownloadUrl: (): string => '/api/output/download',
};
