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

// Dynamic loader for Google API Client library (gapi) and discovery docs
let gapiInitialized: Promise<void> | null = null;

const initGapiClient = (): Promise<void> => {
  if (gapiInitialized) return gapiInitialized;

  gapiInitialized = new Promise((resolve, reject) => {
    const startLoad = () => {
      (window as any).gapi.load('client', async () => {
        try {
          await (window as any).gapi.client.init({});
          
          // Load Tasks & Calendar API discovery metadata to enable native JS endpoints
          await Promise.all([
            (window as any).gapi.client.load('https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest'),
            (window as any).gapi.client.load('https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest')
          ]);
          
          resolve();
        } catch (err) {
          console.error("GAPI Client initialization failed", err);
          reject(err);
        }
      });
    };

    // If gapi is already loaded globally, initialize
    if ((window as any).gapi) {
      startLoad();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = startLoad;
    script.onerror = () => reject(new Error('Failed to load gapi script'));
    document.body.appendChild(script);
  });

  return gapiInitialized;
};

// Set token and prepare GAPI client
const prepareGapi = async () => {
  await initGapiClient();
  const token = getGoogleAccessToken();
  (window as any).gapi.client.setToken({ access_token: token });
};

// Standard error handler
const handleGapiError = (error: any) => {
  console.error("Google API Request failed:", error);
  
  const status = error?.status || error?.result?.error?.code;
  if (status === 401 || error?.message === 'TOKEN_EXPIRED') {
    localStorage.removeItem('google_oauth_token');
    localStorage.removeItem('google_oauth_token_expiry');
    throw new Error('TOKEN_EXPIRED');
  }
  
  throw error;
};

/* =========================================================================
   Google Tasks API (Using gapi.client.tasks)
   ========================================================================= */

// Get all task lists
export const fetchGoogleTaskLists = async (): Promise<GoogleTaskList[]> => {
  await prepareGapi();
  try {
    const response = await (window as any).gapi.client.tasks.tasklists.list();
    return response.result.items || [];
  } catch (error) {
    return handleGapiError(error);
  }
};

// Get tasks from a list
export const fetchGoogleTasks = async (listId: string): Promise<GoogleTask[]> => {
  await prepareGapi();
  try {
    const response = await (window as any).gapi.client.tasks.tasks.list({
      tasklist: listId,
      showCompleted: true,
      showHidden: true
    });
    return response.result.items || [];
  } catch (error) {
    return handleGapiError(error);
  }
};

// Create a task
export const createGoogleTask = async (listId: string, task: Omit<GoogleTask, 'id' | 'updated'>): Promise<GoogleTask> => {
  await prepareGapi();
  try {
    const response = await (window as any).gapi.client.tasks.tasks.insert({
      tasklist: listId,
      resource: task
    });
    return response.result;
  } catch (error) {
    return handleGapiError(error);
  }
};

// Update a task
export const updateGoogleTask = async (listId: string, taskId: string, task: Partial<GoogleTask>): Promise<GoogleTask> => {
  await prepareGapi();
  try {
    const response = await (window as any).gapi.client.tasks.tasks.patch({
      tasklist: listId,
      task: taskId,
      resource: task
    });
    return response.result;
  } catch (error) {
    return handleGapiError(error);
  }
};

// Delete a task
export const deleteGoogleTask = async (listId: string, taskId: string): Promise<void> => {
  await prepareGapi();
  try {
    await (window as any).gapi.client.tasks.tasks.delete({
      tasklist: listId,
      task: taskId
    });
  } catch (error) {
    handleGapiError(error);
  }
};

/* =========================================================================
   Google Calendar API (Using gapi.client.calendar)
   ========================================================================= */

// Get all calendars
export const fetchGoogleCalendars = async (): Promise<GoogleCalendar[]> => {
  await prepareGapi();
  try {
    const response = await (window as any).gapi.client.calendar.calendarList.list();
    return response.result.items || [];
  } catch (error) {
    return handleGapiError(error);
  }
};

// Get calendar events
export const fetchGoogleEvents = async (
  calendarId: string, 
  timeMin?: string, 
  timeMax?: string
): Promise<GoogleEvent[]> => {
  await prepareGapi();
  try {
    const params: any = {
      calendarId,
      singleEvents: true,
      orderBy: 'startTime'
    };
    if (timeMin) params.timeMin = timeMin;
    if (timeMax) params.timeMax = timeMax;

    const response = await (window as any).gapi.client.calendar.events.list(params);
    return response.result.items || [];
  } catch (error) {
    return handleGapiError(error);
  }
};

// Create a calendar event
export const createGoogleEvent = async (calendarId: string, event: Omit<GoogleEvent, 'id' | 'updated'>): Promise<GoogleEvent> => {
  await prepareGapi();
  try {
    const response = await (window as any).gapi.client.calendar.events.insert({
      calendarId,
      resource: event
    });
    return response.result;
  } catch (error) {
    return handleGapiError(error);
  }
};

// Update a calendar event
export const updateGoogleEvent = async (calendarId: string, eventId: string, event: Partial<GoogleEvent>): Promise<GoogleEvent> => {
  await prepareGapi();
  try {
    const response = await (window as any).gapi.client.calendar.events.patch({
      calendarId,
      eventId,
      resource: event
    });
    return response.result;
  } catch (error) {
    return handleGapiError(error);
  }
};

// Delete a calendar event
export const deleteGoogleEvent = async (calendarId: string, eventId: string): Promise<void> => {
  await prepareGapi();
  try {
    await (window as any).gapi.client.calendar.events.delete({
      calendarId,
      eventId
    });
  } catch (error) {
    handleGapiError(error);
  }
};
