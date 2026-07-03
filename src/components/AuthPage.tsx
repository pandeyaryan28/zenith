import React, { useState } from 'react';
import { signInWithGoogle } from '../firebase';
import { Calendar, CheckSquare, Sparkles } from 'lucide-react';

interface AuthPageProps {
  onSignInSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSignInSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onSignInSuccess();
    } catch (err: any) {
      console.error(err);
      setError("Failed to sign in with Google. Make sure you grant the required permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Background Ambient Glows */}
      <div className="ambient-glow glow-top-left" />
      <div className="ambient-glow glow-bottom-right" />

      {/* Main Container */}
      <div className="glass-panel animate-slide-in" style={{ padding: '3.5rem 2.5rem', maxWidth: '440px', width: '90%', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        
        {/* Brand Icon */}
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '1.25rem', background: 'var(--color-primary-glow)', marginBottom: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <Sparkles size={32} className="text-gradient" />
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>
          Welcome to <span className="text-gradient">Zenith</span>
        </h1>
        
        {/* Tagline */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.5 }}>
          Elevate your productivity. Synchronize your tasks and events seamlessly with Google.
        </p>

        {/* Key Features List */}
        <div style={{ textAlign: 'left', marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--color-secondary)' }}>
              <Calendar size={18} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Google Calendar Sync</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Keep your events, meetings, and schedules perfectly in sync.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--color-primary)' }}>
              <CheckSquare size={18} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Google Tasks Sync</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manage, checklist, and sync tasks bidirectionally with Google.</p>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Login Button */}
        <button 
          onClick={handleLogin} 
          disabled={loading}
          className="btn-primary" 
          style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', borderRadius: 'var(--radius-sm)' }}
        >
          {loading ? (
            <div style={{ border: '2px solid rgba(255, 255, 255, 0.3)', borderTop: '2px solid white', borderRadius: '50%', width: '20px', height: '20px', animation: 'spin-slow 1s infinite linear' }} />
          ) : (
            <>
              {/* Inline SVG Google Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.25rem' }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-6.19-4.53z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Sign In with Google
            </>
          )}
        </button>

        <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          By signing in, you grant Zenith access to manage your Google Calendar and Tasks. Your data is stored securely in your private database.
        </p>
      </div>
    </div>
  );
};
