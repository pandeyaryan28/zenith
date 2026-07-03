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
  TrendingUp, 
  Plus, 
  Minus, 
  FolderKanban,
  CheckSquare,
  Square,
  Timer
} from 'lucide-react';
import { playNotificationSound, deletePomodoroSession } from '../services/pomodoroService';

interface PomodoroBoardProps {
  tasks: LocalTask[];
  activeListId: string;
  pomodoroSessions: PomodoroSession[];
  onSavePomodoroSession: (sessionData: Omit<PomodoroSession, 'id' | 'userId'>) => Promise<void>;
}

export const PomodoroBoard: React.FC<PomodoroBoardProps> = ({
  tasks,
  activeListId,
  pomodoroSessions,
  onSavePomodoroSession
}) => {
  // Navigation: 'timer' | 'analytics'
  const [boardMode, setBoardMode] = useState<'timer' | 'analytics'>('timer');

  // Timer Configuration
  const [currentType, setCurrentType] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  
  // Durations (in seconds)
  const getPresetDuration = (type: typeof currentType) => {
    switch (type) {
      case 'work': return 25 * 60;
      case 'shortBreak': return 5 * 60;
      case 'longBreak': return 15 * 60;
    }
  };

  const [totalDuration, setTotalDuration] = useState(getPresetDuration('work'));
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const [startTime, setStartTime] = useState<string | null>(null);
  
  // Task Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(false);

  // Partial Session Log Modal
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialSessionDuration, setPartialSessionDuration] = useState(0); // in minutes
  const [partialStartTime, setPartialStartTime] = useState<string | null>(null);

  // Timer interval ref
  const timerIntervalRef = useRef<any>(null);

  // Synchronize time left when presets or duration changes (while idle)
  useEffect(() => {
    if (timerState === 'idle') {
      setTimeLeft(totalDuration);
    }
  }, [totalDuration, timerState]);

  // Handle changes in preset type
  const handlePresetSelect = (type: typeof currentType) => {
    if (timerState !== 'idle') {
      const confirmChange = window.confirm("Are you sure you want to stop the active timer to switch presets?");
      if (!confirmChange) return;
    }
    
    // Reset timer
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
  };

  // Timer tick effect
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

  // Play chimes and save session
  const handleTimerComplete = async () => {
    stopInterval();
    setTimerState('idle');
    playNotificationSound();
    
    const endStr = new Date().toISOString();
    const finalStartTime = startTime || new Date(Date.now() - totalDuration * 1000).toISOString();
    
    // Save to Firestore
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

    // Propose break or work based on what finished
    if (currentType === 'work') {
      alert("Focus session complete! Time to take a well-deserved break.");
      handlePresetSelect('shortBreak');
    } else {
      alert("Break complete! Ready to get back to focus?");
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

  // Abort/Reset timer
  const handleReset = () => {
    if (timerState === 'idle') return;
    
    stopInterval();
    
    // Calculate spent time
    const timeSpentSeconds = totalDuration - timeLeft;
    if (timeSpentSeconds >= 60 && currentType === 'work') {
      // Prompt to log partial focus time
      setPartialSessionDuration(Math.round(timeSpentSeconds / 60));
      setPartialStartTime(startTime);
      setShowPartialModal(true);
    } else {
      // Just reset silently
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
        completed: false // marked as incomplete focus
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

  // Skip timer
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

  // Task selection logic
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

  // Date utilities
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // =========================================================================
  // Analytics computations
  // =========================================================================
  
  // Total work sessions & focus minutes
  const totalCompletedPomos = pomodoroSessions.filter(s => s.completed && s.type === 'work');
  const totalFocusMinutes = totalCompletedPomos.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Focus time today calculations not needed here as they are shown in the sidebar

  // Focus time this week (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return getLocalDateStr(d);
  }).reverse();

  const dailyFocusData = last7Days.map(dateStr => {
    const daySessions = pomodoroSessions.filter(s => {
      if (!s.completed || s.type !== 'work') return false;
      return getLocalDateStr(new Date(s.startTime)) === dateStr;
    });
    const mins = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    
    // Label as short weekday
    const dateObj = new Date(dateStr + 'T00:00:00');
    const label = dateObj.toLocaleDateString([], { weekday: 'short' });
    return { dateStr, label, minutes: mins };
  });

  // Task distribution
  const taskMinutesMap: { [title: string]: { minutes: number; count: number } } = {};
  pomodoroSessions.forEach(s => {
    if (s.type !== 'work') return;
    const duration = s.durationMinutes;
    if (s.taskTitles && s.taskTitles.length > 0) {
      s.taskTitles.forEach(title => {
        if (!taskMinutesMap[title]) {
          taskMinutesMap[title] = { minutes: 0, count: 0 };
        }
        // If multiple tasks are linked to one session, attribute the focus time to each
        taskMinutesMap[title].minutes += duration;
        taskMinutesMap[title].count += 1;
      });
    } else {
      const defaultTitle = "Unlinked Focus";
      if (!taskMinutesMap[defaultTitle]) {
        taskMinutesMap[defaultTitle] = { minutes: 0, count: 0 };
      }
      taskMinutesMap[defaultTitle].minutes += duration;
      taskMinutesMap[defaultTitle].count += 1;
    }
  });

  const taskBreakdown = Object.keys(taskMinutesMap)
    .map(title => ({
      title,
      minutes: taskMinutesMap[title].minutes,
      count: taskMinutesMap[title].count
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const maxTaskMinutes = taskBreakdown.length > 0 ? Math.max(...taskBreakdown.map(t => t.minutes)) : 1;

  // Recent focus logs (last 5 work/break sessions)
  const recentLogs = [...pomodoroSessions]
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 5);

  const handleDeleteSessionLog = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this session log?")) {
      try {
        const user = pomodoroSessions.find(s => s.id === id)?.userId;
        if (user) {
          await deletePomodoroSession(user, id);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Helper formatting seconds -> MM:SS
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Circular timer geometry calculations
  const progressPercent = (timeLeft / totalDuration) * 100;
  const strokeDashoffset = 534 - (534 * progressPercent) / 100;

  // Determine theme colors based on mode (work vs breaks)
  const getTimerThemeColor = () => {
    if (currentType === 'work') return 'var(--color-primary)';
    return 'var(--color-secondary)';
  };

  const getTimerGlowStyle = () => {
    if (currentType === 'work') {
      return { boxShadow: '0 0 30px rgba(99, 102, 241, 0.25)', border: '1px solid rgba(99, 102, 241, 0.2)' };
    }
    return { boxShadow: '0 0 30px rgba(6, 182, 212, 0.25)', border: '1px solid rgba(6, 182, 212, 0.2)' };
  };

  return (
    <div className="glass-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', overflow: 'hidden' }}>
      
      {/* 1. Dashboard Sub-Tab Selector */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Timer size={18} style={{ color: getTimerThemeColor() }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Pomodoro Timer</h2>
        </div>
        
        {/* Toggle Pill */}
        <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.2)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setBoardMode('timer')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: boardMode === 'timer' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              color: boardMode === 'timer' ? 'var(--text-primary)' : 'var(--text-muted)'
            }}
          >
            Timer
          </button>
          <button
            onClick={() => setBoardMode('analytics')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: boardMode === 'analytics' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              color: boardMode === 'analytics' ? 'var(--text-primary)' : 'var(--text-muted)'
            }}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* 2. Sub-Tab Panels */}
      <div className="custom-scroll" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {boardMode === 'timer' ? (
          /* =========================================================================
             TIMER MODE
             ========================================================================= */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.75rem', padding: '0.5rem 0' }}>
            
            {/* Preset Selector Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
              {(['work', 'shortBreak', 'longBreak'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handlePresetSelect(type)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: currentType === type ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: '1px solid ' + (currentType === type ? getTimerThemeColor() : 'var(--border-color)'),
                    color: currentType === type ? 'var(--text-primary)' : 'var(--text-muted)'
                  }}
                >
                  {type === 'work' ? 'Focus' : type === 'shortBreak' ? 'Short Break' : 'Long Break'}
                </button>
              ))}
            </div>

            {/* Circular Progress Timer Display */}
            <div 
              style={{
                position: 'relative',
                width: '210px',
                height: '210px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.25)',
                transition: 'all var(--transition-normal)',
                ...getTimerGlowStyle()
              }}
            >
              {/* SVG Ring */}
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute' }}>
                <circle 
                  cx="100" 
                  cy="100" 
                  r="85" 
                  fill="none" 
                  stroke="rgba(255,255,255,0.02)" 
                  strokeWidth="6" 
                />
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

              {/* Central Time Indicators */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                <span 
                  style={{ 
                    fontSize: '2.5rem', 
                    fontWeight: 700, 
                    fontFamily: 'var(--font-display)', 
                    letterSpacing: '-0.02em', 
                    color: 'var(--text-primary)',
                    lineHeight: '1'
                  }}
                >
                  {formatTime(timeLeft)}
                </span>
                <span 
                  style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 600, 
                    color: getTimerThemeColor(),
                    letterSpacing: '0.15em',
                    marginTop: '0.35rem',
                    textTransform: 'uppercase'
                  }}
                >
                  {currentType === 'work' ? 'Focusing' : 'On Break'}
                </span>
              </div>
            </div>

            {/* Time Adjusters & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%' }}>
              
              {/* Manual adjusters (+/- 1m, only active when timer is idle) */}
              {timerState === 'idle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.25rem 0.5rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => adjustDuration(-60)}
                    style={{ padding: '0.3rem', borderRadius: '50%', color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {Math.round(totalDuration / 60)} min
                  </span>
                  <button 
                    onClick={() => adjustDuration(60)}
                    style={{ padding: '0.3rem', borderRadius: '50%', color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}

              {/* Main Play, Pause, Reset, Skip Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {timerState !== 'idle' && (
                  <button 
                    onClick={handleReset}
                    className="btn-secondary"
                    style={{ padding: '0.75rem', borderRadius: '50%' }}
                    title="Stop and Reset"
                  >
                    <RotateCcw size={18} />
                  </button>
                )}

                <button 
                  onClick={handleStartPause}
                  className="btn-primary" 
                  style={{ 
                    padding: '1rem', 
                    borderRadius: '50%',
                    background: timerState === 'running' ? 'rgba(255, 255, 255, 0.08)' : 'var(--grad-primary)',
                    border: timerState === 'running' ? '1px solid var(--border-color)' : 'none',
                    boxShadow: timerState === 'running' ? 'none' : '0 4px 14px 0 rgba(99, 102, 241, 0.3)'
                  }}
                  title={timerState === 'running' ? 'Pause' : 'Start'}
                >
                  {timerState === 'running' ? <Pause size={24} style={{ color: 'var(--text-primary)' }} /> : <Play size={24} style={{ color: 'var(--text-primary)' }} />}
                </button>

                {timerState !== 'idle' && (
                  <button 
                    onClick={handleSkip}
                    className="btn-secondary"
                    style={{ padding: '0.75rem', borderRadius: '50%' }}
                    title="Skip session"
                  >
                    <SkipForward size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* =========================================================================
               Task Linker Selector
               ========================================================================= */}
            <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Link Tasks to Session
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {selectedTaskIds.length} task(s) linked
                </span>
              </div>

              {/* Dropdown Container */}
              <div style={{ position: 'relative', width: '100%' }}>
                <button
                  onClick={() => setIsTaskSelectorOpen(!isTaskSelectorOpen)}
                  className="btn-secondary"
                  style={{ 
                    width: '100%', 
                    justifyContent: 'space-between', 
                    fontSize: '0.8rem',
                    padding: '0.625rem 0.85rem',
                    background: 'rgba(0,0,0,0.15)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <FolderKanban size={14} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedTaskIds.length === 0 
                        ? "Select tasks to focus on..." 
                        : `${selectedTaskIds.length} tasks selected`
                      }
                    </span>
                  </div>
                  <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
                </button>

                {/* Dropdown overlay */}
                {isTaskSelectorOpen && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      width: '100%',
                      maxHeight: '190px',
                      background: 'rgba(15, 18, 30, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      marginBottom: '6px',
                      padding: '0.5rem'
                    }}
                  >
                    {/* Search Field */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                      <Search size={12} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Search active tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'transparent', padding: '0.2rem 0', fontSize: '0.75rem', height: 'auto', width: '100%' }}
                      />
                    </div>

                    {/* Options list */}
                    <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
                      {filteredTasks.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          No active tasks found.
                        </div>
                      ) : (
                        filteredTasks.map(task => {
                          const isSelected = selectedTaskIds.includes(task.id);
                          return (
                            <button
                              key={task.id}
                              onClick={() => toggleTaskSelection(task.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.4rem 0.5rem',
                                borderRadius: '4px',
                                background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                textAlign: 'left',
                                width: '100%'
                              }}
                            >
                              {isSelected ? <CheckSquare size={14} style={{ color: 'var(--color-primary)' }} /> : <Square size={14} />}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Displaying currently linked task tags */}
              {selectedTaskIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
                  {tasks.filter(t => selectedTaskIds.includes(t.id)).map(task => (
                    <span 
                      key={task.id}
                      style={{
                        fontSize: '0.7rem',
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      {task.title}
                      <button 
                        onClick={() => toggleTaskSelection(task.id)} 
                        style={{ padding: 0, fontSize: '0.75rem', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Modal for Partial Logs */}
            {showPartialModal && (
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'rgba(6, 7, 10, 0.85)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 20
                }}
              >
                <div 
                  className="glass-card" 
                  style={{ 
                    width: '90%', 
                    maxWidth: '300px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem', 
                    textAlign: 'center',
                    border: '1px solid var(--border-hover)',
                    background: 'var(--bg-surface)'
                  }}
                >
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Log Focus Session?</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    You spent <strong>{partialSessionDuration} minute{partialSessionDuration > 1 ? 's' : ''}</strong> focusing. Would you like to log this in your analytics?
                  </p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button 
                      onClick={handleSavePartial} 
                      className="btn-primary" 
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                    >
                      Yes, Log it
                    </button>
                    <button 
                      onClick={handleDiscardPartial} 
                      className="btn-secondary" 
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          /* =========================================================================
             ANALYTICS MODE
             ========================================================================= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL FOCUS TIME</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {totalFocusMinutes >= 60 
                    ? `${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m` 
                    : `${totalFocusMinutes}m`
                  }
                </span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMPLETED WORK SESSIONS</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-secondary)' }}>
                  {totalCompletedPomos.length}
                </span>
              </div>
            </div>

            {/* Custom SVG Trend Chart (Last 7 Days) */}
            <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem' }}>
                <TrendingUp size={14} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Weekly Focus Trend (mins)</span>
              </div>

              {/* SVG drawing */}
              <div style={{ width: '100%', height: '140px', display: 'flex', justifyContent: 'center' }}>
                {dailyFocusData.reduce((sum, d) => sum + d.minutes, 0) === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No sessions logged in the last 7 days
                  </div>
                ) : (
                  <svg width="340" height="130" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" />
                        <stop offset="100%" stopColor="var(--color-secondary)" />
                      </linearGradient>
                    </defs>

                    {/* Gridlines */}
                    <line x1="20" y1="15" x2="330" y2="15" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    <line x1="20" y1="55" x2="330" y2="55" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    <line x1="20" y1="95" x2="330" y2="95" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                    {/* Chart Data mapping */}
                    {dailyFocusData.map((d, index) => {
                      const maxVal = Math.max(...dailyFocusData.map(val => val.minutes), 60);
                      const chartHeight = 90; // max SVG height for bars
                      const barWidth = 22;
                      const spacing = (310 - 20) / 6;
                      const x = 20 + index * spacing;
                      const height = (d.minutes / maxVal) * chartHeight;
                      const y = 95 - height; // baseline is y = 95

                      return (
                        <g key={d.dateStr}>
                          {/* Hover Tooltip Value */}
                          {d.minutes > 0 && (
                            <text 
                              x={x + barWidth / 2} 
                              y={y - 5} 
                              fill="var(--text-secondary)" 
                              fontSize="9" 
                              textAnchor="middle"
                              fontWeight="600"
                            >
                              {d.minutes}m
                            </text>
                          )}
                          
                          {/* The Bar */}
                          <rect 
                            x={x} 
                            y={y} 
                            width={barWidth} 
                            height={height} 
                            fill="url(#barGrad)" 
                            rx="3" 
                            style={{ transition: 'all 0.5s ease-out' }}
                          />

                          {/* X-axis Label */}
                          <text 
                            x={x + barWidth / 2} 
                            y="112" 
                            fill="var(--text-muted)" 
                            fontSize="9" 
                            textAnchor="middle"
                          >
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                    <line x1="15" y1="95" x2="335" y2="95" stroke="var(--border-color)" strokeWidth="1" />
                  </svg>
                )}
              </div>
            </div>

            {/* Task Breakdown Progress Bars */}
            <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
                <FolderKanban size={14} style={{ color: 'var(--color-secondary)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Focus by Task</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {taskBreakdown.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                    No tasks focus logs recorded yet
                  </div>
                ) : (
                  taskBreakdown.map(tb => {
                    const pct = (tb.minutes / maxTaskMinutes) * 100;
                    return (
                      <div key={tb.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {tb.title}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {tb.minutes}m ({tb.count} session{tb.count > 1 ? 's' : ''})
                          </span>
                        </div>
                        {/* Horizontal Bar */}
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.01)' }}>
                          <div 
                            style={{ 
                              width: `${pct}%`, 
                              height: '100%', 
                              background: 'var(--grad-primary)', 
                              borderRadius: '3px',
                              transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)' 
                            }} 
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent Sessions list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>RECENT SESSIONS</span>
              
              {recentLogs.length === 0 ? (
                <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  No sessions recorded
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
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <div style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          background: isWork ? 'var(--color-primary)' : 'var(--color-secondary)',
                          boxShadow: '0 0 8px ' + (isWork ? 'var(--color-primary)' : 'var(--color-secondary)')
                        }} />
                        
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {isWork ? 'Focus session' : log.type === 'shortBreak' ? 'Short break' : 'Long break'}
                            </span>
                            {!log.completed && (
                              <span style={{ fontSize: '0.6rem', color: 'var(--color-warning)', background: 'rgba(245,158,11,0.08)', padding: '0.05rem 0.25rem', borderRadius: '4px' }}>
                                Partial
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {dateLabel} at {timeLabel}
                          </span>
                          {/* Linked tasks titles */}
                          {log.taskTitles && log.taskTitles.length > 0 && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Tasks: {log.taskTitles.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {log.durationMinutes}m
                        </span>
                        <button
                          onClick={() => handleDeleteSessionLog(log.id)}
                          style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
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
        )}

      </div>
    </div>
  );
};
