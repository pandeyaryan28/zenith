import React, { useState } from 'react';
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
  X
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
}

const AMBIENT_SOUNDS = [
  { id: 'rain', name: '🌧️ Heavy Rain', url: 'https://www.soundjay.com/nature/sounds/rain-07.mp3' },
  { id: 'ocean', name: '🌊 Ocean Waves', url: 'https://www.soundjay.com/nature/sounds/ocean-wave-1.mp3' },
  { id: 'white', name: '🤫 White Noise', url: 'https://www.soundjay.com/misc/sounds/fume-extractor-1.mp3' },
  { id: 'lofi', name: '🎵 Focus Lofi', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' }
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
  handleDiscardPartialSession
}) => {
  // Local state for task search & selector popup
  const [searchQuery, setSearchQuery] = useState('');
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(false);

  // Local state for partial focus sessions confirmation modal
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialSessionDuration, setPartialSessionDuration] = useState(0);
  const [partialStartTime, setPartialStartTime] = useState<string | null>(null);

  // Aliases for compatibility with the existing TSX rendering code
  const currentType = pomoType;
  const timerState = pomoState;
  const timeLeft = pomoTimeLeft;
  const totalDuration = pomoTotalDuration;
  const selectedTaskIds = pomoSelectedTaskIds;
  
  const handleStartPause = startPausePomo;
  const handleSkip = skipPomo;
  const adjustDuration = adjustPomoDuration;

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

  // Task checking list helpers
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

  // Formatting helper
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const getTimerThemeColor = () => {
    if (currentType === 'work') return 'var(--color-primary)';
    if (currentType === 'shortBreak') return 'var(--color-secondary)';
    return 'var(--color-success)';
  };

  // Recent logs (last 5)
  const recentLogs = [...pomodoroSessions]
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 5);

  return (
    <div className="glass-panel" style={{ height: '100%', overflowY: 'auto', padding: '2rem', position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @keyframes pulseGlow {
          0% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.95); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes breathe {
          0% { transform: scale(1); }
          100% { transform: scale(1.03); }
        }
        @keyframes rotateRing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Dynamic Background Pulse Glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '700px',
        height: '700px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${
          currentType === 'work' ? 'rgba(239, 68, 68, 0.07)' : currentType === 'shortBreak' ? 'rgba(16, 185, 129, 0.07)' : 'rgba(99, 102, 241, 0.07)'
        } 0%, transparent 70%)`,
        filter: 'blur(60px)',
        zIndex: 0,
        pointerEvents: 'none',
        transition: 'background var(--transition-slow)',
        animation: timerState === 'running' ? 'pulseGlow 4s infinite alternate ease-in-out' : 'none'
      }} />

      {/* 1. Header Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-flex', padding: '0.625rem', borderRadius: '0.75rem', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <Timer size={22} className="text-gradient" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Focus Station</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Immersive Pomodoro timer with ambient sounds.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        
        {/* Left Side: Circular Timer & Controls */}
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', backdropFilter: 'var(--glass-blur)' }}>
          
          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '0.3rem', borderRadius: 'var(--radius-sm)' }}>
            {(['work', 'shortBreak', 'longBreak'] as const).map(type => (
              <button
                key={type}
                onClick={() => handlePresetSelect(type)}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: currentType === type ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: '1px solid ' + (currentType === type ? getTimerThemeColor() : 'transparent'),
                  color: currentType === type ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {type === 'work' ? 'Focus' : type === 'shortBreak' ? 'Short Break' : 'Long Break'}
              </button>
            ))}
          </div>

          {/* Circular Progress Timer Display */}
          <div style={{ 
            position: 'relative', 
            width: '240px', 
            height: '240px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'var(--bg-card-nested)',
            border: '1px solid var(--border-color)',
            boxShadow: timerState === 'running' ? '0 0 35px ' + getTimerThemeColor() + '18' : 'none',
            transition: 'box-shadow var(--transition-normal)'
          }}>
            <svg width="230" height="230" viewBox="0 0 200 200" style={{ position: 'absolute' }}>
              <circle cx="100" cy="100" r="88" fill="none" stroke="var(--border-color)" strokeWidth="5" />
              <circle 
                cx="100" 
                cy="100" 
                r="88" 
                fill="none" 
                stroke={`url(#timerGrad-${currentType})`} 
                strokeWidth="5" 
                strokeDasharray="552.9" 
                strokeDashoffset={552.9 - (timeLeft / totalDuration) * 552.9} 
                strokeLinecap="round" 
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
              <defs>
                <linearGradient id="timerGrad-work" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <linearGradient id="timerGrad-shortBreak" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="timerGrad-longBreak" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              zIndex: 1,
              animation: timerState === 'running' ? 'breathe 2s infinite alternate ease-in-out' : 'none'
            }}>
              <span style={{ 
                fontSize: '3.5rem', 
                fontWeight: 800, 
                fontFamily: 'var(--font-display)', 
                color: 'var(--text-primary)', 
                lineHeight: '1',
                letterSpacing: '-0.02em',
                textShadow: timerState === 'running' ? '0 0 10px ' + getTimerThemeColor() + '40' : 'none'
              }}>
                {formatTime(timeLeft)}
              </span>
              <span style={{ 
                fontSize: '0.7rem', 
                fontWeight: 700, 
                color: getTimerThemeColor(), 
                letterSpacing: '0.18em', 
                marginTop: '0.625rem', 
                textTransform: 'uppercase' 
              }}>
                {currentType === 'work' ? 'Focus Mode' : currentType === 'shortBreak' ? 'Short Break' : 'Long Break'}
              </span>
            </div>
          </div>

          {/* Timer Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%' }}>
            
            {timerState === 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.3rem 0.625rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)' }}>
                <button onClick={() => adjustDuration(-60)} style={{ padding: '0.3rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Minus size={13} /></button>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{Math.round(totalDuration / 60)} min</span>
                <button onClick={() => adjustDuration(60)} style={{ padding: '0.3rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Plus size={13} /></button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {timerState !== 'idle' && (
                <button 
                  onClick={handleReset} 
                  className="btn-secondary" 
                  style={{ 
                    width: '42px', 
                    height: '42px', 
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
                onClick={handleStartPause} 
                className="btn-primary" 
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: timerState === 'running' ? 'rgba(255, 255, 255, 0.08)' : 'var(--grad-primary)', 
                  border: timerState === 'running' ? '1px solid var(--border-color)' : 'none', 
                  boxShadow: timerState === 'running' ? 'none' : '0 6px 20px 0 rgba(99, 102, 241, 0.35)',
                  cursor: 'pointer',
                  transform: 'scale(1)',
                  transition: 'all 0.2s ease'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {timerState === 'running' ? (
                  <Pause size={24} style={{ color: 'var(--text-primary)' }} />
                ) : (
                  <Play size={24} style={{ color: '#fff', marginLeft: '3px' }} />
                )}
              </button>

              {timerState !== 'idle' && (
                <button 
                  onClick={handleSkip} 
                  className="btn-secondary" 
                  style={{ 
                    width: '42px', 
                    height: '42px', 
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
          <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem' }}>
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
                      padding: '0.625rem 0.85rem',
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
                      <Volume2 size={12} style={{ color: 'var(--color-primary)', animation: 'rotateRing 2s infinite linear' }} />
                    ) : (
                      <VolumeX size={12} style={{ opacity: 0.3 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Side: Linked Tasks & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Linked Tasks Card */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', backdropFilter: 'var(--glass-blur)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ListTodo size={15} style={{ color: 'var(--color-secondary)' }} />
                Target Tasks ({selectedTaskIds.length})
              </span>
              <button 
                onClick={() => setIsTaskSelectorOpen(true)}
                className="btn-primary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer' }}
              >
                Link Tasks
              </button>
            </div>

            {/* Checklist of linked tasks with complete direct button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {selectedTaskIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.1)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  No tasks linked. Choose focus targets to track completion during this focus period.
                </div>
              ) : (
                tasks.filter(t => selectedTaskIds.includes(t.id)).map(task => {
                  const isCompleted = task.status === 'completed';
                  return (
                    <div 
                      key={task.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '0.625rem 0.85rem', 
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
                        onClick={() => setPomoSelectedTaskIds(prev => prev.filter(id => id !== task.id))}
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

          {/* Session History Log Card */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', backdropFilter: 'var(--glass-blur)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Recent Focus Blocks
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {recentLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.1)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  No focus blocks completed.
                </div>
              ) : (
                recentLogs.map(log => {
                  const isWork = log.type === 'work';
                  const dateLabel = new Date(log.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const timeLabel = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div 
                      key={log.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.75rem 1rem', 
                        background: 'rgba(0,0,0,0.1)', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid var(--border-color)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0, alignItems: 'flex-start' }}>
                        <div style={{ 
                          padding: '0.4rem', 
                          borderRadius: '8px', 
                          background: isWork ? 'var(--color-primary-glow)' : 'var(--color-secondary-glow)',
                          color: isWork ? 'var(--color-primary)' : 'var(--color-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Timer size={14} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '0.1rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isWork ? '💻 Focus Session' : '☕ Break Session'}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{dateLabel} at {timeLabel}</span>
                          {log.taskTitles && log.taskTitles.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                              {log.taskTitles.map((title, idx) => (
                                <span key={idx} style={{ fontSize: '0.6rem', color: 'var(--color-secondary)', background: 'var(--color-secondary-glow)', padding: '0.05rem 0.35rem', borderRadius: '4px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  🎯 {title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isWork ? 'var(--color-primary)' : 'var(--color-secondary)' }}>{log.durationMinutes}m</span>
                        <button 
                          onClick={() => handleDeleteSessionLog(log.id)}
                          style={{ 
                            padding: '0.3rem', 
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
                          title="Delete log entry"
                        >
                          <Trash2 size={13} />
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
          alignItems: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '480px',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
              Choose which tasks you want to associate with your active focus session. You can check them off directly from the Focus Station when finished!
            </p>

            <div className="global-search-container" style={{ height: '36px', width: '100%', marginBottom: 0, position: 'relative' }}>
              <Search size={14} className="global-search-icon" style={{ left: '0.625rem', position: 'absolute', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search active tasks..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                className="global-search-input"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.5rem 0.45rem 2.2rem', borderRadius: 'var(--radius-sm)', width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              {searchQuery && (
                <button className="global-search-clear-btn" style={{ right: '0.625rem', position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSearchQuery('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="custom-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '220px', paddingRight: '0.2rem' }}>
              {filteredTasks.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                  No active tasks found.
                </span>
              ) : (
                filteredTasks.map(task => {
                  const isSelected = selectedTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskSelection(task.id)}
                      className={`global-search-result-item ${isSelected ? 'active' : ''}`}
                      style={{ 
                        fontSize: '0.8rem', 
                        padding: '0.6rem 0.75rem', 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        background: isSelected ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid ' + (isSelected ? 'var(--border-active)' : 'var(--border-color)'),
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', width: '75%' }}>
                        {isSelected ? (
                          <CheckSquare size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                        ) : (
                          <Square size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{task.title}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {selectedTaskIds.length} target{selectedTaskIds.length !== 1 ? 's' : ''} selected
              </span>
              <button 
                onClick={() => setIsTaskSelectorOpen(false)} 
                className="btn-primary" 
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              >
                Save Selection
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
          background: 'rgba(0, 0, 0, 0.6)', 
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
            boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Save Focus Progress?</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              You focused for <strong>{partialSessionDuration} minute{partialSessionDuration !== 1 ? 's' : ''}</strong>. Would you like to log this partial focus session?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={handleDiscardPartial} className="btn-secondary" style={{ flex: 1, padding: '0.5rem', cursor: 'pointer' }}>Discard</button>
              <button onClick={handleSavePartial} className="btn-primary" style={{ flex: 1, padding: '0.5rem', cursor: 'pointer' }}>Save Log</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
