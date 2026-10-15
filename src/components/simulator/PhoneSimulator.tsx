import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Battery, 
  Wifi, 
  Signal, 
  CheckCircle2, 
  Users, 
  User, 
  Building2, 
  MessageCircle,
  Clock
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export type NotificationType = 'personal' | 'business' | 'group';

export interface NotificationData {
  id: string;
  type: NotificationType;
  sender: string;
  message: string;
  isVerified?: boolean;
  time: string;
}

export interface PhoneSimulatorProps {
  customNotification?: NotificationData | null;
  disableLoop?: boolean;
}

const MOCK_NOTIFICATIONS: NotificationData[] = [
  {
    id: '1',
    type: 'personal',
    sender: 'Sarah Connor',
    message: 'Hey! Are we still on for dinner tonight? 🌮',
    time: 'Now'
  },
  {
    id: '2',
    type: 'business',
    sender: 'UberEats',
    message: 'Your order is arriving in 5 minutes. Track it here.',
    isVerified: true,
    time: '1m ago'
  },
  {
    id: '3',
    type: 'group',
    sender: 'Dev Team Alpha',
    message: 'Alex: Can someone review my PR for the AI Router?',
    time: '5m ago'
  }
];

export default function PhoneSimulator({ customNotification, disableLoop }: PhoneSimulatorProps = {}) {
  const [currentTime, setCurrentTime] = useState<string>('12:00');
  const [activeNotification, setActiveNotification] = useState<NotificationData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (disableLoop) {
      setActiveNotification(customNotification || null);
    }
  }, [customNotification, disableLoop]);

  useEffect(() => {
    if (disableLoop) return;

    let isSubscribed = true;
    const runSimulation = async () => {
      let idx = 0;
      while (isSubscribed) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (!isSubscribed) break;
        
        setActiveNotification(MOCK_NOTIFICATIONS[idx]);
        
        await new Promise(resolve => setTimeout(resolve, 4000));
        if (!isSubscribed) break;
        
        setActiveNotification(null);
        
        idx = (idx + 1) % MOCK_NOTIFICATIONS.length;
      }
    };
    
    runSimulation();
    
    return () => {
      isSubscribed = false;
    };
  }, [disableLoop]);

  const getAvatarIcon = (type: NotificationType) => {
    switch (type) {
      case 'personal': return <User className="h-5 w-5 text-blue-400" />;
      case 'business': return <Building2 className="h-5 w-5 text-emerald-400" />;
      case 'group': return <Users className="h-5 w-5 text-purple-400" />;
    }
  };

  const getAvatarBg = (type: NotificationType) => {
    switch (type) {
      case 'personal': return 'bg-blue-500/20 border-blue-500/30';
      case 'business': return 'bg-emerald-500/20 border-emerald-500/30';
      case 'group': return 'bg-purple-500/20 border-purple-500/30';
    }
  };

  return (
    <div className="flex items-center justify-center p-8 w-full h-full">
      <div className="relative w-[340px] h-[720px] rounded-[3.5rem] bg-black border-[12px] border-[#121212] shadow-2xl ring-1 ring-white/10 overflow-hidden shrink-0">
        <div className="absolute top-32 -left-[14px] w-1 h-12 bg-[#2a2a2a] rounded-l-md" />
        <div className="absolute top-48 -left-[14px] w-1 h-12 bg-[#2a2a2a] rounded-l-md" />
        <div className="absolute top-40 -right-[14px] w-1 h-16 bg-[#2a2a2a] rounded-r-md" />

        <div className="relative w-full h-full bg-gradient-to-b from-zinc-900 via-[#0a0a0c] to-black overflow-hidden flex flex-col">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-accent/20 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="flex-1 flex flex-col items-center justify-center z-0 opacity-80 pointer-events-none">
            <div className="text-6xl font-light text-white/90 tracking-tight mb-2">
              {currentTime.split(' ')[0]}
            </div>
            <div className="text-sm text-secondary font-medium tracking-wide">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div className="absolute top-0 w-full h-12 px-6 flex items-center justify-between z-20">
            <span className="text-xs font-medium text-white pl-1">{currentTime.split(' ')[0]}</span>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-7 bg-black rounded-full z-30 shadow-[inset_0_-1px_2px_rgba(255,255,255,0.1)] flex items-center justify-end px-2">
               <div className="w-2.5 h-2.5 rounded-full bg-[#09090b] border border-white/10" />
            </div>
            <div className="flex items-center gap-1.5 pr-1">
              <Signal className="h-3.5 w-3.5 text-white" />
              <Wifi className="h-3.5 w-3.5 text-white" />
              <Battery className="h-4 w-4 text-white" />
            </div>
          </div>

          <div className="absolute top-12 left-0 w-full px-3 z-40 flex flex-col items-center">
            <AnimatePresence mode="wait">
              {activeNotification && (
                <motion.div
                  key={activeNotification.id}
                  initial={{ opacity: 0, y: -40, scale: 0.95, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -20, scale: 0.95, filter: "blur(4px)" }}
                  transition={animationConfig.framer.spring}
                  className="w-full glass-panel-dark rounded-3xl p-4 shadow-2xl relative overflow-hidden group cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <div className="flex items-center gap-1.5">
                      <div className="bg-[#25D366] rounded-md p-1 shadow-sm">
                        <MessageCircle className="h-3 w-3 text-white fill-current" />
                      </div>
                      <span className="text-[11px] font-medium text-white/80 tracking-wide uppercase">WhatsApp</span>
                    </div>
                    <span className="text-[11px] text-white/50 font-medium">{activeNotification.time}</span>
                  </div>

                  <div className="flex items-start gap-3 relative z-10">
                    <div className={cn(
                      "h-10 w-10 shrink-0 rounded-full flex items-center justify-center border",
                      getAvatarBg(activeNotification.type)
                    )}>
                      {getAvatarIcon(activeNotification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-semibold text-white truncate">
                          {activeNotification.sender}
                        </span>
                        {activeNotification.isVerified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#25D366] shrink-0" />
                        )}
                      </div>
                      <p className="text-[13px] text-white/70 leading-snug line-clamp-2">
                        {activeNotification.message}
                      </p>
                    </div>
                  </div>
                  <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-4 mb-0.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/30 rounded-full z-20" />
        </div>
      </div>
    </div>
  );
}
