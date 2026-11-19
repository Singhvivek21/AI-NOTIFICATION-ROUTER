import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Sparkles,
  ExternalLink,
  X,
  Loader2,
  AlertCircle,
  Download,
  ShieldAlert,
  Mic,
  Image as ImageIcon,
} from 'lucide-react';
import { datasetService, type FullMessageContextDTO } from '../services/datasetService';
import type { ScenarioData } from '../services/simulationService';
import type { RoutingDecision } from '../services/notificationService';
import DecisionCard from '../components/shared/DecisionCard';
import ContextInspector from '../components/shared/ContextInspector';
import { cn } from '../theme';

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [channel, setChannel] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [items, setItems] = useState<ScenarioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected message drawer state
  const [selectedMsg, setSelectedMsg] = useState<ScenarioData | null>(null);
  const [selectedContext, setSelectedContext] = useState<FullMessageContextDTO | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<RoutingDecision | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [geminiRunning, setGeminiRunning] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== search) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    datasetService
      .getMessages({ search, channel, action: actionFilter })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load messages.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, channel, actionFilter]);

  const openInspector = (row: ScenarioData) => {
    setSelectedMsg(row);
    setSelectedDecision(row.decision);
    setSelectedContext(null);
    setGeminiError(null);
    setDrawerLoading(true);

    datasetService
      .getMessageContext(row.id)
      .then((res) => {
        setSelectedContext(res.context);
        setSelectedDecision(res.decision);
        setDrawerLoading(false);
      })
      .catch(() => {
        setDrawerLoading(false);
      });
  };

  const handleRerouteGemini = async () => {
    if (!selectedMsg || geminiRunning) return;
    setGeminiRunning(true);
    setGeminiError(null);
    try {
      const res = await datasetService.routeWithGemini(selectedMsg.id);
      setSelectedDecision(res.decision);
      setSelectedContext(res.context);
      setItems((prev) =>
        prev.map((m) => (m.id === selectedMsg.id ? { ...m, decision: res.decision } : m))
      );
    } catch (err: unknown) {
      const serverMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Gemini routing failed.');
      setGeminiError(serverMsg);
    } finally {
      setGeminiRunning(false);
    }
  };

  const actionColor = (action: string) => {
    if (action === 'notify') return 'text-emerald-400';
    if (action === 'digest') return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Messages & output.csv Queue
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            All incoming messages from <span className="font-mono text-slate-300">messages.csv</span> joined with routing decisions and historical evidence IDs.
          </p>
        </div>
        <a
          href={datasetService.getOutputDownloadUrl()}
          download="output.csv"
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#11141C] hover:bg-[#181C27] border border-white/[0.1] text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-blue-400" />
          <span>Download Validated output.csv</span>
        </a>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
            }}
            placeholder="Filter by message ID, sender, text, type, or reason..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#090B10] border border-white/[0.1] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            aria-label="Filter by channel"
            className="h-9 px-3 rounded-lg bg-[#090B10] border border-white/[0.1] text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Channels</option>
            <option value="personal">Personal</option>
            <option value="group">Group</option>
            <option value="business">Business</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filter by action"
            className="h-9 px-3 rounded-lg bg-[#090B10] border border-white/[0.1] text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Actions</option>
            <option value="notify">Notify</option>
            <option value="digest">Digest</option>
            <option value="mute">Mute</option>
          </select>

          <span className="text-xs font-mono tabular-nums text-slate-400 px-2">
            {items.length} shown
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split: Data Table + Optional Context Side Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div
          className={cn(
            'bg-[#11141C] border border-white/[0.08] rounded-xl overflow-hidden',
            selectedMsg ? 'xl:col-span-7' : 'xl:col-span-12'
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400">
                  <th className="py-3 px-4 font-semibold">ID</th>
                  <th className="py-3 px-3 font-semibold">Sender & Channel</th>
                  <th className="py-3 px-3 font-semibold">Message</th>
                  <th className="py-3 px-3 font-semibold">Action</th>
                  <th className="py-3 px-3 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold text-right">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Loading messages...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No messages match the current filters.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const isSelected = selectedMsg?.id === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => openInspector(row)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'
                        )}
                      >
                        <td className="py-3 px-4 font-mono text-blue-400 whitespace-nowrap align-top">
                          <div>{row.id}</div>
                          <div className="text-[10px] text-slate-500">{row.userId}</div>
                        </td>
                        <td className="py-3 px-3 align-top max-w-[180px]">
                          <div className="font-medium text-slate-200 truncate">{row.sender}</div>
                          <div className="text-[11px] text-slate-500 capitalize flex items-center gap-1.5 mt-0.5">
                            <span>{row.type}</span>
                            {row.mediaType === 'voice' && <Mic className="h-3 w-3 text-blue-400" />}
                            {row.mediaType === 'image' && <ImageIcon className="h-3 w-3 text-blue-400" />}
                            {row.riskFlags.length > 0 && (
                              <ShieldAlert className="h-3 w-3 text-rose-400" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top max-w-[340px]">
                          <p className="text-slate-300 line-clamp-2 leading-relaxed">
                            {row.description}
                          </p>
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <span className={cn('font-mono font-bold uppercase', actionColor(row.decision.action))}>
                            {row.decision.action}
                          </span>
                          {row.decision.source === 'gemini-live' && (
                            <span className="block text-[10px] text-blue-400 mt-0.5">live gemini</span>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top font-mono text-slate-400 whitespace-nowrap">
                          {row.decision.messageType}
                        </td>
                        <td className="py-3 px-4 align-top font-mono tabular-nums text-right text-slate-200 whitespace-nowrap">
                          {row.decision.confidence}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inspector Drawer Panel */}
        {selectedMsg && (
          <div className="xl:col-span-5 space-y-4 sticky top-20">
            <div className="bg-[#11141C] border border-white/[0.08] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-white">
                Inspecting <span className="font-mono text-blue-400">{selectedMsg.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRerouteGemini}
                  disabled={geminiRunning}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {geminiRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{geminiRunning ? 'Routing...' : 'Run Gemini'}</span>
                </button>
                <Link
                  to={`/simulator?id=${selectedMsg.id}`}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-200 whitespace-nowrap"
                >
                  <span>Simulator</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedMsg(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  aria-label="Close inspector"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {geminiError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 text-xs text-rose-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{geminiError}</span>
              </div>
            )}

            {selectedDecision && (
              <DecisionCard
                action={selectedDecision.action}
                messageType={selectedDecision.messageType}
                reason={selectedDecision.reason}
                confidence={selectedDecision.confidence}
                evidenceIds={selectedDecision.evidenceIds}
                trustScore={selectedDecision.trustScore}
                spamProbability={selectedDecision.spamProbability}
                urgency={selectedDecision.urgency}
                reflectionResult={selectedDecision.reflectionResult}
                source={selectedDecision.source}
                modelUsed={selectedDecision.modelUsed}
                riskFlags={selectedMsg.riskFlags}
              />
            )}

            {drawerLoading || !selectedContext ? (
              <div className="bg-[#11141C] border border-white/[0.08] rounded-xl p-5 text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                <span>Loading relational CSV context...</span>
              </div>
            ) : (
              <ContextInspector context={selectedContext} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
