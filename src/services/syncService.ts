import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  createGoogleTask, 
  updateGoogleTask, 
  deleteGoogleTask, 
  fetchGoogleTasks, 
  fetchGoogleTaskLists,
  createGoogleEvent, 
  updateGoogleEvent, 
  deleteGoogleEvent, 
  fetchGoogleEvents, 
  fetchGoogleCalendars
} from './googleApi';
import type { GoogleTask, GoogleEvent } from './googleApi';

// Local cache interfaces extension
export interface LocalTask extends GoogleTask {
  listId: string;
  synced: boolean;
  pendingChange: boolean;
  localDeleted?: boolean;
}

export interface LocalEvent extends GoogleEvent {
  calendarId: string;
  synced: boolean;
  pendingChange: boolean;
  localDeleted?: boolean;
}

/* =========================================================================
   Task Sync Services
   ========================================================================= */

// Synchronize Tasks bidirectionally
export const syncTasks = async (userId: string): Promise<void> => {
  try {
    const googleLists = await fetchGoogleTaskLists();
    
    // We will sync with the primary list or all lists. To keep it simple and powerful,
    // let's fetch tasks for every list and merge.
    for (const list of googleLists) {
      const googleTasks = await fetchGoogleTasks(list.id);
      
      // 1. Get all local tasks for this list
      const localTasksRef = collection(db, 'users', userId, 'tasks');
      const q = query(localTasksRef, where('listId', '==', list.id));
      const localSnapshot = await getDocs(q);
      
      const localTasksMap = new Map<string, LocalTask>();
      localSnapshot.forEach((docSnap) => {
        localTasksMap.set(docSnap.id, docSnap.data() as LocalTask);
      });

      // 2. Push local pending changes to Google
      for (const [id, localTask] of localTasksMap.entries()) {
        if (localTask.pendingChange) {
          try {
            if (localTask.localDeleted) {
              // Delete on Google (only if it was already synced once)
              if (localTask.synced) {
                await deleteGoogleTask(list.id, id);
              }
              // Delete locally
              await deleteDoc(doc(db, 'users', userId, 'tasks', id));
            } else if (!localTask.synced) {
              // Create on Google
              const { id: dummyId, synced, pendingChange, ...googleData } = localTask;
              const newGoogleTask = await createGoogleTask(list.id, googleData);
              
              // We delete the temporary local doc and write the correct one with Google's ID
              await deleteDoc(doc(db, 'users', userId, 'tasks', id));
              await setDoc(doc(db, 'users', userId, 'tasks', newGoogleTask.id), {
                ...newGoogleTask,
                listId: list.id,
                synced: true,
                pendingChange: false
              });
            } else {
              // Update on Google
              const { id: taskId, synced, pendingChange, listId, ...googleData } = localTask;
              const updatedGoogleTask = await updateGoogleTask(list.id, id, googleData);
              await setDoc(doc(db, 'users', userId, 'tasks', id), {
                ...updatedGoogleTask,
                listId: list.id,
                synced: true,
                pendingChange: false
              }, { merge: true });
            }
          } catch (err) {
            console.error(`Failed to sync task ${id} to Google:`, err);
            // Leave it as pending to retry later
          }
        }
      }

      // 3. Process items from Google API and write to local cache
      const activeGoogleIds = new Set<string>();
      
      for (const gTask of googleTasks) {
        activeGoogleIds.add(gTask.id);
        const localTask = localTasksMap.get(gTask.id);
        
        if (!localTask) {
          // If not in local cache, write it
          await setDoc(doc(db, 'users', userId, 'tasks', gTask.id), {
            ...gTask,
            listId: list.id,
            synced: true,
            pendingChange: false
          });
        } else if (!localTask.pendingChange) {
          // If local copy is not pending changes, check if Google copy is newer
          const localUpdated = new Date(localTask.updated).getTime();
          const googleUpdated = new Date(gTask.updated).getTime();
          
          if (googleUpdated > localUpdated || localTask.title !== gTask.title || localTask.status !== gTask.status || localTask.due !== gTask.due) {
            await setDoc(doc(db, 'users', userId, 'tasks', gTask.id), {
              ...gTask,
              listId: list.id,
              synced: true,
              pendingChange: false
            }, { merge: true });
          }
        }
      }

      // 4. Clean up local cache: items marked synced but missing from Google response (i.e. deleted on Google)
      for (const [id, localTask] of localTasksMap.entries()) {
        if (localTask.synced && !localTask.pendingChange && !activeGoogleIds.has(id)) {
          await deleteDoc(doc(db, 'users', userId, 'tasks', id));
        }
      }
    }
  } catch (err) {
    console.error("Task sync error:", err);
    throw err;
  }
};

// Add Task locally first (optimistic UI)
export const addLocalTask = async (
  userId: string, 
  listId: string, 
  taskData: Omit<GoogleTask, 'id' | 'updated'>
): Promise<string> => {
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const nowStr = new Date().toISOString();
  
  const newTask: LocalTask = {
    ...taskData,
    id: tempId,
    updated: nowStr,
    listId,
    synced: false,
    pendingChange: true
  };

  await setDoc(doc(db, 'users', userId, 'tasks', tempId), newTask);
  
  // Trigger async sync in background
  syncTasks(userId).catch(console.error);
  
  return tempId;
};

// Update Task locally (optimistic UI)
export const updateLocalTask = async (
  userId: string,
  _listId: string,
  taskId: string,
  taskData: Partial<GoogleTask>
): Promise<void> => {
  const nowStr = new Date().toISOString();
  
  await setDoc(doc(db, 'users', userId, 'tasks', taskId), {
    ...taskData,
    updated: nowStr,
    pendingChange: true
  }, { merge: true });

  // Trigger sync in background
  syncTasks(userId).catch(console.error);
};

// Delete Task locally (optimistic UI)
export const deleteLocalTask = async (
  userId: string,
  _listId: string,
  taskId: string
): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'tasks', taskId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return;
  const task = docSnap.data() as LocalTask;
  
  if (!task.synced) {
    // If it was never synced, just delete it locally
    await deleteDoc(docRef);
  } else {
    // Mark as deleted locally so sync can delete it on Google later
    await updateDoc(docRef, {
      localDeleted: true,
      pendingChange: true,
      updated: new Date().toISOString()
    });
  }

  // Trigger sync in background
  syncTasks(userId).catch(console.error);
};


/* =========================================================================
   Calendar Sync Services
   ========================================================================= */

// Synchronize Calendar events bidirectionally
export const syncEvents = async (userId: string): Promise<void> => {
  try {
    const googleCalendars = await fetchGoogleCalendars();
    
    // We will sync the primary calendar (and optionally others)
    // For Zenith, we'll sync the primary calendar of the user
    const primaryCal = googleCalendars.find(c => c.primary) || googleCalendars[0];
    if (!primaryCal) return;

    // Fetch Google Events (limit search window to +/- 30 days for performance)
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const googleEvents = await fetchGoogleEvents(primaryCal.id, timeMin, timeMax);

    // 1. Get all local events
    const localEventsRef = collection(db, 'users', userId, 'events');
    const q = query(localEventsRef, where('calendarId', '==', primaryCal.id));
    const localSnapshot = await getDocs(q);
    
    const localEventsMap = new Map<string, LocalEvent>();
    localSnapshot.forEach((docSnap) => {
      localEventsMap.set(docSnap.id, docSnap.data() as LocalEvent);
    });

    // 2. Push local pending changes to Google
    for (const [id, localEvent] of localEventsMap.entries()) {
      if (localEvent.pendingChange) {
        try {
          if (localEvent.localDeleted) {
            if (localEvent.synced) {
              await deleteGoogleEvent(primaryCal.id, id);
            }
            await deleteDoc(doc(db, 'users', userId, 'events', id));
          } else if (!localEvent.synced) {
            // Create on Google
            const { id: dummyId, synced, pendingChange, ...googleData } = localEvent;
            const newGoogleEvent = await createGoogleEvent(primaryCal.id, googleData);
            
            // Delete temp doc and write correct Google ID doc
            await deleteDoc(doc(db, 'users', userId, 'events', id));
            await setDoc(doc(db, 'users', userId, 'events', newGoogleEvent.id), {
              ...newGoogleEvent,
              calendarId: primaryCal.id,
              synced: true,
              pendingChange: false
            });
          } else {
            // Update on Google
            const { id: eventId, synced, pendingChange, calendarId, ...googleData } = localEvent;
            const updatedGoogleEvent = await updateGoogleEvent(primaryCal.id, id, googleData);
            await setDoc(doc(db, 'users', userId, 'events', id), {
              ...updatedGoogleEvent,
              calendarId: primaryCal.id,
              synced: true,
              pendingChange: false
            }, { merge: true });
          }
        } catch (err) {
          console.error(`Failed to sync event ${id} to Google Calendar:`, err);
        }
      }
    }

    // 3. Process items from Google API and write to local cache
    const activeGoogleIds = new Set<string>();
    
    for (const gEvent of googleEvents) {
      activeGoogleIds.add(gEvent.id);
      const localEvent = localEventsMap.get(gEvent.id);
      
      if (!localEvent) {
        await setDoc(doc(db, 'users', userId, 'events', gEvent.id), {
          ...gEvent,
          calendarId: primaryCal.id,
          synced: true,
          pendingChange: false
        });
      } else if (!localEvent.pendingChange) {
        const localUpdated = new Date(localEvent.updated).getTime();
        const googleUpdated = new Date(gEvent.updated).getTime();
        
        if (googleUpdated > localUpdated || localEvent.summary !== gEvent.summary || 
            JSON.stringify(localEvent.start) !== JSON.stringify(gEvent.start) || 
            JSON.stringify(localEvent.end) !== JSON.stringify(gEvent.end)) {
          await setDoc(doc(db, 'users', userId, 'events', gEvent.id), {
            ...gEvent,
            calendarId: primaryCal.id,
            synced: true,
            pendingChange: false
          }, { merge: true });
        }
      }
    }

    // 4. Clean up local cache
    for (const [id, localEvent] of localEventsMap.entries()) {
      if (localEvent.synced && !localEvent.pendingChange && !activeGoogleIds.has(id)) {
        await deleteDoc(doc(db, 'users', userId, 'events', id));
      }
    }
  } catch (err) {
    console.error("Calendar sync error:", err);
    throw err;
  }
};

// Add Event locally (optimistic UI)
export const addLocalEvent = async (
  userId: string,
  eventData: Omit<GoogleEvent, 'id' | 'updated'>
): Promise<string> => {
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const nowStr = new Date().toISOString();
  
  const newEvent: LocalEvent = {
    ...eventData,
    id: tempId,
    updated: nowStr,
    calendarId: 'primary', // Default
    synced: false,
    pendingChange: true
  };

  await setDoc(doc(db, 'users', userId, 'events', tempId), newEvent);
  
  // Trigger sync
  syncEvents(userId).catch(console.error);
  
  return tempId;
};

// Update Event locally (optimistic UI)
export const updateLocalEvent = async (
  userId: string,
  eventId: string,
  eventData: Partial<GoogleEvent>
): Promise<void> => {
  const nowStr = new Date().toISOString();
  
  await setDoc(doc(db, 'users', userId, 'events', eventId), {
    ...eventData,
    updated: nowStr,
    pendingChange: true
  }, { merge: true });

  // Trigger sync
  syncEvents(userId).catch(console.error);
};

// Delete Event locally (optimistic UI)
export const deleteLocalEvent = async (
  userId: string,
  eventId: string
): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'events', eventId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return;
  const event = docSnap.data() as LocalEvent;
  
  if (!event.synced) {
    await deleteDoc(docRef);
  } else {
    await updateDoc(docRef, {
      localDeleted: true,
      pendingChange: true,
      updated: new Date().toISOString()
    });
  }

  // Trigger sync
  syncEvents(userId).catch(console.error);
};
