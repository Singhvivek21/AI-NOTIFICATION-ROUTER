import React from 'react';
import { motion } from 'motion/react';
import { 
  BellRing, 
  ArchiveRestore, 
  BellOff, 
  BrainCircuit, 
  ShieldCheck, 
  Fingerprint,
  Activity,
  AlertOctagon,
  Zap
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export type RoutingAction = 'notify' | 'digest' | 'mute';

export interface DecisionCardProps {
  action: RoutingAction;
  reason: string;
  confidence: number;
  evidenceIds: string[];
  trustScore: number;
  spamProbability: number;
  urgency: number;
  reflectionResult: string;
  className?: string;
}

const getActionConfig = (action: RoutingAction) => {
  switch (action) {
    case 'notify':
      return {
        label: 'NOTIFY',
        icon: BellRing,
        color: 'text-success',
        bg: 'bg-success/10',
        border: 'border-success/30',
        glow: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]',
        barColor: 'bg-success'
      };
    case 'digest':
      return {
        label: 'DIGEST',
        icon: ArchiveRestore,
        color: 'text-warning',
        bg: 'bg-warning/10',
        border: 'border-warning/30',
        glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]',
        barColor: 'bg-warning'
      };
    case 'mute':
      return {
        label: 'MUTE',
        icon: BellOff,
        color: 'text-error',
        bg: 'bg-error/10',
        border: 'border-error/30',
        glow: 'shadow-[0_0_30px_rgba(239,68,68,0.15)]',
        barColor: 'bg-error'
      };
  }
};

interface MetricBarProps {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
}

function MetricBar({ label, value, icon: Icon, colorClass }: MetricBarProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-1.5 text-secondary">
          <Icon className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-primary">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: [0.175, 0.885, 0.32, 1.275], delay: 0.2 }}
          className={cn("h-full rounded-full", colorClass)}
        />
      </div>
    </div>
  );
}

export default function DecisionCard({
  action,
  reason,
  confidence,
  evidenceIds,
  trustScore,
  spamProbability,
  urgency,
  reflectionResult,
  className
}: DecisionCardProps) {
  const config = getActionConfig(action);
  const ActionIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={animationConfig.framer.apple}
      className={cn(
        "glass-panel rounded-3xl p-6 relative overflow-hidden transition-all duration-500",
        config.border,
        config.glow,
        className
      )}
    >
      {/* Background Ambient Glow */}
      <div className={cn(
        "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-30 pointer-events-none",
        config.bg
      )} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn("p-3 rounded-xl border", config.bg, config.border)}>
            <ActionIcon className={cn("h-6 w-6", config.color)} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold tracking-widest text-secondary uppercase mb-1">
              Final Routing Decision
            </h4>
            <span className={cn("text-2xl font-bold tracking-tight", config.color)}>
              {config.label}
            </span>
          </div>
        </div>
        
        {/* Confidence Gauge */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold tracking-widest text-secondary uppercase mb-1">
            Confidence
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-primary tracking-tighter">
              {confidence}
            </span>
            <span className="text-sm font-medium text-secondary">%</span>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-white/10 mb-6 relative z-10" />

      {/* Reasoning Section */}
      <div className="space-y-5 mb-8 relative z-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Zap className="h-4 w-4 text-accent" />
            Primary Reason
          </div>
          <p className="text-sm text-secondary leading-relaxed pl-6">
            {reason}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <BrainCircuit className="h-4 w-4 text-accent" />
            Pro Reflection Result
          </div>
          <p className="text-sm text-secondary leading-relaxed pl-6 border-l-2 border-white/5">
            {reflectionResult}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10 p-4 rounded-2xl bg-black/20 border border-white/5">
        <MetricBar 
          label="Trust Score" 
          value={trustScore} 
          icon={ShieldCheck} 
          colorClass="bg-success" 
        />
        <MetricBar 
          label="Urgency" 
          value={urgency} 
          icon={Activity} 
          colorClass="bg-warning" 
        />
        <MetricBar 
          label="Spam Prob" 
          value={spamProbability} 
          icon={AlertOctagon} 
          colorClass="bg-error" 
        />
      </div>

      {/* Footer: Evidence IDs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 relative z-10">
        <div className="flex items-center gap-1.5 text-xs font-medium text-secondary uppercase tracking-wider shrink-0">
          <Fingerprint className="h-3.5 w-3.5" />
          Evidence Context
        </div>
        <div className="flex flex-wrap gap-2">
          {evidenceIds.map((id) => (
            <span 
              key={id} 
              className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-zinc-400 shadow-sm"
            >
              {id}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
