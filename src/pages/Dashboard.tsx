import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Mail,
  ShieldAlert,
  Target,
  Database,
  ArrowRight,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { datasetService, type DatasetOverview } from '../services/datasetService';
import { cn } from '../theme';

const FEATURED_CASES = [
  {
    id: 'msg_026',
    title: 'Domain Spoofing',
    detail: 'Amazon Delivery Support sending from amazonpay-delivery.in instead of amazon.in',
    severity: 'rose',
  },
  {
    id: 'msg_107',
    title: 'Prompt Injection + OTP Scam',
    detail: 'Attempts router override ("Ignore all previous...") while requesting 6-digit OTP',
    severity: 'rose',
  },
  {
    id: 'msg_080',
    title: 'Hinglish Urgent Alert',
    detail: 'Time-sensitive gate closure ("10 mins me gate band hone wala hai")',
    severity: 'emerald',
  },
  {
    id: 'msg_028',
    title: 'Opted-Out Promotion',
    detail: 'Verified brand promo blocked due to recorded user opt-out timestamp',
    severity: 'amber',
  },
];

export default function Dashboard() {
  const [overview, setOverview] = useState<DatasetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    datasetService
      .getOverview()
      .then((data) => {
        if (active) {
          setOverview(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load dataset overview.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-[#11141C] border border-white/[0.06]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 h-72 rounded-xl bg-[#11141C] border border-white/[0.06]" />
          <div className="lg:col-span-4 h-72 rounded-xl bg-[#11141C] border border-white/[0.06]" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 text-sm text-rose-200 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
        <span>{error || 'Could not load dataset metrics.'}</span>
      </div>
    );
  }

  const totalRelationalRows = overview.files.reduce((sum, f) => sum + f.rows, 0);
  const totalIncoming = overview.counts.incomingMessages || 1;
  const actionBreakdown = [
    {
      key: 'notify',
      label: 'Notify (Immediate)',
      count: overview.actionCounts.notify,
      pct: Math.round((overview.actionCounts.notify / totalIncoming) * 100),
      barClass: 'bg-emerald-400',
      textClass: 'text-emerald-400',
    },
    {
      key: 'digest',
      label: 'Digest (Batched)',
      count: overview.actionCounts.digest,
      pct: Math.round((overview.actionCounts.digest / totalIncoming) * 100),
      barClass: 'bg-amber-400',
      textClass: 'text-amber-400',
    },
    {
      key: 'mute',
      label: 'Mute (Suppressed)',
      count: overview.actionCounts.mute,
      pct: Math.round((overview.actionCounts.mute / totalIncoming) * 100),
      barClass: 'bg-rose-400',
      textClass: 'text-rose-400',
    },
  ];

  const sortedTypes = (Object.entries(overview.typeCounts) as Array<[string, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Dataset Routing Overview
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Live relational evaluation across all 13 input CSV files ({overview.counts.incomingMessages} incoming messages,{' '}
            {overview.counts.users} users, {overview.counts.businessAccounts} business accounts).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/simulator"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#11141C] hover:bg-[#181C27] border border-white/[0.1] text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Open Interactive Simulator</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Incoming Messages</span>
            <Mail className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono tabular-nums">
            {overview.counts.incomingMessages}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            {overview.channelCounts.personal} personal · {overview.channelCounts.group} group ·{' '}
            {overview.channelCounts.business} business
          </p>
        </div>

        <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Sample Benchmark Accuracy</span>
            <Target className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400 font-mono tabular-nums">
            {overview.benchmark.actionAccuracy}%
          </div>
          <p className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            {overview.benchmark.totalSamples} labeled rows · {overview.avgConfidence}% avg confidence
          </p>
        </div>

        <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Threats & Mutes Caught</span>
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-3xl font-bold text-rose-400 font-mono tabular-nums">
            {overview.actionCounts.mute}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            {overview.counts.domainSpoofs} domain spoofs · {overview.counts.promptInjections} prompt injections
          </p>
        </div>

        <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Relational Records Joined</span>
            <Database className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono tabular-nums">
            {totalRelationalRows.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            {overview.files.length} CSV tables · {overview.counts.withMedia} media messages
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 14-Day Notification Load vs Dismissals */}
        <div className="lg:col-span-8 bg-[#11141C] border border-white/[0.08] rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">
                14-Day Notification Fatigue Trend
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregated daily sent vs dismissed volume across {overview.counts.users} users (daily_notification_summary.csv)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Sent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Dismissed
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.dailyTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="dismissGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val: string) => val.slice(5)}
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
                <Area
                  type="monotone"
                  dataKey="sent"
                  name="Notifications Sent"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#sentGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="dismissed"
                  name="Dismissed"
                  stroke="#EF4444"
                  strokeWidth={2}
                  fill="url(#dismissGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Split + Message Type Breakdown */}
        <div className="lg:col-span-4 bg-[#11141C] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Action Distribution</h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-5">
              Current output.csv decisions across all {overview.counts.incomingMessages} messages
            </p>

            <div className="space-y-4">
              {actionBreakdown.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium">{item.label}</span>
                    <span className={cn('font-mono tabular-nums font-semibold', item.textClass)}>
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', item.barClass)}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-white/[0.08]">
            <div className="text-xs font-semibold text-slate-300 mb-2.5">Top Classified Types</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {sortedTypes.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="font-mono text-slate-400 truncate">{type}</span>
                  <span className="font-mono tabular-nums text-slate-100 font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* High-Signal Test Cases Quick Jump */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Key Edge Cases in Uploaded Dataset</h3>
          <Link to="/messages" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
            Inspect all {overview.counts.incomingMessages} messages →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {FEATURED_CASES.map((item) => (
            <Link
              key={item.id}
              to={`/simulator?id=${item.id}`}
              className="group bg-[#11141C] hover:bg-[#181C27] border border-white/[0.08] hover:border-blue-500/40 rounded-xl p-4 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono text-blue-400 font-semibold">{item.id}</span>
                  <span
                    className={cn(
                      'font-medium',
                      item.severity === 'rose'
                        ? 'text-rose-400'
                        : item.severity === 'emerald'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                    )}
                  >
                    {item.title}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.detail}</p>
              </div>
              <div className="mt-3 text-xs text-slate-300 group-hover:text-blue-300 font-medium flex items-center gap-1">
                <span>Run in Simulator</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 13-File Dataset Schema Inventory */}
      <div className="bg-[#11141C] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Loaded Input CSV Schemas</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            {overview.files.length} files synced in /dataset
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400 bg-white/[0.02]">
                <th className="py-2.5 px-5 font-semibold">CSV File</th>
                <th className="py-2.5 px-4 font-semibold text-right">Rows</th>
                <th className="py-2.5 px-5 font-semibold">Mapped Schema Columns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {overview.files.map((f) => (
                <tr key={f.file} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-5 font-mono text-slate-200 whitespace-nowrap">{f.file}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-right text-blue-300 whitespace-nowrap">
                    {f.rows.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-5 font-mono text-slate-400">
                    {f.columns.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
