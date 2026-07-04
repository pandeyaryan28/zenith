import React, { useState, useMemo } from 'react';
import type { LocalNote } from '../services/noteService';
import { parseTasksFromNote } from '../services/noteService';
import { 
  Search, 
  Plus, 
  Trash2, 
  FileText, 
  Eye, 
  Edit3, 
  Tag, 
  CheckSquare, 
  Folder, 
  Calendar,
  Clock,
  Sliders
} from 'lucide-react';

interface NotesBoardProps {
  notes: LocalNote[];
  onAddNote: (noteId: string, title: string, content: string) => Promise<string>;
  onUpdateNote: (noteId: string, title: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export const NotesBoard: React.FC<NotesBoardProps> = ({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote
}) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Get active note
  const activeNote = useMemo(() => {
    return notes.find(n => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // Set default active note if none selected
  React.useEffect(() => {
    if (notes.length > 0 && !activeNoteId) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId]);

  // Editor temporary states (to prevent typing latency with DB sync)
  const [tempTitle, setTempTitle] = useState('');
  const [tempContent, setTempContent] = useState('');

  React.useEffect(() => {
    if (activeNote) {
      setTempTitle(activeNote.title);
      setTempContent(activeNote.content);
    } else {
      setTempTitle('');
      setTempContent('');
    }
  }, [activeNoteId, activeNote]);

  // Auto-save logic (debounced)
  React.useEffect(() => {
    if (!activeNoteId || !activeNote) return;
    if (tempTitle === activeNote.title && tempContent === activeNote.content) return;

    const timer = setTimeout(() => {
      onUpdateNote(activeNoteId, tempTitle, tempContent);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [tempTitle, tempContent, activeNoteId, onUpdateNote, activeNote]);

  // Extract tags from all notes
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach(note => {
      note.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet);
  }, [notes]);

  // Filter notes based on search and tag selection
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        note.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTag = selectedTag ? note.tags?.includes(selectedTag) : true;
      
      return matchesSearch && matchesTag;
    });
  }, [notes, searchTerm, selectedTag]);

  // Create new note handler
  const handleCreateNote = async () => {
    const title = 'Untitled Note';
    const content = '# Untitled Note\n\nWrite your thoughts here...\n\n- [ ] Example task @due(' + new Date().toISOString().split('T')[0] + ')';
    
    // Path-encoded note ID based on title and timestamp
    const noteId = encodeURIComponent(`Notes/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
    
    const newId = await onAddNote(noteId, title, content);
    setActiveNoteId(newId);
  };

  // Delete note handler
  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note? This will delete the local file and all synced tasks.')) {
      await onDeleteNote(id);
      if (activeNoteId === id) {
        const remaining = notes.filter(n => n.id !== id);
        setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  // Extracted tasks of the active note
  const extractedTasks = useMemo(() => {
    if (!tempContent) return [];
    return parseTasksFromNote(tempContent);
  }, [tempContent]);

  // Helper to decode note path for display (e.g. folder structure)
  const getNoteFolder = (id: string) => {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join(' / ');
    }
    return 'Vault Root';
  };

  // Render markdown inline helper
  const renderMarkdown = (md: string) => {
    if (!md) return <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Empty note.</p>;
    const lines = md.split('\n');

    return (
      <div className="markdown-preview" style={{ color: 'var(--text-primary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
        {lines.map((line, idx) => {
          // Headers
          if (line.startsWith('# ')) {
            return <h1 key={idx} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem', marginTop: '1.5rem', marginBottom: '1rem', fontWeight: 800 }}>{line.replace('# ', '')}</h1>;
          }
          if (line.startsWith('## ')) {
            return <h2 key={idx} style={{ marginTop: '1.25rem', marginBottom: '0.75rem', fontWeight: 700 }}>{line.replace('## ', '')}</h2>;
          }
          if (line.startsWith('### ')) {
            return <h3 key={idx} style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600 }}>{line.replace('### ', '')}</h3>;
          }

          // Checkboxes (Tasks)
          if (line.trim().startsWith('- [ ]')) {
            const text = line.replace(/^\s*-\s*\[\s*\]/, '').trim();
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0' }}>
                <input type="checkbox" checked={false} readOnly style={{ cursor: 'not-allowed' }} />
                <span>{text}</span>
              </div>
            );
          }
          if (line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]')) {
            const text = line.replace(/^\s*-\s*\[[xX]\]/, '').trim();
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0', opacity: 0.6 }}>
                <input type="checkbox" checked={true} readOnly style={{ cursor: 'not-allowed' }} />
                <span style={{ textDecoration: 'line-through' }}>{text}</span>
              </div>
            );
          }

          // Bullet points
          if (line.trim().startsWith('- ')) {
            return <li key={idx} style={{ marginLeft: '1rem', margin: '0.2rem 0' }}>{line.replace(/^\s*-\s*/, '')}</li>;
          }

          // Empty lines
          if (!line.trim()) {
            return <div key={idx} style={{ height: '0.75rem' }} />;
          }

          // Normal paragraphs
          return <p key={idx} style={{ margin: '0.5rem 0' }}>{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.25rem', height: '100%', overflow: 'hidden' }}>
      
      {/* =========================================================================
         SIDEBAR: Notes list & filter tags
         ========================================================================= */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden', padding: '1rem' }}>
        
        {/* Search & Add Note */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.6rem', flex: 1, minWidth: 0 }}>
            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: '0.4rem' }} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.8rem', width: '100%' }}
            />
          </div>
          <button 
            onClick={handleCreateNote}
            className="btn-primary" 
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            title="Create New Note"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>FILTER BY TAG</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              <button
                onClick={() => setSelectedTag(null)}
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  border: '1px solid ' + (selectedTag === null ? 'var(--border-active)' : 'var(--border-color)'),
                  background: selectedTag === null ? 'var(--color-primary-glow)' : 'rgba(0,0,0,0.1)',
                  color: selectedTag === null ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                    border: '1px solid ' + (selectedTag === tag ? 'var(--border-active)' : 'var(--border-color)'),
                    background: selectedTag === tag ? 'var(--color-primary-glow)' : 'rgba(0,0,0,0.1)',
                    color: selectedTag === tag ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.15rem'
                  }}
                >
                  <Tag size={10} />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>MY NOTES</div>
          {filteredNotes.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>
              No notes found.
            </div>
          ) : (
            filteredNotes.map(note => {
              const isActive = note.id === activeNoteId;
              const dateObj = new Date(note.updatedAt);
              const snippet = note.content.replace(/[#*`[\]\-]/g, '').slice(0, 60) + '...';
              
              return (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isActive ? 'var(--color-primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (isActive ? 'var(--border-active)' : 'var(--border-color)'),
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    position: 'relative'
                  }}
                  className="hover-scale"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '80%' }}>
                      {note.title}
                    </span>
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 0 }}
                      className="hover-scale"
                      title="Delete note"
                    >
                      <Trash2 size={12} style={{ color: 'var(--color-danger)' }} />
                    </button>
                  </div>
                  
                  {/* Folder display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    <Folder size={10} />
                    <span>{getNoteFolder(note.id)}</span>
                  </div>

                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, lineBreak: 'anywhere' }}>
                    {snippet}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                      <Clock size={10} />
                      {dateObj.toLocaleDateString()}
                    </span>
                    {note.tags && note.tags.length > 0 && (
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        #{note.tags[0]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* =========================================================================
         MAIN EDITOR: Title, content edit, markdown rendering, sync features
         ========================================================================= */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '1rem' }}>
        {activeNote ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
            
            {/* Header: Title edit & mode selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
              
              {/* Edit Title */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                    borderBottom: '1px solid transparent',
                    transition: 'all var(--transition-fast)'
                  }}
                  onFocus={(e) => e.target.style.borderBottom = '1px solid var(--border-active)'}
                  onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                  placeholder="Note Title"
                />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                  <FileText size={10} />
                  ID: {decodeURIComponent(activeNote.id)}
                </span>
              </div>

              {/* Layout Select Mode */}
              <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.2)', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => setEditorMode('edit')}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    background: editorMode === 'edit' ? 'var(--color-primary-glow)' : 'transparent',
                    border: 'none',
                    color: editorMode === 'edit' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title="Editor Only"
                >
                  <Edit3 size={12} />
                  <span className="hide-mobile">Edit</span>
                </button>
                <button
                  onClick={() => setEditorMode('preview')}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    background: editorMode === 'preview' ? 'var(--color-primary-glow)' : 'transparent',
                    border: 'none',
                    color: editorMode === 'preview' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title="Preview Only"
                >
                  <Eye size={12} />
                  <span className="hide-mobile">Preview</span>
                </button>
                <button
                  onClick={() => setEditorMode('split')}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    background: editorMode === 'split' ? 'var(--color-primary-glow)' : 'transparent',
                    border: 'none',
                    color: editorMode === 'split' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title="Split Screen Layout"
                >
                  <Sliders size={12} />
                  <span className="hide-mobile">Split</span>
                </button>
              </div>

            </div>

            {/* Split Panel: Workspace & Features */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr ' + (extractedTasks.length > 0 ? '220px' : '0px'), gap: '1rem', flex: 1, minHeight: 0 }}>
              
              {/* Workspace Content */}
              <div style={{ display: 'flex', height: '100%', minHeight: 0, gap: '1rem' }}>
                {(editorMode === 'edit' || editorMode === 'split') && (
                  <textarea
                    value={tempContent}
                    onChange={(e) => setTempContent(e.target.value)}
                    style={{
                      flex: 1,
                      height: '100%',
                      background: 'rgba(0,0,0,0.15)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      outline: 'none',
                      resize: 'none',
                      tabSize: 4
                    }}
                    placeholder="Write markdown here..."
                  />
                )}
                {(editorMode === 'preview' || editorMode === 'split') && (
                  <div
                    style={{
                      flex: 1,
                      height: '100%',
                      overflowY: 'auto',
                      padding: '1rem',
                      background: 'rgba(0,0,0,0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {renderMarkdown(tempContent)}
                  </div>
                )}
              </div>

              {/* Side Drawer: Synced task preview */}
              {extractedTasks.length > 0 && (
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem', height: '100%', overflowY: 'auto', borderLeft: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckSquare size={12} style={{ color: 'var(--color-primary)' }} />
                    SYNCED TASKS ({extractedTasks.length})
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {extractedTasks.map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
                          <input type="checkbox" checked={t.completed} readOnly style={{ marginTop: '0.15rem' }} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500, textDecoration: t.completed ? 'line-through' : 'none', wordBreak: 'break-word', opacity: t.completed ? 0.6 : 1 }}>
                            {t.text}
                          </span>
                        </div>
                        {t.dueDate && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--color-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.15rem', marginLeft: '1rem' }}>
                            <Calendar size={8} />
                            {t.dueDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                    * Checked off tasks in Obsidian or Zenith will update bidirectionally.
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '0.75rem' }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select a note from the sidebar or create a new one to begin.</span>
          </div>
        )}
      </div>

    </div>
  );
};
