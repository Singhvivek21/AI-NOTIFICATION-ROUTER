import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Smartphone,
  TableProperties,
  Database,
  Search,
  Download,
  Menu,
  X,
  Radio,
} from 'lucide-react';
import { cn, animationConfig } from '../theme';
import { datasetService } from '../services/datasetService';

const NAV_ITEMS = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Simulator', path: '/simulator', icon: Smartphone },
  { name: 'Messages & Output', path: '/messages', icon: TableProperties },
  { name: 'Entities & Benchmarks', path: '/entities', icon: Database },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const activeNav = NAV_ITEMS.find((item) => item.path === location.pathname) || NAV_ITEMS[0];

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    navigate(trimmed ? `/messages?q=${encodeURIComponent(trimmed)}` : '/messages');
  };

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 flex overflow-x-clip">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={animationConfig.framer.apple}
            className="fixed top-0 left-0 z-50 h-screen w-60 bg-[#0D1017] border-r border-white/[0.08] flex flex-col lg:hidden"
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.08]">
              <Link to="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                  <Radio className="h-4 w-4 text-blue-400" />
                </div>
                <span className="font-bold text-sm tracking-tight text-white">SignalRoute</span>
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 z-30 h-screen w-60 bg-[#0D1017] border-r border-white/[0.08] flex-col">
        <div className="h-14 flex items-center px-4 border-b border-white/[0.08]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Radio className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block leading-none">
                SignalRoute
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Notification Router
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.08] text-xs text-slate-400 space-y-1">
          <div className="font-medium text-slate-300">Relational Dataset Active</div>
          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
            13 CSV tables · 110 messages
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        {/* Top Navbar: Strict 3-Zone Contract */}
        <header className="sticky top-0 z-20 h-14 glass-nav flex items-center justify-between gap-4 px-4 sm:px-6">
          {/* Zone 1: Menu + Current View */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold text-slate-100 truncate">
              {activeNav.name}
            </h1>
          </div>

          {/* Zone 2: Global Search */}
          <form onSubmit={handleGlobalSearch} className="hidden sm:flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search message ID, sender, domain, or text..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#11141C] border border-white/[0.08] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </form>

          {/* Zone 3: Single Primary Action */}
          <a
            href={datasetService.getOutputDownloadUrl()}
            download="output.csv"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export output.csv</span>
          </a>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
