import React, { useState, useMemo } from 'react';
import type { LocalTask } from '../services/syncService';
import type { Habit, HabitLog } from '../services/habitService';
import { calculateStreak } from '../services/habitService';
import type { PomodoroSession } from '../services/pomodoroService';
import type { GoogleTaskList } from '../services/googleApi';
import { 
  TrendingUp, 
  CheckSquare, 
  Timer, 
  Flame, 
  Clock, 
  AlertTriangle,
  Frown,
  Activity,
  Award,
  Zap,
  Info,
  CalendarDays,
  Target,
  CornerDownRight,
  ListCollapse
} from 'lucide-react';

interface AnalyticsPageProps {
  tasks: LocalTask[];
  taskLists?: GoogleTaskList[];
  habits: Habit[];
  habitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } };
  pomodoroSessions: PomodoroSession[];
  activeListId: string;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  tasks: liveTasks,
  taskLists = [],
  habits: liveHabits,
  habitLogs: liveHabitLogs,
  pomodoroSessions: livePomodoroSessions
}) => {
  // ----------------------------------------------------
  // States & Filters
  // ----------------------------------------------------
  const [timeframe, setTimeframe] = useState<'7d' | '30d'>('7d');
  const [activeTab, setActiveTab] = useState<'rhythm' | 'focus' | 'habits' | 'tasks'>('rhythm');
  const [activeListFilter, setActiveListFilter] = useState<string>('all');
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    // Enable demo mode by default if the user has no logs, to showcase features
    const hasFocus = livePomodoroSessions.some(s => s.completed && s.type === 'work');
    const hasHabitLogs = Object.keys(liveHabitLogs).some(hId => Object.keys(liveHabitLogs[hId]).length > 0);
    return !hasFocus && !hasHabitLogs;
  });

  // Tooltip tracking for custom SVG charts
  const [hoveredData, setHoveredData] = useState<{
    x: number;
    y: number;
    title: string;
    details: string[];
  } | null>(null);

  // ----------------------------------------------------
  // Local Timezone Date Helpers
  // ----------------------------------------------------
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // ----------------------------------------------------
  // Generate Interactive Mock/Demo Data
  // ----------------------------------------------------
  const demoData = useMemo(() => {
    const mockSessions: PomodoroSession[] = [];
    const mockHabitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } } = {};
    const mockTasks: LocalTask[] = [];

    const today = new Date();
    
    // Distraction pool for realistic focus logs
    const distractionPool = [
      'Checked phone notifications',
      'Social media (Instagram/Twitter)',
      'E-mail notification ping',
      'Got up for coffee/water snack',
      'Slack message alert from workspace',
      'Daydreaming / lost train of thought',
      'Opened news feed tab'
    ];

    // Generate logs for past 45 days
    for (let i = 45; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateStr(d);
      const dayOfWeek = d.getDay();

      // Weekday vs Weekend focus density
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const sessionCount = isWeekend ? (Math.random() > 0.75 ? 1 : 0) : Math.floor(Math.random() * 4) + 1; // 1 to 4 focus blocks

      for (let s = 0; s < sessionCount; s++) {
        // Peak hours matching: morning (9am-11am) or afternoon (2pm-5pm)
        const isMorning = Math.random() > 0.4;
        const hour = isMorning ? Math.floor(Math.random() * 3) + 9 : Math.floor(Math.random() * 4) + 14;
        
        const startTime = new Date(d);
        startTime.setHours(hour, Math.floor(Math.random() * 60), 0);
        
        const duration = Math.random() > 0.8 ? 50 : 25; 
        const endTime = new Date(startTime.getTime() + duration * 60000);

        // Distractions
        const distractions: string[] = [];
        if (Math.random() > 0.4) {
          const count = Math.floor(Math.random() * 2) + 1;
          for (let c = 0; c < count; c++) {
            distractions.push(distractionPool[Math.floor(Math.random() * distractionPool.length)]);
          }
        }

        mockSessions.push({
          id: `demo-session-${dateStr}-${s}`,
          userId: 'demo-user',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes: duration,
          taskIds: [`demo-task-${Math.floor(Math.random() * 4)}`],
          taskTitles: [
            Math.random() > 0.5 ? 'Refactor state store' : 'Write API endpoint tests',
            Math.random() > 0.5 ? 'Design dashboard components' : 'Review code modifications'
          ],
          type: 'work',
          completed: true,
          distractions
        });
      }

      // Habit completion mock maps
      const habitCompletionRates: { [id: string]: number } = {
        'demo-h-1': 0.80, // Gym Workout (mon/wed/fri schedule)
        'demo-h-2': 0.35, // Meditation (struggling)
        'demo-h-3': 0.90, // Write Code (high consistency)
        'demo-h-4': 0.55  // Read Book Pages (medium consistency)
      };

      Object.keys(habitCompletionRates).forEach(hId => {
        if (!mockHabitLogs[hId]) mockHabitLogs[hId] = {};
        const rate = habitCompletionRates[hId];
        
        let isCompleted = Math.random() < rate;
        if (hId === 'demo-h-1') {
          // Gym scheduled on Mon, Wed, Fri
          const isScheduled = [1, 3, 5].includes(dayOfWeek);
          isCompleted = isScheduled ? Math.random() < 0.85 : Math.random() < 0.10;
        }

        if (isCompleted) {
          mockHabitLogs[hId][dateStr] = {
            completedAt: new Date(d).toISOString(),
            status: 'completed',
            timeSpentMinutes: Math.floor(Math.random() * 25) + 15
          };
        }
      });

      // Task completion velocity mock
      const completedTasksCount = isWeekend ? (Math.random() > 0.85 ? 1 : 0) : Math.floor(Math.random() * 3) + 1;
      for (let t = 0; t < completedTasksCount; t++) {
        const completionTime = new Date(d);
        completionTime.setHours(Math.floor(Math.random() * 10) + 9);
        
        mockTasks.push({
          id: `demo-task-completed-${dateStr}-${t}`,
          title: [
            'Setup Firestore database schema',
            'Polish visual charts layout',
            'Connect Google Tasks local sync client',
            'Implement dark theme toggles',
            'Write OAuth verification docs',
            'Fix responsive flex layout bugs',
            'Resolve hydration warning in app routing'
          ][Math.floor(Math.random() * 7)] || 'Task Completed',
          listId: Math.random() > 0.5 ? 'list-demo-1' : 'list-demo-2',
          status: 'completed',
          updated: completionTime.toISOString(),
          due: new Date(d).toISOString(),
          synced: true,
          pendingChange: false
        });
      }
    }

    // Active pending tasks for aging backlog analytics
    const pendingTitles = [
      'Write database index rules config file',
      'Optimize image loading times layout',
      'Implement workspace settings page toggle',
      'Resolve profile picture upload bug',
      'Polish notes sidebar editor buttons',
      'Design habit statistics radar view'
    ];
    for (let t = 0; t < pendingTitles.length; t++) {
      const updatedTime = new Date();
      updatedTime.setDate(updatedTime.getDate() - (t * 4 + 1)); // aged 1 to 21 days ago
      
      mockTasks.push({
        id: `demo-task-pending-${t}`,
        title: pendingTitles[t],
        notes: t % 3 === 0 ? '[priority: high] #p1 critical deadline' : t % 3 === 1 ? '[priority: medium] #p2 setup documentation' : 'General item log',
        listId: t % 2 === 0 ? 'list-demo-1' : 'list-demo-2',
        status: 'needsAction',
        updated: updatedTime.toISOString(),
        synced: true,
        pendingChange: false
      });
    }

    const mockHabits: Habit[] = [
      { id: 'demo-h-1', title: 'Gym Workout', color: 'grad-indigo', frequency: 'custom', daysOfWeek: [1, 3, 5], createdAt: new Date(today.getTime() - 40 * 86400000).toISOString(), archived: false, category: 'health', difficulty: 'hard', syncToCalendar: false },
      { id: 'demo-h-2', title: 'Zen Meditation', color: 'grad-cyan', frequency: 'daily', createdAt: new Date(today.getTime() - 40 * 86400000).toISOString(), archived: false, category: 'mind', difficulty: 'medium', syncToCalendar: false },
      { id: 'demo-h-3', title: 'Write Clean Code', color: 'grad-success', frequency: 'daily', createdAt: new Date(today.getTime() - 40 * 86400000).toISOString(), archived: false, category: 'work', difficulty: 'easy', syncToCalendar: false },
      { id: 'demo-h-4', title: 'Read Book Pages', color: 'grad-warning', frequency: 'daily', createdAt: new Date(today.getTime() - 40 * 86400000).toISOString(), archived: false, category: 'routine', difficulty: 'easy', syncToCalendar: false }
    ];

    const mockLists: GoogleTaskList[] = [
      { id: 'list-demo-1', title: 'Work Projects', updated: new Date().toISOString() },
      { id: 'list-demo-2', title: 'Personal Chore list', updated: new Date().toISOString() }
    ];

    return { mockSessions, mockHabitLogs, mockTasks, mockHabits, mockLists };
  }, []);

  // ----------------------------------------------------
  // Bind Data Sources (Live vs. Demo Mode)
  // ----------------------------------------------------
  const tasks = demoMode ? demoData.mockTasks : liveTasks;
  const habits = demoMode ? demoData.mockHabits : liveHabits;
  const habitLogs = demoMode ? demoData.mockHabitLogs : liveHabitLogs;
  const pomodoroSessions = demoMode ? demoData.mockSessions : livePomodoroSessions;
  const currentTaskLists = demoMode ? demoData.mockLists : taskLists;

  // ----------------------------------------------------
  // Preprocessing and Filters calculations
  // ----------------------------------------------------
  const daysLimit = timeframe === '7d' ? 7 : 30;

  // Generate Date list (ascending chronology)
  const dateRange = useMemo(() => {
    const dates = [];
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(getLocalDateStr(d));
    }
    return dates;
  }, [daysLimit]);

  // List filter map
  const activeLists = useMemo(() => {
    const set = new Set(tasks.map(t => t.listId));
    return currentTaskLists.filter(l => set.has(l.id));
  }, [currentTaskLists, tasks]);

  // Filter tasks based on selected task list filter
  const filteredTasks = useMemo(() => {
    if (activeListFilter === 'all') return tasks;
    return tasks.filter(t => t.listId === activeListFilter);
  }, [tasks, activeListFilter]);

  // ----------------------------------------------------
  // Computations for KPI cards
  // ----------------------------------------------------
  const kpis = useMemo(() => {
    // Focus sessions in range
    const rangeSessions = pomodoroSessions.filter(s => {
      const dStr = getLocalDateStr(new Date(s.startTime));
      return dateRange.includes(dStr) && s.completed && s.type === 'work';
    });
    const focusMinutes = rangeSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const focusHours = (focusMinutes / 60).toFixed(1);

    // Completed tasks in range
    const completedTasks = filteredTasks.filter(t => {
      if (t.status !== 'completed' || t.localDeleted) return false;
      const compDateStr = getLocalDateStr(new Date(t.updated));
      return dateRange.includes(compDateStr);
    });

    // Habits completion logs in range
    let totalHabitLogs = 0;
    let totalScheduledHabits = 0;
    habits.filter(h => !h.archived).forEach(h => {
      const logs = habitLogs[h.id] || {};
      dateRange.forEach(dateStr => {
        // Check if scheduled
        const dObj = new Date(dateStr + 'T00:00:00');
        const dayOfWeek = dObj.getDay();
        let isScheduled = true;
        if (h.frequency === 'custom' && h.daysOfWeek) {
          isScheduled = h.daysOfWeek.includes(dayOfWeek);
        }
        if (isScheduled) {
          totalScheduledHabits++;
          if (logs[dateStr]?.status === 'completed') {
            totalHabitLogs++;
          }
        }
      });
    });

    const habitSuccessRate = totalScheduledHabits > 0 
      ? Math.round((totalHabitLogs / totalScheduledHabits) * 100)
      : 0;

    // Distraction rate per hour
    const totalDistractions = rangeSessions.reduce((sum, s) => sum + (s.distractions?.length || 0), 0);
    const distractionRate = focusMinutes > 0 
      ? ((totalDistractions / (focusMinutes / 60))).toFixed(1) 
      : '0.0';

    return {
      focusHours,
      focusBlocksCount: rangeSessions.length,
      tasksCompletedCount: completedTasks.length,
      habitSuccessRate,
      distractionsCount: totalDistractions,
      distractionRate
    };
  }, [pomodoroSessions, filteredTasks, habits, habitLogs, dateRange]);

  // ----------------------------------------------------
  // Computations for Tab 1: Daily Momentum & Rhythm
  // ----------------------------------------------------
  const dailyMomentumData = useMemo(() => {
    return dateRange.map(dateStr => {
      // Focus sessions completed
      const daySessions = pomodoroSessions.filter(s => {
        return s.completed && s.type === 'work' && getLocalDateStr(new Date(s.startTime)) === dateStr;
      });
      const focusMins = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      const focusHrs = Math.round((focusMins / 60) * 10) / 10;

      // Tasks completed
      const dayTasks = filteredTasks.filter(t => {
        return t.status === 'completed' && !t.localDeleted && getLocalDateStr(new Date(t.updated)) === dateStr;
      });

      // Habits completed
      let habitsCompleted = 0;
      habits.filter(h => !h.archived).forEach(h => {
        const logs = habitLogs[h.id] || {};
        if (logs[dateStr]?.status === 'completed') {
          habitsCompleted++;
        }
      });

      const dObj = new Date(dateStr + 'T00:00:00');
      const dayName = dObj.toLocaleDateString([], { weekday: 'short' });
      const dayNum = dObj.getDate();

      return {
        dateStr,
        label: `${dayName} ${dayNum}`,
        focusHrs,
        tasksCompleted: dayTasks.length,
        habitsCompleted
      };
    });
  }, [dateRange, pomodoroSessions, filteredTasks, habits, habitLogs]);

  // Peak Hours Heatmap Calculations
  const heatmapData = useMemo(() => {
    // 7 rows (Mon=0, Tue=1... Sun=6), 24 columns (hours 0 to 23)
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    
    const rangeSessions = pomodoroSessions.filter(s => {
      const dStr = getLocalDateStr(new Date(s.startTime));
      return dateRange.includes(dStr) && s.completed && s.type === 'work';
    });

    rangeSessions.forEach(s => {
      const sDate = new Date(s.startTime);
      const day = sDate.getDay();
      // Map Sun=0 to index 6, Mon=1 to index 0, etc.
      const dayIdx = day === 0 ? 6 : day - 1;
      const hourIdx = sDate.getHours();
      grid[dayIdx][hourIdx] += 1;
    });

    return grid;
  }, [pomodoroSessions, dateRange]);

  const maxHeatmapCount = useMemo(() => {
    let maxVal = 1;
    heatmapData.forEach(row => {
      row.forEach(val => {
        if (val > maxVal) maxVal = val;
      });
    });
    return maxVal;
  }, [heatmapData]);

  // ----------------------------------------------------
  // Computations for Tab 2: Focus & Quality
  // ----------------------------------------------------
  
  // Focus Allocation by Task/Project
  const focusAllocation = useMemo(() => {
    const minutesMap: { [title: string]: number } = {};
    
    const rangeSessions = pomodoroSessions.filter(s => {
      const dStr = getLocalDateStr(new Date(s.startTime));
      return dateRange.includes(dStr) && s.completed && s.type === 'work';
    });

    rangeSessions.forEach(s => {
      const titles = s.taskTitles && s.taskTitles.length > 0 ? s.taskTitles : ['General Focus Flow'];
      const minsShare = s.durationMinutes / titles.length;
      titles.forEach(t => {
        minutesMap[t] = (minutesMap[t] || 0) + minsShare;
      });
    });

    return Object.entries(minutesMap)
      .map(([taskTitle, minutes]) => ({
        taskTitle,
        minutes: Math.round(minutes),
        hours: (minutes / 60).toFixed(1)
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5); // top 5
  }, [pomodoroSessions, dateRange]);

  // Focus Leak Journal (Distractions aggregator)
  const distractionJournal = useMemo(() => {
    const countsMap: { [text: string]: number } = {};
    
    const rangeSessions = pomodoroSessions.filter(s => {
      const dStr = getLocalDateStr(new Date(s.startTime));
      return dateRange.includes(dStr) && s.completed && s.type === 'work';
    });

    rangeSessions.forEach(s => {
      if (s.distractions && s.distractions.length > 0) {
        s.distractions.forEach(d => {
          // Normalize text to group duplicates
          const cleanedText = d.trim().replace(/^[\d\s📱💬🔔🔴]+/, '');
          if (!cleanedText) return;
          const capitalized = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
          countsMap[capitalized] = (countsMap[capitalized] || 0) + 1;
        });
      }
    });

    return Object.entries(countsMap)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [pomodoroSessions, dateRange]);

  // Focus vs Breaks ratio
  const focusBreakRatio = useMemo(() => {
    const rangeSessions = pomodoroSessions.filter(s => {
      const dStr = getLocalDateStr(new Date(s.startTime));
      return dateRange.includes(dStr) && s.completed;
    });

    const workMins = rangeSessions.filter(s => s.type === 'work').reduce((sum, s) => sum + s.durationMinutes, 0);
    const breakMins = rangeSessions.filter(s => s.type !== 'work').reduce((sum, s) => sum + s.durationMinutes, 0);
    
    const total = workMins + breakMins;
    if (total === 0) return { focusPercent: 100, breakPercent: 0, workMins: 0, breakMins: 0 };
    
    return {
      focusPercent: Math.round((workMins / total) * 100),
      breakPercent: Math.round((breakMins / total) * 100),
      workMins,
      breakMins
    };
  }, [pomodoroSessions, dateRange]);

  // ----------------------------------------------------
  // Computations for Tab 3: Habits & Consistency
  // ----------------------------------------------------

  // 30-Day habits chains
  const habitChains = useMemo(() => {
    // Generate dates representing the last 30 days
    const last30Dates: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last30Dates.push(getLocalDateStr(d));
    }

    return habits.filter(h => !h.archived).map(h => {
      const logs = habitLogs[h.id] || {};
      const history = last30Dates.map(dStr => {
        const dObj = new Date(dStr + 'T00:00:00');
        const dayOfWeek = dObj.getDay();
        
        let isScheduled = true;
        if (h.frequency === 'custom' && h.daysOfWeek) {
          isScheduled = h.daysOfWeek.includes(dayOfWeek);
        }

        const isCompleted = logs[dStr]?.status === 'completed';
        
        return {
          dateStr: dStr,
          isScheduled,
          isCompleted
        };
      });

      // Calculate streak stats
      const streaks = calculateStreak(logs, h.frequency, h.daysOfWeek);

      // Overall success rate for this habit within range
      const scheduledDaysInRange = dateRange.filter(dStr => {
        const dObj = new Date(dStr + 'T00:00:00');
        const dayOfWeek = dObj.getDay();
        if (h.frequency === 'custom' && h.daysOfWeek) {
          return h.daysOfWeek.includes(dayOfWeek);
        }
        return true;
      });

      const completedInRangeCount = scheduledDaysInRange.filter(dStr => logs[dStr]?.status === 'completed').length;
      const rate = scheduledDaysInRange.length > 0
        ? Math.round((completedInRangeCount / scheduledDaysInRange.length) * 100)
        : 0;

      // Color mapping
      let colorHex = 'var(--color-primary)';
      if (h.color === 'grad-indigo') colorHex = '#6366f1';
      else if (h.color === 'grad-cyan') colorHex = '#06b6d4';
      else if (h.color === 'grad-success' || h.color === 'grad-green') colorHex = '#10b981';
      else if (h.color === 'grad-warning' || h.color === 'grad-orange') colorHex = '#f59e0b';
      else if (h.color === 'grad-danger' || h.color === 'grad-rose') colorHex = '#ef4444';

      return {
        habit: h,
        history,
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        successRate: rate,
        colorHex,
        totalCompleted: Object.keys(logs).filter(d => logs[d].status === 'completed').length
      };
    });
  }, [habits, habitLogs, dateRange]);

  const strugglingHabits = useMemo(() => {
    return habitChains
      .filter(hc => hc.successRate < 50 && hc.totalCompleted > 0)
      .map(hc => hc.habit);
  }, [habitChains]);

  // ----------------------------------------------------
  // Computations for Tab 4: Task Flow & Priorities
  // ----------------------------------------------------
  
  // Task completion priorities
  const taskPriorities = useMemo(() => {
    const getTaskPriority = (notes: string = ''): 'high' | 'medium' | 'low' | 'none' => {
      const lower = notes.toLowerCase();
      if (lower.includes('[priority: high]') || lower.includes('#p1')) return 'high';
      if (lower.includes('[priority: medium]') || lower.includes('#p2')) return 'medium';
      if (lower.includes('[priority: low]') || lower.includes('#p3')) return 'low';
      return 'none';
    };

    // Keep active/non-deleted tasks
    const activeTasks = filteredTasks.filter(t => !t.localDeleted && !t.deleted);
    
    const high = activeTasks.filter(t => getTaskPriority(t.notes) === 'high');
    const medium = activeTasks.filter(t => getTaskPriority(t.notes) === 'medium');
    const low = activeTasks.filter(t => getTaskPriority(t.notes) === 'low');
    const uncategorized = activeTasks.filter(t => getTaskPriority(t.notes) === 'none');

    const computeRate = (list: LocalTask[]) => {
      if (list.length === 0) return { completed: 0, pending: 0, rate: 0 };
      const completed = list.filter(t => t.status === 'completed').length;
      const pending = list.filter(t => t.status !== 'completed').length;
      return {
        completed,
        pending,
        rate: Math.round((completed / list.length) * 100)
      };
    };

    return {
      high: computeRate(high),
      medium: computeRate(medium),
      low: computeRate(low),
      none: computeRate(uncategorized)
    };
  }, [filteredTasks]);

  // Backlog aging & stale tasks alert
  const backlogStats = useMemo(() => {
    const pendingTasks = filteredTasks.filter(t => t.status !== 'completed' && !t.localDeleted && !t.deleted);
    
    if (pendingTasks.length === 0) {
      return { avgAgeDays: 0, staleTasks: [] };
    }

    const todayMs = Date.now();
    const ages = pendingTasks.map(t => {
      const updatedMs = new Date(t.updated).getTime();
      const ageMs = todayMs - updatedMs;
      return Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
    });

    const totalAge = ages.reduce((sum, val) => sum + val, 0);
    const avgAgeDays = Math.round(totalAge / pendingTasks.length);

    // Stale tasks: pending and not updated/touched in over 7 days
    const staleTasks = pendingTasks
      .map((t, idx) => ({ task: t, ageDays: ages[idx] }))
      .filter(item => item.ageDays >= 7)
      .sort((a, b) => b.ageDays - a.ageDays);

    return {
      avgAgeDays,
      staleTasks
    };
  }, [filteredTasks]);

  // ----------------------------------------------------
  // Dynamic Scaling Calculations for Custom SVG Charts
  // ----------------------------------------------------
  
  // Unified Daily Momentum Chart Max values
  const maxValues = useMemo(() => {
    const focus = Math.max(...dailyMomentumData.map(d => d.focusHrs), 1.5);
    const tasks = Math.max(...dailyMomentumData.map(d => d.tasksCompleted), 2);
    const habits = Math.max(...dailyMomentumData.map(d => d.habitsCompleted), 2);
    return { focus, tasks, habits };
  }, [dailyMomentumData]);

  // Heatmap helper: convert raw count to visual HSL fill opacity
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'rgba(255, 255, 255, 0.02)';
    const intensity = Math.min(1, count / maxHeatmapCount);
    // Dynamic overlay matching styled theme primary color (Indigo)
    return `rgba(99, 102, 241, ${0.15 + intensity * 0.8})`;
  };

  return (
    <div className="glass-panel" style={{ height: '100%', overflowY: 'auto', padding: '2rem', position: 'relative' }}>
      
      {/* ----------------------------------------------------
          Visual Title Header & Options row
          ---------------------------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        
        {/* Brand/Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.625rem', borderRadius: '0.85rem', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <TrendingUp size={24} className="text-gradient" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Visual Analytics</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Analyze your focus rhythm, task completion velocity, and habit consistency.</p>
          </div>
        </div>

        {/* Global Toolbar Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          
          {/* Demo Mode Banner Indicator Toggle */}
          <div 
            onClick={() => setDemoMode(!demoMode)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              background: demoMode ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card-nested)', 
              padding: '0.4rem 0.8rem', 
              borderRadius: '8px', 
              border: `1px solid ${demoMode ? 'var(--color-success)' : 'var(--border-color)'}`,
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: demoMode ? 'var(--color-success)' : 'var(--text-muted)',
              boxShadow: demoMode ? '0 0 8px var(--color-success)' : 'none',
              display: 'inline-block',
              animation: demoMode ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: demoMode ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {demoMode ? 'Showing Demo Data' : 'Live Data Enabled'}
            </span>
          </div>

          {/* Timeframe Slider Toggle (7d vs 30d) */}
          <div style={{ display: 'flex', background: 'var(--bg-card-nested)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {([
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' }
            ] as const).map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                style={{
                  padding: '0.4rem 1rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: timeframe === tf.id ? 'var(--color-primary-glow)' : 'transparent',
                  border: '1px solid ' + (timeframe === tf.id ? 'var(--color-primary)' : 'transparent'),
                  color: timeframe === tf.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Task List Selector Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CornerDownRight size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={activeListFilter}
              onChange={(e) => setActiveListFilter(e.target.value)}
              style={{
                background: 'var(--bg-card-nested)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.45rem 1rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '8px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Task Lists</option>
              {activeLists.map(l => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* ----------------------------------------------------
          KPI Quick Stats row
          ---------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        {/* Total Focus Hours */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em' }}>TOTAL FOCUS TIME</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>{kpis.focusHours}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>hours</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Across {kpis.focusBlocksCount} focus sessions</span>
        </div>

        {/* Completed Tasks count */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em' }}>TASKS COMPLETED</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-secondary)' }}>{kpis.tasksCompletedCount}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>completed</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>In selected {timeframe === '7d' ? '7 day' : '30 day'} range</span>
        </div>

        {/* Habit success consistency rate */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em' }}>HABIT CONSISTENCY</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-success)' }}>{kpis.habitSuccessRate}%</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>rate</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ratio of checked-off scheduled slots</span>
        </div>

        {/* Interruption / Distraction rate */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em' }}>INTERRUPTION RATE</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-warning)' }}>{kpis.distractionRate}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>per hr</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total {kpis.distractionsCount} distraction log marks</span>
        </div>

      </div>

      {/* ----------------------------------------------------
          Sub-Navigation Tabs Selector
          ---------------------------------------------------- */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', gap: '1.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
        {([
          { id: 'rhythm', label: 'Rhythm & Momentum', icon: Activity },
          { id: 'focus', label: 'Focus & Quality', icon: Timer },
          { id: 'habits', label: 'Habits & Consistency', icon: Flame },
          { id: 'tasks', label: 'Task Flow & Priority', icon: CheckSquare }
        ] as const).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setHoveredData(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 0.25rem',
                fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                background: 'transparent',
                borderBottom: `2.5px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} style={{ color: isActive ? 'var(--color-primary)' : 'inherit' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------
          TAB 1: Rhythm & Momentum Panel
          ---------------------------------------------------- */}
      {activeTab === 'rhythm' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
          
          {/* Daily Momentum Unified SVG Chart */}
          <div className="glass-card" style={{ padding: '1.75rem', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Activity size={18} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Daily Momentum Timeline</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Comparison of Focus, Tasks, and Habits</span>
              </div>
            </div>

            <div style={{ height: '220px', position: 'relative', marginTop: '1.5rem' }}>
              {/* Responsive custom SVG element */}
              <svg width="100%" height="100%" viewBox="0 0 600 220" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="focusG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="taskG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-secondary)" />
                    <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="habitG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-warning)" />
                    <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0.2" />
                  </linearGradient>
                </defs>

                {/* Y-axis helper lines */}
                <line x1="40" y1="20" x2="580" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="40" y1="95" x2="580" y2="95" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="40" y1="170" x2="580" y2="170" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                {/* Draw side-by-side bar groups */}
                {(() => {
                  const chartW = 540;
                  const chartH = 150;
                  const padLeft = 40;
                  const padTop = 20;
                  const gCount = dailyMomentumData.length;
                  const gWidth = chartW / gCount;
                  const colW = Math.max(3, gWidth / 4.5);

                  return dailyMomentumData.map((d, gIdx) => {
                    const xCenter = padLeft + gIdx * gWidth + gWidth / 2;

                    // Normalize to max values
                    const fH = (d.focusHrs / maxValues.focus) * chartH;
                    const tH = (d.tasksCompleted / maxValues.tasks) * chartH;
                    const hH = (d.habitsCompleted / maxValues.habits) * chartH;

                    // Absolute pixel tops (0 point at Y=170)
                    const fY = 170 - fH;
                    const tY = 170 - tH;
                    const hY = 170 - hH;

                    return (
                      <g 
                        key={d.dateStr}
                        onMouseEnter={() => {
                          setHoveredData({
                            x: xCenter,
                            y: Math.min(fY, tY, hY) - 10,
                            title: d.label,
                            details: [
                              `Focus Time: ${d.focusHrs} hours`,
                              `Completed Tasks: ${d.tasksCompleted}`,
                              `Checked Habits: ${d.habitsCompleted}`
                            ]
                          });
                        }}
                        onMouseLeave={() => setHoveredData(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Interactive backdrop area for easy hovering */}
                        <rect 
                          x={padLeft + gIdx * gWidth} 
                          y={padTop} 
                          width={gWidth} 
                          height={chartH} 
                          fill="transparent" 
                        />

                        {/* Bar 1: Focus Hours */}
                        <rect
                          x={xCenter - colW * 1.6}
                          y={fY}
                          width={colW}
                          height={Math.max(2, fH)}
                          fill="url(#focusG)"
                          rx={1.5}
                          style={{ transition: 'all 0.3s ease' }}
                        />

                        {/* Bar 2: Tasks Completed */}
                        <rect
                          x={xCenter - colW * 0.5}
                          y={tY}
                          width={colW}
                          height={Math.max(2, tH)}
                          fill="url(#taskG)"
                          rx={1.5}
                          style={{ transition: 'all 0.3s ease' }}
                        />

                        {/* Bar 3: Habits checked */}
                        <rect
                          x={xCenter + colW * 0.6}
                          y={hY}
                          width={colW}
                          height={Math.max(2, hH)}
                          fill="url(#habitG)"
                          rx={1.5}
                          style={{ transition: 'all 0.3s ease' }}
                        />

                        {/* Group label */}
                        {gCount <= 8 || gIdx % 4 === 0 || gIdx === gCount - 1 ? (
                          <text
                            x={xCenter}
                            y="190"
                            fill="var(--text-muted)"
                            fontSize="8"
                            fontWeight="600"
                            textAnchor="middle"
                          >
                            {gCount > 8 ? d.label.split(' ')[1] : d.label}
                          </text>
                        ) : null}
                      </g>
                    );
                  });
                })()}

                {/* Y-axis Legend Labels */}
                <text x="32" y="24" fill="var(--text-muted)" fontSize="8" fontWeight="700" textAnchor="end">MAX</text>
                <text x="32" y="99" fill="var(--text-muted)" fontSize="8" fontWeight="700" textAnchor="end">MID</text>
                <text x="32" y="174" fill="var(--text-muted)" fontSize="8" fontWeight="700" textAnchor="end">0</text>
              </svg>

              {/* Hover SVG Tooltip Box */}
              {hoveredData && (
                <div style={{
                  position: 'absolute',
                  left: `${(hoveredData.x / 600) * 100}%`,
                  top: `${(hoveredData.y / 220) * 100 - 15}%`,
                  transform: 'translate(-50%, -100%)',
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid var(--border-active)',
                  boxShadow: 'var(--shadow-lg)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  zIndex: 20,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap'
                }}>
                  <strong style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{hoveredData.title}</strong>
                  {hoveredData.details.map((l, i) => (
                    <div key={i} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        background: i === 0 ? 'var(--color-primary)' : i === 1 ? 'var(--color-secondary)' : 'var(--color-warning)' 
                      }} />
                      {l}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom chart legend indicator */}
            <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-primary)' }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Focus Hours</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-secondary)' }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Completed Tasks</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-warning)' }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Checked Habits</span>
              </div>
            </div>
          </div>

          {/* Daily rhythm peak focus hours heatmap grid */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Clock size={18} style={{ color: 'var(--color-secondary)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Peak Focus Rhythm Heatmap</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Focus density by hour of day (Mon-Sun)</span>
              </div>
            </div>

            {/* Mon-Sun vertical columns mapping */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '1rem' }}>
              
              {/* Hour Grid Labels */}
              <div style={{ display: 'flex', paddingLeft: '2.5rem', width: '100%', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                <span>12a</span>
                <span>4a</span>
                <span>8a</span>
                <span>12p</span>
                <span>4p</span>
                <span>8p</span>
                <span>11p</span>
              </div>

              {/* Grid block rows */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, dIdx) => (
                <div key={dayName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  
                  {/* Left Label */}
                  <span style={{ fontSize: '0.7rem', width: '2rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{dayName}</span>
                  
                  {/* Row blocks */}
                  <div style={{ display: 'flex', flex: 1, gap: '3px', width: '100%' }}>
                    {heatmapData[dIdx].map((count, hour) => {
                      const labelStr = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                      return (
                        <div
                          key={hour}
                          style={{
                            flex: 1,
                            aspectRatio: '1',
                            background: getHeatmapColor(count),
                            borderRadius: '3px',
                            cursor: count > 0 ? 'pointer' : 'default',
                            transition: 'all 0.1s ease',
                            position: 'relative'
                          }}
                          title={`${dayName} at ${labelStr}: ${count} completed focus session${count !== 1 ? 's' : ''}`}
                        />
                      );
                    })}
                  </div>

                </div>
              ))}

            </div>

            {/* Heatmap Legend */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.35rem', marginTop: '1.25rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              <span>Fewer</span>
              <div style={{ width: '8px', height: '8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1.5px' }} />
              <div style={{ width: '8px', height: '8px', background: 'rgba(99, 102, 241, 0.25)', borderRadius: '1.5px' }} />
              <div style={{ width: '8px', height: '8px', background: 'rgba(99, 102, 241, 0.55)', borderRadius: '1.5px' }} />
              <div style={{ width: '8px', height: '8px', background: 'rgba(99, 102, 241, 0.9)', borderRadius: '1.5px' }} />
              <span>More focus blocks</span>
            </div>
          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          TAB 2: Focus & Attention Quality Panel
          ---------------------------------------------------- */}
      {activeTab === 'focus' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '2rem' }}>
          
          {/* Focus Leak distraction journal */}
          <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Focus Leak Journal</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Your most common focus interruptions</span>
              </div>
            </div>

            {distractionJournal.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem', gap: '0.5rem', opacity: 0.8 }}>
                <Award size={32} style={{ color: 'var(--color-success)', marginBottom: '0.25rem' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Absolute Flow State!</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>No distractions or sudden thoughts logged in focus sessions.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                {distractionJournal.map((d, index) => {
                  const maxCount = distractionJournal[0]?.count || 1;
                  const barWidth = (d.count / maxCount) * 100;
                  return (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500 }}>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          {d.text}
                        </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{d.count} time{d.count !== 1 ? 's' : ''}</strong>
                      </div>
                      
                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-card-nested)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${barWidth}%`, 
                            height: '100%', 
                            background: index === 0 ? 'var(--color-danger)' : index === 1 ? 'var(--color-warning)' : 'var(--color-primary)', 
                            borderRadius: 'var(--radius-full)',
                            transition: 'width 0.4s ease'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time allocation by task titles */}
          <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Zap size={18} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Focus Time Allocation</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Top tasks consuming focused work</span>
              </div>
            </div>

            {focusAllocation.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem', gap: '0.5rem', opacity: 0.8 }}>
                <Frown size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>No tasks linked yet</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>Link tasks when starting focus timers to audit work hours.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                {focusAllocation.map((item, idx) => {
                  const maxMins = focusAllocation[0]?.minutes || 1;
                  const barWidth = (item.minutes / maxMins) * 100;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500 }}>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                          {item.taskTitle}
                        </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{item.hours}h ({item.minutes}m)</strong>
                      </div>
                      
                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-card-nested)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${barWidth}%`, 
                            height: '100%', 
                            background: 'var(--grad-primary)', 
                            borderRadius: 'var(--radius-full)',
                            transition: 'width 0.4s ease'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Work focus vs break recovery ratio */}
          <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', width: '100%' }}>
              <Clock size={18} style={{ color: 'var(--color-success)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Focus vs. Break Balance</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active flow vs. break recovery duration</span>
              </div>
            </div>

            {focusBreakRatio.workMins === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2.5rem', gap: '0.5rem', opacity: 0.8 }}>
                <Timer size={28} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No focus data logged</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'center', width: '100%', flex: 1 }}>
                
                {/* SVG Donut Circle */}
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Background Circle (Breaks) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="var(--color-secondary)"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    {/* Foreground segment (Focus) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="var(--color-primary)"
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${(1 - focusBreakRatio.focusPercent / 100) * 2 * Math.PI * 40}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Inside metrics label */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <strong style={{ fontSize: '1.25rem', fontWeight: 800 }}>{focusBreakRatio.focusPercent}%</strong>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>Focus Time</span>
                  </div>
                </div>

                {/* Legend list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Work Flow</div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{focusBreakRatio.workMins} minutes</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-secondary)' }} />
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Recovery Breaks</div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{focusBreakRatio.breakMins} minutes</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          TAB 3: Habits & Consistency Panel
          ---------------------------------------------------- */}
      {activeTab === 'habits' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* GitHub Style 30-Day Grid */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <CalendarDays size={18} style={{ color: 'var(--color-success)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Habits Chain Tracker (Last 30 Days)</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Maintain daily streaks and avoid breaking the chains</span>
              </div>
            </div>

            {habitChains.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No active habits setup. Navigate to Habits Board to add daily tasks.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {habitChains.map((hc, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', minWidth: '600px' }}>
                    
                    {/* Left title info */}
                    <div style={{ display: 'flex', flexDirection: 'column', width: '9rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hc.habit.title}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Success rate: <strong>{hc.successRate}%</strong>
                      </span>
                    </div>

                    {/* GitHub blocks row (30 squares representing past 30 days) */}
                    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                      {hc.history.map((dayLog, dayIdx) => {
                        const dateObj = new Date(dayLog.dateStr + 'T00:00:00');
                        const friendlyDateStr = dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                        
                        let fillVal = 'rgba(255,255,255,0.02)';
                        let borderVal = '1px solid rgba(255,255,255,0.02)';
                        
                        if (dayLog.isCompleted) {
                          fillVal = hc.colorHex;
                          borderVal = `1px solid ${hc.colorHex}`;
                        } else if (dayLog.isScheduled) {
                          fillVal = 'rgba(255, 255, 255, 0.05)';
                          borderVal = '1px solid var(--border-color)';
                        }

                        return (
                          <div
                            key={dayIdx}
                            style={{
                              flex: 1,
                              aspectRatio: '1',
                              background: fillVal,
                              border: borderVal,
                              borderRadius: '3px',
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                            title={`${hc.habit.title}: ${dayLog.isCompleted ? 'Completed' : dayLog.isScheduled ? 'Scheduled but missed/pending' : 'Off day'} on ${friendlyDateStr}`}
                          />
                        );
                      })}
                    </div>

                    {/* Right side stats badge */}
                    <div style={{ display: 'flex', gap: '0.85rem', width: '7rem', justifyContent: 'flex-end', fontSize: '0.75rem', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Flame size={12} style={{ color: 'var(--color-warning)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{hc.currentStreak}d</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        Max {hc.longestStreak}d
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Habits Details Matrix & Struggling Radar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            
            {/* Streaks Matrix Table */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Target size={15} style={{ color: 'var(--color-primary)' }} />
                Habit Consistency Matrix
              </h4>

              {habitChains.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No statistics recorded.</span>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ paddingBottom: '0.5rem', fontWeight: 600 }}>Habit</th>
                        <th style={{ paddingBottom: '0.5rem', fontWeight: 600, textAlign: 'center' }}>Streak</th>
                        <th style={{ paddingBottom: '0.5rem', fontWeight: 600, textAlign: 'center' }}>Longest</th>
                        <th style={{ paddingBottom: '0.5rem', fontWeight: 600, textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {habitChains.map((hc, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.5rem 0', fontWeight: 700, color: 'var(--text-secondary)' }}>{hc.habit.title}</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'center', color: 'var(--color-warning)', fontWeight: 600 }}>{hc.currentStreak} days</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>{hc.longestStreak}d</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600 }}>{hc.totalCompleted} completions</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Struggling Habits Board warning */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-warning)' }}>
                <AlertTriangle size={15} />
                Habit Health Board
              </h4>

              {strugglingHabits.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', flex: 1 }}>
                  <Award size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Awesome work! All habits have strong consistency rates (above 50%).
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    The following habits have dropped below 50% completion. Consider adjusting schedules:
                  </span>
                  
                  {strugglingHabits.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      <Flame size={14} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                      <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>{h.title}</strong>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                          Difficulty: {h.difficulty || 'medium'} • {h.frequency} schedule
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          TAB 4: Task Flow & Priority Panel
          ---------------------------------------------------- */}
      {activeTab === 'tasks' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          
          {/* Task Completion Velocity Bar Chart */}
          <div className="glass-card" style={{ padding: '1.75rem', gridColumn: 'span 1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <CheckSquare size={18} style={{ color: 'var(--color-secondary)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Task Completion Velocity</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Number of tasks completed each day</span>
              </div>
            </div>

            <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '1rem 0.5rem', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
              {(() => {
                // Show last 10 days of completion data
                const last10DaysData = dailyMomentumData.slice(-10);
                const maxVal = Math.max(...last10DaysData.map(d => d.tasksCompleted), 3);
                
                return last10DaysData.map((d, idx) => {
                  const percent = (d.tasksCompleted / maxVal) * 100;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: d.tasksCompleted > 0 ? 'var(--text-primary)' : 'transparent' }}>
                        {d.tasksCompleted}
                      </span>
                      <div 
                        style={{
                          width: '18px',
                          height: `${Math.max(3, percent * 1.1)}px`,
                          background: d.tasksCompleted > 0 ? 'var(--grad-primary)' : 'rgba(255,255,255,0.02)',
                          borderRadius: '3px 3px 0 0',
                          boxShadow: d.tasksCompleted > 0 ? '0 0 10px var(--color-secondary-glow)' : 'none',
                          transition: 'height 0.3s ease'
                        }}
                        title={`${d.label}: ${d.tasksCompleted} task${d.tasksCompleted !== 1 ? 's' : ''} completed`}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {d.label.split(' ')[1]}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* High Priority Completion Rate meters */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Priority Completion Rate</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Focus on high-priority workload</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              {/* High Priority Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>High Priority (#p1)</span>
                  <span style={{ fontWeight: 700 }}>{taskPriorities.high.completed} / {taskPriorities.high.completed + taskPriorities.high.pending} ({taskPriorities.high.rate}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-card-nested)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${taskPriorities.high.rate}%`, 
                      height: '100%', 
                      background: 'var(--color-danger)', 
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.3s ease'
                    }} 
                  />
                </div>
              </div>

              {/* Medium Priority Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Medium Priority (#p2)</span>
                  <span style={{ fontWeight: 700 }}>{taskPriorities.medium.completed} / {taskPriorities.medium.completed + taskPriorities.medium.pending} ({taskPriorities.medium.rate}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-card-nested)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${taskPriorities.medium.rate}%`, 
                      height: '100%', 
                      background: 'var(--color-warning)', 
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.3s ease'
                    }} 
                  />
                </div>
              </div>

              {/* Low/Uncategorized Priority Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Others / General</span>
                  <span style={{ fontWeight: 700 }}>{taskPriorities.none.completed} / {taskPriorities.none.completed + taskPriorities.none.pending} ({taskPriorities.none.rate}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-card-nested)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${taskPriorities.none.rate}%`, 
                      height: '100%', 
                      background: 'var(--text-muted)', 
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.3s ease'
                    }} 
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Task Backlog aging & stale tasks alert */}
          <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <ListCollapse size={18} style={{ color: 'var(--color-warning)' }} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Backlog Aging</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Keep your pending tasks list clean</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-card-nested)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <Info size={16} style={{ color: 'var(--color-secondary)' }} />
              <div style={{ fontSize: '0.75rem' }}>
                Average age of active tasks: <strong style={{ color: 'var(--color-secondary)' }}>{backlogStats.avgAgeDays} days</strong> in backlog.
              </div>
            </div>

            {/* Stale list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', maxHeight: '140px' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>STALE TASKS (UNTOUCHED &gt;= 7 DAYS)</span>
              
              {backlogStats.staleTasks.length === 0 ? (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No stale tasks. Good flow maintenance!</span>
              ) : (
                backlogStats.staleTasks.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.35rem' }}>
                    <CornerDownRight size={12} style={{ color: 'var(--text-muted)' }} />
                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem' }} title={item.task.title}>
                      {item.task.title}
                    </div>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                      {item.ageDays}d old
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
