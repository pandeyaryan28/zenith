import React, { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { LocalTask, LocalEvent } from '../services/syncService';
import type { Habit, HabitLog } from '../services/habitService';
import { calculateStreak } from '../services/habitService';
import type { PomodoroSession } from '../services/pomodoroService';
import type { LocalNote } from '../services/noteService';
import { 
  Flame, 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Timer, 
  Target, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Coffee,
  RotateCcw,
  Search,
  Square,
  ListTodo,
  X,
  Plus,
  Minus,
  SkipForward,
  Music,
  Volume2,
  VolumeX,
  Check,
  CheckCircle,
  Clipboard,
  FileText,
  Clock,
  Play,
  Pause
} from 'lucide-react';

interface DashboardOverviewProps {
  user: User;
  tasks: LocalTask[];
  events: LocalEvent[];
  habits: Habit[];
  habitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } };
  pomodoroSessions: PomodoroSession[];
  activeListId: string;
  onToggleHabit: (habit: Habit, dateStr: string, currentCompleted: boolean, timeSpent?: number) => Promise<void>;
  onNavigate: (page: 'dashboard' | 'calendar' | 'tasks' | 'habits' | 'pomodoro' | 'analytics' | 'notes' | 'settings') => void;
  
  // Pomodoro timer props
  pomoType: 'work' | 'shortBreak' | 'longBreak';
  pomoState: 'idle' | 'running' | 'paused';
  pomoTotalDuration: number;
  pomoTimeLeft: number;
  pomoSelectedTaskIds: string[];
  setPomoSelectedTaskIds: React.Dispatch<React.SetStateAction<string[]>>;
  startPausePomo: () => void;
  resetPomo: (savePartialCallback?: (durationMin: number, startTime: string) => void) => void;
  
  // Dashboard expanded quick-action props
  onAddTask: (title: string, notes?: string, due?: string) => Promise<void>;
  onToggleTask: (taskId: string, currentStatus: 'needsAction' | 'completed') => Promise<void>;
  onAddEvent: (summary: string, startStr: string, endStr: string, description?: string) => Promise<void>;
  notes: LocalNote[];
  onAddNote: (noteId: string, title: string, content: string) => Promise<string>;
  onUpdateNote: (noteId: string, title: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  
  // Pomodoro additional actions
  activeSoundId: string | null;
  toggleAmbientSound: (soundId: string, url: string) => void;
  skipPomo: () => void;
  adjustPomoDuration: (amount: number) => void;
  handlePresetSelect: (type: 'work' | 'shortBreak' | 'longBreak') => void;
  handleSavePartialSession: (durationMin: number, startTimeStr: string) => Promise<void>;
  handleDiscardPartialSession: () => Promise<void>;
}

const QUOTES = [
  "The secret of getting ahead is getting started. — Mark Twain",
  "Focus on being productive instead of busy. — Tim Ferriss",
  "It is not that we have a short time to live, but that we waste a lot of it. — Seneca",
  "Your focus determines your reality. — Qui-Gon Jinn",
  "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
  "Consistency is what transforms average into excellence. — Unknown"
];

const AMBIENT_SOUNDS = [
  { id: 'rain', name: '🌧️ Heavy Rain', url: 'https://www.soundjay.com/nature/sounds/rain-07.mp3' },
  { id: 'ocean', name: '🌊 Ocean Waves', url: 'https://www.soundjay.com/nature/sounds/ocean-wave-1.mp3' },
  { id: 'white', name: '🤫 White Noise', url: 'https://www.soundjay.com/misc/sounds/fume-extractor-1.mp3' },
  { id: 'lofi', name: '🎵 Focus Lofi', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' }
];

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  user,
  tasks,
  events,
  habits,
  habitLogs,
  pomodoroSessions,
  activeListId,
  onToggleHabit,
  onNavigate,
  pomoType,
  pomoState,
  pomoTotalDuration,
  pomoTimeLeft,
  pomoSelectedTaskIds,
  setPomoSelectedTaskIds,
  startPausePomo,
  resetPomo,
  onAddTask,
  onToggleTask,
  onAddEvent,
  notes,
  onAddNote,
  onUpdateNote,
  activeSoundId,
  toggleAmbientSound,
  skipPomo,
  adjustPomoDuration,
  handlePresetSelect,
  handleSavePartialSession,
  handleDiscardPartialSession
}) => {
  // Live Date and Time
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Quote Carousel
  const [quoteIdx, setQuoteIdx] = useState(0);

  // Responsive Grid detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Task Search and Quick Add states
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialSessionDuration, setPartialSessionDuration] = useState(0);
  const [partialStartTime, setPartialStartTime] = useState<string | null>(null);

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
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [localCheckingTasks, setLocalCheckingTasks] = useState<{ [key: string]: boolean }>({});

  // Event Scheduler states
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [eventSummary, setEventSummary] = useState('');
  const [eventTime, setEventTime] = useState('09:00');
  const [eventDuration, setEventDuration] = useState('60');
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  // Scratchpad note state
  const [scratchText, setScratchText] = useState('');
  const [scratchSaveStatus, setScratchSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isCopied, setIsCopied] = useState(false);
  const isCreatingScratchRef = useRef(false);

  // Handle Resize for Responsive Bento Grid layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update Clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Set initial quote index randomly on load
  useEffect(() => {
    setQuoteIdx(Math.floor(Math.random() * QUOTES.length));
  }, []);

  // Load Scratchpad Note content
  useEffect(() => {
    const scratchNote = notes.find(n => n.title === 'Scratchpad');
    if (scratchNote) {
      setScratchText(prev => {
        // Only override local state if user is not actively typing (status is 'saved')
        if (scratchSaveStatus === 'saved') {
          return scratchNote.content;
        }
        return prev;
      });
    }
  }, [notes, scratchSaveStatus]);

  // Debounced auto-save for Scratchpad Notes
  useEffect(() => {
    const scratchNote = notes.find(n => n.title === 'Scratchpad');
    const existingVal = scratchNote?.content || '';

    if (scratchText === existingVal) {
      setScratchSaveStatus('saved');
      return;
    }

    setScratchSaveStatus('saving');
    const timer = setTimeout(async () => {
      if (isCreatingScratchRef.current) return;
      try {
        if (scratchNote) {
          await onUpdateNote(scratchNote.id, scratchNote.title, scratchText);
          setScratchSaveStatus('saved');
        } else {
          isCreatingScratchRef.current = true;
          const title = 'Scratchpad';
          const newId = encodeURIComponent(`Notes/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
          await onAddNote(newId, title, scratchText);
          isCreatingScratchRef.current = false;
          setScratchSaveStatus('saved');
        }
      } catch (err) {
        console.error("Failed to auto-save scratchpad:", err);
        setScratchSaveStatus('error');
        isCreatingScratchRef.current = false;
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [scratchText, notes]);

  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = getLocalDateStr(new Date());

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // ----------------------------------------------------
  // METRICS & COMPUTATIONS
  // ----------------------------------------------------
  const activeTasks = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted);
  const activeTasksCount = activeTasks.length;
  const completedTasksTodayCount = tasks.filter(t => t.listId === activeListId && t.status === 'completed' && !t.localDeleted).length;

  const activeHabitsToday = habits.filter(h => {
    if (h.archived) return false;
    if (h.frequency === 'custom' && h.daysOfWeek) {
      return h.daysOfWeek.includes(new Date().getDay());
    }
    return true; // daily
  });

  const completedHabitsToday = activeHabitsToday.filter(h => {
    const logs = habitLogs[h.id] || {};
    return logs[todayStr]?.status === 'completed';
  });
  const completedHabitsTodayCount = completedHabitsToday.length;

  const streakMetrics = habits
    .filter(h => !h.archived)
    .map(h => calculateStreak(habitLogs[h.id] || {}, h.frequency, h.daysOfWeek));
  const maxStreak = streakMetrics.length > 0 
    ? Math.max(...streakMetrics.map(m => m.currentStreak)) 
    : 0;

  const completedPomosToday = pomodoroSessions.filter(s => {
    if (s.type !== 'work') return false;
    const localSessionDateStr = getLocalDateStr(new Date(s.startTime));
    return localSessionDateStr === todayStr;
  });
  const focusMinutesToday = completedPomosToday.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Agenda Events Today
  const agendaEvents = events
    .filter(e => {
      if (e.localDeleted) return false;
      const startDateTime = e.start.dateTime || e.start.date;
      if (!startDateTime) return false;
      return startDateTime.startsWith(todayStr);
    })
    .sort((a, b) => {
      const aTime = a.start.dateTime || a.start.date || '';
      const bTime = b.start.dateTime || b.start.date || '';
      return aTime.localeCompare(bTime);
    });

  // Calculate Productivity Score
  const computeProductivityScore = () => {
    const totalTasksCalculated = activeTasksCount + completedTasksTodayCount;
    const taskRate = totalTasksCalculated > 0 ? (completedTasksTodayCount / totalTasksCalculated) * 100 : 100;
    const habitRate = activeHabitsToday.length > 0 ? (completedHabitsTodayCount / activeHabitsToday.length) * 100 : 100;
    const focusRate = Math.min((focusMinutesToday / 100) * 100, 100); // 100 min target
    return Math.round((taskRate + habitRate + focusRate) / 3);
  };

  const productivityScore = computeProductivityScore();

  // Last 5 Days Focus Chart Data
  const last5DaysFocus = () => {
    const data = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateStr(d);
      const dayName = d.toLocaleDateString([], { weekday: 'short' });
      const mins = pomodoroSessions
        .filter(s => s.type === 'work' && getLocalDateStr(new Date(s.startTime)) === dateStr)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      data.push({ dayName, mins });
    }
    return data;
  };

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------
  const handleTaskToggle = async (taskId: string, currentStatus: 'needsAction' | 'completed') => {
    // Optimistic UI state
    setLocalCheckingTasks(prev => ({ ...prev, [taskId]: true }));
    setTimeout(async () => {
      try {
        await onToggleTask(taskId, currentStatus);
      } catch (err) {
        console.error("Failed to toggle task status:", err);
      } finally {
        setLocalCheckingTasks(prev => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    }, 300);
  };

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setIsAddingTask(true);
    try {
      await onAddTask(newTaskTitle.trim());
      setNewTaskTitle('');
    } catch (err) {
      console.error("Failed to add task directly:", err);
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventSummary.trim()) return;
    setIsAddingEvent(true);
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const datePrefix = `${year}-${month}-${day}`;

      const startStr = `${datePrefix}T${eventTime}:00`;
      
      const [startHour, startMin] = eventTime.split(':').map(Number);
      const startDate = new Date(year, today.getMonth(), today.getDate(), startHour, startMin);
      const endDate = new Date(startDate.getTime() + Number(eventDuration) * 60000);
      
      const endHour = String(endDate.getHours()).padStart(2, '0');
      const endMin = String(endDate.getMinutes()).padStart(2, '0');
      const endStr = `${datePrefix}T${endHour}:${endMin}:00`;

      await onAddEvent(eventSummary.trim(), startStr, endStr);
      setEventSummary('');
      setIsEventFormOpen(false);
    } catch (err) {
      console.error("Failed to quick book event slot:", err);
    } finally {
      setIsAddingEvent(false);
    }
  };

  const copyScratchToClipboard = () => {
    navigator.clipboard.writeText(scratchText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const clearScratchText = () => {
    if (confirm("Are you sure you want to clear your scratchpad?")) {
      setScratchText('');
    }
  };

  const formatEventTime = (e: LocalEvent) => {
    if (e.start.date && !e.start.dateTime) return 'All Day';
    if (!e.start.dateTime) return '';
    const dateObj = new Date(e.start.dateTime);
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimerColor = () => {
    if (pomoType === 'work') return 'var(--color-primary)';
    if (pomoType === 'shortBreak') return 'var(--color-secondary)';
    return 'var(--color-success)';
  };

  const nextQuote = () => {
    setQuoteIdx((prev) => (prev + 1) % QUOTES.length);
  };

  const prevQuote = () => {
    setQuoteIdx((prev) => (prev - 1 + QUOTES.length) % QUOTES.length);
  };

  const filteredSearchTasks = tasks.filter(t => 
    t.listId === activeListId && 
    t.status === 'needsAction' && 
    !t.localDeleted &&
    t.title.toLowerCase().includes(taskSearchQuery.toLowerCase())
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '1rem 0.5rem 2rem 0.5rem' }} className="custom-scroll">
      
      {/* =========================================================================
         1. HERO HEADER BANNER
         ========================================================================= */}
      <div 
        className="glass-panel animate-slide-in" 
        style={{ 
          padding: '1.5rem 2rem', 
          marginBottom: '1.5rem', 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row', 
          alignItems: isMobile ? 'flex-start' : 'center', 
          justifyContent: 'space-between',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            PRODUCTIVITY DASHBOARD
          </span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.625rem', margin: 0 }}>
            {getGreeting()}, <span className="text-gradient">{user.displayName || 'Developer'}</span>!
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={14} style={{ color: 'var(--color-secondary)' }} />
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={{ color: 'var(--border-hover)' }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CalendarIcon size={14} style={{ color: 'var(--color-primary)' }} />
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Dynamic Quote & Productivity Gauge Section */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1.5rem', 
          width: isMobile ? '100%' : 'auto',
          justifyContent: 'space-between',
          borderLeft: isMobile ? 'none' : '1px solid var(--border-color)',
          paddingLeft: isMobile ? 0 : '1.5rem'
        }}>
          {/* Quote Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'space-between', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                DAILY MOTIVATION
              </span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={prevQuote} style={{ padding: '0.15rem', color: 'var(--text-muted)' }} className="hover-scale">
                  <ChevronLeft size={12} />
                </button>
                <button onClick={nextQuote} style={{ padding: '0.15rem', color: 'var(--text-muted)' }} className="hover-scale">
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', fontStyle: 'italic', fontWeight: 500, color: 'var(--text-primary)', margin: 0, minHeight: '38px', display: 'flex', alignItems: 'center' }}>
              "{QUOTES[quoteIdx]}"
            </p>
          </div>

          {/* Radial Score Gauge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} title="Overall completed percentage of tasks, habits and focus targets today.">
            <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="60" height="60" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="none" 
                  stroke="var(--color-primary)" 
                  strokeWidth="8" 
                  strokeDasharray="251.2" 
                  strokeDashoffset={251.2 - (productivityScore / 100) * 251.2} 
                  strokeLinecap="round" 
                  style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                />
              </svg>
              <span style={{ position: 'absolute', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {productivityScore}%
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Zenith Score</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Today's Rate</span>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
         2. BENTO GRID SYSTEM
         ========================================================================= */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)', 
          gap: '1.25rem' 
        }}
      >
        
        {/* ==========================================
           BENTO CARD 1: FOCUS STATION & AMBIENCE (Span 7)
           ========================================== */}
        <div 
          className="glass-card" 
          style={{ 
            gridColumn: isMobile ? 'span 12' : 'span 7',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1.25rem',
            minHeight: '380px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Timer size={18} style={{ color: getTimerColor() }} />
              Focus Station
            </h3>
            <button 
              onClick={() => onNavigate('pomodoro')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--color-primary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
            >
              Full Console <ArrowRight size={12} />
            </button>
          </div>

          {/* Clock SVG and controls */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: '1.5rem', flex: 1, justifyContent: 'center' }}>
            
            {/* Circular Timer Ring */}
            <div style={{ position: 'relative', width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="150" height="150" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4.5" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="44" 
                  fill="none" 
                  stroke={getTimerColor()} 
                  strokeWidth="4.5" 
                  strokeDasharray="276.4" 
                  strokeDashoffset={276.4 - (pomoTimeLeft / pomoTotalDuration) * 276.4} 
                  strokeLinecap="round" 
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1 }}>
                  {Math.floor(pomoTimeLeft / 60)}:{String(pomoTimeLeft % 60).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: getTimerColor(), letterSpacing: '0.12em', marginTop: '0.4rem', textTransform: 'uppercase' }}>
                  {pomoType === 'work' ? 'Focusing' : 'Resting'}
                </span>
              </div>
            </div>

            {/* Quick Actions & Modifiers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, width: '100%', minWidth: 0 }}>
              {/* Preset selectors */}
              <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.15)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {(['work', 'shortBreak', 'longBreak'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => handlePresetSelect(type)}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0',
                      fontSize: '0.7rem',
                      borderRadius: '6px',
                      background: pomoType === type ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border: '1px solid ' + (pomoType === type ? getTimerColor() : 'transparent'),
                      color: pomoType === type ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {type === 'work' ? 'Focus' : type === 'shortBreak' ? 'Short' : 'Long'}
                  </button>
                ))}
              </div>

              {/* Adjust duration (only when idle) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Length Target:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                  <button onClick={() => adjustPomoDuration(-60)} style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} disabled={pomoState !== 'idle'}><Minus size={11} /></button>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(pomoTotalDuration / 60)} min</span>
                  <button onClick={() => adjustPomoDuration(60)} style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} disabled={pomoState !== 'idle'}><Plus size={11} /></button>
                </div>
              </div>

              {/* Play / pause / skip */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  onClick={startPausePomo}
                  className="btn-primary"
                  style={{
                    flex: 2,
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: pomoState === 'running' ? 'rgba(255,255,255,0.08)' : 'var(--grad-primary)',
                    border: pomoState === 'running' ? '1px solid var(--border-color)' : 'none',
                    fontWeight: 600
                  }}
                >
                  {pomoState === 'running' ? <Pause size={12} /> : <Play size={12} />}
                  <span>{pomoState === 'running' ? 'Pause' : 'Start Focus'}</span>
                </button>
                {pomoState !== 'idle' && (
                  <>
                    <button onClick={handleReset} className="btn-secondary" style={{ flex: 0.5, padding: '0.5rem', borderRadius: 'var(--radius-sm)' }} title="Reset Session">
                      <RotateCcw size={12} />
                    </button>
                    <button onClick={skipPomo} className="btn-secondary" style={{ flex: 0.5, padding: '0.5rem', borderRadius: 'var(--radius-sm)' }} title="Skip Block">
                      <SkipForward size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Ambience Audio Console */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <Music size={12} style={{ color: 'var(--color-primary)' }} />
              Ambience Soundscapes
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
              {AMBIENT_SOUNDS.map(sound => {
                const isActive = activeSoundId === sound.id;
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleAmbientSound(sound.id, sound.url)}
                    className="btn-secondary"
                    style={{
                      padding: '0.4rem 0.25rem',
                      fontSize: '0.68rem',
                      borderRadius: '6px',
                      background: isActive ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.01)',
                      border: isActive ? '1px solid var(--border-active)' : '1px solid var(--border-color)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                      {sound.name.split(' ')[0]} {sound.name.split(' ').slice(1).join(' ')}
                    </span>
                    {isActive ? (
                      <Volume2 size={10} style={{ color: 'var(--color-primary)' }} />
                    ) : (
                      <VolumeX size={10} style={{ opacity: 0.2 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Redesigned Linked Pomodoro Tasks Row */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.5rem', 
            background: 'rgba(0,0,0,0.15)', 
            padding: '0.75rem 0.85rem', 
            borderRadius: 'var(--radius-sm)', 
            border: '1px solid var(--border-color)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ListTodo size={13} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Focus Targets</span>
                {pomoSelectedTaskIds.length > 0 && (
                  <span style={{ fontSize: '0.65rem', background: 'var(--color-primary-glow)', color: 'var(--color-primary)', border: '1px solid var(--border-active)', padding: '0.05rem 0.35rem', borderRadius: '10px', fontWeight: 700 }}>
                    {pomoSelectedTaskIds.length}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setIsTaskSelectorOpen(true)} 
                className="btn-secondary" 
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.65rem', borderRadius: '4px', height: '22px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <span>Link Tasks</span>
                <Plus size={10} />
              </button>
            </div>

            {/* Checklist of Linked Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '115px', overflowY: 'auto' }} className="custom-scroll">
              {pomoSelectedTaskIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '0.6rem 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <span>No tasks linked to this focus block.</span>
                  <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>Link active goals to track completion.</span>
                </div>
              ) : (
                tasks.filter(t => pomoSelectedTaskIds.includes(t.id)).map(task => {
                  const isCompleted = task.status === 'completed';
                  return (
                    <div 
                      key={task.id}
                      style={{ 
                        fontSize: '0.725rem', 
                        color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                        padding: '0.4rem 0.5rem',
                        background: isCompleted ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                        border: '1px solid ' + (isCompleted ? 'rgba(255,255,255,0.02)' : 'var(--border-color)'),
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', width: '85%' }}>
                        <button
                          onClick={() => onToggleTask(task.id, task.status)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            color: isCompleted ? 'var(--color-success)' : 'var(--text-muted)',
                            transition: 'transform 0.1s ease'
                          }}
                          title={isCompleted ? "Mark incomplete" : "Mark complete"}
                        >
                          {isCompleted ? <CheckSquare size={13} /> : <Square size={13} />}
                        </button>
                        <span style={{ 
                          textDecoration: isCompleted ? 'line-through' : 'none', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          opacity: isCompleted ? 0.6 : 1
                        }}>
                          {task.title}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => setPomoSelectedTaskIds(prev => prev.filter(id => id !== task.id))}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--text-muted)', 
                          cursor: 'pointer', 
                          padding: '0.1rem', 
                          display: 'flex', 
                          alignItems: 'center',
                          opacity: 0.6
                        }}
                        title="Unlink task"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ==========================================
           BENTO CARD 2: TASK INBOX & QUICK ADD (Span 5)
           ========================================== */}
        <div 
          className="glass-card" 
          style={{ 
            gridColumn: isMobile ? 'span 12' : 'span 5',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
            minHeight: '380px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <ListTodo size={18} style={{ color: 'var(--color-primary)' }} />
              Urgent Inbox
            </h3>
            <button 
              onClick={() => onNavigate('tasks')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--color-primary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
            >
              All Tasks <ArrowRight size={12} />
            </button>
          </div>

          {/* Task List */}
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.6rem',
              maxHeight: '230px',
              paddingRight: '0.25rem'
            }} 
            className="custom-scroll"
          >
            {activeTasks.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <CheckCircle size={22} style={{ color: 'var(--color-success)', marginBottom: '0.5rem' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>All clean! No pending tasks.</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2,rem' }}>Add a new task using the quick bar below.</span>
              </div>
            ) : (
              activeTasks.slice(0, 5).map(task => {
                const isChecking = !!localCheckingTasks[task.id];
                return (
                  <div 
                    key={task.id}
                    onClick={() => handleTaskToggle(task.id, 'needsAction')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      opacity: isChecking ? 0.4 : 1,
                      transform: isChecking ? 'scale(0.98)' : 'none',
                      transition: 'all 0.25s ease'
                    }}
                    className="hover-scale"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                      <div 
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          border: '1.5px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {isChecking && (
                          <div style={{ width: '8px', height: '8px', background: 'var(--color-primary)', borderRadius: '1px' }} />
                        )}
                      </div>
                      <span style={{ 
                        fontSize: '0.8rem', 
                        fontWeight: 500, 
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textDecoration: isChecking ? 'line-through' : 'none'
                      }}>
                        {task.title}
                      </span>
                    </div>
                    {task.notes && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '35%', fontStyle: 'italic' }}>
                        {task.notes.substring(0, 15)}...
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Add Form */}
          <form onSubmit={handleAddTaskSubmit} style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <input 
              type="text"
              placeholder="Quick add a task, hit Enter..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              disabled={isAddingTask}
              style={{
                fontSize: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-sm)',
                flex: 1
              }}
            />
            <button 
              type="submit"
              disabled={isAddingTask || !newTaskTitle.trim()}
              className="btn-primary"
              style={{ 
                padding: '0.5rem 0.85rem', 
                fontSize: '0.75rem', 
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'none'
              }}
            >
              {isAddingTask ? '...' : <Plus size={14} />}
            </button>
          </form>
        </div>

        {/* ==========================================
           BENTO CARD 3: SCHEDULE & EVENT BOOKER (Span 4)
           ========================================== */}
        <div 
          className="glass-card" 
          style={{ 
            gridColumn: isMobile ? 'span 12' : 'span 4',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
            minHeight: '340px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <CalendarIcon size={16} style={{ color: 'var(--color-secondary)' }} />
              Today's Agenda
            </h3>
            <button 
              onClick={() => setIsEventFormOpen(!isEventFormOpen)} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.725rem', color: 'var(--color-secondary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
            >
              {isEventFormOpen ? 'Cancel' : '+ Slot'}
            </button>
          </div>

          {/* Interactive Form or Events Timeline */}
          {isEventFormOpen ? (
            <form onSubmit={handleAddEventSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>BOOK FOCUS SLOT</span>
              <input 
                type="text" 
                placeholder="Session summary / title..."
                value={eventSummary}
                onChange={(e) => setEventSummary(e.target.value)}
                required
                style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}
              />
              
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.6.rem', color: 'var(--text-secondary)' }}>Start Time</label>
                  <input 
                    type="time" 
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}
                  />
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Duration</label>
                  <select 
                    value={eventDuration}
                    onChange={(e) => setEventDuration(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}
                  >
                    <option value="15">15 mins</option>
                    <option value="30">30 mins</option>
                    <option value="45">45 mins</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isAddingEvent || !eventSummary.trim()}
                className="btn-primary" 
                style={{ 
                  padding: '0.5rem', 
                  fontSize: '0.75rem', 
                  marginTop: '0.35rem', 
                  background: 'var(--grad-primary)', 
                  border: 'none',
                  boxShadow: 'none'
                }}
              >
                {isAddingEvent ? 'Saving...' : 'Book Slot'}
              </button>
            </form>
          ) : (
            <div 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem', 
                maxHeight: '220px',
                paddingRight: '0.2rem'
              }} 
              className="custom-scroll"
            >
              {agendaEvents.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <Coffee size={20} style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Schedule is clear today.</span>
                  <button 
                    onClick={() => setIsEventFormOpen(true)}
                    className="btn-secondary" 
                    style={{ marginTop: '0.5rem', padding: '0.3rem 0.5rem', fontSize: '0.65rem' }}
                  >
                    Schedule Focus Slot
                  </button>
                </div>
              ) : (
                agendaEvents.map((event, idx) => (
                  <div key={event.id || idx} style={{ display: 'flex', gap: '0.65rem', borderBottom: idx < agendaEvents.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none', paddingBottom: '0.5rem' }}>
                    <div style={{ minWidth: '55px', display: 'flex', flexDirection: 'column', borderRight: '1.5px solid var(--color-secondary-glow)', paddingRight: '0.4rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatEventTime(event)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {event.summary}
                      </span>
                      {event.description && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.description}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => onNavigate('calendar')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Full Calendar Grid <ArrowRight size={10} />
            </button>
          </div>
        </div>

        {/* ==========================================
           BENTO CARD 4: HABIT TRACKER WHEEL (Span 4)
           ========================================== */}
        <div 
          className="glass-card" 
          style={{ 
            gridColumn: isMobile ? 'span 12' : 'span 4',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
            minHeight: '340px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <Target size={16} style={{ color: 'var(--color-warning)' }} />
              Habits Checklist
            </h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)', fontWeight: 700 }}>
              {completedHabitsTodayCount}/{activeHabitsToday.length} Done
            </span>
          </div>

          {/* List of Habits for Today */}
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem', 
              maxHeight: '220px',
              paddingRight: '0.2rem'
            }} 
            className="custom-scroll"
          >
            {activeHabitsToday.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <Sparkles size={20} style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No habits scheduled today.</span>
                <button 
                  onClick={() => onNavigate('habits')} 
                  className="btn-secondary" 
                  style={{ marginTop: '0.5rem', padding: '0.3rem 0.5rem', fontSize: '0.65rem' }}
                >
                  Create Habit
                </button>
              </div>
            ) : (
              activeHabitsToday.map(habit => {
                const logs = habitLogs[habit.id] || {};
                const isCompleted = logs[todayStr]?.status === 'completed';
                const streak = calculateStreak(logs, habit.frequency, habit.daysOfWeek).currentStreak;

                const presets = [
                  { name: 'Indigo Dream', value: 'linear-gradient(135deg, #6366f1, #06b6d4)', class: 'grad-indigo-cyan' },
                  { name: 'Emerald Forest', value: 'linear-gradient(135deg, #06b6d4, #10b981)', class: 'grad-cyan-emerald' },
                  { name: 'Sunset Spark', value: 'linear-gradient(135deg, #ec4899, #f97316)', class: 'grad-pink-orange' },
                  { name: 'Purple Bloom', value: 'linear-gradient(135deg, #a855f7, #ec4899)', class: 'grad-purple-pink' },
                ];
                const match = presets.find(p => p.class === habit.color);
                const habitGrad = match ? match.value : 'linear-gradient(135deg, #6366f1, #06b6d4)';

                return (
                  <div 
                    key={habit.id}
                    onClick={() => onToggleHabit(habit, todayStr, isCompleted)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `3px solid transparent`,
                      borderImage: `${habitGrad} 1`,
                      cursor: 'pointer',
                      transition: 'transform var(--transition-fast)'
                    }}
                    className="hover-scale"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                      <div 
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: isCompleted ? 'none' : '1px solid var(--border-color)',
                          background: isCompleted ? habitGrad : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {isCompleted && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 500, 
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {habit.title}
                      </span>
                    </div>
                    {streak > 0 && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }}>
                        🔥 {streak}d
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => onNavigate('habits')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Habits board <ArrowRight size={10} />
            </button>
          </div>
        </div>

        {/* ==========================================
           BENTO CARD 5: QUICK SCRATCHPAD (Span 4)
           ========================================== */}
        <div 
          className="glass-card" 
          style={{ 
            gridColumn: isMobile ? 'span 12' : 'span 4',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.75rem',
            minHeight: '340px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <FileText size={16} style={{ color: 'var(--color-success)' }} />
              Quick Scratchpad
            </h3>
            <span style={{ 
              fontSize: '0.625rem', 
              fontWeight: 700,
              textTransform: 'uppercase',
              color: scratchSaveStatus === 'saving' ? 'var(--color-warning)' : scratchSaveStatus === 'error' ? 'var(--color-danger)' : 'var(--text-muted)'
            }}>
              {scratchSaveStatus === 'saving' ? 'Saving...' : scratchSaveStatus === 'error' ? 'Sync Error' : 'Saved'}
            </span>
          </div>

          {/* Text Area */}
          <textarea 
            placeholder="Type your notes / checklist here... Auto-saves in background."
            value={scratchText}
            onChange={(e) => setScratchText(e.target.value)}
            style={{
              flex: 1,
              resize: 'none',
              fontSize: '0.75rem',
              padding: '0.65rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              outline: 'none',
              fontFamily: 'var(--font-body)'
            }}
          />

          {/* Utility Buttons */}
          <div style={{ display: 'flex', justifySelf: 'flex-end', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button 
                onClick={copyScratchToClipboard} 
                className="btn-secondary" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', borderRadius: '4px', height: '22px' }}
                title="Copy to clipboard"
              >
                {isCopied ? <Check size={10} /> : <Clipboard size={10} />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
              <button 
                onClick={clearScratchText} 
                className="btn-secondary" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', borderRadius: '4px', height: '22px' }}
                title="Clear contents"
              >
                <X size={10} />
                <span>Clear</span>
              </button>
            </div>
            <button 
              onClick={() => onNavigate('notes')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Notes Board <ArrowRight size={10} />
            </button>
          </div>
        </div>

      </div>

      {/* =========================================================================
         3. LOWER SUMMARY PANEL: ANALYTICS GLANCE & STATS
         ========================================================================= */}
      <div 
        className="glass-panel" 
        style={{ 
          marginTop: '1.25rem', 
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.5rem'
        }}
      >
        {/* Core Metric Badges */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '1rem',
          width: isMobile ? '100%' : 'auto',
          flex: 1
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--color-primary)' }}>
              <CheckSquare size={14} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{activeTasksCount}</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Tasks Due</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(249, 115, 22, 0.08)', color: '#f97316' }}>
              <Flame size={14} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{completedHabitsTodayCount} / {activeHabitsToday.length}</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Habits logged</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(6, 182, 212, 0.08)', color: 'var(--color-secondary)' }}>
              <Timer size={14} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{focusMinutesToday} min</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Focused today</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--color-success)' }}>
              <TrendingUp size={14} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{maxStreak} days</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Best Streak</span>
            </div>
          </div>

        </div>

        {/* Small CSS Focus Chart */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          width: isMobile ? '100%' : 'auto',
          borderLeft: isMobile ? 'none' : '1px solid var(--border-color)',
          paddingLeft: isMobile ? 0 : '1.5rem',
          paddingTop: isMobile ? '1rem' : 0,
          borderTop: isMobile ? '1px solid var(--border-color)' : 'none'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Weekly Focus Tracker</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Mins completed daily</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.35rem', height: '32px' }}>
            {last5DaysFocus().map((item, idx) => {
              const maxVal = Math.max(...last5DaysFocus().map(d => d.mins), 25);
              const heightPercent = Math.round((item.mins / maxVal) * 100);
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                  <div 
                    style={{ 
                      width: '12px', 
                      height: `${Math.max(heightPercent, 10)}%`, 
                      minHeight: '2px',
                      background: idx === 4 ? 'var(--grad-primary)' : 'rgba(255,255,255,0.08)', 
                      borderRadius: '2px',
                      transition: 'height 0.3s ease'
                    }}
                    title={`${item.dayName}: ${item.mins} mins`}
                  />
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.dayName}</span>
                </div>
              );
            })}
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
              Choose which tasks you want to associate with your active focus session. You can check them off directly from the dashboard Focus Station when finished!
            </p>

            <div className="global-search-container" style={{ height: '36px', width: '100%', marginBottom: 0, position: 'relative' }}>
              <Search size={14} className="global-search-icon" style={{ left: '0.625rem', position: 'absolute', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search active tasks..." 
                value={taskSearchQuery} 
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                className="global-search-input"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.5rem 0.45rem 2.2rem', borderRadius: 'var(--radius-sm)', width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              {taskSearchQuery && (
                <button className="global-search-clear-btn" style={{ right: '0.625rem', position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setTaskSearchQuery('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="custom-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '220px', paddingRight: '0.2rem' }}>
              {filteredSearchTasks.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                  No active tasks found in this list.
                </span>
              ) : (
                filteredSearchTasks.map(task => {
                  const isSelected = pomoSelectedTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setPomoSelectedTaskIds(prev => 
                          prev.includes(task.id) 
                            ? prev.filter(id => id !== task.id) 
                            : [...prev, task.id]
                        );
                      }}
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
                      
                      {task.due && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.35rem', borderRadius: '4px', flexShrink: 0 }}>
                          {new Date(task.due).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {pomoSelectedTaskIds.length} target{pomoSelectedTaskIds.length !== 1 ? 's' : ''} selected
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
