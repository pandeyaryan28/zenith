import React, { useState } from 'react';
import type { LocalEvent } from '../services/syncService';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Trash2, 
  X,
  Sparkles
} from 'lucide-react';

interface CalendarViewProps {
  events: LocalEvent[];
  onAddEvent: (summary: string, startStr: string, endStr: string, description?: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  onAddEvent,
  onDeleteEvent
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LocalEvent | null>(null);
  
  // Add Event Form State
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Month navigation helpers
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const setToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar calculations
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

  // Match events to a specific day (YYYY-MM-DD)
  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => {
      if (event.localDeleted) return false;
      const startDateTime = event.start.dateTime || event.start.date;
      if (!startDateTime) return false;
      return startDateTime.startsWith(dateStr);
    });
  };

  const handleOpenAddModal = (day: number) => {
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
    setIsAddModalOpen(true);
  };

  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !selectedDate) return;
    setIsSubmitting(true);
    
    try {
      // Construct ISO strings
      const yyyymmdd = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const startIso = `${yyyymmdd}T${startTime}:00`;
      const endIso = `${yyyymmdd}T${endTime}:00`;
      
      await onAddEvent(summary.trim(), startIso, endIso, description.trim() || undefined);
      
      // Reset & close
      setSummary('');
      setDescription('');
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetailModal = (event: LocalEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // Stop day cell click trigger
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
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

  return (
    <div className="glass-panel" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* 1. Calendar Header Controls */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CalendarIcon size={18} style={{ color: 'var(--color-secondary)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            {monthNames[month]} {year}
          </h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={setToday} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            Today
          </button>
          <button onClick={prevMonth} className="btn-secondary" style={{ padding: '0.4rem' }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="btn-secondary" style={{ padding: '0.4rem' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 2. Grid Month View */}
      <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', overflow: 'hidden' }}>
        
        {/* Day Header Labels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{ padding: '0.5rem 0', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {day}
            </div>
          ))}
        </div>

        {/* Days Cells Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', height: '100%', background: 'rgba(255, 255, 255, 0.005)' }}>
          {/* Previous Month Padding */}
          {paddingArray.map((_, index) => (
            <div key={`pad-${index}`} style={{ borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', opacity: 0.15, background: 'rgba(0,0,0,0.1)' }} />
          ))}

          {/* Actual Days */}
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
                  background: currentIsToday ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={(e) => e.currentTarget.style.background = currentIsToday ? 'rgba(99, 102, 241, 0.03)' : 'transparent'}
              >
                {/* Day Number */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: currentIsToday ? 'bold' : 'normal',
                    color: currentIsToday ? 'var(--color-primary)' : 'var(--text-secondary)',
                    background: currentIsToday ? 'var(--color-primary-glow)' : 'transparent',
                    width: '20px',
                    height: '20px',
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

                {/* Day Events List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflowY: 'auto', flex: 1, maxHeight: '75px' }} className="custom-scroll">
                  {dayEvents.map(event => {
                    const isPending = event.pendingChange;
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => handleOpenDetailModal(event, e)}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                          background: isPending ? 'rgba(6, 182, 212, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                          color: isPending ? 'var(--color-secondary)' : 'var(--color-primary)',
                          borderLeft: isPending ? '2px solid var(--color-secondary)' : '2px solid var(--color-primary)',
                          border: isPending ? '1px dashed rgba(6, 182, 212, 0.3)' : 'none',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.summary}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Overlay Modal: Add Event */}
      {isAddModalOpen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(6,7,10,0.85)', backdropFilter: 'blur(8px)', zIndex: 10,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
            <button 
              onClick={() => setIsAddModalOpen(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-secondary)' }}>
              <Sparkles size={18} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Create New Event</h3>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Scheduling on: {selectedDate?.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>

            <form onSubmit={handleAddEventSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Summary / Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="E.g., Team Sync Meeting"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Time</label>
                  <input 
                    type="time" 
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>End Time</label>
                  <input 
                    type="time" 
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                <textarea 
                  placeholder="Optional details, links, etc."
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
                  style={{ flex: 1, padding: '0.625rem' }}
                >
                  {isSubmitting ? 'Creating...' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Overlay Modal: Event Details */}
      {isDetailModalOpen && selectedEvent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(6,7,10,0.85)', backdropFilter: 'blur(8px)', zIndex: 10,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '380px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
            <button 
              onClick={() => setIsDetailModalOpen(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
              <CalendarIcon size={18} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Event Details</h3>
            </div>

            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginTop: '0.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {selectedEvent.summary}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                <Clock size={12} />
                <span>
                  {formatEventTime(selectedEvent)} 
                  {' - '} 
                  {new Date(selectedEvent.start.dateTime || selectedEvent.start.date || '').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            {selectedEvent.description && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                  {selectedEvent.description}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Status: {selectedEvent.pendingChange ? (
                  <span style={{ color: 'var(--color-secondary)' }}>Syncing...</span>
                ) : (
                  <span style={{ color: 'var(--color-success)' }}>Saved to Google</span>
                )}
              </span>

              <button 
                onClick={() => handleDeleteEventClick(selectedEvent.id)}
                className="btn"
                style={{ padding: '0.5rem', color: 'var(--text-muted)', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.background = 'var(--color-danger)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
