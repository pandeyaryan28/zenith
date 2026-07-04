import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import type { LocalTask } from './syncService';
import { addLocalTask, updateLocalTask, deleteLocalTask } from './syncService';

export interface ParsedTask {
  text: string;
  completed: boolean;
  dueDate?: string;
  lineIndex: number;
}

export interface LocalNote {
  id: string; // URL encoded file path (e.g. 'Work%2FProject.md')
  title: string; // File basename
  content: string; // Markdown text
  updatedAt: string; // ISO timestamp
  tags: string[];
}

/* =========================================================================
   Note CRUD Actions
   ========================================================================= */

// Create or update a note in Firestore
export const saveLocalNote = async (
  userId: string,
  noteId: string,
  title: string,
  content: string
): Promise<void> => {
  const noteRef = doc(db, 'users', userId, 'notes', noteId);
  const now = new Date().toISOString();
  
  // Extract tags from markdown content (e.g. #work #personal)
  const tags = parseTagsFromContent(content);

  const updatedNote: LocalNote = {
    id: noteId,
    title,
    content,
    updatedAt: now,
    tags
  };

  await setDoc(noteRef, updatedNote, { merge: true });
};

// Delete a note in Firestore
export const deleteLocalNote = async (
  userId: string,
  noteId: string
): Promise<void> => {
  // Delete the note
  await deleteDoc(doc(db, 'users', userId, 'notes', noteId));
  
  // Also clean up any tasks associated with this note
  try {
    const tasksRef = collection(db, 'users', userId, 'tasks');
    const q = query(tasksRef, where('noteId', '==', noteId));
    const querySnapshot = await getDocs(q);
    
    for (const docSnap of querySnapshot.docs) {
      await deleteDoc(doc(db, 'users', userId, 'tasks', docSnap.id));
    }
  } catch (err) {
    console.error(`Failed to clean up tasks for deleted note ${noteId}:`, err);
  }
};

/* =========================================================================
   Markdown Parsing Helpers
   ========================================================================= */

// Extract hashtags (e.g., #work, #focus)
export const parseTagsFromContent = (content: string): string[] => {
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-/]+)/g;
  const tags: string[] = [];
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    // Avoid double-counting and skip color codes like #fff or header markers
    if (!tags.includes(tag) && !/^[0-9a-fA-F]{3,6}$/.test(tag)) {
      tags.push(tag);
    }
  }
  return tags;
};

// Extract tasks from markdown text
export const parseTasksFromNote = (content: string): ParsedTask[] => {
  if (!content) return [];
  const lines = content.split('\n');
  const taskRegex = /^\s*-\s*\[([ xX])\]\s*(.+)$/;
  const parsedTasks: ParsedTask[] = [];

  lines.forEach((line, index) => {
    const match = taskRegex.exec(line);
    if (match) {
      const completed = match[1] !== ' ';
      let text = match[2].trim();

      // Extract due date: e.g. @due(2026-07-06)
      const dueMatch = text.match(/@due\((\d{4}-\d{2}-\d{2})\)/);
      let dueDate: string | undefined = undefined;
      
      if (dueMatch) {
        dueDate = dueMatch[1];
        text = text.replace(/@due\(\d{4}-\d{2}-\d{2}\)/, '').trim();
      }

      parsedTasks.push({
        text,
        completed,
        dueDate,
        lineIndex: index
      });
    }
  });

  return parsedTasks;
};

/* =========================================================================
   Bidirectional Sync: Note Tasks -> Task Board
   ========================================================================= */

// Sync tasks parsed from a note into the main task board
export const syncNoteTasksToBoard = async (
  userId: string,
  noteId: string,
  noteTitle: string,
  noteContent: string,
  activeListId: string
): Promise<void> => {
  if (!activeListId) return;

  try {
    const parsedTasks = parseTasksFromNote(noteContent);
    
    // Get existing tasks associated with this note from Firestore
    const tasksRef = collection(db, 'users', userId, 'tasks');
    const q = query(tasksRef, where('noteId', '==', noteId));
    const querySnapshot = await getDocs(q);

    const existingTasksMap = new Map<string, LocalTask>();
    querySnapshot.forEach((docSnap) => {
      const task = docSnap.data() as LocalTask;
      // We map by the noteTaskKey (using the text of the task)
      const key = task.title.trim().toLowerCase();
      existingTasksMap.set(key, task);
    });

    const activeNoteTaskKeys = new Set<string>();

    for (const pTask of parsedTasks) {
      const taskKey = pTask.text.trim().toLowerCase();
      activeNoteTaskKeys.add(taskKey);

      const existingTask = existingTasksMap.get(taskKey);
      const expectedStatus = pTask.completed ? 'completed' : 'needsAction';

      if (!existingTask) {
        // Create new task in Zenith task board
        await addLocalTask(userId, activeListId, {
          title: pTask.text,
          notes: `Synced from Obsidian Note: ${noteTitle}`,
          status: expectedStatus,
          due: pTask.dueDate
        });

        // The newly created task needs the noteId and noteTaskKey saved.
        // Since addLocalTask runs asynchronously, we'll query and update it, 
        // or directly update the newly created task document.
        // To be safe and instant, we can find the task in Firestore and bind it:
        const qTasks = query(tasksRef, where('title', '==', pTask.text), where('notes', '==', `Synced from Obsidian Note: ${noteTitle}`));
        const snap = await getDocs(qTasks);
        for (const d of snap.docs) {
          await updateDoc(doc(db, 'users', userId, 'tasks', d.id), {
            noteId,
            noteTaskKey: taskKey
          });
        }
      } else {
        // Task exists; check if status or due date changed
        const statusChanged = existingTask.status !== expectedStatus;
        const dueChanged = existingTask.due !== pTask.dueDate;

        if (statusChanged || dueChanged) {
          await updateLocalTask(userId, activeListId, existingTask.id, {
            status: expectedStatus,
            due: pTask.dueDate || undefined
          });
        }
      }
    }

    // Clean up: Delete tasks on the board that were removed from the Markdown file text
    for (const [key, existingTask] of existingTasksMap.entries()) {
      if (!activeNoteTaskKeys.has(key)) {
        await deleteLocalTask(userId, activeListId, existingTask.id);
      }
    }
  } catch (err) {
    console.error(`Error syncing tasks from note ${noteTitle} to board:`, err);
  }
};

/* =========================================================================
   Bidirectional Sync: Task Board -> Note Markdown
   ========================================================================= */

// Update the checkbox inside a note's markdown when a task is completed/uncompleted in Zenith
export const updateNoteCheckboxInMarkdown = (
  content: string,
  taskTitle: string,
  completed: boolean
): string => {
  if (!content) return '';
  const lines = content.split('\n');
  const taskRegex = /^(\s*-\s*\[)([ xX])(\]\s*)(.+)$/;
  const targetClean = taskTitle.trim().toLowerCase();

  const updatedLines = lines.map((line) => {
    const match = taskRegex.exec(line);
    if (match) {
      let text = match[4].trim();

      // Clean due date marker to compare titles
      text = text.replace(/@due\(\d{4}-\d{2}-\d{2}\)/, '').trim();

      if (text.toLowerCase() === targetClean) {
        const checkChar = completed ? 'x' : ' ';
        return `${match[1]}${checkChar}${match[3]}${match[4]}`;
      }
    }
    return line;
  });

  return updatedLines.join('\n');
};
