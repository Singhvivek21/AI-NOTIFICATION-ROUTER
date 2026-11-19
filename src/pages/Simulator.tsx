import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Play,
  Sparkles,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Loader2,
  Database,
  GitBranch,
} from 'lucide-react';
import PhoneSimulator, { type NotificationData } from '../components/simulator/PhoneSimulator';
import AIThinking from '../components/shared/AIThinking';
import DecisionCard from '../components/shared/DecisionCard';
import ContextInspector from '../components/shared/ContextInspector';
import PipelineFlow from '../components/shared/PipelineFlow';
import { simulationService, type ScenarioData } from '../services/simulationService';
import { datasetService, type FullMessageContextDTO } from '../services/datasetService';
import type { RoutingDecision } from '../services/notificationService';
import { cn } from '../theme';

const CATEGORY_TABS = [
  'All',
  'Domain Spoofing',
  'Prompt Injection',
  'Urgent / Actionable',
  'Scam / Phishing',
  'Opted-Out Promo',
  'Voice Note',
  'Image Media',
];

export default function Simulator() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isTracing, setIsTracing] = useState(false);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [autoCycle, setAutoCycle] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(10);
  const [activeDecision, setActiveDecision] = useState<RoutingDecision | null>(null);
  const [contextData, setContextData] = useState<FullMessageContextDTO | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [lowerTab, setLowerTab] = useState<'context' | 'pipeline'>('context');

  // Load all 110 scenarios from backend
  useEffect(() => {
    let active = true;
    simulationService
      .getScenarios()
      .then((list) => {
        if (!active) return;
        setScenarios(list);
        const paramId = searchParams.get('id');
        const initial = (paramId && list.find((s) => s.id === paramId)) || list[0];
        if (initial) {
          setSelectedId(initial.id);
          setActiveDecision(initial.decision);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load messages from server.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredScenarios = useMemo(() => {
    if (selectedTag === 'All') return scenarios;
    return scenarios.filter((s) => s.tag === selectedTag);
  }, [scenarios, selectedTag]);

  const activeScenario = useMemo(() => {
    return scenarios.find((s) => s.id === selectedId) || filteredScenarios[0] || null;
  }, [scenarios, filteredScenarios, selectedId]);

  // Fetch full 360-degree joined context whenever selected message changes
  useEffect(() => {
    if (!activeScenario) return;
    let active = true;
    setContextLoading(true);
    setGeminiError(null);
    setActiveDecision(activeScenario.decision);

    datasetService
      .getMessageContext(activeScenario.id)
      .then((res) => {
        if (!active) return;
        setContextData(res.context);
        setActiveDecision(res.decision);
        setContextLoading(false);
      })
      .catch(() => {
        if (active) setContextLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeScenario?.id]);

  const handleSelectScenario = (id: string) => {
    setSelectedId(id);
    setSearchParams({ id }, { replace: true });
    setIsTracing(false);
    setPipelineStep(10);
    setGeminiError(null);
  };

  const handleTagSelect = (tag: string) => {
    setSelectedTag(tag);
    const matching = tag === 'All' ? scenarios : scenarios.filter((s) => s.tag === tag);
    if (matching.length > 0 && !matching.some((s) => s.id === selectedId)) {
      handleSelectScenario(matching[0].id);
    }
  };

  const handleRunTrace = useCallback(() => {
    if (!activeScenario) return;
    setGeminiError(null);
    setIsTracing(true);
    setPipelineStep(0);
    setActiveDecision(null);

    let step = 0;
    const timer = setInterval(() => {
      step += 2;
      setPipelineStep(Math.min(10, step));
      if (step >= 10) {
        clearInterval(timer);
      }
    }, 450);
  }, [activeScenario]);

  const handleTraceComplete = useCallback(() => {
    setIsTracing(false);
    setPipelineStep(10);
    if (activeScenario) {
      setActiveDecision(activeScenario.decision);
    }
  }, [activeScenario]);

  const handleRunLiveGemini = async () => {
    if (!activeScenario || isGeminiLoading) return;
    setGeminiError(null);
    setIsGeminiLoading(true);
    setIsTracing(true);
    setPipelineStep(5);

    try {
      const res = await datasetService.routeWithGemini(activeScenario.id);
      setActiveDecision(res.decision);
      setContextData(res.context);
      setScenarios((prev) =>
        prev.map((item) =>
          item.id === activeScenario.id ? { ...item, decision: res.decision } : item
        )
      );
      setPipelineStep(10);
    } catch (err: unknown) {
      const serverMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Live Gemini routing failed.');
      setGeminiError(serverMsg);
      setActiveDecision(activeScenario.decision);
    } finally {
      setIsGeminiLoading(false);
      setIsTracing(false);
    }
  };

  // Auto-cycle across filtered scenarios
  useEffect(() => {
    if (!autoCycle || filteredScenarios.length <= 1) return;
    const interval = setInterval(() => {
      const idx = filteredScenarios.findIndex((s) => s.id === activeScenario?.id);
      const next = filteredScenarios[(idx + 1) % filteredScenarios.length];
      if (next) {
        handleSelectScenario(next.id);
      }
    }, 5500);
    return () => clearInterval(interval);
  }, [autoCycle, filteredScenarios, activeScenario?.id]);

  const phoneNotification: NotificationData | null = activeScenario
    ? {
        id: activeScenario.id,
        type: activeScenario.type,
        sender: activeScenario.sender,
        channelName: activeScenario.channelName,
        message: activeScenario.description,
        isVerified: activeScenario.isVerified,
        time: activeScenario.createdAt.slice(11, 16) || 'Now',
        mediaType: activeScenario.mediaType,
        forwardedCount: activeScenario.forwardedCount,
        riskFlags: activeScenario.riskFlags,
        action: activeDecision?.action,
      }
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        <span>Loading 110 messages from dataset...</span>
      </div>
    );
  }

  if (error || !activeScenario) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 text-sm text-rose-200 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
        <span>{error || 'No messages available in dataset.'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Primary Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Interactive Message Simulator
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Inspect any of the {scenarios.length} incoming messages, view joined CSV evidence, or trigger a live Gemini Flash + Reflection pass.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunTrace}
            disabled={isTracing || isGeminiLoading}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#11141C] hover:bg-[#181C27] border border-white/[0.1] text-xs font-semibold text-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 text-emerald-400" />
            <span>Run Trace</span>
          </button>

          <button
            type="button"
            onClick={handleRunLiveGemini}
            disabled={isGeminiLoading}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGeminiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>{isGeminiLoading ? 'Running Gemini...' : 'Run Live Gemini'}</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoCycle((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
              autoCycle
                ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                : 'bg-[#11141C] hover:bg-[#181C27] border-white/[0.1] text-slate-300'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', autoCycle && 'animate-spin')} />
            <span>{autoCycle ? 'Stop Cycle' : 'Auto-Cycle'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoCycle(false);
              setIsTracing(false);
              setPipelineStep(10);
              setGeminiError(null);
              setActiveDecision(activeScenario.decision);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#11141C] hover:bg-[#181C27] border border-white/[0.1] text-xs font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Reset simulator state"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs + Message Picker */}
      <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORY_TABS.map((tag) => {
            const count =
              tag === 'All'
                ? scenarios.length
                : scenarios.filter((s) => s.tag === tag).length;
            const active = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagSelect(tag)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  active
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                )}
              >
                {tag}{' '}
                <span className="font-mono tabular-nums text-[11px] opacity-75 ml-1">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-white/[0.06]">
          <label
            htmlFor="message-select"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0"
          >
            Active Message
          </label>
          <select
            id="message-select"
            value={activeScenario.id}
            onChange={(e) => handleSelectScenario(e.target.value)}
            className="flex-1 h-9 px-3 rounded-lg bg-[#090B10] border border-white/[0.1] text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500/50"
          >
            {filteredScenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · [{s.decision.action.toUpperCase()}] {s.sender} — {s.description.slice(0, 72)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Gemini Error Banner (propagates real API error) */}
      {geminiError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-200 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-100 mb-0.5">Live Gemini Pass Error</div>
            <p className="text-rose-200/90 leading-relaxed">{geminiError}</p>
          </div>
        </div>
      )}

      {/* Main Split Stage: Phone Preview + Decision / Trace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-4 flex flex-col items-center">
          <PhoneSimulator customNotification={phoneNotification} disableLoop={true} />
        </div>

        <div className="xl:col-span-8 space-y-5">
          {isTracing && (
            <AIThinking
              isActive={isTracing}
              speedMs={isGeminiLoading ? 950 : 280}
              modeLabel={isGeminiLoading ? 'Live Gemini Pass' : 'Trace Simulation'}
              onComplete={isGeminiLoading ? undefined : handleTraceComplete}
            />
          )}

          {activeDecision && (
            <DecisionCard
              action={activeDecision.action}
              messageType={activeDecision.messageType}
              reason={activeDecision.reason}
              confidence={activeDecision.confidence}
              evidenceIds={activeDecision.evidenceIds}
              trustScore={activeDecision.trustScore}
              spamProbability={activeDecision.spamProbability}
              urgency={activeDecision.urgency}
              reflectionResult={activeDecision.reflectionResult}
              source={activeDecision.source}
              modelUsed={activeDecision.modelUsed}
              riskFlags={activeScenario.riskFlags}
            />
          )}

          {/* Lower Detail Tabs: 360° Relational Context vs 10-Stage Architecture */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
              <button
                type="button"
                onClick={() => setLowerTab('context')}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer',
                  lowerTab === 'context'
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Database className="h-3.5 w-3.5" />
                <span>360° Joined CSV Context</span>
              </button>
              <button
                type="button"
                onClick={() => setLowerTab('pipeline')}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer',
                  lowerTab === 'pipeline'
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>10-Stage Pipeline Flow</span>
              </button>
            </div>

            {lowerTab === 'context' ? (
              contextLoading || !contextData ? (
                <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-6 text-xs text-slate-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span>Joining relational CSV records for {activeScenario.id}...</span>
                </div>
              ) : (
                <ContextInspector context={contextData} />
              )
            ) : (
              <PipelineFlow currentStepIndex={pipelineStep} isFailed={Boolean(geminiError)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
