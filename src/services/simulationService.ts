import api from './api';
import { RoutingDecision } from './notificationService';

export interface SimulationStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  progress: number;
  message?: string;
  startedAt?: string;
  completedAt?: string;
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
  label: string;
  icon: string;
  description: string;
  sender: string;
  type: 'business' | 'group' | 'personal';
  decision: RoutingDecision;
}

export const simulationService = {
  getScenarios: async (): Promise<ScenarioData[]> => {
    const response = await api.get<ScenarioData[]>('/simulation/scenarios');
    return response.data;
  },

  startSimulation: async (scenarioId: string = 'default'): Promise<{ simulationId: string }> => {
    const response = await api.post<{ simulationId: string }>('/simulation/start', { scenarioId });
    return response.data;
  },

  stopSimulation: async (simulationId: string): Promise<void> => {
    await api.post(`/simulation/${simulationId}/stop`);
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
