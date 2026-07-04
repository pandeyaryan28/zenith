import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { LocalNote } from '../services/noteService';
import { 
  Search, 
  Plus, 
  Trash2, 
  Sparkles,
  Loader,
  Info,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Quote,
  Copy,
  Check,
  CheckCircle,
  PanelLeftClose,
  PanelLeft,
  BookOpen,
  Edit3,
  Bold,
  Italic,
  Heading,
  Code,
  List,
  Link,
  Calendar,
  ChevronRight,
  Download,
  Tag,
  ArrowUpDown,
  X
} from 'lucide-react';

interface NotesBoardProps {
  notes: LocalNote[];
  onAddNote: (noteId: string, title: string, content: string) => Promise<string>;
  onUpdateNote: (noteId: string, title: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

interface MarkdownRendererProps {
  content: string;
  onToggleCheckbox?: (lineIndex: number) => void;
  onWikiLinkClick?: (targetTitle: string) => void;
  onTagClick?: (tag: string) => void;
}

// Block structure for custom parser
type Block =
  | { type: 'header'; level: number; text: string }
  | { type: 'divider' }
  | { type: 'code'; lang: string; code: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'callout'; calloutType: string; title: string; bodyBlocks: Block[] }
  | { type: 'table'; headers: string[]; rows: string[][]; alignments: ('left' | 'center' | 'right')[] }
  | { type: 'list'; items: ListItem[] }
  | { type: 'paragraph'; text: string };

interface ListItem {
  level: number;
  text: string;
  isTodo: boolean;
  checked: boolean;
  lineIndex: number;
}

// =========================================================================
// INLINE MARKDOWN PARSER
// =========================================================================
const parseInlineMarkdown = (
  text: string,
  onWikiLinkClick?: (targetTitle: string) => void,
  onTagClick?: (tag: string) => void
) => {
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

  applyFormatting(boldRegex, (_, m) => <strong key={Math.random()} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m}</strong>);
  applyFormatting(italicRegex, (_, m) => <em key={Math.random()} style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{m}</em>);
  applyFormatting(highlightRegex, (_, m) => <mark key={Math.random()} style={{ background: 'var(--color-primary-glow)', color: 'var(--text-primary)', borderBottom: '2px solid var(--color-primary)', padding: '0.05rem 0.2rem', borderRadius: '2px' }}>{m}</mark>);
  
  // Custom Wiki Link clicks
  applyFormatting(obsidianLinkRegex, (_, target, alias) => (
    <span 
      key={Math.random()} 
      className="obsidian-wiki-link"
      onClick={(e) => {
        e.stopPropagation();
        if (onWikiLinkClick) onWikiLinkClick(target);
      }}
    >
      {alias || target}
    </span>
  ));
  
  // Custom normal link styling
  applyFormatting(linkRegex, (_, text, url) => (
    <a key={Math.random()} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline', transition: 'color var(--transition-fast)' }}>
      {text}
    </a>
  ));
  
  // Custom Tag clicks
  applyFormatting(tagRegex, (_, space, tag) => (
    <React.Fragment key={Math.random()}>
      {space}
      <span 
        className="obsidian-tag"
        onClick={(e) => {
          e.stopPropagation();
          if (onTagClick) onTagClick(tag);
        }}
      >
        #{tag}
      </span>
    </React.Fragment>
  ));
  
  applyFormatting(codeRegex, (_, m) => <code key={Math.random()} style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85em', color: 'var(--color-secondary)', wordBreak: 'break-word' }}>{m}</code>);

  return <>{parts}</>;
};

// =========================================================================
// TABLE PARSER HELPERS
// =========================================================================
const parseTable = (tableLines: string[]) => {
  if (tableLines.length < 2) return null;
  const headerLine = tableLines[0];
  const dividerLine = tableLines[1];
  const rowLines = tableLines.slice(2);
  
  const parseRow = (line: string) => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith('|')) cleanLine = cleanLine.substring(1);
    if (cleanLine.endsWith('|')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
    return cleanLine.split('|').map(cell => cell.trim());
  };

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
  return { headers, rows, alignments };
};

// =========================================================================
// MARKDOWN BLOCK-LEVEL PARSER
// =========================================================================
const parseMarkdownToBlocks = (lines: string[], startLineIndex: number = 0): Block[] => {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const absoluteIndex = startLineIndex + i;

    // 1. Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().substring(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        lang,
        code: codeLines.join('\n')
      });
      i++;
      continue;
    }

    // 2. Horizontal Rule
    if (/^\s*(---\s*|\*\*\*\s*|___\s*)$/.test(line)) {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // 3. Header
    const headerMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headerMatch) {
      blocks.push({
        type: 'header',
        level: headerMatch[1].length,
        text: headerMatch[2].trim()
      });
      i++;
      continue;
    }

    // 4. Callout / Blockquote
    if (line.trim().startsWith('>')) {
      const blockquoteLines: string[] = [];
      let isCallout = false;
      let calloutType = '';
      let calloutTitle = '';

      const calloutMatch = /^>\s*\[!([a-zA-Z_-]+)\]\s*(.*)$/.exec(line.trim());
      if (calloutMatch) {
        isCallout = true;
        calloutType = calloutMatch[1].toLowerCase();
        calloutTitle = calloutMatch[2].trim();
      } else {
        blockquoteLines.push(line.trim().substring(1).trim());
      }

      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const contentLine = lines[i].trim().substring(1);
        const cleanContent = contentLine.startsWith(' ') ? contentLine.substring(1) : contentLine;
        if (isCallout) {
          blockquoteLines.push(cleanContent);
        } else {
          blockquoteLines.push(cleanContent.trim());
        }
        i++;
      }

      if (isCallout) {
        const bodyBlocks = parseMarkdownToBlocks(blockquoteLines, absoluteIndex + 1);
        blocks.push({
          type: 'callout',
          calloutType,
          title: calloutTitle || calloutType.toUpperCase(),
          bodyBlocks
        });
      } else {
        blocks.push({
          type: 'blockquote',
          lines: blockquoteLines
        });
      }
      continue;
    }

    // 5. Table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*(:?-+:?\s*\|?)+\s*$/.test(lines[i + 1])) {
      const tableLines: string[] = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const tableObj = parseTable(tableLines);
      if (tableObj) {
        blocks.push({
          type: 'table',
          headers: tableObj.headers,
          rows: tableObj.rows,
          alignments: tableObj.alignments
        });
      }
      continue;
    }

    // 6. Lists & Checklists
    const bulletMatch = /^(\s*)([-*+])\s+(.*)$/.exec(line);
    const orderedMatch = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
    
    if (bulletMatch || orderedMatch) {
      const listItems: ListItem[] = [];
      
      const processListItem = (l: string, idx: number) => {
        const bMatch = /^(\s*)([-*+])\s+(.*)$/.exec(l);
        const oMatch = /^(\s*)(\d+)\.\s+(.*)$/.exec(l);
        
        if (bMatch) {
          const indent = bMatch[1].length;
          let text = bMatch[3];
          
          const todoMatch = /^\[([ xX])\]\s*(.*)$/.exec(text);
          if (todoMatch) {
            return {
              level: Math.floor(indent / 2),
              text: todoMatch[2].trim(),
              isTodo: true,
              checked: todoMatch[1] !== ' ',
              lineIndex: idx
            };
          }
          return {
            level: Math.floor(indent / 2),
            text: text.trim(),
            isTodo: false,
            checked: false,
            lineIndex: idx
          };
        } else if (oMatch) {
          const indent = oMatch[1].length;
          return {
            level: Math.floor(indent / 2),
            text: `${oMatch[2]}. ${oMatch[3].trim()}`,
            isTodo: false,
            checked: false,
            lineIndex: idx
          };
        }
        return null;
      };

      let item = processListItem(line, absoluteIndex);
      if (item) {
        listItems.push(item);
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextItem = processListItem(nextLine, startLineIndex + i);
          if (nextItem) {
            listItems.push(nextItem);
            i++;
          } else if (nextLine.trim() === '') {
            i++;
          } else {
            break;
          }
        }
        blocks.push({
          type: 'list',
          items: listItems
        });
        continue;
      }
    }

    // 7. Paragraph
    if (line.trim() !== '') {
      const paragraphLines: string[] = [line];
      i++;
      while (i < lines.length && 
             lines[i].trim() !== '' && 
             !lines[i].trim().startsWith('```') && 
             !/^(#{1,6})\s+(.+)$/.test(lines[i]) && 
             !lines[i].trim().startsWith('>') && 
             !lines[i].includes('|') && 
             !/^(\s*)([-*+])\s+(.*)$/.test(lines[i]) &&
             !/^(\s*)(\d+)\.\s+(.*)$/.test(lines[i]) &&
             !/^\s*(---\s*|\*\*\*\s*|___\s*)$/.test(lines[i])) {
        paragraphLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'paragraph',
        text: paragraphLines.join(' ')
      });
    } else {
      i++;
    }
  }

  return blocks;
};

// =========================================================================
// PREMIUM SUB-RENDERERS FOR MARKDOWN
// =========================================================================
const CodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', margin: '1.25rem 0', overflow: 'hidden', fontFamily: 'monospace', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(128,128,128,0.04)', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="code-copy-btn"
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? 'var(--color-success)' : 'var(--text-muted)',
            fontSize: '0.7rem',
            cursor: 'pointer',
            padding: '0.2rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            borderRadius: '4px',
            transition: 'all 0.15s ease'
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '1rem', fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-primary)', overflowX: 'auto' }} className="custom-scroll">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const TableRenderer: React.FC<{ 
  headers: string[]; 
  rows: string[][]; 
  alignments: ('left' | 'center' | 'right')[];
  onWikiLinkClick?: (targetTitle: string) => void;
  onTagClick?: (tag: string) => void;
}> = ({ headers, rows, alignments, onWikiLinkClick, onTagClick }) => {
  return (
    <div style={{ width: '100%', overflowX: 'auto', margin: '1.5rem 0' }} className="custom-scroll">
      <table>
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

const CalloutRenderer: React.FC<{ type: string; title: string; children: React.ReactNode }> = ({ type, title, children }) => {
  const typeLower = type.toLowerCase();
  
  let borderColor = 'var(--color-primary)';
  let bgColor = 'var(--color-primary-glow)';
  let icon = <Info size={16} />;
  let titleColor = 'var(--text-primary)';

  if (['note', 'info'].includes(typeLower)) {
    borderColor = '#3b82f6';
    bgColor = 'rgba(59, 130, 246, 0.08)';
    icon = <Info size={16} style={{ color: '#3b82f6' }} />;
    titleColor = '#3b82f6';
  } else if (['todo'].includes(typeLower)) {
    borderColor = '#6366f1';
    bgColor = 'rgba(99, 102, 241, 0.08)';
    icon = <CheckSquare size={16} style={{ color: '#6366f1' }} />;
    titleColor = '#6366f1';
  } else if (['tip', 'hint'].includes(typeLower)) {
    borderColor = '#06b6d4';
    bgColor = 'rgba(6, 182, 212, 0.08)';
    icon = <Sparkles size={16} style={{ color: '#06b6d4' }} />;
    titleColor = '#06b6d4';
  } else if (['important'].includes(typeLower)) {
    borderColor = '#14b8a6';
    bgColor = 'rgba(20, 184, 166, 0.08)';
    icon = <Info size={16} style={{ color: '#14b8a6' }} />;
    titleColor = '#14b8a6';
  } else if (['warning', 'caution', 'attention'].includes(typeLower)) {
    borderColor = '#f59e0b';
    bgColor = 'rgba(245, 158, 11, 0.08)';
    icon = <AlertTriangle size={16} style={{ color: '#f59e0b' }} />;
    titleColor = '#f59e0b';
  } else if (['danger', 'error', 'bug', 'failure'].includes(typeLower)) {
    borderColor = '#ef4444';
    bgColor = 'rgba(239, 68, 68, 0.08)';
    icon = <XCircle size={16} style={{ color: '#ef4444' }} />;
    titleColor = '#ef4444';
  } else if (['success', 'done', 'check'].includes(typeLower)) {
    borderColor = '#10b981';
    bgColor = 'rgba(16, 185, 129, 0.08)';
    icon = <CheckCircle size={16} style={{ color: '#10b981' }} />;
    titleColor = '#10b981';
  } else if (['question', 'help', 'faq'].includes(typeLower)) {
    borderColor = '#8b5cf6';
    bgColor = 'rgba(139, 92, 246, 0.08)';
    icon = <HelpCircle size={16} style={{ color: '#8b5cf6' }} />;
    titleColor = '#8b5cf6';
  } else if (['quote', 'cite'].includes(typeLower)) {
    borderColor = '#6b7280';
    bgColor = 'rgba(107, 114, 128, 0.08)';
    icon = <Quote size={16} style={{ color: '#6b7280' }} />;
    titleColor = '#6b7280';
  }

  return (
    <div style={{
      margin: '1.25rem 0',
      padding: '0.9rem 1.2rem',
      borderLeft: `4px solid ${borderColor}`,
      background: bgColor,
      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: titleColor, textTransform: 'capitalize' }}>
        {icon}
        <span>{title}</span>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
        {children}
      </div>
    </div>
  );
};

const ListRenderer: React.FC<{ 
  items: ListItem[]; 
  onToggleCheckbox?: (lineIndex: number) => void;
  onWikiLinkClick?: (targetTitle: string) => void;
  onTagClick?: (tag: string) => void;
}> = ({ items, onToggleCheckbox, onWikiLinkClick, onTagClick }) => {
  return (
    <div style={{ margin: '0.85rem 0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {items.map((item, idx) => {
        const hasCheckbox = item.isTodo;
        const indentLevel = item.level;
        
        return (
          <div
            key={idx}
            className={`obsidian-todo-item ${item.checked ? 'checked' : ''}`}
            style={{
              paddingLeft: `${indentLevel * 1.5}rem`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              lineHeight: '1.5',
              fontSize: '0.9rem'
            }}
          >
            {hasCheckbox ? (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  height: '1.35rem', 
                  cursor: onToggleCheckbox ? 'pointer' : 'default' 
                }} 
                onClick={() => onToggleCheckbox && onToggleCheckbox(item.lineIndex)}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  style={{
                    cursor: onToggleCheckbox ? 'pointer' : 'default',
                    width: '15px',
                    height: '15px',
                    margin: 0,
                    accentColor: 'var(--color-primary)'
                  }}
                />
              </div>
            ) : (
              <span style={{ color: 'var(--color-secondary)', fontSize: '1.1rem', lineHeight: '0.95', display: 'inline-block', width: '0.5rem', textAlign: 'center', userSelect: 'none' }}>
                •
              </span>
            )}
            <span
              className="obsidian-todo-text"
              style={{
                fontSize: '0.875rem',
                flex: 1,
                paddingTop: '0.05rem'
              }}
            >
              {parseInlineMarkdown(item.text, onWikiLinkClick, onTagClick)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// =========================================================================
// PREMIUM MARKDOWN RENDERER
// =========================================================================
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  onToggleCheckbox,
  onWikiLinkClick,
  onTagClick
}) => {
  if (!content) return <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Empty note.</p>;

  const lines = content.split('\n');
  const blocks = parseMarkdownToBlocks(lines);

  const renderBlock = (block: Block, idx: number): React.ReactNode => {
    switch (block.type) {
      case 'header':
        const HeaderTag = `h${Math.min(6, block.level)}` as React.ElementType;
        const headingId = encodeURIComponent(block.text);
        
        return (
          <HeaderTag
            key={idx}
            id={`heading-${headingId}`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {block.level === 1 && <span style={{ width: '4px', height: '1.5rem', background: 'var(--grad-primary)', borderRadius: '2px', display: 'inline-block' }} />}
            {parseInlineMarkdown(block.text, onWikiLinkClick, onTagClick)}
          </HeaderTag>
        );
      
      case 'divider':
        return (
          <hr
            key={idx}
            style={{
              border: 'none',
              height: '1px',
              background: 'linear-gradient(90deg, var(--border-color) 0%, rgba(255,255,255,0.01) 100%)',
              margin: '1.75rem 0'
            }}
          />
        );

      case 'code':
        return <CodeBlock key={idx} code={block.code} lang={block.lang} />;

      case 'blockquote':
        return (
          <blockquote
            key={idx}
            style={{
              borderLeft: '4px solid var(--border-color)',
              padding: '0.4rem 0 0.4rem 1.1rem',
              margin: '1.15rem 0',
              fontStyle: 'italic',
              color: 'var(--text-secondary)'
            }}
          >
            {block.lines.map((line, lIdx) => (
              <p key={lIdx} style={{ margin: '0.2rem 0' }}>{parseInlineMarkdown(line, onWikiLinkClick, onTagClick)}</p>
            ))}
          </blockquote>
        );

      case 'callout':
        return (
          <CalloutRenderer key={idx} type={block.calloutType} title={block.title}>
            {block.bodyBlocks.map((b, bIdx) => renderBlock(b, bIdx))}
          </CalloutRenderer>
        );

      case 'table':
        return <TableRenderer key={idx} headers={block.headers} rows={block.rows} alignments={block.alignments} onWikiLinkClick={onWikiLinkClick} onTagClick={onTagClick} />;

      case 'list':
        return <ListRenderer key={idx} items={block.items} onToggleCheckbox={onToggleCheckbox} onWikiLinkClick={onWikiLinkClick} onTagClick={onTagClick} />;

      case 'paragraph':
        return (
          <p key={idx}>
            {parseInlineMarkdown(block.text, onWikiLinkClick, onTagClick)}
          </p>
        );

      default:
        return null;
    }
  };

  return <div className="obsidian-preview">{blocks.map((block, idx) => renderBlock(block, idx))}</div>;
};

// =========================================================================
// MAIN MINIMALIST NOTES BOARD COMPONENT
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
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [wikiCreateTarget, setWikiCreateTarget] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Extract unique tags from notes
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach(note => {
      if (note.tags) {
        note.tags.forEach(t => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet).sort();
  }, [notes]);

  // Clean plain-text snippet for note card preview
  const getSnippet = (content: string) => {
    if (!content) return '';
    const clean = content
      .replace(/^(#{1,6})\s+/gm, '') // headings
      .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '') // checklists
      .replace(/^\s*[-*+]\s+/gm, '') // lists
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$2' || '$1') // wiki links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // links
      .replace(/(?:^|\s)#([a-zA-Z0-9_\-/]+)/g, '') // tags
      .replace(/`{3}[\s\S]*?`{3}/g, '') // code blocks
      .replace(/`([^`]+)`/g, '$1') // inline code
      .replace(/>\s*\[![^\]]+\][^\n]*/g, '') // callout headers
      .replace(/^>\s*/gm, '') // blockquotes
      .replace(/\n+/g, ' ') // newlines to spaces
      .trim();
    return clean.length > 50 ? clean.substring(0, 50) + '...' : clean;
  };

  // Filter notes based on search term & selected tag
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

  // Create new note handler
  const handleCreateNote = async () => {
    const title = 'Untitled Note';
    const content = '# Untitled Note\n\nWrite your thoughts here...\n\n- [ ] Todo item\n- [ ] Call checklist';
    const noteId = encodeURIComponent(`Notes/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
    
    setIsSaving(true);
    const newId = await onAddNote(noteId, title, content);
    setActiveNoteId(newId);
    setEditorMode('edit');
    setIsSaving(false);
  };

  // Create new note with pre-defined title (for wiki link click)
  const handleCreateNoteWithTitle = async (title: string) => {
    const content = `# ${title}\n\nWrite your thoughts here...\n\nReferenced from [[${activeNote?.title || 'previous note'}]].`;
    const noteId = encodeURIComponent(`Notes/${title.replace(/\s+/g, '_')}_${Date.now()}.md`);
    
    setIsSaving(true);
    const newId = await onAddNote(noteId, title, content);
    setActiveNoteId(newId);
    setEditorMode('edit');
    setIsSaving(false);
  };

  // Delete note handler
  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      await onDeleteNote(id);
      if (activeNoteId === id) {
        const remaining = notes.filter(n => n.id !== id);
        setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  // Click checkbox inside preview to toggle raw markdown text directly
  const handleToggleCheckbox = (lineIndex: number) => {
    const lines = tempContent.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      const checkRegex = /^(\s*-\s*\[)([ xX])(\]\s*.+)$/;
      const match = checkRegex.exec(line);
      if (match) {
        const currentStatus = match[2];
        const newStatus = (currentStatus === ' ' ? 'x' : ' ');
        lines[lineIndex] = `${match[1]}${newStatus}${match[3]}`;
        const updated = lines.join('\n');
        setTempContent(updated);
        onUpdateNote(activeNoteId!, tempTitle, updated);
      }
    }
  };

  // Click wiki-link: navigate to the note, or trigger creation if not found
  const handleWikiLinkClick = (targetTitle: string) => {
    const foundNote = notes.find(n => n.title.toLowerCase().trim() === targetTitle.toLowerCase().trim());
    if (foundNote) {
      setActiveNoteId(foundNote.id);
    } else {
      setWikiCreateTarget(targetTitle);
    }
  };

  // Click hashtag in preview: set sidebar filter to this tag
  const handleTagClick = (tag: string) => {
    setSelectedTag(selectedTag === tag ? null : tag);
  };

  // Helper to insert markdown formatting markers at the cursor selection
  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const selection = currentVal.substring(start, end);
    const replacement = before + (selection || 'text') + after;
    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    setTempContent(newVal);

    // Refocus and place selection
    setTimeout(() => {
      textarea.focus();
      const newCursorStart = start + before.length;
      const newCursorEnd = newCursorStart + (selection ? selection.length : 4);
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 0);
  };

  // Helper to download the current note as a .md file
  const handleDownloadNote = () => {
    if (!activeNote) return;
    const element = document.createElement('a');
    const file = new Blob([tempContent], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${activeNote.title || 'Untitled'}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Relative timestamp calculation
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Decode folder structure from note ID
  const getNoteFolder = (id: string) => {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join(' / ');
    }
    return '';
  };

  const folderStr = activeNote ? getNoteFolder(activeNote.id) : '';

  return (
    <div className="notes-container">
      
      {/* =========================================================================
         SIDEBAR: Notes list (Collapsible, Distraction-Free)
         ========================================================================= */}
      <div className={`notes-sidebar ${!showSidebar ? 'collapsed' : ''}`}>
        
        {/* Search bar & Add Note */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem 1rem 0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div 
              className="notes-search-focus"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: 'var(--bg-base)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-sm)', 
                padding: '0 0.65rem', 
                flex: 1, 
                height: '34px',
                transition: 'all var(--transition-fast)',
                position: 'relative'
              }}
            >
              <Search size={13} style={{ color: 'var(--text-muted)', marginRight: '0.4rem', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.75rem', width: '100%', padding: 0, height: '100%' }}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            
            <button 
              onClick={handleCreateNote}
              style={{ 
                padding: 0, 
                borderRadius: 'var(--radius-sm)', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                width: '34px', 
                height: '34px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-base)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all var(--transition-fast)'
              }}
              className="hover-scale"
              title="New Note"
            >
              <Plus size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {/* Quick Filters: Sort & Tag Clear */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 500 }}>{sortedNotes.length} notes</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                onClick={() => setSortBy(sortBy === 'updated' ? 'title' : 'updated')} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem' }}
                title={sortBy === 'updated' ? 'Sorted by: Recent' : 'Sorted by: A-Z'}
              >
                <ArrowUpDown size={10} />
                <span>{sortBy === 'updated' ? 'Recent' : 'A-Z'}</span>
              </button>
              {selectedTag && (
                <button 
                  onClick={() => setSelectedTag(null)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-secondary)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tags horizontal scroll */}
        {allTags.length > 0 && (
          <div style={{ 
            display: 'flex', 
            gap: '0.35rem', 
            overflowX: 'auto', 
            padding: '0.5rem 1rem', 
            borderBottom: '1px solid var(--border-color)', 
            whiteSpace: 'nowrap'
          }} className="custom-scroll">
            {allTags.map(tag => {
              const isActive = selectedTag === tag;
              return (
                <span
                  key={tag}
                  onClick={() => setSelectedTag(isActive ? null : tag)}
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid ' + (isActive ? 'var(--color-primary)' : 'var(--border-color)'),
                    color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                    transition: 'all var(--transition-fast)',
                    fontWeight: isActive ? 600 : 400
                  }}
                >
                  #{tag}
                </span>
              );
            })}
          </div>
        )}

        {/* Notes list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', flex: 1, padding: '0.5rem' }} className="custom-scroll">
          {sortedNotes.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
              No notes found
            </div>
          ) : (
            sortedNotes.map(note => {
              const isActive = note.id === activeNoteId;
              const dateStr = formatRelativeTime(note.updatedAt);
              const cardFolder = getNoteFolder(note.id);
              const snippet = getSnippet(note.content);
              
              return (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isActive ? 'var(--bg-surface-hover)' : 'transparent',
                    border: '1px solid ' + (isActive ? 'var(--border-active)' : 'transparent'),
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    overflow: 'hidden'
                  }}
                  className="hover-scale group"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: isActive ? 600 : 400, 
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      flex: 1 
                    }}>
                      {note.title || 'Untitled Note'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        cursor: 'pointer', 
                        opacity: isActive ? 0.6 : 0, 
                        padding: '0.1rem', 
                        transition: 'opacity var(--transition-fast)', 
                        color: 'var(--color-danger)' 
                      }}
                      className="hover-scale"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  
                  {/* Content snippet */}
                  {snippet && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {snippet}
                    </span>
                  )}
                  
                  {/* Folder & Date info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {cardFolder ? `${cardFolder} • ` : ''}{dateStr}
                    </span>
                    {note.tags && note.tags.length > 0 && (
                      <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>#{note.tags[0]}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* =========================================================================
         MAIN CANVAS: distraction-free Obsidian Editor
         ========================================================================= */}
      <div className="notes-canvas">
        {activeNote ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            
            {/* Header controls (Sleek minimalist bar) */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '0 1.5rem', 
              height: '52px', 
              borderBottom: '1px solid var(--border-color)', 
              background: 'var(--bg-surface)', 
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              zIndex: 5,
              flexShrink: 0 
            }}>
              {/* Sidebar toggle & Folder layout info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  onClick={() => setShowSidebar(!showSidebar)} 
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--text-secondary)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '0.25rem',
                    borderRadius: '4px',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="hover-scale"
                  title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
                >
                  {showSidebar ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
                </button>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {folderStr && <span style={{ color: 'var(--text-muted)' }}>{folderStr} /</span>}
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tempTitle || 'Untitled Note'}</span>
                </div>
              </div>

              {/* Status Save Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {isSaving ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3,px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <Loader size={10} className="spin-slow" style={{ color: 'var(--color-primary)' }} />
                    <span>Saving...</span>
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                    <span>Saved</span>
                  </span>
                )}
              </div>

              {/* Toggle Write/Read and Download */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={() => setEditorMode(editorMode === 'edit' ? 'preview' : 'edit')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.35rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="hover-scale"
                  title={editorMode === 'edit' ? "Switch to Reading View" : "Switch to Editing View"}
                >
                  {editorMode === 'edit' ? <BookOpen size={11} /> : <Edit3 size={11} />}
                  <span>{editorMode === 'edit' ? 'Read' : 'Write'}</span>
                </button>

                <button
                  onClick={handleDownloadNote}
                  style={{ 
                    background: 'transparent', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-secondary)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '0.35rem',
                    transition: 'all var(--transition-fast)' 
                  }}
                  className="hover-scale"
                  title="Download Markdown"
                >
                  <Download size={12} />
                </button>
              </div>
            </div>

            {/* Document Workspace Area */}
            <div className="notes-scroll-viewport custom-scroll">
              <div className="notes-doc-sheet">
                
                {/* Note title (seamlessly integrated borderless input) */}
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  style={{
                    fontSize: '1.85rem',
                    fontWeight: 700,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem',
                    fontFamily: 'var(--font-display)',
                    borderBottom: '1px solid var(--border-color)',
                    letterSpacing: '-0.02em',
                    transition: 'all var(--transition-fast)'
                  }}
                  placeholder="Note Title"
                />

                {/* Minimal inline Formatting Toolbar (Only in Edit mode) */}
                {editorMode === 'edit' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap'
                  }}>
                    <button onClick={() => insertMarkdown('**', '**')} className="notes-toolbar-btn" title="Bold"><Bold size={12} /></button>
                    <button onClick={() => insertMarkdown('*', '*')} className="notes-toolbar-btn" title="Italic"><Italic size={12} /></button>
                    <button onClick={() => insertMarkdown('# ')} className="notes-toolbar-btn" title="Header 1"><Heading size={12} style={{ transform: 'scale(0.85)' }} /></button>
                    
                    <span style={{ width: '1px', height: '12px', background: 'var(--border-color)', margin: '0 0.25rem' }} />
                    
                    <button onClick={() => insertMarkdown('- [ ] ')} className="notes-toolbar-btn" title="Checklist"><CheckSquare size={12} /></button>
                    <button onClick={() => insertMarkdown('- ')} className="notes-toolbar-btn" title="Bullet List"><List size={12} /></button>
                    <button onClick={() => insertMarkdown('```\n', '\n```')} className="notes-toolbar-btn" title="Code Block"><Code size={12} /></button>
                    <button onClick={() => insertMarkdown('> [!NOTE]\n> ')} className="notes-toolbar-btn" title="Callout"><Quote size={12} /></button>
                    <button onClick={() => insertMarkdown('[', '](url)')} className="notes-toolbar-btn" title="Link"><Link size={12} /></button>
                  </div>
                )}

                {/* Content Input or Preview (Exactly identical layout properties to prevent layout shifts) */}
                <div style={{ flex: 1, minHeight: '400px' }}>
                  {editorMode === 'edit' ? (
                    <textarea
                      ref={textareaRef}
                      value={tempContent}
                      onChange={(e) => setTempContent(e.target.value)}
                      className="notes-textarea notes-doc-font"
                      placeholder="Start writing in markdown..."
                    />
                  ) : (
                    <MarkdownRenderer 
                      content={tempContent} 
                      onToggleCheckbox={handleToggleCheckbox} 
                      onWikiLinkClick={handleWikiLinkClick}
                      onTagClick={handleTagClick}
                    />
                  )}
                </div>

              </div>
            </div>

            {/* Custom confirmation dialog for on-the-fly wiki link creation */}
            {wikiCreateTarget && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 100
              }}>
                <div className="glass-card animate-scale" style={{
                  padding: '1.5rem',
                  maxWidth: '360px',
                  width: '90%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  textAlign: 'center'
                }}>
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
        ) : (
          /* Redesigned Empty State UI (Minimalist) */
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '1rem' }}>
            <div 
              style={{ 
                display: 'inline-flex', 
                padding: '1rem', 
                borderRadius: 'var(--radius-md)', 
                background: 'var(--color-primary-glow)', 
                border: '1px solid rgba(99, 102, 241, 0.12)', 
                color: 'var(--color-primary)' 
              }}
            >
              <Sparkles size={28} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Zenith Notes</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Select a note or click "+" to begin.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
