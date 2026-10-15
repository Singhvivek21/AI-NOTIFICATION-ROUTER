import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  Search, 
  Bell, 
  Settings, 
  Sparkles, 
  BrainCircuit, 
  MessageSquare, 
  Home, 
  ShieldCheck, 
  Activity,
  X,
  PanelRightClose,
  PanelRightOpen,
  Command
} from 'lucide-react';
import { cn, typography, animationConfig, buttonVariants } from '../theme';

// --- Configuration ---
const NAVIGATION = [
  { name: 'Dashboard', icon: Home, path: '/' },
  { name: 'Live Stream', icon: Activity, path: '/stream' },
  { name: 'Decisions', icon: BrainCircuit, path: '/decisions' },
  { name: 'Simulator', icon: MessageSquare, path: '/simulator' },
  { name: 'Rules Engine', icon: ShieldCheck, path: '/rules' },
];

export default function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setIsAiPanelOpen(false);
      } else {
        setIsAiPanelOpen(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full bg-background text-primary overflow-hidden selection:bg-accent/30">
      {/* --- LEFT SIDEBAR (Desktop & Mobile) --- */}
      <AnimatePresence>
        {(isMobileMenuOpen || !isMobile) && (
          <>
            {/* Mobile Backdrop */}
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              />
            )}

            <motion.aside
              initial={isMobile ? { x: '-100%' } : false}
              animate={{ x: 0 }}
              exit={isMobile ? { x: '-100%' } : undefined}
              transition={animationConfig.framer.apple}
              className={cn(
                "fixed lg:static inset-y-0 left-0 z-50 w-72 flex flex-col",
                "bg-surface/50 border-r border-white/5 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/30"
              )}
            >
              {/* App Logo/Header */}
              <div className="h-16 flex items-center px-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/10 shadow-glow-accent/20">
                    <BrainCircuit className="h-4 w-4 text-accent" />
                  </div>
                  <span className={cn(typography.h4, "font-semibold tracking-tight")}>
                    Nexus AI
                  </span>
                </div>
                {isMobile && (
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="ml-auto p-2 -mr-2 text-secondary hover:text-primary transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                <div className="px-3 mb-2">
                  <span className={cn(typography.label)}>Overview</span>
                </div>
                {NAVIGATION.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative",
                        isActive 
                          ? "text-primary bg-white/10" 
                          : "text-secondary hover:text-primary hover:bg-white/5"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-r-full shadow-glow-accent"
                          transition={animationConfig.framer.spring}
                        />
                      )}
                      <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-accent" : "text-secondary group-hover:text-primary")} />
                      <span className="font-medium text-sm">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* User Profile / Settings */}
              <div className="p-4 border-t border-white/5">
                <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-accent to-blue-500 flex items-center justify-center border border-white/10">
                    <span className="text-sm font-medium text-white">AK</span>
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium">Admin User</span>
                    <span className="text-xs text-secondary">Pro Plan</span>
                  </div>
                  <Settings className="h-4 w-4 text-secondary ml-auto" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* --- MAIN CONTENT COLUMN --- */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Navbar */}
        <header className="h-16 glass-nav flex items-center justify-between px-4 lg:px-8 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            {!isMobileMenuOpen && isMobile && (
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className={cn(buttonVariants.ghost, buttonVariants.sizes.icon, "-ml-2")}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            
            {/* Search Bar (Apple Spotlight Style) */}
            <div className="hidden md:flex items-center relative group">
              <Search className="absolute left-3 h-4 w-4 text-secondary group-focus-within:text-accent transition-colors" />
              <input 
                type="text"
                placeholder="Search messages, rules, or insights..."
                className="h-9 w-72 bg-white/5 border border-white/10 rounded-lg pl-9 pr-12 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all duration-300"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <kbd className="h-5 rounded bg-white/10 px-1.5 font-mono text-[10px] font-medium text-secondary flex items-center">
                  <Command className="h-3 w-3 mr-0.5" /> K
                </kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <button className={cn(buttonVariants.ghost, buttonVariants.sizes.icon, "relative")}>
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-error ring-2 ring-background" />
            </button>
            
            {/* Toggle AI Panel Button */}
            <button 
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              className={cn(
                buttonVariants.ghost, 
                buttonVariants.sizes.icon, 
                isAiPanelOpen ? "text-accent bg-accent/10" : "text-secondary"
              )}
            >
              {isAiPanelOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth relative">
          <div className="max-w-6xl mx-auto h-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* --- RIGHT AI INSIGHTS PANEL --- */}
      <AnimatePresence initial={false}>
        {isAiPanelOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={animationConfig.framer.apple}
            className="border-l border-white/5 bg-black/20 flex flex-col overflow-hidden shrink-0 hidden lg:flex"
          >
            <div className="w-80 h-full flex flex-col">
              {/* AI Header */}
              <div className="h-16 flex items-center px-6 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent animate-pulse" />
                  <span className="text-sm font-medium text-gradient-ai">
                    AI Insights & Telemetry
                  </span>
                </div>
              </div>

              {/* AI Content Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* System Status Card */}
                <div className="rounded-xl bg-surface/50 border border-white/5 p-4 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success via-accent to-success opacity-50" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary">System Status</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      <span className="text-xs font-medium text-success">Optimal</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-secondary">Flash Routing</span>
                      <span className="text-primary">45ms</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-secondary">Pro Reflection</span>
                      <span className="text-primary">820ms</span>
                    </div>
                  </div>
                </div>

                {/* Live Activity Feed Placeholder */}
                <div className="space-y-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-secondary">Live Telemetry</span>
                  
                  {/* Mock Activity Items */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 text-sm group cursor-default">
                      <div className="mt-0.5 flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-accent/50 group-hover:bg-accent transition-colors" />
                        {i !== 3 && <div className="w-[1px] h-full bg-white/5 mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-primary/90">Intercepted promotional message.</p>
                        <p className="text-xs text-secondary mt-0.5">Routed to digest • 2m ago</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
