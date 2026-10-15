import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Smartphone, 
  BrainCircuit, 
  Activity, 
  FileCheck, 
  Settings,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { cn, typography, animationConfig } from '../../theme';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Phone Simulator', icon: Smartphone, path: '/simulator' },
  { name: 'AI Pipeline', icon: BrainCircuit, path: '/pipeline' },
  { name: 'Analytics', icon: Activity, path: '/analytics' },
  { name: 'Evaluation', icon: FileCheck, path: '/evaluation' },
  { name: 'Settings', icon: Settings, path: '/settings' },
];

export default function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  // Handle responsive auto-collapse for tablet
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768 && width < 1024) {
        setIsCollapsed(true);
      } else if (width >= 1024) {
        setIsCollapsed(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const SidebarContent = (
    <>
      {/* Header / Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-white/5">
        <div className={cn("flex items-center gap-3 overflow-hidden", isCollapsed && "justify-center w-full")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/10 shadow-glow-accent">
            <BrainCircuit className="h-4 w-4 text-accent" />
          </div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className={cn(typography.h4, "font-semibold tracking-tight whitespace-nowrap")}
              >
                Nexus AI
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop/Tablet Collapse Toggle */}
        <div className="hidden md:block">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-secondary hover:text-primary hover:bg-white/5 transition-colors absolute -right-3 top-5 bg-[#121212] border border-white/10 shadow-sm z-10"
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Mobile Close Button */}
        <button 
          onClick={onMobileClose}
          className="md:hidden p-2 text-secondary hover:text-primary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 768) onMobileClose();
              }}
              className={cn(
                "flex items-center rounded-xl transition-all duration-300 group relative",
                isCollapsed ? "justify-center px-0 py-3" : "px-3 py-2.5 gap-3",
                isActive 
                  ? "text-primary bg-white/[0.08]" 
                  : "text-secondary hover:text-primary hover:bg-white/[0.04]"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              {/* Animated Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-r-full shadow-glow-accent"
                  transition={animationConfig.framer.apple}
                />
              )}
              
              <item.icon 
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors", 
                  isActive ? "text-accent" : "text-secondary group-hover:text-primary"
                )} 
              />
              
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-medium text-sm whitespace-nowrap overflow-hidden"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-white/5 shrink-0">
        <button 
          className={cn(
            "flex w-full items-center rounded-xl hover:bg-white/[0.04] transition-colors",
            isCollapsed ? "justify-center p-2" : "p-2 gap-3"
          )}
        >
          <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-tr from-accent to-blue-500 flex items-center justify-center border border-white/10 shadow-sm">
            <span className="text-sm font-medium text-white">AK</span>
          </div>
          
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex flex-col items-start overflow-hidden whitespace-nowrap"
              >
                <span className="text-sm font-medium text-primary">Admin User</span>
                <span className="text-xs text-secondary">Pro Plan</span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? 80 : 280,
          x: typeof window !== 'undefined' && window.innerWidth < 768 && !isMobileOpen ? '-100%' : 0,
        }}
        transition={animationConfig.framer.apple}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col h-screen",
          "bg-[#09090b]/80 backdrop-blur-2xl border-r border-white/5 shadow-2xl md:shadow-none",
          "md:static md:translate-x-0 shrink-0"
        )}
      >
        {SidebarContent}
      </motion.aside>
    </>
  );
}
