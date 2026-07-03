import React from 'react';
import type { LocalTask } from '../services/syncService';
import type { Habit, HabitLog } from '../services/habitService';
import { calculateStreak } from '../services/habitService';
import type { PomodoroSession } from '../services/pomodoroService';
import { 
  TrendingUp, 
  CheckSquare, 
  Timer, 
  Flame, 
  Clock
} from 'lucide-react';

interface AnalyticsPageProps {
  tasks: LocalTask[];
  habits: Habit[];
  habitLogs: { [habitId: string]: { [dateStr: string]: HabitLog } };
  pomodoroSessions: PomodoroSession[];
  activeListId: string;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  tasks,
  habits,
  habitLogs,
  pomodoroSessions,
  activeListId
}) => {
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 1. Focus Timer Metrics
  const workSessions = pomodoroSessions.filter(s => s.completed && s.type === 'work');
  const totalFocusMinutes = workSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const avgFocusMinutes = workSessions.length > 0 ? Math.round(totalFocusMinutes / workSessions.length) : 0;

  // 2. Habits Metrics
  const activeHabitsCount = habits.filter(h => !h.archived).length;
  const streakMetrics = habits
    .filter(h => !h.archived)
    .map(h => calculateStreak(habitLogs[h.id] || {}, h.frequency, h.daysOfWeek));
  const maxStreak = streakMetrics.length > 0 
    ? Math.max(...streakMetrics.map(m => m.currentStreak)) 
    : 0;

  // 3. Tasks Metrics
  const listTasks = tasks.filter(t => t.listId === activeListId && !t.localDeleted);
  const totalTasks = listTasks.length;
  const completedTasks = listTasks.filter(t => t.status === 'completed').length;
  const pendingTasks = listTasks.filter(t => t.status === 'needsAction').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // =========================================================================
  // CHART DATA 1: Weekly Focus Trend (Last 7 Days)
  // =========================================================================
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return getLocalDateStr(d);
  }).reverse();

  const weeklyFocusData = last7Days.map(dateStr => {
    const daySessions = pomodoroSessions.filter(s => {
      if (!s.completed || s.type !== 'work') return false;
      return getLocalDateStr(new Date(s.startTime)) === dateStr;
    });
    const mins = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const dateObj = new Date(dateStr + 'T00:00:00');
    const label = dateObj.toLocaleDateString([], { weekday: 'short' });
    return { dateStr, label, minutes: mins };
  });

  const maxWeeklyFocusMins = Math.max(...weeklyFocusData.map(d => d.minutes), 60);

  // =========================================================================
  // CHART DATA 2: Habit Consistency (Last 15 Days Line Chart)
  // =========================================================================
  const last15Days = Array.from({ length: 15 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return getLocalDateStr(d);
  }).reverse();

  const habitConsistencyData = last15Days.map(dateStr => {
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    // Habits scheduled for this day
    const scheduled = habits.filter(h => {
      const created = new Date(h.createdAt);
      created.setHours(0,0,0,0);
      const target = new Date(dateStr + 'T00:00:00');
      if (target < created || h.archived) return false;

      if (h.frequency === 'custom' && h.daysOfWeek) {
        return h.daysOfWeek.includes(dayOfWeek);
      }
      return true; // daily
    });

    if (scheduled.length === 0) return { dateStr, label: dateObj.getDate().toString(), rate: 0, empty: true };

    const completed = scheduled.filter(h => {
      const logs = habitLogs[h.id] || {};
      return logs[dateStr]?.status === 'completed';
    }).length;

    const rate = Math.round((completed / scheduled.length) * 100);
    return { dateStr, label: dateObj.getDate().toString(), rate, empty: false };
  });

  // =========================================================================
  // CHART DATA 3: Peak Focus Hours (Time of day distribution)
  // =========================================================================
  const timePeriods = [
    { name: 'Morning (6AM - 12PM)', count: 0, color: 'var(--color-warning)' },
    { name: 'Afternoon (12PM - 6PM)', count: 0, color: 'var(--color-secondary)' },
    { name: 'Evening (6PM - 12AM)', count: 0, color: 'var(--color-primary)' },
    { name: 'Night (12AM - 6AM)', count: 0, color: '#ec4899' }
  ];

  workSessions.forEach(s => {
    const hour = new Date(s.startTime).getHours();
    if (hour >= 6 && hour < 12) timePeriods[0].count++;
    else if (hour >= 12 && hour < 18) timePeriods[1].count++;
    else if (hour >= 18 && hour < 24) timePeriods[2].count++;
    else timePeriods[3].count++;
  });

  const totalPeriodSessions = timePeriods.reduce((sum, p) => sum + p.count, 0);

  // SVG doughnut metrics
  const radius = 50;
  const circ = 2 * Math.PI * radius;
  const strokeDashoffset = circ - (taskCompletionRate / 100) * circ;

  return (
    <div className="glass-panel" style={{ height: '100%', overflowY: 'auto', padding: '2rem' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', padding: '0.625rem', borderRadius: '0.75rem', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <TrendingUp size={22} className="text-gradient" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Visual Analytics</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Track and analyze your productivity streaks and stats.</p>
        </div>
      </div>

      {/* Grid of quick KPI metrics cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL FOCUS BLOCKS</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>{workSessions.length}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>completed</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Average duration: {avgFocusMinutes} minutes</span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL FOCUS HOURS</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-secondary)' }}>
              {totalFocusMinutes >= 60 ? (totalFocusMinutes / 60).toFixed(1) : `0.${totalFocusMinutes}`}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>hours</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total minutes: {totalFocusMinutes}</span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TASK STABILITY</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-success)' }}>{taskCompletionRate}%</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>completed</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{completedTasks} completed / {pendingTasks} pending</span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>HABITS CONSISTENCY</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-warning)' }}>{maxStreak} days</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>current streak</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Across {activeHabitsCount} active habits</span>
        </div>

      </div>

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.75rem' }}>
        
        {/* Chart 1: Focus Trend (Bar Chart) */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Timer size={16} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Weekly Focus Trend (Minutes)</h3>
          </div>
          <div style={{ height: '180px', position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '1rem 0.5rem' }}>
            {totalFocusMinutes === 0 ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No focus minutes logged this week
              </div>
            ) : (
              weeklyFocusData.map((d) => {
                const heightPercent = (d.minutes / maxWeeklyFocusMins) * 100;
                return (
                  <div key={d.dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {d.minutes > 0 ? `${d.minutes}m` : ''}
                    </span>
                    <div style={{ 
                      width: '28px', 
                      height: `${Math.max(4, heightPercent * 1.2)}px`, 
                      background: 'var(--grad-primary)', 
                      borderRadius: '4px 4px 0 0',
                      boxShadow: d.minutes > 0 ? '0 0 12px var(--color-primary-glow)' : 'none',
                      transition: 'height var(--transition-normal)'
                    }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{d.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 2: Habit Consistency Line Chart */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flame size={16} style={{ color: 'var(--color-warning)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Habit Consistency Index (Last 15 Days)</h3>
          </div>
          
          <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {habits.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No habit logs recorded</span>
            ) : (
              <svg width="100%" height="150" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal reference lines */}
                <line x1="0" y1="120" x2="100%" y2="120" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1="70" x2="100%" y2="70" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1="20" x2="100%" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                {/* Draw line path */}
                {(() => {
                  // Create simple points projection using percentages
                  return (
                    <g>
                      {/* We will draw a polyline with absolute width estimation or standard path coordinates */}
                      {/* For responsive SVG points, we can map percentage points to an SVG coordinate space */}
                      {/* Let's specify a fixed viewBox coordinates in SVG to handle responsive mapping: viewBox="0 0 350 150" */}
                      <svg viewBox="0 0 350 150" width="100%" height="150" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                        {/* Area Gradient */}
                        <path
                          d={`M 10 120 ` + habitConsistencyData.map((d, idx) => {
                            const x = 10 + idx * 23;
                            const y = 120 - (d.rate / 100) * 100;
                            return `L ${x} ${y}`;
                          }).join(' ') + ` L 332 120 Z`}
                          fill="url(#lineGrad)"
                        />

                        {/* Stroke Path */}
                        <path
                          d={habitConsistencyData.map((d, idx) => {
                            const x = 10 + idx * 23;
                            const y = 120 - (d.rate / 100) * 100;
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="var(--color-warning)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        {/* Interactive circles and labels */}
                        {habitConsistencyData.map((d, idx) => {
                          const x = 10 + idx * 23;
                          const y = 120 - (d.rate / 100) * 100;
                          return (
                            <g key={idx}>
                              <circle 
                                cx={x} 
                                cy={y} 
                                r="4" 
                                fill="var(--bg-base)" 
                                stroke="var(--color-warning)" 
                                strokeWidth="2" 
                              />
                              <text 
                                x={x} 
                                y="140" 
                                fill="var(--text-muted)" 
                                fontSize="8" 
                                textAnchor="middle"
                                fontWeight="600"
                              >
                                {d.label}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </g>
                  );
                })()}
              </svg>
            )}
          </div>
        </div>

        {/* Chart 3: Task Completion Doughnut */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckSquare size={16} style={{ color: 'var(--color-success)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Task Completion Rate</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', height: '180px' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ transform: 'rotate(-90deg)', width: '120px', height: '120px' }}>
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="var(--color-success)"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={circ}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset var(--transition-normal)' }}
                />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{taskCompletionRate}%</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>completed</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-success)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Completed: <strong>{completedTasks}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pending: <strong>{pendingTasks}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Tasks: {totalTasks}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 4: Peak Focus Hours */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} style={{ color: 'var(--color-secondary)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Peak Focus Distribution</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '180px', justifyContent: 'center' }}>
            {totalPeriodSessions === 0 ? (
              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No sessions completed yet
              </div>
            ) : (
              timePeriods.map((period, idx) => {
                const ratio = totalPeriodSessions > 0 ? (period.count / totalPeriodSessions) * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{period.name}</span>
                      <span style={{ fontWeight: 600 }}>{period.count} session{period.count !== 1 ? 's' : ''} ({Math.round(ratio)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ width: `${ratio}%`, height: '100%', background: period.color, borderRadius: 'var(--radius-full)', transition: 'width var(--transition-normal)' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
