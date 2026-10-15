import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PhoneSimulator from '../components/simulator/PhoneSimulator';
import AIThinking from '../components/shared/AIThinking';
import DecisionCard from '../components/shared/DecisionCard';
import PipelineFlow from '../components/shared/PipelineFlow';
import { animationConfig, typography } from '../theme';
import { simulationService, SystemAnalytics } from '../services/simulationService';
import { Activity, ShieldCheck, Zap, Server } from 'lucide-react';

export default function Dashboard() {
  const [pipelineStep, setPipelineStep] = useState(0);
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await simulationService.getAnalytics();
        if (data && typeof data.totalProcessed === 'number') {
          setAnalytics(data);
        } else {
          throw new Error('Invalid analytics data');
        }
      } catch (err) {
        // Fallback mock data
        setAnalytics({
          totalProcessed: 14205,
          avgProcessingTimeMs: 245,
          accuracyRate: 99.8,
          spamCaught: 3450,
          uptime: '99.99%'
        });
      }
    };
    fetchAnalytics();
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const runCycle = async () => {
      while (isMounted) {
        setPipelineStep(0);
        await new Promise(r => setTimeout(r, 2000));
        
        for (let i = 1; i <= 10; i++) {
          if (!isMounted) return;
          setPipelineStep(i);
          await new Promise(r => setTimeout(r, 800)); 
        }
        
        await new Promise(r => setTimeout(r, 6000));
      }
    };

    runCycle();
    return () => { isMounted = false; };
  }, []);

  const isThinking = pipelineStep > 0 && pipelineStep < 10;
  const isComplete = pipelineStep >= 10;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={animationConfig.framer.apple}
      className="flex flex-col gap-8 w-full pb-24"
    >
      <div className="flex flex-col gap-2 mb-2">
         <h1 className={typography.h2}>Live Telemetry</h1>
         <p className={typography.body}>Real-time interception and routing analysis engine.</p>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Total Processed', value: analytics.totalProcessed.toLocaleString(), icon: Activity, color: 'text-blue-400' },
            { label: 'Avg Speed', value: `${analytics.avgProcessingTimeMs}ms`, icon: Zap, color: 'text-accent' },
            { label: 'Accuracy', value: `${analytics.accuracyRate}%`, icon: ShieldCheck, color: 'text-success' },
            { label: 'Spam Blocked', value: analytics.spamCaught.toLocaleString(), icon: Server, color: 'text-warning' },
          ].map((stat, i) => (
            <div key={i} className="glass-panel rounded-2xl p-4 flex flex-col gap-2 border border-white/5">
              <div className="flex items-center gap-2 text-secondary">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs font-medium uppercase tracking-wider">{stat.label}</span>
              </div>
              <span className="text-2xl font-bold text-primary">{stat.value}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8 items-start">
         <div className="flex justify-center xl:justify-end xl:pr-4">
            <div className="scale-[0.85] sm:scale-95 xl:scale-100 origin-top transition-transform duration-500">
               <PhoneSimulator />
            </div>
         </div>
         
         <div className="flex flex-col gap-6 w-full max-w-md mx-auto xl:max-w-none">
            <AIThinking 
              isActive={isThinking} 
              speedMs={800} 
              className="h-full max-h-[720px]"
            />
         </div>

         <div className="flex flex-col gap-6 w-full max-w-md mx-auto xl:max-w-none">
            <div className="relative h-full w-full">
              <AnimatePresence>
                {!isComplete && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-background/50 backdrop-blur-[2px] rounded-3xl flex items-center justify-center border border-white/5"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-accent animate-ping" />
                      <span className="text-sm font-medium text-secondary uppercase tracking-widest">
                        Awaiting Decision...
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <DecisionCard
                action="mute"
                reason="Detected high-probability phishing attempt disguised as a delivery notification."
                confidence={98.5}
                evidenceIds={['msg_78x9', 'url_scan_22', 'img_hash_9']}
                trustScore={12}
                spamProbability={94}
                urgency={8}
                reflectionResult="Verified against known phishing database. Sender domain mismatch confirmed."
                className={!isComplete ? "opacity-30 grayscale transition-all duration-1000" : "transition-all duration-500"}
              />
            </div>
         </div>
      </div>
      
      <div className="w-full mt-4 glass-panel rounded-3xl p-2 sm:p-6">
         <PipelineFlow currentStepIndex={pipelineStep} />
      </div>
    </motion.div>
  );
}
