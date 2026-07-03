import { 
  doc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface PomodoroSession {
  id: string;
  userId: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  durationMinutes: number; // Duration focused
  taskIds: string[]; // Linked task IDs
  taskTitles: string[]; // Linked task titles (saved as snapshots)
  type: 'work' | 'shortBreak' | 'longBreak';
  completed: boolean;
}

/**
 * Save a Pomodoro session log to Firestore.
 */
export const savePomodoroSession = async (
  userId: string,
  sessionData: Omit<PomodoroSession, 'id' | 'userId'>
): Promise<string> => {
  const sessionId = `pomo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const docRef = doc(db, 'users', userId, 'pomodoroSessions', sessionId);
  
  const newSession: PomodoroSession = {
    ...sessionData,
    id: sessionId,
    userId
  };
  
  await setDoc(docRef, newSession);
  return sessionId;
};

/**
 * Delete a Pomodoro session log from Firestore.
 */
export const deletePomodoroSession = async (
  userId: string,
  sessionId: string
): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'pomodoroSessions', sessionId);
  await deleteDoc(docRef);
};

/**
 * Plays a pleasant double-chime synth sound using the browser's Web Audio API.
 * This runs locally and requires no external media files.
 */
export const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First chime (higher note)
    const playChime = (freq: number, startDelay: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime + startDelay);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + startDelay + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(ctx.currentTime + startDelay);
      osc.stop(ctx.currentTime + startDelay + duration);
    };
    
    // Play a lovely major third chime (e.g. C6 followed by E6)
    playChime(1046.50, 0, 0.6); // C6
    playChime(1318.51, 0.12, 0.8); // E6
  } catch (error) {
    console.error("Failed to play dynamic audio notification:", error);
  }
};
