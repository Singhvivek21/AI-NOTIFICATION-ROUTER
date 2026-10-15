import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Users, 
  Image as ImageIcon, 
  Mic, 
  Video, 
  AlertTriangle,
  MessageCircle,
  Building2,
  User
} from 'lucide-react';
import { cn, animationConfig } from '../../theme';

export type MediaType = 'image' | 'voice' | 'video' | 'none';

export interface NotificationCardProps {
  id: string;
  sender: string;
  time: string;
  message: string;
  avatarUrl?: string;
  isVerifiedBusiness?: boolean;
  isGroup?: boolean;
  groupName?: string;
  mediaType?: MediaType;
  isScamWarning?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function NotificationCard({
  id,
  sender,
  time,
  message,
  avatarUrl,
  isVerifiedBusiness = false,
  isGroup = false,
  groupName,
  mediaType = 'none',
  isScamWarning = false,
  onClick,
  className,
}: NotificationCardProps) {
  
  const renderMediaIcon = () => {
    switch (mediaType) {
      case 'image': return <ImageIcon className="h-3.5 w-3.5 text-secondary mr-1 inline" />;
      case 'voice': return <Mic className="h-3.5 w-3.5 text-accent mr-1 inline" />;
      case 'video': return <Video className="h-3.5 w-3.5 text-secondary mr-1 inline" />;
      default: return null;
    }
  };

  const renderAvatar = () => {
    if (avatarUrl) {
      return <img src={avatarUrl} alt={sender} className="h-full w-full object-cover" />;
    }
    
    if (isVerifiedBusiness) {
      return <Building2 className="h-5 w-5 text-emerald-400" />;
    }
    
    if (isGroup) {
      return <Users className="h-5 w-5 text-purple-400" />;
    }

    return <User className="h-5 w-5 text-blue-400" />;
  };

  return (
    <motion.div
      layoutId={`notification-${id}`}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={animationConfig.framer.apple}
      onClick={onClick}
      className={cn(
        "w-full glass-panel-dark rounded-3xl p-4 shadow-2xl relative overflow-hidden group cursor-pointer border border-white/5",
        isScamWarning && "border-error/30 bg-error/5",
        className
      )}
    >
      {/* Background Gradient Effect on Hover */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Header Context (App Logo & Time) */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-1.5">
          <div className="bg-[#25D366] rounded-md p-1 shadow-sm">
            <MessageCircle className="h-3 w-3 text-white fill-current" />
          </div>
          <span className="text-[11px] font-medium text-white/80 tracking-wide uppercase">
            WhatsApp
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {isScamWarning && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-error bg-error/10 border border-error/20">
              <AlertTriangle className="h-3 w-3" />
              Scam Risk
            </span>
          )}
          <span className="text-[11px] text-secondary font-medium">{time}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex items-start gap-3 relative z-10">
        
        {/* Avatar */}
        <div className={cn(
          "h-11 w-11 shrink-0 rounded-full flex items-center justify-center border overflow-hidden",
          !avatarUrl && isVerifiedBusiness && "bg-emerald-500/20 border-emerald-500/30",
          !avatarUrl && isGroup && "bg-purple-500/20 border-purple-500/30",
          !avatarUrl && !isVerifiedBusiness && !isGroup && "bg-blue-500/20 border-blue-500/30",
          avatarUrl && "border-white/10"
        )}>
          {renderAvatar()}
        </div>
        
        {/* Message Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          {/* Sender & Badges */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[14px] font-semibold text-primary truncate tracking-tight">
              {isGroup && groupName ? `${groupName}` : sender}
            </span>
            
            {isVerifiedBusiness && (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#25D366] shrink-0" />
            )}
            
            {isGroup && !isVerifiedBusiness && (
              <div className="bg-white/10 rounded px-1.5 py-0.5 flex items-center shrink-0">
                <Users className="h-3 w-3 text-secondary" />
              </div>
            )}
          </div>

          {/* Sub-sender (if group) */}
          {isGroup && groupName && (
            <div className="text-[12px] text-accent font-medium mb-0.5">
              {sender}
            </div>
          )}
          
          {/* Message Preview & Media */}
          <p className="text-[13px] text-secondary leading-snug line-clamp-2">
            {mediaType !== 'none' && renderMediaIcon()}
            {message}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
