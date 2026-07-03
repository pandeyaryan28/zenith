import React, { useState } from 'react';
import type { Habit, HabitLog } from '../services/habitService';
import type { GoogleTaskList } from '../services/googleApi';
import { calculateStreak } from '../services/habitService';
import { 
  Plus, 
  Flame, 
  Check, 
  Trash2, 
  Sparkles, 
  X,
  Calendar,
  CheckSquare,
  HelpCircle,
  Clock,
  BookOpen
} from 'lucide-react';

interface HabitsBoardProps {
  habits: Habit[];
  habitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } };
  taskLists: GoogleTaskList[];
  onAddHabit: (habitData: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<void>;
  onUpdateHabit: (habitId: string, habitData: Partial<Habit>) => Promise<void>;
  onDeleteHabit: (habit: Habit) => Promise<void>;
  onToggleHabit: (habit: Habit, dateStr: string, currentCompleted: boolean, timeSpent?: number, note?: string) => Promise<void>;
}

const COLOR_PRESETS = [
  { name: 'Indigo Dream', value: 'linear-gradient(135deg, #6366f1, #06b6d4)', class: 'grad-indigo-cyan' },
  { name: 'Emerald Forest', value: 'linear-gradient(135deg, #06b6d4, #10b981)', class: 'grad-cyan-emerald' },
  { name: 'Sunset Spark', value: 'linear-gradient(135deg, #ec4899, #f97316)', class: 'grad-pink-orange' },
  { name: 'Purple Bloom', value: 'linear-gradient(135deg, #a855f7, #ec4899)', class: 'grad-purple-pink' },
];

export const HabitsBoard: React.FC<HabitsBoardProps> = ({
  habits,
  habitLogs,
  taskLists,
  onAddHabit,
  onDeleteHabit,
  onToggleHabit
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  
  // Note Modal state (when completing a habit)
  const [completingHabit, setCompletingHabit] = useState<Habit | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [colorPreset, setColorPreset] = useState(COLOR_PRESETS[0]);
  const [frequency, setFrequency] = useState<'daily' | 'custom'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Default weekdays Mon-Fri
  const [timeTarget, setTimeTarget] = useState<number>(30); // Default 30 min
  const [category, setCategory] = useState<string>('routine');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [syncToCalendar, setSyncToCalendar] = useState(false);
  const [syncToTasks, setSyncToTasks] = useState(false);
  const [taskListId, setTaskListId] = useState('');

  // Active Category Filter
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Date helper utilities
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = getLocalDateStr(new Date());
  const todayDayOfWeek = new Date().getDay();

  // Filters for today's habits
  const activeHabitsToday = habits.filter(h => {
    if (h.archived) return false;
    if (h.frequency === 'custom' && h.daysOfWeek) {
      if (!h.daysOfWeek.includes(todayDayOfWeek)) return false;
    }
    if (activeCategoryFilter !== 'all' && h.category !== activeCategoryFilter) {
      return false;
    }
    return true;
  });

  const completedHabitsToday = activeHabitsToday.filter(h => {
    const logs = habitLogs[h.id] || {};
    return logs[todayStr]?.status === 'completed';
  });

  const completionRateToday = activeHabitsToday.length > 0 
    ? Math.round((completedHabitsToday.length / activeHabitsToday.length) * 100) 
    : 0;

  // Handle Create Habit
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onAddHabit({
      title: title.trim(),
      description: description.trim() || undefined,
      color: colorPreset.class,
      frequency: frequency === 'daily' ? 'daily' : 'custom',
      daysOfWeek: frequency === 'custom' ? daysOfWeek : undefined,
      timeTargetMinutes: timeTarget > 0 ? timeTarget : undefined,
      category,
      difficulty,
      syncToCalendar,
      syncToTasks,
      googleTaskListId: syncToTasks ? taskListId : undefined
    });

    // Reset Form
    setTitle('');
    setDescription('');
    setColorPreset(COLOR_PRESETS[0]);
    setFrequency('daily');
    setDaysOfWeek([1, 2, 3, 4, 5]);
    setTimeTarget(30);
    setCategory('routine');
    setDifficulty('medium');
    setSyncToCalendar(false);
    setSyncToTasks(false);
    setTaskListId('');
    setShowAddModal(false);
  };

  const handleDayToggle = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  // Handle completion check click
  const handleCheckClick = async (habit: Habit) => {
    const logs = habitLogs[habit.id] || {};
    const isCompleted = logs[todayStr]?.status === 'completed';
    
    if (isCompleted) {
      // Uncheck immediately
      await onToggleHabit(habit, todayStr, true);
    } else {
      // Open Note Modal for completion log
      setCompletingHabit(habit);
      setCompletionNote('');
    }
  };

  const handleSaveCompletionNote = async (skip: boolean = false) => {
    if (!completingHabit) return;
    const noteText = skip ? '' : completionNote.trim();
    await onToggleHabit(completingHabit, todayStr, false, completingHabit.timeTargetMinutes, noteText);
    setCompletingHabit(null);
    setCompletionNote('');
  };

  // Generate last 30 days for Heatmap
  const getLast30Days = () => {
    const dates = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d);
    }
    return dates;
  };

  const getHeatmapColor = (date: Date) => {
    const dateStr = getLocalDateStr(date);
    const dayOfWeek = date.getDay();
    
    // Find habits scheduled for this day
    const scheduled = habits.filter(h => {
      const created = new Date(h.createdAt);
      created.setHours(0,0,0,0);
      const target = new Date(date);
      target.setHours(0,0,0,0);
      if (target < created || h.archived) return false;
      
      if (h.frequency === 'custom' && h.daysOfWeek) {
        return h.daysOfWeek.includes(dayOfWeek);
      }
      return true; // daily
    });
    
    if (scheduled.length === 0) return 'rgba(255, 255, 255, 0.015)';
    
    const completed = scheduled.filter(h => {
      const logs = habitLogs[h.id] || {};
      return logs[dateStr]?.status === 'completed';
    }).length;
    
    const ratio = completed / scheduled.length;
    if (ratio === 0) return 'rgba(255, 255, 255, 0.04)';
    if (ratio <= 0.33) return 'rgba(99, 102, 241, 0.15)';
    if (ratio <= 0.66) return 'rgba(99, 102, 241, 0.45)';
    return 'rgba(99, 102, 241, 0.85)'; // glowing indigo
  };

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'mind': return '🧘';
      case 'health': return '🏃';
      case 'work': return '💼';
      default: return '🔄';
    }
  };

  const getDifficultyColor = (diff?: 'easy' | 'medium' | 'hard') => {
    switch (diff) {
      case 'easy': return 'var(--color-success)';
      case 'hard': return 'var(--color-danger)';
      default: return 'var(--color-warning)';
    }
  };

  // SVG Progress Ring calculations
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionRateToday / 100) * circumference;

  return (
    <div className="glass-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', overflow: 'hidden' }}>
      
      {/* 1. Header widget with Progress ring */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Habits Tracker</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Build long term discipline with categories & visual journals.</p>
          </div>
          <button 
            onClick={() => {
              if (taskLists.length > 0) setTaskListId(taskLists[0].id);
              setShowAddModal(true);
            }} 
            className="btn-primary" 
            style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)' }}
          >
            <Plus size={16} /> Add Habit
          </button>
        </div>

        {/* Progress dashboard summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '1rem', gap: '1.25rem' }}>
            <div style={{ position: 'relative', width: '85px', height: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ transform: 'rotate(-90deg)', width: '85px', height: '85px' }}>
                <circle
                  cx="42.5"
                  cy="42.5"
                  r={radius}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="42.5"
                  cy="42.5"
                  r={radius}
                  stroke="var(--color-primary)"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset var(--transition-normal)' }}
                />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{completionRateToday}%</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Daily Checklist</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {completedHabitsToday.length} of {activeHabitsToday.length} habits completed today.
              </span>
            </div>
          </div>

          {/* Consistency Heatmap Card */}
          <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>CONSISTENCY (LAST 30 DAYS)</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: '0.25rem' }}>
              {getLast30Days().map((date, idx) => (
                <div 
                  key={idx}
                  title={`${date.toLocaleDateString()}`}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '2px',
                    background: getHeatmapColor(date),
                    boxShadow: getHeatmapColor(date).includes('0.85') ? '0 0 6px rgba(99, 102, 241, 0.3)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

        </div>

        {/* Category Filters row */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }} className="custom-scroll">
          {[
            { id: 'all', label: '📁 All Category' },
            { id: 'routine', label: '🔄 Routine' },
            { id: 'mind', label: '🧘 Mind' },
            { id: 'health', label: '🏃 Health' },
            { id: 'work', label: '💼 Work' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveCategoryFilter(item.id)}
              className="btn"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                background: activeCategoryFilter === item.id ? 'var(--color-primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                border: activeCategoryFilter === item.id ? '1px solid var(--border-active)' : '1px solid var(--border-color)',
                color: activeCategoryFilter === item.id ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Habits Grid List */}
      <div className="custom-scroll" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {activeHabitsToday.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '3rem 1rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
              <Sparkles size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>No habits fit this category today.</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Change the category filters above or create a new habit.</p>
            </div>
          ) : (
            activeHabitsToday.map(habit => {
              const logs = habitLogs[habit.id] || {};
              const isCompleted = logs[todayStr]?.status === 'completed';
              const streakData = calculateStreak(logs, habit.frequency, habit.daysOfWeek);
              
              let habitGrad = COLOR_PRESETS[0].value;
              const match = COLOR_PRESETS.find(p => p.class === habit.color);
              if (match) habitGrad = match.value;

              return (
                <div 
                  key={habit.id}
                  className={`glass-card ${isCompleted ? 'animate-check' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderLeft: `5px solid transparent`,
                    borderImage: `${habitGrad} 1`,
                    background: isCompleted ? 'rgba(255,255,255,0.01)' : 'var(--bg-card)',
                    position: 'relative',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                    
                    {/* Checkbox circle */}
                    <div 
                      onClick={() => handleCheckClick(habit)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: isCompleted ? 'none' : '2px solid var(--border-color)',
                        background: isCompleted ? habitGrad : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isCompleted ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none',
                        transition: 'all var(--transition-fast)',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {isCompleted && <Check size={14} style={{ color: '#fff' }} />}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '1rem', fontStyle: 'normal' }}>
                          {getCategoryIcon(habit.category)}
                        </span>
                        <span style={{ 
                          fontSize: '1rem', 
                          fontWeight: 700, 
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                          transition: 'all var(--transition-fast)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {habit.title}
                        </span>
                      </div>
                      {habit.description && (
                        <p style={{ 
                          fontSize: '0.75rem', 
                          color: 'var(--text-secondary)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '1.25'
                        }}>
                          {habit.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card bottom details */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '0.75rem' }}>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {/* Difficulty Badge */}
                      <span style={{ 
                        fontSize: '0.65rem', 
                        padding: '0.15rem 0.4rem', 
                        borderRadius: '4px', 
                        background: 'rgba(0,0,0,0.2)', 
                        color: getDifficultyColor(habit.difficulty),
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        border: `1px solid ${getDifficultyColor(habit.difficulty)}20`
                      }}>
                        {habit.difficulty || 'medium'}
                      </span>

                      {/* Time Target */}
                      {habit.timeTargetMinutes && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Clock size={11} /> {habit.timeTargetMinutes}m
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Streak */}
                      {streakData.currentStreak > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
                          <Flame size={12} fill="#f97316" />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{streakData.currentStreak}</span>
                        </div>
                      )}
                      
                      {/* Help/Detail Trigger */}
                      <button 
                        onClick={() => setSelectedHabit(habit)} 
                        style={{ padding: '0.3rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                        title="View journal history"
                      >
                        <HelpCircle size={15} />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* =========================================================================
         Add Habit Modal Overlay
         ========================================================================= */}
      {showAddModal && (
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
          <form 
            onSubmit={handleCreate} 
            className="glass-panel" 
            style={{
              width: '90%',
              maxWidth: '500px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Create New Habit</h3>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>HABIT TITLE</label>
              <input 
                type="text" 
                placeholder="e.g., Learn French, Morning Yoga, Drink Water"
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
                maxLength={40}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MOTIVATION OR DETAILS (OPTIONAL)</label>
              <input 
                type="text" 
                placeholder="Keep it brief and encouraging."
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                maxLength={80}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              
              {/* Category Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CATEGORY</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="routine">🔄 Routine</option>
                  <option value="mind">🧘 Mind / Meditation</option>
                  <option value="health">🏃 Health / Fitness</option>
                  <option value="work">💼 Work / Learning</option>
                </select>
              </div>

              {/* Difficulty Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>DIFFICULTY WEIGHT</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>
              </div>

            </div>

            {/* Gradient Theme selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CARD COLOR GRADES</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setColorPreset(preset)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: preset.value,
                      border: colorPreset.name === preset.name ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: colorPreset.name === preset.name ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            {/* Frequency Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SCHEDULE</label>
              <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
                <button
                  type="button"
                  onClick={() => setFrequency('daily')}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    fontSize: '0.8rem',
                    background: frequency === 'daily' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: frequency === 'daily' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setFrequency('custom')}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    fontSize: '0.8rem',
                    background: frequency === 'custom' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: frequency === 'custom' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Specific Days
                </button>
              </div>

              {frequency === 'custom' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem', marginTop: '0.5rem' }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, index) => {
                    const active = daysOfWeek.includes(index);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleDayToggle(index)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          background: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                          color: active ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {dayChar}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Time Commitment target */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  DAILY DURATION TARGET: {timeTarget} MINS
                </label>
              </div>
              <input 
                type="range" 
                min="5" 
                max="180" 
                step="5"
                value={timeTarget}
                onChange={(e) => setTimeTarget(Number(e.target.value))}
                style={{ padding: 0, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}
              />
            </div>

            {/* Integrations */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>GOOGLE INTEGRATIONS</span>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                <input 
                  type="checkbox" 
                  checked={syncToCalendar} 
                  onChange={(e) => setSyncToCalendar(e.target.checked)} 
                  style={{ width: '16px', height: '16px', margin: 0 }}
                />
                <Calendar size={14} style={{ color: 'var(--color-secondary)' }} />
                <span>Auto-Schedule Calendar slots</span>
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                  <input 
                    type="checkbox" 
                    checked={syncToTasks} 
                    onChange={(e) => setSyncToTasks(e.target.checked)} 
                    style={{ width: '16px', height: '16px', margin: 0 }}
                  />
                  <CheckSquare size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>Generate Google Tasks checkbox</span>
                </label>
                
                {syncToTasks && taskLists.length > 0 && (
                  <select 
                    value={taskListId} 
                    onChange={(e) => setTaskListId(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem', marginTop: '0.2rem' }}
                  >
                    {taskLists.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}>
              Create Habit
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
         Completion Journal Note Modal
         ========================================================================= */}
      {completingHabit && (
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
          <div 
            className="glass-panel" 
            style={{
              width: '90%',
              maxWidth: '380px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={18} style={{ color: 'var(--color-primary)' }} />
              Habit Journal Note
            </h3>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Would you like to write a quick reflection or journal note for completing <strong>{completingHabit.title}</strong>?
            </p>

            <textarea 
              rows={3}
              placeholder="e.g., Felt energized today! Run completed in 20 mins."
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.85rem',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                resize: 'none'
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                onClick={() => handleSaveCompletionNote(true)} 
                className="btn-secondary" 
                style={{ flex: 1, padding: '0.6rem' }}
              >
                Skip Note
              </button>
              <button 
                onClick={() => handleSaveCompletionNote(false)} 
                className="btn-primary" 
                style={{ flex: 1, padding: '0.6rem' }}
              >
                Log Completion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         Habit Details & Journal History Modal
         ========================================================================= */}
      {selectedHabit && (
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
          <div 
            className="glass-panel" 
            style={{
              width: '95%',
              maxWidth: '440px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '85vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <span style={{ fontSize: '1.2rem' }}>{getCategoryIcon(selectedHabit.category)}</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedHabit.title}
                </h3>
              </div>
              <button onClick={() => setSelectedHabit(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {selectedHabit.description && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                {selectedHabit.description}
              </p>
            )}

            {/* Streaks row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', gap: '0.2rem' }}>
                <Flame size={18} style={{ color: 'var(--color-warning)' }} />
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {calculateStreak(habitLogs[selectedHabit.id] || {}, selectedHabit.frequency, selectedHabit.daysOfWeek).currentStreak}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Current Streak</span>
              </div>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', gap: '0.2rem' }}>
                <Sparkles size={18} style={{ color: 'var(--color-secondary)' }} />
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {calculateStreak(habitLogs[selectedHabit.id] || {}, selectedHabit.frequency, selectedHabit.daysOfWeek).longestStreak}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Longest Streak</span>
              </div>
            </div>

            {/* Past Journal Entries / Log Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>JOURNAL NOTES HISTORY</span>
              <div style={{ 
                maxHeight: '180px', 
                overflowY: 'auto', 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: 'var(--radius-sm)', 
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.75rem'
              }} className="custom-scroll">
                {(() => {
                  const logs = habitLogs[selectedHabit.id] || {};
                  const entries = Object.keys(logs)
                    .filter(dateStr => logs[dateStr].status === 'completed')
                    .sort((a, b) => b.localeCompare(a)); // Sort newest first

                  if (entries.length === 0) {
                    return (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '1rem' }}>
                        No completion entries logged yet.
                      </span>
                    );
                  }

                  return entries.map(dateStr => {
                    const log = logs[dateStr];
                    return (
                      <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                          <span>{dateStr}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {log.completedAt ? new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        {log.note ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginTop: '0.15rem', fontStyle: 'italic' }}>
                            "{log.note}"
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Completed (no journal note logged)
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DIFFICULTY</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: getDifficultyColor(selectedHabit.difficulty), textTransform: 'capitalize' }}>
                  {selectedHabit.difficulty || 'medium'}
                </span>
              </div>
              
              <button 
                onClick={async () => {
                  if (confirm(`Are you sure you want to delete "${selectedHabit.title}"?`)) {
                    await onDeleteHabit(selectedHabit);
                    setSelectedHabit(null);
                  }
                }}
                className="btn"
                style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                <Trash2 size={14} /> Delete Habit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
