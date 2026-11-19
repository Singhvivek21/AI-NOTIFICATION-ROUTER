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
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export type RoutingAction = 'notify' | 'digest' | 'mute';

export interface DecisionCardProps {
  action: RoutingAction;
  messageType?: string;
  reason: string;
  confidence: number;
  evidenceIds: string[];
  trustScore: number;
  spamProbability: number;
  urgency: number;
  reflectionResult: string;
  source?: 'context-engine' | 'gemini-live';
  modelUsed?: string;
  riskFlags?: string[];
  className?: string;
}

const getActionConfig = (action: RoutingAction) => {
  switch (action) {
    case 'notify':
      return {
        label: 'NOTIFY',
        subtitle: 'Immediate push alert',
        icon: BellRing,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/25',
        barColor: 'bg-emerald-400',
      };
    case 'digest':
      return {
        label: 'DIGEST',
        subtitle: 'Queued for batch summary',
        icon: ArchiveRestore,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/25',
        barColor: 'bg-amber-400',
      };
    case 'mute':
      return {
        label: 'MUTE',
        subtitle: 'Silenced & suppressed',
        icon: BellOff,
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/25',
        barColor: 'bg-rose-400',
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
        <div className="flex items-center gap-1.5 text-slate-400">
          <Icon className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wider text-[11px]">{label}</span>
        </div>
        <span className="text-slate-100 font-mono tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className={cn('h-full rounded-full', colorClass)}
        />
      </div>
    </div>
  );
}

export default function DecisionCard({
  action,
  messageType,
  reason,
  confidence,
  evidenceIds,
  trustScore,
  spamProbability,
  urgency,
  reflectionResult,
  source = 'context-engine',
  modelUsed,
  riskFlags = [],
  className,
}: DecisionCardProps) {
  const config = getActionConfig(action);
  const ActionIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={animationConfig.framer.apple}
      className={cn(
        'bg-[#11141C] border rounded-2xl p-6 relative overflow-hidden transition-colors',
        config.border,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={cn('p-3 rounded-xl border shrink-0', config.bg, config.border)}>
            <ActionIcon className={cn('h-5 w-5', config.color)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5 flex-wrap">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Routing Decision</span>
              {messageType && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="font-mono text-slate-300">{messageType}</span>
                </>
              )}
              <span className="text-slate-600">·</span>
              <span className={source === 'gemini-live' ? 'text-blue-400 font-medium' : 'text-slate-400'}>
                {source === 'gemini-live' ? `Live Gemini (${modelUsed || 'gemini-4-hydrogen'})` : 'Context Engine'}
              </span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className={cn('text-2xl font-bold tracking-tight', config.color)}>
                {config.label}
              </span>
              <span className="text-xs text-slate-400">{config.subtitle}</span>
            </div>
          </div>
        </div>

        {/* Confidence Readout */}
        <div className="flex flex-col items-end shrink-0">
          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-0.5">
            Confidence
          </span>
          <div className="flex items-baseline gap-0.5 font-mono tabular-nums">
            <span className="text-3xl font-bold text-slate-50 tracking-tight">
              {confidence}
            </span>
            <span className="text-sm font-medium text-slate-400">%</span>
          </div>
        </div>
      </div>

      {/* Risk Flags Inline Strip */}
      {riskFlags.length > 0 && (
        <div className="mt-4 flex items-start gap-2.5 text-xs text-rose-300 bg-rose-500/[0.06] border border-rose-500/20 rounded-lg px-3.5 py-2.5">
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-rose-200 mr-1.5">Risk signals:</span>
            {riskFlags.join(' · ')}
          </div>
        </div>
      )}

      {/* Reasoning Section */}
      <div className="space-y-4 my-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            Primary Reason
          </div>
          <p className="text-sm text-slate-300 leading-relaxed pl-5.5">
            {reason}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <BrainCircuit className="h-3.5 w-3.5 text-blue-400" />
            Reflection Verdict
          </div>
          <p className="text-sm text-slate-400 leading-relaxed pl-5.5">
            {reflectionResult}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 py-4 border-y border-white/[0.08]">
        <MetricBar label="Trust Score" value={trustScore} icon={ShieldCheck} colorClass="bg-emerald-400" />
        <MetricBar label="Urgency" value={urgency} icon={Activity} colorClass="bg-amber-400" />
        <MetricBar label="Spam Risk" value={spamProbability} icon={AlertOctagon} colorClass="bg-rose-400" />
      </div>

      {/* Footer: Evidence IDs */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-slate-400 uppercase tracking-wider text-[11px]">
          <Fingerprint className="h-3.5 w-3.5" />
          Historical Evidence:
        </span>
        {evidenceIds.length > 0 ? (
          <span className="font-mono text-slate-200">
            {evidenceIds.join(' · ')}
          </span>
        ) : (
          <span className="font-mono text-slate-500">none (first interaction)</span>
        )}
      </div>
    </motion.div>
  );
}
