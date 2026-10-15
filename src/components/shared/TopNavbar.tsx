import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Bell, 
  Moon, 
  Sun, 
  Play, 
  Loader2, 
  Menu, 
  Command, 
  Activity,
  Sparkles
} from 'lucide-react';
import { cn, buttonVariants, typography } from '../../theme';

interface TopNavbarProps {
  onMobileMenuToggle: () => void;
}

export default function TopNavbar({ onMobileMenuToggle }: TopNavbarProps) {
  const [isDark, setIsDark] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  // Mock simulation runner
  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setHasUnread(true);
    }, 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-nav px-4 lg:px-8 h-16 flex items-center justify-between shrink-0">
      
      {/* Left Section: Mobile Menu & Logo */}
      <div className="flex items-center gap-4 lg:gap-0">
        {/* Mobile Menu Toggle */}
        <button 
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 -ml-2 text-secondary hover:text-primary transition-colors focus:outline-none"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile Logo (Visible only when sidebar is hidden on small screens) */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 border border-white/10 shadow-glow-accent">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          </div>
          <span className="font-semibold text-primary">Nexus AI</span>
        </div>

        {/* Desktop Search Bar (Spotlight Style) */}
        <div className="hidden md:flex items-center relative group">
          <Search className="absolute left-3 h-4 w-4 text-secondary group-focus-within:text-accent transition-colors" />
          <input 
            type="text"
            placeholder="Search messages, rules, or insights..."
            className="h-9 w-72 lg:w-96 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-lg pl-9 pr-12 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:bg-black/50 transition-all duration-300"
          />
          <div className="absolute right-2 flex items-center">
            <kbd className="h-5 rounded bg-white/10 px-1.5 font-mono text-[10px] font-medium text-secondary flex items-center border border-white/5 shadow-sm">
              <Command className="h-3 w-3 mr-0.5" /> K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Section: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-4">
        
        {/* API Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </div>
          <span className="text-xs font-medium text-secondary">API Online</span>
        </div>

        {/* Run Simulation Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRunSimulation}
          disabled={isSimulating}
          className={cn(
            buttonVariants.base,
            "h-9 px-3 sm:px-4 gap-2 border shadow-sm transition-all overflow-hidden relative group",
            isSimulating 
              ? "bg-accent/20 border-accent/30 text-accent cursor-wait" 
              : "bg-white text-black hover:bg-neutral-200 border-transparent shadow-[0_0_15px_rgba(255,255,255,0.15)]"
          )}
        >
          {/* Animated background glow on hover */}
          {!isSimulating && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
          )}
          
          <AnimatePresence mode="popLayout" initial={false}>
            {isSimulating ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-semibold hidden sm:inline-block">Simulating...</span>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4 fill-current" />
                <span className="text-sm font-semibold hidden sm:inline-block">Run Simulation</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-white/10 mx-1" />

        {/* Theme Toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsDark(!isDark)}
          className={cn(buttonVariants.ghost, "h-9 w-9 rounded-full p-0 hidden sm:flex")}
          title="Toggle Theme"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isDark ? 'dark' : 'light'}
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </motion.div>
          </AnimatePresence>
        </motion.button>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setHasUnread(false)}
          className={cn(buttonVariants.ghost, "h-9 w-9 rounded-full p-0 relative")}
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {hasUnread && (
              <motion.span 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error ring-2 ring-[#09090b] shadow-sm" 
              />
            )}
          </AnimatePresence>
        </motion.button>

        {/* User Avatar */}
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-accent/80 to-blue-500/80 border border-white/20 shadow-sm overflow-hidden"
        >
          <img 
            src="https://api.dicebear.com/9.x/notionists/svg?seed=Felix&backgroundColor=transparent" 
            alt="User" 
            className="h-full w-full object-cover opacity-90"
          />
        </motion.button>
      </div>
    </header>
  );
}
