import React from 'react';
import { motion } from 'motion/react';
import {
  MessageSquare,
  Network,
  History,
  Image as ImageIcon,
  PenTool,
  Zap,
  BrainCircuit,
  Sliders,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface PipelineFlowProps {
  currentStepIndex: number;
  isFailed?: boolean;
  className?: string;
}

const PIPELINE_STAGES = [
  { id: '1', label: 'CSV Message Ingestion', icon: MessageSquare, description: 'RFC-4180 multi-line parse from dataset/messages.csv' },
  { id: '2', label: 'Relational Context Builder', icon: Network, description: 'Joins users.csv, daily_notification_summary.csv, groups.csv & business_accounts.csv' },
  { id: '3', label: 'History & Events Retriever', icon: History, description: 'Matches message_history.csv + binary indicators from message_events.csv' },
  { id: '4', label: 'Media & Spoofing Scanner', icon: ImageIcon, description: 'Links images.csv / voice_notes.csv and detects domain spoofing & prompt injection' },
  { id: '5', label: 'Dynamic Few-Shot Prompt', icon: PenTool, description: 'Selects matching labeled examples from sample_messages.csv' },
  { id: '6', label: 'Gemini Pass 1 (Router)', icon: Zap, description: 'Fast structured classification via gemini-4-hydrogen (LOW thinking)' },
  { id: '7', label: 'Gemini Pass 2 (Reflection)', icon: BrainCircuit, description: 'Adversarial & false-positive audit via gemini-4-hydrogen (HIGH thinking)' },
  { id: '8', label: 'Confidence Calibration', icon: Sliders, description: 'Adjusts confidence for domain mismatch, opt-outs & historical evidence' },
  { id: '9', label: 'CSV Output Validation', icon: FileCode2, description: 'Enforces exact 6-column schema & semicolon evidence formatting' },
  { id: '10', label: 'Final Decision Persisted', icon: CheckCircle2, description: 'Updates active decision store and syncs output.csv' },
];

export default function PipelineFlow({
  currentStepIndex,
  isFailed = false,
  className,
}: PipelineFlowProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-[#11141C] border border-white/[0.08] px-5 py-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/15 flex items-center justify-center border border-blue-500/25">
            <Zap className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">10-Stage Execution Architecture</h2>
            <p className="text-xs text-slate-400">End-to-end join, reasoning, reflection & CSV persistence</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
          {isFailed ? (
            <span className="flex items-center gap-1.5 text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" /> Failed
            </span>
          ) : currentStepIndex >= PIPELINE_STAGES.length ? (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Complete ({PIPELINE_STAGES.length}/{PIPELINE_STAGES.length})
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-blue-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Step {Math.min(currentStepIndex + 1, PIPELINE_STAGES.length)}/{PIPELINE_STAGES.length}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PIPELINE_STAGES.map((step, index) => {
          let status: StepStatus = 'pending';
          if (index < currentStepIndex) status = 'completed';
          if (index === currentStepIndex) status = isFailed ? 'failed' : 'active';
          const Icon = step.icon;

          return (
            <motion.div
              key={step.id}
              initial={false}
              animate={{ opacity: status === 'pending' ? 0.55 : 1 }}
              transition={animationConfig.framer.apple}
              className={cn(
                'rounded-xl border p-4 bg-[#11141C] transition-colors flex items-start gap-3.5',
                status === 'active'
                  ? 'border-blue-500/40 bg-blue-500/[0.06]'
                  : status === 'completed'
                    ? 'border-emerald-500/25'
                    : status === 'failed'
                      ? 'border-rose-500/40 bg-rose-500/[0.06]'
                      : 'border-white/[0.06]'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border',
                  status === 'completed'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : status === 'active'
                      ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                      : status === 'failed'
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-500'
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-slate-100 truncate">
                    {step.id}. {step.label}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-mono uppercase shrink-0',
                      status === 'completed'
                        ? 'text-emerald-400'
                        : status === 'active'
                          ? 'text-blue-400'
                          : status === 'failed'
                            ? 'text-rose-400'
                            : 'text-slate-600'
                    )}
                  >
                    {status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
