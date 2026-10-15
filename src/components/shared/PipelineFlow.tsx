import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Clock
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface PipelineStep {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  status: StepStatus;
  executionTime?: string;
}

export interface PipelineFlowProps {
  currentStepIndex: number;
  isFailed?: boolean;
  className?: string;
}

const DEFAULT_STEPS = [
  { id: '1', label: 'Incoming Message', icon: MessageSquare, description: 'Intercepted payload from webhook' },
  { id: '2', label: 'Context Builder', icon: Network, description: 'Assembled user profile & preferences' },
  { id: '3', label: 'History Retriever', icon: History, description: 'Fetched last 50 interactions' },
  { id: '4', label: 'Media Processor', icon: ImageIcon, description: 'Scanned attachments for visual context' },
  { id: '5', label: 'Prompt Builder', icon: PenTool, description: 'Constructed LLM instructions' },
  { id: '6', label: 'Gemini Flash', icon: Zap, description: 'Initial fast classification pass' },
  { id: '7', label: 'Reflection Agent', icon: BrainCircuit, description: 'Pro-level deep reasoning' },
  { id: '8', label: 'Confidence Calibration', icon: Sliders, description: 'Threshold verification & scoring' },
  { id: '9', label: 'Output Generator', icon: FileCode2, description: 'Formatting structured JSON response' },
  { id: '10', label: 'Final Decision', icon: CheckCircle2, description: 'Routed to destination' },
];

export default function PipelineFlow({ 
  currentStepIndex, 
  isFailed = false,
  className 
}: PipelineFlowProps) {
  
  // Local state to manage mock execution times for completed steps
  const [executionTimes, setExecutionTimes] = useState<Record<number, string>>({});

  useEffect(() => {
    if (currentStepIndex > 0 && !executionTimes[currentStepIndex - 1]) {
      // Assign a random execution time to the just-completed step
      const randomTime = Math.floor(Math.random() * 150) + 15;
      setExecutionTimes(prev => ({ ...prev, [currentStepIndex - 1]: `${randomTime}ms` }));
    }
  }, [currentStepIndex, executionTimes]);

  const steps = DEFAULT_STEPS.map((step, index) => {
    let status: StepStatus = 'pending';
    if (index < currentStepIndex) status = 'completed';
    if (index === currentStepIndex) status = isFailed ? 'failed' : 'active';
    
    return {
      ...step,
      status,
      executionTime: executionTimes[index] || (status === 'active' ? 'calculating...' : undefined)
    };
  });

  return (
    <div className={cn("w-full max-w-4xl mx-auto p-4 sm:p-6", className)}>
      <div className="mb-8 flex items-center justify-between glass-panel px-6 py-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center border border-accent/30 shadow-glow-accent">
            <Zap className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary tracking-tight">Execution Pipeline</h2>
            <p className="text-sm text-secondary">Real-time telemetry and routing breakdown</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          {isFailed ? (
            <>
              <AlertCircle className="h-4 w-4 text-error" />
              <span className="text-sm font-medium text-error">Pipeline Failed</span>
            </>
          ) : currentStepIndex >= steps.length ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">Pipeline Complete</span>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 text-accent animate-spin" />
              <span className="text-sm font-medium text-accent">Running (Step {currentStepIndex + 1}/{steps.length})</span>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        {/* Continuous Background Line */}
        <div className="absolute left-[27px] sm:left-[35px] top-4 bottom-4 w-px bg-white/10 z-0" />
        
        {/* Active Animated Progress Line */}
        <motion.div 
          className="absolute left-[27px] sm:left-[35px] top-4 w-px bg-gradient-to-b from-accent to-blue-500 z-0 origin-top shadow-[0_0_10px_rgba(59,130,246,0.5)]"
          initial={{ height: 0 }}
          animate={{ height: `${Math.min((currentStepIndex / (steps.length - 1)) * 100, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />

        <div className="space-y-6 sm:space-y-8 relative z-10">
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            const isFailedStep = step.status === 'failed';
            const isPending = step.status === 'pending';
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex gap-4 sm:gap-6 group">
                
                {/* Timeline Node */}
                <div className="relative mt-2 shrink-0">
                  <motion.div 
                    initial={false}
                    animate={{
                      scale: isActive ? [1.1, 1.25, 1.1] : 1,
                      backgroundColor: isCompleted ? '#10b981' : isFailedStep ? '#ef4444' : isActive ? '#3b82f6' : '#18181b',
                      borderColor: isCompleted ? '#34d399' : isFailedStep ? '#f87171' : isActive ? '#60a5fa' : '#27272a',
                      boxShadow: isActive 
                        ? ["0 0 10px rgba(59,130,246,0.3)", "0 0 30px rgba(59,130,246,0.8)", "0 0 10px rgba(59,130,246,0.3)"]
                        : isCompleted 
                        ? "0 0 15px rgba(16,185,129,0.3)" 
                        : isFailedStep
                        ? "0 0 20px rgba(239,68,68,0.5)"
                        : "0 0 0px rgba(0,0,0,0)"
                    }}
                    transition={
                      isActive 
                        ? { 
                            scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
                            boxShadow: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
                            backgroundColor: { duration: 0.3 },
                            borderColor: { duration: 0.3 }
                          }
                        : animationConfig.framer.apple
                    }
                    className={cn(
                      "w-14 h-14 sm:w-18 sm:h-18 rounded-full border-4 ring-4 ring-background flex items-center justify-center transition-shadow duration-300"
                    )}
                  >
                    <Icon className={cn(
                      "h-6 w-6 sm:h-8 sm:w-8 transition-colors duration-300",
                      (isCompleted || isActive || isFailedStep) ? "text-white" : "text-zinc-600"
                    )} />
                  </motion.div>
                </div>

                {/* Content Card */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: isPending ? 0.4 : 1, x: 0 }}
                  transition={{ ...animationConfig.framer.apple, delay: index * 0.05 }}
                  className={cn(
                    "flex-1 rounded-2xl border p-4 sm:p-5 transition-all duration-300 relative overflow-hidden glass-panel",
                    isActive ? "border-blue-500/50 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.1)]" : "border-white/5",
                    isCompleted && "border-success/20 bg-success/5",
                    isFailedStep && "border-error/50 bg-error/10 shadow-[0_0_30px_rgba(239,68,68,0.15)]",
                    isPending && "bg-black/20"
                  )}
                >
                  {/* Subtle hover gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 relative z-10">
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className={cn(
                          "text-base sm:text-lg font-semibold tracking-tight transition-colors",
                          isActive ? "text-blue-400" : isCompleted ? "text-primary" : isFailedStep ? "text-error" : "text-secondary"
                        )}>
                          {step.label}
                        </h3>
                        
                        {/* Status Badges */}
                        <AnimatePresence mode="popLayout">
                          {isActive && (
                            <motion.span 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 border border-blue-400/20 flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                              Processing
                            </motion.span>
                          )}
                          {isCompleted && (
                            <motion.span 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 border border-success/20"
                            >
                              Success
                            </motion.span>
                          )}
                          {isFailedStep && (
                            <motion.span 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-error bg-error/10 border border-error/20"
                            >
                              Failed
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className="text-sm text-secondary/80 leading-relaxed">
                        {step.description}
                      </p>
                    </div>

                    {/* Execution Time */}
                    {(isCompleted || isActive || isFailedStep) && step.executionTime && (
                      <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 bg-black/40 px-2.5 py-1 rounded-md border border-white/5 shrink-0 w-fit">
                        <Clock className="h-3 w-3" />
                        {step.executionTime}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
