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
  Clock,
  BookOpen,
  Target,
  Zap,
  TrendingUp,
  ChevronRight,
  Award,
  BarChart2
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

export const HabitsBoard: React.FC<HabitsBoardProps> = ({
  habits,
  habitLogs,
  taskLists,
  onAddHabit,
  onDeleteHabit,
  onToggleHabit,
}) => {
  const [showAddModal, setShowAddModal]           = useState(false);
  const [selectedHabit, setSelectedHabit]         = useState<Habit | null>(null);
  const [completingHabit, setCompletingHabit]     = useState<Habit | null>(null);
  const [completionNote, setCompletionNote]        = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');

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
  const [syncToTasks, setSyncToTasks]     = useState(false);
  const [taskListId, setTaskListId]       = useState('');

  // Date helpers
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = getLocalDateStr(new Date());
  const todayDayOfWeek = new Date().getDay();

  const activeHabitsToday = habits.filter(h => {
    if (h.archived) return false;
    if (h.frequency === 'custom' && h.daysOfWeek) {
      if (!h.daysOfWeek.includes(todayDayOfWeek)) return false;
    }
    if (activeCategoryFilter !== 'all' && h.category !== activeCategoryFilter) return false;
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

  // Handle form submit
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
      googleTaskListId: syncToTasks ? taskListId : undefined,
    });
    setTitle(''); setDescription(''); setColorPreset(COLOR_PRESETS[0]);
    setFrequency('daily'); setDaysOfWeek([1,2,3,4,5]); setTimeTarget(30);
    setCategory('routine'); setDifficulty('medium');
    setSyncToCalendar(false); setSyncToTasks(false); setTaskListId('');
    setShowAddModal(false);
  };

  const handleDayToggle = (day: number) => {
    if (daysOfWeek.includes(day)) setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    else setDaysOfWeek([...daysOfWeek, day].sort());
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

  // Heatmap
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
    if (ratio === 0)   return { background: 'rgba(255,255,255,0.05)' };
    if (ratio <= 0.33) return { background: 'rgba(99,102,241,0.2)',  boxShadow: 'none' };
    if (ratio <= 0.66) return { background: 'rgba(99,102,241,0.5)',  boxShadow: '0 0 4px rgba(99,102,241,0.25)' };
    return                    { background: 'rgba(99,102,241,0.9)',  boxShadow: '0 0 8px rgba(99,102,241,0.5)' };
  };

  const getPresetFromClass = (cls?: string) =>
    COLOR_PRESETS.find(p => p.class === cls) || COLOR_PRESETS[0];

  // SVG progress ring
  const ringR = 36;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (completionRateToday / 100) * ringC;

  const last30 = getLast30Days();

  /* ─────────────────────────────────────────────── */
  return (
    <div
      className="glass-panel"
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', overflow: 'hidden' }}
    >
      {/* ── HEADER ─────────────────────────────────── */}
      <div style={{ padding: '1.5rem 1.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Habits
              </span>
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              Build discipline with streaks, journals & visual progress.
            </p>
          </div>
          <button
            onClick={() => { if (taskLists.length > 0) setTaskListId(taskLists[0].id); setShowAddModal(true); }}
            className="btn-primary"
            style={{ padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <Plus size={15} /> New Habit
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>

          {/* Today's progress ring */}
          <div
            className="glass-card"
            style={{ padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <div style={{ position: 'relative', width: '76px', height: '76px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ transform: 'rotate(-90deg)', position: 'absolute' }} width="76" height="76">
                <circle cx="38" cy="38" r={ringR} stroke="rgba(255,255,255,0.04)" strokeWidth="5" fill="transparent" />
                <circle
                  cx="38" cy="38" r={ringR}
                  stroke="url(#ring-grad)"
                  strokeWidth="5" fill="transparent"
                  strokeDasharray={ringC}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.16,1,0.3,1)' }}
                />
                <defs>
                  <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{completionRateToday}%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.2rem' }}>Today's Progress</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {completedHabitsToday.length} / {activeHabitsToday.length} done
              </div>
              <div style={{ marginTop: '0.55rem', height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${completionRateToday}%`,
                  background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                  borderRadius: '99px',
                  transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)'
                }} />
              </div>
            </div>
          </div>

          {/* Streak total */}
          <div
            className="glass-card"
            style={{ padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.9rem', background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.12)' }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Flame size={22} style={{ color: '#f97316' }} fill="rgba(249,115,22,0.4)" />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1, color: '#f97316' }}>{totalStreaks}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Total streak days</div>
            </div>
          </div>

          {/* Habits count */}
          <div
            className="glass-card"
            style={{ padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.9rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Target size={20} style={{ color: '#10b981' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1, color: '#10b981' }}>{habits.filter(h => !h.archived).length}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Active habits</div>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="glass-card" style={{ padding: '0.9rem 1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              30-Day Consistency
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Less</span>
              {[0, 0.3, 0.6, 1].map((r, i) => (
                <div key={i} style={{ width: '10px', height: '10px', borderRadius: '3px', ...getHeatmapStyle(r) }} />
              ))}
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>More</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: '3px' }}>
            {last30.map((date, idx) => {
              const { ratio, completed, total } = getHeatmapData(date) as any;
              return (
                <div
                  key={idx}
                  title={ratio < 0
                    ? date.toLocaleDateString()
                    : `${date.toLocaleDateString()} — ${completed ?? 0}/${total ?? 0} habits`}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '3px',
                    cursor: 'default',
                    transition: 'transform 0.1s ease',
                    ...getHeatmapStyle(ratio),
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Category pill filters */}
        <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '2px' }} className="custom-scroll">
          {Object.entries(CATEGORY_META).map(([id, meta]) => {
            const active = activeCategoryFilter === id;
            return (
              <button
                key={id}
                onClick={() => setActiveCategoryFilter(id)}
                style={{
                  padding: '0.3rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${active ? meta.color + '60' : 'var(--border-color)'}`,
                  background: active ? meta.color + '18' : 'rgba(255,255,255,0.02)',
                  color: active ? meta.color : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── HABITS GRID ─────────────────────────────── */}
      <div className="custom-scroll" style={{ padding: '1.25rem 1.75rem', overflowY: 'auto' }}>
        {activeHabitsToday.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '4rem 2rem', textAlign: 'center',
            border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)',
            background: 'rgba(0,0,0,0.08)'
          }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Sparkles size={26} style={{ color: 'var(--color-primary)' }} />
            </div>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>No habits here yet</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Switch category or create a new habit to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '0.9rem' }}>
            {activeHabitsToday.map(habit => {
              const logs       = habitLogs[habit.id] || {};
              const isCompleted = logs[todayStr]?.status === 'completed';
              const streakData  = calculateStreak(logs, habit.frequency, habit.daysOfWeek);
              const preset      = getPresetFromClass(habit.color);
              const diffMeta    = DIFFICULTY_META[habit.difficulty || 'medium'];
              const catMeta     = CATEGORY_META[habit.category || 'routine'] || CATEGORY_META.routine;

              return (
                <div
                  key={habit.id}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    background: isCompleted ? 'rgba(16,185,129,0.04)' : 'var(--bg-card)',
                    border: isCompleted
                      ? '1px solid rgba(16,185,129,0.2)'
                      : '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {/* Gradient top accent bar */}
                  <div style={{ height: '3px', background: isCompleted ? '#10b981' : preset.value, flexShrink: 0 }} />

                  <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                    {/* Top row: check + title */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      {/* Check button */}
                      <button
                        onClick={() => handleCheckClick(habit)}
                        title={isCompleted ? 'Mark incomplete' : 'Complete habit'}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          border: isCompleted ? 'none' : `2px solid ${preset.solid}60`,
                          background: isCompleted ? preset.value : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          marginTop: '1px',
                          transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                          boxShadow: isCompleted ? `0 0 12px ${preset.solid}40` : 'none',
                        }}
                      >
                        {isCompleted && <Check size={13} style={{ color: '#fff', strokeWidth: 3 }} />}
                      </button>

                      {/* Title + desc */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.88rem' }}>{catMeta.icon}</span>
                          <span style={{
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                            textDecoration: isCompleted ? 'line-through' : 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.2s ease',
                          }}>
                            {habit.title}
                          </span>
                        </div>
                        {habit.description && (
                          <p style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.35',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {habit.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.7rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {/* Difficulty badge */}
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          padding: '0.18rem 0.45rem',
                          borderRadius: '99px',
                          color: diffMeta.color,
                          background: diffMeta.bg,
                        }}>
                          {diffMeta.label}
                        </span>

                        {/* Time target */}
                        {habit.timeTargetMinutes && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            <Clock size={10} />
                            {habit.timeTargetMinutes}m
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Streak pill */}
                        {streakData.currentStreak > 0 && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            padding: '0.18rem 0.5rem', borderRadius: '99px',
                            background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.18)',
                            color: '#f97316',
                          }}>
                            <Flame size={11} fill="#f97316" />
                            <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{streakData.currentStreak}</span>
                          </div>
                        )}

                        {/* Journal / detail button */}
                        <button
                          onClick={() => setSelectedHabit(habit)}
                          title="View journal & stats"
                          style={{
                            width: '26px', height: '26px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--text-muted)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <ChevronRight size={13} />
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
          ADD HABIT MODAL
      ══════════════════════════════════════════════ */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <form
            onSubmit={handleCreate}
            style={{
              width: '92%', maxWidth: '480px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
              display: 'flex', flexDirection: 'column', gap: '1.1rem',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '90vh', overflowY: 'auto',
            }}
            className="custom-scroll"
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Create New Habit</h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Track a routine, skill or wellness goal.</p>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={15} />
              </button>
            </div>

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Habit Title</label>
              <input
                type="text"
                placeholder="e.g., Morning Yoga, Read 20 pages…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required maxLength={40}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Motivation (optional)</label>
              <input
                type="text"
                placeholder="Keep it brief and encouraging."
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={80}
              />
            </div>

            {/* Category + Difficulty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="routine">🔄 Routine</option>
                  <option value="mind">🧘 Mind / Meditation</option>
                  <option value="health">🏃 Health / Fitness</option>
                  <option value="work">💼 Work / Learning</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value as any)}>
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>
              </div>
            </div>

            {/* Color preset */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Card Accent Color</label>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {COLOR_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setColorPreset(preset)}
                    title={preset.name}
                    style={{
                      width: '30px', height: '30px',
                      borderRadius: '50%',
                      background: preset.value,
                      border: colorPreset.name === preset.name ? '2.5px solid #fff' : '2.5px solid transparent',
                      boxShadow: colorPreset.name === preset.name ? `0 0 0 2px ${preset.solid}` : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  />
                ))}
              </div>
              {/* Preview bar */}
              <div style={{ height: '4px', borderRadius: '99px', background: colorPreset.value, transition: 'background 0.2s ease' }} />
            </div>

            {/* Schedule */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Schedule</label>
              <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.25)', padding: '0.3rem', borderRadius: 'var(--radius-sm)' }}>
                {(['daily', 'custom'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    style={{
                      flex: 1, padding: '0.45rem', fontSize: '0.8rem', fontWeight: 600,
                      background: frequency === f ? 'rgba(99,102,241,0.18)' : 'transparent',
                      border: frequency === f ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      borderRadius: '6px',
                      color: frequency === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    {f === 'daily' ? 'Every Day' : 'Specific Days'}
                  </button>
                ))}
              </div>
              {frequency === 'custom' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.3rem', marginTop: '0.25rem' }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, index) => {
                    const active = daysOfWeek.includes(index);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleDayToggle(index)}
                        style={{
                          flex: 1, aspectRatio: '1',
                          borderRadius: '8px',
                          background: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active ? 'transparent' : 'var(--border-color)'}`,
                          fontSize: '0.72rem', fontWeight: 700,
                          color: active ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer', transition: 'all 0.15s ease',
                        }}
                      >
                        {dayChar}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Time target slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={12} /> Daily Duration
                </label>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-primary)' }}>{timeTarget} min</span>
              </div>
              <input
                type="range" min="5" max="180" step="5"
                value={timeTarget} onChange={e => setTimeTarget(Number(e.target.value))}
                style={{ padding: 0, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}
              />
            </div>

            {/* Integrations */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Google Integrations</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                <input type="checkbox" checked={syncToCalendar} onChange={e => setSyncToCalendar(e.target.checked)} style={{ width: '15px', height: '15px', margin: 0 }} />
                <Calendar size={13} style={{ color: 'var(--color-secondary)' }} />
                <span>Auto-schedule Calendar slots</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={syncToTasks} onChange={e => setSyncToTasks(e.target.checked)} style={{ width: '15px', height: '15px', margin: 0 }} />
                  <CheckSquare size={13} style={{ color: 'var(--color-primary)' }} />
                  <span>Generate Google Tasks checkbox</span>
                </label>
                {syncToTasks && taskLists.length > 0 && (
                  <select value={taskListId} onChange={e => setTaskListId(e.target.value)} style={{ fontSize: '0.8rem', padding: '0.4rem', marginTop: '0.2rem' }}>
                    {taskLists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                )}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.25rem', padding: '0.75rem', fontWeight: 700, fontSize: '0.88rem' }}>
              <Plus size={15} /> Create Habit
            </button>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          COMPLETION NOTE MODAL
      ══════════════════════════════════════════════ */}
      {completingHabit && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '90%', maxWidth: '380px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.6rem',
            display: 'flex', flexDirection: 'column', gap: '1rem',
            boxShadow: 'var(--shadow-lg)',
          }}>
            {/* Accent bar */}
            <div style={{ height: '3px', borderRadius: '99px', background: getPresetFromClass(completingHabit.color).value, marginBottom: '0.1rem' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={17} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Quick Journal</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>Logging: <strong style={{ color: 'var(--text-secondary)' }}>{completingHabit.title}</strong></p>
              </div>
            </div>

            <textarea
              rows={3}
              placeholder="How did it go? Any reflections…"
              value={completionNote}
              onChange={e => setCompletionNote(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem',
                fontSize: '0.82rem',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                resize: 'none', lineHeight: 1.5,
              }}
            />

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={() => handleSaveCompletionNote(true)} className="btn-secondary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.82rem' }}>
                Skip
              </button>
              <button onClick={() => handleSaveCompletionNote(false)} className="btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.82rem', fontWeight: 700 }}>
                <Check size={14} /> Log Complete
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

        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '92%', maxWidth: '420px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '85vh', overflow: 'hidden',
            }}>
              {/* Gradient header */}
              <div style={{ background: preset.value, padding: '1.25rem 1.5rem', position: 'relative' }}>
                <button
                  onClick={() => setSelectedHabit(null)}
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                >
                  <X size={14} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{CATEGORY_META[selectedHabit.category || 'routine']?.icon || '🔄'}</span>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                      {selectedHabit.title}
                    </h3>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, padding: '0.12rem 0.45rem', borderRadius: '99px', background: 'rgba(0,0,0,0.15)' }}>
                      {diffMeta.label}
                    </span>
                  </div>
                </div>
                {selectedHabit.description && (
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', marginTop: '0.5rem', lineHeight: 1.4 }}>{selectedHabit.description}</p>
                )}
              </div>

              {/* Scrollable body */}
              <div className="custom-scroll" style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                {/* Streak stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                  {[
                    { icon: <Flame size={16} style={{ color: '#f97316' }} />, value: streakData.currentStreak, label: 'Current', color: '#f97316' },
                    { icon: <Award size={16} style={{ color: '#a855f7' }} />, value: streakData.longestStreak, label: 'Best',    color: '#a855f7' },
                    { icon: <BarChart2 size={16} style={{ color: '#06b6d4' }} />, value: entries.length, label: 'Total',  color: '#06b6d4' },
                  ].map(({ icon, value, label, color }) => (
                    <div key={label} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                      {icon}
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Journal history */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <BookOpen size={13} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Journal History</span>
                  </div>

                  {entries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                      <Sparkles size={20} style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }} />
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No completions logged yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '220px', overflowY: 'auto' }} className="custom-scroll">
                      {entries.map(dateStr => {
                        const log = logs[dateStr];
                        return (
                          <div key={dateStr} style={{
                            background: 'rgba(0,0,0,0.12)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.65rem 0.75rem',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: preset.solid }}>{dateStr}</span>
                              {log.completedAt && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {log.note ? (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.4 }}>"{log.note}"</p>
                            ) : (
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Completed — no note added.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
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
                      if (confirm(`Delete "${selectedHabit.title}"?`)) {
                        await onDeleteHabit(selectedHabit);
                        setSelectedHabit(null);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444',
                      padding: '0.4rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem', fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} /> Delete
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
