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

// Dynamic loader for Google API Client library (gapi) to resolve CORS issues
let gapiInitialized: Promise<void> | null = null;

const initGapiClient = (): Promise<void> => {
  if (gapiInitialized) return gapiInitialized;

  gapiInitialized = new Promise((resolve, reject) => {
    // If gapi is already loaded globally, skip injection
    if ((window as any).gapi) {
      (window as any).gapi.load('client', () => {
        (window as any).gapi.client.init({})
          .then(() => resolve())
          .catch((err: any) => reject(err));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as any).gapi.load('client', () => {
        (window as any).gapi.client.init({})
          .then(() => resolve())
          .catch((err: any) => reject(err));
      });
    };
    script.onerror = () => reject(new Error('Failed to load gapi script'));
    document.body.appendChild(script);
  });

  return gapiInitialized;
};

// Request Executor using gapi (which uses postMessage iframe proxies to bypass CORS)
const executeGoogleRequest = async (path: string, method: string = 'GET', body?: any) => {
  try {
    await initGapiClient();
    const token = getGoogleAccessToken();
    
    // Set active authorization credentials
    (window as any).gapi.client.setToken({ access_token: token });

    const response = await (window as any).gapi.client.request({
      path,
      method,
      body
    });

    if (response.status === 401) {
      localStorage.removeItem('google_oauth_token');
      localStorage.removeItem('google_oauth_token_expiry');
      throw new Error('TOKEN_EXPIRED');
    }

    // Return parsed JSON results
    return response.result;
  } catch (error: any) {
    console.error(`Google API request failed: ${method} ${path}`, error);
    
    // Check if error is related to credentials
    if (error?.status === 401 || error?.error?.code === 401 || error?.message === 'TOKEN_EXPIRED') {
      localStorage.removeItem('google_oauth_token');
      localStorage.removeItem('google_oauth_token_expiry');
      throw new Error('TOKEN_EXPIRED');
    }
    
    throw error;
  }
};

/* =========================================================================
   Google Tasks API
   ========================================================================= */

// Get all task lists
export const fetchGoogleTaskLists = async (): Promise<GoogleTaskList[]> => {
  const data = await executeGoogleRequest('https://tasks.googleapis.com/v1/users/@me/lists');
  return data.items || [];
};

// Get tasks from a list
export const fetchGoogleTasks = async (listId: string): Promise<GoogleTask[]> => {
  const data = await executeGoogleRequest(`https://tasks.googleapis.com/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true`);
  return data.items || [];
};

// Create a task
export const createGoogleTask = async (listId: string, task: Omit<GoogleTask, 'id' | 'updated'>): Promise<GoogleTask> => {
  return await executeGoogleRequest(`https://tasks.googleapis.com/v1/lists/${listId}/tasks`, 'POST', task);
};

// Update a task
export const updateGoogleTask = async (listId: string, taskId: string, task: Partial<GoogleTask>): Promise<GoogleTask> => {
  return await executeGoogleRequest(`https://tasks.googleapis.com/v1/lists/${listId}/tasks/${taskId}`, 'PATCH', task);
};

// Delete a task
export const deleteGoogleTask = async (listId: string, taskId: string): Promise<void> => {
  await executeGoogleRequest(`https://tasks.googleapis.com/v1/lists/${listId}/tasks/${taskId}`, 'DELETE');
};

/* =========================================================================
   Google Calendar API
   ========================================================================= */

// Get all calendars
export const fetchGoogleCalendars = async (): Promise<GoogleCalendar[]> => {
  const data = await executeGoogleRequest('https://www.googleapis.com/calendar/v3/users/me/calendarList');
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
  
  const data = await executeGoogleRequest(url);
  return data.items || [];
};

// Create a calendar event
export const createGoogleEvent = async (calendarId: string, event: Omit<GoogleEvent, 'id' | 'updated'>): Promise<GoogleEvent> => {
  return await executeGoogleRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, 'POST', event);
};

// Update a calendar event
export const updateGoogleEvent = async (calendarId: string, eventId: string, event: Partial<GoogleEvent>): Promise<GoogleEvent> => {
  return await executeGoogleRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, 'PATCH', event);
};

// Delete a calendar event
export const deleteGoogleEvent = async (calendarId: string, eventId: string): Promise<void> => {
  await executeGoogleRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, 'DELETE');
};
