import React, { useState, useMemo, useEffect } from 'react';
import type { LocalNote } from '../services/noteService';
import { parseTasksFromNote } from '../services/noteService';
import { 
  Search, 
  Plus, 
  Trash2, 
  Eye, 
  Edit3, 
  Tag, 
  CheckSquare, 
  Folder, 
  Calendar,
  Clock,
  Sliders,
  Sparkles,
  Loader
} from 'lucide-react';

interface NotesBoardProps {
  notes: LocalNote[];
  onAddNote: (noteId: string, title: string, content: string) => Promise<string>;
  onUpdateNote: (noteId: string, title: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

// =========================================================================
// PREMIUM MARKDOWN RENDERER COMPONENT
// =========================================================================
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Empty note.</p>;
  
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeLang = '';

  const parseInlineMarkdown = (text: string) => {
    let parts: (string | React.ReactNode)[] = [text];
    
    // Bold: **text**
    const boldRegex = /\*\*(.*?)\*\*/g;
    // Italic: *text*
    const italicRegex = /\*(.*?)\*/g;
    // Inline code: `code`
    const codeRegex = /`(.*?)`/g;
    // Highlight: ==text==
    const highlightRegex = /==(.*?)==/g;

    const applyFormatting = (regex: RegExp, formatter: (match: string) => React.ReactNode) => {
      const newParts: (string | React.ReactNode)[] = [];
      parts.forEach(part => {
        if (typeof part !== 'string') {
          newParts.push(part);
          return;
        }

        let lastIndex = 0;
        let match;
        regex.lastIndex = 0;
        
        while ((match = regex.exec(part)) !== null) {
          const matchIndex = match.index;
          if (matchIndex > lastIndex) {
            newParts.push(part.substring(lastIndex, matchIndex));
          }
          newParts.push(formatter(match[1]));
          lastIndex = regex.lastIndex;
        }

        if (lastIndex < part.length) {
          newParts.push(part.substring(lastIndex));
        }
      });
      parts = newParts;
    };

    applyFormatting(boldRegex, (m) => <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m}</strong>);
    applyFormatting(italicRegex, (m) => <em style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{m}</em>);
    applyFormatting(highlightRegex, (m) => <mark style={{ background: 'var(--color-primary-glow)', color: 'var(--text-primary)', borderBottom: '2px solid var(--color-primary)', padding: '0.1rem 0.2rem', borderRadius: '2px' }}>{m}</mark>);
    applyFormatting(codeRegex, (m) => <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85em', color: 'var(--color-secondary)' }}>{m}</code>);

    return <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code Blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        renderedElements.push(
          <div key={`code-${i}`} style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', margin: '1rem 0', overflowX: 'auto', fontFamily: 'monospace', position: 'relative' }}>
            <span style={{ position: 'absolute', top: '0.5rem', right: '0.75rem', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{codeLang || 'code'}</span>
            <pre style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          </div>
        );
        codeBlockLines = [];
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = line.trim().substring(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      renderedElements.push(
        <h1 key={i} style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '1.75rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
          <span style={{ width: '4px', height: '1.5rem', background: 'var(--grad-primary)', borderRadius: '2px', display: 'inline-block' }} />
          {parseInlineMarkdown(line.replace('# ', ''))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      renderedElements.push(
        <h2 key={i} style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          {parseInlineMarkdown(line.replace('## ', ''))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      renderedElements.push(
        <h3 key={i} style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          {parseInlineMarkdown(line.replace('### ', ''))}
        </h3>
      );
      continue;
    }

    // Blockquotes
    if (line.trim().startsWith('>')) {
      renderedElements.push(
        <blockquote key={i} style={{ borderLeft: '4px solid var(--color-primary)', background: 'var(--color-primary-glow)', padding: '0.75rem 1.25rem', margin: '1rem 0', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          {parseInlineMarkdown(line.substring(line.indexOf('>') + 1).trim())}
        </blockquote>
      );
      continue;
    }

    // Checkboxes (Tasks)
    if (line.trim().startsWith('- [ ]')) {
      const text = line.replace(/^\s*-\s*\[\s*\]/, '').trim();
      const dueMatch = text.match(/@due\((\d{4}-\d{2}-\d{2})\)/);
      const cleanText = text.replace(/@due\(\d{4}-\d{2}-\d{2}\)/, '').trim();
      renderedElements.push(
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', margin: '0.45rem 0', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
          <input type="checkbox" checked={false} readOnly style={{ cursor: 'not-allowed', width: '15px', height: '15px', accentColor: 'var(--color-primary)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{parseInlineMarkdown(cleanText)}</span>
          {dueMatch && (
            <span style={{ fontSize: '0.65rem', color: 'var(--color-secondary)', background: 'var(--color-secondary-glow)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '0.15rem', marginLeft: 'auto' }}>
              <Calendar size={10} />
              {dueMatch[1]}
            </span>
          )}
        </div>
      );
      continue;
    }
    if (line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]')) {
      const text = line.replace(/^\s*-\s*\[[xX]\]/, '').trim();
      const dueMatch = text.match(/@due\((\d{4}-\d{2}-\d{2})\)/);
      const cleanText = text.replace(/@due\(\d{4}-\d{2}-\d{2}\)/, '').trim();
      renderedElements.push(
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', margin: '0.45rem 0', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid transparent', borderRadius: '6px', opacity: 0.5 }}>
          <input type="checkbox" checked={true} readOnly style={{ cursor: 'not-allowed', width: '15px', height: '15px', accentColor: 'var(--color-primary)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{parseInlineMarkdown(cleanText)}</span>
          {dueMatch && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '0.15rem', marginLeft: 'auto' }}>
              <Calendar size={10} />
              {dueMatch[1]}
            </span>
          )}
        </div>
      );
      continue;
    }

    // Bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      renderedElements.push(
        <li key={i} style={{ marginLeft: '1.25rem', margin: '0.35rem 0', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
          {parseInlineMarkdown(line.trim().substring(2))}
        </li>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      renderedElements.push(<div key={i} style={{ height: '0.5rem' }} />);
      continue;
    }

    // Normal paragraphs
    renderedElements.push(
      <p key={i} style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
        {parseInlineMarkdown(line)}
      </p>
    );
  }

  return <>{renderedElements}</>;
};

// =========================================================================
// MAIN BOARD COMPONENT
// =========================================================================
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
  const [isSaving, setIsSaving] = useState(false);

  // Get active note
  const activeNote = useMemo(() => {
    return notes.find(n => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // Set default active note if none selected
  useEffect(() => {
    if (notes.length > 0 && !activeNoteId) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId]);

  // Editor temporary states (to prevent typing latency with DB sync)
  const [tempTitle, setTempTitle] = useState('');
  const [tempContent, setTempContent] = useState('');

  useEffect(() => {
    if (activeNote) {
      setTempTitle(activeNote.title);
      setTempContent(activeNote.content);
    } else {
      setTempTitle('');
      setTempContent('');
    }
  }, [activeNoteId, activeNote]);

  // Auto-save logic (debounced)
  useEffect(() => {
    if (!activeNoteId || !activeNote) return;
    if (tempTitle === activeNote.title && tempContent === activeNote.content) return;

    setIsSaving(true);
    const timer = setTimeout(async () => {
      await onUpdateNote(activeNoteId, tempTitle, tempContent);
      setIsSaving(false);
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
    const content = '# Untitled Note\n\nWrite your thoughts here...\n\n- [ ] Make a difference today @due(' + new Date().toISOString().split('T')[0] + ')';
    const noteId = encodeURIComponent(`Notes/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
    
    setIsSaving(true);
    const newId = await onAddNote(noteId, title, content);
    setActiveNoteId(newId);
    setIsSaving(false);
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

  // Task Completion calculation
  const taskProgress = useMemo(() => {
    if (extractedTasks.length === 0) return { total: 0, completed: 0, percent: 0 };
    const completed = extractedTasks.filter(t => t.completed).length;
    const total = extractedTasks.length;
    return {
      total,
      completed,
      percent: Math.round((completed / total) * 100)
    };
  }, [extractedTasks]);

  // Helper to decode note path for display (e.g. folder structure)
  const getNoteFolder = (id: string) => {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join(' / ');
    }
    return 'Vault Root';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', height: '100%', overflow: 'hidden' }}>
      
      {/* =========================================================================
         SIDEBAR: Notes list & filter tags
         ========================================================================= */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', overflow: 'hidden', padding: '1.25rem', background: 'rgba(10, 13, 22, 0.45)' }}>
        
        {/* Search & Add Note */}
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', flex: 1, minWidth: 0 }}>
            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.8rem', width: '100%', padding: 0 }}
            />
          </div>
          <button 
            onClick={handleCreateNote}
            className="btn-primary" 
            style={{ padding: '0.55rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '34px', height: '34px' }}
            title="Create New Note"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>FILTER BY TAG</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              <button
                onClick={() => setSelectedTag(null)}
                style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.7rem',
                  border: '1px solid ' + (selectedTag === null ? 'var(--border-active)' : 'var(--border-color)'),
                  background: selectedTag === null ? 'var(--color-primary-glow)' : 'rgba(0,0,0,0.15)',
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
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem',
                    border: '1px solid ' + (selectedTag === tag ? 'var(--border-active)' : 'var(--border-color)'),
                    background: selectedTag === tag ? 'var(--color-primary-glow)' : 'rgba(0,0,0,0.15)',
                    color: selectedTag === tag ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem'
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', overflowY: 'auto', flex: 1, paddingRight: '0.2rem' }} className="custom-scroll">
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>MY NOTES</div>
          {filteredNotes.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '1.5rem' }}>
              No notes found.
            </div>
          ) : (
            filteredNotes.map(note => {
              const isActive = note.id === activeNoteId;
              const dateObj = new Date(note.updatedAt);
              const snippet = note.content
                .replace(/[#*`[\]\-]/g, '')
                .replace(/@due\(\d{4}-\d{2}-\d{2}\)/g, '')
                .trim()
                .slice(0, 65) + (note.content.length > 65 ? '...' : '');
              
              return (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? 'var(--bg-surface-hover)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (isActive ? 'var(--border-active)' : 'var(--border-color)'),
                    cursor: 'pointer',
                    transition: 'all var(--transition-normal)',
                    position: 'relative',
                    boxShadow: isActive ? 'var(--shadow-md)' : 'none'
                  }}
                  className="hover-scale"
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      left: '0',
                      top: '25%',
                      bottom: '25%',
                      width: '3px',
                      background: 'var(--grad-primary)',
                      borderRadius: '0 4px 4px 0'
                    }} />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {note.title || 'Untitled Note'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: isActive ? 0.8 : 0.4, padding: '0.1rem', transition: 'all var(--transition-fast)' }}
                      className="hover-scale"
                      title="Delete note"
                    >
                      <Trash2 size={12} style={{ color: 'var(--color-danger)' }} />
                    </button>
                  </div>
                  
                  {/* Folder display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    <Folder size={10} style={{ color: 'var(--color-secondary)' }} />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{getNoteFolder(note.id)}</span>
                  </div>

                  <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4', lineBreak: 'anywhere' }}>
                    {snippet || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Empty note</span>}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Clock size={10} />
                      {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    {note.tags && note.tags.length > 0 && (
                      <span style={{ background: 'var(--color-primary-glow)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.6rem' }}>
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
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '1.25rem', background: 'rgba(10, 13, 22, 0.25)' }}>
        {activeNote ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.25rem' }}>
            
            {/* Header: Title edit & mode selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
              
              {/* Edit Title */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      width: '100%',
                      padding: '0.1rem 0',
                      fontFamily: 'var(--font-display)',
                      borderBottom: '1px solid transparent',
                      transition: 'all var(--transition-fast)'
                    }}
                    onFocus={(e) => e.target.style.borderBottom = '1px solid var(--border-active)'}
                    onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                    placeholder="Note Title"
                  />
                  {isSaving && (
                    <Loader size={14} className="spin-slow" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <Folder size={10} style={{ color: 'var(--color-secondary)' }} />
                  <span>{getNoteFolder(activeNote.id)} / {decodeURIComponent(activeNote.id).split('/').pop()}</span>
                </span>
              </div>

              {/* Layout Select Mode (Sliding pill design) */}
              <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.35)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                {(['edit', 'preview', 'split'] as const).map(mode => {
                  const isActive = editorMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setEditorMode(mode)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        background: isActive ? 'var(--color-primary-glow)' : 'transparent',
                        border: isActive ? '1px solid var(--border-active)' : '1px solid transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      {mode === 'edit' && <Edit3 size={12} />}
                      {mode === 'preview' && <Eye size={12} />}
                      {mode === 'split' && <Sliders size={12} />}
                      <span className="hide-mobile" style={{ textTransform: 'capitalize' }}>{mode}</span>
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Split Panel: Workspace & Features */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr ' + (extractedTasks.length > 0 ? '240px' : '0px'), gap: '1.25rem', flex: 1, minHeight: 0 }}>
              
              {/* Workspace Content */}
              <div style={{ display: 'flex', height: '100%', minHeight: 0, gap: '1.25rem' }}>
                {(editorMode === 'edit' || editorMode === 'split') && (
                  <textarea
                    value={tempContent}
                    onChange={(e) => setTempContent(e.target.value)}
                    style={{
                      flex: 1,
                      height: '100%',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      color: 'var(--text-primary)',
                      fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
                      fontSize: '0.85rem',
                      lineHeight: '1.6',
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
                      padding: '1.25rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                    }}
                    className="custom-scroll"
                  >
                    <MarkdownRenderer content={tempContent} />
                  </div>
                )}
              </div>

              {/* Side Drawer: Synced task preview with Progress bar */}
              {extractedTasks.length > 0 && (
                <div 
                  className="glass-card custom-scroll" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem', 
                    padding: '1rem', 
                    height: '100%', 
                    overflowY: 'auto', 
                    border: '1px solid var(--border-color)', 
                    background: 'rgba(10, 13, 22, 0.4)' 
                  }}
                >
                  {/* Task Progress Tracker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>NOTE PROGRESS</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>{taskProgress.percent}%</span>
                    </div>
                    {/* Bar */}
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${taskProgress.percent}%`, height: '100%', background: 'var(--grad-primary)', borderRadius: '3px', transition: 'width var(--transition-normal)' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                      {taskProgress.completed} of {taskProgress.total} tasks completed
                    </span>
                  </div>

                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                    <CheckSquare size={12} style={{ color: 'var(--color-primary)' }} />
                    SYNCED TASKS ({extractedTasks.length})
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
                    {extractedTasks.map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.65rem',
                          background: t.completed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid ' + (t.completed ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-color)'),
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.3rem',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                          <input 
                            type="checkbox" 
                            checked={t.completed} 
                            readOnly 
                            style={{ 
                              marginTop: '0.15rem', 
                              width: '13px', 
                              height: '13px', 
                              accentColor: 'var(--color-success)',
                              cursor: 'not-allowed'
                            }} 
                          />
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: t.completed ? 'var(--text-secondary)' : 'var(--text-primary)', 
                            fontWeight: 500, 
                            textDecoration: t.completed ? 'line-through' : 'none', 
                            wordBreak: 'break-word', 
                            opacity: t.completed ? 0.6 : 1 
                          }}>
                            {t.text}
                          </span>
                        </div>
                        {t.dueDate && (
                          <span style={{ 
                            fontSize: '0.6rem', 
                            color: t.completed ? 'var(--text-muted)' : 'var(--color-secondary)', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.15rem', 
                            marginLeft: '1rem',
                            background: t.completed ? 'transparent' : 'var(--color-secondary-glow)',
                            padding: '0.05rem 0.3rem',
                            borderRadius: '4px',
                            width: 'fit-content'
                          }}>
                            <Calendar size={8} />
                            {t.dueDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', flexShrink: 0 }}>
                    * Checked off tasks in Obsidian or Zenith will update bidirectionally.
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '1rem' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
              <Sparkles size={32} className="spin-slow" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Zenith Notes Space</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.775rem', marginTop: '0.25rem' }}>Select an Obsidian note from the sidebar or click "+" to create a new one.</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
