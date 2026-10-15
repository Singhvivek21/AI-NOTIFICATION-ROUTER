import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquareText, 
  Network, 
  History, 
  ScanEye, 
  Zap, 
  BrainCircuit, 
  SlidersHorizontal, 
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export interface AIThinkingProps {
  isActive: boolean;
  onComplete?: () => void;
  className?: string;
  speedMs?: number;
}

const PIPELINE_STEPS = [
  { id: 'incoming', label: 'Incoming Message', icon: MessageSquareText },
  { id: 'context', label: 'Building Context', icon: Network },
  { id: 'history', label: 'Retrieving History', icon: History },
  { id: 'media', label: 'Analyzing Media', icon: ScanEye },
  { id: 'flash', label: 'Gemini Flash Pass', icon: Zap },
  { id: 'reflection', label: 'Pro Reflection', icon: BrainCircuit },
  { id: 'calibration', label: 'Confidence Calibration', icon: SlidersHorizontal },
  { id: 'decision', label: 'Final Decision', icon: CheckCircle2 },
];

export default function AIThinking({ 
  isActive, 
  onComplete, 
  className,
  speedMs = 800 
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
      // Small delay after the last step before calling onComplete
      const timer = setTimeout(() => {
        onComplete?.();
      }, speedMs / 2);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isActive, speedMs, onComplete]);

  return (
    <div className={cn("glass-panel rounded-2xl p-6 overflow-hidden", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BrainCircuit className={cn("h-5 w-5", isActive ? "text-accent animate-pulse" : "text-secondary")} />
          <h3 className="font-semibold text-primary tracking-tight">AI Pipeline Routing</h3>
        </div>
        {isActive && currentStep < PIPELINE_STEPS.length && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20">
            <Loader2 className="h-3 w-3 text-accent animate-spin" />
            <span className="text-xs font-medium text-accent">Processing</span>
          </div>
        )}
      </div>

      <div className="relative pl-4 border-l-2 border-white/5 space-y-6">
        {/* Animated Progress Line */}
        {isActive && (
          <motion.div
            className="absolute top-0 left-[-2px] w-0.5 bg-gradient-to-b from-accent via-blue-500 to-success origin-top"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: Math.min(currentStep / (PIPELINE_STEPS.length - 1), 1) }}
            transition={{ duration: speedMs / 1000, ease: "linear" }}
            style={{ height: '100%' }}
          />
        )}

        {PIPELINE_STEPS.map((step, index) => {
          const isCompleted = currentStep > index;
          const isCurrent = currentStep === index;
          const isPending = currentStep < index;
          
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative flex items-center gap-4 group">
              {/* Node Indicator */}
              <div className="absolute -left-[25px] flex items-center justify-center">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.2 : 1,
                    backgroundColor: isCompleted 
                      ? "rgba(16, 185, 129, 1)" // success emerald
                      : isCurrent 
                        ? "rgba(139, 92, 246, 1)" // accent violet
                        : "rgba(24, 24, 27, 1)", // surface zinc-900
                    borderColor: isCompleted 
                      ? "rgba(16, 185, 129, 0.5)"
                      : isCurrent 
                        ? "rgba(139, 92, 246, 0.5)"
                        : "rgba(255, 255, 255, 0.1)",
                  }}
                  transition={animationConfig.framer.apple}
                  className={cn(
                    "h-4 w-4 rounded-full border-2 ring-4 ring-[#09090b]",
                    isCurrent && "shadow-[0_0_12px_rgba(139,92,246,0.6)]"
                  )}
                />
              </div>

              {/* Step Content */}
              <motion.div
                initial={false}
                animate={{
                  opacity: isPending ? 0.4 : 1,
                  x: isCurrent ? 4 : 0,
                }}
                transition={animationConfig.framer.apple}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl transition-colors duration-300 w-full",
                  isCurrent ? "bg-white/5 border border-white/10 shadow-sm" : "border border-transparent"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg flex items-center justify-center transition-colors",
                  isCompleted ? "bg-success/20 text-success" 
                  : isCurrent ? "bg-accent/20 text-accent" 
                  : "bg-white/5 text-secondary"
                )}>
                  <Icon className={cn("h-4 w-4", isCurrent && step.id === 'flash' && "animate-pulse")} />
                </div>
                
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  isCompleted ? "text-primary" 
                  : isCurrent ? "text-gradient-ai font-semibold" 
                  : "text-secondary"
                )}>
                  {step.label}
                </span>

                {/* Status Indicator text on right */}
                {isCurrent && (
                  <motion.span 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="ml-auto text-xs text-accent font-mono"
                  >
                    evaluating...
                  </motion.span>
                )}
                {isCompleted && (
                  <span className="ml-auto text-xs text-success font-mono flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> done
                  </span>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
