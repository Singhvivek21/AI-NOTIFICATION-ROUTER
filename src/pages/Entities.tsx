import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Building2,
  Users,
  User,
  FlaskConical,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  datasetService,
  type EntitiesResponse,
  type SampleMessageDTO,
  type UserEntity,
} from '../services/datasetService';
import { cn } from '../theme';

type EntityTab = 'businesses' | 'users' | 'groups' | 'samples';

export default function Entities() {
  const [tab, setTab] = useState<EntityTab>('businesses');
  const [entities, setEntities] = useState<EntitiesResponse | null>(null);
  const [samples, setSamples] = useState<SampleMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bizSearch, setBizSearch] = useState('');
  const [spoofedOnly, setSpoofedOnly] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserEntity | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([datasetService.getEntities(), datasetService.getSamples()])
      .then(([ent, smp]) => {
        if (!active) return;
        setEntities(ent);
        setSamples(smp.items);
        if (ent.users.length > 0) setSelectedUser(ent.users[0]);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load relational entities.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredBusinesses = useMemo(() => {
    if (!entities) return [];
    const q = bizSearch.toLowerCase().trim();
    return entities.businesses.filter((b) => {
      if (spoofedOnly && !b.domain_mismatch) return false;
      if (q) {
        const hay = `${b.business_id} ${b.display_name} ${b.brand_name} ${b.category} ${b.official_domain} ${b.domain_used_by_sender}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entities, bizSearch, spoofedOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        <span>Loading relational CSV tables...</span>
      </div>
    );
  }

  if (error || !entities) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 text-sm text-rose-200">
        {error || 'Unable to load entities.'}
      </div>
    );
  }

  const spoofedCount = entities.businesses.filter((b) => b.domain_mismatch).length;
  const matchedSamples = samples.filter((s) => s.actionMatched).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">
          Relational Entities & Ground-Truth Benchmarks
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Explore the underlying CSV tables powering domain-spoofing checks, DND fatigue budgets, group authority, and few-shot accuracy.
        </p>
      </div>

      {/* Interactive Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          type="button"
          onClick={() => setTab('businesses')}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer',
            tab === 'businesses'
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Businesses ({entities.businesses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('users')}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer',
            tab === 'users'
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
          )}
        >
          <User className="h-3.5 w-3.5" />
          <span>Users & DND ({entities.users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('groups')}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer',
            tab === 'groups'
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
          )}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Groups ({entities.groups.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('samples')}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer',
            tab === 'samples'
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
          )}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span>Ground-Truth Samples ({samples.length})</span>
        </button>
      </div>

      {/* TAB 1: BUSINESSES */}
      {tab === 'businesses' && (
        <div className="space-y-4">
          <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={bizSearch}
                onChange={(e) => setBizSearch(e.target.value)}
                placeholder="Search business name, brand, category, or domain..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#090B10] border border-white/[0.1] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <button
              type="button"
              onClick={() => setSpoofedOnly((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                spoofedOnly
                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                  : 'bg-[#090B10] border-white/[0.1] text-slate-300 hover:text-white'
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>Spoofed Domains Only ({spoofedCount})</span>
            </button>
          </div>

          <div className="bg-[#11141C] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400">
                    <th className="py-3 px-4 font-semibold">Business</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold">Official Domain</th>
                    <th className="py-3 px-3 font-semibold">Sender Domain</th>
                    <th className="py-3 px-3 font-semibold text-right">Acct / Domain Age</th>
                    <th className="py-3 px-4 font-semibold text-right">30d Reports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredBusinesses.map((b) => (
                    <tr key={b.business_id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{b.display_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {b.business_id} · {b.category}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {b.verified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" /> Unverified
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">{b.official_domain}</td>
                      <td
                        className={cn(
                          'py-3 px-3 font-mono',
                          b.domain_mismatch ? 'text-rose-400 font-semibold' : 'text-emerald-300'
                        )}
                      >
                        {b.domain_used_by_sender}
                        {b.domain_mismatch && (
                          <span className="block text-[10px] text-rose-400/90 font-sans">
                            Lookalike mismatch
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-right text-slate-300 whitespace-nowrap">
                        {b.account_age_days}d / {b.domain_used_by_sender_age_days}d
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 font-mono tabular-nums text-right font-semibold whitespace-nowrap',
                          b.user_reports_30d >= 20 ? 'text-rose-400' : 'text-slate-200'
                        )}
                      >
                        {b.user_reports_30d}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS & 14-DAY DND FATIGUE */}
      {tab === 'users' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-7 bg-[#11141C] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#11141C] z-10">
                  <tr className="border-b border-white/[0.08] text-slate-400">
                    <th className="py-3 px-4 font-semibold">User ID</th>
                    <th className="py-3 px-3 font-semibold">DND Window</th>
                    <th className="py-3 px-3 font-semibold text-right">Opened / Replied</th>
                    <th className="py-3 px-3 font-semibold text-right">Dismissed / Rep.</th>
                    <th className="py-3 px-4 font-semibold text-right">14d Avg Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {entities.users.map((u) => {
                    const active = selectedUser?.user_id === u.user_id;
                    return (
                      <tr
                        key={u.user_id}
                        onClick={() => setSelectedUser(u)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          active ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'
                        )}
                      >
                        <td className="py-2.5 px-4 font-mono text-blue-400 font-medium">
                          {u.user_id}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300">
                          {u.do_not_disturb_window}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-emerald-300">
                          {u.messages_opened_30d} / {u.messages_replied_30d}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-300">
                          {u.notifications_dismissed_30d} / {u.messages_reported_30d}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-200">
                          {u.avg_daily_sent}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selectedUser && (
            <div className="xl:col-span-5 bg-[#11141C] border border-white/[0.08] rounded-xl p-5 space-y-4 sticky top-20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white font-mono">
                    {selectedUser.user_id} · 14-Day Activity
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    DND window <span className="font-mono text-slate-200">{selectedUser.do_not_disturb_window}</span> · avg{' '}
                    <span className="font-mono tabular-nums text-slate-200">{selectedUser.avg_daily_sent}</span> sent /{' '}
                    <span className="font-mono tabular-nums text-rose-300">{selectedUser.avg_daily_dismissed}</span> dismissed
                  </p>
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={selectedUser.daily_trend}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(5)}
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0D1017',
                        borderColor: 'rgba(255,255,255,0.12)',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="notifications_sent" name="Sent" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    <Bar
                      dataKey="notifications_dismissed"
                      name="Dismissed"
                      fill="#EF4444"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GROUPS */}
      {tab === 'groups' && (
        <div className="bg-[#11141C] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400">
                  <th className="py-3 px-4 font-semibold">Group ID</th>
                  <th className="py-3 px-3 font-semibold">Group Name</th>
                  <th className="py-3 px-3 font-semibold">Category</th>
                  <th className="py-3 px-3 font-semibold text-right">Members</th>
                  <th className="py-3 px-3 font-semibold text-right">Admins</th>
                  <th className="py-3 px-4 font-semibold text-right">30d Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entities.groups.map((g) => (
                  <tr key={g.group_id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-blue-400">{g.group_id}</td>
                    <td className="py-3 px-3 font-medium text-slate-100">{g.group_name}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{g.group_type}</td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-slate-200">
                      {g.member_count}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-slate-300">
                      {g.admin_count}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-amber-300 font-semibold">
                      {g.messages_last_30d}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: GROUND-TRUTH SAMPLES */}
      {tab === 'samples' && (
        <div className="space-y-4">
          <div className="bg-[#11141C] border border-white/[0.08] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-300">
              Ground-truth benchmark from <span className="font-mono text-slate-100">sample_messages.csv</span> (used for dynamic few-shot prompting)
            </span>
            <span className="font-mono tabular-nums text-emerald-400 font-semibold">
              {matchedSamples}/{samples.length} action matches (
              {samples.length ? Math.round((matchedSamples / samples.length) * 1000) / 10 : 0}%)
            </span>
          </div>

          <div className="bg-[#11141C] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400">
                    <th className="py-3 px-4 font-semibold">Sample ID</th>
                    <th className="py-3 px-3 font-semibold">Sender & Text</th>
                    <th className="py-3 px-3 font-semibold">Ground Truth</th>
                    <th className="py-3 px-3 font-semibold">Engine Pred.</th>
                    <th className="py-3 px-4 font-semibold">Ground Truth Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {samples.map((s) => (
                    <tr key={s.message_id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono text-blue-400 whitespace-nowrap align-top">
                        {s.message_id}
                      </td>
                      <td className="py-3 px-3 align-top max-w-[260px]">
                        <div className="font-medium text-slate-200 truncate">{s.resolvedSenderName}</div>
                        <p className="text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                          {s.message_text || `[${s.media_type}: ${s.media_id}]`}
                        </p>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap font-mono">
                        <span className="text-slate-100 font-semibold uppercase">{s.action}</span>
                        <span className="block text-[11px] text-slate-500">{s.message_type}</span>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap font-mono">
                        <span
                          className={cn(
                            'font-semibold uppercase',
                            s.actionMatched ? 'text-emerald-400' : 'text-amber-400'
                          )}
                        >
                          {s.predictedAction}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {s.actionMatched ? 'Match' : 'Diff'}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top text-slate-400 leading-relaxed max-w-[320px]">
                        {s.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
