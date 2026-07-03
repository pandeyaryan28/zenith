import React from 'react';
import type { User } from 'firebase/auth';
import type { LocalTask, LocalEvent } from '../services/syncService';
import type { GoogleTaskList } from '../services/googleApi';
import { CalendarView } from './CalendarView';
import { TaskBoard } from './TaskBoard';
import { SyncStatus } from './SyncStatus';
import { 
  LogOut, 
  User as UserIcon, 
  CheckSquare, 
  Calendar as CalendarIcon,
  Flame
} from 'lucide-react';

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
  loadingData
}) => {
  const activeTasksCount = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted).length;
  const totalEventsCount = events.filter(e => !e.localDeleted).length;

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
          padding: '1.75rem',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Logo Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: '0.75rem', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <Flame size={20} className="text-gradient" />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
                Zenith
              </h1>
            </div>

            {/* Sync Status Widget */}
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>SYSTEM SYNC</div>
              <SyncStatus
                isSyncing={isSyncing}
                lastSynced={lastSynced}
                error={syncError}
                onSyncTrigger={onSyncTrigger}
              />
            </div>

            {/* Quick Stats Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>WORKSPACE STATS</div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)' }}>
                <CheckSquare size={16} style={{ color: 'var(--color-primary)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600 }}>{activeTasksCount}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tasks pending</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)' }}>
                <CalendarIcon size={16} style={{ color: 'var(--color-secondary)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600 }}>{totalEventsCount}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Events scheduled</span>
                </div>
              </div>
            </div>
          </div>

          {/* User Details & Sign Out */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border-color)' }}
                />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                  <UserIcon size={18} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.displayName || 'Developer'}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email}
                </span>
              </div>
            </div>

            <button 
              onClick={onSignOut}
              className="btn-secondary" 
              style={{ width: '100%', justifyContent: 'center', padding: '0.625rem', borderRadius: 'var(--radius-sm)', gap: '0.5rem', color: 'var(--text-secondary)' }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* =========================================================================
           Main Workspace Board (Calendar + Tasks)
           ========================================================================= */}
        <main style={{
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '7fr 4fr',
          gap: '1.5rem',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          zIndex: 1
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
        </main>

      </div>
    </div>
  );
};
