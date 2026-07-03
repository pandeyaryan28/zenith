import React, { useState, useEffect, useRef } from 'react';
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
  FolderKanban,
  CheckSquare,
  Square,
  Timer,
  Volume2,
  VolumeX,
  Music,
  Check
} from 'lucide-react';
import { playNotificationSound, deletePomodoroSession } from '../services/pomodoroService';

interface PomodoroBoardProps {
  tasks: LocalTask[];
  activeListId: string;
  pomodoroSessions: PomodoroSession[];
  userId: string;
  onSavePomodoroSession: (sessionData: Omit<PomodoroSession, 'id' | 'userId'>) => Promise<void>;
  onToggleTask: (taskId: string, currentStatus: 'needsAction' | 'completed') => Promise<void>;
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
  onSavePomodoroSession,
  onToggleTask
}) => {
  // Read durations from localStorage or fall back to default settings
  const getPresetDuration = (type: 'work' | 'shortBreak' | 'longBreak') => {
    if (type === 'work') {
      return Number(localStorage.getItem('zenith-pomo-work') || '25') * 60;
    } else if (type === 'shortBreak') {
      return Number(localStorage.getItem('zenith-pomo-short') || '5') * 60;
    } else {
      return Number(localStorage.getItem('zenith-pomo-long') || '15') * 60;
    }
  };

  const [currentType, setCurrentType] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [totalDuration, setTotalDuration] = useState(() => getPresetDuration('work'));
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const [startTime, setStartTime] = useState<string | null>(null);

  // Task Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(false);

  // Partial session log
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialSessionDuration, setPartialSessionDuration] = useState(0);
  const [partialStartTime, setPartialStartTime] = useState<string | null>(null);

  // Ambient sound state
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  const audioRefs = useRef<{ [id: string]: HTMLAudioElement | null }>({});

  const timerIntervalRef = useRef<any>(null);

  // Sync timeLeft when changing page/preset while idle
  useEffect(() => {
    if (timerState === 'idle') {
      const dur = getPresetDuration(currentType);
      setTotalDuration(dur);
      setTimeLeft(dur);
    }
  }, [currentType, timerState]);

  // Clean up ambient audio on unmount
  useEffect(() => {
    return () => {
      Object.keys(audioRefs.current).forEach(id => {
        const audio = audioRefs.current[id];
        if (audio) {
          audio.pause();
          audioRefs.current[id] = null;
        }
      });
    };
  }, []);

  const handlePresetSelect = (type: typeof currentType) => {
    if (timerState !== 'idle') {
      const confirmChange = window.confirm("Are you sure you want to stop the active timer to switch presets?");
      if (!confirmChange) return;
    }

    stopInterval();
    setTimerState('idle');
    setCurrentType(type);
    const duration = getPresetDuration(type);
    setTotalDuration(duration);
    setTimeLeft(duration);
    setStartTime(null);
  };

  // Adjust duration by +/- 1 minute (while idle)
  const adjustDuration = (amount: number) => {
    if (timerState !== 'idle') return;
    const newDuration = Math.max(60, totalDuration + amount);
    setTotalDuration(newDuration);
    setTimeLeft(newDuration);
  };

  // Timer Tick effect
  useEffect(() => {
    if (timerState === 'running') {
      if (!startTime) {
        setStartTime(new Date().toISOString());
      }
      
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      stopInterval();
    }

    return () => stopInterval();
  }, [timerState]);

  const stopInterval = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const handleTimerComplete = async () => {
    stopInterval();
    setTimerState('idle');
    
    // Play sound if enabled in settings
    const soundEnabled = localStorage.getItem('zenith-sound-enabled') !== 'false';
    if (soundEnabled) {
      playNotificationSound();
    }

    const endStr = new Date().toISOString();
    const finalStartTime = startTime || new Date(Date.now() - totalDuration * 1000).toISOString();

    try {
      const durationMin = Math.round(totalDuration / 60);
      const selectedTasks = tasks.filter(t => selectedTaskIds.includes(t.id));
      const taskTitles = selectedTasks.map(t => t.title);

      await onSavePomodoroSession({
        startTime: finalStartTime,
        endTime: endStr,
        durationMinutes: durationMin,
        taskIds: selectedTaskIds,
        taskTitles,
        type: currentType,
        completed: true
      });
    } catch (err) {
      console.error(err);
    }

    if (currentType === 'work') {
      alert("Focus session complete! Time to take a break.");
      handlePresetSelect('shortBreak');
    } else {
      alert("Break complete! Ready to focus again?");
      handlePresetSelect('work');
    }
    setStartTime(null);
  };

  const handleStartPause = () => {
    if (timerState === 'running') {
      setTimerState('paused');
    } else {
      setTimerState('running');
    }
  };

  const handleReset = () => {
    if (timerState === 'idle') return;

    stopInterval();
    const timeSpentSeconds = totalDuration - timeLeft;
    if (timeSpentSeconds >= 60 && currentType === 'work') {
      setPartialSessionDuration(Math.round(timeSpentSeconds / 60));
      setPartialStartTime(startTime);
      setShowPartialModal(true);
    } else {
      setTimerState('idle');
      setTimeLeft(totalDuration);
      setStartTime(null);
    }
  };

  const handleSavePartial = async () => {
    if (!partialStartTime) return;
    try {
      const selectedTasks = tasks.filter(t => selectedTaskIds.includes(t.id));
      const taskTitles = selectedTasks.map(t => t.title);

      await onSavePomodoroSession({
        startTime: partialStartTime,
        endTime: new Date().toISOString(),
        durationMinutes: partialSessionDuration,
        taskIds: selectedTaskIds,
        taskTitles,
        type: currentType,
        completed: false
      });
    } catch (err) {
      console.error(err);
    } finally {
      setShowPartialModal(false);
      setTimerState('idle');
      setTimeLeft(totalDuration);
      setStartTime(null);
    }
  };

  const handleDiscardPartial = () => {
    setShowPartialModal(false);
    setTimerState('idle');
    setTimeLeft(totalDuration);
    setStartTime(null);
  };

  const handleSkip = () => {
    const confirmSkip = window.confirm("Do you want to skip this session?");
    if (!confirmSkip) return;

    stopInterval();
    setTimerState('idle');
    setStartTime(null);
    if (currentType === 'work') {
      handlePresetSelect('shortBreak');
    } else {
      handlePresetSelect('work');
    }
  };

  // Ambient sound toggle
  const toggleAmbientSound = (soundId: string, url: string) => {
    if (activeSoundId === soundId) {
      // Pause
      const audio = audioRefs.current[soundId];
      if (audio) audio.pause();
      setActiveSoundId(null);
    } else {
      // Pause active if exists
      if (activeSoundId) {
        const prev = audioRefs.current[activeSoundId];
        if (prev) prev.pause();
      }
      
      // Play new
      let audio = audioRefs.current[soundId];
      if (!audio) {
        audio = new Audio(url);
        audio.loop = true;
        audioRefs.current[soundId] = audio;
      }
      setActiveSoundId(soundId);
      audio.play().catch(e => {
        console.error("Audio playback blocked by browser settings.", e);
        setActiveSoundId(null);
      });
    }
  };

  // Task checking list
  const activeTasks = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted);
  const filteredTasks = activeTasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId) 
        : [...prev, taskId]
    );
  };

  const handleTaskCompleteDirectly = async (taskId: string) => {
    try {
      await onToggleTask(taskId, 'needsAction'); // completes it
      // Remove from selected list
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
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

  // SVG dash offset
  const strokeDashoffset = 534 - (timeLeft / totalDuration) * 534;

  // Recent logs (last 5)
  const recentLogs = [...pomodoroSessions]
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 5);

  return (
    <div className="glass-panel" style={{ height: '100%', overflowY: 'auto', padding: '2rem' }}>
      
      {/* 1. Header Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', padding: '0.625rem', borderRadius: '0.75rem', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <Timer size={22} className="text-gradient" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Focus Station</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Immersive Pomodoro timer with ambient sounds.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Left Side: Circular Timer & Controls */}
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          
          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
            {(['work', 'shortBreak', 'longBreak'] as const).map(type => (
              <button
                key={type}
                onClick={() => handlePresetSelect(type)}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  background: currentType === type ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: '1px solid ' + (currentType === type ? getTimerThemeColor() : 'transparent'),
                  color: currentType === type ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {type === 'work' ? 'Focus' : type === 'shortBreak' ? 'Short Break' : 'Long Break'}
              </button>
            ))}
          </div>

          {/* Circular Progress Timer Display */}
          <div style={{ 
            position: 'relative', 
            width: '220px', 
            height: '220px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-color)',
            boxShadow: timerState === 'running' ? '0 0 20px ' + getTimerThemeColor() + '20' : 'none'
          }}>
            <svg width="210" height="210" viewBox="0 0 200 200" style={{ position: 'absolute' }}>
              <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="6" />
              <circle 
                cx="100" 
                cy="100" 
                r="85" 
                fill="none" 
                stroke={getTimerThemeColor()} 
                strokeWidth="6" 
                strokeDasharray="534" 
                strokeDashoffset={strokeDashoffset} 
                strokeLinecap="round" 
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
            </svg>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
              <span style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: '1' }}>
                {formatTime(timeLeft)}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: getTimerThemeColor(), letterSpacing: '0.15em', marginTop: '0.5rem', textTransform: 'uppercase' }}>
                {currentType === 'work' ? 'Focus Block' : 'Interval'}
              </span>
            </div>
          </div>

          {/* Timer Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
            
            {timerState === 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)' }}>
                <button onClick={() => adjustDuration(-60)} style={{ padding: '0.3rem', color: 'var(--text-muted)', cursor: 'pointer' }}><Minus size={14} /></button>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{Math.round(totalDuration / 60)} min</span>
                <button onClick={() => adjustDuration(60)} style={{ padding: '0.3rem', color: 'var(--text-muted)', cursor: 'pointer' }}><Plus size={14} /></button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              {timerState !== 'idle' && (
                <button onClick={handleReset} className="btn-secondary" style={{ padding: '0.75rem', borderRadius: '50%' }} title="Reset"><RotateCcw size={18} /></button>
              )}
              
              <button 
                onClick={handleStartPause} 
                className="btn-primary" 
                style={{ padding: '1rem', borderRadius: '50%', background: timerState === 'running' ? 'rgba(255, 255, 255, 0.08)' : 'var(--grad-primary)', border: timerState === 'running' ? '1px solid var(--border-color)' : 'none', boxShadow: timerState === 'running' ? 'none' : '0 4px 14px 0 rgba(99, 102, 241, 0.3)' }}
              >
                {timerState === 'running' ? <Pause size={24} style={{ color: 'var(--text-primary)' }} /> : <Play size={24} style={{ color: '#fff' }} />}
              </button>

              {timerState !== 'idle' && (
                <button onClick={handleSkip} className="btn-secondary" style={{ padding: '0.75rem', borderRadius: '50%' }} title="Skip"><SkipForward size={18} /></button>
              )}
            </div>

          </div>

          {/* Ambient Noise Widget */}
          <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <Music size={14} style={{ color: 'var(--color-primary)' }} />
              Focus Ambience Soundscapes
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {AMBIENT_SOUNDS.map(sound => {
                const isActive = activeSoundId === sound.id;
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleAmbientSound(sound.id, sound.url)}
                    className="btn"
                    style={{
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.02)',
                      border: isActive ? '1px solid var(--border-active)' : '1px solid var(--border-color)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{sound.name}</span>
                    {isActive ? <Volume2 size={12} style={{ color: 'var(--color-primary)' }} /> : <VolumeX size={12} style={{ opacity: 0.3 }} />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Side: Linked Tasks & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Linked Tasks Card */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FolderKanban size={14} style={{ color: 'var(--color-secondary)' }} />
              Target Tasks ({selectedTaskIds.length} linked)
            </span>

            {/* Selector Dropdown button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsTaskSelectorOpen(!isTaskSelectorOpen)}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.625rem 0.85rem', background: 'rgba(0,0,0,0.15)' }}
              >
                <span>Select tasks to focus on...</span>
                <span>▼</span>
              </button>

              {isTaskSelectorOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, width: '100%', maxHeight: '180px', background: 'rgba(15, 18, 30, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', zIndex: 10, display: 'flex', flexDirection: 'column', marginBottom: '6px', padding: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <Search size={12} />
                    <input 
                      type="text" 
                      placeholder="Search active tasks..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontSize: '0.75rem', width: '100%', height: 'auto', padding: '0.2rem 0' }}
                    />
                  </div>
                  <div className="custom-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {filteredTasks.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>No active tasks.</span>
                    ) : (
                      filteredTasks.map(task => {
                        const isSelected = selectedTaskIds.includes(task.id);
                        return (
                          <button
                            key={task.id}
                            onClick={() => toggleTaskSelection(task.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem', borderRadius: '4px', background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'left', width: '100%', cursor: 'pointer' }}
                          >
                            {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Checklist of linked tasks with complete direct button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {selectedTaskIds.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  No tasks linked. Choose tasks to track completion during this focus period.
                </span>
              ) : (
                tasks.filter(t => selectedTaskIds.includes(t.id)).map(task => (
                  <div 
                    key={task.id} 
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                      {task.title}
                    </span>
                    <button
                      onClick={() => handleTaskCompleteDirectly(task.id)}
                      className="btn"
                      style={{ padding: '0.2rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--color-success)', borderRadius: '4px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      title="Check off task"
                    >
                      <Check size={10} /> Done
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>

          {/* Session History Log Card */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Recent Focus Blocks
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentLogs.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>No focus blocks completed.</span>
              ) : (
                recentLogs.map(log => {
                  const isWork = log.type === 'work';
                  const dateLabel = new Date(log.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const timeLabel = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div 
                      key={log.id} 
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '0.1rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {isWork ? '💻 Focus block' : '☕ Break session'}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{dateLabel} at {timeLabel}</span>
                        {log.taskTitles && log.taskTitles.length > 0 && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                            Tasks: {log.taskTitles.join(', ')}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{log.durationMinutes}m</span>
                        <button 
                          onClick={() => handleDeleteSessionLog(log.id)}
                          style={{ padding: '0.2rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                          title="Delete log entry"
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

      {/* Partial session modal */}
      {showPartialModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 100, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'var(--glass-blur)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '360px', padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Save Focus Progress?</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              You focused for <strong>{partialSessionDuration} minute{partialSessionDuration !== 1 ? 's' : ''}</strong>. Would you like to log this partial focus session?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={handleDiscardPartial} className="btn-secondary" style={{ flex: 1, padding: '0.5rem' }}>Discard</button>
              <button onClick={handleSavePartial} className="btn-primary" style={{ flex: 1, padding: '0.5rem' }}>Save Log</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
