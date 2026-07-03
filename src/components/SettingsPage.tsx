import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { 
  Sun, 
  Moon, 
  Sparkles, 
  Layers, 
  Square, 
  Terminal, 
  RefreshCw, 
  User as UserIcon, 
  LogOut, 
  Sliders, 
  Timer, 
  CheckCircle2, 
  AlertCircle,
  Volume2
} from 'lucide-react';

interface SettingsPageProps {
  user: User;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  styleMode: 'glassmorphism' | 'neumorphism' | 'minimalist' | 'retro';
  setStyleMode: (styleMode: 'glassmorphism' | 'neumorphism' | 'minimalist' | 'retro') => void;
  isSyncing: boolean;
  lastSynced: Date | null;
  syncError: string | null;
  onSyncTrigger: () => void;
  onSignOut: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  theme,
  setTheme,
  styleMode,
  setStyleMode,
  isSyncing,
  lastSynced,
  syncError,
  onSyncTrigger,
  onSignOut
}) => {
  // Pomodoro Durations (in minutes)
  const [workMin, setWorkMin] = useState(() => Number(localStorage.getItem('zenith-pomo-work') || '25'));
  const [shortMin, setShortMin] = useState(() => Number(localStorage.getItem('zenith-pomo-short') || '5'));
  const [longMin, setLongMin] = useState(() => Number(localStorage.getItem('zenith-pomo-long') || '15'));
  
  // Audio Feedback Setting
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('zenith-sound-enabled') !== 'false';
  });

  const savePomoDurations = (type: 'work' | 'short' | 'long', val: number) => {
    if (val < 1) return;
    if (type === 'work') {
      setWorkMin(val);
      localStorage.setItem('zenith-pomo-work', String(val));
    } else if (type === 'short') {
      setShortMin(val);
      localStorage.setItem('zenith-pomo-short', String(val));
    } else if (type === 'long') {
      setLongMin(val);
      localStorage.setItem('zenith-pomo-long', String(val));
    }
  };

  const handleSoundToggle = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('zenith-sound-enabled', String(nextVal));
  };

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString();
  };

  return (
    <div className="glass-panel" style={{ height: '100%', overflowY: 'auto', padding: '2rem' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', padding: '0.625rem', borderRadius: '0.75rem', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <Sliders size={22} className="text-gradient" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Configure your environment and preferences.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
        
        {/* =========================================================================
           APPEARANCE SECTION
           ========================================================================= */}
        <section className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sun size={18} style={{ color: 'var(--color-warning)' }} />
              Appearance & Styles
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Customize themes and visual layouts for Zenith.</p>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

          {/* Theme Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Theme Mode</span>
            <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.25)', padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', gap: '0.35rem', width: '280px' }}>
              <button
                onClick={() => setTheme('light')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: theme === 'light' ? 'var(--color-primary-glow)' : 'transparent',
                  border: theme === 'light' ? '1px solid var(--border-active)' : '1px solid transparent',
                  color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  fontWeight: 500
                }}
              >
                <Sun size={14} />
                <span>Light Mode</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: theme === 'dark' ? 'var(--color-primary-glow)' : 'transparent',
                  border: theme === 'dark' ? '1px solid var(--border-active)' : '1px solid transparent',
                  color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  fontWeight: 500
                }}
              >
                <Moon size={14} />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Style Selector Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Visual Style (Glassmorphism, Neumorphism, etc.)</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {[
                { id: 'glassmorphism', label: 'Glassmorphism', icon: Sparkles, desc: 'Frosted layouts & glowing gradients' },
                { id: 'neumorphism', label: 'Neumorphism', icon: Layers, desc: 'Soft extruded elements & inset shadows' },
                { id: 'minimalist', label: 'Sleek Minimal', icon: Square, desc: 'Clean Swiss layouts & stark lines' },
                { id: 'retro', label: 'Retro Terminal', icon: Terminal, desc: 'Monochrome grids & terminal aesthetics' }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = styleMode === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setStyleMode(item.id as any)}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'var(--color-primary-glow)' : 'rgba(0, 0, 0, 0.15)',
                      border: isActive ? '1px solid var(--border-active)' : '1px solid var(--border-color)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '0.5rem',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <Icon size={20} style={{ color: isActive ? 'var(--color-primary)' : 'inherit' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.label}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* =========================================================================
           POMODORO CONFIGURATION
           ========================================================================= */}
        <section className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Timer size={18} style={{ color: 'var(--color-primary)' }} />
              Pomodoro Timers
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Configure session length in minutes for work and breaks.</p>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

          {/* Form items */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Work Session</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input 
                  type="range" 
                  min="5" 
                  max="120" 
                  step="5"
                  value={workMin} 
                  onChange={(e) => savePomoDurations('work', Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '45px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>{workMin}m</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Short Break</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input 
                  type="range" 
                  min="1" 
                  max="30" 
                  step="1"
                  value={shortMin} 
                  onChange={(e) => savePomoDurations('short', Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '45px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>{shortMin}m</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Long Break</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input 
                  type="range" 
                  min="5" 
                  max="60" 
                  step="5"
                  value={longMin} 
                  onChange={(e) => savePomoDurations('long', Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '45px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>{longMin}m</span>
              </div>
            </div>

          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

          {/* Sound option */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Volume2 size={16} style={{ color: 'var(--text-secondary)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Timer Complete Sound</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Play chime notifications when a focus block completes.</span>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={soundEnabled} 
              onChange={handleSoundToggle}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>
        </section>

        {/* =========================================================================
           ACCOUNT & PROFILE SECTION
           ========================================================================= */}
        <section className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserIcon size={18} style={{ color: 'var(--color-secondary)' }} />
              User Profile
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Currently authenticated Google user profile details.</p>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}
              />
            ) : (
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-color)' }}>
                <UserIcon size={28} />
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {user.displayName || 'Developer'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {user.email}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                User ID: {user.uid}
              </span>
            </div>

            <button 
              onClick={onSignOut}
              className="btn-secondary" 
              style={{ padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </section>

        {/* =========================================================================
           GOOGLE API SYNC PREFERENCES
           ========================================================================= */}
        <section className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={18} style={{ color: 'var(--color-success)' }} />
              Google Calendar & Tasks Sync
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Configure synchronization between local database and Google.</p>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--border-color)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Status card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.1)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Synchronization Status</span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: syncError ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                  {syncError ? (
                    <>
                      <AlertCircle size={14} />
                      <span style={{ fontSize: '0.85rem' }}>Error: {syncError}</span>
                    </>
                  ) : isSyncing ? (
                    <>
                      <RefreshCw size={14} className="spin-slow" style={{ color: 'var(--color-secondary)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-secondary)' }}>Syncing with Google Servers...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                      <span style={{ fontSize: '0.85rem' }}>Connected and fully synchronized</span>
                    </>
                  )}
                </div>
              </div>

              <button 
                onClick={onSyncTrigger}
                disabled={isSyncing}
                className="btn-primary" 
                style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <RefreshCw size={14} className={isSyncing ? 'spin-slow' : ''} />
                <span>Sync Now</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <strong>Last successful sync:</strong> {formatTime(lastSynced)}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                * Zenith syncs in the background automatically every 5 minutes while open.
              </span>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};
