import React, { useState, useEffect } from 'react';
import type { LocalTask } from '../services/syncService';
import type { PomodoroSession } from '../services/pomodoroService';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ListTodo,
  CheckSquare,
  Square,
  Timer,
  Volume2,
  VolumeX,
  Music,
  X,
  Flame,
  Clock,
  Compass,
  AlertCircle,
  Maximize2,
  Minimize2,
  Send
} from 'lucide-react';
import { deletePomodoroSession } from '../services/pomodoroService';

interface PomodoroBoardProps {
  tasks: LocalTask[];
  activeListId: string;
  pomodoroSessions: PomodoroSession[];
  userId: string;
  onToggleTask: (taskId: string, currentStatus: 'needsAction' | 'completed') => Promise<void>;

  pomoType: 'work' | 'shortBreak' | 'longBreak';
  pomoState: 'idle' | 'running' | 'paused';
  pomoTotalDuration: number;
  pomoTimeLeft: number;
  pomoSelectedTaskIds: string[];
  setPomoSelectedTaskIds: React.Dispatch<React.SetStateAction<string[]>>;
  activeSoundId: string | null;
  startPausePomo: () => void;
  resetPomo: (savePartialCallback?: (durationMin: number, startTime: string) => void) => void;
  skipPomo: () => void;
  adjustPomoDuration: (amount: number) => void;
  toggleAmbientSound: (soundId: string, url: string) => void;
  handlePresetSelect: (type: 'work' | 'shortBreak' | 'longBreak') => void;
  handleSavePartialSession: (durationMin: number, startTimeStr: string) => Promise<void>;
  handleDiscardPartialSession: () => Promise<void>;
  pomoDistractions: string[];
  addPomoDistraction: (text: string) => Promise<void>;
}

const AMBIENT_SOUNDS = [
  { id: 'rain', name: '🌧️ Heavy Rain', url: 'https://www.soundjay.com/nature/sounds/rain-07.mp3' },
  { id: 'ocean', name: '🌊 Ocean Waves', url: 'https://www.soundjay.com/nature/sounds/ocean-wave-1.mp3' },
  { id: 'white', name: '🤫 White Noise', url: 'https://www.soundjay.com/misc/sounds/fume-extractor-1.mp3' },
  { id: 'lofi', name: '🎵 Focus Lofi', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' }
];

const CALMING_QUOTES = [
  "Deep breath in, deep breath out. Flow follows focus.",
  "Quiet the mind, lock in, and the progress will take care of itself.",
  "Single-tasking is your superpower. The noise can wait.",
  "Focus isn't about saying yes to one thing, it's about saying no to a thousand distractions.",
  "One block at a time. Brick by brick, great work is built.",
  "Make each minute count, or make it rest. Give yourself fully to both."
];

export const PomodoroBoard: React.FC<PomodoroBoardProps> = ({
  tasks,
  activeListId,
  pomodoroSessions,
  userId,
  onToggleTask,
  pomoType,
  pomoState,
  pomoTotalDuration,
  pomoTimeLeft,
  pomoSelectedTaskIds,
  setPomoSelectedTaskIds,
  activeSoundId,
  startPausePomo,
  resetPomo,
  skipPomo,
  adjustPomoDuration,
  toggleAmbientSound,
  handlePresetSelect,
  handleSavePartialSession,
  handleDiscardPartialSession,
  pomoDistractions,
  addPomoDistraction
}) => {
  // Local state for task search & selector popup
  const [searchQuery, setSearchQuery] = useState('');
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(false);

  // Local state for partial focus sessions confirmation modal
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialSessionDuration, setPartialSessionDuration] = useState(0);
  const [partialStartTime, setPartialStartTime] = useState<string | null>(null);

  // Interactive local slider configurations
  const [workMin, setWorkMin] = useState(() => Number(localStorage.getItem('zenith-pomo-work') || '25'));
  const [shortMin, setShortMin] = useState(() => Number(localStorage.getItem('zenith-pomo-short') || '5'));
  const [longMin, setLongMin] = useState(() => Number(localStorage.getItem('zenith-pomo-long') || '15'));

  // Zen Mode State
  const [isZenMode, setIsZenMode] = useState(false);
  const [activeQuoteIdx, setActiveQuoteIdx] = useState(0);
  const [distractionText, setDistractionText] = useState('');
  const [showDistractionSuccess, setShowDistractionSuccess] = useState(false);

  // Dynamic daily stats
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = getLocalDateStr(new Date());

  // Completed work sessions today
  const completedToday = pomodoroSessions.filter(s => {
    if (!s.completed || s.type !== 'work') return false;
    return getLocalDateStr(new Date(s.startTime)) === todayStr;
  });

  const focusMinsToday = completedToday.reduce((sum, s) => sum + s.durationMinutes, 0);
  const completedCountToday = completedToday.length;

  // Streak calculations
  const computeFocusStreak = () => {
    const completedDays = new Set(
      pomodoroSessions
        .filter(s => s.completed && s.type === 'work')
        .map(s => getLocalDateStr(new Date(s.startTime)))
    );

    let streak = 0;
    const checkDate = new Date();
    
    if (completedDays.has(getLocalDateStr(checkDate))) {
      streak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
      while (completedDays.has(getLocalDateStr(checkDate))) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
      if (completedDays.has(getLocalDateStr(checkDate))) {
        streak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
        while (completedDays.has(getLocalDateStr(checkDate))) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }
    return streak;
  };

  const focusStreak = computeFocusStreak();

  // Distractions today
  const todayDistractionsList = pomodoroSessions
    .filter(s => getLocalDateStr(new Date(s.startTime)) === todayStr)
    .reduce((arr, s) => [...arr, ...(s.distractions || [])], [] as string[]);
  
  const totalDistractionsToday = todayDistractionsList.length + pomoDistractions.length;

  // Handle Preset Slider tuning
  const handleSliderChange = (type: 'work' | 'short' | 'long', val: number) => {
    if (type === 'work') {
      setWorkMin(val);
      localStorage.setItem('zenith-pomo-work', String(val));
      if (pomoType === 'work' && pomoState === 'idle') {
        handlePresetSelect('work');
      }
    } else if (type === 'short') {
      setShortMin(val);
      localStorage.setItem('zenith-pomo-short', String(val));
      if (pomoType === 'shortBreak' && pomoState === 'idle') {
        handlePresetSelect('shortBreak');
      }
    } else {
      setLongMin(val);
      localStorage.setItem('zenith-pomo-long', String(val));
      if (pomoType === 'longBreak' && pomoState === 'idle') {
        handlePresetSelect('longBreak');
      }
    }
  };

  // Rotation of quotes in Zen Mode
  useEffect(() => {
    let interval: any = null;
    if (isZenMode) {
      interval = setInterval(() => {
        setActiveQuoteIdx(prev => (prev + 1) % CALMING_QUOTES.length);
      }, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isZenMode]);

  // Local helper wrappers
  const handleReset = () => {
    resetPomo((durationMin, startTimeStr) => {
      setPartialSessionDuration(durationMin);
      setPartialStartTime(startTimeStr);
      setShowPartialModal(true);
    });
  };

  const handleSavePartial = async () => {
    if (!partialStartTime) return;
    await handleSavePartialSession(partialSessionDuration, partialStartTime);
    setShowPartialModal(false);
  };

  const handleDiscardPartial = async () => {
    setShowPartialModal(false);
    await handleDiscardPartialSession();
  };

  const handleJotDistraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distractionText.trim()) return;
    await addPomoDistraction(distractionText.trim());
    setDistractionText('');
    setShowDistractionSuccess(true);
    setTimeout(() => setShowDistractionSuccess(false), 2000);
  };

  const activeTasks = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted);
  const filteredTasks = activeTasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTaskSelection = (taskId: string) => {
    setPomoSelectedTaskIds(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId) 
        : [...prev, taskId]
    );
  };

  const handleDeleteSessionLog = async (sessionId: string) => {
    if (confirm("Are you sure you want to delete this focus log?")) {
      try {
        await deletePomodoroSession(userId, sessionId);
      } catch (err) {
        console.error("Failed to delete pomodoro session:", err);
      }
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const getTimerThemeColor = () => {
    if (pomoType === 'work') return 'var(--color-primary)';
    if (pomoType === 'shortBreak') return 'var(--color-secondary)';
    return 'var(--color-success)';
  };

  // Recent logs today
  const recentLogsToday = [...pomodoroSessions]
    .filter(s => getLocalDateStr(new Date(s.startTime)) === todayStr)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  return (
    <div className="glass-panel" style={{ height: '100%', overflowY: 'auto', padding: '2rem', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Dynamic Keyframes */}
      <style>{`
        @keyframes pulseGlow {
          0% { opacity: 0.4; transform: translate(-50%, -50%) scale(0.95); }
          100% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes ringBreathe {
          0% { transform: scale(1); filter: drop-shadow(0 0 8px ${getTimerThemeColor()}30); }
          100% { transform: scale(1.025); filter: drop-shadow(0 0 25px ${getTimerThemeColor()}80); }
        }
        @keyframes lofiPulse {
          0% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.1); opacity: 0.35; }
          100% { transform: scale(1); opacity: 0.15; }
        }
        @keyframes floatQuote {
          0% { opacity: 0; transform: translateY(10px); }
          5% { opacity: 1; transform: translateY(0); }
          95% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        .animate-quote {
          animation: floatQuote 15s infinite ease-in-out;
        }
        .breathing-ring {
          animation: ${pomoState === 'running' ? 'ringBreathe 3s infinite alternate ease-in-out' : 'none'};
        }
        .zen-ambient-background {
          background: radial-gradient(circle at center, ${
            pomoType === 'work' ? 'rgba(99,102,241,0.12)' : pomoType === 'shortBreak' ? 'rgba(6,182,212,0.12)' : 'rgba(16,185,129,0.12)'
          } 0%, rgba(5,6,10,0.95) 75%);
        }
      `}</style>

      {/* Dynamic Background Pulse Glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '650px',
        height: '650px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${
          pomoType === 'work' ? 'rgba(99, 102, 241, 0.08)' : pomoType === 'shortBreak' ? 'rgba(6, 182, 212, 0.08)' : 'rgba(16, 185, 129, 0.08)'
        } 0%, transparent 70%)`,
        filter: 'blur(70px)',
        zIndex: 0,
        pointerEvents: 'none',
        transition: 'background var(--transition-slow)',
        animation: pomoState === 'running' ? 'pulseGlow 4s infinite alternate ease-in-out' : 'none'
      }} />

      {/* 1. Header Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.625rem', borderRadius: '0.75rem', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <Timer size={22} className="text-gradient" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Focus Station</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Rethought Pomodoro dashboard with immersive Zen Mode.</p>
          </div>
        </div>

        {/* Fullscreen Zen Mode Trigger */}
        <button
          onClick={() => setIsZenMode(true)}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 1rem',
            fontSize: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
          title="Enter Fullscreen Zen Mode"
        >
          <Maximize2 size={13} />
          <span>Enter Zen Mode</span>
        </button>
      </div>

      {/* 2. Bento Stats Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
            <Clock size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>FOCUS TODAY</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{focusMinsToday} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 120m</span></span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--color-secondary-glow)', color: 'var(--color-secondary)' }}>
            <CheckSquare size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>BLOCKS MET</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{completedCountToday} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 4 target</span></span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--color-warning-glow)', color: 'var(--color-warning)' }}>
            <Flame size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>DAILY STREAK</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{focusStreak} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>days</span></span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--color-danger-glow)', color: 'var(--color-danger)' }}>
            <AlertCircle size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>DISTRACTIONS</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{totalDistractionsToday} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>logged</span></span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        
        {/* Left Side: Circular Timer & Controls */}
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.75rem', backdropFilter: 'var(--glass-blur)' }}>
          
          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', background: 'rgba(0,0,0,0.25)', padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            {(['work', 'shortBreak', 'longBreak'] as const).map(type => (
              <button
                key={type}
                onClick={() => handlePresetSelect(type)}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  background: pomoType === type ? 'var(--color-primary-glow)' : 'transparent',
                  border: '1px solid ' + (pomoType === type ? getTimerThemeColor() : 'transparent'),
                  color: pomoType === type ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {type === 'work' ? 'Focus' : type === 'shortBreak' ? 'Short Break' : 'Long Break'}
              </button>
            ))}
          </div>

          {/* Circular Progress Timer Display */}
          <div className="breathing-ring" style={{ 
            position: 'relative', 
            width: '230px', 
            height: '230px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'var(--bg-card-nested)',
            border: '1px solid var(--border-color)',
            transition: 'box-shadow var(--transition-normal)'
          }}>
            <svg width="220" height="220" viewBox="0 0 200 200" style={{ position: 'absolute' }}>
              <circle cx="100" cy="100" r="88" fill="none" stroke="var(--border-color)" strokeWidth="6" />
              <circle 
                cx="100" 
                cy="100" 
                r="88" 
                fill="none" 
                stroke={`url(#timerGrad-${pomoType})`} 
                strokeWidth="6" 
                strokeDasharray="552.9" 
                strokeDashoffset={552.9 - (pomoTimeLeft / pomoTotalDuration) * 552.9} 
                strokeLinecap="round" 
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
              <defs>
                <linearGradient id="timerGrad-work" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <linearGradient id="timerGrad-shortBreak" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="timerGrad-longBreak" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
            </svg>

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              zIndex: 1
            }}>
              <span style={{ 
                fontSize: '3.5rem', 
                fontWeight: 800, 
                fontFamily: 'var(--font-display)', 
                color: 'var(--text-primary)', 
                lineHeight: '1',
                letterSpacing: '-0.02em',
                textShadow: pomoState === 'running' ? '0 0 15px ' + getTimerThemeColor() + '60' : 'none'
              }}>
                {formatTime(pomoTimeLeft)}
              </span>
              <span style={{ 
                fontSize: '0.65rem', 
                fontWeight: 800, 
                color: getTimerThemeColor(), 
                letterSpacing: '0.18em', 
                marginTop: '0.625rem', 
                textTransform: 'uppercase' 
              }}>
                {pomoType === 'work' ? 'Focus Block' : pomoType === 'shortBreak' ? 'Short Break' : 'Long Break'}
              </span>
            </div>
          </div>

          {/* Timer Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%' }}>
            
            {pomoState === 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)' }}>
                <button onClick={() => adjustPomoDuration(-60)} style={{ padding: '0.3rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Minus size={13} /></button>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{Math.round(pomoTotalDuration / 60)} min</span>
                <button onClick={() => adjustPomoDuration(60)} style={{ padding: '0.3rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Plus size={13} /></button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {pomoState !== 'idle' && (
                <button 
                  onClick={handleReset} 
                  className="btn-secondary" 
                  style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s' 
                  }} 
                  title="Reset Session"
                >
                  <RotateCcw size={16} />
                </button>
              )}
              
              <button 
                onClick={startPausePomo} 
                className="btn-primary" 
                style={{ 
                  width: '68px', 
                  height: '68px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: pomoState === 'running' ? 'rgba(255, 255, 255, 0.08)' : 'var(--grad-primary)', 
                  border: pomoState === 'running' ? '1px solid var(--border-color)' : 'none', 
                  boxShadow: pomoState === 'running' ? 'none' : '0 6px 22px 0 rgba(99, 102, 241, 0.35)',
                  cursor: 'pointer',
                  transform: 'scale(1)',
                  transition: 'all 0.2s ease'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {pomoState === 'running' ? (
                  <Pause size={24} style={{ color: 'var(--text-primary)' }} />
                ) : (
                  <Play size={24} style={{ color: '#fff', marginLeft: '3px' }} />
                )}
              </button>

              {pomoState !== 'idle' && (
                <button 
                  onClick={skipPomo} 
                  className="btn-secondary" 
                  style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s' 
                  }} 
                  title="Skip Session"
                >
                  <SkipForward size={16} />
                </button>
              )}
            </div>

          </div>

          {/* Ambient Noise Widget */}
          <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem' }}>
              <Music size={14} style={{ color: 'var(--color-primary)' }} />
              Focus Ambience Soundscapes
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {AMBIENT_SOUNDS.map(sound => {
                const isActive = activeSoundId === sound.id;
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleAmbientSound(sound.id, sound.url)}
                    className="btn"
                    style={{
                      padding: '0.55rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.02)',
                      border: isActive ? '1px solid var(--border-active)' : '1px solid var(--border-color)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontWeight: isActive ? 600 : 500 }}>{sound.name}</span>
                    {isActive ? (
                      <Volume2 size={12} style={{ color: 'var(--color-primary)' }} />
                    ) : (
                      <VolumeX size={12} style={{ opacity: 0.3 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Side: Linked Tasks, Distraction Logs & Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Linked Tasks Card */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', backdropFilter: 'var(--glass-blur)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ListTodo size={15} style={{ color: 'var(--color-secondary)' }} />
                Target Tasks ({pomoSelectedTaskIds.length})
              </span>
              <button 
                onClick={() => setIsTaskSelectorOpen(true)}
                className="btn-primary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer' }}
              >
                Link Tasks
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
              {pomoSelectedTaskIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.1)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  No focus targets selected. Link tasks to check them off in focus state.
                </div>
              ) : (
                tasks.filter(t => pomoSelectedTaskIds.includes(t.id)).map(task => {
                  const isCompleted = task.status === 'completed';
                  return (
                    <div 
                      key={task.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '0.55rem 0.75rem', 
                        background: isCompleted ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.15)', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid ' + (isCompleted ? 'rgba(255,255,255,0.02)' : 'var(--border-color)'),
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', width: '75%' }}>
                        <button
                          onClick={() => onToggleTask(task.id, task.status)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            color: isCompleted ? 'var(--color-success)' : 'var(--text-muted)'
                          }}
                        >
                          {isCompleted ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          opacity: isCompleted ? 0.6 : 1
                        }}>
                          {task.title}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => toggleTaskSelection(task.id)}
                        className="btn-secondary"
                        style={{ padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer' }}
                      >
                        Unlink
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Distraction Quick Log Card */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <AlertCircle size={15} style={{ color: 'var(--color-danger)' }} />
              Distraction Log Jotter
            </span>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', margin: 0 }}>
              Jot down distracting thoughts to clear your mental bandwidth and review them after the block completes.
            </p>
            <form onSubmit={handleJotDistraction} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="text"
                value={distractionText}
                onChange={(e) => setDistractionText(e.target.value)}
                placeholder="E.g. check email, remember to buy coffee..."
                style={{
                  flex: 1,
                  fontSize: '0.75rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}
              >
                Log
              </button>
            </form>

            {/* List of active session distractions */}
            {pomoDistractions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Logged in Active Session ({pomoDistractions.length}):</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '100px', overflowY: 'auto' }} className="custom-scroll">
                  {pomoDistractions.map((dist, idx) => (
                    <div key={idx} style={{ fontSize: '0.725rem', color: 'var(--text-primary)', padding: '0.3rem 0.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: '4px' }}>
                      💭 {dist}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Preset Interval Tuning Sliders */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Compass size={15} style={{ color: 'var(--color-primary)' }} />
              Quick Intervals Config
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Focus Duration</span>
                  <span style={{ fontWeight: 700 }}>{workMin} mins</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={workMin}
                  onChange={(e) => handleSliderChange('work', Number(e.target.value))}
                  style={{ width: '100%', height: '4px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Short Break</span>
                  <span style={{ fontWeight: 700 }}>{shortMin} mins</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={shortMin}
                  onChange={(e) => handleSliderChange('short', Number(e.target.value))}
                  style={{ width: '100%', height: '4px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Long Break</span>
                  <span style={{ fontWeight: 700 }}>{longMin} mins</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={longMin}
                  onChange={(e) => handleSliderChange('long', Number(e.target.value))}
                  style={{ width: '100%', height: '4px', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Session History Log Card */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', backdropFilter: 'var(--glass-blur)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Today's Completed Blocks ({completedCountToday})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {recentLogsToday.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.1)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  No focus blocks completed today.
                </div>
              ) : (
                recentLogsToday.map(log => {
                  const isWork = log.type === 'work';
                  const timeLabel = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div 
                      key={log.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.65rem 0.85rem', 
                        background: 'rgba(0,0,0,0.1)', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid var(--border-color)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0, alignItems: 'center' }}>
                        <div style={{ 
                          padding: '0.35rem', 
                          borderRadius: '6px', 
                          background: isWork ? 'var(--color-primary-glow)' : 'var(--color-secondary-glow)',
                          color: isWork ? 'var(--color-primary)' : 'var(--color-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Timer size={13} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {isWork ? 'Focus Block' : 'Break Block'}
                          </span>
                          <span style={{ fontSize: '0.6', color: 'var(--text-muted)' }}>at {timeLabel}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isWork ? 'var(--color-primary)' : 'var(--color-secondary)' }}>{log.durationMinutes}m</span>
                        <button 
                          onClick={() => handleDeleteSessionLog(log.id)}
                          style={{ 
                            padding: '0.2rem', 
                            color: 'var(--text-muted)', 
                            cursor: 'pointer', 
                            background: 'none', 
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          title="Delete focus log"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Target Tasks Selection Modal */}
      {isTaskSelectorOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 100,
          background: 'rgba(5, 6, 10, 0.75)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '460px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckSquare size={18} style={{ color: 'var(--color-primary)' }} />
                Select Focus Targets
              </h3>
              <button 
                onClick={() => setIsTaskSelectorOpen(false)}
                className="btn-secondary"
                style={{ padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              Select tasks to map to this focus block. Link goals to track completion metrics cleanly.
            </p>

            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} style={{ left: '0.65rem', position: 'absolute', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search active tasks..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.5rem 0.45rem 2.2rem', borderRadius: 'var(--radius-sm)', width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px' }} className="custom-scroll">
              {filteredTasks.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  No active tasks found.
                </span>
              ) : (
                filteredTasks.map(task => {
                  const isSelected = pomoSelectedTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskSelection(task.id)}
                      style={{ 
                        fontSize: '0.8rem', 
                        padding: '0.55rem 0.75rem', 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: isSelected ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid ' + (isSelected ? 'var(--border-active)' : 'var(--border-color)'),
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      ) : (
                        <Square size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{task.title}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {pomoSelectedTaskIds.length} target{pomoSelectedTaskIds.length !== 1 ? 's' : ''} selected
              </span>
              <button 
                onClick={() => setIsTaskSelectorOpen(false)} 
                className="btn-primary" 
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              >
                Close Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Session Confirmation Modal */}
      {showPartialModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          zIndex: 100, 
          background: 'rgba(0, 0, 0, 0.65)', 
          backdropFilter: 'var(--glass-blur)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <div className="glass-panel" style={{ 
            width: '90%', 
            maxWidth: '360px', 
            padding: '1.5rem', 
            textAlign: 'center', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Save Focus Progress?</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              You focused for <strong>{partialSessionDuration} minute{partialSessionDuration !== 1 ? 's' : ''}</strong>. Save this focus block session log?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={handleDiscardPartial} className="btn-secondary" style={{ flex: 1, padding: '0.55rem', cursor: 'pointer' }}>Discard</button>
              <button onClick={handleSavePartial} className="btn-primary" style={{ flex: 1, padding: '0.55rem', cursor: 'pointer' }}>Save Log</button>
            </div>
          </div>
        </div>
      )}

      {/* Immersive Zen Mode Screen Overlay */}
      {isZenMode && (
        <div className="zen-ambient-background" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3rem 2rem',
          backdropFilter: 'blur(35px)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          
          {/* Zen Top Header */}
          <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Timer size={18} style={{ color: getTimerThemeColor() }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Zen Focus Station</span>
            </div>
            
            <button
              onClick={() => setIsZenMode(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
              title="Exit Zen Mode"
            >
              <Minimize2 size={16} />
            </button>
          </div>

          {/* Zen Center Timer Area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center' }}>
            
            {/* Visual Pulsing Breath Ring */}
            <div style={{
              position: 'relative',
              width: '280px',
              height: '280px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 70%)'
            }}>
              {/* Spinning background lofi wave */}
              {pomoState === 'running' && (
                <div style={{
                  position: 'absolute',
                  width: '320px',
                  height: '320px',
                  borderRadius: '50%',
                  border: `2px dashed ${getTimerThemeColor()}20`,
                  animation: 'rotateRing 20s infinite linear'
                }} />
              )}

              <svg width="260" height="260" viewBox="0 0 200 200" style={{ position: 'absolute' }}>
                <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.015)" strokeWidth="4" />
                <circle 
                  cx="100" 
                  cy="100" 
                  r="88" 
                  fill="none" 
                  stroke={`url(#zenGrad-${pomoType})`} 
                  strokeWidth="4" 
                  strokeDasharray="552.9" 
                  strokeDashoffset={552.9 - (pomoTimeLeft / pomoTotalDuration) * 552.9} 
                  strokeLinecap="round" 
                  transform="rotate(-90 100 100)"
                />
                <defs>
                  <linearGradient id="zenGrad-work" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#d946ef" />
                  </linearGradient>
                  <linearGradient id="zenGrad-shortBreak" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <linearGradient id="zenGrad-longBreak" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                <span style={{ 
                  fontSize: '5rem', 
                  fontWeight: 800, 
                  fontFamily: 'var(--font-display)', 
                  color: 'var(--text-primary)', 
                  lineHeight: '1',
                  letterSpacing: '-0.03em',
                  textShadow: pomoState === 'running' ? `0 0 35px ${getTimerThemeColor()}60` : 'none'
                }}>
                  {formatTime(pomoTimeLeft)}
                </span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  color: getTimerThemeColor(), 
                  letterSpacing: '0.22em', 
                  marginTop: '0.85rem', 
                  textTransform: 'uppercase' 
                }}>
                  {pomoType === 'work' ? 'Deep Focus' : 'Mindful Break'}
                </span>
              </div>
            </div>

            {/* Active Targets Indicator */}
            {pomoSelectedTaskIds.length > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                maxWidth: '450px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                🎯 Focus Target: {tasks.filter(t => pomoSelectedTaskIds.includes(t.id)).map(t => t.title).join(', ')}
              </div>
            )}

            {/* Calming quotes carousel */}
            <div style={{ minHeight: '40px', maxWidth: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem' }}>
              <p key={activeQuoteIdx} className="animate-quote" style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-secondary)', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                "{CALMING_QUOTES[activeQuoteIdx]}"
              </p>
            </div>

          </div>

          {/* Zen Bottom Action Controls */}
          <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            
            {/* Distraction Quick Log Field */}
            <form onSubmit={handleJotDistraction} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>JOT SUDDEN THOUGHT & CLEAR YOUR BRAIN</span>
              <div style={{ display: 'flex', width: '100%', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.5rem 0.35rem 1rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-full)' }}>
                <input
                  type="text"
                  value={distractionText}
                  onChange={(e) => setDistractionText(e.target.value)}
                  placeholder="Capture distracting thoughts here (e.g. pay bills, reply to chat...)"
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.8rem',
                    color: '#fff'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: getTimerThemeColor(),
                    border: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#fff'
                  }}
                >
                  <Send size={12} />
                </button>
              </div>
              {showDistractionSuccess && (
                <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 600 }}>Distraction captured! Back to focus.</span>
              )}
            </form>

            {/* Controls Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', gap: '1.75rem' }}>
              {pomoState !== 'idle' && (
                <button 
                  onClick={handleReset} 
                  style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  title="Reset Timer"
                >
                  <RotateCcw size={15} />
                </button>
              )}

              <button 
                onClick={startPausePomo} 
                style={{ width: '60px', height: '60px', borderRadius: '50%', background: getTimerThemeColor(), border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 25px ${getTimerThemeColor()}50` }}
              >
                {pomoState === 'running' ? (
                  <Pause size={22} style={{ color: '#fff' }} />
                ) : (
                  <Play size={22} style={{ color: '#fff', marginLeft: '3px' }} />
                )}
              </button>

              {pomoState !== 'idle' && (
                <button 
                  onClick={skipPomo} 
                  style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  title="Skip session"
                >
                  <SkipForward size={15} />
                </button>
              )}
            </div>

            {/* Quick ambient sound triggers in Zen Mode */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.01)', padding: '0.45rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.04)', width: '100%', justifyContent: 'space-around' }}>
              {AMBIENT_SOUNDS.map(sound => {
                const isActive = activeSoundId === sound.id;
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleAmbientSound(sound.id, sound.url)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.68rem',
                      borderRadius: '4px',
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: 'none',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span>{sound.name.split(' ')[0]}</span>
                    <span>{sound.name.split(' ').slice(1).join(' ')}</span>
                  </button>
                );
              })}
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
