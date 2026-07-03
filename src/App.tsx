import { useState, useEffect } from 'react';
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
  syncEvents
} from './services/syncService';
import type { LocalTask, LocalEvent } from './services/syncService';
import { fetchGoogleTaskLists } from './services/googleApi';
import type { GoogleTaskList } from './services/googleApi';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  
  // Data State
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

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
    }, (error) => {
      console.error("Firestore events subscription error:", error);
    });

    // Run initial Google Sync
    performSync(user.uid);

    return () => {
      unsubscribeTasks();
      unsubscribeEvents();
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

      // B. Sync tasks and events bidirectionally
      await Promise.all([
        syncTasks(userId),
        syncEvents(userId)
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
      activeListId={activeListId}
      setActiveListId={setActiveListId}
      onAddTask={handleAddTask}
      onToggleTask={handleToggleTask}
      onDeleteTask={handleDeleteTask}
      onAddEvent={handleAddEvent}
      onDeleteEvent={handleDeleteEvent}
      isSyncing={isSyncing}
      lastSynced={lastSynced}
      syncError={syncError}
      onSyncTrigger={() => performSync(user.uid)}
      onSignOut={handleSignOut}
      loadingData={dataLoading}
    />
  );
}

export default App;
