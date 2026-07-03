import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface SyncStatusProps {
  isSyncing: boolean;
  lastSynced: Date | null;
  error: string | null;
  onSyncTrigger: () => void;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ 
  isSyncing, 
  lastSynced, 
  error, 
  onSyncTrigger 
}) => {
  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: error ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
          {error ? (
            <>
              <AlertCircle size={14} />
              <span>Sync Error</span>
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw size={14} className="spin-slow" style={{ color: 'var(--color-secondary)' }} />
              <span style={{ color: 'var(--color-secondary)' }}>Syncing...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
              <span>Synced</span>
            </>
          )}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Last sync: {formatTime(lastSynced)}
        </span>
      </div>

      <button 
        onClick={onSyncTrigger} 
        disabled={isSyncing}
        className="btn-secondary"
        style={{ padding: '0.4rem', borderRadius: 'var(--radius-sm)', cursor: isSyncing ? 'not-allowed' : 'pointer' }}
        title="Sync now"
      >
        <RefreshCw size={14} className={isSyncing ? 'spin-slow' : ''} />
      </button>
    </div>
  );
};
