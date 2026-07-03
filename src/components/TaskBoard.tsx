import React, { useState } from 'react';
import type { LocalTask } from '../services/syncService';
import type { GoogleTaskList } from '../services/googleApi';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  Circle, 
  Calendar, 
  Loader2, 
  FolderKanban
} from 'lucide-react';

interface TaskBoardProps {
  tasks: LocalTask[];
  taskLists: GoogleTaskList[];
  activeListId: string;
  setActiveListId: (id: string) => void;
  onAddTask: (title: string, notes?: string, due?: string) => Promise<void>;
  onToggleTask: (taskId: string, currentStatus: 'needsAction' | 'completed') => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  loading: boolean;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  taskLists,
  activeListId,
  setActiveListId,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  loading
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [adding, setAdding] = useState(false);
  const [checkingTaskId, setCheckingTaskId] = useState<string | null>(null);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAdding(true);
    try {
      await onAddTask(
        newTaskTitle.trim(), 
        undefined, 
        newTaskDue ? new Date(newTaskDue).toISOString() : undefined
      );
      setNewTaskTitle('');
      setNewTaskDue('');
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (taskId: string, currentStatus: 'needsAction' | 'completed') => {
    setCheckingTaskId(taskId);
    // Add brief delay for checking animation
    setTimeout(async () => {
      try {
        await onToggleTask(taskId, currentStatus);
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingTaskId(null);
      }
    }, 200);
  };

  // Filter tasks based on active status and category filters
  const filteredTasks = tasks
    .filter(t => t.listId === activeListId && !t.localDeleted)
    .filter(t => {
      if (filter === 'active') return t.status === 'needsAction';
      if (filter === 'completed') return t.status === 'completed';
      return true;
    });

  const activeTasksCount = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted).length;

  return (
    <div className="glass-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', height: '100%', overflow: 'hidden' }}>
      
      {/* 1. Task Header / List Selector */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderKanban size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Task Lists</h2>
          </div>
          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '10px', color: 'var(--text-secondary)' }}>
            {activeTasksCount} active
          </span>
        </div>

        {/* Task List Horizontal Selector */}
        <div className="custom-scroll" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {taskLists.map((list) => (
            <button
              key={list.id}
              onClick={() => setActiveListId(list.id)}
              className="btn"
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                background: activeListId === list.id ? 'var(--grad-primary)' : 'rgba(255,255,255,0.03)',
                border: activeListId === list.id ? 'none' : '1px solid var(--border-color)',
                boxShadow: activeListId === list.id ? '0 4px 10px rgba(99, 102, 241, 0.2)' : 'none'
              }}
            >
              {list.title}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Quick Add Task Form */}
      <form onSubmit={handleCreateTask} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Add a new task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            disabled={adding}
            style={{ paddingRight: '2.5rem', background: 'rgba(0, 0, 0, 0.25)' }}
          />
        </div>
        <input
          type="date"
          value={newTaskDue}
          onChange={(e) => setNewTaskDue(e.target.value)}
          disabled={adding}
          style={{ width: '130px', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(0, 0, 0, 0.25)' }}
        />
        <button 
          type="submit" 
          disabled={adding || !newTaskTitle.trim()} 
          className="btn-primary" 
          style={{ padding: '0.625rem', borderRadius: 'var(--radius-sm)' }}
        >
          {adding ? <Loader2 size={16} className="spin-slow" /> : <Plus size={16} />}
        </button>
      </form>

      {/* 3. Task Items List */}
      <div className="custom-scroll" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                textTransform: 'capitalize',
                background: filter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
            <Loader2 className="spin-slow" size={24} style={{ marginRight: '0.5rem' }} />
            <span>Loading tasks...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <FolderKanban size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.9rem' }}>No tasks found in this section</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Get started by typing a task above!</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isChecking = checkingTaskId === task.id;
            const isPending = task.pendingChange;

            return (
              <div 
                key={task.id}
                className={`glass-card ${isChecking ? 'animate-check' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  opacity: isCompleted ? 0.6 : 1,
                  background: isCompleted ? 'rgba(255,255,255,0.01)' : 'var(--bg-card)',
                  borderLeft: isPending ? '3px solid var(--color-secondary)' : '1px solid var(--border-color)',
                  transition: 'all var(--transition-normal)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <button 
                    onClick={() => handleToggle(task.id, task.status)}
                    style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: isCompleted ? 'var(--color-success)' : 'var(--text-muted)' }}
                  >
                    {isCompleted ? (
                      <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <Circle size={20} />
                    )}
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ 
                      fontSize: '0.9rem', 
                      color: 'var(--text-primary)',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {task.title}
                    </span>
                    {task.due && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                        <Calendar size={10} />
                        <span>{new Date(task.due).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isPending && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                      Syncing
                    </span>
                  )}
                  <button 
                    onClick={() => onDeleteTask(task.id)}
                    className="btn"
                    style={{ padding: '0.35rem', color: 'var(--text-muted)', borderRadius: '6px' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
