import api from './api';
import { RoutingDecision } from './notificationService';

export interface SimulationStatus {
  id: string;
  scenarioId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  progress: number;
  message?: string;
  decision?: RoutingDecision;
}

export interface SystemAnalytics {
  totalProcessed: number;
  avgProcessingTimeMs: number;
  accuracyRate: number;
  spamCaught: number;
  uptime: string;
}

export interface ScenarioData {
  id: string;
  userId: string;
  label: string;
  tag: string;
  icon: string;
  description: string;
  sender: string;
  channelName: string;
  type: 'business' | 'group' | 'personal';
  isVerified: boolean;
  createdAt: string;
  forwardedCount: number;
  mediaType: string;
  mediaId: string;
  mediaPath: string | null;
  riskFlags: string[];
  decision: RoutingDecision;
}

export const simulationService = {
  getScenarios: async (): Promise<ScenarioData[]> => {
    const response = await api.get<ScenarioData[]>('/simulation/scenarios');
    return response.data;
  },

  startSimulation: async (
    scenarioId: string = 'msg_026',
    useLiveGemini = false
  ): Promise<{ simulationId: string }> => {
    const response = await api.post<{ simulationId: string }>('/simulation/start', {
      scenarioId,
      useLiveGemini,
    });
    return response.data;
  },

  getSimulationStatus: async (simulationId: string): Promise<SimulationStatus> => {
    const response = await api.get<SimulationStatus>(`/simulation/${simulationId}/status`);
    return response.data;
  },

  getAnalytics: async (): Promise<SystemAnalytics> => {
    const response = await api.get<SystemAnalytics>('/simulation/analytics');
    return response.data;
  },
};
