import React from 'react';
import {
  User,
  Building2,
  Users,
  History,
  Image as ImageIcon,
  Mic,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { FullMessageContextDTO } from '../../services/datasetService';
import { cn } from '../../theme';

interface ContextInspectorProps {
  context: FullMessageContextDTO;
  className?: string;
}

export default function ContextInspector({ context, className }: ContextInspectorProps) {
  const { message, user, business, group, media, history, features } = context;

  return (
    <div className={cn('space-y-5', className)}>
      {/* Message Envelope & Derived Signals */}
      <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Message Payload · <span className="font-mono text-blue-400">{message.message_id}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
              {message.created_at} · {message.conversation_type} · recipient {message.user_id}
              {message.forwarded_count > 0 ? ` · forwarded ${message.forwarded_count}x` : ''}
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            Priority <span className="text-slate-100 font-semibold">{features.notificationPriority}%</span>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
          {message.message_text || `[No text body — ${media.media_type} attachment ${media.media_id}]`}
        </p>

        {media.has_media && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-xs text-blue-300">
            {media.media_type === 'voice' ? (
              <Mic className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="font-mono">
              {media.media_id} {media.file_path ? `→ ${media.file_path}` : ''}
            </span>
          </div>
        )}

        {features.riskFlags.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-start gap-2 text-xs text-rose-300">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{features.riskFlags.join(' · ')}</span>
          </div>
        )}
      </div>

      {/* Two-Column Relational Join Cards: User Profile + Business/Group Context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User Profile & Daily Summary */}
        <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <User className="h-3.5 w-3.5 text-blue-400" />
              Recipient · <span className="font-mono text-slate-100">{user.user_id}</span>
            </div>
            <span
              className={cn(
                'text-xs font-mono tabular-nums',
                user.in_quiet_hours ? 'text-amber-400' : 'text-slate-400'
              )}
            >
              DND {user.do_not_disturb_window}
              {user.in_quiet_hours ? ' (Active)' : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <span className="text-slate-500 block">Opened / Replied (30d)</span>
              <span className="text-slate-100 font-mono tabular-nums font-medium">
                {user.messages_opened_30d} / {user.messages_replied_30d}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Dismissed / Reported (30d)</span>
              <span className="text-slate-100 font-mono tabular-nums font-medium">
                {user.notifications_dismissed_30d} / {user.messages_reported_30d}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Daily Load (14d avg)</span>
              <span className="text-slate-100 font-mono tabular-nums font-medium">
                {user.avg_daily_sent} sent · {user.avg_daily_dismissed} dismissed
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Notification Fatigue</span>
              <span className="text-slate-100 font-mono tabular-nums font-medium">
                {Math.round(user.fatigue_score * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Business Account OR Group Context OR Personal Context */}
        {business ? (
          <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-0">
                <Building2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{business.display_name}</span>
              </div>
              <span
                className={cn(
                  'text-xs font-medium shrink-0 flex items-center gap-1',
                  business.verified ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {business.verified ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" /> Unverified
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-500 block">Official Domain</span>
                <span className="text-slate-200 font-mono break-all">
                  {business.official_domain || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Sender Domain</span>
                <span
                  className={cn(
                    'font-mono break-all font-medium',
                    business.domain_mismatch ? 'text-rose-400' : 'text-emerald-300'
                  )}
                >
                  {business.domain_used_by_sender || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Account / Domain Age</span>
                <span className="text-slate-100 font-mono tabular-nums">
                  {business.account_age_days}d / {business.domain_used_by_sender_age_days}d
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">30d User Reports</span>
                <span
                  className={cn(
                    'font-mono tabular-nums font-medium',
                    business.user_reports_30d >= 20 ? 'text-rose-400' : 'text-slate-100'
                  )}
                >
                  {business.user_reports_30d}
                </span>
              </div>
            </div>

            {business.user_history && (
              <div className="pt-2 border-t border-white/[0.06] text-xs text-slate-400">
                Relationship:{' '}
                <span className="text-slate-200">{business.user_history.why_user_knows_account}</span>
                {' · '}
                Promos:{' '}
                <span className={business.has_opted_out ? 'text-rose-400 font-medium' : 'text-slate-200'}>
                  {business.has_opted_out
                    ? `Opted out (${business.user_history.promotions_opted_out_at || 'yes'})`
                    : business.user_history.allows_promotions
                      ? 'Allowed'
                      : 'Not opted-in'}
                </span>
              </div>
            )}
          </div>
        ) : group ? (
          <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-0">
                <Users className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{group.group_name}</span>
              </div>
              <span className="text-xs font-mono text-slate-400 shrink-0">{group.group_type}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-500 block">Sender Role</span>
                <span className={cn('font-medium', group.sender_is_admin ? 'text-emerald-400' : 'text-slate-200')}>
                  {group.sender_membership?.role || 'member'} ({message.sender_user_id})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Members / 30d Volume</span>
                <span className="text-slate-100 font-mono tabular-nums">
                  {group.member_count} members · {group.messages_last_30d} msgs
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Muted by User</span>
                <span className={group.group_muted_by_user ? 'text-amber-400 font-medium' : 'text-slate-200'}>
                  {group.group_muted_by_user ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">User Read / Reply (30d)</span>
                <span className="text-slate-100 font-mono tabular-nums">
                  {group.user_membership?.messages_read_30d ?? 0} / {group.user_membership?.replies_sent_30d ?? 0}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <User className="h-3.5 w-3.5 text-blue-400" />
              Direct Personal Thread
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Direct 1:1 message from <span className="font-mono text-slate-200">{message.sender_user_id}</span>.
              Trust and priority are anchored in matched prior interactions and binary event reactions below.
            </p>
          </div>
        )}
      </div>

      {/* Matched Historical Evidence (message_history.csv + message_events.csv) */}
      <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <History className="h-3.5 w-3.5 text-blue-400" />
            Matched History & Events ({history.matches.length})
          </div>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            Opened {history.engagement.opened} · Replied {history.engagement.replied} · Dismissed{' '}
            {history.engagement.dismissed} · Muted {history.engagement.muted} · Reported{' '}
            {history.engagement.reported}
          </span>
        </div>

        {history.matches.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            No prior matching messages found for this sender/thread in message_history.csv.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {history.matches.map((match) => {
              const flags: string[] = [];
              if (match.event?.message_opened) flags.push('Opened');
              if (match.event?.message_replied) flags.push('Replied');
              if (match.event?.notification_dismissed) flags.push('Dismissed');
              if (match.event?.muted_after_message) flags.push('Muted');
              if (match.event?.message_reported) flags.push('Reported');

              return (
                <div key={match.message_id} className="py-3 first:pt-1 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                    <div className="flex items-center gap-2 font-mono text-slate-300">
                      <span className="text-blue-400 font-semibold">{match.message_id}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">{match.created_at}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {match.event?.reaction_time_minutes != null && (
                        <span className="text-slate-400 font-mono tabular-nums flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {match.event.reaction_time_minutes}m
                        </span>
                      )}
                      <span
                        className={cn(
                          'font-medium',
                          match.event?.message_reported || match.event?.muted_after_message
                            ? 'text-rose-400'
                            : match.event?.message_replied
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                        )}
                      >
                        {flags.length > 0 ? flags.join(' · ') : 'No reaction recorded'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {match.message_text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
