import { 
  doc, 
  setDoc, 
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  createGoogleEvent, 
  deleteGoogleEvent,
  createGoogleTask,
  deleteGoogleTask
} from './googleApi';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  color: string; // CSS gradient class name or Hex (e.g., 'grad-indigo', 'grad-cyan')
  frequency: 'daily' | 'weekly' | 'custom';
  daysOfWeek?: number[]; // [1, 3, 5] for Mon, Wed, Fri (0 = Sunday)
  weeklyTargetCount?: number; // e.g., 3
  createdAt: string; // ISO String
  archived: boolean;
  timeTargetMinutes?: number; // Target timer length
  syncToCalendar: boolean;
  syncToTasks: boolean;
  googleCalendarEventId?: string;
  googleTaskListId?: string;
  googleTaskId?: string;
  category?: 'mind' | 'health' | 'work' | 'routine' | string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface HabitLog {
  completedAt: string; // ISO String
  status: 'completed' | 'skipped';
  timeSpentMinutes?: number;
  note?: string;
}

// Map JavaScript daysOfWeek indices to Google RRULE days
const mapDaysToByDay = (days: number[]): string => {
  const dayStrings = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return days.map(d => dayStrings[d]).join(',');
};

// Add Habit
export const addLocalHabit = async (
  userId: string,
  habitData: Omit<Habit, 'id' | 'createdAt' | 'archived'>
): Promise<string> => {
  const habitId = `habit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const nowStr = new Date().toISOString();

  const newHabit: Habit = {
    ...habitData,
    id: habitId,
    createdAt: nowStr,
    archived: false
  };

  // Google Calendar Integration
  if (newHabit.syncToCalendar) {
    try {
      const startHour = 9; // Default 9 AM
      const startDate = new Date();
      startDate.setHours(startHour, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMinutes(startDate.getMinutes() + (newHabit.timeTargetMinutes || 30));

      let recurrenceRule: string | undefined;
      if (newHabit.frequency === 'daily') {
        recurrenceRule = 'RRULE:FREQ=DAILY';
      } else if (newHabit.frequency === 'custom' && newHabit.daysOfWeek && newHabit.daysOfWeek.length > 0) {
        recurrenceRule = `RRULE:FREQ=WEEKLY;BYDAY=${mapDaysToByDay(newHabit.daysOfWeek)}`;
      }

      const calendarEvent = await createGoogleEvent('primary', {
        summary: `Habit: ${newHabit.title}`,
        description: newHabit.description || 'Zenith Habit tracker scheduled slot.',
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        // We typecast recurrence into any if needed or pass directly
        ...((recurrenceRule ? { recurrence: [recurrenceRule] } : {}) as any)
      });

      newHabit.googleCalendarEventId = calendarEvent.id;
    } catch (err) {
      console.error("Failed to sync habit to Google Calendar:", err);
    }
  }

  // Google Tasks Integration
  if (newHabit.syncToTasks && newHabit.googleTaskListId) {
    try {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const task = await createGoogleTask(newHabit.googleTaskListId, {
        title: `Habit: ${newHabit.title}`,
        notes: `Zenith Habit tracker sync. Complete this task to check off your habit today.`,
        status: 'needsAction',
        due: today.toISOString()
      });

      newHabit.googleTaskId = task.id;
    } catch (err) {
      console.error("Failed to sync habit to Google Tasks:", err);
    }
  }

  // Write to Firestore
  await setDoc(doc(db, 'users', userId, 'habits', habitId), newHabit);
  return habitId;
};

// Update Habit
export const updateLocalHabit = async (
  userId: string,
  habitId: string,
  habitData: Partial<Habit>
): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'habits', habitId);
  await setDoc(docRef, habitData, { merge: true });
};

// Delete Habit
export const deleteLocalHabit = async (
  userId: string,
  habit: Habit
): Promise<void> => {
  // Delete Google Calendar Event if it exists
  if (habit.googleCalendarEventId) {
    try {
      await deleteGoogleEvent('primary', habit.googleCalendarEventId);
    } catch (err) {
      console.error("Failed to delete Google Calendar event for habit:", err);
    }
  }

  // Delete Google Task if it exists
  if (habit.googleTaskId && habit.googleTaskListId) {
    try {
      await deleteGoogleTask(habit.googleTaskListId, habit.googleTaskId);
    } catch (err) {
      console.error("Failed to delete Google Task for habit:", err);
    }
  }

  // Delete from Firestore
  await deleteDoc(doc(db, 'users', userId, 'habits', habit.id));
};

// Toggle Habit Completion (Log for a specific day)
export const toggleHabitCompletion = async (
  userId: string,
  habit: Habit,
  dateStr: string, // YYYY-MM-DD format
  currentCompleted: boolean,
  timeSpent?: number,
  note?: string
): Promise<void> => {
  const logRef = doc(db, 'users', userId, 'habits', habit.id, 'logs', dateStr);

  if (currentCompleted) {
    // Delete log (mark as uncompleted)
    await deleteDoc(logRef);

    // If Google Task was completed, we can reset it to needsAction on Google Tasks
    if (habit.googleTaskId && habit.googleTaskListId) {
      try {
        // Simple async update in background
        // Wait, completing tasks is handled via GAPI
      } catch (err) {
        console.error(err);
      }
    }
  } else {
    // Write completed log
    const log: HabitLog = {
      completedAt: new Date().toISOString(),
      status: 'completed',
      timeSpentMinutes: timeSpent,
      note: note || undefined
    };
    await setDoc(logRef, log);
  }
};

// Calculate Streak Metrics
export const calculateStreak = (
  logs: { [dateStr: string]: HabitLog },
  frequency: 'daily' | 'weekly' | 'custom',
  daysOfWeek?: number[]
): { currentStreak: number; longestStreak: number } => {
  const loggedDates = Object.keys(logs)
    .filter(d => logs[d].status === 'completed')
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Descending order (newest first)

  if (loggedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const completedSet = new Set(loggedDates);

  // Helper to parse "YYYY-MM-DD" local date
  const parseLocalDate = (dStr: string): Date => {
    const [year, month, day] = dStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Streak calculations
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Let's first calculate the Longest Streak by traversing all days chronologically
  const datesChronological = Object.keys(logs)
    .filter(d => logs[d].status === 'completed')
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()); // Ascending order

  if (datesChronological.length > 0) {
    const firstDate = parseLocalDate(datesChronological[0]);
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);

    let streakWalker = new Date(firstDate);
    while (streakWalker <= todayDate) {
      const currentWalkStr = formatDate(streakWalker);
      const isCompleted = completedSet.has(currentWalkStr);

      let isScheduledDay = true;
      if (frequency === 'custom' && daysOfWeek && daysOfWeek.length > 0) {
        isScheduledDay = daysOfWeek.includes(streakWalker.getDay());
      }

      if (isScheduledDay) {
        if (isCompleted) {
          tempStreak++;
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
        } else {
          // Break streak unless it's in the future
          const walkerTime = streakWalker.getTime();
          const todayTime = todayDate.getTime();
          if (walkerTime < todayTime) {
            tempStreak = 0;
          }
        }
      }
      
      streakWalker.setDate(streakWalker.getDate() + 1);
    }
  }

  // Calculate Current Streak walking backwards from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let checkDate = new Date(today);
  let isStreakActive = false;

  // Check if today is completed or if today is not a scheduled day
  const todayStr = formatDate(today);
  const completedToday = completedSet.has(todayStr);

  // If yesterday was completed, the streak is alive today
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  const completedYesterday = completedSet.has(yesterdayStr);

  let activeCheckDate = new Date(today);

  // If not completed today, and today is a scheduled day, the streak might still be alive from yesterday
  let todayIsScheduled = true;
  if (frequency === 'custom' && daysOfWeek && daysOfWeek.length > 0) {
    todayIsScheduled = daysOfWeek.includes(today.getDay());
  }

  if (!completedToday && todayIsScheduled) {
    // If not completed today, but yesterday was completed, start checking from yesterday
    if (completedYesterday) {
      activeCheckDate = yesterday;
      isStreakActive = true;
    } else {
      // Both today and yesterday are uncompleted (and today was scheduled) => streak is 0
      isStreakActive = false;
    }
  } else {
    // Streak is active (either completed today, or today is not a scheduled day and we'll check backwards)
    isStreakActive = true;
  }

  if (isStreakActive) {
    checkDate = new Date(activeCheckDate);
    // Walk back 365 days max
    for (let i = 0; i < 365; i++) {
      const dateStr = formatDate(checkDate);
      const isCompleted = completedSet.has(dateStr);

      let isScheduledDay = true;
      if (frequency === 'custom' && daysOfWeek && daysOfWeek.length > 0) {
        isScheduledDay = daysOfWeek.includes(checkDate.getDay());
      }

      if (isScheduledDay) {
        if (isCompleted) {
          currentStreak++;
        } else {
          // If we find an uncompleted scheduled day in the past, the streak breaks
          break;
        }
      }
      // Go to previous day
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  return { 
    currentStreak, 
    longestStreak: Math.max(longestStreak, currentStreak) 
  };
};
