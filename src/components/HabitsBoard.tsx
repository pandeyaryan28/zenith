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
  Clock,
  BookOpen,
  Target,
  ChevronRight,
  Award,
  BarChart2,
  CalendarDays,
  Info
} from 'lucide-react';
import './HabitsBoard.css';

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
  { name: 'Indigo Dream',   value: 'linear-gradient(135deg, #6366f1, #06b6d4)', solid: '#6366f1', class: 'grad-indigo-cyan' },
  { name: 'Emerald Forest', value: 'linear-gradient(135deg, #06b6d4, #10b981)', solid: '#10b981', class: 'grad-cyan-emerald' },
  { name: 'Sunset Spark',   value: 'linear-gradient(135deg, #ec4899, #f97316)', solid: '#ec4899', class: 'grad-pink-orange' },
  { name: 'Purple Bloom',   value: 'linear-gradient(135deg, #a855f7, #ec4899)', solid: '#a855f7', class: 'grad-purple-pink' },
  { name: 'Solar Gold',     value: 'linear-gradient(135deg, #f59e0b, #ef4444)', solid: '#f59e0b', class: 'grad-amber-red' },
  { name: 'Mint Breeze',    value: 'linear-gradient(135deg, #10b981, #84cc16)', solid: '#84cc16', class: 'grad-emerald-lime' },
];

const CATEGORY_META: Record<string, { icon: string; label: string; color: string }> = {
  all:     { icon: '✦',  label: 'All',     color: '#6366f1' },
  routine: { icon: '🔄', label: 'Routine', color: '#06b6d4' },
  mind:    { icon: '🧘', label: 'Mind',    color: '#a855f7' },
  health:  { icon: '🏃', label: 'Health',  color: '#10b981' },
  work:    { icon: '💼', label: 'Work',    color: '#f59e0b' },
};

const DIFFICULTY_META = {
  easy:   { label: 'Easy',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  hard:   { label: 'Hard',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const HabitsBoard: React.FC<HabitsBoardProps> = ({
  habits,
  habitLogs,
  onAddHabit,
  onDeleteHabit,
  onToggleHabit,
}) => {
  const [showAddModal, setShowAddModal]                 = useState(false);
  const [selectedHabit, setSelectedHabit]               = useState<Habit | null>(null);
  const [completingHabit, setCompletingHabit]           = useState<Habit | null>(null);
  const [completionNote, setCompletionNote]             = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [showMode, setShowMode]                         = useState<'today' | 'all'>('today');

  // Form state
  const [title, setTitle]                 = useState('');
  const [description, setDescription]     = useState('');
  const [colorPreset, setColorPreset]     = useState(COLOR_PRESETS[0]);
  const [frequency, setFrequency]         = useState<'daily' | 'custom'>('daily');
  const [daysOfWeek, setDaysOfWeek]       = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeTarget, setTimeTarget]       = useState<number>(30);
  const [category, setCategory]           = useState<string>('routine');
  const [difficulty, setDifficulty]       = useState<'easy' | 'medium' | 'hard'>('medium');
  const [syncToCalendar, setSyncToCalendar] = useState(false);

  // Date helpers
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = getLocalDateStr(new Date());
  const todayDayOfWeek = new Date().getDay();

  // Habit filter logic
  const filteredHabits = habits.filter(h => {
    if (h.archived) return false;
    
    // Category filter
    if (activeCategoryFilter !== 'all' && h.category !== activeCategoryFilter) return false;
    
    // Mode filter (Show scheduled today vs Show all)
    if (showMode === 'today') {
      if (h.frequency === 'custom' && h.daysOfWeek) {
        if (!h.daysOfWeek.includes(todayDayOfWeek)) return false;
      }
    }
    
    return true;
  });

  // Calculate today's stats based on today's scheduled habits
  const activeHabitsToday = habits.filter(h => {
    if (h.archived) return false;
    if (h.frequency === 'custom' && h.daysOfWeek) {
      return h.daysOfWeek.includes(todayDayOfWeek);
    }
    return true;
  });

  const completedHabitsToday = activeHabitsToday.filter(h =>
    habitLogs[h.id]?.[todayStr]?.status === 'completed'
  );

  const completionRateToday = activeHabitsToday.length > 0
    ? Math.round((completedHabitsToday.length / activeHabitsToday.length) * 100)
    : 0;

  const totalStreaks = habits.reduce((sum, h) => {
    const s = calculateStreak(habitLogs[h.id] || {}, h.frequency, h.daysOfWeek);
    return sum + s.currentStreak;
  }, 0);

  // Form submit handler
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
    });
    // Reset form
    setTitle(''); setDescription(''); setColorPreset(COLOR_PRESETS[0]);
    setFrequency('daily'); setDaysOfWeek([1,2,3,4,5]); setTimeTarget(30);
    setCategory('routine'); setDifficulty('medium'); setSyncToCalendar(false);
    setShowAddModal(false);
  };

  const handleDayToggle = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const handleCheckClick = async (habit: Habit) => {
    const isCompleted = habitLogs[habit.id]?.[todayStr]?.status === 'completed';
    if (isCompleted) {
      await onToggleHabit(habit, todayStr, true);
    } else {
      setCompletingHabit(habit);
      setCompletionNote('');
    }
  };

  const handleSaveCompletionNote = async (skip = false) => {
    if (!completingHabit) return;
    const noteText = skip ? '' : completionNote.trim();
    await onToggleHabit(completingHabit, todayStr, false, completingHabit.timeTargetMinutes, noteText);
    setCompletingHabit(null);
    setCompletionNote('');
  };

  // Heatmap helper functions
  const getLast30Days = () => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d);
    }
    return dates;
  };

  const getHeatmapData = (date: Date) => {
    const dateStr = getLocalDateStr(date);
    const dayOfWeek = date.getDay();
    const scheduled = habits.filter(h => {
      const created = new Date(h.createdAt); created.setHours(0,0,0,0);
      const target  = new Date(date);        target.setHours(0,0,0,0);
      if (target < created || h.archived) return false;
      if (h.frequency === 'custom' && h.daysOfWeek) return h.daysOfWeek.includes(dayOfWeek);
      return true;
    });

    if (scheduled.length === 0) return { ratio: -1 };
    const completed = scheduled.filter(h => habitLogs[h.id]?.[dateStr]?.status === 'completed').length;
    return { ratio: completed / scheduled.length, completed, total: scheduled.length };
  };

  const getHeatmapStyle = (ratio: number) => {
    if (ratio < 0) return { background: 'rgba(255,255,255,0.02)' };
    if (ratio === 0)   return { background: 'rgba(255,255,255,0.06)' };
    if (ratio <= 0.33) return { background: 'rgba(99,102,241,0.22)' };
    if (ratio <= 0.66) return { background: 'rgba(99,102,241,0.52)' };
    return                    { background: 'rgba(99,102,241,0.9)', boxShadow: '0 0 10px rgba(99,102,241,0.45)' };
  };

  const getPresetFromClass = (cls?: string) =>
    COLOR_PRESETS.find(p => p.class === cls) || COLOR_PRESETS[0];

  // SVG Progress Ring metrics
  const ringR = 34;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (completionRateToday / 100) * ringC;

  const last30 = getLast30Days();

  return (
    <div className="habits-container">
      {/* ── HEADER PANEL ─────────────────────────────────── */}
      <div className="habits-header">
        
        {/* Title & Action Row */}
        <div className="habits-title-row">
          <div>
            <h2>
              <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Discipline Dashboard
              </span>
            </h2>
            <p>Track your daily commitments, maintain streaks, and build habits.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="habits-btn-add"
          >
            <Plus size={16} style={{ strokeWidth: 3 }} /> New Habit
          </button>
        </div>

        {/* Stats Row */}
        <div className="habits-stats-row">
          {/* Today's Progress Card */}
          <div className="habits-stat-card progress-card">
            <div style={{ position: 'relative', width: '70px', height: '70px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ transform: 'rotate(-90deg)', position: 'absolute' }} width="70" height="70">
                <circle cx="35" cy="35" r={ringR} stroke="rgba(255,255,255,0.04)" strokeWidth="4.5" fill="transparent" />
                <circle
                  cx="35" cy="35" r={ringR}
                  stroke="url(#ring-gradient)"
                  strokeWidth="4.5" fill="transparent"
                  strokeDasharray={ringC}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
                <defs>
                  <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>{completionRateToday}%</span>
            </div>
            <div>
              <div className="habits-stat-label">TODAY'S SCORE</div>
              <div className="habits-stat-value" style={{ fontSize: '1.25rem', marginTop: '0.15rem' }}>
                {completedHabitsToday.length} / {activeHabitsToday.length}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>completions today</div>
            </div>
          </div>

          {/* Current Streak Card */}
          <div className="habits-stat-card streak-card">
            <div className="habits-stat-icon-wrapper" style={{ background: 'rgba(249,115,22,0.1)' }}>
              <Flame size={22} style={{ color: '#f97316' }} fill="rgba(249,115,22,0.3)" />
            </div>
            <div>
              <div className="habits-stat-label">TOTAL STREAK</div>
              <div className="habits-stat-value" style={{ color: '#f97316' }}>{totalStreaks}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>consecutive days</div>
            </div>
          </div>

          {/* Habits count */}
          <div className="habits-stat-card active-card">
            <div className="habits-stat-icon-wrapper" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <Target size={20} style={{ color: '#10b981' }} />
            </div>
            <div>
              <div className="habits-stat-label">ACTIVE TRACKS</div>
              <div className="habits-stat-value" style={{ color: '#10b981' }}>
                {habits.filter(h => !h.archived).length}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>monitored habits</div>
            </div>
          </div>
        </div>

        {/* 30-Day Heatmap Card */}
        <div className="habits-heatmap-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.07em' }}>
              30-DAY CONSISTENCY MAP
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Less</span>
              {[0, 0.3, 0.6, 1].map((r, i) => (
                <div key={i} style={{ width: '9px', height: '9px', borderRadius: '2px', ...getHeatmapStyle(r) }} />
              ))}
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>More</span>
            </div>
          </div>
          <div className="habits-heatmap-grid">
            {last30.map((date, idx) => {
              const { ratio, completed, total } = getHeatmapData(date) as any;
              return (
                <div
                  key={idx}
                  className="habits-heatmap-node"
                  title={ratio < 0
                    ? date.toLocaleDateString()
                    : `${date.toLocaleDateString()} — ${completed ?? 0}/${total ?? 0} habits completed`}
                  style={getHeatmapStyle(ratio)}
                />
              );
            })}
          </div>
        </div>

        {/* Filters and View modes panel */}
        <div className="habits-filter-bar">
          <div className="habits-category-pills">
            {Object.entries(CATEGORY_META).map(([id, meta]) => {
              const active = activeCategoryFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveCategoryFilter(id)}
                  className={`habits-category-pill ${active ? 'active' : ''}`}
                >
                  <span style={{ fontSize: '0.8rem' }}>{meta.icon}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Show Mode Toggle Switcher */}
          <div className="habits-mode-switcher">
            <button
              onClick={() => setShowMode('today')}
              className={`habits-mode-btn ${showMode === 'today' ? 'active' : ''}`}
            >
              Today's Schedule
            </button>
            <button
              onClick={() => setShowMode('all')}
              className={`habits-mode-btn ${showMode === 'all' ? 'active' : ''}`}
            >
              Show All Habits
            </button>
          </div>
        </div>
      </div>

      {/* ── HABITS GRID CONTAINER ─────────────────────────────── */}
      <div className="habits-grid-container custom-scroll">
        {filteredHabits.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '5rem 2rem', textAlign: 'center',
            border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)',
            background: 'rgba(0,0,0,0.15)'
          }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99,102,241,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Sparkles size={24} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>No Habits Found</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '280px', margin: 0 }}>
              {showMode === 'today' 
                ? 'No habits scheduled for today. Toggle "Show All Habits" or create a new habit.'
                : 'Create a new habit to start tracking your self discipline goals!'}
            </p>
          </div>
        ) : (
          <div className="habits-grid">
            {filteredHabits.map(habit => {
              const logs       = habitLogs[habit.id] || {};
              const isCompleted = logs[todayStr]?.status === 'completed';
              const streakData  = calculateStreak(logs, habit.frequency, habit.daysOfWeek);
              const preset      = getPresetFromClass(habit.color);
              const diffMeta    = DIFFICULTY_META[habit.difficulty || 'medium'];
              const catMeta     = CATEGORY_META[habit.category || 'routine'] || CATEGORY_META.routine;

              // Check if scheduled today
              let isScheduledToday = true;
              if (habit.frequency === 'custom' && habit.daysOfWeek) {
                isScheduledToday = habit.daysOfWeek.includes(todayDayOfWeek);
              }

              return (
                <div
                  key={habit.id}
                  className={`habit-card ${isCompleted ? 'completed' : ''}`}
                >
                  <div className="habit-card-accent" style={{ background: isCompleted ? 'var(--color-success)' : preset.value }} />

                  <div className="habit-card-body">
                    <div className="habit-card-header">
                      {/* Interactive check btn */}
                      <button
                        onClick={() => handleCheckClick(habit)}
                        className="habit-check-btn"
                        title={isCompleted ? 'Mark incomplete' : 'Complete habit'}
                        style={{
                          border: isCompleted ? 'none' : `2px solid ${preset.solid}50`,
                          background: isCompleted ? 'var(--color-success)' : 'transparent',
                          color: '#fff',
                        }}
                      >
                        {isCompleted && <Check size={14} style={{ strokeWidth: 3 }} />}
                      </button>

                      {/* Info block */}
                      <div className="habit-info">
                        <div className="habit-info-title">
                          <span style={{ fontSize: '0.9rem' }}>{catMeta.icon}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {habit.title}
                          </span>
                        </div>
                        {habit.description && (
                          <p className="habit-info-desc">{habit.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Bottom meta row */}
                    <div className="habit-card-footer">
                      <div className="habit-meta-badges">
                        {/* Difficulty badge */}
                        <span className="habit-badge" style={{ color: diffMeta.color, background: diffMeta.bg }}>
                          {diffMeta.label}
                        </span>

                        {/* Duration target */}
                        {habit.timeTargetMinutes && (
                          <span className="habit-duration">
                            <Clock size={11} />
                            {habit.timeTargetMinutes}m
                          </span>
                        )}

                        {/* Rest day indicator when showing all */}
                        {showMode === 'all' && !isScheduledToday && (
                          <span className="habit-badge" style={{ color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                            Rest Day
                          </span>
                        )}
                      </div>

                      <div className="habit-stats-badges">
                        {/* Streak Badge */}
                        {streakData.currentStreak > 0 && (
                          <div className="habit-streak-pill">
                            <Flame size={12} fill="#f97316" />
                            <span>{streakData.currentStreak}d</span>
                          </div>
                        )}

                        {/* Details Modal Trigger */}
                        <button
                          onClick={() => setSelectedHabit(habit)}
                          className="habit-detail-btn"
                          title="View journal & history logs"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          ADD HABIT MODAL drawer
      ══════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="habits-overlay">
          <form onSubmit={handleCreate} className="habits-modal" style={{ maxWidth: '460px' }}>
            <div className="habits-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>Create New Habit</h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Build self-discipline over time</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="habits-modal-body custom-scroll">
              {/* Title */}
              <div className="habits-form-group">
                <label className="habits-form-label">Habit Title</label>
                <input
                  type="text"
                  className="habits-form-input"
                  placeholder="e.g. Read books, Gym session, Meditate"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  maxLength={40}
                />
              </div>

              {/* Description */}
              <div className="habits-form-group">
                <label className="habits-form-label">Description / Motivation (optional)</label>
                <input
                  type="text"
                  className="habits-form-input"
                  placeholder="Keep it short and encouraging"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={80}
                />
              </div>

              {/* Category & Difficulty */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="habits-form-group">
                  <label className="habits-form-label">Category</label>
                  <select className="habits-form-select" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="routine">🔄 Routine</option>
                    <option value="mind">🧘 Mind / Meditation</option>
                    <option value="health">🏃 Health / Fitness</option>
                    <option value="work">💼 Work / Learning</option>
                  </select>
                </div>
                <div className="habits-form-group">
                  <label className="habits-form-label">Difficulty</label>
                  <select className="habits-form-select" value={difficulty} onChange={e => setDifficulty(e.target.value as any)}>
                    <option value="easy">🟢 Easy</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="hard">🔴 Hard</option>
                  </select>
                </div>
              </div>

              {/* Color accent selection */}
              <div className="habits-form-group">
                <label className="habits-form-label">Card Accent Gradient</label>
                <div className="habits-colors-grid">
                  {COLOR_PRESETS.map(preset => {
                    const isSelected = colorPreset.name === preset.name;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setColorPreset(preset)}
                        className={`habits-color-dot ${isSelected ? 'selected' : ''}`}
                        title={preset.name}
                        style={{ background: preset.value }}
                      />
                    );
                  })}
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: colorPreset.value, transition: 'background 0.25s ease', marginTop: '0.2rem' }} />
              </div>

              {/* Schedule options */}
              <div className="habits-form-group">
                <label className="habits-form-label">Repeat Schedule</label>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', gap: '0.25rem', border: '1px solid var(--border-color)' }}>
                  {(['daily', 'custom'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      style={{
                        flex: 1, padding: '0.45rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: frequency === f ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: frequency === f ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {f === 'daily' ? 'Everyday' : 'Specific Days'}
                    </button>
                  ))}
                </div>

                {frequency === 'custom' && (
                  <div className="habits-days-grid" style={{ marginTop: '0.35rem' }}>
                    {DAYS_SHORT.map((dayChar, index) => {
                      const isActive = daysOfWeek.includes(index);
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleDayToggle(index)}
                          className={`habits-day-btn ${isActive ? 'active' : ''}`}
                        >
                          {dayChar[0]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Time target duration slider */}
              <div className="habits-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="habits-form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={13} /> Daily Target Duration
                  </label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-primary)' }}>{timeTarget} mins</span>
                </div>
                <input
                  type="range" min="5" max="180" step="5"
                  value={timeTarget} onChange={e => setTimeTarget(Number(e.target.value))}
                  style={{ outline: 'none', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', cursor: 'pointer' }}
                />
              </div>

              {/* Integrations (Calendar only) */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.2rem' }}>
                <span className="habits-form-label" style={{ fontSize: '0.65rem', display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)' }}>INTEGRATIONS</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={syncToCalendar}
                    onChange={e => setSyncToCalendar(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--color-primary)' }}
                  />
                  <Calendar size={13} style={{ color: 'var(--color-secondary)' }} />
                  <span>Reserve a slot in Google Calendar</span>
                </label>
              </div>
            </div>

            <div className="habits-modal-footer">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}>
                Create Habit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          JOURNAL NOTE COMPLETION MODAL drawer
      ══════════════════════════════════════════════ */}
      {completingHabit && (
        <div className="habits-overlay">
          <div className="habits-modal" style={{ maxWidth: '380px' }}>
            <div className="habits-modal-header" style={{ paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Quick Journal</h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Log for: {completingHabit.title}</p>
                </div>
              </div>
            </div>

            <div className="habits-modal-body" style={{ gap: '1rem' }}>
              <textarea
                className="habits-form-textarea"
                rows={3}
                placeholder="How did it go? Write down reflections, notes, or thoughts..."
                value={completionNote}
                onChange={e => setCompletionNote(e.target.value)}
                style={{ resize: 'none', lineHeight: 1.45 }}
              />
            </div>

            <div className="habits-modal-footer">
              <button onClick={() => handleSaveCompletionNote(true)} className="btn-secondary" style={{ flex: 1, padding: '0.55rem', fontSize: '0.82rem' }}>
                Skip Note
              </button>
              <button onClick={() => handleSaveCompletionNote(false)} className="btn-primary" style={{ flex: 1, padding: '0.55rem', fontSize: '0.82rem', fontWeight: 700 }}>
                Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          HABIT DETAIL / JOURNAL HISTORY MODAL
      ══════════════════════════════════════════════ */}
      {selectedHabit && (() => {
        const preset     = getPresetFromClass(selectedHabit.color);
        const logs       = habitLogs[selectedHabit.id] || {};
        const streakData = calculateStreak(logs, selectedHabit.frequency, selectedHabit.daysOfWeek);
        const diffMeta   = DIFFICULTY_META[selectedHabit.difficulty || 'medium'];
        const entries = Object.keys(logs)
          .filter(d => logs[d].status === 'completed')
          .sort((a, b) => b.localeCompare(a));

        // Format scheduled days string
        let scheduleText = 'Every day';
        if (selectedHabit.frequency === 'custom' && selectedHabit.daysOfWeek) {
          scheduleText = selectedHabit.daysOfWeek.map(d => DAYS_SHORT[d]).join(', ');
        }

        return (
          <div className="habits-overlay">
            <div className="habits-modal" style={{ maxWidth: '420px' }}>
              {/* Custom styled modal header with category gradient */}
              <div style={{ background: preset.value, padding: '1.5rem 1.75rem', position: 'relative' }}>
                <button
                  onClick={() => setSelectedHabit(null)}
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.22)', border: 'none', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'background 0.2s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.35)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.22)'}
                >
                  <X size={14} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>{CATEGORY_META[selectedHabit.category || 'routine']?.icon || '🔄'}</span>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                      {selectedHabit.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.85)', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '99px', background: 'rgba(0,0,0,0.18)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {diffMeta.label}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <CalendarDays size={10} />
                        {scheduleText}
                      </span>
                    </div>
                  </div>
                </div>
                {selectedHabit.description && (
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', margin: '0.85rem 0 0 0', lineHeight: 1.45 }}>{selectedHabit.description}</p>
                )}
              </div>

              {/* Modal Body */}
              <div className="habits-modal-body custom-scroll" style={{ gap: '1.25rem' }}>
                
                {/* Streak stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { icon: <Flame size={16} style={{ color: '#f97316' }} />, value: streakData.currentStreak, label: 'Current Streak', color: '#f97316' },
                    { icon: <Award size={16} style={{ color: '#a855f7' }} />, value: streakData.longestStreak, label: 'Best Streak',    color: '#a855f7' },
                    { icon: <BarChart2 size={16} style={{ color: '#06b6d4' }} />, value: entries.length, label: 'Completions',  color: '#06b6d4' },
                  ].map(({ icon, value, label, color }) => (
                    <div key={label} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                      {icon}
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Journal Logs list */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
                    <BookOpen size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>JOURNAL HISTORY LOGS</span>
                  </div>

                  {entries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.75rem 1rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                      <Info size={16} style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }} />
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>No entries logged yet. Complete the habit to write a quick reflection.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }} className="custom-scroll">
                      {entries.map(dateStr => {
                        const log = logs[dateStr];
                        return (
                          <div key={dateStr} style={{
                            background: 'rgba(0,0,0,0.15)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.65rem 0.8rem',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: preset.solid }}>{dateStr}</span>
                              {log.completedAt && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {log.note ? (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.4, margin: 0 }}>"{log.note}"</p>
                            ) : (
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Checked off — no notes written.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Section */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {selectedHabit.timeTargetMinutes && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={11} /> Target: {selectedHabit.timeTargetMinutes} min/day
                      </span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete "${selectedHabit.title}"? This action is irreversible.`)) {
                        await onDeleteHabit(selectedHabit);
                        setSelectedHabit(null);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      background: 'rgba(239,68,68,0.06)',
                      border: '1px solid rgba(239,68,68,0.18)',
                      color: '#ef4444',
                      padding: '0.45rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem', fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)';
                      e.currentTarget.style.borderColor = 'rgba(239,68,68,0.18)';
                    }}
                  >
                    <Trash2 size={12} /> Delete Habit
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
