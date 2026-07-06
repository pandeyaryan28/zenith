import React, { useState } from 'react';
import type { LocalEvent } from '../services/syncService';
import type { GoogleEvent } from '../services/googleApi';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Trash2, 
  X,
  Sparkles,
  Plus,
  Edit2,
  Check,
  Tag
} from 'lucide-react';

interface CalendarViewProps {
  events: LocalEvent[];
  onAddEvent: (summary: string, startStr: string, endStr: string, description?: string) => Promise<void>;
  onUpdateEvent: (eventId: string, eventData: Partial<GoogleEvent>) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
}

const CATEGORIES = [
  { id: 'default', label: 'General', color: 'var(--text-secondary)', bg: 'rgba(255, 255, 255, 0.05)', border: 'var(--border-color)', tag: '' },
  { id: 'work', label: 'Work', color: 'var(--color-primary)', bg: 'rgba(99, 102, 241, 0.1)', border: 'var(--color-primary)', tag: '#work' },
  { id: 'personal', label: 'Personal', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', border: '#ec4899', tag: '#personal' },
  { id: 'urgent', label: 'Urgent', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', tag: '#urgent' },
  { id: 'health', label: 'Health', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', tag: '#health' }
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'schedule'>('month');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LocalEvent | null>(null);
  
  // Add Event Form State
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('default');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Event Form State
  const [editSummary, setEditSummary] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState('default');

  // Helper: Parse Category from event
  const getEventCategory = (event: LocalEvent) => {
    const text = ((event.summary || '') + ' ' + (event.description || '')).toLowerCase();
    if (text.includes('#work')) return 'work';
    if (text.includes('#personal')) return 'personal';
    if (text.includes('#urgent')) return 'urgent';
    if (text.includes('#health')) return 'health';
    return 'default';
  };

  const getCategoryDetails = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
  };

  // Strip category tag from description for editing
  const cleanDescription = (desc: string) => {
    let result = desc || '';
    CATEGORIES.forEach(c => {
      if (c.tag) {
        result = result.replace(c.tag, '').trim();
      }
    });
    return result;
  };

  // Month navigation helpers
  const handlePrev = () => {
    if (viewMode === 'month' || viewMode === 'schedule') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const prevD = new Date(currentDate);
      prevD.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevD);
    } else {
      const prevD = new Date(currentDate);
      prevD.setDate(currentDate.getDate() - 1);
      setCurrentDate(prevD);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month' || viewMode === 'schedule') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const nextD = new Date(currentDate);
      nextD.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextD);
    } else {
      const nextD = new Date(currentDate);
      nextD.setDate(currentDate.getDate() + 1);
      setCurrentDate(nextD);
    }
  };

  const setToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar calculations (Month View)
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
  const paddingArray = Array.from({ length: firstDayIndex }, () => null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  // Get week days of current week
  const getDaysOfWeek = (date: Date) => {
    const day = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - day);
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  };

  // Match events to a specific date string (YYYY-MM-DD)
  const getEventsForDateStr = (dateStr: string) => {
    return events.filter(event => {
      if (event.localDeleted) return false;
      const startDateTime = event.start.dateTime || event.start.date;
      if (!startDateTime) return false;
      return startDateTime.startsWith(dateStr);
    });
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return getEventsForDateStr(dateStr);
  };

  const handleOpenAddModal = (day: number, predefinedHour?: string) => {
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
    if (predefinedHour) {
      setStartTime(predefinedHour);
      const [h, m] = predefinedHour.split(':');
      const endH = String(Number(h) + 1).padStart(2, '0');
      setEndTime(`${endH}:${m}`);
    } else {
      setStartTime('09:00');
      setEndTime('10:00');
    }
    setSummary('');
    setDescription('');
    setCategory('default');
    setIsAddModalOpen(true);
  };

  const handleOpenAddModalForDate = (date: Date, predefinedHour?: string) => {
    setSelectedDate(date);
    if (predefinedHour) {
      setStartTime(predefinedHour);
      const [h, m] = predefinedHour.split(':');
      const endH = String(Number(h) + 1).padStart(2, '0');
      setEndTime(`${endH}:${m}`);
    } else {
      setStartTime('09:00');
      setEndTime('10:00');
    }
    setSummary('');
    setDescription('');
    setCategory('default');
    setIsAddModalOpen(true);
  };

  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !selectedDate) return;
    setIsSubmitting(true);
    
    try {
      const yyyymmdd = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const startIso = `${yyyymmdd}T${startTime}:00`;
      const endIso = `${yyyymmdd}T${endTime}:00`;
      
      // Append Category tag to description
      const catObj = getCategoryDetails(category);
      const finalDescription = description.trim() + (catObj.tag ? ` ${catObj.tag}` : '');
      
      await onAddEvent(summary.trim(), startIso, endIso, finalDescription.trim() || undefined);
      
      setSummary('');
      setDescription('');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetailModal = (event: LocalEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    
    // Set edit fields
    setEditSummary(event.summary);
    setEditDescription(cleanDescription(event.description || ''));
    setEditCategory(getEventCategory(event));
    
    const startStr = event.start.dateTime || event.start.date || '';
    const endStr = event.end.dateTime || event.end.date || '';
    
    if (startStr) {
      const d = new Date(startStr);
      setEditDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setEditStartTime(d.toTimeString().split(' ')[0].substring(0, 5));
    }
    
    if (endStr) {
      const d = new Date(endStr);
      setEditEndTime(d.toTimeString().split(' ')[0].substring(0, 5));
    }
    
    setIsEditing(false);
    setIsDetailModalOpen(true);
  };

  const handleUpdateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !editSummary.trim()) return;
    setIsSubmitting(true);
    
    try {
      const startIso = `${editDate}T${editStartTime}:00`;
      const endIso = `${editDate}T${editEndTime}:00`;
      
      const catObj = getCategoryDetails(editCategory);
      const finalDescription = editDescription.trim() + (catObj.tag ? ` ${catObj.tag}` : '');
      
      await onUpdateEvent(selectedEvent.id, {
        summary: editSummary.trim(),
        description: finalDescription.trim() || undefined,
        start: { dateTime: startIso },
        end: { dateTime: endIso }
      });
      
      setIsDetailModalOpen(false);
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEventClick = async (eventId: string) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await onDeleteEvent(eventId);
      setIsDetailModalOpen(false);
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
    }
  };

  const formatEventTime = (event: LocalEvent) => {
    if (event.start.date) return 'All Day';
    if (!event.start.dateTime) return '';
    const date = new Date(event.start.dateTime);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isDateToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  // Rendering Helper: List events for a specific hour (Day View)
  const getEventsForHour = (date: Date, hour: number) => {
    const yyyymmdd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const prefix = `${yyyymmdd}T${String(hour).padStart(2, '0')}`;
    
    return events.filter(event => {
      if (event.localDeleted) return false;
      const startDateTime = event.start.dateTime;
      if (!startDateTime) return false;
      return startDateTime.startsWith(prefix);
    });
  };

  const formatDateStr = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Helper for schedule view: Group events by date string (YYYY-MM-DD) for the current month
  const getScheduleEvents = () => {
    const filtered = events.filter(event => {
      if (event.localDeleted) return false;
      const startStr = event.start.dateTime || event.start.date;
      if (!startStr) return false;
      const d = new Date(startStr);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const groups: { [dateStr: string]: LocalEvent[] } = {};
    filtered.forEach(event => {
      const startStr = event.start.dateTime || event.start.date || '';
      const datePart = startStr.split('T')[0];
      if (!groups[datePart]) {
        groups[datePart] = [];
      }
      groups[datePart].push(event);
    });

    const sortedDates = Object.keys(groups).sort();
    sortedDates.forEach(dateStr => {
      groups[dateStr].sort((a, b) => {
        const aTime = a.start.dateTime ? new Date(a.start.dateTime).getTime() : 0;
        const bTime = b.start.dateTime ? new Date(b.start.dateTime).getTime() : 0;
        return aTime - bTime;
      });
    });

    return { sortedDates, groups };
  };

  return (
    <div className="glass-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* 1. Header Navigation & Controls */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--color-secondary-glow)' }}>
            <CalendarIcon size={20} style={{ color: 'var(--color-secondary)' }} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {viewMode === 'month' && `${monthNames[month]} ${year}`}
            {viewMode === 'week' && `Week of ${monthNames[getDaysOfWeek(currentDate)[0].getMonth()]} ${getDaysOfWeek(currentDate)[0].getDate()}, ${getDaysOfWeek(currentDate)[0].getFullYear()}`}
            {viewMode === 'day' && `${currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
            {viewMode === 'schedule' && `Schedule for ${monthNames[month]} ${year}`}
          </h2>
        </div>
        
        {/* Toggle view buttons & navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            {(['month', 'week', 'day', 'schedule'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  background: viewMode === mode ? 'var(--color-secondary-glow)' : 'transparent',
                  color: viewMode === mode ? 'var(--color-secondary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button onClick={setToday} className="btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 600 }}>
              Today
            </button>
            <button onClick={handlePrev} className="btn-secondary" style={{ padding: '0.45rem' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={handleNext} className="btn-secondary" style={{ padding: '0.45rem' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Calendar Content Viewport */}
      <div style={{ overflow: 'hidden', height: '100%' }}>
        
        {/* =========================================================================
           MONTH VIEW
           ========================================================================= */}
        {viewMode === 'month' && (
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
            {/* Day Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{ padding: '0.6rem 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Cell Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', height: '100%', background: 'rgba(255,255,255,0.002)' }}>
              {paddingArray.map((_, index) => (
                <div key={`pad-${index}`} style={{ borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', opacity: 0.1, background: 'rgba(0,0,0,0.1)' }} />
              ))}

              {daysArray.map(day => {
                const dayEvents = getEventsForDay(day);
                const currentIsToday = isToday(day);

                return (
                  <div
                    key={`day-${day}`}
                    onClick={() => handleOpenAddModal(day)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      borderRight: '1px solid var(--border-color)',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      background: currentIsToday ? 'rgba(99, 102, 241, 0.02)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                    className="hover-card-highlight"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = currentIsToday ? 'rgba(99, 102, 241, 0.02)' : 'transparent'}
                  >
                    {/* Day label */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: currentIsToday ? 700 : 500,
                        color: currentIsToday ? 'var(--color-primary)' : 'var(--text-secondary)',
                        background: currentIsToday ? 'var(--color-primary-glow)' : 'transparent',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: currentIsToday ? '1px solid rgba(99, 102, 241, 0.3)' : 'none'
                      }}>
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Events list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflowY: 'auto', flex: 1, maxHeight: '80px' }} className="custom-scroll">
                      {dayEvents.map(event => {
                        const isPending = event.pendingChange;
                        const catId = getEventCategory(event);
                        const cat = getCategoryDetails(catId);
                        
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => handleOpenDetailModal(event, e)}
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              background: isPending ? 'rgba(6, 182, 212, 0.08)' : cat.bg,
                              color: isPending ? 'var(--color-secondary)' : cat.color,
                              borderLeft: `2.5px solid ${isPending ? 'var(--color-secondary)' : cat.border}`,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontWeight: 600
                            }}
                          >
                            {formatEventTime(event)} - {event.summary}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
           WEEK VIEW
           ========================================================================= */}
        {viewMode === 'week' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%', overflow: 'hidden' }}>
            {getDaysOfWeek(currentDate).map((day, idx) => {
              const dateStr = formatDateStr(day);
              const dayEvents = getEventsForDateStr(dateStr);
              const dayIsToday = isDateToday(day);

              return (
                <div
                  key={idx}
                  onClick={() => handleOpenAddModalForDate(day)}
                  style={{
                    borderRight: idx < 6 ? '1px solid var(--border-color)' : 'none',
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr',
                    height: '100%',
                    background: dayIsToday ? 'rgba(99, 102, 241, 0.015)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = dayIsToday ? 'rgba(99, 102, 241, 0.015)' : 'transparent'}
                >
                  {/* Column Header */}
                  <div style={{
                    padding: '1rem 0.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: 'rgba(255,255,255,0.01)'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {day.toLocaleDateString([], { weekday: 'short' })}
                    </span>
                    <span style={{
                      fontSize: '1rem',
                      fontWeight: 800,
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: dayIsToday ? 'var(--color-primary)' : 'transparent',
                      color: dayIsToday ? '#fff' : 'var(--text-primary)'
                    }}>
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Column Events List */}
                  <div className="custom-scroll" style={{ padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                    {dayEvents.map(event => {
                      const catId = getEventCategory(event);
                      const cat = getCategoryDetails(catId);
                      return (
                        <div
                          key={event.id}
                          onClick={(e) => handleOpenDetailModal(event, e)}
                          style={{
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            background: cat.bg,
                            border: `1px solid ${cat.border}22`,
                            borderLeft: `3px solid ${cat.color}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            cursor: 'pointer'
                          }}
                          className="hover-scale"
                        >
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {event.summary}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: cat.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={10} />
                            {formatEventTime(event)}
                          </span>
                        </div>
                      );
                    })}

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'auto', padding: '0.5rem', opacity: 0.1 }} className="hover-visible">
                      <Plus size={16} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================================================
           DAY VIEW
           ========================================================================= */}
        {viewMode === 'day' && (
          <div className="custom-scroll" style={{ height: '100%', overflowY: 'auto', padding: '1rem 2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '800px', margin: '0 auto' }}>
              {Array.from({ length: 15 }, (_, i) => i + 7).map(hour => { // 7 AM to 9 PM
                const formattedHour = `${String(hour).padStart(2, '0')}:00`;
                const displayHour = hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
                const hourEvents = getEventsForHour(currentDate, hour);
                
                return (
                  <div
                    key={hour}
                    onClick={() => handleOpenAddModalForDate(currentDate, formattedHour)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr',
                      alignItems: 'start',
                      padding: '0.75rem 0',
                      borderBottom: '1px solid var(--border-color)',
                      minHeight: '80px',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Hour label */}
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
                      {displayHour}
                    </span>

                    {/* Events at this hour */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {hourEvents.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0, paddingLeft: '0.5rem' }} className="hover-visible">
                          Click to schedule event at {displayHour}
                        </span>
                      ) : (
                        hourEvents.map(event => {
                          const catId = getEventCategory(event);
                          const cat = getCategoryDetails(catId);
                          
                          // Duration calc
                          const start = new Date(event.start.dateTime || '');
                          const end = new Date(event.end.dateTime || '');
                          const durationMin = isNaN(start.getTime()) || isNaN(end.getTime()) ? 60 : Math.round((end.getTime() - start.getTime()) / 60000);

                          return (
                            <div
                              key={event.id}
                              onClick={(e) => handleOpenDetailModal(event, e)}
                              style={{
                                padding: '0.6rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                background: cat.bg,
                                border: `1px solid ${cat.border}33`,
                                borderLeft: `4px solid ${cat.color}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                boxShadow: 'var(--shadow-sm)',
                                cursor: 'pointer'
                              }}
                              className="hover-scale"
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {event.summary}
                                </span>
                                {event.description && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {cleanDescription(event.description)}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '0.7rem', color: cat.color, background: `${cat.color}15`, padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                  {cat.label}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                                  <Clock size={12} />
                                  {formatEventTime(event)} ({durationMin}m)
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
           SCHEDULE VIEW
           ========================================================================= */}
        {viewMode === 'schedule' && (() => {
          const { sortedDates, groups } = getScheduleEvents();
          return (
            <div className="custom-scroll" style={{ height: '100%', overflowY: 'auto', padding: '1.5rem 2rem' }}>
              {sortedDates.length === 0 ? (
                <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem 2rem', textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CalendarIcon size={24} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No events scheduled</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your agenda is clear for {monthNames[month]} {year}.</p>
                    </div>
                    <button 
                      onClick={() => handleOpenAddModalForDate(new Date(year, month, 1))} 
                      className="btn-primary" 
                      style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--grad-primary)', border: 'none' }}
                    >
                      <Plus size={16} />
                      <span>Add Event</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {sortedDates.map(dateStr => {
                    const dateObj = new Date(dateStr + 'T00:00:00');
                    const dayIsToday = isDateToday(dateObj);
                    const headerText = dateObj.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

                    return (
                      <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Day Header Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <span style={{ 
                            fontSize: '0.9rem', 
                            fontWeight: 700, 
                            color: dayIsToday ? 'var(--color-primary)' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-display)',
                            letterSpacing: '-0.01em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            {headerText}
                            {dayIsToday && (
                              <span style={{ 
                                fontSize: '0.65rem', 
                                fontWeight: 700, 
                                color: '#fff', 
                                background: 'var(--color-primary)', 
                                padding: '0.15rem 0.5rem', 
                                borderRadius: 'var(--radius-full)', 
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Today
                              </span>
                            )}
                          </span>
                          
                          <button
                            onClick={() => handleOpenAddModalForDate(dateObj)}
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                              padding: '0.2rem',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--text-primary)';
                              e.currentTarget.style.background = 'var(--color-primary-glow)';
                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted)';
                              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                            title={`Add event on ${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                          >
                            <Plus size={12} />
                          </button>

                          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.8 }} />
                        </div>

                        {/* Events List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '0.25rem' }}>
                          {groups[dateStr].map(event => {
                            const catId = getEventCategory(event);
                            const cat = getCategoryDetails(catId);
                            const start = new Date(event.start.dateTime || '');
                            const end = new Date(event.end.dateTime || '');
                            const durationMin = isNaN(start.getTime()) || isNaN(end.getTime()) ? null : Math.round((end.getTime() - start.getTime()) / 60000);

                            const timeStr = event.start.date ? 'All Day' : formatEventTime(event);
                            const durationStr = durationMin && durationMin > 0 ? (durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60 > 0 ? `${durationMin % 60}m` : ''}` : `${durationMin}m`) : '';

                            return (
                              <div
                                key={event.id}
                                onClick={(e) => handleOpenDetailModal(event, e)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '1.25rem',
                                  padding: '0.75rem 1rem',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  transition: 'background var(--transition-fast), transform var(--transition-fast)'
                                }}
                                className="hover-card-highlight"
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                                  e.currentTarget.style.transform = 'translateX(4px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.transform = 'translateX(0)';
                                }}
                              >
                                {/* Time column */}
                                <div style={{ 
                                  width: '130px', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: '0.1rem',
                                  flexShrink: 0
                                }}>
                                  <span style={{ 
                                    fontSize: '0.85rem', 
                                    fontWeight: 600, 
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-body)'
                                  }}>
                                    {timeStr}
                                  </span>
                                  {durationStr && (
                                    <span style={{ 
                                      fontSize: '0.7rem', 
                                      color: 'var(--text-muted)',
                                      fontFamily: 'var(--font-body)'
                                    }}>
                                      {durationStr}
                                    </span>
                                  )}
                                </div>

                                {/* Category color dot */}
                                <div style={{ 
                                  width: '10px', 
                                  height: '10px', 
                                  borderRadius: '50%', 
                                  background: cat.color,
                                  boxShadow: `0 0 8px ${cat.color}88`,
                                  flexShrink: 0
                                }} />

                                {/* Title and description */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, minWidth: 0 }}>
                                  <span style={{ 
                                    fontSize: '0.9rem', 
                                    fontWeight: 600, 
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-body)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {event.summary}
                                  </span>
                                  {event.description && (
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      color: 'var(--text-muted)',
                                      fontFamily: 'var(--font-body)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      {cleanDescription(event.description)}
                                    </span>
                                  )}
                                </div>

                                {/* Category tag label */}
                                <div style={{ flexShrink: 0 }}>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    color: cat.color,
                                    background: `${cat.color}12`,
                                    border: `1px solid ${cat.color}25`,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em',
                                    fontFamily: 'var(--font-body)'
                                  }}>
                                    {cat.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* =========================================================================
         ADD EVENT MODAL
         ========================================================================= */}
      {isAddModalOpen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(6,7,10,0.8)', backdropFilter: 'blur(10px)', zIndex: 10,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '420px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', boxShadow: 'var(--shadow-lg)' }}>
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="hover-scale"
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-secondary)' }}>
              <Sparkles size={18} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Create New Event</h3>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Date: {selectedDate?.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>

            <form onSubmit={handleAddEventSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Title / Summary</label>
                <input 
                  type="text" 
                  required
                  placeholder="Meeting Title, Gym Session, etc."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Start Time</label>
                  <input 
                    type="time" 
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>End Time</label>
                  <input 
                    type="time" 
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Category dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Category / Tag</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--text-primary)',
                    padding: '0.5rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#111', color: '#fff' }}>
                      {c.label} {c.tag ? `(${c.tag})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Description / Details</label>
                <textarea 
                  placeholder="Optional details, links, comments..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={2}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '0.625rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="btn-primary" 
                  style={{ flex: 1, padding: '0.625rem', background: 'var(--grad-secondary)', border: 'none' }}
                >
                  {isSubmitting ? 'Creating...' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
         DETAIL / EDIT EVENT MODAL
         ========================================================================= */}
      {isDetailModalOpen && selectedEvent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(6,7,10,0.85)', backdropFilter: 'blur(10px)', zIndex: 10,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '420px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', boxShadow: 'var(--shadow-lg)' }}>
            <button 
              onClick={() => {
                setIsDetailModalOpen(false);
                setIsEditing(false);
              }}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>

            {/* Title block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isEditing ? 'var(--color-secondary)' : 'var(--color-primary)' }}>
              <CalendarIcon size={18} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {isEditing ? 'Edit Event Details' : 'Event Details'}
              </h3>
            </div>

            {/* Read-only / Form switch */}
            {!isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginTop: '0.25rem' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>
                    {selectedEvent.summary}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Clock size={12} style={{ color: 'var(--color-primary)' }} />
                    <span>
                      {formatEventTime(selectedEvent)} 
                      {' - '} 
                      {new Date(selectedEvent.start.dateTime || selectedEvent.start.date || '').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Category indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Tag size={12} style={{ color: getCategoryDetails(getEventCategory(selectedEvent)).color }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Category:</span>
                  <span style={{
                    fontSize: '0.7rem',
                    color: getCategoryDetails(getEventCategory(selectedEvent)).color,
                    background: `${getCategoryDetails(getEventCategory(selectedEvent)).color}15`,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    {getCategoryDetails(getEventCategory(selectedEvent)).label}
                  </span>
                </div>

                {selectedEvent.description && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Description</span>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.45, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.01)' }}>
                      {cleanDescription(selectedEvent.description)}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Sync: {selectedEvent.pendingChange ? (
                      <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>Syncing...</span>
                    ) : (
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Synced</span>
                    )}
                  </span>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary"
                      style={{ padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>

                    <button 
                      onClick={() => handleDeleteEventClick(selectedEvent.id)}
                      className="btn"
                      style={{ padding: '0.5rem', color: 'var(--text-muted)', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.background = 'var(--color-danger)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Event Editing form
              <form onSubmit={handleUpdateEventSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Title / Summary</label>
                  <input 
                    type="text" 
                    required
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Date</label>
                  <input 
                    type="date" 
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Start Time</label>
                    <input 
                      type="time" 
                      required
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>End Time</label>
                    <input 
                      type="time" 
                      required
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Category / Tag</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    disabled={isSubmitting}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      color: 'var(--text-primary)',
                      padding: '0.5rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id} style={{ background: '#111', color: '#fff' }}>
                        {c.label} {c.tag ? `(${c.tag})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Description</label>
                  <textarea 
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={isSubmitting}
                    rows={2}
                    style={{ resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)} 
                    className="btn-secondary" 
                    style={{ flex: 1, padding: '0.625rem' }}
                  >
                    Back to view
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="btn-primary" 
                    style={{ flex: 1, padding: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  >
                    <Check size={14} />
                    <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
