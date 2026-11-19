import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  MessageSquareText,
  Network,
  History,
  ScanEye,
  Zap,
  BrainCircuit,
  SlidersHorizontal,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export interface AIThinkingProps {
  isActive: boolean;
  onComplete?: () => void;
  className?: string;
  speedMs?: number;
  modeLabel?: string;
}

const PIPELINE_STEPS = [
  { id: 'incoming', label: 'Parse Incoming Message', icon: MessageSquareText },
  { id: 'context', label: 'Join User, Business & Group CSVs', icon: Network },
  { id: 'history', label: 'Match History & Binary Events', icon: History },
  { id: 'media', label: 'Resolve Media & Risk Signals', icon: ScanEye },
  { id: 'flash', label: 'Router Pass 1 (Low Thinking)', icon: Zap },
  { id: 'reflection', label: 'Reflection Audit (High Thinking)', icon: BrainCircuit },
  { id: 'calibration', label: 'Confidence Calibration', icon: SlidersHorizontal },
  { id: 'decision', label: 'Emit Decision & Sync output.csv', icon: CheckCircle2 },
];

export default function AIThinking({
  isActive,
  onComplete,
  className,
  speedMs = 360,
  modeLabel,
}: AIThinkingProps) {
  const [currentStep, setCurrentStep] = useState<number>(-1);

  useEffect(() => {
    if (!isActive) {
      setCurrentStep(-1);
      return;
    }
    setCurrentStep(0);
  }, [isActive]);

  useEffect(() => {
    if (!isActive || currentStep === -1) return;

    if (currentStep < PIPELINE_STEPS.length) {
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, speedMs);
      return () => clearTimeout(timer);
    } else if (currentStep === PIPELINE_STEPS.length) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isActive, speedMs, onComplete]);

  return (
    <div className={cn('bg-[#11141C] border border-white/[0.08] rounded-2xl p-5 overflow-hidden', className)}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <BrainCircuit className={cn('h-4 w-4', isActive ? 'text-blue-400' : 'text-slate-400')} />
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">
            Routing Pipeline Trace
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-400">
          {isActive && currentStep < PIPELINE_STEPS.length ? (
            <>
              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
              <span className="text-blue-400">{modeLabel || 'Running'}</span>
            </>
          ) : (
            <span>{PIPELINE_STEPS.length} stages</span>
          )}
        </div>
      </div>

      <div className="relative pl-4 border-l border-white/[0.08] space-y-2.5">
        {isActive && (
          <motion.div
            className="absolute top-0 left-[-1px] w-0.5 bg-blue-500 origin-top"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: Math.min(Math.max(currentStep, 0) / (PIPELINE_STEPS.length - 1), 1) }}
            transition={{ duration: speedMs / 1000, ease: 'linear' }}
            style={{ height: '100%' }}
          />
        )}

        {PIPELINE_STEPS.map((step, index) => {
          const isCompleted = currentStep > index;
          const isCurrent = currentStep === index;
          const isPending = currentStep < index;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative flex items-center gap-3">
              <div className="absolute -left-[22px] flex items-center justify-center">
                <div
                  className={cn(
                    'h-2.5 w-2.5 rounded-full border transition-colors',
                    isCompleted
                      ? 'bg-emerald-400 border-emerald-400'
                      : isCurrent
                        ? 'bg-blue-400 border-blue-400'
                        : 'bg-[#11141C] border-slate-600'
                  )}
                />
              </div>

              <motion.div
                initial={false}
                animate={{ opacity: isPending ? 0.45 : 1 }}
                transition={animationConfig.framer.apple}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg w-full transition-colors',
                  isCurrent ? 'bg-blue-500/10 border border-blue-500/25' : 'border border-transparent'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isCompleted ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-slate-500'
                  )}
                />

                <span
                  className={cn(
                    'text-xs font-medium',
                    isCompleted ? 'text-slate-100' : isCurrent ? 'text-blue-300' : 'text-slate-400'
                  )}
                >
                  {step.label}
                </span>

                <span className="ml-auto text-[11px] font-mono tabular-nums">
                  {isCurrent && <span className="text-blue-400">running</span>}
                  {isCompleted && <span className="text-emerald-400">ok</span>}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
