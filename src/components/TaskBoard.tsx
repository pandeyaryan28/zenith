import React, { useState } from 'react';
import type { LocalTask } from '../services/syncService';
import type { GoogleTaskList, GoogleTask } from '../services/googleApi';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  Circle, 
  Calendar, 
  Loader2, 
  FolderKanban,
  Search,
  ArrowUpDown,
  Edit2,
  Check,
  X,
  ClipboardList,
  Sparkles
} from 'lucide-react';

interface TaskBoardProps {
  tasks: LocalTask[];
  taskLists: GoogleTaskList[];
  activeListId: string;
  setActiveListId: (id: string) => void;
  onAddTask: (title: string, notes?: string, due?: string) => Promise<void>;
  onToggleTask: (taskId: string, currentStatus: 'needsAction' | 'completed') => Promise<void>;
  onUpdateTask: (taskId: string, taskData: Partial<GoogleTask>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  loading: boolean;
}

interface Subtask {
  id: number;
  text: string;
  completed: boolean;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  taskLists,
  activeListId,
  setActiveListId,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  loading
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'dueDate' | 'priority'>('default');
  
  const [adding, setAdding] = useState(false);
  const [checkingTaskId, setCheckingTaskId] = useState<string | null>(null);

  // Edit Task Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editPriority, setEditPriority] = useState('none');
  const [editDescription, setEditDescription] = useState('');
  const [editSubtasks, setEditSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // =========================================================================
  // Helper functions for Priority & Checklist parsing
  // =========================================================================

  const getTaskPriority = (task: LocalTask): 'high' | 'medium' | 'low' | 'none' => {
    const notes = (task.notes || '').toLowerCase();
    if (notes.includes('[priority: high]') || notes.includes('#p1')) return 'high';
    if (notes.includes('[priority: medium]') || notes.includes('#p2')) return 'medium';
    if (notes.includes('[priority: low]') || notes.includes('#p3')) return 'low';
    return 'none';
  };

  const getPriorityDetails = (prio: string) => {
    switch (prio) {
      case 'high':
        return { label: 'High', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'medium':
        return { label: 'Medium', color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)' };
      case 'low':
        return { label: 'Low', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' };
      default:
        return null;
    }
  };

  const parseSubtasks = (notes: string): Subtask[] => {
    if (!notes) return [];
    const lines = notes.split('\n');
    const subtasks: Subtask[] = [];
    let count = 0;
    
    lines.forEach((line) => {
      const match = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/);
      if (match) {
        subtasks.push({
          id: count++,
          completed: match[1].toLowerCase() === 'x',
          text: match[2].trim()
        });
      }
    });
    
    return subtasks;
  };

  const cleanDescription = (notes: string): string => {
    if (!notes) return '';
    let result = notes;
    // Strip priority tags
    result = result.replace(/\[Priority: (High|Medium|Low)\]/gi, '').trim();
    // Strip subtask lines
    const lines = result.split('\n');
    const nonSubtaskLines = lines.filter(line => !line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/));
    return nonSubtaskLines.join('\n').trim();
  };

  const compileNotesField = (desc: string, priority: string, subtaskList: Subtask[]): string => {
    const parts: string[] = [];
    if (priority && priority !== 'none') {
      parts.push(`[Priority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}]`);
    }
    if (desc.trim()) {
      parts.push(desc.trim());
    }
    if (subtaskList.length > 0) {
      const subtaskLines = subtaskList.map(sub => `- [${sub.completed ? 'x' : ' '}] ${sub.text}`);
      parts.push(subtaskLines.join('\n'));
    }
    return parts.join('\n\n');
  };

  // =========================================================================
  // Handlers
  // =========================================================================

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

  // Inline toggle subtask completion
  const handleToggleSubtask = async (task: LocalTask, subtaskIndex: number) => {
    const subtaskList = parseSubtasks(task.notes || '');
    if (subtaskList[subtaskIndex]) {
      subtaskList[subtaskIndex].completed = !subtaskList[subtaskIndex].completed;
      
      const descText = cleanDescription(task.notes || '');
      const priority = getTaskPriority(task);
      const updatedNotes = compileNotesField(descText, priority, subtaskList);
      
      try {
        await onUpdateTask(task.id, { notes: updatedNotes });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenEditModal = (task: LocalTask) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDue(task.due ? new Date(task.due).toISOString().split('T')[0] : '');
    setEditPriority(getTaskPriority(task));
    setEditDescription(cleanDescription(task.notes || ''));
    setEditSubtasks(parseSubtasks(task.notes || ''));
    setNewSubtaskText('');
    setIsEditModalOpen(true);
  };

  const handleAddEditSubtask = () => {
    if (!newSubtaskText.trim()) return;
    const newSub: Subtask = {
      id: Date.now(),
      text: newSubtaskText.trim(),
      completed: false
    };
    setEditSubtasks([...editSubtasks, newSub]);
    setNewSubtaskText('');
  };

  const handleDeleteEditSubtask = (subId: number) => {
    setEditSubtasks(editSubtasks.filter(sub => sub.id !== subId));
  };

  const handleSaveTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !editTitle.trim()) return;
    setIsSaving(true);
    
    try {
      const finalNotes = compileNotesField(editDescription, editPriority, editSubtasks);
      
      await onUpdateTask(selectedTask.id, {
        title: editTitle.trim(),
        due: editDue ? new Date(editDue).toISOString() : undefined,
        notes: finalNotes || undefined
      });
      
      setIsEditModalOpen(false);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // =========================================================================
  // Filter & Sort Logic
  // =========================================================================

  const getPriorityWeight = (priority: string) => {
    if (priority === 'high') return 3;
    if (priority === 'medium') return 2;
    if (priority === 'low') return 1;
    return 0;
  };

  const filteredTasks = tasks
    .filter(t => t.listId === activeListId && !t.localDeleted)
    .filter(t => {
      // 1. Status Filter
      if (filter === 'active') return t.status === 'needsAction';
      if (filter === 'completed') return t.status === 'completed';
      return true;
    })
    .filter(t => {
      // 2. Search Filter
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(term) ||
        (t.notes || '').toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      // 3. Sorting
      if (sortBy === 'dueDate') {
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      }
      if (sortBy === 'priority') {
        const weightA = getPriorityWeight(getTaskPriority(a));
        const weightB = getPriorityWeight(getTaskPriority(b));
        return weightB - weightA; // High priority first
      }
      return 0; // default order
    });

  const activeTasksCount = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted).length;

  return (
    <div className="glass-panel" style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', height: '100%', overflow: 'hidden' }}>
      
      {/* 1. Header / List Tabs Row */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--color-primary-glow)' }}>
              <FolderKanban size={20} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Tasks Board</h2>
          </div>
          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '0.25rem 0.65rem', borderRadius: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {activeTasksCount} active tasks
          </span>
        </div>

        {/* Task lists scroll */}
        <div className="custom-scroll" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {taskLists.map((list) => (
            <button
              key={list.id}
              onClick={() => setActiveListId(list.id)}
              className="btn"
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                background: activeListId === list.id ? 'var(--grad-primary)' : 'rgba(255,255,255,0.03)',
                border: activeListId === list.id ? 'none' : '1px solid var(--border-color)',
                color: activeListId === list.id ? '#fff' : 'var(--text-secondary)',
                boxShadow: activeListId === list.id ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                transition: 'all var(--transition-fast)'
              }}
            >
              {list.title}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Search, Sorting, and Quick Add Forms Row */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* Search and Sort controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="global-search-container" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={14} className="global-search-icon" />
            <input
              type="text"
              placeholder="Search tasks by title or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="global-search-input"
            />
            {searchQuery && (
              <button className="global-search-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--text-primary)',
                padding: '0.5rem 2rem 0.5rem 0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="default" style={{ background: '#111' }}>Default Order</option>
              <option value="dueDate" style={{ background: '#111' }}>Sort by Due Date</option>
              <option value="priority" style={{ background: '#111' }}>Sort by Priority</option>
            </select>
          </div>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleCreateTask} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="What needs to be done? Add a new task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              disabled={adding}
              style={{ background: 'rgba(0, 0, 0, 0.25)', fontSize: '0.85rem' }}
            />
          </div>
          <input
            type="date"
            value={newTaskDue}
            onChange={(e) => setNewTaskDue(e.target.value)}
            disabled={adding}
            style={{ width: '135px', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(0, 0, 0, 0.25)' }}
          />
          <button 
            type="submit" 
            disabled={adding || !newTaskTitle.trim()} 
            className="btn-primary" 
            style={{ padding: '0.625rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
          >
            {adding ? <Loader2 size={16} className="spin-slow" /> : <Plus size={16} />}
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* 3. Task Items List Panel */}
      <div className="custom-scroll" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                textTransform: 'capitalize',
                background: filter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <Loader2 className="spin-slow" size={26} style={{ marginRight: '0.5rem', color: 'var(--color-primary)' }} />
            <span style={{ fontSize: '0.9rem' }}>Loading tasks from Cloud...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <ClipboardList size={40} style={{ opacity: 0.2, marginBottom: '1rem', color: 'var(--color-primary)' }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Your board is clear!</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>No tasks match your active filters or search queries.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isChecking = checkingTaskId === task.id;
            const isPending = task.pendingChange;
            const prio = getTaskPriority(task);
            const prioDetails = getPriorityDetails(prio);
            const subtaskList = parseSubtasks(task.notes || '');
            const completedSubs = subtaskList.filter(s => s.completed).length;

            return (
              <div 
                key={task.id}
                className={`glass-card ${isChecking ? 'animate-check' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  padding: '1rem 1.25rem',
                  opacity: isCompleted ? 0.6 : 1,
                  background: isCompleted ? 'rgba(255,255,255,0.015)' : 'var(--bg-card)',
                  borderLeft: isPending ? '3.5px solid var(--color-secondary)' : '1px solid var(--border-color)',
                  transition: 'all var(--transition-normal)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem' }}>
                  
                  {/* Task Checkbox & Info */}
                  <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <button 
                      onClick={() => handleToggle(task.id, task.status)}
                      style={{ padding: 0, marginTop: '0.15rem', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: isCompleted ? 'var(--color-success)' : 'var(--text-muted)' }}
                    >
                      {isCompleted ? (
                        <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                      ) : (
                        <Circle size={20} />
                      )}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: '0.95rem', 
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          wordBreak: 'break-word'
                        }}>
                          {task.title}
                        </span>
                        
                        {/* Priority Badge */}
                        {prioDetails && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: prioDetails.bg,
                            color: prioDetails.color,
                            border: `1px solid ${prioDetails.border}`
                          }}>
                            {prioDetails.label}
                          </span>
                        )}
                      </div>

                      {/* Notes snippet */}
                      {cleanDescription(task.notes || '') && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                          {cleanDescription(task.notes || '')}
                        </span>
                      )}

                      {/* Due Date Indicator */}
                      {task.due && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.1rem', fontWeight: 600 }}>
                          <Calendar size={11} style={{ color: 'var(--color-primary)' }} />
                          <span>Due: {new Date(task.due).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task Card Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    {isPending && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', padding: '0.15rem 0.4rem', borderRadius: '4px', marginRight: '0.25rem' }}>
                        Syncing
                      </span>
                    )}

                    <button 
                      onClick={() => handleOpenEditModal(task)}
                      className="btn"
                      style={{ padding: '0.4rem', color: 'var(--text-muted)', borderRadius: '6px' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Edit2 size={13} />
                    </button>

                    <button 
                      onClick={() => onDeleteTask(task.id)}
                      className="btn"
                      style={{ padding: '0.4rem', color: 'var(--text-muted)', borderRadius: '6px' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Subtask Checklists list inside Card */}
                {subtaskList.length > 0 && (
                  <div style={{
                    marginTop: '0.35rem',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(255,255,255,0.015)'
                  }}>
                    {/* Progress Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      <span>Subtasks checklist</span>
                      <span>{completedSubs}/{subtaskList.length} completed</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                      <div style={{ width: `${(completedSubs / subtaskList.length) * 100}%`, height: '100%', background: 'var(--color-success)', transition: 'width 0.3s ease' }} />
                    </div>

                    {/* Subtasks listing */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {subtaskList.map((sub, sIdx) => (
                        <div 
                          key={sub.id} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSubtask(task, sIdx);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          <span style={{ display: 'inline-flex', color: sub.completed ? 'var(--color-success)' : 'var(--text-muted)', flexShrink: 0 }}>
                            {sub.completed ? (
                              <CheckCircle size={13} style={{ color: 'var(--color-success)' }} />
                            ) : (
                              <Circle size={13} />
                            )}
                          </span>
                          <span style={{ 
                            color: sub.completed ? 'var(--text-muted)' : 'var(--text-primary)', 
                            textDecoration: sub.completed ? 'line-through' : 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {sub.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* =========================================================================
         EDIT TASK / SUBTASKS MANAGER MODAL
         ========================================================================= */}
      {isEditModalOpen && selectedTask && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(6,7,10,0.85)', backdropFilter: 'blur(10px)', zIndex: 10,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '95%', maxWidth: '480px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', maxHeight: '90%', overflowY: 'auto' }}>
            <button 
              onClick={() => setIsEditModalOpen(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
              <Sparkles size={18} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Edit Task Details</h3>
            </div>

            <form onSubmit={handleSaveTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              {/* Task Title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Task Name</label>
                <input 
                  type="text" 
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {/* Due Date */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Due Date</label>
                  <input 
                    type="date" 
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                    disabled={isSaving}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                {/* Priority Selection */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    disabled={isSaving}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      color: 'var(--text-primary)',
                      padding: '0.5rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="none" style={{ background: '#111' }}>None (General)</option>
                    <option value="low" style={{ background: '#111', color: '#3b82f6' }}>Low Priority</option>
                    <option value="medium" style={{ background: '#111', color: '#eab308' }}>Medium Priority</option>
                    <option value="high" style={{ background: '#111', color: '#ef4444' }}>High Priority</option>
                  </select>
                </div>
              </div>

              {/* Task Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Description / Notes</label>
                <textarea 
                  placeholder="General notes about this task..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isSaving}
                  rows={2}
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Subtasks Builder Section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Checklist / Subtasks</label>
                
                {/* Edit list of subtasks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '120px', overflowY: 'auto' }} className="custom-scroll">
                  {editSubtasks.map((sub) => (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.01)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditSubtasks(editSubtasks.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s));
                          }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', color: sub.completed ? 'var(--color-success)' : 'var(--text-muted)' }}
                        >
                          {sub.completed ? <CheckCircle size={14} /> : <Circle size={14} />}
                        </button>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', textDecoration: sub.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.text}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteEditSubtask(sub.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Subtask Form */}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <input
                    type="text"
                    placeholder="New subtask item..."
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEditSubtask();
                      }
                    }}
                    style={{ height: '32px', fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: 'rgba(0, 0, 0, 0.25)' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddEditSubtask}
                    className="btn-secondary"
                    style={{ height: '32px', padding: '0 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '0.625rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || !editTitle.trim()}
                  className="btn-primary" 
                  style={{ flex: 1, padding: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                >
                  <Check size={14} />
                  <span>{isSaving ? 'Saving...' : 'Save Task'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
