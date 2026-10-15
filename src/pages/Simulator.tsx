import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  Settings2, 
  MessageSquare,
  ShieldAlert,
  Briefcase,
  ShoppingBag,
  Zap,
  AlertCircle,
  Users,
  Lock
} from 'lucide-react';
import PhoneSimulator, { NotificationData } from '../components/simulator/PhoneSimulator';
import AIThinking from '../components/shared/AIThinking';
import DecisionCard, { RoutingAction } from '../components/shared/DecisionCard';
import PipelineFlow from '../components/shared/PipelineFlow';
import { cn, buttonVariants } from '../theme';
import { simulationService, ScenarioData } from '../services/simulationService';
import { RoutingDecision } from '../services/notificationService';

type Speed = 'normal' | 'fast' | 'blazing';

const SPEED_MAP: Record<Speed, number> = {
  normal: 1000,
  fast: 500,
  blazing: 200,
};

export default function Simulator() {
  type DemoState = 'idle' | 'notification' | 'thinking' | 'pipeline' | 'decision';
  const [demoState, setDemoState] = useState<DemoState>('idle');
  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [decision, setDecision] = useState<RoutingDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [presentationCount, setPresentationCount] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedScenarioIdRef = useRef(selectedScenarioId);
  const scenariosRef = useRef(scenarios);

  useEffect(() => {
    selectedScenarioIdRef.current = selectedScenarioId;
  }, [selectedScenarioId]);

  useEffect(() => {
    scenariosRef.current = scenarios;
  }, [scenarios]);

  useEffect(() => {
    simulationService.getScenarios().then((data) => {
      setScenarios(data);
      if (data.length > 0) {
        setSelectedScenarioId(data[0].id);
      }
    }).catch(err => {
      console.error("Failed to load scenarios", err);
    });
  }, []);

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];
  
  // Use demoState to control visibility for a perfect sequence
  const showNotification = demoState !== 'idle';
  const showThinking = demoState === 'thinking' || demoState === 'pipeline' || demoState === 'decision';
  const showDecision = demoState === 'decision';
  const showOverlay = demoState !== 'decision';

  const getMockNotification = (): NotificationData => {
    if (!selectedScenario) return { id: '', type: 'personal', sender: '', message: '', time: 'Now', isVerified: false };
    
    return {
      id: selectedScenario.id,
      type: selectedScenario.type,
      sender: selectedScenario.sender,
      message: selectedScenario.description,
      time: 'Now',
      isVerified: selectedScenario.type === 'business'
    };
  };

  const runLocalSimulation = () => {
    let step = 0;
    pollIntervalRef.current = setInterval(() => {
      step += 1;
      setPipelineStep(step);
      
      if (step >= 10) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setIsSimulating(false);
        setDecision(selectedScenario.decision);
        setDemoState('decision');
        scheduleAutoPlayNext();
      }
    }, SPEED_MAP[speed]);
  };

  const startDemoSequence = () => {
    handleReset(true);
    setDemoState('notification');
    
    // Sequence: Notification (1.5s) -> Thinking (1.5s) -> Pipeline 
    if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
    
    sequenceTimeoutRef.current = setTimeout(() => {
      setDemoState('thinking');
      
      sequenceTimeoutRef.current = setTimeout(() => {
        setDemoState('pipeline');
        executeSimulation();
      }, 1500);
      
    }, 1500);
  };

  const executeSimulation = async () => {
    if (pipelineStep >= 10) setPipelineStep(0);
    
    setIsSimulating(true);
    setDecision(null);
    setError(null);
    
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);

    try {
      const { simulationId } = await simulationService.startSimulation(selectedScenarioId);
      
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await simulationService.getSimulationStatus(simulationId);
          setPipelineStep(status.currentStep);
          
          if (status.status === 'completed' || status.status === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsSimulating(false);
            
            if (status.status === 'completed' && status.decision) {
              setDecision(status.decision);
              setDemoState('decision');
            } else if (status.status === 'failed') {
              setError(status.message || 'Simulation failed');
              setDemoState('decision');
            }
            scheduleAutoPlayNext();
          }
        } catch (err) {
          console.error("Polling error", err);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsSimulating(false);
          setError("Failed to fetch simulation status");
          setDemoState('decision');
        }
      }, SPEED_MAP[speed]);
    } catch (err) {
      console.error("API Error, falling back to local simulation", err);
      runLocalSimulation();
    }
  };

  const scheduleAutoPlayNext = () => {
    if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);
    autoPlayTimeoutRef.current = setTimeout(() => {
      setAutoPlay(currentAutoPlay => {
        if (currentAutoPlay) {
          setPresentationCount(prevCount => {
            const nextCount = prevCount + 1;
            if (nextCount > 5 || nextCount > scenariosRef.current.length) {
              setTimeout(() => {
                setAutoPlay(false);
                setPresentationCount(0);
              }, 0);
              return 0;
            }
            const currentIndex = scenariosRef.current.findIndex(s => s.id === selectedScenarioIdRef.current);
            const nextIndex = (currentIndex + 1) % scenariosRef.current.length;
            setSelectedScenarioId(scenariosRef.current[nextIndex].id);
            setDemoState('idle'); 
            return nextCount;
          });
        }
        return currentAutoPlay;
      });
    }, 2000);
  };

  // Trigger simulation when scenario changes or autoplay is toggled
  useEffect(() => {
    if (autoPlay && !isSimulating && demoState === 'idle') {
      startDemoSequence();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenarioId, autoPlay, demoState]);

  const handleReset = (preserveAutoPlay = false) => {
    setIsSimulating(false);
    if (!preserveAutoPlay) {
      setAutoPlay(false);
      setPresentationCount(0);
    }
    setPipelineStep(0);
    setDecision(null);
    setError(null);
    setDemoState('idle');
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);
    if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);
    };
  }, []);

  const getIcon = (name: string) => {
    switch (name) {
      case 'Briefcase': return Briefcase;
      case 'MessageSquare': return MessageSquare;
      default: return MessageSquare;
    }
  }
  const ScenarioIcon = selectedScenario ? getIcon(selectedScenario.icon) : MessageSquare;
  const currentDecision = decision || (selectedScenario ? selectedScenario.decision : null);

  if (!selectedScenario) {
    return <div className="p-8">Loading scenarios...</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6 w-full pb-24 h-full"
    >
      <div className="glass-panel rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4 sticky top-16 z-30 shadow-glass">
        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <div className="flex items-center gap-2 mr-2 text-secondary shrink-0">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Payload:</span>
          </div>
          <div className="flex gap-2">
            {scenarios.map(scenario => {
              const Icon = getIcon(scenario.icon);
              return (
                <button
                  key={scenario.id}
                  onClick={() => {
                    setSelectedScenarioId(scenario.id);
                    handleReset();
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all whitespace-nowrap",
                    selectedScenarioId === scenario.id 
                      ? "bg-accent/20 border-accent/40 text-accent shadow-[0_0_15px_rgba(139,92,246,0.15)]" 
                      : "bg-white/5 border-white/10 text-secondary hover:bg-white/10 hover:text-primary"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {scenario.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end shrink-0">
          <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/5">
            {(['normal', 'fast', 'blazing'] as Speed[]).map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all",
                  speed === s ? "bg-white/10 text-primary shadow-sm" : "text-secondary hover:text-primary"
                )}
              >
                {s === 'blazing' ? <Zap className="h-3.5 w-3.5 inline mr-1" /> : null}
                {s}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            onClick={() => {
              if (autoPlay) {
                handleReset();
                setPresentationCount(0);
              } else {
                handleReset();
                if (scenarios.length > 0) {
                  setSelectedScenarioId(scenarios[0].id);
                  setPresentationCount(1);
                  setAutoPlay(true);
                  setDemoState('idle');
                }
              }
            }}
            className={cn(
              buttonVariants.base,
              "h-9 px-5 gap-2 border shadow-sm transition-all overflow-hidden relative group rounded-xl shrink-0",
              autoPlay 
                ? "bg-warning/20 border-warning/30 text-warning" 
                : "bg-white text-black hover:bg-neutral-200 border-transparent shadow-[0_0_15px_rgba(255,255,255,0.15)]"
            )}
          >
            {autoPlay ? (
              <>
                <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                Stop Presentation
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                Start Presentation
              </>
            )}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-warning/10 border border-warning/30 text-warning px-4 py-2 rounded-xl flex items-center gap-2 text-sm w-fit mx-auto mt-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8 items-start flex-1 min-h-[700px] mt-2">
         <div className="flex justify-center xl:justify-end xl:pr-4 h-full items-center">
            <div className="scale-[0.80] sm:scale-95 xl:scale-100 origin-center transition-transform duration-500">
               <PhoneSimulator 
                 customNotification={showNotification ? getMockNotification() : null}
                 disableLoop={true}
               />
            </div>
         </div>
         
         <div className="flex flex-col gap-6 w-full max-w-md mx-auto xl:max-w-none h-full justify-center">
            <AIThinking 
              isActive={showThinking} 
              speedMs={SPEED_MAP[speed]} 
              className="w-full max-h-[720px]"
            />
         </div>

         <div className="flex flex-col gap-6 w-full max-w-md mx-auto xl:max-w-none h-full justify-center">
            <div className="relative w-full">
              <AnimatePresence>
                {showOverlay && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-background/60 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center border border-white/5 shadow-2xl"
                  >
                    <div className="h-16 w-16 mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-glow">
                      <ScenarioIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      {isSimulating ? (
                        <>
                          <div className="h-2.5 w-2.5 rounded-full bg-accent animate-ping" />
                          <span className="text-sm font-semibold text-accent uppercase tracking-widest">
                            Analyzing Payload...
                          </span>
                        </>
                      ) : (
                        <>
                          <Settings2 className="h-4 w-4 text-secondary" />
                          <span className="text-sm font-semibold text-secondary uppercase tracking-widest">
                            Awaiting Execution
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-secondary/60 text-center max-w-[200px] mt-2">
                      {selectedScenario.description}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <DecisionCard
                action={currentDecision.action}
                reason={currentDecision.reason}
                confidence={currentDecision.confidence}
                evidenceIds={currentDecision.evidenceIds}
                trustScore={currentDecision.trustScore}
                spamProbability={currentDecision.spamProbability}
                urgency={currentDecision.urgency}
                reflectionResult={currentDecision.reflectionResult}
                className={!showDecision ? "opacity-20 grayscale transition-all duration-1000 scale-95 blur-sm" : "transition-all duration-500 scale-100 blur-0"}
              />
            </div>
         </div>
      </div>
      
      <div className="w-full mt-4 glass-panel rounded-3xl p-2 sm:p-6 mb-8 shrink-0">
         <PipelineFlow currentStepIndex={pipelineStep} />
      </div>
    </motion.div>
  );
}

