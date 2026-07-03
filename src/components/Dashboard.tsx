import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { LocalTask, LocalEvent } from '../services/syncService';
import type { GoogleTaskList } from '../services/googleApi';
import { CalendarView } from './CalendarView';
import { TaskBoard } from './TaskBoard';
import { 
  LogOut, 
  User as UserIcon, 
  Calendar as CalendarIcon,
  Flame,
  CheckCircle2,
  Timer,
  Sliders,
  TrendingUp,
  LayoutDashboard,
  Play,
  Pause
} from 'lucide-react';
import { HabitsBoard } from './HabitsBoard';
import type { Habit, HabitLog } from '../services/habitService';
import { calculateStreak } from '../services/habitService';
import type { PomodoroSession } from '../services/pomodoroService';
import { PomodoroBoard } from './PomodoroBoard';
import { DashboardOverview } from './DashboardOverview';
import { AnalyticsPage } from './AnalyticsPage';
import { SettingsPage } from './SettingsPage';

interface DashboardProps {
  user: User;
  tasks: LocalTask[];
  taskLists: GoogleTaskList[];
  events: LocalEvent[];
  activeListId: string;
  setActiveListId: (id: string) => void;
  onAddTask: (title: string, notes?: string, due?: string) => Promise<void>;
  onToggleTask: (taskId: string, currentStatus: 'needsAction' | 'completed') => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddEvent: (summary: string, startStr: string, endStr: string, description?: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  isSyncing: boolean;
  lastSynced: Date | null;
  syncError: string | null;
  onSyncTrigger: () => void;
  onSignOut: () => void;
  loadingData: boolean;
  habits: Habit[];
  habitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } };
  onAddHabit: (habitData: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<void>;
  onUpdateHabit: (habitId: string, habitData: Partial<Habit>) => Promise<void>;
  onDeleteHabit: (habit: Habit) => Promise<void>;
  onToggleHabit: (habit: Habit, dateStr: string, currentCompleted: boolean, timeSpent?: number, note?: string) => Promise<void>;
  pomodoroSessions: PomodoroSession[];
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  styleMode: 'glassmorphism' | 'neumorphism' | 'minimalist' | 'retro';
  setStyleMode: (styleMode: 'glassmorphism' | 'neumorphism' | 'minimalist' | 'retro') => void;
  
  // Pomodoro states and callbacks
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
  onPomoSettingsChange: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  tasks,
  taskLists,
  events,
  activeListId,
  setActiveListId,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onAddEvent,
  onDeleteEvent,
  isSyncing,
  lastSynced,
  syncError,
  onSyncTrigger,
  onSignOut,
  loadingData,
  habits,
  habitLogs,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleHabit,
  pomodoroSessions,
  theme,
  setTheme,
  styleMode,
  setStyleMode,
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
  onPomoSettingsChange
}) => {
  const [activePage, setActivePage] = useState<'dashboard' | 'calendar' | 'habits' | 'pomodoro' | 'analytics' | 'settings'>('dashboard');

  const activeTasksCount = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted).length;

  // Habits metrics
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayLocalDateStr = getLocalDateStr(new Date());

  const activeHabitsToday = habits.filter(h => {
    if (h.archived) return false;
    if (h.frequency === 'custom' && h.daysOfWeek) {
      return h.daysOfWeek.includes(new Date().getDay());
    }
    return true;
  });

  const completedHabitsTodayCount = activeHabitsToday.filter(h => {
    const logs = habitLogs[h.id] || {};
    return logs[todayLocalDateStr]?.status === 'completed';
  }).length;

  const streakMetrics = habits
    .filter(h => !h.archived)
    .map(h => calculateStreak(habitLogs[h.id] || {}, h.frequency, h.daysOfWeek));
  const maxStreak = streakMetrics.length > 0 
    ? Math.max(...streakMetrics.map(m => m.currentStreak)) 
    : 0;

  // Pomodoro metrics
  const completedPomosToday = pomodoroSessions.filter(s => {
    if (!s.completed || s.type !== 'work') return false;
    const localSessionDateStr = getLocalDateStr(new Date(s.startTime));
    return localSessionDateStr === todayLocalDateStr;
  });
  const focusMinutesToday = completedPomosToday.reduce((sum, s) => sum + s.durationMinutes, 0);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, color: 'var(--color-primary)' },
    { id: 'calendar', label: 'Schedule & Tasks', icon: CalendarIcon, color: 'var(--color-secondary)' },
    { id: 'habits', label: 'Habits Board', icon: CheckCircle2, color: 'var(--color-warning)' },
    { id: 'pomodoro', label: 'Focus Station', icon: Timer, color: 'var(--color-danger)' },
    { id: 'analytics', label: 'Visual Analytics', icon: TrendingUp, color: 'var(--color-success)' },
    { id: 'settings', label: 'Settings', icon: Sliders, color: 'var(--text-secondary)' }
  ] as const;

  return (
    <div className="page-container" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      
      {/* Background Ambient Glows */}
      <div className="ambient-glow glow-top-left" style={{ opacity: 0.25 }} />
      <div className="ambient-glow glow-bottom-right" style={{ opacity: 0.25 }} />

      <div className="layout-grid">
        
        {/* =========================================================================
           Sidebar Navigation Panel
           ========================================================================= */}
        <aside className="glass-panel" style={{
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: 0,
          borderRight: '1px solid var(--border-color)',
          borderLeft: 'none',
          borderTop: 'none',
          borderBottom: 'none',
          zIndex: 2
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            
            {/* Logo Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: '0.75rem', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <Flame size={20} className="text-gradient" />
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                Zenith
              </h1>
            </div>

            {/* Main Navigation List */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>NAVIGATION</div>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'var(--color-primary-glow)' : 'transparent',
                      border: 'none',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.85rem',
                      width: '100%',
                      transition: 'all var(--transition-fast)'
                    }}
                    className="hover-scale"
                  >
                    <Icon size={16} style={{ color: isActive ? item.color : 'inherit' }} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Metrics (Sidebar compact view) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>TODAY'S METRICS</div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pending Tasks</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{activeTasksCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Focus Duration</span>
                <span style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>{focusMinutesToday}m</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Habits Streaks</span>
                <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{maxStreak}d</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Habits Checked</span>
                <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{completedHabitsTodayCount}/{activeHabitsToday.length}</span>
              </div>
            </div>

            {/* Live Pomodoro Sidebar Widget */}
            <div 
              onClick={() => setActivePage('pomodoro')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid ' + (pomoState === 'running' ? 'var(--border-active)' : 'var(--border-color)'),
                boxShadow: pomoState === 'running' ? '0 0 10px rgba(99, 102, 241, 0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              className="hover-scale"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: pomoState === 'running' ? 'var(--color-danger)' : 'var(--text-muted)',
                    display: 'inline-block',
                    animation: pomoState === 'running' ? 'pulse-glow 1.5s infinite' : 'none'
                  }} />
                  {pomoType === 'work' ? 'FOCUS SESSION' : pomoType === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK'}
                </span>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startPausePomo();
                  }}
                  style={{
                    padding: '0.2rem',
                    borderRadius: '50%',
                    background: pomoState === 'running' ? 'rgba(255,255,255,0.06)' : 'var(--grad-primary)',
                    border: 'none',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  {pomoState === 'running' ? (
                    <Pause size={10} style={{ color: 'var(--text-primary)' }} />
                  ) : (
                    <Play size={10} style={{ color: '#fff', marginLeft: '1px' }} />
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.1rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {Math.floor(pomoTimeLeft / 60)}:{String(pomoTimeLeft % 60).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  of {Math.round(pomoTotalDuration / 60)}m
                </span>
              </div>

              {pomoSelectedTaskIds.length > 0 ? (
                <div style={{ 
                  fontSize: '0.65rem', 
                  color: 'var(--text-secondary)', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  background: 'rgba(0,0,0,0.15)',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.02)',
                  marginTop: '0.1rem'
                }}>
                  Focusing: {tasks.filter(t => pomoSelectedTaskIds.includes(t.id)).map(t => t.title).join(', ')}
                </div>
              ) : (
                pomoType === 'work' && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No tasks linked.
                  </span>
                )
              )}
            </div>

          </div>

          {/* User Details & Sign Out */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border-color)' }}
                />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                  <UserIcon size={14} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.displayName || 'Developer'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email}
                </span>
              </div>
            </div>

            <button 
              onClick={onSignOut}
              className="btn-secondary" 
              style={{ width: '100%', justifyContent: 'center', padding: '0.5rem', borderRadius: 'var(--radius-sm)', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* =========================================================================
           Main Workspace Board (Render based on activePage)
           ========================================================================= */}
        <main style={{
          padding: '1.5rem',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          zIndex: 1
        }}>
          {activePage === 'calendar' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '7fr 4fr',
              gap: '1.5rem',
              height: '100%',
              overflow: 'hidden'
            }}>
              {/* Calendar Side */}
              <div style={{ height: '100%', overflow: 'hidden' }}>
                <CalendarView
                  events={events}
                  onAddEvent={onAddEvent}
                  onDeleteEvent={onDeleteEvent}
                />
              </div>
              {/* Tasks Side */}
              <div style={{ height: '100%', overflow: 'hidden' }}>
                <TaskBoard
                  tasks={tasks}
                  taskLists={taskLists}
                  activeListId={activeListId}
                  setActiveListId={setActiveListId}
                  onAddTask={onAddTask}
                  onToggleTask={onToggleTask}
                  onDeleteTask={onDeleteTask}
                  loading={loadingData}
                />
              </div>
            </div>
          ) : activePage === 'dashboard' ? (
            <DashboardOverview
              user={user}
              tasks={tasks}
              events={events}
              habits={habits}
              habitLogs={habitLogs}
              pomodoroSessions={pomodoroSessions}
              activeListId={activeListId}
              onToggleHabit={onToggleHabit}
              onNavigate={setActivePage}
              pomoType={pomoType}
              pomoState={pomoState}
              pomoTotalDuration={pomoTotalDuration}
              pomoTimeLeft={pomoTimeLeft}
              pomoSelectedTaskIds={pomoSelectedTaskIds}
              startPausePomo={startPausePomo}
              resetPomo={resetPomo}
            />
          ) : activePage === 'habits' ? (
            <HabitsBoard
              habits={habits}
              habitLogs={habitLogs}
              taskLists={taskLists}
              onAddHabit={onAddHabit}
              onUpdateHabit={onUpdateHabit}
              onDeleteHabit={onDeleteHabit}
              onToggleHabit={onToggleHabit}
            />
          ) : activePage === 'pomodoro' ? (
            <PomodoroBoard
              tasks={tasks}
              activeListId={activeListId}
              pomodoroSessions={pomodoroSessions}
              userId={user.uid}
              onToggleTask={onToggleTask}
              pomoType={pomoType}
              pomoState={pomoState}
              pomoTotalDuration={pomoTotalDuration}
              pomoTimeLeft={pomoTimeLeft}
              pomoSelectedTaskIds={pomoSelectedTaskIds}
              setPomoSelectedTaskIds={setPomoSelectedTaskIds}
              activeSoundId={activeSoundId}
              startPausePomo={startPausePomo}
              resetPomo={resetPomo}
              skipPomo={skipPomo}
              adjustPomoDuration={adjustPomoDuration}
              toggleAmbientSound={toggleAmbientSound}
              handlePresetSelect={handlePresetSelect}
              handleSavePartialSession={handleSavePartialSession}
            />
          ) : activePage === 'analytics' ? (
            <AnalyticsPage
              tasks={tasks}
              habits={habits}
              habitLogs={habitLogs}
              pomodoroSessions={pomodoroSessions}
              activeListId={activeListId}
            />
          ) : (
            <SettingsPage
              user={user}
              theme={theme}
              setTheme={setTheme}
              styleMode={styleMode}
              setStyleMode={setStyleMode}
              isSyncing={isSyncing}
              lastSynced={lastSynced}
              syncError={syncError}
              onSyncTrigger={onSyncTrigger}
              onSignOut={onSignOut}
              onPomoSettingsChange={onPomoSettingsChange}
            />
          )}
        </main>

      </div>
    </div>
  );
};
