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
  Clock
} from 'lucide-react';

interface HabitsBoardProps {
  habits: Habit[];
  habitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } };
  taskLists: GoogleTaskList[];
  onAddHabit: (habitData: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<void>;
  onUpdateHabit: (habitId: string, habitData: Partial<Habit>) => Promise<void>;
  onDeleteHabit: (habit: Habit) => Promise<void>;
  onToggleHabit: (habit: Habit, dateStr: string, currentCompleted: boolean, timeSpent?: number) => Promise<void>;
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

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [colorPreset, setColorPreset] = useState(COLOR_PRESETS[0]);
  const [frequency, setFrequency] = useState<'daily' | 'custom'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Default weekdays Mon-Fri
  const [timeTarget, setTimeTarget] = useState<number>(30); // Default 30 min
  const [syncToCalendar, setSyncToCalendar] = useState(false);
  const [syncToTasks, setSyncToTasks] = useState(false);
  const [taskListId, setTaskListId] = useState('');

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
      return h.daysOfWeek.includes(todayDayOfWeek);
    }
    return true; // daily
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

  const toggleHabit = async (habit: Habit) => {
    const logs = habitLogs[habit.id] || {};
    const isCompleted = logs[todayStr]?.status === 'completed';
    await onToggleHabit(habit, todayStr, isCompleted);
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

  // SVG Progress Ring calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionRateToday / 100) * circumference;

  return (
    <div className="glass-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', overflow: 'hidden' }}>
      
      {/* 1. Header widget with Progress ring */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Habits Tracker</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Consistency is key to mastery.</p>
          </div>
          <button 
            onClick={() => {
              if (taskLists.length > 0) setTaskListId(taskLists[0].id);
              setShowAddModal(true);
            }} 
            className="btn-primary" 
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
          >
            <Plus size={14} /> Add Habit
          </button>
        </div>

        {/* Status ring card */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '1rem', gap: '1.25rem' }}>
          <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ transform: 'rotate(-90deg)', width: '90px', height: '90px' }}>
              <circle
                cx="45"
                cy="45"
                r={radius}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="45"
                cy="45"
                r={radius}
                stroke="var(--color-primary)"
                strokeWidth="7"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset var(--transition-normal)' }}
              />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{completionRateToday}%</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Daily Progress</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {completedHabitsToday.length} of {activeHabitsToday.length} habits completed today.
            </span>
          </div>
        </div>
      </div>

      {/* 2. Habit checklist + heatmap */}
      <div className="custom-scroll" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        
        {/* Checklist */}
        <div>
          <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.75rem' }}>TODAY'S HABITS</h3>
          {activeHabitsToday.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
              <Sparkles size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No habits scheduled for today.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {activeHabitsToday.map(habit => {
                const logs = habitLogs[habit.id] || {};
                const isCompleted = logs[todayStr]?.status === 'completed';
                const streakData = calculateStreak(logs, habit.frequency, habit.daysOfWeek);
                
                // Color mapping
                let habitGrad = COLOR_PRESETS[0].value;
                const match = COLOR_PRESETS.find(p => p.class === habit.color);
                if (match) habitGrad = match.value;

                return (
                  <div 
                    key={habit.id}
                    className={`glass-card ${isCompleted ? 'animate-check' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      cursor: 'pointer',
                      borderLeft: `4px solid transparent`,
                      borderImage: `${habitGrad} 1`,
                      background: isCompleted ? 'rgba(255,255,255,0.01)' : 'var(--bg-card)'
                    }}
                    onClick={() => toggleHabit(habit)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                      {/* Interactive checkbox indicator */}
                      <div 
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: isCompleted ? 'none' : '1px solid var(--border-color)',
                          background: isCompleted ? habitGrad : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isCompleted ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        {isCompleted && <Check size={14} style={{ color: '#fff' }} />}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ 
                          fontSize: '0.9rem', 
                          fontWeight: 500, 
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                          transition: 'all var(--transition-fast)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {habit.title}
                        </span>
                        {habit.description && !isCompleted && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {habit.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Streak badge */}
                      {streakData.currentStreak > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', color: '#f97316' }}>
                          <Flame size={12} fill="#f97316" />
                          <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{streakData.currentStreak}</span>
                        </div>
                      )}
                      
                      {/* Detail triggers */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHabit(habit);
                        }} 
                        style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
                      >
                        <HelpCircle size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Heatmap grid */}
        <div>
          <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.75rem' }}>CONSISTENCY GRID (LAST 30 DAYS)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '0.35rem', background: 'rgba(0,0,0,0.15)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            {getLast30Days().map((date, idx) => (
              <div 
                key={idx}
                title={`${date.toLocaleDateString()} - completion ratio`}
                style={{
                  aspectRatio: '1',
                  borderRadius: '3px',
                  background: getHeatmapColor(date),
                  boxShadow: getHeatmapColor(date).includes('0.85') ? '0 0 8px rgba(99, 102, 241, 0.35)' : 'none',
                  transition: 'background var(--transition-fast)'
                }}
              />
            ))}
          </div>
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
              maxWidth: '460px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create New Habit</h3>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>HABIT NAME</label>
              <input 
                type="text" 
                placeholder="e.g., Daily Gym, Learn Coding, Meditate"
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
                maxLength={40}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>DESCRIPTION (OPTIONAL)</label>
              <input 
                type="text" 
                placeholder="What motivates you?"
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                maxLength={80}
              />
            </div>

            {/* Gradient Theme selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COLOR DESIGN</label>
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
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>FREQUENCY</label>
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
                    borderRadius: '6px'
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
                    borderRadius: '6px'
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
                  TIME TARGET: {timeTarget} MINS
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>INTEGRATIONS</span>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                <input 
                  type="checkbox" 
                  checked={syncToCalendar} 
                  onChange={(e) => setSyncToCalendar(e.target.checked)} 
                  style={{ width: '16px', height: '16px', margin: 0 }}
                />
                <Calendar size={14} style={{ color: 'var(--color-secondary)' }} />
                <span>Auto-Schedule Calendar Events</span>
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
                  <span>Generate Google Tasks Checklist</span>
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
         Habit Details Modal
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
              width: '90%',
              maxWidth: '400px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLOR_PRESETS.find(p => p.class === selectedHabit.color)?.value || COLOR_PRESETS[0].value }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedHabit.title}</h3>
              </div>
              <button onClick={() => setSelectedHabit(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {selectedHabit.description && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                {selectedHabit.description}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', gap: '0.2rem' }}>
                <Flame size={18} style={{ color: 'var(--color-warning)' }} />
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {calculateStreak(habitLogs[selectedHabit.id] || {}, selectedHabit.frequency, selectedHabit.daysOfWeek).currentStreak}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Current Streak</span>
              </div>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', gap: '0.2rem' }}>
                <Sparkles size={18} style={{ color: 'var(--color-secondary)' }} />
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {calculateStreak(habitLogs[selectedHabit.id] || {}, selectedHabit.frequency, selectedHabit.daysOfWeek).longestStreak}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Longest Streak</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CREATED AT</span>
                <span style={{ fontSize: '0.75rem' }}>{new Date(selectedHabit.createdAt).toLocaleDateString()}</span>
              </div>
              
              <button 
                onClick={async () => {
                  if (confirm(`Are you sure you want to delete "${selectedHabit.title}"?`)) {
                    await onDeleteHabit(selectedHabit);
                    setSelectedHabit(null);
                  }
                }}
                className="btn"
                style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
