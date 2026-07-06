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
  Folder,
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
  ChevronRight,
  FileText
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
// BEAUTIFUL COMPILED TABLE COMPONENT
// =========================================================================
interface CompiledTableProps {
  headers: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right')[];
  onWikiLinkClick: (target: string) => void;
  onTagClick: (tag: string) => void;
}

const CompiledTable: React.FC<CompiledTableProps> = ({
  headers,
  rows,
  alignments,
  onWikiLinkClick,
  onTagClick
}) => {
  return (
    <div className="compiled-table-container custom-scroll">
      <table className="compiled-table">
        <thead>
          <tr>
            {headers.map((h, idx) => (
              <th key={idx} style={{ textAlign: alignments[idx] || 'left' }}>
                {parseInlineMarkdown(h, onWikiLinkClick, onTagClick)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ textAlign: alignments[cIdx] || 'left' }}>
                  {parseInlineMarkdown(cell, onWikiLinkClick, onTagClick)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
// PURE UTILITY FOR EXTRACTING FOLDER PATHS
// =========================================================================
const getFolderStr = (id: string) => {
  const decoded = decodeURIComponent(id);
  const parts = decoded.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join(' / ') : '';
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
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [activeFolderView, setActiveFolderView] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [showTagsPopover, setShowTagsPopover] = useState(false);
  const [showFoldersPopover, setShowFoldersPopover] = useState(false);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogTitle, setCreateDialogTitle] = useState('Untitled Note');
  const [createDialogFolder, setCreateDialogFolder] = useState('Notes');
  const [isNewFolderMode, setIsNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [tempTitle, setTempTitle] = useState('');
  const [tempContent, setTempContent] = useState('');
  const [focusedLineIndex, setFocusedLineIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [wikiCreateTarget, setWikiCreateTarget] = useState<string | null>(null);

  // Sync dock folder filter with active UI folder view
  useEffect(() => {
    if (selectedFolder) {
      setActiveFolderView(selectedFolder);
    }
  }, [selectedFolder]);

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

  // Table block identification
  const tableGroups = useMemo(() => {
    const groups: { start: number; end: number; headers: string[]; rows: string[][]; alignments: ('left'|'center'|'right')[] }[] = [];
    
    let inTable = false;
    let tableLines: string[] = [];
    let startIdx = -1;

    const parseRow = (line: string) => {
      let cleanLine = line.trim();
      if (cleanLine.startsWith('|')) cleanLine = cleanLine.substring(1);
      if (cleanLine.endsWith('|')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
      return cleanLine.split('|').map(cell => cell.trim());
    };

    lines.forEach((line, index) => {
      const hasPipe = line.includes('|');
      
      if (hasPipe) {
        if (!inTable) {
          inTable = true;
          startIdx = index;
          tableLines = [line];
        } else {
          tableLines.push(line);
        }
      } else {
        if (inTable) {
          if (tableLines.length >= 2 && /^\s*\|?\s*(?:\s*:?-+:?\s*\|?)+\s*$/.test(tableLines[1])) {
            const headerLine = tableLines[0];
            const dividerLine = tableLines[1];
            const rowLines = tableLines.slice(2);
            
            const headers = parseRow(headerLine);
            const alignments = parseRow(dividerLine).map(col => {
              const trimmed = col.trim();
              const left = trimmed.startsWith(':');
              const right = trimmed.endsWith(':');
              if (left && right) return 'center';
              if (right) return 'right';
              return 'left';
            });
            const rows = rowLines.map(line => parseRow(line));

            groups.push({
              start: startIdx,
              end: index - 1,
              headers,
              rows,
              alignments
            });
          }
          inTable = false;
          tableLines = [];
        }
      }
    });

    if (inTable && tableLines.length >= 2 && /^\s*\|?\s*(?:\s*:?-+:?\s*\|?)+\s*$/.test(tableLines[1])) {
      const headerLine = tableLines[0];
      const dividerLine = tableLines[1];
      const rowLines = tableLines.slice(2);
      
      const headers = parseRow(headerLine);
      const alignments = parseRow(dividerLine).map(col => {
        const trimmed = col.trim();
        const left = trimmed.startsWith(':');
        const right = trimmed.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        return 'left';
      });
      const rows = rowLines.map(line => parseRow(line));

      groups.push({
        start: startIdx,
        end: lines.length - 1,
        headers,
        rows,
        alignments
      });
    }

    return groups;
  }, [lines]);

  const tableLineMap = useMemo(() => {
    const map: Record<number, { isStart: boolean; start: number; end: number; table: typeof tableGroups[0] }> = {};
    tableGroups.forEach(group => {
      for (let i = group.start; i <= group.end; i++) {
        map[i] = {
          isStart: i === group.start,
          start: group.start,
          end: group.end,
          table: group
        };
      }
    });
    return map;
  }, [tableGroups]);

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

  // Extract unique folders
  const allFolders = useMemo(() => {
    const foldersSet = new Set<string>();
    notes.forEach(note => {
      const folder = getFolderStr(note.id);
      if (folder) {
        foldersSet.add(folder);
      }
    });
    foldersSet.add('Notes'); // Default fallback
    return Array.from(foldersSet).sort();
  }, [notes]);

  // Get visible subfolders at the current activeFolderView level
  const currentFolders = useMemo(() => {
    const foldersSet = new Set<string>();
    const rawFolders = allFolders.filter(f => f !== 'Notes' && f.trim() !== '');
    
    if (activeFolderView === null) {
      rawFolders.forEach(folder => {
        const parts = folder.split(' / ');
        if (parts.length > 0 && parts[0] !== 'Notes' && parts[0].trim() !== '') {
          foldersSet.add(parts[0]);
        }
      });
    } else {
      const parentParts = activeFolderView.split(' / ');
      rawFolders.forEach(folder => {
        const folderParts = folder.split(' / ');
        if (folderParts.length === parentParts.length + 1) {
          const parentPath = folderParts.slice(0, parentParts.length).join(' / ');
          if (parentPath === activeFolderView) {
            foldersSet.add(folder);
          }
        }
      });
    }
    
    return Array.from(foldersSet).sort();
  }, [allFolders, activeFolderView]);

  // Get notes belonging directly to the current activeFolderView level
  const currentNotes = useMemo(() => {
    return notes.filter(note => {
      const folder = getFolderStr(note.id);
      if (activeFolderView === null) {
        return folder === '' || folder === 'Notes';
      } else {
        return folder === activeFolderView;
      }
    });
  }, [notes, activeFolderView]);

  // Sort current level notes
  const sortedCurrentNotes = useMemo(() => {
    const notesCopy = [...currentNotes];
    if (sortBy === 'title') {
      return notesCopy.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      return notesCopy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }, [currentNotes, sortBy]);

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
      
      const folder = getFolderStr(note.id);
      const matchesFolder = !selectedFolder || folder === selectedFolder;
      
      return matchesSearch && matchesTag && matchesFolder;
    });
  }, [notes, searchTerm, selectedTag, selectedFolder]);

  // Sort notes
  const sortedNotes = useMemo(() => {
    const notesCopy = [...filteredNotes];
    if (sortBy === 'title') {
      return notesCopy.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      return notesCopy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }, [filteredNotes, sortBy]);

  // Create new note flows
  const triggerCreateNoteFlow = () => {
    setCreateDialogTitle('Untitled Note');
    setCreateDialogFolder(selectedFolder || 'Notes');
    setIsNewFolderMode(false);
    setNewFolderName('');
    setShowCreateDialog(true);
  };

  const handleGoBackFolder = () => {
    if (!activeFolderView) return;
    const parts = activeFolderView.split(' / ');
    if (parts.length <= 1) {
      setActiveFolderView(null);
      setSelectedFolder(null);
    } else {
      const parent = parts.slice(0, -1).join(' / ');
      setActiveFolderView(parent);
      setSelectedFolder(parent);
    }
  };

  const handleCreateNoteConfirm = async () => {
    const folderName = isNewFolderMode ? newFolderName.trim() : createDialogFolder;
    const cleanFolder = folderName || 'Notes';
    const title = createDialogTitle.trim() || 'Untitled Note';
    
    const content = `# ${title}\n\nWrite your thoughts here...\n\n- [ ] Todo item\n- [ ] Call checklist`;
    const noteId = encodeURIComponent(`${cleanFolder}/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
    
    setIsSaving(true);
    setShowCreateDialog(false);
    const newId = await onAddNote(noteId, title, content);
    if (newId) {
      setActiveNoteId(newId);
    }
    setIsSaving(false);
  };

  const handleCreateNoteWithTitle = async (title: string) => {
    const currentFolder = activeNote ? getFolderStr(activeNote.id) : 'Notes';
    const cleanFolder = currentFolder || 'Notes';
    const content = `# ${title}\n\nWrite your thoughts here...\n\nReferenced from [[${activeNote?.title || 'previous note'}]].`;
    const noteId = encodeURIComponent(`${cleanFolder}/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
    
    setIsSaving(true);
    const newId = await onAddNote(noteId, title, content);
    if (newId) {
      setActiveNoteId(newId);
    }
    setIsSaving(false);
  };

  // Move note to another folder
  const handleMoveNote = async (note: LocalNote, newFolder: string) => {
    const cleanFolder = newFolder.trim() || 'Notes';
    const decoded = decodeURIComponent(note.id);
    const parts = decoded.split('/');
    const fileName = parts[parts.length - 1]; // e.g. Note_Title_123.md
    
    const newId = encodeURIComponent(`${cleanFolder}/${fileName}`);
    
    if (newId === note.id) return; // no change
    
    setIsSaving(true);
    
    // 1. Create a copy of the note in the new folder
    const createdId = await onAddNote(newId, note.title, note.content);
    
    // 2. Delete the note in the old folder
    if (createdId) {
      await onDeleteNote(note.id);
      // 3. Switch activeNoteId to the new ID so the editor stays open
      setActiveNoteId(createdId);
    }
    
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

  return (
    <div className="notes-container">
      {/* =========================================================================
         BENTO GRID BOARD (Main Workspace)
         ========================================================================= */}
      <div className="notes-board-scroll-container">
        {activeFolderView !== null && !searchTerm && (
          <div className="folder-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                onClick={handleGoBackFolder}
                className="btn-secondary hover-scale"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  padding: '0.4rem 0.75rem', 
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={13} />
                <span>{activeFolderView.includes(' / ') ? 'Back' : 'Back to Folders'}</span>
              </button>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                <Folder size={16} style={{ color: 'var(--color-primary)' }} />
                <span>{activeFolderView}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  ({notes.filter(n => {
                    const noteF = getFolderStr(n.id) || 'Notes';
                    return noteF === activeFolderView || noteF.startsWith(activeFolderView + ' / ');
                  }).length} note{notes.filter(n => {
                    const noteF = getFolderStr(n.id) || 'Notes';
                    return noteF === activeFolderView || noteF.startsWith(activeFolderView + ' / ');
                  }).length !== 1 ? 's' : ''})
                </span>
              </h2>
            </div>
          </div>
        )}

        {!searchTerm && !selectedTag ? (
          // HIERARCHICAL VIEW (ROOT OR SUBFOLDER)
          currentFolders.length === 0 && currentNotes.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '1rem', padding: '4rem 0' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                <Sparkles size={28} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {activeFolderView ? 'Empty Folder' : 'No Notes Found'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {activeFolderView 
                    ? `This folder is empty. Create a new note inside '${activeFolderView}'!` 
                    : 'Create your first folder & note via the bottom command dock.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {currentFolders.length > 0 && (
                <>
                  <div className="notes-section-header">
                    <Folder size={16} />
                    <span>Folders</span>
                    <span className="notes-section-badge">{currentFolders.length}</span>
                  </div>
                  <div className="notes-folders-grid">
                    {currentFolders.map(folder => {
                      const folderNotes = notes.filter(n => {
                        const noteF = getFolderStr(n.id) || 'Notes';
                        return noteF === folder || noteF.startsWith(folder + ' / ');
                      });
                      return (
                        <div 
                          key={folder}
                          onClick={() => {
                            setActiveFolderView(folder);
                            setSelectedFolder(folder);
                          }}
                          className="bento-card folder-card"
                          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: 'pointer', minHeight: '140px', justifyContent: 'space-between', padding: '1.25rem' }}
                        >
                          <div className="folder-icon-wrapper">
                            <Folder size={20} />
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <h3 className="folder-card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                              {folder.includes(' / ') ? folder.split(' / ').pop() : folder}
                            </h3>
                            <span className="folder-card-count" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {folderNotes.length} note{folderNotes.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {folderNotes.length > 0 && (
                            <div className="folder-card-preview">
                              {folderNotes.slice(0, 3).map(n => (
                                <span key={n.id} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  • {n.title || 'Untitled Note'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {currentNotes.length > 0 && (
                <>
                  <div className="notes-section-header" style={{ marginTop: currentFolders.length > 0 ? '1.5rem' : '0.5rem' }}>
                    <FileText size={16} />
                    <span>{activeFolderView ? 'Notes' : 'Independent Notes'}</span>
                    <span className="notes-section-badge">{currentNotes.length}</span>
                  </div>
                  <div className="notes-bento-grid">
                    {sortedCurrentNotes.map(note => {
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
                              {folder ? `${folder}` : 'Notes'}
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
                                    <span className="bento-card-todo-checkbox">
                                      {todo.checked ? '✓' : ''}
                                    </span>
                                    <span style={{ textDecoration: todo.checked ? 'line-through' : 'none', opacity: todo.checked ? 0.5 : 1 }}>
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
                    })}
                  </div>
                </>
              )}
            </>
          )
        ) : (
          // FILTERED NOTE CARDS LIST
          sortedNotes.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '1rem', padding: '4rem 0' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                <Sparkles size={28} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>No Notes Found</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  No notes match your filter query.
                </p>
              </div>
            </div>
          ) : (
            <div className="notes-bento-grid">
              {sortedNotes.map(note => {
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
                        {folder ? `${folder}` : 'Notes'}
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
                              <span className="bento-card-todo-checkbox">
                                {todo.checked ? '✓' : ''}
                              </span>
                              <span style={{ textDecoration: todo.checked ? 'line-through' : 'none', opacity: todo.checked ? 0.5 : 1 }}>
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
              })}
            </div>
          )
        )}
      </div>

      {/* =========================================================================
         CENTERED FLOATING DOCK
         ========================================================================= */}
      <div className="bento-filter-dock">
        {/* Search */}
        <div className="global-search-container" style={{ width: '160px', height: '32px' }}>
          <Search size={13} className="global-search-icon" />
          <input 
            type="text" 
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="global-search-input"
            style={{ paddingLeft: '2rem !important' }}
          />
          {searchTerm && (
            <button className="global-search-clear-btn" onClick={() => setSearchTerm('')}>
              <X size={12} />
            </button>
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

        {/* Filter Folders */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => {
              setShowFoldersPopover(!showFoldersPopover);
              setShowTagsPopover(false);
            }}
            className={`dock-btn ${selectedFolder ? 'active' : ''}`}
            title="Filter by Folder"
          >
            <Folder size={13} />
            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedFolder ? selectedFolder : 'Folders'}
            </span>
          </button>

          {showFoldersPopover && (
            <>
              <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 104 }} 
                onClick={() => setShowFoldersPopover(false)}
              />
              <div className="dock-tags-popover">
                <span 
                  onClick={() => {
                    setSelectedFolder(null);
                    setShowFoldersPopover(false);
                  }}
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.2rem 0.45rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: !selectedFolder ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid ' + (!selectedFolder ? 'var(--border-active)' : 'var(--border-color)'),
                    color: !selectedFolder ? 'var(--color-primary)' : 'var(--text-secondary)'
                  }}
                >
                  All Folders
                </span>
                {allFolders.map(folder => {
                  const active = selectedFolder === folder;
                  return (
                    <span
                      key={folder}
                      onClick={() => {
                        setSelectedFolder(folder);
                        setShowFoldersPopover(false);
                      }}
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: active ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.03)',
                        border: '1px solid ' + (active ? 'var(--border-active)' : 'var(--border-color)'),
                        color: active ? 'var(--color-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      {folder}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="dock-divider" />

        {/* Filter Tags */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => {
              setShowTagsPopover(!showTagsPopover);
              setShowFoldersPopover(false);
            }}
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
                    border: '1px solid ' + (!selectedTag ? 'var(--border-active)' : 'var(--border-color)'),
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
                        border: '1px solid ' + (active ? 'var(--border-active)' : 'var(--border-color)'),
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
          onClick={triggerCreateNoteFlow}
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
                {/* Note Folder Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <Folder size={12} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontWeight: 500 }}>Folder:</span>
                  <select
                    value={getFolderStr(activeNote.id) || 'Notes'}
                    onChange={async (e) => {
                      const val = e.target.value;
                      if (val === '+new') {
                        const folderName = prompt('Enter new folder name:');
                        if (folderName && folderName.trim()) {
                          await handleMoveNote(activeNote, folderName.trim());
                        }
                      } else {
                        await handleMoveNote(activeNote, val);
                      }
                    }}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: 'var(--color-primary)', 
                      fontSize: '0.72rem', 
                      fontWeight: 600, 
                      cursor: 'pointer', 
                      padding: 0,
                      outline: 'none',
                      width: 'auto'
                    }}
                  >
                    <option value="Notes" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Notes (Default)</option>
                    {allFolders.filter(f => f !== 'Notes' && f !== '').map(f => (
                      <option key={f} value={f} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{f}</option>
                    ))}
                    <option value="+new" style={{ background: 'var(--bg-card)', color: 'var(--color-primary)', fontWeight: 600 }}>+ Create New Folder...</option>
                  </select>
                </div>

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
                  {lines.map((line, idx) => {
                    const tableInfo = tableLineMap[idx];
                    if (tableInfo) {
                      const isTableEdited = focusedLineIndex !== null && focusedLineIndex >= tableInfo.start && focusedLineIndex <= tableInfo.end;
                      if (!isTableEdited) {
                        if (tableInfo.isStart) {
                          return (
                            <div key={idx} onClick={() => setFocusedLineIndex(idx)} style={{ cursor: 'text', width: '100%' }}>
                              <CompiledTable 
                                headers={tableInfo.table.headers}
                                rows={tableInfo.table.rows}
                                alignments={tableInfo.table.alignments}
                                onWikiLinkClick={handleWikiLinkClick}
                                onTagClick={(tag) => setSelectedTag(tag)}
                              />
                            </div>
                          );
                        }
                        return null;
                      }
                    }

                    return (
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
                    );
                  })}
                </div>
              </div>

              {/* Floating Bottom Formatting Bar (Centered in the editor scroll area) */}
              <div className="floating-formatting-bar">
                <button 
                  onClick={() => insertFormatting('**', '**')} 
                  className="formatting-btn"
                  title="Bold"
                >
                  <Bold size={14} />
                </button>
                <button 
                  onClick={() => insertFormatting('*', '*')} 
                  className="formatting-btn"
                  title="Italic"
                >
                  <Italic size={14} />
                </button>
                <button 
                  onClick={() => insertFormatting('# ')} 
                  className="formatting-btn"
                  title="Header"
                >
                  <Heading size={14} />
                </button>
                <button 
                  onClick={() => insertFormatting('- [ ] ')} 
                  className="formatting-btn"
                  title="Task Checklist"
                >
                  <CheckSquare size={14} />
                </button>
                <button 
                  onClick={() => insertFormatting('- ')} 
                  className="formatting-btn"
                  title="Bullet List"
                >
                  <List size={14} />
                </button>
                <button 
                  onClick={() => insertFormatting('```\n', '\n```')} 
                  className="formatting-btn"
                  title="Code Block"
                >
                  <Code size={14} />
                </button>
                <button 
                  onClick={() => insertFormatting('> [!NOTE]\n> ')} 
                  className="formatting-btn"
                  title="Callout Box"
                >
                  <Quote size={14} />
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

        {/* Create Note Dialog with Folder Selection */}
        {showCreateDialog && (
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
            <div className="glass-card animate-scale" style={{ padding: '1.5rem', maxWidth: '380px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Create New Note</h4>
                <button 
                  onClick={() => setShowCreateDialog(false)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Title Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Note Title</label>
                <input 
                  type="text" 
                  value={createDialogTitle}
                  onChange={(e) => setCreateDialogTitle(e.target.value)}
                  placeholder="Untitled Note"
                  style={{ 
                    padding: '0.5rem 0.75rem', 
                    borderRadius: 'var(--radius-sm)', 
                    border: '1px solid var(--border-color)', 
                    background: 'rgba(0,0,0,0.15)', 
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                  autoFocus
                />
              </div>

              {/* Folder Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Folder Destination</label>
                {!isNewFolderMode ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={createDialogFolder}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '+new') {
                          setIsNewFolderMode(true);
                        } else {
                          setCreateDialogFolder(val);
                        }
                      }}
                      style={{ 
                        flex: 1,
                        padding: '0.5rem', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid var(--border-color)', 
                        background: 'rgba(0,0,0,0.15)', 
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                    >
                      <option value="Notes" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Notes (Default)</option>
                      {allFolders.filter(f => f !== 'Notes' && f !== '').map(f => (
                        <option key={f} value={f} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{f}</option>
                      ))}
                      <option value="+new" style={{ background: 'var(--bg-card)', color: 'var(--color-primary)', fontWeight: 600 }}>+ Create New Folder...</option>
                    </select>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                    <input 
                      type="text" 
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder Name (e.g. Projects)"
                      style={{ 
                        padding: '0.5rem 0.75rem', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid var(--border-color)', 
                        background: 'rgba(0,0,0,0.15)', 
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                    />
                    <button 
                      onClick={() => setIsNewFolderMode(false)}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--color-primary)', 
                        fontSize: '0.7rem', 
                        cursor: 'pointer', 
                        alignSelf: 'flex-start',
                        padding: 0
                      }}
                    >
                      ← Select existing folder
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={handleCreateNoteConfirm}
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
                  onClick={() => setShowCreateDialog(false)}
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
