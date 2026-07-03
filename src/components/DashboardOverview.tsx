import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { LocalTask, LocalEvent } from '../services/syncService';
import type { Habit, HabitLog } from '../services/habitService';
import { calculateStreak } from '../services/habitService';
import type { PomodoroSession } from '../services/pomodoroService';
import { 
  Flame, 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Timer, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Coffee,
  RotateCcw
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
  onNavigate: (page: 'dashboard' | 'calendar' | 'habits' | 'pomodoro' | 'analytics' | 'settings') => void;
  
  // Lifted Pomodoro props
  pomoType: 'work' | 'shortBreak' | 'longBreak';
  pomoState: 'idle' | 'running' | 'paused';
  pomoTotalDuration: number;
  pomoTimeLeft: number;
  pomoSelectedTaskIds: string[];
  startPausePomo: () => void;
  resetPomo: (savePartialCallback?: (durationMin: number, startTime: string) => void) => void;
}

const QUOTES = [
  "The secret of getting ahead is getting started. — Mark Twain",
  "Focus on being productive instead of busy. — Tim Ferriss",
  "It is not that we have a short time to live, but that we waste a lot of it. — Seneca",
  "Your focus determines your reality. — Qui-Gon Jinn",
  "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
  "Consistency is what transforms average into excellence. — Unknown"
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
  startPausePomo,
  resetPomo
}) => {
  const [quote, setQuote] = useState(QUOTES[0]);

  useEffect(() => {
    const idx = Math.floor(Math.random() * QUOTES.length);
    setQuote(QUOTES[idx]);
  }, []);

  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  const todayStr = getLocalDateStr(new Date());

  // Dynamic Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Metrics
  const activeTasksCount = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted).length;
  
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
    if (!s.completed || s.type !== 'work') return false;
    const localSessionDateStr = getLocalDateStr(new Date(s.startTime));
    return localSessionDateStr === todayStr;
  });
  const focusMinutesToday = completedPomosToday.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Today's Agenda - Calendar Events today
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

  const formatEventTime = (e: LocalEvent) => {
    if (e.start.date && !e.start.dateTime) return 'All Day';
    if (!e.start.dateTime) return '';
    const dateObj = new Date(e.start.dateTime);
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-panel" style={{ height: '100%', overflowY: 'auto', padding: '2rem' }}>
      
      {/* 1. Welcoming Title Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {getGreeting()}, <span className="text-gradient">{user.displayName || 'Developer'}</span>!
        </h2>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', borderLeft: '4px solid var(--color-primary)' }}>
          <Sparkles size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500, fontStyle: 'italic', color: 'var(--text-primary)' }}>
            "{quote}"
          </span>
        </div>
      </div>

      {/* 2. Overview Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => onNavigate('calendar')}>
          <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
            <CheckSquare size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{activeTasksCount}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tasks pending</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => onNavigate('habits')}>
          <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>
            <Flame size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{completedHabitsTodayCount} / {activeHabitsToday.length}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Habits checked</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => onNavigate('pomodoro')}>
          <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)' }}>
            <Timer size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{focusMinutesToday}m</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Focused today</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => onNavigate('analytics')}>
          <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
            <TrendingUp size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{maxStreak} days</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Best Streak</span>
          </div>
        </div>

      </div>

      {/* 3. Main Dashboard Board Content Split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* Left Card: Today's Timeline / Agenda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarIcon size={18} style={{ color: 'var(--color-secondary)' }} />
              Today's Agenda
            </h3>
            <button 
              onClick={() => onNavigate('calendar')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--color-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Full Calendar <ArrowRight size={12} />
            </button>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem', minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {agendaEvents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <Coffee size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your schedule is clear for today.</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Add slots in the Calendar view.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '350px', paddingRight: '0.5rem' }} className="custom-scroll">
                {agendaEvents.map((event, idx) => (
                  <div key={event.id || idx} style={{ display: 'flex', gap: '1rem', borderBottom: idx < agendaEvents.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none', paddingBottom: '0.75rem' }}>
                    <div style={{ minWidth: '70px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderRight: '2px solid var(--color-secondary-glow)', paddingRight: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatEventTime(event)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {event.summary}
                      </span>
                      {event.description && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {event.description}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Habits for Today */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--color-primary)' }} />
              Today's Habits Checklist
            </h3>
            <button 
              onClick={() => onNavigate('habits')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Full Habits <ArrowRight size={12} />
            </button>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem', minHeight: '260px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeHabitsToday.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <Sparkles size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No habits scheduled for today.</span>
                <button 
                  onClick={() => onNavigate('habits')} 
                  className="btn-secondary" 
                  style={{ marginTop: '0.75rem', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Create Habit
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', maxHeight: '350px', paddingRight: '0.5rem' }} className="custom-scroll">
                {activeHabitsToday.map(habit => {
                  const logs = habitLogs[habit.id] || {};
                  const isCompleted = logs[todayStr]?.status === 'completed';
                  
                  // Extract preset color values
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
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderLeft: `4px solid transparent`,
                        borderImage: `${habitGrad} 1`,
                        cursor: 'pointer',
                        transition: 'transform var(--transition-fast)'
                      }}
                      className="hover-scale"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <div 
                          style={{
                            width: '18px',
                            height: '18px',
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
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span style={{ 
                          fontSize: '0.85rem', 
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
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Live Focus Station */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Timer size={18} style={{ color: pomoType === 'work' ? 'var(--color-primary)' : 'var(--color-secondary)' }} />
              Active Focus Session
            </h3>
            <button 
              onClick={() => onNavigate('pomodoro')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Open Station <ArrowRight size={12} />
            </button>
          </div>

          <div 
            className="glass-card" 
            style={{ 
              padding: '1.25rem', 
              minHeight: '260px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between', 
              gap: '1rem', 
              border: pomoState === 'running' ? '1px solid var(--border-active)' : '1px solid var(--border-color)',
              transition: 'all var(--transition-normal)'
            }}
          >
            
            {/* Timer Clock & Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {pomoType === 'work' ? 'FOCUS TIME REMAINING' : pomoType === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK'}
                </span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginTop: '0.15rem', lineHeight: 1 }}>
                  {Math.floor(pomoTimeLeft / 60)}:{String(pomoTimeLeft % 60).padStart(2, '0')}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '0.35rem' }}>
                    / {Math.round(pomoTotalDuration / 60)}m
                  </span>
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {pomoState !== 'idle' && (
                  <button 
                    onClick={() => resetPomo()}
                    className="btn-secondary"
                    style={{ padding: '0.4rem', borderRadius: '50%' }}
                    title="Reset timer"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
                
                <button
                  onClick={startPausePomo}
                  className="btn-primary"
                  style={{ 
                    padding: '0.45rem 0.85rem', 
                    fontSize: '0.75rem', 
                    borderRadius: 'var(--radius-sm)',
                    background: pomoState === 'running' ? 'rgba(255, 255, 255, 0.08)' : 'var(--grad-primary)',
                    border: pomoState === 'running' ? '1px solid var(--border-color)' : 'none',
                    fontWeight: 600
                  }}
                >
                  {pomoState === 'running' ? 'Pause' : 'Start'}
                </button>
              </div>
            </div>

            {/* Target Tasks checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Focus Targets</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto', maxHeight: '110px', paddingRight: '0.25rem' }} className="custom-scroll">
                {pomoSelectedTaskIds.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                    No tasks linked. Go to Focus Station to select target tasks.
                  </span>
                ) : (
                  tasks.filter(t => pomoSelectedTaskIds.includes(t.id)).map(task => (
                    <div 
                      key={task.id}
                      style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--text-primary)',
                        padding: '0.35rem 0.5rem',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ✓ {task.title}
                    </div>
                  ))
                )}
              </div>
            </div>
            
          </div>
        </div>

      </div>

    </div>
  );
};
