import { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { auth, db, signOutUser } from './firebase';
import { 
  addLocalTask, 
  updateLocalTask, 
  deleteLocalTask, 
  addLocalEvent, 
  deleteLocalEvent, 
  syncTasks, 
  syncEvents,
  syncHabits
} from './services/syncService';
import type { LocalTask, LocalEvent } from './services/syncService';
import { fetchGoogleTaskLists } from './services/googleApi';
import type { GoogleTaskList } from './services/googleApi';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { Loader2 } from 'lucide-react';
import { 
  addLocalHabit, 
  updateLocalHabit, 
  deleteLocalHabit, 
  toggleHabitCompletion 
} from './services/habitService';
import type { Habit, HabitLog } from './services/habitService';
import { savePomodoroSession, playNotificationSound } from './services/pomodoroService';
import type { PomodoroSession } from './services/pomodoroService';


function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  
  // Data State
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<{ [habitId: string]: { [dateStr: string]: HabitLog } }>({});
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Appearance State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('zenith-theme') as 'light' | 'dark') || 'dark';
  });
  const [styleMode, setStyleMode] = useState<'glassmorphism' | 'neumorphism' | 'minimalist' | 'retro'>(() => {
    return (localStorage.getItem('zenith-style-mode') as 'glassmorphism' | 'neumorphism' | 'minimalist' | 'retro') || 'glassmorphism';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zenith-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-style', styleMode);
    localStorage.setItem('zenith-style-mode', styleMode);
  }, [styleMode]);

  // =========================================================================
  // Pomodoro Live Timer State & Logic (Background persistent thread)
  // =========================================================================
  const [pomoType, setPomoType] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [pomoState, setPomoState] = useState<'idle' | 'running' | 'paused'>('idle');
  
  const getPresetDuration = (type: 'work' | 'shortBreak' | 'longBreak') => {
    if (type === 'work') {
      return Number(localStorage.getItem('zenith-pomo-work') || '25') * 60;
    } else if (type === 'shortBreak') {
      return Number(localStorage.getItem('zenith-pomo-short') || '5') * 60;
    } else {
      return Number(localStorage.getItem('zenith-pomo-long') || '15') * 60;
    }
  };

  const [pomoTotalDuration, setPomoTotalDuration] = useState(() => getPresetDuration('work'));
  const [pomoTimeLeft, setPomoTimeLeft] = useState(pomoTotalDuration);
  const [pomoStartTime, setPomoStartTime] = useState<string | null>(null);
  const [pomoSelectedTaskIds, setPomoSelectedTaskIds] = useState<string[]>([]);
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  
  const audioRefs = useRef<{ [id: string]: HTMLAudioElement | null }>({});

  // Sync timeLeft when changing preset or settings while idle
  useEffect(() => {
    if (pomoState === 'idle') {
      const dur = getPresetDuration(pomoType);
      setPomoTotalDuration(dur);
      setPomoTimeLeft(dur);
    }
  }, [pomoType, pomoState]);

  // Dynamic sound effects loader and cleanup
  const toggleAmbientSound = (soundId: string, url: string) => {
    if (activeSoundId === soundId) {
      const audio = audioRefs.current[soundId];
      if (audio) audio.pause();
      setActiveSoundId(null);
    } else {
      if (activeSoundId) {
        const prev = audioRefs.current[activeSoundId];
        if (prev) prev.pause();
      }
      let audio = audioRefs.current[soundId];
      if (!audio) {
        audio = new Audio(url);
        audio.loop = true;
        audioRefs.current[soundId] = audio;
      }
      setActiveSoundId(soundId);
      audio.play().catch(e => {
        console.error("Audio playback blocked by browser settings.", e);
        setActiveSoundId(null);
      });
    }
  };

  // Timer Tick effect
  useEffect(() => {
    let timerInterval: any = null;
    if (pomoState === 'running') {
      if (!pomoStartTime) {
        setPomoStartTime(new Date().toISOString());
      }
      timerInterval = setInterval(() => {
        setPomoTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerInterval) clearInterval(timerInterval);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [pomoState, pomoStartTime, pomoType, pomoTotalDuration, pomoSelectedTaskIds]);

  const handleTimerComplete = async () => {
    setPomoState('idle');
    
    const soundEnabled = localStorage.getItem('zenith-sound-enabled') !== 'false';
    if (soundEnabled) {
      playNotificationSound();
    }

    const endStr = new Date().toISOString();
    const finalStartTime = pomoStartTime || new Date(Date.now() - pomoTotalDuration * 1000).toISOString();

    try {
      const durationMin = Math.round(pomoTotalDuration / 60);
      const selectedTasks = tasks.filter(t => pomoSelectedTaskIds.includes(t.id));
      const taskTitles = selectedTasks.map(t => t.title);

      if (user) {
        await savePomodoroSession(user.uid, {
          startTime: finalStartTime,
          endTime: endStr,
          durationMinutes: durationMin,
          taskIds: pomoSelectedTaskIds,
          taskTitles,
          type: pomoType,
          completed: true
        });
      }
    } catch (err) {
      console.error("Failed to save completed Pomodoro session:", err);
    }

    const nextType = pomoType === 'work' ? 'shortBreak' : 'work';
    setPomoType(nextType);
    const duration = getPresetDuration(nextType);
    setPomoTotalDuration(duration);
    setPomoTimeLeft(duration);
    setPomoStartTime(null);

    alert(pomoType === 'work' ? "Focus session complete! Time to take a break." : "Break complete! Ready to focus again?");
  };

  const handlePresetSelect = (type: typeof pomoType) => {
    if (pomoState !== 'idle') {
      const confirmChange = window.confirm("Are you sure you want to stop the active timer to switch presets?");
      if (!confirmChange) return;
    }
    setPomoState('idle');
    setPomoType(type);
    const duration = getPresetDuration(type);
    setPomoTotalDuration(duration);
    setPomoTimeLeft(duration);
    setPomoStartTime(null);
  };

  const adjustPomoDuration = (amount: number) => {
    if (pomoState !== 'idle') return;
    const newDuration = Math.max(60, pomoTotalDuration + amount);
    setPomoTotalDuration(newDuration);
    setPomoTimeLeft(newDuration);
  };

  const startPausePomo = () => {
    if (pomoState === 'running') {
      setPomoState('paused');
    } else {
      setPomoState('running');
    }
  };

  const resetPomo = (savePartialCallback?: (durationMin: number, startTime: string) => void) => {
    if (pomoState === 'idle') return;

    const timeSpentSeconds = pomoTotalDuration - pomoTimeLeft;
    if (timeSpentSeconds >= 60 && pomoType === 'work' && savePartialCallback) {
      savePartialCallback(Math.round(timeSpentSeconds / 60), pomoStartTime || new Date().toISOString());
    } else {
      setPomoState('idle');
      const dur = getPresetDuration(pomoType);
      setPomoTotalDuration(dur);
      setPomoTimeLeft(dur);
      setPomoStartTime(null);
    }
  };

  const handleSavePartialSession = async (durationMin: number, startTimeStr: string) => {
    if (!user) return;
    try {
      const selectedTasks = tasks.filter(t => pomoSelectedTaskIds.includes(t.id));
      const taskTitles = selectedTasks.map(t => t.title);

      await savePomodoroSession(user.uid, {
        startTime: startTimeStr,
        endTime: new Date().toISOString(),
        durationMinutes: durationMin,
        taskIds: pomoSelectedTaskIds,
        taskTitles,
        type: pomoType,
        completed: false
      });
    } catch (err) {
      console.error("Failed to save partial session:", err);
    } finally {
      setPomoState('idle');
      const dur = getPresetDuration(pomoType);
      setPomoTotalDuration(dur);
      setPomoTimeLeft(dur);
      setPomoStartTime(null);
    }
  };

  const skipPomo = () => {
    const confirmSkip = window.confirm("Do you want to skip this session?");
    if (!confirmSkip) return;
    setPomoState('idle');
    setPomoStartTime(null);
    const nextType = pomoType === 'work' ? 'shortBreak' : 'work';
    handlePresetSelect(nextType);
  };

  const handlePomoSettingsChange = () => {
    if (pomoState === 'idle') {
      const dur = getPresetDuration(pomoType);
      setPomoTotalDuration(dur);
      setPomoTimeLeft(dur);
    }
  };

  // Clean up ambient audio on unmount or user logout
  useEffect(() => {
    return () => {
      Object.keys(audioRefs.current).forEach(id => {
        const audio = audioRefs.current[id];
        if (audio) {
          audio.pause();
          audioRefs.current[id] = null;
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setPomoState('idle');
      setPomoStartTime(null);
      setPomoSelectedTaskIds([]);
      setActiveSoundId((prev) => {
        if (prev && audioRefs.current[prev]) {
          audioRefs.current[prev]?.pause();
        }
        return null;
      });
    }
  }, [user]);

  // 1. Auth Subscription Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Firestore Subscriptions (Real-time local updates)
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setEvents([]);
      setTaskLists([]);
      setHabits([]);
      setHabitLogs({});
      setPomodoroSessions([]);
      setActiveListId('');
      return;
    }

    setDataLoading(true);

    // Subscribe to Tasks collection in Firestore
    const tasksQuery = query(collection(db, 'users', user.uid, 'tasks'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const loadedTasks: LocalTask[] = [];
      snapshot.forEach((docSnap) => {
        loadedTasks.push(docSnap.data() as LocalTask);
      });
      setTasks(loadedTasks);
      setDataLoading(false);
    }, (error) => {
      console.error("Firestore tasks subscription error:", error);
    });

    // Subscribe to Events collection in Firestore
    const eventsQuery = query(collection(db, 'users', user.uid, 'events'));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const loadedEvents: LocalEvent[] = [];
      snapshot.forEach((docSnap) => {
        loadedEvents.push(docSnap.data() as LocalEvent);
      });
      setEvents(loadedEvents);
      setDataLoading(false);
    }, (error) => {
      console.error("Firestore events subscription error:", error);
    });

    // Subscribe to Habits and their logs in Firestore
    const habitsQuery = query(collection(db, 'users', user.uid, 'habits'));
    const logsUnsubscribers = new Map<string, () => void>();

    const unsubscribeHabits = onSnapshot(habitsQuery, (snapshot) => {
      const loadedHabits: Habit[] = [];
      snapshot.forEach((docSnap) => {
        loadedHabits.push(docSnap.data() as Habit);
      });
      setHabits(loadedHabits);
      setDataLoading(false);

      // Setup / teardown listeners for each habit's logs
      loadedHabits.forEach((habit) => {
        if (!logsUnsubscribers.has(habit.id)) {
          const logsQuery = query(collection(db, 'users', user.uid, 'habits', habit.id, 'logs'));
          const unsubLogs = onSnapshot(logsQuery, (logsSnapshot) => {
            const loadedLogs: { [dateStr: string]: HabitLog } = {};
            logsSnapshot.forEach((logSnap) => {
              loadedLogs[logSnap.id] = logSnap.data() as HabitLog;
            });
            setHabitLogs((prev) => ({
              ...prev,
              [habit.id]: loadedLogs
            }));
          });
          logsUnsubscribers.set(habit.id, unsubLogs);
        }
      });

      // Clean up unsubscribers for habits that were deleted
      const habitIds = new Set(loadedHabits.map((h) => h.id));
      for (const habitId of logsUnsubscribers.keys()) {
        if (!habitIds.has(habitId)) {
          logsUnsubscribers.get(habitId)?.();
          logsUnsubscribers.delete(habitId);
          setHabitLogs((prev) => {
            const next = { ...prev };
            delete next[habitId];
            return next;
          });
        }
      }
    }, (error) => {
      console.error("Firestore habits subscription error:", error);
    });

    // Subscribe to Pomodoro sessions in Firestore
    const pomodoroQuery = query(collection(db, 'users', user.uid, 'pomodoroSessions'));
    const unsubscribePomodoro = onSnapshot(pomodoroQuery, (snapshot) => {
      const loadedSessions: PomodoroSession[] = [];
      snapshot.forEach((docSnap) => {
        loadedSessions.push(docSnap.data() as PomodoroSession);
      });
      setPomodoroSessions(loadedSessions);
    }, (error) => {
      console.error("Firestore pomodoro sessions subscription error:", error);
    });

    // Run initial Google Sync
    performSync(user.uid);

    return () => {
      unsubscribeTasks();
      unsubscribeEvents();
      unsubscribeHabits();
      unsubscribePomodoro();
      logsUnsubscribers.forEach((unsub) => unsub());
    };
  }, [user]);

  // 3. Bidirectional Sync trigger
  const performSync = async (userId: string) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      // A. Sync Task Lists metadata
      const lists = await fetchGoogleTaskLists();
      setTaskLists(lists);
      if (lists.length > 0 && !activeListId) {
        // Find default or select the first list
        const defaultList = lists.find(l => l.title === 'My Tasks' || l.title === 'Default List') || lists[0];
        setActiveListId(defaultList.id);
      }

      // B. Sync tasks, events, and habits bidirectionally
      await Promise.all([
        syncTasks(userId),
        syncEvents(userId),
        syncHabits(userId)
      ]);
      
      setLastSynced(new Date());
    } catch (err: any) {
      console.error("Bidirectional Sync failed:", err);
      if (err.message === 'AUTH_REQUIRED' || err.message === 'TOKEN_EXPIRED') {
        setSyncError("Google OAuth session expired. Please sign out and sign in again.");
      } else {
        setSyncError("Sync failed. Check your internet connection.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Background Sync Polling
  useEffect(() => {
    if (!user) return;
    
    // Sync every 5 minutes (300000ms)
    const interval = setInterval(() => {
      performSync(user.uid);
    }, 300000);

    return () => clearInterval(interval);
  }, [user, activeListId]);

  // =========================================================================
  // Optimistic UI Handlers
  // =========================================================================

  const handleAddTask = async (title: string, notes?: string, due?: string) => {
    if (!user || !activeListId) return;
    try {
      await addLocalTask(user.uid, activeListId, {
        title,
        notes,
        status: 'needsAction',
        due
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: 'needsAction' | 'completed') => {
    if (!user || !activeListId) return;
    const nextStatus = currentStatus === 'needsAction' ? 'completed' : 'needsAction';
    try {
      await updateLocalTask(user.uid, activeListId, taskId, {
        status: nextStatus
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user || !activeListId) return;
    try {
      await deleteLocalTask(user.uid, activeListId, taskId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEvent = async (summary: string, startStr: string, endStr: string, description?: string) => {
    if (!user) return;
    try {
      await addLocalEvent(user.uid, {
        summary,
        description,
        start: { dateTime: startStr },
        end: { dateTime: endStr }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) return;
    try {
      await deleteLocalEvent(user.uid, eventId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddHabit = async (habitData: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => {
    if (!user) return;
    try {
      await addLocalHabit(user.uid, habitData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateHabit = async (habitId: string, habitData: Partial<Habit>) => {
    if (!user) return;
    try {
      await updateLocalHabit(user.uid, habitId, habitData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteHabit = async (habit: Habit) => {
    if (!user) return;
    try {
      await deleteLocalHabit(user.uid, habit);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleHabit = async (habit: Habit, dateStr: string, currentCompleted: boolean, timeSpent?: number, note?: string) => {
    if (!user) return;
    try {
      await toggleHabitCompletion(user.uid, habit, dateStr, currentCompleted, timeSpent, note);
    } catch (err) {
      console.error(err);
    }
  };



  // =========================================================================
  // Render States
  // =========================================================================

  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Loader2 className="spin-slow" size={32} style={{ color: 'var(--color-primary)', marginBottom: '1rem' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Initializing Zenith...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onSignInSuccess={() => {}} />;
  }

  return (
    <Dashboard
      user={user}
      tasks={tasks}
      taskLists={taskLists}
      events={events}
      habits={habits}
      habitLogs={habitLogs}
      pomodoroSessions={pomodoroSessions}
      activeListId={activeListId}
      setActiveListId={setActiveListId}
      onAddTask={handleAddTask}
      onToggleTask={handleToggleTask}
      onDeleteTask={handleDeleteTask}
      onAddEvent={handleAddEvent}
      onDeleteEvent={handleDeleteEvent}
      onAddHabit={handleAddHabit}
      onUpdateHabit={handleUpdateHabit}
      onDeleteHabit={handleDeleteHabit}
      onToggleHabit={handleToggleHabit}
      isSyncing={isSyncing}
      lastSynced={lastSynced}
      syncError={syncError}
      onSyncTrigger={() => performSync(user.uid)}
      onSignOut={handleSignOut}
      loadingData={dataLoading}
      theme={theme}
      setTheme={setTheme}
      styleMode={styleMode}
      setStyleMode={setStyleMode}
      pomoType={pomoType}
      pomoState={pomoState}
      pomoTotalDuration={pomoTotalDuration}
      pomoTimeLeft={pomoTimeLeft}
      pomoSelectedTaskIds={pomoSelectedTaskIds}
      setPomoSelectedTaskIds={setPomoSelectedTaskIds}
      activeSoundId={activeSoundId}
      startPausePomo={startPausePomo}
      resetPomo={resetPomo}
      skipPomo={skipPomo}
      adjustPomoDuration={adjustPomoDuration}
      toggleAmbientSound={toggleAmbientSound}
      handlePresetSelect={handlePresetSelect}
      handleSavePartialSession={handleSavePartialSession}
      onPomoSettingsChange={handlePomoSettingsChange}
    />
  );
}

export default App;
