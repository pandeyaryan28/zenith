import React, { useState, useEffect, useRef } from 'react';
import type { LocalTask } from '../services/syncService';
import type { GoogleTaskList, GoogleTask } from '../services/googleApi';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  Circle, 
  Loader2, 
  Search,
  ArrowUpDown,
  Check,
  X,
  ClipboardList,
  Star,
  ChevronDown,
  ChevronRight,
  ListTodo,
  CalendarDays,
  Sparkles,
  Flag
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
  // Navigation & Dropdown states
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Search & Filters states
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'dueDate' | 'priority'>('default');

  // Quick Add states
  const [isAddFocused, setIsAddFocused] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low' | 'none'>('none');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showDatePickerDropdown, setShowDatePickerDropdown] = useState(false);
  const [adding, setAdding] = useState(false);
  
  // Selection / Detail Panel states
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editPriority, setEditPriority] = useState('none');
  const [editDescription, setEditDescription] = useState('');
  const [editSubtasks, setEditSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [checkingTaskId, setCheckingTaskId] = useState<string | null>(null);

  const quickAddRef = useRef<HTMLFormElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const detailsTextareaRef = useRef<HTMLTextAreaElement>(null);

  // =========================================================================
  // Parsing Helpers
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
    result = result.replace(/\[Priority: (High|Medium|Low)\]/gi, '').trim();
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
  // Synchronization & State Updates
  // =========================================================================

  // Synchronize editing inputs when active task changes
  useEffect(() => {
    if (selectedTask) {
      setEditTitle(selectedTask.title);
      setEditDue(selectedTask.due ? new Date(selectedTask.due).toISOString().split('T')[0] : '');
      setEditPriority(getTaskPriority(selectedTask));
      setEditDescription(cleanDescription(selectedTask.notes || ''));
      setEditSubtasks(parseSubtasks(selectedTask.notes || ''));
      setNewSubtaskText('');
    }
  }, [selectedTask?.id]);

  // Click outside listener for Quick Add field and its sub-dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      // If priority dropdown is open and we click outside, close it
      if (showPriorityDropdown && priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node)) {
        setShowPriorityDropdown(false);
      }
      // If date dropdown is open and we click outside, close it
      if (showDatePickerDropdown && dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setShowDatePickerDropdown(false);
      }
      // If main quick add container is clicked outside
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        if (!newTaskTitle.trim() && !newTaskDescription.trim() && newTaskPriority === 'none' && !newTaskDue) {
          setIsAddFocused(false);
          setNewTaskDue('');
          setNewTaskPriority('none');
          setNewTaskDescription('');
        }
      }
    };
    if (isAddFocused || showPriorityDropdown || showDatePickerDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAddFocused, newTaskTitle, newTaskDescription, newTaskPriority, newTaskDue, showPriorityDropdown, showDatePickerDropdown]);

  // Click outside listener for list selector dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsListDropdownOpen(false);
      }
    };
    if (isListDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isListDropdownOpen]);

  // If active list changes, hide the details panel
  useEffect(() => {
    setSelectedTask(null);
  }, [activeListId]);

  // Auto-grow heights for title and details textareas based on their contents
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [newTaskTitle]);

  useEffect(() => {
    if (detailsTextareaRef.current) {
      detailsTextareaRef.current.style.height = 'auto';
      detailsTextareaRef.current.style.height = `${detailsTextareaRef.current.scrollHeight}px`;
    }
  }, [newTaskDescription]);

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAdding(true);
    try {
      const notes = compileNotesField(newTaskDescription, newTaskPriority, []);
      await onAddTask(
        newTaskTitle.trim(), 
        notes || undefined, 
        newTaskDue ? new Date(newTaskDue).toISOString() : undefined
      );
      setNewTaskTitle('');
      setNewTaskDue('');
      setNewTaskPriority('none');
      setNewTaskDescription('');
      // Keep focused for fast entry
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
        // If the toggled task is currently selected, update its local status or close
        if (selectedTask?.id === taskId) {
          setSelectedTask(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingTaskId(null);
      }
    }, 200);
  };

  const handleToggleStar = async (task: LocalTask) => {
    const currentPrio = getTaskPriority(task);
    const newPrio = currentPrio === 'high' ? 'none' : 'high';
    const descText = cleanDescription(task.notes || '');
    const subtaskList = parseSubtasks(task.notes || '');
    const updatedNotes = compileNotesField(descText, newPrio, subtaskList);
    
    try {
      await onUpdateTask(task.id, { notes: updatedNotes });
      // If toggled task is currently in side drawer, update drawer state
      if (selectedTask?.id === task.id) {
        setEditPriority(newPrio);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTask || !editTitle.trim()) return;
    setIsSaving(true);
    
    try {
      const finalNotes = compileNotesField(editDescription, editPriority, editSubtasks);
      
      await onUpdateTask(selectedTask.id, {
        title: editTitle.trim(),
        due: editDue ? new Date(editDue).toISOString() : undefined,
        notes: finalNotes || undefined
      });
      
      // Close side panel on save
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromDrawer = async () => {
    if (!selectedTask) return;
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await onDeleteTask(selectedTask.id);
        setSelectedTask(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddDrawerSubtask = () => {
    if (!newSubtaskText.trim()) return;
    const newSub: Subtask = {
      id: Date.now(),
      text: newSubtaskText.trim(),
      completed: false
    };
    setEditSubtasks([...editSubtasks, newSub]);
    setNewSubtaskText('');
  };

  const handleDeleteDrawerSubtask = (subId: number) => {
    setEditSubtasks(editSubtasks.filter(sub => sub.id !== subId));
  };

  const handleToggleSubtaskInDrawer = (subIndex: number) => {
    const updated = [...editSubtasks];
    if (updated[subIndex]) {
      updated[subIndex].completed = !updated[subIndex].completed;
      setEditSubtasks(updated);
    }
  };

  // =========================================================================
  // Filtering & Sorting logic
  // =========================================================================

  const getPriorityWeight = (priority: string) => {
    if (priority === 'high') return 3;
    if (priority === 'medium') return 2;
    if (priority === 'low') return 1;
    return 0;
  };

  const processedTasks = tasks
    .filter(t => t.listId === activeListId && !t.localDeleted)
    .filter(t => {
      // Search filter
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(term) ||
        (t.notes || '').toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      // Sorting
      if (sortBy === 'dueDate') {
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      }
      if (sortBy === 'priority') {
        const weightA = getPriorityWeight(getTaskPriority(a));
        const weightB = getPriorityWeight(getTaskPriority(b));
        return weightB - weightA;
      }
      return 0; // default order
    });

  // Split tasks into active & completed categories
  const activeTasks = processedTasks.filter(t => t.status === 'needsAction');
  const completedTasks = processedTasks.filter(t => t.status === 'completed');

  // Count active tasks in current list
  const activeTasksCount = tasks.filter(t => t.listId === activeListId && t.status === 'needsAction' && !t.localDeleted).length;
  
  // Find current active list details
  const activeList = taskLists.find(l => l.id === activeListId);
  const activeListTitle = activeList ? activeList.title : 'My Tasks';

  // =========================================================================
  // Row Renderer
  // =========================================================================

  const renderTaskRow = (task: LocalTask) => {
    const isCompleted = task.status === 'completed';
    const isChecking = checkingTaskId === task.id;
    const isSelected = selectedTask?.id === task.id;
    const prio = getTaskPriority(task);
    const prioDetails = getPriorityDetails(prio);
    const subtaskList = parseSubtasks(task.notes || '');
    const completedSubs = subtaskList.filter(s => s.completed).length;

    // Overdue / Today checks
    const isOverdue = task.due && new Date(task.due) < new Date(new Date().setHours(0,0,0,0)) && !isCompleted;
    const isDueToday = task.due && new Date(task.due).toDateString() === new Date().toDateString() && !isCompleted;

    return (
      <div 
        key={task.id}
        className={`task-row ${isSelected ? 'selected' : ''}`}
        onClick={() => setSelectedTask(task)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.85rem',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-color)',
          background: isSelected ? 'var(--color-primary-glow)' : 'transparent',
          opacity: isCompleted ? 0.55 : isChecking ? 0.4 : 1,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }}
      >
        {/* Checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.15rem' }} onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => handleToggle(task.id, task.status)}
            className="task-checkbox"
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isCompleted ? 'var(--color-success)' : 'var(--text-secondary)',
              position: 'relative',
              width: '18px',
              height: '18px'
            }}
          >
            {isCompleted ? (
              <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
            ) : (
              <>
                <Circle size={18} className="circle-icon" style={{ color: 'var(--text-muted)' }} />
                <Check size={10} className="task-check-icon" style={{
                  position: 'absolute',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                  color: 'var(--color-primary)'
                }} />
              </>
            )}
          </button>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ 
            fontSize: '0.9rem', 
            fontWeight: 500,
            color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: isCompleted ? 'line-through' : 'none',
            wordBreak: 'break-word',
            lineHeight: 1.4
          }}>
            {task.title}
          </span>

          {/* Notes Snippet */}
          {cleanDescription(task.notes || '') && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              display: 'block'
            }}>
              {cleanDescription(task.notes || '')}
            </span>
          )}

          {/* Badges */}
          {(task.due || subtaskList.length > 0 || (prioDetails && prio !== 'high')) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
              {/* Due Date Badge */}
              {task.due && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.2rem', 
                  fontSize: '0.65rem', 
                  fontWeight: 600,
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  background: isOverdue ? 'rgba(239, 68, 68, 0.08)' : isDueToday ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.03)',
                  color: isOverdue ? 'var(--color-danger)' : isDueToday ? 'var(--color-warning)' : 'var(--text-muted)',
                  border: isOverdue ? '1px solid rgba(239, 68, 68, 0.15)' : isDueToday ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid var(--border-color)',
                }}>
                  <CalendarDays size={9} />
                  <span>{new Date(task.due).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </div>
              )}

              {/* Subtasks Count Badge */}
              {subtaskList.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.2rem', 
                  fontSize: '0.65rem', 
                  fontWeight: 600,
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                }}>
                  <ListTodo size={9} />
                  <span>{completedSubs}/{subtaskList.length}</span>
                </div>
              )}

              {/* Priority Badge */}
              {prioDetails && prio !== 'high' && (
                <div style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 700,
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  background: prioDetails.bg,
                  color: prioDetails.color,
                  border: `1px solid ${prioDetails.border}`
                }}>
                  {prioDetails.label}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Row Actions */}
        <div className="task-actions" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.2rem', 
          flexShrink: 0,
          opacity: 0,
          transition: 'opacity 0.15s ease'
        }} onClick={(e) => e.stopPropagation()}>
          {/* Star Toggle (High Priority representation) */}
          <button
            onClick={() => handleToggleStar(task)}
            style={{
              padding: '0.35rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: prio === 'high' ? 'var(--color-warning)' : 'var(--text-muted)',
              borderRadius: '6px'
            }}
          >
            <Star size={14} fill={prio === 'high' ? 'var(--color-warning)' : 'transparent'} />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDeleteTask(task.id)}
            style={{
              padding: '0.35rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              borderRadius: '6px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Star indicator displayed static if High priority (faded if hovered in favor of full actions) */}
        {prio === 'high' && (
          <div style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }} className="star-indicator">
            <Star size={14} fill="var(--color-warning)" style={{ color: 'var(--color-warning)' }} />
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Main Render
  // =========================================================================

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', width: '100%' }}>
      
      {/* Custom styles inject */}
      <style>{`
        .task-row:not(.selected):hover {
          background: var(--bg-surface-hover) !important;
        }
        .task-row:hover .task-actions {
          opacity: 1 !important;
        }
        .task-row:hover .star-indicator {
          display: none !important;
        }
        .task-checkbox:hover .task-check-icon {
          opacity: 1 !important;
        }
        .task-checkbox:hover .circle-icon {
          color: var(--color-primary) !important;
        }
        @media (max-width: 768px) {
          .task-split-container {
            flex-direction: column !important;
            padding: 0.5rem !important;
            gap: 0.5rem !important;
          }
          .task-list-wrapper {
            max-width: 100% !important;
            height: 100% !important;
          }
          .task-list-island {
            max-width: 100% !important;
            height: 100% !important;
          }
          .task-details-drawer {
            position: absolute !important;
            top: 0.5rem !important;
            right: 0.5rem !important;
            bottom: 0.5rem !important;
            left: 0.5rem !important;
            width: auto !important;
            max-width: 100% !important;
            z-index: 100 !important;
            height: calc(100% - 1rem) !important;
            border-radius: 16px !important;
          }
        }

        /* Redesigned Task Input Styles */
        .task-input-container {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          width: 100%;
          box-sizing: border-box;
          margin-top: 0.2rem;
          overflow: hidden;
        }
        .task-input-container:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .task-input-container.focused {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(99, 102, 241, 0.45);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15), var(--shadow-md);
        }
        .task-input-line {
          display: flex;
          align-items: center;
          gap: 0.95rem;
          padding: 1rem 1.5rem;
          width: 100%;
          box-sizing: border-box;
        }
        .task-input-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          color: var(--text-muted);
          transition: color 0.2s ease;
        }
        .task-input-container.focused .task-input-icon-wrap {
          color: var(--color-primary);
        }

        /* Prevent theme styles from rendering custom input backgrounds/borders/radius on textareas */
        .task-input-container textarea.task-input-field,
        .task-input-container textarea.task-input-details,
        html[data-style] .task-input-container textarea.task-input-field,
        html[data-style] .task-input-container textarea.task-input-details {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }

        .task-input-container textarea.task-input-field {
          flex: 1 !important;
          min-width: 0 !important;
          width: auto !important;
          inline-size: auto !important;
          outline: none !important;
          color: var(--text-primary) !important;
          font-size: 1.15rem !important;
          font-weight: 600 !important;
          padding: 0 !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          resize: none !important;
          font-family: inherit !important;
          line-height: 1.5 !important;
          overflow-y: hidden !important;
          height: auto !important;
        }
        .task-input-field::placeholder {
          color: var(--text-muted);
          opacity: 0.8;
        }
        .task-input-tray {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0 1.5rem 0.85rem 1.5rem;
          border-top: 1px dashed rgba(255, 255, 255, 0.06);
          animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-sizing: border-box;
          width: 100%;
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .task-input-container textarea.task-input-details {
          outline: none !important;
          color: var(--text-secondary) !important;
          font-size: 0.825rem !important;
          width: 100% !important;
          padding: 0.5rem 0 0 0 !important;
          margin: 0 !important;
          resize: none !important;
          min-height: 24px !important;
          font-family: inherit !important;
          line-height: 1.5 !important;
          box-sizing: border-box !important;
          overflow-y: hidden !important;
          height: auto !important;
          background: transparent !important;
        }
        .task-input-details::placeholder {
          color: var(--text-muted);
          opacity: 0.7;
        }
        .task-input-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
          width: 100%;
          box-sizing: border-box;
          margin-top: 0.25rem;
        }
        .task-meta-left {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .meta-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }
        .meta-pill:hover {
          border-color: var(--border-hover);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }
        .meta-pill.active {
          background: var(--color-primary-glow);
          color: var(--color-primary);
          border-color: rgba(99, 102, 241, 0.3);
        }
        .meta-pill-clear {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 1px;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
          margin-left: 0.1rem;
          color: var(--text-muted);
          transition: all 0.15s ease;
        }
        .meta-pill-clear:hover {
          background: rgba(239, 68, 68, 0.15);
          color: var(--color-danger);
        }
        .task-meta-right {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .task-submit-hint {
          font-size: 0.65rem;
          color: var(--text-muted);
          opacity: 0.6;
          user-select: none;
        }
      `}</style>

      {/* Main Split Grid */}
      <div 
        className="task-split-container"
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          padding: '1rem',
          gap: '1rem',
          boxSizing: 'border-box'
        }}
      >
        {/* Left Column Wrapper (for centering list) */}
        <div 
          className="task-list-wrapper"
          style={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            height: '100%', 
            minWidth: 0 
          }}
        >
          {/* Left Column: List Pane (Floating Island) */}
          <div 
            className="task-list-island glass-panel" 
            style={{ 
              width: '100%',
              maxWidth: selectedTask ? '600px' : '680px',
              display: 'grid', 
              gridTemplateRows: 'auto auto 1fr', 
              height: '100%', 
              overflow: 'hidden',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-lg)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
          {/* Header Row */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            
            {/* Custom List Selector Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setIsListDropdownOpen(!isListDropdownOpen)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.5rem',
                  marginLeft: '-0.5rem',
                  borderRadius: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span>{activeListTitle}</span>
                <ChevronDown size={16} style={{ color: 'var(--text-secondary)', marginTop: '0.1rem' }} />
              </button>

              {isListDropdownOpen && (
                <div className="glass-panel custom-scroll" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.5rem',
                  minWidth: '220px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 100,
                  padding: '0.5rem 0',
                  boxShadow: 'var(--shadow-lg)',
                  background: 'var(--bg-surface)',
                  backdropFilter: 'var(--glass-blur)'
                }}>
                  {taskLists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => {
                        setActiveListId(list.id);
                        setIsListDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.6rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: activeListId === list.id ? 'var(--color-primary-glow)' : 'transparent',
                        color: activeListId === list.id ? 'var(--color-primary)' : 'var(--text-primary)',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.85rem',
                        fontWeight: activeListId === list.id ? 700 : 500
                      }}
                      onMouseEnter={(e) => {
                        if (activeListId !== list.id) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeListId !== list.id) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <span>{list.title}</span>
                      {activeListId === list.id && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions/Counts */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {activeTasksCount} active
              </span>
            </div>
          </div>

          {/* Search, Sort, and Quick Add Row */}
          <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* Search and Sort controls */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="global-search-container" style={{ flex: 1, maxWidth: '280px' }}>
                <Search size={13} className="global-search-icon" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="global-search-input"
                  style={{ fontSize: '0.8rem', paddingLeft: '2.1rem' }}
                />
                {searchQuery && (
                  <button className="global-search-clear-btn" onClick={() => setSearchQuery('')}>
                    <X size={12} />
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text-primary)',
                    padding: '0.35rem 1.5rem 0.35rem 0.5rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="default" style={{ background: '#111' }}>My Order</option>
                  <option value="dueDate" style={{ background: '#111' }}>Due Date</option>
                  <option value="priority" style={{ background: '#111' }}>Priority</option>
                </select>
              </div>
            </div>

            {/* Google Tasks Inline Quick Add */}
            <form 
              ref={quickAddRef}
              onSubmit={handleCreateTask}
              className={`task-input-container ${isAddFocused ? 'focused' : ''}`}
            >
              {/* Main input line */}
              <div className="task-input-line">
                <div className="task-input-icon-wrap">
                  {adding ? <Loader2 size={20} className="spin-slow" /> : <Plus size={20} />}
                </div>
                <textarea 
                  ref={titleTextareaRef}
                  placeholder={`Add a task to "${taskLists.find(l => l.id === activeListId)?.title || 'list'}"...`}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onFocus={() => setIsAddFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCreateTask(e);
                    } else if (e.key === 'Escape') {
                      setIsAddFocused(false);
                      setNewTaskTitle('');
                      setNewTaskDue('');
                      setNewTaskPriority('none');
                      setNewTaskDescription('');
                      (e.target as HTMLElement).blur();
                    }
                  }}
                  disabled={adding}
                  rows={1}
                  className="task-input-field"
                />
              </div>

              {/* Expandable Options Tray */}
              {(isAddFocused || newTaskTitle.trim()) && (
                <div className="task-input-tray">
                  <textarea 
                    ref={detailsTextareaRef}
                    placeholder="Add details, notes, or links... (Press Enter to save)"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    disabled={adding}
                    rows={1}
                    className="task-input-details"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCreateTask(e);
                      } else if (e.key === 'Escape') {
                        setIsAddFocused(false);
                        setNewTaskTitle('');
                        setNewTaskDue('');
                        setNewTaskPriority('none');
                        setNewTaskDescription('');
                        (e.target as HTMLElement).blur();
                      }
                    }}
                  />
                  
                  <div className="task-input-meta-row">
                    <div className="task-meta-left">
                      {/* Priority Button */}
                      <div style={{ position: 'relative' }} ref={priorityDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPriorityDropdown(!showPriorityDropdown);
                            setShowDatePickerDropdown(false);
                          }}
                          disabled={adding}
                          className={`meta-pill ${newTaskPriority !== 'none' ? 'active' : ''}`}
                          style={
                            newTaskPriority !== 'none' 
                              ? {
                                  background: getPriorityDetails(newTaskPriority)?.bg,
                                  color: getPriorityDetails(newTaskPriority)?.color,
                                  borderColor: getPriorityDetails(newTaskPriority)?.border
                                }
                              : undefined
                          }
                        >
                          <Flag size={12} fill={newTaskPriority !== 'none' ? (getPriorityDetails(newTaskPriority)?.color || 'transparent') : 'transparent'} />
                          <span>{newTaskPriority === 'none' ? 'Priority' : (getPriorityDetails(newTaskPriority)?.label || 'None')}</span>
                          <ChevronDown size={10} style={{ opacity: 0.7 }} />
                        </button>
                        
                        {showPriorityDropdown && (
                          <div className="glass-panel" style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            marginBottom: '0.5rem',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.3rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.15rem',
                            zIndex: 100,
                            boxShadow: 'var(--shadow-lg)',
                            backdropFilter: 'var(--glass-blur)',
                            minWidth: '130px'
                          }}>
                            {(['high', 'medium', 'low', 'none'] as const).map((prio) => {
                              const details = getPriorityDetails(prio) || { label: 'None', color: 'var(--text-muted)', bg: 'transparent', border: 'transparent' };
                              const isSelected = newTaskPriority === prio;
                              return (
                                <button
                                  key={prio}
                                  type="button"
                                  onClick={() => {
                                    setNewTaskPriority(prio);
                                    setShowPriorityDropdown(false);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    padding: '0.4rem 0.6rem',
                                    background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background var(--transition-fast)',
                                    width: '100%'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(255,255,255,0.06)' : 'transparent'}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Flag size={11} style={{ color: details.color }} fill={prio !== 'none' ? details.color : 'transparent'} />
                                    <span style={{ fontWeight: isSelected ? 700 : 500 }}>{details.label}</span>
                                  </div>
                                  {isSelected && <Check size={11} style={{ color: 'var(--color-primary)' }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Due Date Button */}
                      <div style={{ position: 'relative' }} ref={dateDropdownRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDatePickerDropdown(!showDatePickerDropdown);
                            setShowPriorityDropdown(false);
                          }}
                          disabled={adding}
                          className={`meta-pill ${newTaskDue ? 'active' : ''}`}
                        >
                          <CalendarDays size={12} />
                          <span>
                            {newTaskDue 
                              ? new Date(newTaskDue).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              : 'Due Date'
                            }
                          </span>
                          {newTaskDue ? (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewTaskDue('');
                              }}
                              className="meta-pill-clear"
                            >
                              <X size={10} style={{ color: 'var(--color-danger)' }} />
                            </span>
                          ) : (
                            <ChevronDown size={10} style={{ opacity: 0.7 }} />
                          )}
                        </button>
                        
                        {showDatePickerDropdown && (
                          <div className="glass-panel" style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            marginBottom: '0.5rem',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.3rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.15rem',
                            zIndex: 100,
                            boxShadow: 'var(--shadow-lg)',
                            backdropFilter: 'var(--glass-blur)',
                            minWidth: '150px'
                          }}>
                            {[
                              { label: 'Today', getValue: () => new Date().toISOString().split('T')[0] },
                              { label: 'Tomorrow', getValue: () => {
                                  const tomorrow = new Date();
                                  tomorrow.setDate(tomorrow.getDate() + 1);
                                  return tomorrow.toISOString().split('T')[0];
                                }
                              },
                              { label: 'Next Week', getValue: () => {
                                  const nextWeek = new Date();
                                  nextWeek.setDate(nextWeek.getDate() + 7);
                                  return nextWeek.toISOString().split('T')[0];
                                }
                              }
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                  setNewTaskDue(item.getValue());
                                  setShowDatePickerDropdown(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0.4rem 0.6rem',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'background var(--transition-fast)',
                                  width: '100%'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <span>{item.label}</span>
                              </button>
                            ))}
                            
                            <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.2rem 0' }} />
                            
                            <div style={{ position: 'relative', width: '100%' }}>
                              <input 
                                type="date"
                                value={newTaskDue}
                                onChange={(e) => {
                                  setNewTaskDue(e.target.value);
                                  setShowDatePickerDropdown(false);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  opacity: 0,
                                  width: '100%',
                                  height: '100%',
                                  cursor: 'pointer',
                                  zIndex: 2
                                }}
                              />
                              <button
                                type="button"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0.4rem 0.6rem',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%'
                                }}
                              >
                                <span>Custom Date...</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="task-meta-right">
                      <span className="task-submit-hint">Press Enter to save</span>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* List Scrolling Panel */}
          <div className="custom-scroll" style={{ padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', overflowY: 'auto' }}>
            
            {/* Horizontal Filter Selectors */}
            <div style={{ display: 'flex', gap: '0.25rem', padding: '0 0.5rem 0.5rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.015)' }}>
              {(['all', 'active', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    textTransform: 'capitalize',
                    background: filter === f ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
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
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
                <Loader2 className="spin-slow" size={24} style={{ marginRight: '0.5rem', color: 'var(--color-primary)' }} />
                <span style={{ fontSize: '0.85rem' }}>Syncing with cloud...</span>
              </div>
            ) : processedTasks.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                <ClipboardList size={36} style={{ opacity: 0.15, marginBottom: '0.75rem', color: 'var(--color-primary)' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>All clear</p>
                <p style={{ fontSize: '0.7rem', marginTop: '0.15rem', opacity: 0.7 }}>No tasks found in this view.</p>
              </div>
            ) : (
              <>
                {/* Active Tasks */}
                {(filter === 'all' || filter === 'active') && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {activeTasks.map(renderTaskRow)}
                    {activeTasks.length === 0 && filter === 'active' && (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No active tasks.
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Completed Section */}
                {(filter === 'all' || filter === 'completed') && (
                  <>
                    {filter === 'completed' ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {completedTasks.map(renderTaskRow)}
                        {completedTasks.length === 0 && (
                          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            No completed tasks.
                          </div>
                        )}
                      </div>
                    ) : (
                      completedTasks.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            onClick={() => setShowCompleted(!showCompleted)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 1rem',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span>Completed ({completedTasks.length})</span>
                            </div>
                          </button>
                          
                          {showCompleted && (
                            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.25rem' }}>
                              {completedTasks.map(renderTaskRow)}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Slide-out Details Drawer (Floating Island) */}
      {selectedTask && (
        <div 
          className="task-details-drawer glass-panel"
          style={{
            width: '380px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
            backdropFilter: 'var(--glass-blur)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '16px',
            zIndex: 10,
            boxShadow: 'var(--shadow-lg)',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0
          }}
        >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)' }}>
                <Sparkles size={14} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Details</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {/* Trash inside drawer */}
                <button 
                  onClick={handleDeleteFromDrawer}
                  style={{ padding: '0.4rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: '6px' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  title="Delete Task"
                >
                  <Trash2 size={15} />
                </button>
                {/* Close Drawer */}
                <button 
                  onClick={() => setSelectedTask(null)}
                  style={{ padding: '0.4rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: '6px' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Drawer Content Body */}
            <form 
              onSubmit={handleSaveDetails}
              className="custom-scroll"
              style={{
                flex: 1,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                overflowY: 'auto'
              }}
            >
              {/* Task Title Edit */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Name</label>
                <input 
                  type="text" 
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={isSaving}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                />
              </div>

              {/* Grid: Due Date & Priority */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                
                {/* Due Date picker */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</label>
                  <input 
                    type="date" 
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                    disabled={isSaving}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      padding: '0.5rem 0.65rem',
                      fontSize: '0.8rem',
                      outline: 'none',
                      width: '100%'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  />
                </div>

                {/* Priority Selection */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    disabled={isSaving}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text-primary)',
                      padding: '0.5rem 0.65rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <option value="none" style={{ background: '#111' }}>None (General)</option>
                    <option value="low" style={{ background: '#111', color: '#3b82f6' }}>Low</option>
                    <option value="medium" style={{ background: '#111', color: '#eab308' }}>Medium</option>
                    <option value="high" style={{ background: '#111', color: '#ef4444' }}>High / Starred</option>
                  </select>
                </div>
              </div>

              {/* Task Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description / Notes</label>
                <textarea 
                  placeholder="Add details or notes about this task..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isSaving}
                  rows={4}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.8rem',
                    lineHeight: 1.4,
                    resize: 'none',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                />
              </div>

              {/* Subtasks checklist section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subtasks checklist</label>
                
                {/* Subtask items scroll area */}
                <div 
                  className="custom-scroll" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.35rem', 
                    maxHeight: '160px', 
                    overflowY: 'auto' 
                  }}
                >
                  {editSubtasks.map((sub, subIndex) => (
                    <div 
                      key={sub.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'rgba(0,0,0,0.12)', 
                        padding: '0.4rem 0.6rem', 
                        borderRadius: '4px', 
                        border: '1px solid rgba(255,255,255,0.01)' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSubtaskInDrawer(subIndex)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', color: sub.completed ? 'var(--color-success)' : 'var(--text-secondary)' }}
                        >
                          {sub.completed ? <CheckCircle size={14} /> : <Circle size={14} style={{ color: 'var(--text-muted)' }} />}
                        </button>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          color: sub.completed ? 'var(--text-muted)' : 'var(--text-primary)', 
                          textDecoration: sub.completed ? 'line-through' : 'none', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          width: '100%'
                        }}>
                          {sub.text}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteDrawerSubtask(sub.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0.1rem' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Subtask Line */}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <input
                    type="text"
                    placeholder="Add a subtask..."
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDrawerSubtask();
                      }
                    }}
                    style={{ 
                      flex: 1,
                      height: '30px', 
                      fontSize: '0.75rem', 
                      padding: '0.35rem 0.65rem', 
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  />
                  <button
                    type="button"
                    onClick={handleAddDrawerSubtask}
                    className="btn"
                    style={{ 
                      height: '30px', 
                      padding: '0 0.65rem', 
                      fontSize: '0.7rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.2rem', 
                      fontWeight: 600,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  >
                    <Plus size={12} style={{ color: 'var(--color-primary)' }} />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button 
                  type="button" 
                  onClick={() => setSelectedTask(null)} 
                  className="btn"
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || !editTitle.trim()}
                  className="btn-primary" 
                  style={{ 
                    flex: 1, 
                    padding: '0.55rem', 
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--grad-primary)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.25rem',
                    opacity: isSaving || !editTitle.trim() ? 0.5 : 1
                  }}
                >
                  {isSaving ? <Loader2 size={12} className="spin-slow" /> : <Check size={12} />}
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>

            </form>
          </div>
        )}
      </div>
    </div>
  );
};
