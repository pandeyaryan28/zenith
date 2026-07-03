export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string; // RFC 3339 timestamp
  updated: string;
  deleted?: boolean;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  updated: string;
  status?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

// Token helper
export const getGoogleAccessToken = (): string => {
  const token = localStorage.getItem('google_oauth_token');
  const expiryStr = localStorage.getItem('google_oauth_token_expiry');
  
  if (!token || !expiryStr) {
    throw new Error('AUTH_REQUIRED');
  }
  
  const expiry = parseInt(expiryStr, 10);
  if (Date.now() > expiry) {
    throw new Error('TOKEN_EXPIRED');
  }
  
  return token;
};

// Generic fetch wrapper with auth header
const googleFetch = async (url: string, options: RequestInit = {}) => {
  try {
    const token = getGoogleAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      localStorage.removeItem('google_oauth_token');
      localStorage.removeItem('google_oauth_token_expiry');
      throw new Error('TOKEN_EXPIRED');
    }
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API Error: ${response.status} - ${errText}`);
    }
    
    // DELETE requests might return empty responses
    if (response.status === 204) return null;
    
    return await response.json();
  } catch (error: any) {
    console.error(`Fetch failed for URL: ${url}`, error);
    throw error;
  }
};

/* =========================================================================
   Google Tasks API
   ========================================================================= */

// Get all task lists
export const fetchGoogleTaskLists = async (): Promise<GoogleTaskList[]> => {
  const data = await googleFetch('https://tasks.googleapis.com/v1/users/@me/lists');
  return data.items || [];
};

// Get tasks from a list
export const fetchGoogleTasks = async (listId: string): Promise<GoogleTask[]> => {
  const data = await googleFetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true`);
  return data.items || [];
};

// Create a task
export const createGoogleTask = async (listId: string, task: Omit<GoogleTask, 'id' | 'updated'>): Promise<GoogleTask> => {
  return await googleFetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task),
  });
};

// Update a task (e.g. rename, set due date, mark complete)
export const updateGoogleTask = async (listId: string, taskId: string, task: Partial<GoogleTask>): Promise<GoogleTask> => {
  // PATCH is cleaner for partial updates
  return await googleFetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(task),
  });
};

// Delete a task
export const deleteGoogleTask = async (listId: string, taskId: string): Promise<void> => {
  await googleFetch(`https://tasks.googleapis.com/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
};

/* =========================================================================
   Google Calendar API
   ========================================================================= */

// Get all calendars
export const fetchGoogleCalendars = async (): Promise<GoogleCalendar[]> => {
  const data = await googleFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  return data.items || [];
};

// Get calendar events
export const fetchGoogleEvents = async (
  calendarId: string, 
  timeMin?: string, 
  timeMax?: string
): Promise<GoogleEvent[]> => {
  let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&orderBy=startTime`;
  if (timeMin) url += `&timeMin=${encodeURIComponent(timeMin)}`;
  if (timeMax) url += `&timeMax=${encodeURIComponent(timeMax)}`;
  
  const data = await googleFetch(url);
  return data.items || [];
};

// Create a calendar event
export const createGoogleEvent = async (calendarId: string, event: Omit<GoogleEvent, 'id' | 'updated'>): Promise<GoogleEvent> => {
  return await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
};

// Update a calendar event
export const updateGoogleEvent = async (calendarId: string, eventId: string, event: Partial<GoogleEvent>): Promise<GoogleEvent> => {
  return await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  });
};

// Delete a calendar event
export const deleteGoogleEvent = async (calendarId: string, eventId: string): Promise<void> => {
  await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
};
