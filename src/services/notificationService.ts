import api from './api';
import type { RoutingAction } from '../components/shared/DecisionCard';

export type MessageType =
  | 'personal'
  | 'urgent'
  | 'event'
  | 'payment'
  | 'business_update'
  | 'promotion'
  | 'greeting'
  | 'forward'
  | 'spam'
  | 'scam'
  | 'unknown';

export interface MessagePayload {
  id: string;
  sender: string;
  content: string;
  type: 'personal' | 'business' | 'group';
  timestamp: string;
  mediaUrl?: string;
}

export interface RoutingDecision {
  id: string;
  messageId: string;
  action: RoutingAction;
  messageType: MessageType;
  reason: string;
  confidence: number;
  confidenceUnit: number;
  evidenceIds: string[];
  trustScore: number;
  spamProbability: number;
  urgency: number;
  reflectionResult: string;
  processedAt: string;
  source: 'context-engine' | 'gemini-live';
  modelUsed?: string;
}

export const notificationService = {
  routeMessageLive: async (messageId: string): Promise<{ decision: RoutingDecision }> => {
    const response = await api.post<{ decision: RoutingDecision }>(`/messages/${encodeURIComponent(messageId)}/route`);
    return response.data;
  },
};
