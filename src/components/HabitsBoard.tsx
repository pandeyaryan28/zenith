import React, { useState, useEffect } from 'react';
import type { Habit, HabitLog } from '../services/habitService';
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
  Info,
  Play,
  Pause,
  RotateCcw,
  Search,
  Edit3,
  Heart,
  Brain,
  Briefcase,
  Activity,
  Award,
  CalendarDays,
  CheckCircle2
} from 'lucide-react';
import './HabitsBoard.css';

// ── COLOR PRESETS FOR THE GRADIENTS ─────────────────────────
const COLOR_PRESETS = [
  { name: 'Indigo Aura',   value: 'linear-gradient(135deg, #6366f1, #06b6d4)', solid: '#6366f1', glow: 'rgba(99, 102, 241, 0.35)', class: 'grad-indigo-cyan' },
  { name: 'Emerald Forest', value: 'linear-gradient(135deg, #06b6d4, #10b981)', solid: '#10b981', glow: 'rgba(16, 185, 129, 0.35)', class: 'grad-cyan-emerald' },
  { name: 'Sunset Fusion',  value: 'linear-gradient(135deg, #ec4899, #f97316)', solid: '#ec4899', glow: 'rgba(236, 72, 153, 0.35)', class: 'grad-pink-orange' },
  { name: 'Violet Nebula',  value: 'linear-gradient(135deg, #a855f7, #ec4899)', solid: '#a855f7', glow: 'rgba(168, 85, 247, 0.35)', class: 'grad-purple-pink' },
  { name: 'Solar Ember',    value: 'linear-gradient(135deg, #f59e0b, #ef4444)', solid: '#ef4444', glow: 'rgba(239, 68, 68, 0.35)', class: 'grad-amber-red' },
  { name: 'Mint Breeze',    value: 'linear-gradient(135deg, #10b981, #84cc16)', solid: '#84cc16', glow: 'rgba(132, 204, 22, 0.35)', class: 'grad-emerald-lime' },
];

// ── CATEGORIES CONFIGURATION ────────────────────────────────
const CATEGORIES: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  routine: { icon: <Activity size={15} />, label: 'Routine', color: '#06b6d4' },
  mind:    { icon: <Brain size={15} />,    label: 'Mind & Meditation', color: '#a855f7' },
  health:  { icon: <Heart size={15} />,    label: 'Health & Fitness', color: '#10b981' },
  work:    { icon: <Briefcase size={15} />,  label: 'Work & Learning', color: '#f59e0b' },
  other:   { icon: <Sparkles size={15} />,  label: 'Other', color: '#ec4899' },
};

const DIFFICULTY_META = {
  easy:   { label: 'Easy',   color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)' },
  hard:   { label: 'Hard',   color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)',  border: 'rgba(239, 68, 68, 0.2)'  },
};

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_HEADER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── MOODS METADATA ──────────────────────────────────────────
const MOOD_META: Record<string, { emoji: string; label: string; color: string }> = {
  awesome:    { emoji: '🌟', label: 'Awesome', color: '#10b981' },
  good:       { emoji: '😊', label: 'Good', color: '#06b6d4' },
  neutral:    { emoji: '😐', label: 'Neutral', color: '#64748b' },
  tired:      { emoji: '🥱', label: 'Tired', color: '#f59e0b' },
  struggling: { emoji: '🥺', label: 'Struggling', color: '#ef4444' },
};

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

interface HabitsBoardProps {
  habits: Habit[];
  habitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } };
  taskLists: any[];
  onAddHabit: (habitData: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<void>;
  onUpdateHabit: (habitId: string, habitData: Partial<Habit>) => Promise<void>;
  onDeleteHabit: (habit: Habit) => Promise<void>;
  onToggleHabit: (habit: Habit, dateStr: string, currentCompleted: boolean, timeSpent?: number, note?: string) => Promise<void>;
}

// Helper to format local YYYY-MM-DD date strings
const getLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Parse Description text and checklist items out of a composite description field:
// Format: "motivation text ||todo:task1|done:task2"
const parseDescriptionAndChecklist = (descStr?: string): { descriptionText: string; checklist: SubTask[] } => {
  if (!descStr) return { descriptionText: '', checklist: [] };
  
  const parts = descStr.split('||');
  const descriptionText = parts[0].trim();
  const checklistPart = parts[1];
  
  if (!checklistPart) return { descriptionText, checklist: [] };
  
  const checklist: SubTask[] = [];
  const items = checklistPart.split('|');
  items.forEach((item, index) => {
    const match = item.match(/^(todo|done):(.*)$/);
    if (match) {
      checklist.push({
        id: `task-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: match[2].trim(),
        completed: match[1] === 'done'
      });
    }
  });
  
  return { descriptionText, checklist };
};

// SVG Progress Ring Component
const ProgressRing: React.FC<{
  radius: number;
  stroke: number;
  progress: number;
  color1?: string;
  color2?: string;
  gradientId: string;
}> = ({ radius, stroke, progress, color1 = '#6366f1', color2 = '#06b6d4', gradientId }) => {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <circle
        stroke="rgba(255, 255, 255, 0.04)"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke={`url(#${gradientId})`}
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={circumference + ' ' + circumference}
        style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        strokeLinecap="round"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
    </svg>
  );
};

export const HabitsBoard: React.FC<HabitsBoardProps> = ({
  habits = [],
  habitLogs = {},
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleHabit,
}) => {
  // Navigation & Filtering State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'streak' | 'difficulty'>('name');

  // Slide-over Drawers State
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [inspectingHabit, setInspectingHabit] = useState<Habit | null>(null);

  // Journal completion Modal State
  const [completingHabit, setCompletingHabit] = useState<Habit | null>(null);
  const [journalNote, setJournalNote] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('awesome');

  // Inline Timer State
  const [activeTimer, setActiveTimer] = useState<{
    habitId: string;
    habitTitle: string;
    secondsRemaining: number;
    totalSeconds: number;
    isPlaying: boolean;
  } | null>(null);

  // Sound Beep helper
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.45); // C6
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.error("Audio Context beep failed", e);
    }
  };

  // Focus Timer interval effect
  useEffect(() => {
    let intervalId: any = null;
    if (activeTimer && activeTimer.isPlaying && activeTimer.secondsRemaining > 0) {
      intervalId = setInterval(() => {
        setActiveTimer(prev => {
          if (!prev) return null;
          if (prev.secondsRemaining <= 1) {
            clearInterval(intervalId);
            playBeep();
            // Automatically prompt check-off
            const habit = habits.find(h => h.id === prev.habitId);
            if (habit) {
              setCompletingHabit(habit);
              setSelectedMood('awesome');
              setJournalNote(`Completed timed session of ${Math.round(prev.totalSeconds / 60)} minutes.`);
            }
            return null;
          }
          return {
            ...prev,
            secondsRemaining: prev.secondsRemaining - 1
          };
        });
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTimer?.isPlaying, activeTimer?.secondsRemaining, habits]);

  // Form Field States (Add / Edit Habit)
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formChecklistText, setFormChecklistText] = useState('');
  const [formCategory, setFormCategory] = useState('routine');
  const [formDifficulty, setFormDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [formColor, setFormColor] = useState(COLOR_PRESETS[0]);
  const [formFrequency, setFormFrequency] = useState<'daily' | 'custom'>('daily');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formTimeTarget, setFormTimeTarget] = useState<number>(15);
  const [formSyncCalendar, setFormSyncCalendar] = useState(false);

  // Parse Metadata Tag from Log Notes: `[MOOD:awesome] text`
  const parseLogNote = (noteStr?: string): { mood?: string; text: string } => {
    if (!noteStr) return { text: '' };
    const moodMatch = noteStr.match(/^\[MOOD:(\w+)\]\s*(.*)$/);
    if (moodMatch) {
      return {
        mood: moodMatch[1],
        text: moodMatch[2]
      };
    }
    return { text: noteStr };
  };

  // Check if a habit is scheduled for a specific date
  const isHabitScheduledForDate = (habit: Habit, date: Date) => {
    if (habit.archived) return false;
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'custom' && habit.daysOfWeek) {
      const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday...
      return habit.daysOfWeek.includes(dayOfWeek);
    }
    return true;
  };

  // Get Monday-to-Sunday of the current week relative to a selected reference date
  const getWeekDays = (refDate: Date) => {
    const currentDay = refDate.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() + distanceToMonday);
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays(selectedDate);
  const selectedDateStr = getLocalDateStr(selectedDate);

  // Calculations for Today's Stats
  const activeHabitsToday = habits.filter(h => isHabitScheduledForDate(h, new Date()));
  const completedHabitsToday = activeHabitsToday.filter(h => 
    habitLogs?.[h.id]?.[getLocalDateStr(new Date())]?.status === 'completed'
  );
  const completionPercentToday = activeHabitsToday.length > 0
    ? Math.round((completedHabitsToday.length / activeHabitsToday.length) * 100)
    : 0;

  const totalStreakDays = habits.reduce((sum, h) => {
    const s = calculateStreak(habitLogs?.[h.id] || {}, h.frequency, h.daysOfWeek);
    return sum + s.currentStreak;
  }, 0);

  // Filter habits for displaying in the main board grid
  const displayedHabits = habits.filter(h => {
    if (h.archived) return false;
    
    // Search filter
    const matchesSearch = h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Category tab filter
    if (activeCategory !== 'all' && h.category !== activeCategory) return false;

    return true;
  }).sort((a, b) => {
    if (sortBy === 'name') {
      return a.title.localeCompare(b.title);
    } else if (sortBy === 'streak') {
      const streakA = calculateStreak(habitLogs?.[a.id] || {}, a.frequency, a.daysOfWeek).currentStreak;
      const streakB = calculateStreak(habitLogs?.[b.id] || {}, b.frequency, b.daysOfWeek).currentStreak;
      return streakB - streakA; // Descending
    } else if (sortBy === 'difficulty') {
      const diffWeight = { easy: 1, medium: 2, hard: 3 };
      const valA = diffWeight[a.difficulty || 'medium'];
      const valB = diffWeight[b.difficulty || 'medium'];
      return valB - valA; // Hardest first
    }
    return 0;
  });

  // Calculate day completion status for the week picker navigation items
  const getDayCompletions = (date: Date) => {
    const dStr = getLocalDateStr(date);
    const scheduled = habits.filter(h => isHabitScheduledForDate(h, date));
    if (scheduled.length === 0) return { scheduledCount: 0, completedCount: 0, percent: -1 };
    
    const completed = scheduled.filter(h => habitLogs?.[h.id]?.[dStr]?.status === 'completed');
    return {
      scheduledCount: scheduled.length,
      completedCount: completed.length,
      percent: Math.round((completed.length / scheduled.length) * 100)
    };
  };

  // Heatmap helper functions for overall board consistency
  const getLast30Days = () => {
    const dates: Date[] = [];
    const today = new Date();
    // Generate exactly 35 days (5 full weeks) to fit a nice grid alignable by Mon-Sun
    // Start from the Monday of 5 weeks ago
    const startDay = today.getDay();
    const distanceToMonday = startDay === 0 ? -6 : 1 - startDay;
    const firstMonday = new Date(today);
    firstMonday.setDate(today.getDate() + distanceToMonday - 28); // 4 weeks back from this week's Monday
    
    for (let i = 0; i < 35; i++) {
      const d = new Date(firstMonday);
      d.setDate(firstMonday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const getHeatmapData = (date: Date) => {
    const dateStr = getLocalDateStr(date);
    const scheduled = habits.filter(h => isHabitScheduledForDate(h, date));

    if (scheduled.length === 0) return { ratio: -1, completed: 0, total: 0 };
    const completed = scheduled.filter(h => habitLogs?.[h.id]?.[dateStr]?.status === 'completed').length;
    return { ratio: completed / scheduled.length, completed, total: scheduled.length };
  };

  const getHeatmapStyle = (ratio: number) => {
    if (ratio < 0) return { background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' };
    if (ratio === 0) return { background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.06)' };
    if (ratio <= 0.33) return { background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.3)' };
    if (ratio <= 0.66) return { background: 'rgba(99, 102, 241, 0.45)', border: '1px solid rgba(99, 102, 241, 0.5)' };
    return { 
      background: 'var(--color-primary)', 
      boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)', 
      border: '1px solid var(--color-primary)' 
    };
  };

  // Form Handlers
  const openAddDrawer = () => {
    setEditingHabit(null);
    setFormTitle('');
    setFormDesc('');
    setFormChecklistText('');
    setFormCategory('routine');
    setFormDifficulty('medium');
    setFormColor(COLOR_PRESETS[0]);
    setFormFrequency('daily');
    setFormDaysOfWeek([1, 2, 3, 4, 5]);
    setFormTimeTarget(15);
    setFormSyncCalendar(false);
    setIsAddEditOpen(true);
  };

  const openEditDrawer = (habit: Habit) => {
    setEditingHabit(habit);
    const parsed = parseDescriptionAndChecklist(habit.description);
    
    setFormTitle(habit.title);
    setFormDesc(parsed.descriptionText);
    setFormChecklistText(parsed.checklist.map(t => t.title).join(', '));
    setFormCategory(habit.category || 'routine');
    setFormDifficulty(habit.difficulty || 'medium');
    const colorMatch = COLOR_PRESETS.find(p => p.class === habit.color) || COLOR_PRESETS[0];
    setFormColor(colorMatch);
    setFormFrequency(habit.frequency === 'weekly' ? 'custom' : habit.frequency);
    setFormDaysOfWeek(habit.daysOfWeek || [1, 2, 3, 4, 5]);
    setFormTimeTarget(habit.timeTargetMinutes || 15);
    setFormSyncCalendar(habit.syncToCalendar);
    setIsAddEditOpen(true);
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    // Serialize checklist sub-tasks into composite description string
    const listItems = formChecklistText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => `todo:${s}`)
      .join('|');
      
    const finalDescription = formDesc.trim() + (listItems ? ` ||${listItems}` : '');

    const dataPayload = {
      title: formTitle.trim(),
      description: finalDescription || undefined,
      color: formColor.class,
      category: formCategory,
      difficulty: formDifficulty,
      frequency: formFrequency,
      daysOfWeek: formFrequency === 'custom' ? formDaysOfWeek : undefined,
      timeTargetMinutes: formTimeTarget > 0 ? formTimeTarget : undefined,
      syncToCalendar: formSyncCalendar
    };

    if (editingHabit) {
      await onUpdateHabit(editingHabit.id, dataPayload);
      if (inspectingHabit?.id === editingHabit.id) {
        setInspectingHabit(prev => prev ? { ...prev, ...dataPayload } : null);
      }
    } else {
      await onAddHabit(dataPayload);
    }
    
    setIsAddEditOpen(false);
    setEditingHabit(null);
  };

  // Check/uncheck a sub-task inside a habit card
  const handleToggleSubTask = async (habit: Habit, taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const parsed = parseDescriptionAndChecklist(habit.description);
    const updatedChecklist = parsed.checklist.map(t => {
      if (t.id === taskId) {
        return { ...t, completed: !t.completed };
      }
      return t;
    });

    const listStr = updatedChecklist
      .map(t => `${t.completed ? 'done' : 'todo'}:${t.title}`)
      .join('|');
      
    const finalDesc = parsed.descriptionText + (listStr ? ` ||${listStr}` : '');
    await onUpdateHabit(habit.id, { description: finalDesc });
  };

  // Day Toggle for custom week repeat choices
  const handleFormDayToggle = (dayIndex: number) => {
    if (formDaysOfWeek.includes(dayIndex)) {
      setFormDaysOfWeek(formDaysOfWeek.filter(d => d !== dayIndex));
    } else {
      setFormDaysOfWeek([...formDaysOfWeek, dayIndex].sort());
    }
  };

  // Complete/Uncomplete Trigger
  const handleCheckboxClick = async (habit: Habit) => {
    const isCompleted = habitLogs?.[habit.id]?.[selectedDateStr]?.status === 'completed';
    if (isCompleted) {
      // Toggle off directly
      await onToggleHabit(habit, selectedDateStr, true);
    } else {
      // Open quick journal reflection modal
      setCompletingHabit(habit);
      setJournalNote('');
      setSelectedMood('awesome');
    }
  };

  const handleSaveJournalLog = async (skip = false) => {
    if (!completingHabit) return;
    const finalNote = skip 
      ? '' 
      : `[MOOD:${selectedMood}] ${journalNote.trim()}`;
    
    await onToggleHabit(completingHabit, selectedDateStr, false, completingHabit.timeTargetMinutes, finalNote);
    
    setCompletingHabit(null);
    setJournalNote('');
  };

  // Details side-drawer selector
  const openInspectingDrawer = (habit: Habit) => {
    setInspectingHabit(habit);
    setIsDetailsOpen(true);
  };

  // Timer play controls
  const handleStartTimer = (habit: Habit, e: React.MouseEvent) => {
    e.stopPropagation();
    const durationMins = habit.timeTargetMinutes || 15;
    setActiveTimer({
      habitId: habit.id,
      habitTitle: habit.title,
      secondsRemaining: durationMins * 60,
      totalSeconds: durationMins * 60,
      isPlaying: true
    });
  };

  return (
    <div className="hb-root">
      
      {/* ── METRICS DASHBOARD HEADER ──────────────────────── */}
      <div className="hb-hero">
        <div className="hb-hero-title">
          <h2>Discipline Dashboard</h2>
          <p>Design your daily structure, build focus, and reflect on consistency.</p>
        </div>

        <div className="hb-metrics-row">
          {/* Circular Completion Ring */}
          <div className="hb-metric-card progress-ring-card">
            <div className="ring-container">
              <ProgressRing
                radius={36}
                stroke={4.5}
                progress={completionPercentToday}
                color1="#6366f1"
                color2="#06b6d4"
                gradientId="dash-completion-ring"
              />
              <span className="percent-text">{completionPercentToday}%</span>
            </div>
            <div className="metric-info">
              <div className="metric-lbl">TODAY'S SCORE</div>
              <div className="metric-val">{completedHabitsToday.length} / {activeHabitsToday.length}</div>
              <div className="metric-desc">completions today</div>
            </div>
          </div>

          {/* Active Streaks count */}
          <div className="hb-metric-card streak-card">
            <div className="metric-icon-wrap" style={{ background: 'rgba(249, 115, 22, 0.08)' }}>
              <Flame size={20} style={{ color: '#f97316' }} fill="rgba(249, 115, 22, 0.2)" />
            </div>
            <div className="metric-info">
              <div className="metric-lbl">COMBINED STREAK</div>
              <div className="metric-val text-streak">{totalStreakDays}d</div>
              <div className="metric-desc">accumulated streak</div>
            </div>
          </div>

          {/* Active Tracked Habits */}
          <div className="hb-metric-card track-card">
            <div className="metric-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
              <Target size={18} style={{ color: '#10b981' }} />
            </div>
            <div className="metric-info">
              <div className="metric-lbl">ACTIVE TRACKS</div>
              <div className="metric-val text-success">
                {habits.filter(h => isHabitScheduledForDate(h, new Date())).length} / {habits.filter(h => !h.archived).length}
              </div>
              <div className="metric-desc">scheduled / total habits</div>
            </div>
          </div>

          {/* Create Button */}
          <button onClick={openAddDrawer} className="hb-btn-create">
            <Plus size={16} strokeWidth={2.5} /> New Habit
          </button>
        </div>
      </div>

      {/* ── 30-DAY CONSISTENCY HEATMAP ────────────────────── */}
      <div className="hb-overall-heatmap-card">
        <div className="heatmap-header">
          <div className="header-lbl-group">
            <span className="lbl-title">Consistency Calendar</span>
            <span className="lbl-desc">Aggregated completion rate over the last 5 weeks</span>
          </div>
          <div className="heatmap-legend">
            <span className="legend-item"><span className="dot" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)' }} /> None</span>
            <span className="legend-item"><span className="dot" style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.3)' }} /> Low</span>
            <span className="legend-item"><span className="dot" style={{ background: 'rgba(99, 102, 241, 0.45)', border: '1px solid rgba(99, 102, 241, 0.5)' }} /> Med</span>
            <span className="legend-item"><span className="dot" style={{ background: 'var(--color-primary)' }} /> High</span>
          </div>
        </div>

        {/* Heatmap Grid Calendar with Column headers */}
        <div className="heatmap-calendar-grid-wrap">
          <div className="heatmap-days-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.45rem', marginBottom: '0.35rem', textAlign: 'center' }}>
            {DAYS_HEADER.map(day => (
              <span key={day} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {day}
              </span>
            ))}
          </div>
          <div className="heatmap-row-nodes" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.45rem' }}>
            {getLast30Days().map((date, idx) => {
              const { ratio, completed, total } = getHeatmapData(date);
              const formattedDate = date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              return (
                <div
                  key={idx}
                  className="overall-heatmap-cell"
                  style={getHeatmapStyle(ratio)}
                  title={ratio < 0
                    ? `${formattedDate} — No habits scheduled`
                    : `${formattedDate} — Completed ${completed}/${total} habits (${Math.round(ratio * 100)}%)`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── WEEK CALENDAR NAVIGATION SLIDER ───────────────── */}
      <div className="hb-week-navigation">
        <div className="week-label">
          <CalendarRangeIcon className="lbl-icon" />
          <span>Weekly Activity</span>
        </div>
        <div className="week-days-row">
          {weekDays.map((day, idx) => {
            const dayStr = getLocalDateStr(day);
            const isToday = getLocalDateStr(new Date()) === dayStr;
            const isSelected = getLocalDateStr(selectedDate) === dayStr;
            const stats = getDayCompletions(day);
            const dayOfWeekIdx = day.getDay();
            
            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`week-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              >
                <div className="day-name">{DAYS_SHORT[dayOfWeekIdx]}</div>
                <div className="day-num">{day.getDate()}</div>
                
                {/* Visual completion ring inside weekday chip */}
                {stats.scheduledCount > 0 ? (
                  <div className="day-dot-indicator">
                    <div
                      className="indicator-fill"
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: stats.percent === 100 
                          ? 'var(--color-success)' 
                          : `conic-gradient(var(--color-primary) ${stats.percent}%, rgba(255,255,255,0.06) ${stats.percent}%)`
                      }}
                    />
                  </div>
                ) : (
                  <div className="day-dot-indicator rest">
                    <span className="dot" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ───────────────────────── */}
      <div className="hb-toolbar">
        {/* Category tabs */}
        <div className="category-tabs">
          <button
            onClick={() => setActiveCategory('all')}
            className={`cat-tab ${activeCategory === 'all' ? 'active' : ''}`}
          >
            All Tracks
          </button>
          {Object.entries(CATEGORIES).map(([id, meta]) => (
            <button
              key={id}
              onClick={() => setActiveCategory(id)}
              className={`cat-tab ${activeCategory === id ? 'active' : ''}`}
              style={{ '--cat-color': meta.color } as any}
            >
              <span className="cat-icon">{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </div>

        {/* Search and Sort controls */}
        <div className="filter-controls">
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search habits..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="clear-search">
                <X size={12} />
              </button>
            )}
          </div>

          <select
            className="sort-dropdown"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="name">Sort: Name</option>
            <option value="streak">Sort: Streak</option>
            <option value="difficulty">Sort: Difficulty</option>
          </select>
        </div>
      </div>

      {/* ── HABITS BOARD GRID ─────────────────────────────── */}
      <div className="hb-grid-pane">
        {displayedHabits.length === 0 ? (
          <div className="hb-empty-state">
            <div className="empty-icon-wrap">
              <Sparkles size={22} />
            </div>
            <h3>No habits scheduled</h3>
            <p>
              {searchQuery 
                ? 'No habits match your search criteria.' 
                : 'There are no habits scheduled for this day of the week. Adjust category filters or create a new habit.'}
            </p>
            {!searchQuery && (
              <button onClick={openAddDrawer} className="hb-btn-create-empty">
                Create First Habit
              </button>
            )}
          </div>
        ) : (
          <div className="hb-habits-grid">
            {displayedHabits.map(habit => {
              const logs = habitLogs?.[habit.id] || {};
              const isCompleted = logs[selectedDateStr]?.status === 'completed';
              const streakInfo = calculateStreak(logs, habit.frequency, habit.daysOfWeek);
              const isTimerRunning = activeTimer?.habitId === habit.id;
              
              const parsed = parseDescriptionAndChecklist(habit.description);
              const categoryMeta = CATEGORIES[habit.category || 'routine'] || CATEGORIES.other;
              const difficultyMeta = DIFFICULTY_META[habit.difficulty as keyof typeof DIFFICULTY_META] || DIFFICULTY_META.medium;
              const presetColor = COLOR_PRESETS.find(p => p.class === habit.color) || COLOR_PRESETS[0];

              // Calculate overall checklist status progress
              const totalTasksCount = parsed.checklist.length;
              const completedTasksCount = parsed.checklist.filter(t => t.completed).length;
              const listPercent = totalTasksCount > 0 
                ? Math.round((completedTasksCount / totalTasksCount) * 100)
                : 0;

              const isScheduled = isHabitScheduledForDate(habit, selectedDate);

              return (
                <div
                  key={habit.id}
                  onClick={() => openInspectingDrawer(habit)}
                  className={`hb-card-item ${isCompleted ? 'is-completed' : ''} ${!isScheduled ? 'is-rest-day' : ''}`}
                  style={{
                    '--card-glow-color': presetColor.glow,
                    '--card-theme-color': presetColor.solid
                  } as any}
                >
                  {/* Decorative Gradient Background Aura */}
                  <div className="card-aura-glow" style={{ background: presetColor.value }} />

                  <div className="card-top">
                    {/* Circle Checkbox Trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckboxClick(habit);
                      }}
                      className={`card-check-trigger ${isCompleted ? 'active' : ''}`}
                      style={{
                        borderColor: isCompleted ? 'var(--color-success)' : `${presetColor.solid}3A`,
                        background: isCompleted ? 'var(--color-success)' : 'transparent',
                        color: '#ffffff'
                      }}
                    >
                      {isCompleted && <Check size={13} strokeWidth={3.5} />}
                    </button>

                    {/* Habit Info Content */}
                    <div className="card-info">
                      <div className="card-title-row">
                        <span className="card-cat-indicator" style={{ color: categoryMeta.color }}>
                          {categoryMeta.icon}
                        </span>
                        <h4>{habit.title}</h4>
                      </div>
                      {parsed.descriptionText && <p className="card-desc">{parsed.descriptionText}</p>}
                    </div>

                    {/* SVG progress ring on card top right */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                      <ProgressRing
                        radius={22}
                        stroke={2.5}
                        progress={totalTasksCount > 0 ? listPercent : (isCompleted ? 100 : 0)}
                        color1={presetColor.solid}
                        color2={categoryMeta.color}
                        gradientId={`card-ring-${habit.id}`}
                      />
                    </div>
                  </div>

                  {/* Checklist Section inside Card */}
                  {parsed.checklist.length > 0 && (
                    <div className="card-checklist" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingLeft: '2rem', marginTop: '-0.25rem' }}>
                      {parsed.checklist.map(task => (
                        <label
                          key={task.id}
                          className="checklist-item-lbl"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            fontSize: '0.74rem',
                            color: task.completed ? 'var(--text-muted)' : 'var(--text-secondary)',
                            textDecoration: task.completed ? 'line-through' : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={(e) => handleToggleSubTask(habit, task.id, e as any)}
                            style={{
                              width: '13px',
                              height: '13px',
                              accentColor: presetColor.solid,
                              cursor: 'pointer'
                            }}
                          />
                          <span>{task.title}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Inline Countdown focus timer in Card body */}
                  {isTimerRunning && (
                    <div className="card-timer-panel" onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '-0.35rem', marginLeft: '2rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Focus session timer:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: presetColor.solid }}>
                          {String(Math.floor((activeTimer?.secondsRemaining || 0) / 60)).padStart(2, '0')}:
                          {String((activeTimer?.secondsRemaining || 0) % 60).padStart(2, '0')}
                        </span>
                        <button
                          onClick={() => setActiveTimer(prev => prev ? { ...prev, isPlaying: !prev.isPlaying } : null)}
                          style={{ background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}
                        >
                          {activeTimer?.isPlaying ? <Pause size={10} fill="#ffffff" /> : <Play size={10} fill="#ffffff" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="card-bottom" onClick={(e) => e.stopPropagation()}>
                    <div className="badges-group">
                      {/* Difficulty Badge */}
                      <span
                        className="lbl-badge difficulty"
                        style={{
                          color: difficultyMeta.color,
                          background: difficultyMeta.bg,
                          borderColor: difficultyMeta.border
                        }}
                      >
                        {difficultyMeta.label}
                      </span>

                      {/* Rest Day indicator */}
                      {!isScheduled && (
                        <span className="lbl-badge rest-day" style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>
                          Rest Day
                        </span>
                      )}

                      {/* Timer Target Trigger */}
                      {habit.timeTargetMinutes && (
                        <button
                          onClick={(e) => handleStartTimer(habit, e)}
                          className={`lbl-badge timer-trigger ${isTimerRunning ? 'running' : ''}`}
                          title="Start focus timer session"
                        >
                          {isTimerRunning ? (
                            <>
                              <span className="timer-pulse" />
                              <span>{Math.floor((activeTimer?.secondsRemaining || 0) / 60)}m left</span>
                            </>
                          ) : (
                            <>
                              <Play size={10} strokeWidth={3} />
                              <span>{habit.timeTargetMinutes}m target</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="actions-group">
                      {/* Streak Indicator */}
                      {streakInfo.currentStreak > 0 && (
                        <div className="lbl-badge streak-badge" title="Active consecutive streak">
                          <Flame size={12} fill="#f97316" stroke="none" />
                          <span>{streakInfo.currentStreak}d</span>
                        </div>
                      )}

                      {/* Slide-over details drawer button */}
                      <button
                        onClick={() => openInspectingDrawer(habit)}
                        className="btn-details-arrow"
                        title="View history journals and trends"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Orange Add Button in bottom right corner */}
      <button
        onClick={openAddDrawer}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'var(--color-warning)',
          color: '#ffffff',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          border: 'none',
          boxShadow: '0 4px 15px rgba(245, 158, 11, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 900,
          transition: 'all 0.2s ease-out'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08) rotate(90deg)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.55)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.45)';
        }}
        title="Add new habit"
      >
        <Plus size={24} strokeWidth={3} />
      </button>

      {/* ── SLIDE-OVER DRAWER: CREATE / EDIT HABIT ────────── */}
      <div className={`drawer-overlay ${isAddEditOpen ? 'is-active' : ''}`} onClick={() => setIsAddEditOpen(false)}>
        <form
          onSubmit={handleSaveHabit}
          onClick={(e) => e.stopPropagation()}
          className={`drawer-container ${isAddEditOpen ? 'is-active' : ''}`}
        >
          <div className="drawer-header">
            <div>
              <h3>{editingHabit ? 'Modify Habit' : 'Assemble New Habit'}</h3>
              <p>{editingHabit ? 'Refine details and targets' : 'Establish targets for self-discipline'}</p>
            </div>
            <button type="button" className="btn-close-drawer" onClick={() => setIsAddEditOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="drawer-body custom-scroll">
            {/* Habit Title */}
            <div className="form-item">
              <label>Habit Title</label>
              <input
                type="text"
                placeholder="e.g. Read, Jog, Code, Hydrate"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                required
                maxLength={45}
              />
            </div>

            {/* Habit Description */}
            <div className="form-item">
              <label>Description / Motivation (Optional)</label>
              <input
                type="text"
                placeholder="Brief encouragement or instructions"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                maxLength={90}
              />
            </div>

            {/* Checklist items list */}
            <div className="form-item">
              <label>Sub-tasks Checklist (Comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Cardio, Strength, Stretching"
                value={formChecklistText}
                onChange={e => setFormChecklistText(e.target.value)}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Adds specific sub-tasks to check off inside the card.
              </span>
            </div>

            {/* Category & Difficulty */}
            <div className="form-grid-2">
              <div className="form-item">
                <label>Category</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                  {Object.entries(CATEGORIES).map(([id, meta]) => (
                    <option key={id} value={id}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-item">
                <label>Difficulty</label>
                <select value={formDifficulty} onChange={e => setFormDifficulty(e.target.value as any)}>
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>
              </div>
            </div>

            {/* Color Accent Gradients Selector */}
            <div className="form-item">
              <label>Visual Accent Color Gradient</label>
              <div className="color-presets-row">
                {COLOR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormColor(preset)}
                    className={`preset-color-dot ${formColor.name === preset.name ? 'is-selected' : ''}`}
                    style={{ background: preset.value }}
                    title={preset.name}
                  />
                ))}
              </div>
              <div className="preset-preview-line" style={{ background: formColor.value }} />
            </div>

            {/* Frequency selection */}
            <div className="form-item">
              <label>Repeat Routine Schedule</label>
              <div className="toggle-segment-group">
                <button
                  type="button"
                  onClick={() => setFormFrequency('daily')}
                  className={`segment-btn ${formFrequency === 'daily' ? 'is-active' : ''}`}
                >
                  Everyday
                </button>
                <button
                  type="button"
                  onClick={() => setFormFrequency('custom')}
                  className={`segment-btn ${formFrequency === 'custom' ? 'is-active' : ''}`}
                >
                  Specific Days
                </button>
              </div>

              {formFrequency === 'custom' && (
                <div className="custom-days-selector">
                  {DAYS_SHORT.map((dayChar, index) => {
                    const isActive = formDaysOfWeek.includes(index);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleFormDayToggle(index)}
                        className={`day-selector-btn ${isActive ? 'is-active' : ''}`}
                      >
                        {dayChar[0]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daily target duration slider */}
            <div className="form-item">
              <div className="lbl-flex-row">
                <label className="icon-lbl"><Clock size={13} /> Focus Target Duration</label>
                <span className="slider-val-highlight">{formTimeTarget} minutes</span>
              </div>
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={formTimeTarget}
                onChange={e => setFormTimeTarget(Number(e.target.value))}
                className="range-input"
              />
            </div>

            {/* Google Calendar Sync */}
            <div className="form-item check-switch-row">
              <div className="switch-info">
                <label className="switch-lbl"><Calendar size={13} /> Sync to Google Calendar</label>
                <p className="switch-desc">Block out target slot automatically on primary calendar</p>
              </div>
              <input
                type="checkbox"
                checked={formSyncCalendar}
                onChange={e => setFormSyncCalendar(e.target.checked)}
                className="switch-checkbox"
              />
            </div>
          </div>

          <div className="drawer-footer">
            <button type="button" className="btn-drawer-cancel" onClick={() => setIsAddEditOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-drawer-submit">
              {editingHabit ? 'Update Habit' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>

      {/* ── SLIDE-OVER DRAWER: HABIT DETAILS & HISTORY ────── */}
      <div className={`drawer-overlay ${isDetailsOpen ? 'is-active' : ''}`} onClick={() => setIsDetailsOpen(false)}>
        {inspectingHabit && (() => {
          const logs = habitLogs?.[inspectingHabit.id] || {};
          const streakData = calculateStreak(logs, inspectingHabit.frequency, inspectingHabit.daysOfWeek);
          const difficultyMeta = DIFFICULTY_META[inspectingHabit.difficulty as keyof typeof DIFFICULTY_META] || DIFFICULTY_META.medium;
          const categoryMeta = CATEGORIES[inspectingHabit.category || 'routine'] || CATEGORIES.other;
          const presetColor = COLOR_PRESETS.find(p => p.class === inspectingHabit.color) || COLOR_PRESETS[0];
          const parsed = parseDescriptionAndChecklist(inspectingHabit.description);

          // Heatmap calculations
          const heatmapNodes = [];
          const heatmapDaysCount = 30;
          for (let i = heatmapDaysCount - 1; i >= 0; i--) {
            const dateObj = new Date();
            dateObj.setDate(dateObj.getDate() - i);
            const dateStr = getLocalDateStr(dateObj);
            const isCompleted = logs[dateStr]?.status === 'completed';
            const isScheduled = isHabitScheduledForDate(inspectingHabit, dateObj);
            
            let nodeStatus: 'completed' | 'missed' | 'rest' = 'rest';
            if (isCompleted) {
              nodeStatus = 'completed';
            } else if (isScheduled) {
              nodeStatus = 'missed';
            }
            
            heatmapNodes.push({
              date: dateObj,
              dateStr,
              status: nodeStatus
            });
          }

          // Reflections list
          const completedEntries = Object.keys(logs)
            .filter(d => logs[d].status === 'completed')
            .sort((a, b) => b.localeCompare(a)); // Sort newest first

          let scheduleDesc = 'Every day';
          if (inspectingHabit.frequency === 'custom' && inspectingHabit.daysOfWeek) {
            scheduleDesc = inspectingHabit.daysOfWeek.map(d => DAYS_SHORT[d]).join(', ');
          }

          return (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`drawer-container detail-drawer-width ${isDetailsOpen ? 'is-active' : ''}`}
            >
              {/* Styled Gradient Header */}
              <div className="details-header-card" style={{ background: presetColor.value }}>
                <button className="btn-details-close" onClick={() => setIsDetailsOpen(false)}>
                  <X size={15} />
                </button>
                
                <div className="header-meta-row">
                  <span className="cat-icon-badge">{categoryMeta.icon}</span>
                  <div>
                    <span
                      className="lbl-badge-diff"
                      style={{
                        color: difficultyMeta.color,
                        background: 'var(--bg-card-nested)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }}
                    >
                      {difficultyMeta.label}
                    </span>
                  </div>
                </div>

                <h2>{inspectingHabit.title}</h2>
                {parsed.descriptionText && <p className="details-desc">{parsed.descriptionText}</p>}
                
                <div className="details-sub-meta">
                  <span className="meta-text-item">
                    <CalendarDays size={12} />
                    Repeat: {scheduleDesc}
                  </span>
                  {inspectingHabit.timeTargetMinutes && (
                    <span className="meta-text-item">
                      <Clock size={12} />
                      Target: {inspectingHabit.timeTargetMinutes}m/day
                    </span>
                  )}
                </div>
              </div>

              {/* Drawer Body content */}
              <div className="drawer-body custom-scroll">
                
                {/* Stats summary row */}
                <div className="details-stats-row">
                  <div className="stat-node">
                    <Flame size={18} style={{ color: '#f97316' }} fill="rgba(249, 115, 22, 0.1)" />
                    <span className="stat-val text-streak">{streakData.currentStreak}d</span>
                    <span className="stat-lbl">Current Streak</span>
                  </div>
                  <div className="stat-node">
                    <Award size={18} style={{ color: '#a855f7' }} />
                    <span className="stat-val text-purple">{streakData.longestStreak}d</span>
                    <span className="stat-lbl">Best Streak</span>
                  </div>
                  <div className="stat-node">
                    <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                    <span className="stat-val text-success">{completedEntries.length}</span>
                    <span className="stat-lbl">Completions</span>
                  </div>
                </div>

                {/* 30-Day Specific Heatmap */}
                <div className="details-section">
                  <div className="section-title">
                    <CalendarDays size={13} />
                    <span>30-Day Consistency Grid</span>
                  </div>
                  
                  <div className="heatmap-block">
                    <div className="heatmap-labels-row">
                      <span className="lbl-tiny">30 days ago</span>
                      <div className="heatmap-legend">
                        <span className="legend-item"><span className="dot col-done" /> Done</span>
                        <span className="legend-item"><span className="dot col-missed" /> Missed</span>
                        <span className="legend-item"><span className="dot col-rest" /> Rest</span>
                      </div>
                      <span className="lbl-tiny">Today</span>
                    </div>

                    <div className="heatmap-grid-container">
                      {heatmapNodes.map((node, nodeIdx) => {
                        const formattedDate = node.date.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });

                        return (
                          <div
                            key={nodeIdx}
                            className={`heatmap-node-cell state-${node.status}`}
                            style={{
                              '--node-accent-color': node.status === 'completed' ? presetColor.solid : 'transparent'
                            } as any}
                            title={`${formattedDate} — ${node.status.toUpperCase()}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Reflection Notes History logs */}
                <div className="details-section">
                  <div className="section-title">
                    <BookOpen size={13} />
                    <span>Journal Reflections History</span>
                  </div>

                  {completedEntries.length === 0 ? (
                    <div className="details-empty-logs">
                      <Info size={16} />
                      <p>No completion journals logged. Complete this habit to capture notes and mood patterns.</p>
                    </div>
                  ) : (
                    <div className="details-logs-stack">
                      {completedEntries.map(dateKey => {
                        const logObj = logs[dateKey];
                        const parsedLog = parseLogNote(logObj.note);
                        const moodObj = parsedLog.mood ? MOOD_META[parsedLog.mood] : null;

                        return (
                          <div key={dateKey} className="log-history-card">
                            <div className="log-card-header">
                              <span className="log-date">{dateKey}</span>
                              <div className="log-header-right">
                                {moodObj && (
                                  <span className="log-mood-badge" style={{ color: moodObj.color, background: `${moodObj.color}15` }}>
                                    {moodObj.emoji} {moodObj.label}
                                  </span>
                                )}
                                {logObj.completedAt && (
                                  <span className="log-time">
                                    {new Date(logObj.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            {parsedLog.text ? (
                              <p className="log-reflection-txt">"{parsedLog.text}"</p>
                            ) : (
                              <p className="log-reflection-txt empty">Checked off without notes.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Action Buttons Footer */}
              <div className="drawer-footer flex-footer">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    openEditDrawer(inspectingHabit);
                  }}
                  className="btn-details-edit"
                >
                  <Edit3 size={13} /> Edit Details
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(`Delete habit "${inspectingHabit.title}"? This is permanent.`)) {
                      await onDeleteHabit(inspectingHabit);
                      setIsDetailsOpen(false);
                      setInspectingHabit(null);
                    }
                  }}
                  className="btn-details-delete"
                >
                  <Trash2 size={13} /> Delete Habit
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── QUICK JOURNAL NOTE / MOOD SELECTION MODAL ────── */}
      {completingHabit && (
        <div className="hb-modal-overlay">
          <div className="hb-modal-dialog">
            <div className="hb-modal-header">
              <div className="modal-header-title">
                <BookOpen size={16} />
                <div>
                  <h3>Quick Journal Log</h3>
                  <p>Log execution for: {completingHabit.title}</p>
                </div>
              </div>
              <button className="btn-modal-close" onClick={() => setCompletingHabit(null)}>
                <X size={15} />
              </button>
            </div>

            <div className="hb-modal-body">
              {/* Mood picker grid */}
              <div className="form-item">
                <label>How do you feel about this session?</label>
                <div className="mood-picker-grid">
                  {Object.entries(MOOD_META).map(([id, meta]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedMood(id)}
                      className={`mood-picker-btn ${selectedMood === id ? 'is-selected' : ''}`}
                      style={{ '--mood-hover-color': meta.color } as any}
                    >
                      <span className="mood-emoji">{meta.emoji}</span>
                      <span className="mood-lbl">{meta.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reflection note input */}
              <div className="form-item">
                <label>Reflection Notes</label>
                <textarea
                  rows={3}
                  placeholder="Record thoughts, achievements, or any struggles during this habit slot..."
                  value={journalNote}
                  onChange={e => setJournalNote(e.target.value)}
                  maxLength={160}
                />
              </div>
            </div>

            <div className="hb-modal-footer">
              <button onClick={() => handleSaveJournalLog(true)} className="btn-modal-skip">
                Skip & Complete
              </button>
              <button onClick={() => handleSaveJournalLog(false)} className="btn-modal-save">
                Save Reflections
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING FOCUS TIMER OVERLAY WIDGET ────────────── */}
      {activeTimer && (
        <div className="hb-floating-timer">
          <div className="timer-header">
            <div className="timer-title-info">
              <span className="timer-pulse-indicator" />
              <h5>Focusing: {activeTimer.habitTitle}</h5>
            </div>
            <button onClick={() => setActiveTimer(null)} className="btn-timer-close" title="Close and discard timer">
              <X size={13} />
            </button>
          </div>

          <div className="timer-body">
            <div className="timer-circle-section">
              <ProgressRing
                radius={28}
                stroke={3.5}
                progress={Math.round((activeTimer.secondsRemaining / activeTimer.totalSeconds) * 100)}
                color1="#a855f7"
                color2="#ec4899"
                gradientId="floating-timer-ring"
              />
              <div className="timer-numeric">
                {String(Math.floor(activeTimer.secondsRemaining / 60)).padStart(2, '0')}:
                {String(activeTimer.secondsRemaining % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="timer-controls">
              {/* Play / Pause */}
              <button
                onClick={() => setActiveTimer(prev => prev ? { ...prev, isPlaying: !prev.isPlaying } : null)}
                className={`timer-ctrl-btn play-btn ${activeTimer.isPlaying ? 'paused' : ''}`}
                title={activeTimer.isPlaying ? 'Pause focus timer' : 'Resume focus timer'}
              >
                {activeTimer.isPlaying ? <Pause size={12} fill="#ffffff" /> : <Play size={12} fill="#ffffff" />}
              </button>

              {/* Reset */}
              <button
                onClick={() => setActiveTimer(prev => prev ? { ...prev, secondsRemaining: prev.totalSeconds, isPlaying: false } : null)}
                className="timer-ctrl-btn reset-btn"
                title="Reset timer"
              >
                <RotateCcw size={12} />
              </button>

              {/* Complete Now */}
              <button
                onClick={() => {
                  const habit = habits.find(h => h.id === activeTimer.habitId);
                  if (habit) {
                    setCompletingHabit(habit);
                    setSelectedMood('awesome');
                    setJournalNote(`Completed early focus session. Spent ${Math.round((activeTimer.totalSeconds - activeTimer.secondsRemaining) / 60)} minutes.`);
                  }
                  setActiveTimer(null);
                }}
                className="timer-complete-btn"
                title="Complete focus session and log reflections"
              >
                <Check size={12} strokeWidth={3} />
                <span>Finish</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Simple Fallback icon component for Calendar range UI
const CalendarRangeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="14"
    height="14"
    stroke="currentColor"
    strokeWidth="2.5"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
    <path d="M17 14h-6" />
    <path d="M13 18H7" />
  </svg>
);
