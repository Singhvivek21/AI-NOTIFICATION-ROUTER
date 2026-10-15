import api from './api';
import { RoutingAction } from '../components/shared/DecisionCard';

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
  reason: string;
  confidence: number;
  evidenceIds: string[];
  trustScore: number;
  spamProbability: number;
  urgency: number;
  reflectionResult: string;
  processedAt: string;
}

export const notificationService = {
  /**
   * Submit a new message to the AI routing pipeline
   */
  processMessage: async (payload: MessagePayload): Promise<RoutingDecision> => {
    const response = await api.post<RoutingDecision>('/notifications/process', payload);
    return response.data;
  },

  /**
   * Fetch historical routing decisions
   */
  getDecisionHistory: async (limit: number = 20): Promise<RoutingDecision[]> => {
    const response = await api.get<RoutingDecision[]>('/notifications/history', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get a specific decision by ID
   */
  getDecisionById: async (id: string): Promise<RoutingDecision> => {
    const response = await api.get<RoutingDecision>(`/notifications/decisions/${id}`);
    return response.data;
  },
};
