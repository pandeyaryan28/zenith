import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Target, 
  Search, 
  MessageSquare, 
  AlertCircle, 
  Award, 
  TrendingUp,
  Volume2,
  VolumeX,
  Eye,
  CalendarDays
} from 'lucide-react';
import { calculateStreak } from '../services/habitService';
import type { Habit, HabitLog } from '../services/habitService';
import './HabitsBoard.css';

interface HabitsBoardProps {
  habits: Habit[];
  habitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } };
  taskLists: any[];
  onAddHabit: (habitData: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<void>;
  onUpdateHabit: (habitId: string, habitData: Partial<Habit>) => Promise<void>;
  onDeleteHabit: (habit: Habit) => Promise<void>;
  onToggleHabit: (habit: Habit, dateStr: string, currentCompleted: boolean, timeSpent?: number, note?: string) => Promise<void>;
}

// 7-day name array
const DAYS_OF_WEEK_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Format local date to YYYY-MM-DD
const getLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Play dynamic Web Audio chime on success
const playCompletionSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'sine';
    const now = audioCtx.currentTime;
    
    // Quick dual-pitch chime sweep
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // D6
    osc.frequency.exponentialRampToValueAtTime(1760.00, now + 0.3);  // A6
    
    gainNode.gain.setValueAtTime(0.12, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (err) {
    console.warn("Audio feedback play failed:", err);
  }
};

export const HabitsBoard: React.FC<HabitsBoardProps> = ({
  habits = [],
  habitLogs = {},
  taskLists = [],
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleHabit,
}) => {
  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<'board' | 'calendar'>('board');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'mind' | 'health' | 'work' | 'routine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Card Expansion details
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  
  // Modals & Popups
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  // Interactive note/time logger on checking off
  const [showLogModal, setShowLogModal] = useState(false);
  const [activeLogHabit, setActiveLogHabit] = useState<Habit | null>(null);
  const [activeLogDate, setActiveLogDate] = useState<string>('');
  const [logNote, setLogNote] = useState('');
  const [logTime, setLogTime] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Wizard Step states for new habit creator
  const [wizardStep, setWizardStep] = useState(1);
  const [newHabit, setNewHabit] = useState({
    title: '',
    description: '',
    category: 'mind' as 'mind' | 'health' | 'work' | 'routine',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    frequency: 'daily' as 'daily' | 'weekly' | 'custom',
    daysOfWeek: [] as number[],
    weeklyTargetCount: 3,
    timeTargetMinutes: 15,
    syncToCalendar: false,
    color: 'grad-indigo',
  });
  // Selected heatmap day details
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null);

  // Generate 53 weeks (371 days) ending today, starting on Sunday
  const yearlyGridData = useMemo(() => {
    const today = new Date();
    const days: Date[] = [];
    
    // Find Sunday of 52 weeks ago (364 days ago)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);
    const startDay = startDate.getDay(); // 0 Sun, 1 Mon...
    startDate.setDate(startDate.getDate() - startDay); // Shift to Sunday of that week
    
    // 53 columns * 7 rows = 371 cells
    for (let i = 0; i < 371; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }
    
    return days;
  }, []);

  // Compute month labels positioned above column headers
  const monthLabelsElements = useMemo(() => {
    const months: string[] = [];
    let prevMonth = -1;
    for (let i = 0; i < 53; i++) {
      const day = yearlyGridData[i * 7];
      if (day) {
        const m = day.getMonth();
        if (m !== prevMonth) {
          prevMonth = m;
          months.push(day.toLocaleDateString(undefined, { month: 'short' }));
        } else {
          months.push('');
        }
      } else {
        months.push('');
      }
    }
    return months;
  }, [yearlyGridData]);

  // Completions on the selected heatmap date
  const selectedDateCompletions = useMemo(() => {
    if (!selectedHeatmapDate) return [];
    const completions: { habitTitle: string; note?: string; duration?: number; category: string }[] = [];
    habits.forEach(h => {
      const logs = habitLogs[h.id] || {};
      if (logs[selectedHeatmapDate] && logs[selectedHeatmapDate].status === 'completed') {
        completions.push({
          habitTitle: h.title,
          note: logs[selectedHeatmapDate].note,
          duration: logs[selectedHeatmapDate].timeSpentMinutes,
          category: h.category || 'mind'
        });
      }
    });
    return completions;
  }, [habits, habitLogs, selectedHeatmapDate]);

  // Reset wizard helper
  const resetWizard = () => {
    setNewHabit({
      title: '',
      description: '',
      category: 'mind',
      difficulty: 'medium',
      frequency: 'daily',
      daysOfWeek: [],
      weeklyTargetCount: 3,
      timeTargetMinutes: 15,
      syncToCalendar: false,
      color: 'grad-indigo',
    });
    setWizardStep(1);
    setEditingHabit(null);
  };

  // Pre-fill fields when editing a habit
  const handleOpenEdit = (habit: Habit, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingHabit(habit);
    setNewHabit({
      title: habit.title,
      description: habit.description || '',
      category: (habit.category as any) || 'mind',
      difficulty: habit.difficulty || 'medium',
      frequency: habit.frequency,
      daysOfWeek: habit.daysOfWeek || [],
      weeklyTargetCount: habit.weeklyTargetCount || 3,
      timeTargetMinutes: habit.timeTargetMinutes || 15,
      syncToCalendar: habit.syncToCalendar || false,
      color: habit.color || 'grad-indigo',
    });
    setWizardStep(1);
    setShowCreateModal(true);
  };

  // Handle Save (Add or Update)
  const handleSaveHabit = async () => {
    if (!newHabit.title.trim()) return;

    // Pick dynamic color based on category if custom is not chosen
    let resolvedColor = newHabit.color;
    if (newHabit.category === 'mind') resolvedColor = 'grad-indigo';
    else if (newHabit.category === 'health') resolvedColor = 'grad-emerald';
    else if (newHabit.category === 'work') resolvedColor = 'grad-cyan';
    else if (newHabit.category === 'routine') resolvedColor = 'grad-purple';

    const habitPayload = {
      title: newHabit.title.trim(),
      description: newHabit.description.trim() || undefined,
      category: newHabit.category,
      difficulty: newHabit.difficulty,
      frequency: newHabit.frequency,
      daysOfWeek: newHabit.frequency === 'custom' ? newHabit.daysOfWeek : undefined,
      weeklyTargetCount: newHabit.frequency === 'weekly' ? newHabit.weeklyTargetCount : undefined,
      timeTargetMinutes: Number(newHabit.timeTargetMinutes) || undefined,
      syncToCalendar: newHabit.syncToCalendar,
      color: resolvedColor,
    };

    try {
      if (editingHabit) {
        await onUpdateHabit(editingHabit.id, habitPayload);
      } else {
        await onAddHabit(habitPayload);
      }
      setShowCreateModal(false);
      resetWizard();
    } catch (err) {
      console.error("Error saving habit:", err);
    }
  };

  // Generate date array for the current week (Mon - Sun)
  const currentWeekDays = useMemo(() => {
    const today = new Date();
    const dayIndex = today.getDay(); // 0 is Sun, 1 is Mon...
    // Adjust to make Monday the start (index 1), Sunday end (index 7)
    const distanceToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + distanceToMonday + i);
      week.push(day);
    }
    return week;
  }, []);

  // Filter and Search Habits
  const filteredHabits = useMemo(() => {
    return habits.filter(h => {
      if (h.archived) return false;
      const matchesCategory = categoryFilter === 'all' || h.category === categoryFilter;
      const matchesSearch = h.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (h.description && h.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [habits, categoryFilter, searchQuery]);

  // Overall calculations for Dashboard Stats
  const todayStr = getLocalDateStr(new Date());
  
  const stats = useMemo(() => {
    const active = habits.filter(h => !h.archived);
    const total = active.length;
    
    let completedToday = 0;
    active.forEach(h => {
      const logs = habitLogs[h.id] || {};
      if (logs[todayStr] && logs[todayStr].status === 'completed') {
        completedToday++;
      }
    });

    // Consistency over the last 7 days
    let scheduledSlots = 0;
    let completedSlots = 0;

    const last7Days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d);
    }

    active.forEach(h => {
      const logs = habitLogs[h.id] || {};
      last7Days.forEach(day => {
        const dateStr = getLocalDateStr(day);
        const dayOfWeekNum = day.getDay();
        
        let isScheduled = false;
        if (h.frequency === 'daily') isScheduled = true;
        else if (h.frequency === 'custom' && h.daysOfWeek && h.daysOfWeek.includes(dayOfWeekNum)) isScheduled = true;
        else if (h.frequency === 'weekly') isScheduled = true; // Count weekly targets generically as 1 slot per week check

        if (isScheduled) {
          scheduledSlots++;
          if (logs[dateStr] && logs[dateStr].status === 'completed') {
            completedSlots++;
          }
        }
      });
    });

    const consistencyRate = scheduledSlots > 0 ? Math.round((completedSlots / scheduledSlots) * 100) : 0;

    // Highest current streak
    let bestStreak = 0;
    active.forEach(h => {
      const { currentStreak } = calculateStreak(habitLogs[h.id] || {}, h.frequency, h.daysOfWeek);
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }
    });

    return {
      total,
      completedToday,
      consistencyRate,
      bestStreak
    };
  }, [habits, habitLogs, todayStr]);

  // Toggle Completion logic (trigger optional details/notes popup)
  const handleToggleClick = (habit: Habit, dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const logs = habitLogs[habit.id] || {};
    const isCompleted = !!(logs[dateStr] && logs[dateStr].status === 'completed');

    if (!isCompleted) {
      // Prompt user to add a quick note or duration
      setActiveLogHabit(habit);
      setActiveLogDate(dateStr);
      setLogNote('');
      setLogTime(habit.timeTargetMinutes || 0);
      setShowLogModal(true);
    } else {
      // Directly untoggle without prompts
      onToggleHabit(habit, dateStr, true);
    }
  };

  // Submit complete log
  const submitHabitCompletion = async () => {
    if (!activeLogHabit || !activeLogDate) return;
    try {
      await onToggleHabit(
        activeLogHabit, 
        activeLogDate, 
        false, // toggling completion to true
        logTime > 0 ? logTime : undefined, 
        logNote.trim() || undefined
      );
      if (soundEnabled) {
        playCompletionSound();
      }
      setShowLogModal(false);
      setActiveLogHabit(null);
    } catch (err) {
      console.error("Failed to complete habit:", err);
    }
  };

  // Delete habit handler
  const handleDeleteClick = async (habit: Habit, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the habit "${habit.title}"? This cannot be undone.`)) {
      try {
        await onDeleteHabit(habit);
        if (expandedHabitId === habit.id) setExpandedHabitId(null);
      } catch (err) {
        console.error("Failed to delete habit:", err);
      }
    }
  };

  // Quick category list configuration
  const CATEGORIES = [
    { value: 'all', label: 'All Fields' },
    { value: 'mind', label: '🧠 Mind' },
    { value: 'health', label: '🥗 Health' },
    { value: 'work', label: '💼 Work' },
    { value: 'routine', label: '⚡ Routine' },
  ];

  return (
    <div className="habits-container">
      {/* HEADER SECTION */}
      <div className="habits-header">
        <div className="habits-title-section">
          <h1>Habits & Consistency</h1>
          <p>Establish tiny daily routines to accomplish massive long-term goals.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="action-btn-secondary"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute audio cues" : "Unmute audio cues"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span style={{ fontSize: '0.8rem' }}>{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>
          
          <button 
            className="action-btn"
            onClick={() => { resetWizard(); setShowCreateModal(true); }}
          >
            <Plus size={18} /> New Habit
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW BAR */}
      <div className="habits-stats-bar">
        <div className="habits-stat-card stat-primary">
          <div className="habits-stat-icon-wrapper">
            <Target size={20} />
          </div>
          <div className="habits-stat-info">
            <span className="habits-stat-label">Active Habits</span>
            <span className="habits-stat-value">{stats.total}</span>
          </div>
        </div>

        <div className="habits-stat-card stat-success">
          <div className="habits-stat-icon-wrapper">
            <Check size={20} />
          </div>
          <div className="habits-stat-info">
            <span className="habits-stat-label">Checked Today</span>
            <span className="habits-stat-value">{stats.completedToday}</span>
          </div>
        </div>

        <div className="habits-stat-card stat-secondary">
          <div className="habits-stat-icon-wrapper">
            <TrendingUp size={20} />
          </div>
          <div className="habits-stat-info">
            <span className="habits-stat-label">Weekly Consistency</span>
            <span className="habits-stat-value">{stats.consistencyRate}%</span>
          </div>
        </div>

        <div className="habits-stat-card stat-warning">
          <div className="habits-stat-icon-wrapper">
            <Award size={20} />
          </div>
          <div className="habits-stat-info">
            <span className="habits-stat-label">Longest Active Streak</span>
            <span className="habits-stat-value">{stats.bestStreak}d</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="habits-toolbar">
        <div className="habits-tabs">
          <button 
            className={`habits-tab ${activeTab === 'board' ? 'active' : ''}`}
            onClick={() => setActiveTab('board')}
          >
            📋 Habits Board
          </button>
          <button 
            className={`habits-tab ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            📅 Consistency Heatmap
          </button>
        </div>

        <div className="habits-actions">
          {activeTab === 'board' && (
            <div className="habits-tabs" style={{ marginRight: '0.5rem' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  className={`habits-tab ${categoryFilter === cat.value ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat.value as any)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} />
            <input 
              type="text" 
              placeholder="Search habits..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* BOARD VIEW */}
      {activeTab === 'board' && (
        <div className="habits-grid">
          {filteredHabits.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <AlertCircle size={48} style={{ margin: '0 auto 1rem auto', color: 'var(--text-muted)' }} />
              <h3>No habits found</h3>
              <p>Add a new habit slot or adjust your category filter to get started.</p>
            </div>
          ) : (
            filteredHabits.map(habit => {
              const logs = habitLogs[habit.id] || {};
              const isCompletedToday = !!(logs[todayStr] && logs[todayStr].status === 'completed');
              const { currentStreak } = calculateStreak(logs, habit.frequency, habit.daysOfWeek);
              const isExpanded = expandedHabitId === habit.id;

              // Format helper for schedules
              let scheduleDesc = 'Daily';
              if (habit.frequency === 'custom' && habit.daysOfWeek) {
                scheduleDesc = habit.daysOfWeek.map(d => DAYS_OF_WEEK_SHORT[d]).join(', ');
              } else if (habit.frequency === 'weekly') {
                scheduleDesc = `${habit.weeklyTargetCount} times / week`;
              }

              return (
                <div 
                  key={habit.id} 
                  className={`habit-card cat-${habit.category || 'mind'}`}
                >
                  <div className="habit-card-header">
                    <div className="habit-title-area">
                      <h3 className="habit-card-title">{habit.title}</h3>
                      <div className="habit-badge-row">
                        <span className={`habit-badge badge-${habit.category || 'mind'}`}>
                          {habit.category || 'mind'}
                        </span>
                        <span className={`habit-badge badge-difficulty-${habit.difficulty || 'medium'}`}>
                          {habit.difficulty || 'medium'}
                        </span>
                        {habit.timeTargetMinutes && (
                          <span className="habit-badge">
                            ⏱️ {habit.timeTargetMinutes}m
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="habit-toggle-container">
                      <button 
                        className={`habit-check-btn ${isCompletedToday ? 'completed' : ''}`}
                        onClick={(e) => handleToggleClick(habit, todayStr, e)}
                        title={isCompletedToday ? "Mark uncompleted for today" : "Mark completed for today"}
                      >
                        {isCompletedToday ? <Check size={20} /> : <Plus size={20} />}
                      </button>
                    </div>
                  </div>

                  {habit.description && (
                    <p className="habit-card-desc">{habit.description}</p>
                  )}

                  {/* 7-DAY WEEKLY TRACKER STRIP */}
                  <div className="habit-week-strip">
                    {currentWeekDays.map((day, idx) => {
                      const dateStr = getLocalDateStr(day);
                      const dayOfWeek = day.getDay();
                      const isFuture = day > new Date();
                      
                      // Check if completed
                      const isDayCompleted = !!(logs[dateStr] && logs[dateStr].status === 'completed');
                      
                      // Check if scheduled
                      let isScheduled = true;
                      if (habit.frequency === 'custom' && habit.daysOfWeek) {
                        isScheduled = habit.daysOfWeek.includes(dayOfWeek);
                      }

                      return (
                        <div 
                          key={idx} 
                          className="habit-day-col"
                          onClick={(e) => {
                            if (!isFuture) handleToggleClick(habit, dateStr, e);
                          }}
                        >
                          <span className="habit-day-label">{DAYS_OF_WEEK_SHORT[dayOfWeek].substring(0, 1)}</span>
                          <span className={`habit-day-bubble ${isDayCompleted ? 'completed' : ''} ${isFuture ? 'future' : ''} ${!isScheduled ? 'not-scheduled' : ''}`}>
                            {isDayCompleted ? <Check size={12} /> : day.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="habit-card-footer">
                    <div className="habit-streak-display">
                      🔥 <span>{currentStreak} day streak</span>
                    </div>

                    <div className="habit-card-actions">
                      <button 
                        className="habit-card-action-btn"
                        onClick={() => setExpandedHabitId(isExpanded ? null : habit.id)}
                        title={isExpanded ? "Collapse calendar & notes" : "Expand calendar & notes"}
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        className="habit-card-action-btn"
                        onClick={(e) => handleOpenEdit(habit, e)}
                        title="Edit habit details"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        className="habit-card-action-btn btn-delete-hover"
                        onClick={(e) => handleDeleteClick(habit, e)}
                        title="Delete habit"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* EXPANDABLE DRAWER SECTION */}
                  {isExpanded && (
                    <div className="habit-drawer">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* 30-Day mini heatmap grid */}
                        <div className="heatmap-wrapper">
                          <h4 className="drawer-section-title">
                            <CalendarDays size={14} /> Last 30 Days
                          </h4>
                          <div className="heatmap-grid">
                            {Array.from({ length: 28 }).map((_, index) => {
                              const d = new Date();
                              d.setDate(d.getDate() - (27 - index));
                              const dateStr = getLocalDateStr(d);
                              const isCellCompleted = !!(logs[dateStr] && logs[dateStr].status === 'completed');
                              
                              return (
                                <div 
                                  key={index} 
                                  className={`heatmap-cell ${isCellCompleted ? 'completed' : ''}`}
                                  title={`${dateStr}: ${isCellCompleted ? 'Completed' : 'No Log'}`}
                                  onClick={() => handleToggleClick(habit, dateStr, {} as any)}
                                >
                                  <div className="tooltip">
                                    {d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Recent Notes history */}
                        <div>
                          <h4 className="drawer-section-title">
                            <MessageSquare size={14} /> Log History
                          </h4>
                          <div className="logs-list">
                            {Object.keys(logs)
                              .sort((a, b) => b.localeCompare(a))
                              .filter(d => logs[d].status === 'completed')
                              .slice(0, 5)
                              .map(dateStr => {
                                const log = logs[dateStr];
                                return (
                                  <div key={dateStr} className="log-item">
                                    <span className="log-date">{dateStr.substring(5)}</span>
                                    {log.note && <span className="log-note">"{log.note}"</span>}
                                    {log.timeSpentMinutes && (
                                      <span className="log-duration">{log.timeSpentMinutes}m</span>
                                    )}
                                  </div>
                                );
                              })}
                            {Object.keys(logs).filter(d => logs[d].status === 'completed').length === 0 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                No completions recorded yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                        <span>📅 Frequency: <strong>{scheduleDesc}</strong></span>
                        <span>🔔 Sync Calendar: <strong>{habit.syncToCalendar ? 'Active' : 'No'}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* HEATMAP/COMPREHENSIVE CALENDAR VIEW */}
      {activeTab === 'calendar' && (
        <div className="habits-calendar-view">
          <div className="calendar-heatmap-header">
            <h3 className="calendar-heatmap-title">Annual Consistency Overview</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Visualizing overall completion rates across all scheduled habits.
            </span>
          </div>
          {/* Generates a full Github-style Heatmap of the past year (53 weeks) */}
          <div className="heatmap-container-wrapper">
            <div className="weekday-labels">
              <div className="weekday-label"></div>
              <div className="weekday-label">Mon</div>
              <div className="weekday-label"></div>
              <div className="weekday-label">Wed</div>
              <div className="weekday-label"></div>
              <div className="weekday-label">Fri</div>
              <div className="weekday-label"></div>
            </div>

            <div className="heatmap-grid-scrollable">
              {/* Months Row */}
              <div className="month-labels">
                {monthLabelsElements.map((label, idx) => (
                  <div key={idx} className="month-label">
                    {label}
                  </div>
                ))}
              </div>

              {/* Heatmap Grid */}
              <div className="yearly-heatmap-grid">
                {yearlyGridData.map((day, index) => {
                  const dateStr = getLocalDateStr(day);
                  
                  // Count completions on this day
                  let completionsCount = 0;
                  habits.forEach(h => {
                    const logs = habitLogs[h.id] || {};
                    if (logs[dateStr] && logs[dateStr].status === 'completed') {
                      completionsCount++;
                    }
                  });

                  let levelClass = '';
                  if (completionsCount === 1) levelClass = 'level-1';
                  else if (completionsCount === 2) levelClass = 'level-2';
                  else if (completionsCount === 3) levelClass = 'level-3';
                  else if (completionsCount > 3) levelClass = 'level-4';

                  const isSelected = selectedHeatmapDate === dateStr;

                  return (
                    <div 
                      key={index} 
                      className={`yearly-cell ${levelClass} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedHeatmapDate(dateStr)}
                      title={`${dateStr}: ${completionsCount} habits checked`}
                    >
                      <div className="tooltip">
                        {day.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}: {completionsCount} done
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="calendar-legend">
            <span>Less</span>
            <div className="legend-box" />
            <div className="legend-box level-1" />
            <div className="legend-box level-2" />
            <div className="legend-box level-3" />
            <div className="legend-box level-4" />
            <span>More</span>
          </div>

          {/* Interactive Date details view */}
          {selectedHeatmapDate && (
            <div className="feed-item" style={{ border: '1px solid var(--color-primary-glow)', background: 'rgba(99, 102, 241, 0.04)' }}>
              <div className="feed-header">
                <span style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📅 Activity on {selectedHeatmapDate}
                </span>
                <button 
                  onClick={() => setSelectedHeatmapDate(null)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
              {selectedDateCompletions.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>
                  No habits completed on this date.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {selectedDateCompletions.map((item, idx) => (
                    <div key={idx} className={`log-item cat-${item.category}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{item.habitTitle}</strong>
                      {item.duration && <span style={{ color: 'var(--color-secondary)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>⏱️ {item.duration}m</span>}
                      {item.note && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' }}>"{item.note}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="heatmap-notes-feed">
            <h4 className="drawer-section-title" style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <MessageSquare size={16} /> Recent Notes Feed
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {habits.flatMap(habit => {
                const logs = habitLogs[habit.id] || {};
                return Object.keys(logs)
                  .filter(d => logs[d].status === 'completed' && logs[d].note)
                  .map(dateStr => ({
                    habitTitle: habit.title,
                    dateStr,
                    note: logs[dateStr].note,
                    time: logs[dateStr].timeSpentMinutes
                  }));
              })
              .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
              .slice(0, 6)
              .map((item, idx) => (
                <div key={idx} className="feed-item">
                  <div className="feed-header">
                    <span className="feed-habit-title">{item.habitTitle}</span>
                    <span className="feed-date">{item.dateStr}</span>
                  </div>
                  <p className="feed-content">"{item.note}"</p>
                  {item.time && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-secondary)', fontWeight: 600 }}>
                      ⏱️ Logged {item.time} minutes
                    </span>
                  )}
                </div>
              ))}

              {habits.flatMap(h => Object.values(habitLogs[h.id] || {}).filter(l => l.note)).length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No logged notes found. Write notes when completing tasks to see them here!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC LOGGING POPUP */}
      {showLogModal && activeLogHabit && (
        <div className="habits-modal-backdrop" onClick={() => setShowLogModal(false)}>
          <div className="habits-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Log: {activeLogHabit.title}</h2>
              <button className="modal-close-btn" onClick={() => setShowLogModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body log-modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                Optionally log the details of your completion for <strong>{activeLogDate}</strong>.
              </p>
              
              <div className="form-group">
                <label>Time Spent (Minutes)</label>
                <input 
                  type="number" 
                  value={logTime} 
                  onChange={(e) => setLogTime(Math.max(0, Number(e.target.value)))}
                  className="form-control"
                  placeholder="e.g. 15"
                />
                <div className="duration-quick-picks">
                  {[5, 10, 15, 30, 45, 60].map(mins => (
                    <button 
                      key={mins}
                      type="button" 
                      className={`quick-pick-btn ${logTime === mins ? 'active' : ''}`}
                      onClick={() => setLogTime(mins)}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Add Note / Reflection</label>
                <textarea 
                  value={logNote} 
                  onChange={(e) => setLogNote(e.target.value)}
                  className="form-control"
                  placeholder="How did it go? Keep it brief..."
                  rows={3}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                className="action-btn-secondary" 
                onClick={() => {
                  // Complete with default duration and no note
                  onToggleHabit(activeLogHabit, activeLogDate, false);
                  if (soundEnabled) playCompletionSound();
                  setShowLogModal(false);
                }}
              >
                Skip Details
              </button>
              <button className="action-btn" onClick={submitHabitCompletion}>
                Save Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HABIT WIZARD MODAL (CREATOR / EDITOR) */}
      {showCreateModal && (
        <div className="habits-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="habits-modal">
            <div className="modal-header">
              <h2>{editingHabit ? 'Edit Habit Details' : 'Create New Habit'}</h2>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Step 1: Core Details */}
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label>Habit Title *</label>
                    <input 
                      type="text" 
                      value={newHabit.title}
                      onChange={(e) => setNewHabit({...newHabit, title: e.target.value})}
                      className="form-control" 
                      placeholder="e.g. Read morning news, Meditate"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Description / Motivation</label>
                    <textarea 
                      value={newHabit.description}
                      onChange={(e) => setNewHabit({...newHabit, description: e.target.value})}
                      className="form-control" 
                      placeholder="Why is this important? What's your trigger slot?"
                      rows={3}
                      style={{ resize: 'none' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Category Field</label>
                    <div className="category-picker-grid">
                      {[
                        { val: 'mind', label: 'Mind', color: 'dot-mind' },
                        { val: 'health', label: 'Health', color: 'dot-health' },
                        { val: 'work', label: 'Work', color: 'dot-work' },
                        { val: 'routine', label: 'Routine', color: 'dot-routine' }
                      ].map(cat => (
                        <label key={cat.val} className="segment-item">
                          <input 
                            type="radio" 
                            name="category" 
                            value={cat.val}
                            checked={newHabit.category === cat.val}
                            onChange={() => setNewHabit({...newHabit, category: cat.val as any})}
                          />
                          <div className="category-tile">
                            <span className={`category-color-dot ${cat.color}`} />
                            <span>{cat.label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Frequency & Scheduling */}
              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label>Frequency Slot</label>
                    <div className="segmented-grid">
                      {[
                        { val: 'daily', label: 'Every Day' },
                        { val: 'custom', label: 'Specific Days' },
                        { val: 'weekly', label: 'Weekly Target' }
                      ].map(freq => (
                        <label key={freq.val} className="segment-item">
                          <input 
                            type="radio" 
                            name="frequency" 
                            value={freq.val}
                            checked={newHabit.frequency === freq.val}
                            onChange={() => setNewHabit({...newHabit, frequency: freq.val as any})}
                          />
                          <div className="segment-button">
                            <span>{freq.label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {newHabit.frequency === 'custom' && (
                    <div className="form-group">
                      <label>Select Scheduled Days</label>
                      <div className="days-selector-grid">
                        {DAYS_OF_WEEK_SHORT.map((dayName, idx) => {
                          const isChecked = newHabit.daysOfWeek.includes(idx);
                          return (
                            <label key={idx} className="day-checkbox-label">
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={(e) => {
                                  let days = [...newHabit.daysOfWeek];
                                  if (e.target.checked) {
                                    days.push(idx);
                                  } else {
                                    days = days.filter(d => d !== idx);
                                  }
                                  setNewHabit({...newHabit, daysOfWeek: days.sort()});
                                }}
                              />
                              <div className="day-checkbox-tile">
                                {dayName.substring(0, 1)}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {newHabit.frequency === 'weekly' && (
                    <div className="form-group">
                      <label>Weekly Completions Target (1 - 7)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="7" 
                        value={newHabit.weeklyTargetCount}
                        onChange={(e) => setNewHabit({...newHabit, weeklyTargetCount: Math.min(7, Math.max(1, Number(e.target.value)))})}
                        className="form-control"
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Task Difficulty Scale</label>
                    <div className="segmented-grid">
                      {['easy', 'medium', 'hard'].map(diff => (
                        <label key={diff} className="segment-item">
                          <input 
                            type="radio" 
                            name="difficulty" 
                            value={diff}
                            checked={newHabit.difficulty === diff}
                            onChange={() => setNewHabit({...newHabit, difficulty: diff as any})}
                          />
                          <div className="segment-button" style={{ textTransform: 'capitalize' }}>
                            <span>{diff}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Target Timers & Integrations */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label>Target Length (Minutes)</label>
                    <input 
                      type="number" 
                      value={newHabit.timeTargetMinutes}
                      onChange={(e) => setNewHabit({...newHabit, timeTargetMinutes: Math.max(1, Number(e.target.value))})}
                      className="form-control"
                      placeholder="e.g. 15, 30"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={newHabit.syncToCalendar}
                        onChange={(e) => setNewHabit({...newHabit, syncToCalendar: e.target.checked})}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>Sync schedule slot automatically to Google Calendar</span>
                    </label>
                  </div>

                  {taskLists.length > 0 && (
                    <div className="form-group">
                      <label>Link to List of Tasks (Optional)</label>
                      <select 
                        className="form-control"
                        onChange={(e) => console.log("Link list:", e.target.value)}
                      >
                        <option value="">Do not link to a task list</option>
                        {taskLists.map((list: any) => (
                          <option key={list.id} value={list.id}>{list.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <div className="wizard-progress">
                <span className={`wizard-dot ${wizardStep >= 1 ? 'active' : ''}`} />
                <span className={`wizard-dot ${wizardStep >= 2 ? 'active' : ''}`} />
                <span className={`wizard-dot ${wizardStep >= 3 ? 'active' : ''}`} />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {wizardStep > 1 && (
                  <button 
                    className="action-btn-secondary"
                    onClick={() => setWizardStep(wizardStep - 1)}
                  >
                    Back
                  </button>
                )}

                {wizardStep < 3 ? (
                  <button 
                    className="action-btn"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={wizardStep === 1 && !newHabit.title.trim()}
                  >
                    Next
                  </button>
                ) : (
                  <button 
                    className="action-btn"
                    onClick={handleSaveHabit}
                    disabled={!newHabit.title.trim()}
                  >
                    {editingHabit ? 'Save Changes' : 'Create Habit'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
