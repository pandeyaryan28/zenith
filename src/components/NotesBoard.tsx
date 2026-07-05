import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { LocalNote } from '../services/noteService';
import { 
  Search, 
  Plus, 
  Trash2, 
  Sparkles,
  Loader,
  ArrowUpDown,
  X,
  Tag,
  ArrowLeft,
  Download,
  Bold,
  Italic,
  Heading,
  Code,
  List,
  Quote,
  CheckSquare,
  ChevronRight
} from 'lucide-react';

interface NotesBoardProps {
  notes: LocalNote[];
  onAddNote: (noteId: string, title: string, content: string) => Promise<string>;
  onUpdateNote: (noteId: string, title: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

// =========================================================================
// INLINE MARKDOWN PARSER
// =========================================================================
const parseInlineMarkdown = (
  text: string,
  onWikiLinkClick?: (targetTitle: string) => void,
  onTagClick?: (tag: string) => void
) => {
  if (!text) return null;
  let parts: (string | React.ReactNode)[] = [text];
  
  const boldRegex = /\*\*(.*?)\*\*/g;
  const italicRegex = /\*(.*?)\*/g;
  const codeRegex = /`(.*?)`/g;
  const highlightRegex = /==(.*?)==/g;
  const obsidianLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const tagRegex = /(^|\s)#([a-zA-Z0-9_\-/]+)/g;

  const applyFormatting = (regex: RegExp, formatter: (...args: any[]) => React.ReactNode) => {
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
        newParts.push(formatter(...match));
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < part.length) {
        newParts.push(part.substring(lastIndex));
      }
    });
    parts = newParts;
  };

  applyFormatting(boldRegex, (_, m) => <strong key={Math.random()} style={{ fontWeight: 700 }}>{m}</strong>);
  applyFormatting(italicRegex, (_, m) => <em key={Math.random()} style={{ fontStyle: 'italic' }}>{m}</em>);
  applyFormatting(highlightRegex, (_, m) => (
    <mark key={Math.random()} style={{ background: 'var(--color-primary-glow)', color: 'var(--text-primary)', borderBottom: '2px solid var(--color-primary)', padding: '0 0.15rem', borderRadius: '2px' }}>
      {m}
    </mark>
  ));
  
  applyFormatting(obsidianLinkRegex, (_, target, alias) => (
    <span 
      key={Math.random()} 
      className="wysiwyg-wiki-link"
      onClick={(e) => {
        e.stopPropagation();
        if (onWikiLinkClick) onWikiLinkClick(target);
      }}
    >
      {alias || target}
    </span>
  ));
  
  applyFormatting(linkRegex, (_, text, url) => (
    <a key={Math.random()} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
      {text}
    </a>
  ));
  
  applyFormatting(tagRegex, (_, space, tag) => (
    <React.Fragment key={Math.random()}>
      {space}
      <span 
        className="wysiwyg-tag"
        onClick={(e) => {
          e.stopPropagation();
          if (onTagClick) onTagClick(tag);
        }}
      >
        #{tag}
      </span>
    </React.Fragment>
  ));
  
  applyFormatting(codeRegex, (_, m) => (
    <code key={Math.random()} style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.15)', padding: '0.1rem 0.25rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85em', color: 'var(--color-secondary)' }}>
      {m}
    </code>
  ));

  return <>{parts}</>;
};

// =========================================================================
// INTERACTIVE LINE COMPONENT (WYSIWYG)
// =========================================================================
interface LiveEditableLineProps {
  text: string;
  index: number;
  isFocused: boolean;
  isCodeBlock: boolean;
  onFocus: () => void;
  onBlur: (val: string) => void;
  onKeyDown: (val: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onWikiLinkClick: (target: string) => void;
  onTagClick: (tag: string) => void;
  onToggleCheckbox: (checked: boolean) => void;
}

const LiveEditableLine: React.FC<LiveEditableLineProps> = ({
  text,
  index,
  isFocused,
  isCodeBlock,
  onFocus,
  onBlur,
  onKeyDown,
  onWikiLinkClick,
  onTagClick,
  onToggleCheckbox
}) => {
  const [localVal, setLocalVal] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalVal(text);
  }, [text]);

  useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
      // Position cursor at end of line
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      
      // Auto-grow
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalVal(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleBlur = () => {
    onBlur(localVal);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown(localVal, e);
  };

  // Render HTML preview of the markdown line
  const renderCompiledContent = () => {
    if (text.trim() === '') {
      return <div style={{ minHeight: '1.2rem' }} />;
    }

    if (isCodeBlock) {
      return (
        <div style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85em', color: 'var(--color-secondary)' }}>
          {text}
        </div>
      );
    }

    // 1. Heading
    const headerMatch = /^(#{1,6})\s+(.+)$/.exec(text);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      const HeadingTag = `h${level}` as React.ElementType;
      return (
        <div className="wysiwyg-preview-content">
          <HeadingTag style={{ margin: 0 }}>
            {parseInlineMarkdown(content, onWikiLinkClick, onTagClick)}
          </HeadingTag>
        </div>
      );
    }

    // 2. Checklist
    const checklistMatch = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(text);
    if (checklistMatch) {
      const indent = checklistMatch[1].length;
      const checked = checklistMatch[2] !== ' ';
      const content = checklistMatch[3];
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingLeft: `${indent * 0.75}rem` }}>
          <input 
            type="checkbox" 
            checked={checked}
            onChange={(e) => {
              e.stopPropagation();
              onToggleCheckbox(e.target.checked);
            }}
            style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--color-primary)' }}
          />
          <span style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.5 : 1 }}>
            {parseInlineMarkdown(content, onWikiLinkClick, onTagClick)}
          </span>
        </div>
      );
    }

    // 3. Unordered list
    const bulletMatch = /^(\s*)[-*+]\s+(.+)$/.exec(text);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const content = bulletMatch[2];
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', paddingLeft: `${indent * 0.75}rem` }}>
          <span style={{ color: 'var(--color-primary)', userSelect: 'none' }}>•</span>
          <span>{parseInlineMarkdown(content, onWikiLinkClick, onTagClick)}</span>
        </div>
      );
    }

    // 4. Ordered list
    const orderedMatch = /^(\s*)(\d+)\.\s+(.+)$/.exec(text);
    if (orderedMatch) {
      const indent = orderedMatch[1].length;
      const num = orderedMatch[2];
      const content = orderedMatch[3];
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', paddingLeft: `${indent * 0.75}rem` }}>
          <span style={{ color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>{num}.</span>
          <span>{parseInlineMarkdown(content, onWikiLinkClick, onTagClick)}</span>
        </div>
      );
    }

    // 5. Divider
    if (/^\s*(---\s*|\*\*\*\s*|___\s*)$/.test(text)) {
      return <div className="wysiwyg-preview-content"><hr /></div>;
    }

    // 6. Blockquote / Callout
    if (text.trim().startsWith('>')) {
      const calloutMatch = /^>\s*\[!([a-zA-Z_-]+)\]\s*(.*)$/.exec(text.trim());
      if (calloutMatch) {
        const type = calloutMatch[1].toLowerCase();
        const title = calloutMatch[2] || type.toUpperCase();
        return (
          <div style={{
            fontWeight: 700,
            fontSize: '0.85rem',
            color: `var(--co-${type}-text, var(--color-primary))`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            textTransform: 'capitalize'
          }}>
            <Sparkles size={12} />
            <span>{title}</span>
          </div>
        );
      }
      
      const quoteMatch = /^>\s*(.*)$/.exec(text);
      const content = quoteMatch ? quoteMatch[1] : text;
      return (
        <div className="wysiwyg-preview-content">
          <blockquote>
            {parseInlineMarkdown(content, onWikiLinkClick, onTagClick)}
          </blockquote>
        </div>
      );
    }

    // Default paragraph
    return <div>{parseInlineMarkdown(text, onWikiLinkClick, onTagClick)}</div>;
  };

  return (
    <div 
      className={`live-editable-line ${isFocused ? 'active-edit' : ''}`}
      onClick={(e) => {
        // Prevent focusing editor when clicking checkboxes or wiki-links
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.classList.contains('wysiwyg-wiki-link') || target.classList.contains('wysiwyg-tag')) {
          return;
        }
        onFocus();
      }}
      id={`line-${index}`}
    >
      {isFocused ? (
        <textarea
          ref={textareaRef}
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDownInternal}
          className="line-editor-textarea"
          rows={1}
        />
      ) : (
        renderCompiledContent()
      )}
    </div>
  );
};

// =========================================================================
// MAIN BENTO NOTES COMPONENT
// =========================================================================
export const NotesBoard: React.FC<NotesBoardProps> = ({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote
}) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [showTagsPopover, setShowTagsPopover] = useState(false);
  
  const [tempTitle, setTempTitle] = useState('');
  const [tempContent, setTempContent] = useState('');
  const [focusedLineIndex, setFocusedLineIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [wikiCreateTarget, setWikiCreateTarget] = useState<string | null>(null);

  const activeNote = useMemo(() => {
    return notes.find(n => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // Sync state from active note
  useEffect(() => {
    if (activeNote) {
      setTempTitle(activeNote.title);
      setTempContent(activeNote.content);
    } else {
      setTempTitle('');
      setTempContent('');
      setFocusedLineIndex(null);
    }
  }, [activeNoteId, activeNote]);

  // Debounced auto-save logic
  useEffect(() => {
    if (!activeNoteId || !activeNote) return;
    if (tempTitle === activeNote.title && tempContent === activeNote.content) return;

    setIsSaving(true);
    const timer = setTimeout(async () => {
      await onUpdateNote(activeNoteId, tempTitle, tempContent);
      setIsSaving(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [tempTitle, tempContent, activeNoteId, onUpdateNote, activeNote]);

  const lines = useMemo(() => {
    return tempContent.split('\n');
  }, [tempContent]);

  // Pre-calculate code block line ranges
  const codeBlockLineIndices = useMemo(() => {
    const indices = new Set<number>();
    let inBlock = false;
    lines.forEach((line, index) => {
      if (line.trim().startsWith('```')) {
        inBlock = !inBlock;
        indices.add(index);
      } else if (inBlock) {
        indices.add(index);
      }
    });
    return indices;
  }, [lines]);

  // Parse unchecked checklist items for a note
  const parseChecklist = (content: string) => {
    const noteLines = content.split('\n');
    const items: { text: string; checked: boolean; lineIndex: number }[] = [];
    noteLines.forEach((line, idx) => {
      const todoMatch = /^\s*-\s*\[([ xX])\]\s*(.+)$/.exec(line);
      if (todoMatch) {
        items.push({
          text: todoMatch[2].trim(),
          checked: todoMatch[1] !== ' ',
          lineIndex: idx
        });
      }
    });
    return items;
  };

  // Determine Bento sizes dynamically based on note features
  const bentoLayouts = useMemo(() => {
    const layouts: Record<string, { sizeClass: string; type: 'checklist' | 'standard' | 'double' }> = {};
    
    let mostRecentId = '';
    let maxTime = 0;
    
    notes.forEach(note => {
      const t = new Date(note.updatedAt).getTime();
      if (t > maxTime) {
        maxTime = t;
        mostRecentId = note.id;
      }
    });

    notes.forEach(note => {
      const todos = parseChecklist(note.content);
      const uncheckedTodos = todos.filter(t => !t.checked);
      
      if (note.id === mostRecentId && note.content.length > 300) {
        layouts[note.id] = { sizeClass: 'double-width', type: 'double' };
      } else if (uncheckedTodos.length >= 2) {
        layouts[note.id] = { sizeClass: 'double-height', type: 'checklist' };
      } else {
        layouts[note.id] = { sizeClass: '', type: 'standard' };
      }
    });

    return layouts;
  }, [notes]);

  // Extract unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach(note => {
      if (note.tags) {
        note.tags.forEach(t => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet).sort();
  }, [notes]);

  // Plain-text snippet
  const getSnippet = (content: string) => {
    if (!content) return '';
    return content
      .replace(/^(#{1,6})\s+/gm, '')
      .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias || target)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/(?:^|\s)#([a-zA-Z0-9_\-/]+)/g, '')
      .replace(/`{3}[\s\S]*?`{3}/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/>\s*\[![^\]]+\][^\n]*/g, '')
      .replace(/^>\s*/gm, '')
      .replace(/\n+/g, ' ')
      .trim();
  };

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const query = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' ||
        note.title.toLowerCase().includes(query) || 
        note.content.toLowerCase().includes(query);
      
      const matchesTag = !selectedTag || (note.tags && note.tags.includes(selectedTag));
      
      return matchesSearch && matchesTag;
    });
  }, [notes, searchTerm, selectedTag]);

  // Sort notes
  const sortedNotes = useMemo(() => {
    const notesCopy = [...filteredNotes];
    if (sortBy === 'title') {
      return notesCopy.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      return notesCopy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }, [filteredNotes, sortBy]);

  // Create new note
  const handleCreateNote = async () => {
    const title = 'Untitled Note';
    const content = '# Untitled Note\n\nWrite your thoughts here...\n\n- [ ] Todo item\n- [ ] Call checklist';
    const noteId = encodeURIComponent(`Notes/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
    
    setIsSaving(true);
    const newId = await onAddNote(noteId, title, content);
    setActiveNoteId(newId);
    setIsSaving(false);
  };

  const handleCreateNoteWithTitle = async (title: string) => {
    const content = `# ${title}\n\nWrite your thoughts here...\n\nReferenced from [[${activeNote?.title || 'previous note'}]].`;
    const noteId = encodeURIComponent(`Notes/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
    
    setIsSaving(true);
    const newId = await onAddNote(noteId, title, content);
    setActiveNoteId(newId);
    setIsSaving(false);
  };

  // Delete note
  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      await onDeleteNote(id);
      if (activeNoteId === id) {
        setActiveNoteId(null);
      }
    }
  };

  // In-line line editing logic
  const handleLineBlur = (index: number, val: string) => {
    const newLines = [...lines];
    newLines[index] = val;
    setTempContent(newLines.join('\n'));
    setFocusedLineIndex(null);
  };

  const handleLineKeyDown = (index: number, val: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const newLines = [...lines];
    newLines[index] = val;

    if (e.key === 'Enter') {
      e.preventDefault();
      const cursorPosition = e.currentTarget.selectionStart || 0;
      const textBefore = val.substring(0, cursorPosition);
      const textAfter = val.substring(cursorPosition);
      
      newLines[index] = textBefore;
      newLines.splice(index + 1, 0, textAfter);
      
      setTempContent(newLines.join('\n'));
      setFocusedLineIndex(index + 1);
    } else if (e.key === 'Backspace' && val === '') {
      e.preventDefault();
      if (index > 0) {
        newLines.splice(index, 1);
        setTempContent(newLines.join('\n'));
        setFocusedLineIndex(index - 1);
      }
    } else if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      e.preventDefault();
      if (index > 0) {
        const prevLineText = newLines[index - 1];
        newLines[index - 1] = prevLineText + val;
        newLines.splice(index, 1);
        setTempContent(newLines.join('\n'));
        setFocusedLineIndex(index - 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) {
        setTempContent(newLines.join('\n'));
        setFocusedLineIndex(index - 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index < lines.length - 1) {
        setTempContent(newLines.join('\n'));
        setFocusedLineIndex(index + 1);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTempContent(newLines.join('\n'));
      setFocusedLineIndex(null);
    }
  };

  // Toggle checklist checkbox inside active sheet
  const handleToggleCheckboxInLine = (index: number, checked: boolean) => {
    const line = lines[index];
    const checkRegex = /^(\s*-\s*\[)([ xX])(\]\s*.+)$/;
    const match = checkRegex.exec(line);
    if (match) {
      const newStatus = checked ? 'x' : ' ';
      const newLines = [...lines];
      newLines[index] = `${match[1]}${newStatus}${match[3]}`;
      setTempContent(newLines.join('\n'));
    }
  };

  // Toggle checklist directly on the dashboard card
  const handleToggleCardChecklist = async (noteId: string, lineIndex: number, checked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const noteLines = note.content.split('\n');
    const line = noteLines[lineIndex];
    const todoMatch = /^(\s*-\s*\[)([ xX])(\]\s*.+)$/.exec(line);
    if (todoMatch) {
      const newStatus = checked ? 'x' : ' ';
      noteLines[lineIndex] = `${todoMatch[1]}${newStatus}${todoMatch[3]}`;
      await onUpdateNote(noteId, note.title, noteLines.join('\n'));
    }
  };

  // Floating toolbar formatting helper
  const insertFormatting = (before: string, after: string = '') => {
    if (focusedLineIndex === null) return;
    const activeText = lines[focusedLineIndex];
    const newText = before + activeText + after;
    const newLines = [...lines];
    newLines[focusedLineIndex] = newText;
    setTempContent(newLines.join('\n'));
  };

  // Navigating Outline
  const outlineItems = useMemo(() => {
    const items: { text: string; level: number; index: number }[] = [];
    lines.forEach((line, index) => {
      const headerMatch = /^(#{1,6})\s+(.+)$/.exec(line);
      if (headerMatch) {
        items.push({
          text: headerMatch[2].trim(),
          level: headerMatch[1].length,
          index
        });
      }
    });
    return items;
  }, [lines]);

  const scrollToOutline = (index: number) => {
    const el = document.getElementById(`line-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedLineIndex(index);
    }
  };

  // Handle Wiki link navigation inside WYSIWYG
  const handleWikiLinkClick = (targetTitle: string) => {
    const foundNote = notes.find(n => n.title.toLowerCase().trim() === targetTitle.toLowerCase().trim());
    if (foundNote) {
      setActiveNoteId(foundNote.id);
    } else {
      setWikiCreateTarget(targetTitle);
    }
  };

  // Download markdown
  const handleDownload = () => {
    if (!activeNote) return;
    const blob = new Blob([tempContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tempTitle || 'note'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Date parsing
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getFolderStr = (id: string) => {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split('/');
    return parts.length > 1 ? parts.slice(0, -1).join(' / ') : '';
  };

  return (
    <div className="notes-container">
      {/* =========================================================================
         BENTO GRID BOARD (Main Workspace)
         ========================================================================= */}
      <div className="notes-bento-grid">
        {sortedNotes.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '1rem', padding: '4rem 0' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
              <Sparkles size={28} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>No Notes Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Add your first note via the bottom command dock.
              </p>
            </div>
          </div>
        ) : (
          sortedNotes.map(note => {
            const layout = bentoLayouts[note.id] || { sizeClass: '', type: 'standard' };
            const snippet = getSnippet(note.content);
            const folder = getFolderStr(note.id);
            const todos = parseChecklist(note.content);
            const uncheckedTodos = todos.filter(t => !t.checked).slice(0, 3);
            
            return (
              <div 
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className={`bento-card ${layout.sizeClass}`}
              >
                {/* Hover Tools Overlay */}
                <div className="bento-hover-actions">
                  <button 
                    onClick={(e) => handleDeleteNote(note.id, e)}
                    className="bento-action-btn btn-delete"
                    title="Delete Note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Card Content */}
                <div>
                  <div className="bento-card-folder">
                    {folder ? `${folder}` : 'Root'}
                  </div>
                  <div className="bento-card-title">
                    {note.title || 'Untitled Note'}
                  </div>

                  {layout.type === 'checklist' ? (
                    <div className="bento-card-todo-list">
                      {uncheckedTodos.map((todo, idx) => (
                        <div 
                          key={idx}
                          className="bento-card-todo-item"
                          onClick={(e) => handleToggleCardChecklist(note.id, todo.lineIndex, !todo.checked, e)}
                        >
                          <input 
                            type="checkbox" 
                            checked={todo.checked}
                            readOnly
                            style={{ width: '12px', height: '12px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                          />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {todo.text}
                          </span>
                        </div>
                      ))}
                      {todos.filter(t => !t.checked).length > 3 && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px', marginTop: '0.15rem' }}>
                          <ChevronRight size={10} /> + {todos.filter(t => !t.checked).length - 3} more checklist items
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="bento-card-snippet">
                      {snippet || 'Empty note.'}
                    </div>
                  )}
                </div>

                <div className="bento-card-footer">
                  <span>{formatTime(note.updatedAt)}</span>
                  {note.tags && note.tags.length > 0 && (
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>#{note.tags[0]}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =========================================================================
         CENTERED FLOATING DOCK
         ========================================================================= */}
      <div className="bento-filter-dock">
        {/* Search */}
        <div className="dock-search-box">
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <X 
              size={12} 
              style={{ color: 'var(--text-muted)', cursor: 'pointer' }} 
              onClick={() => setSearchTerm('')}
            />
          )}
        </div>

        <div className="dock-divider" />

        {/* Sorting */}
        <button 
          onClick={() => setSortBy(sortBy === 'updated' ? 'title' : 'updated')}
          className="dock-btn"
          title={sortBy === 'updated' ? 'Sorting: Recent' : 'Sorting: A-Z'}
        >
          <ArrowUpDown size={13} />
          <span style={{ display: 'none' }}>Sort</span>
        </button>

        {/* Filter Tags */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowTagsPopover(!showTagsPopover)}
            className={`dock-btn ${selectedTag ? 'active' : ''}`}
            title="Filter by Tag"
          >
            <Tag size={13} />
            <span style={{ maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedTag ? `#${selectedTag}` : 'Tags'}
            </span>
          </button>

          {showTagsPopover && (
            <>
              <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 104 }} 
                onClick={() => setShowTagsPopover(false)}
              />
              <div className="dock-tags-popover">
                <span 
                  onClick={() => {
                    setSelectedTag(null);
                    setShowTagsPopover(false);
                  }}
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.2rem 0.45rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: !selectedTag ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid ' + (!selectedTag ? 'var(--color-primary)' : 'var(--border-color)'),
                    color: !selectedTag ? 'var(--color-primary)' : 'var(--text-secondary)'
                  }}
                >
                  All Notes
                </span>
                {allTags.map(tag => {
                  const active = selectedTag === tag;
                  return (
                    <span
                      key={tag}
                      onClick={() => {
                        setSelectedTag(tag);
                        setShowTagsPopover(false);
                      }}
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: active ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.03)',
                        border: '1px solid ' + (active ? 'var(--color-primary)' : 'var(--border-color)'),
                        color: active ? 'var(--color-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      #{tag}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="dock-divider" />

        {/* Create Note */}
        <button 
          onClick={handleCreateNote}
          className="dock-btn dock-btn-icon-only active"
          title="Create New Note"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* =========================================================================
         SLIDE-OVER WORKSPACE DRAWER
         ========================================================================= */}
      <div className={`workspace-drawer ${activeNoteId ? 'open' : ''}`}>
        <div className="drawer-header">
          {/* Back btn */}
          <button 
            onClick={() => setActiveNoteId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={15} />
            <span>Notes</span>
          </button>

          {/* Sync indicator */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {isSaving ? (
              <>
                <Loader size={11} className="spin-slow" style={{ color: 'var(--color-primary)' }} />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                <span>Saved</span>
              </>
            )}
          </div>

          {/* Top Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              onClick={handleDownload}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-base)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
              title="Download Markdown"
            >
              <Download size={14} />
            </button>
            <button 
              onClick={(e) => activeNote && handleDeleteNote(activeNote.id, e)}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-base)',
                color: 'var(--color-danger)',
                cursor: 'pointer'
              }}
              title="Delete Note"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        {activeNote && (
          <div className="drawer-editor-body">
            {/* WYSIWYG Editor Sheet */}
            <div className="wysiwyg-editor-sheet custom-scroll">
              <div className="wysiwyg-sheet-inner">
                {/* Note Title Input */}
                <input 
                  type="text" 
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  placeholder="Note Title"
                  className="wysiwyg-title"
                />

                {/* Line-by-line editor list */}
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, paddingBottom: '8rem' }}>
                  {lines.map((line, idx) => (
                    <LiveEditableLine 
                      key={idx}
                      text={line}
                      index={idx}
                      isFocused={focusedLineIndex === idx}
                      isCodeBlock={codeBlockLineIndices.has(idx)}
                      onFocus={() => setFocusedLineIndex(idx)}
                      onBlur={(val) => handleLineBlur(idx, val)}
                      onKeyDown={(val, e) => handleLineKeyDown(idx, val, e)}
                      onWikiLinkClick={handleWikiLinkClick}
                      onTagClick={(tag) => setSelectedTag(tag)}
                      onToggleCheckbox={(checked) => handleToggleCheckboxInLine(idx, checked)}
                    />
                  ))}
                </div>
              </div>

              {/* Floating Bottom Formatting Bar (Centered in the editor scroll area) */}
              <div style={{
                position: 'absolute',
                bottom: '2rem',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.35rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(15,15,20,0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                zIndex: 10
              }}>
                <button 
                  onClick={() => insertFormatting('**', '**')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Bold"
                >
                  <Bold size={13} />
                </button>
                <button 
                  onClick={() => insertFormatting('*', '*')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Italic"
                >
                  <Italic size={13} />
                </button>
                <button 
                  onClick={() => insertFormatting('# ')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Header"
                >
                  <Heading size={13} />
                </button>
                <button 
                  onClick={() => insertFormatting('- [ ] ')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Task Checklist"
                >
                  <CheckSquare size={13} />
                </button>
                <button 
                  onClick={() => insertFormatting('- ')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Bullet List"
                >
                  <List size={13} />
                </button>
                <button 
                  onClick={() => insertFormatting('```\n', '\n```')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Code Block"
                >
                  <Code size={13} />
                </button>
                <button 
                  onClick={() => insertFormatting('> [!NOTE]\n> ')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Callout Box"
                >
                  <Quote size={13} />
                </button>
              </div>
            </div>

            {/* Document Outline Sidebar */}
            <div className="drawer-outline-sidebar">
              <span className="outline-title">Outline</span>
              {outlineItems.length === 0 ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No headings found.</span>
              ) : (
                outlineItems.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => scrollToOutline(item.index)}
                    className="outline-item"
                    style={{ paddingLeft: `${(item.level - 1) * 0.5}rem` }}
                  >
                    {item.text}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Wiki Link Creation confirmation popover */}
        {wikiCreateTarget && (
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 300
          }}>
            <div className="glass-card animate-scale" style={{ padding: '1.5rem', maxWidth: '360px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Create New Note?</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Do you want to create a new note named <strong>"{wikiCreateTarget}"</strong>?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem' }}>
                <button
                  onClick={() => {
                    handleCreateNoteWithTitle(wikiCreateTarget);
                    setWikiCreateTarget(null);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  Create Note
                </button>
                <button
                  onClick={() => setWikiCreateTarget(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
