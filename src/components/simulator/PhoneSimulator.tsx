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
  Mic,
  Image as ImageIcon,
  Forward,
  ShieldAlert,
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export type NotificationType = 'personal' | 'business' | 'group';

export interface NotificationData {
  id: string;
  type: NotificationType;
  sender: string;
  channelName?: string;
  message: string;
  isVerified?: boolean;
  time: string;
  mediaType?: string;
  forwardedCount?: number;
  riskFlags?: string[];
  action?: 'notify' | 'digest' | 'mute';
}

export interface PhoneSimulatorProps {
  customNotification?: NotificationData | null;
  cycleNotifications?: NotificationData[];
  disableLoop?: boolean;
}

export default function PhoneSimulator({
  customNotification,
  cycleNotifications = [],
  disableLoop = false,
}: PhoneSimulatorProps = {}) {
  const [currentTime, setCurrentTime] = useState<string>('14:30');
  const [activeNotification, setActiveNotification] = useState<NotificationData | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (disableLoop) {
      setActiveNotification(customNotification || null);
    }
  }, [customNotification, disableLoop]);

  useEffect(() => {
    if (disableLoop || cycleNotifications.length === 0) return;

    let isSubscribed = true;
    const runSimulation = async () => {
      let idx = 0;
      while (isSubscribed) {
        setActiveNotification(cycleNotifications[idx]);
        await new Promise((resolve) => setTimeout(resolve, 4200));
        if (!isSubscribed) break;
        setActiveNotification(null);
        await new Promise((resolve) => setTimeout(resolve, 900));
        if (!isSubscribed) break;
        idx = (idx + 1) % cycleNotifications.length;
      }
    };

    runSimulation();
    return () => {
      isSubscribed = false;
    };
  }, [disableLoop, cycleNotifications]);

  const getAvatarIcon = (type: NotificationType) => {
    switch (type) {
      case 'personal':
        return <User className="h-4 w-4 text-blue-400" />;
      case 'business':
        return <Building2 className="h-4 w-4 text-emerald-400" />;
      case 'group':
        return <Users className="h-4 w-4 text-amber-400" />;
    }
  };

  const getAvatarBg = (type: NotificationType) => {
    switch (type) {
      case 'personal':
        return 'bg-blue-500/15 border-blue-500/30';
      case 'business':
        return 'bg-emerald-500/15 border-emerald-500/30';
      case 'group':
        return 'bg-amber-500/15 border-amber-500/30';
    }
  };

  const hasRisk = Boolean(activeNotification?.riskFlags && activeNotification.riskFlags.length > 0);

  return (
    <div className="flex items-center justify-center py-2 w-full">
      <div className="relative w-[320px] h-[630px] rounded-[3rem] bg-[#07090D] border-[10px] border-[#1A1E2B] shadow-2xl ring-1 ring-white/10 overflow-hidden shrink-0">
        {/* Hardware side keys */}
        <div className="absolute top-28 -left-[12px] w-1 h-10 bg-[#2A3042] rounded-l-md" />
        <div className="absolute top-42 -left-[12px] w-1 h-10 bg-[#2A3042] rounded-l-md" />
        <div className="absolute top-36 -right-[12px] w-1 h-14 bg-[#2A3042] rounded-r-md" />

        <div className="relative w-full h-full bg-gradient-to-b from-[#131826] via-[#0B0E17] to-[#06080D] overflow-hidden flex flex-col">
          {/* Status Bar */}
          <div className="absolute top-0 w-full h-11 px-6 flex items-center justify-between z-20">
            <span className="text-xs font-medium text-white font-mono tabular-nums">{currentTime}</span>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-6 bg-black rounded-full z-30 flex items-center justify-end px-2">
              <div className="w-2 h-2 rounded-full bg-[#111520] border border-white/10" />
            </div>
            <div className="flex items-center gap-1.5 text-white/90">
              <Signal className="h-3 w-3" />
              <Wifi className="h-3 w-3" />
              <Battery className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Lock Screen Clock */}
          <div className="flex-1 flex flex-col items-center justify-center z-0 opacity-75 pointer-events-none pt-16">
            <div className="text-5xl font-light text-white/90 tracking-tight font-mono tabular-nums mb-1.5">
              {currentTime}
            </div>
            <div className="text-xs text-slate-400 font-medium tracking-wide">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            {!activeNotification && (
              <p className="mt-8 text-[11px] text-slate-500 tracking-wide">
                Select a message to preview delivery
              </p>
            )}
          </div>

          {/* Live Incoming Notification Card */}
          <div className="absolute top-12 left-0 w-full px-3 z-40 flex flex-col items-center">
            <AnimatePresence mode="wait">
              {activeNotification && (
                <motion.div
                  key={activeNotification.id}
                  initial={{ opacity: 0, y: -32, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.96 }}
                  transition={animationConfig.framer.spring}
                  className={cn(
                    'w-full bg-[#111521]/95 backdrop-blur-xl rounded-2xl p-3.5 shadow-2xl border relative overflow-hidden',
                    activeNotification.action === 'mute'
                      ? 'border-rose-500/40'
                      : activeNotification.action === 'notify'
                        ? 'border-emerald-500/40'
                        : 'border-white/10'
                  )}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="bg-emerald-500 rounded p-1 shrink-0">
                        <MessageCircle className="h-2.5 w-2.5 text-white fill-current" />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-300 tracking-wider uppercase truncate">
                        {activeNotification.type} · {activeNotification.id}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                      {activeNotification.time}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        'h-9 w-9 shrink-0 rounded-full flex items-center justify-center border',
                        getAvatarBg(activeNotification.type)
                      )}
                    >
                      {getAvatarIcon(activeNotification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {activeNotification.sender}
                        </span>
                        {activeNotification.isVerified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-snug line-clamp-4 whitespace-pre-line">
                        {activeNotification.message}
                      </p>

                      {/* Media / Forward / Risk Footer */}
                      {(activeNotification.mediaType === 'voice' ||
                        activeNotification.mediaType === 'image' ||
                        (activeNotification.forwardedCount ?? 0) > 0 ||
                        hasRisk) && (
                        <div className="mt-2 pt-2 border-t border-white/[0.08] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-400">
                          {activeNotification.mediaType === 'voice' && (
                            <span className="flex items-center gap-1 text-blue-300">
                              <Mic className="h-3 w-3" /> Voice note
                            </span>
                          )}
                          {activeNotification.mediaType === 'image' && (
                            <span className="flex items-center gap-1 text-blue-300">
                              <ImageIcon className="h-3 w-3" /> Image attached
                            </span>
                          )}
                          {(activeNotification.forwardedCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-amber-300 font-mono tabular-nums">
                              <Forward className="h-3 w-3" /> Fwd {activeNotification.forwardedCount}x
                            </span>
                          )}
                          {hasRisk && (
                            <span className="flex items-center gap-1 text-rose-400">
                              <ShieldAlert className="h-3 w-3" /> {activeNotification.riskFlags![0]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/25 rounded-full z-20" />
        </div>
      </div>
    </div>
  );
}
