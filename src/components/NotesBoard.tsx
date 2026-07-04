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
  Loader,
  Info,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Quote,
  Copy,
  Check,
  CheckCircle
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
const parseInlineMarkdown = (text: string) => {
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
  applyFormatting(obsidianLinkRegex, (_, target, alias) => (
    <span key={Math.random()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: 'var(--color-secondary)', background: 'var(--color-secondary-glow)', padding: '0.05rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '0.85em', fontWeight: 500 }}>
      <span>[[</span>
      <span style={{ textDecoration: 'underline' }}>{alias || target}</span>
      <span>]]</span>
    </span>
  ));
  applyFormatting(linkRegex, (_, text, url) => (
    <a key={Math.random()} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline', transition: 'color var(--transition-fast)' }}>
      {text}
    </a>
  ));
  applyFormatting(tagRegex, (_, space, tag) => (
    <React.Fragment key={Math.random()}>
      {space}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', color: 'var(--color-primary)', background: 'var(--color-primary-glow)', padding: '0.05rem 0.35rem', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.8em', fontWeight: 600 }}>
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
    <div style={{ background: 'rgba(0, 0, 0, 0.45)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', margin: '1.25rem 0', overflow: 'hidden', fontFamily: 'monospace', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
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

const TableRenderer: React.FC<{ headers: string[]; rows: string[][]; alignments: ('left' | 'center' | 'right')[] }> = ({ headers, rows, alignments }) => {
  return (
    <div style={{ width: '100%', overflowX: 'auto', margin: '1.5rem 0' }} className="custom-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, idx) => (
              <th key={idx} style={{ textAlign: alignments[idx] || 'left' }}>
                {parseInlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ textAlign: alignments[cIdx] || 'left' }}>
                  {parseInlineMarkdown(cell)}
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
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
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

const ListRenderer: React.FC<{ items: ListItem[]; onToggleCheckbox?: (lineIndex: number) => void }> = ({ items, onToggleCheckbox }) => {
  return (
    <div style={{ margin: '0.85rem 0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {items.map((item, idx) => {
        const hasCheckbox = item.isTodo;
        const indentLevel = item.level;
        
        return (
          <div
            key={idx}
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
              style={{
                color: item.checked ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: item.checked ? 'line-through' : 'none',
                fontSize: '0.875rem',
                flex: 1,
                paddingTop: '0.05rem'
              }}
            >
              {parseInlineMarkdown(item.text)}
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
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onToggleCheckbox }) => {
  if (!content) return <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Empty note.</p>;

  const lines = content.split('\n');
  const blocks = parseMarkdownToBlocks(lines);

  const renderBlock = (block: Block, idx: number): React.ReactNode => {
    switch (block.type) {
      case 'header':
        const HeaderTag = `h${Math.min(6, block.level)}` as React.ElementType;
        const fontSizes = ['1.75rem', '1.35rem', '1.15rem', '1.05rem', '0.95rem', '0.85rem'];
        const fontSize = fontSizes[block.level - 1] || '1rem';
        const isH1 = block.level === 1;
        
        return (
          <HeaderTag
            key={idx}
            style={{
              fontSize,
              fontWeight: 800 - block.level * 40,
              marginTop: isH1 ? '1.85rem' : '1.35rem',
              marginBottom: '0.65rem',
              paddingBottom: isH1 ? '0.4rem' : '0',
              borderBottom: isH1 ? '1px solid var(--border-color)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)'
            }}
          >
            {isH1 && <span style={{ width: '4px', height: '1.5rem', background: 'var(--grad-primary)', borderRadius: '2px', display: 'inline-block' }} />}
            {parseInlineMarkdown(block.text)}
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
              <p key={lIdx} style={{ margin: '0.2rem 0' }}>{parseInlineMarkdown(line)}</p>
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
        return <TableRenderer key={idx} headers={block.headers} rows={block.rows} alignments={block.alignments} />;

      case 'list':
        return <ListRenderer key={idx} items={block.items} onToggleCheckbox={onToggleCheckbox} />;

      case 'paragraph':
        return (
          <p
            key={idx}
            style={{
              margin: '0.65rem 0',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.7'
            }}
          >
            {parseInlineMarkdown(block.text)}
          </p>
        );

      default:
        return null;
    }
  };

  return <div className="obsidian-preview">{blocks.map((block, idx) => renderBlock(block, idx))}</div>;
};

// =========================================================================
// MAIN NOTES BOARD COMPONENT
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
    if (window.confirm('Are you sure you want to delete this note? This will delete the local file.')) {
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
        setTempContent(lines.join('\n'));
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

  // Helper to decode note path for display
  const getNoteFolder = (id: string) => {
    const decoded = decodeURIComponent(id);
    const parts = decoded.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join(' / ');
    }
    return 'Vault Root';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem', height: '100%', overflow: 'hidden' }}>
      
      {/* =========================================================================
         SIDEBAR: Notes list & filter tags (Redesigned)
         ========================================================================= */}
      <div 
        className="glass-panel" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem', 
          height: '100%', 
          overflow: 'hidden', 
          padding: '1.25rem', 
          background: 'rgba(10, 13, 22, 0.55)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        
        {/* Search & Add Note */}
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <div 
            className="notes-search-focus"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              background: 'rgba(0, 0, 0, 0.4)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-sm)', 
              padding: '0.55rem 0.85rem', 
              flex: 1, 
              minWidth: 0,
              transition: 'all var(--transition-fast)'
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: '0.5rem', flexShrink: 0 }} />
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
            className="btn-primary hover-scale" 
            style={{ 
              padding: '0.55rem', 
              borderRadius: 'var(--radius-sm)', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              width: '38px', 
              height: '38px',
              flexShrink: 0
            }}
            title="Create New Note"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>FILTER BY TAG</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button
                onClick={() => setSelectedTag(null)}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.7rem',
                  border: '1px solid ' + (selectedTag === null ? 'var(--color-primary)' : 'var(--border-color)'),
                  background: selectedTag === null ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.02)',
                  color: selectedTag === null ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: selectedTag === null ? 600 : 400,
                  transition: 'all var(--transition-fast)'
                }}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem',
                    border: '1px solid ' + (selectedTag === tag ? 'var(--color-primary)' : 'var(--border-color)'),
                    background: selectedTag === tag ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.02)',
                    color: selectedTag === tag ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: selectedTag === tag ? 600 : 400,
                    transition: 'all var(--transition-fast)'
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1, paddingRight: '0.1rem' }} className="custom-scroll">
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.15rem' }}>MY VAULT</div>
          {filteredNotes.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
              No notes found.
            </div>
          ) : (
            filteredNotes.map(note => {
              const isActive = note.id === activeNoteId;
              const dateObj = new Date(note.updatedAt);
              const snippet = note.content
                .replace(/#\w+/g, '') 
                .replace(/[#*`[\]\-]/g, '') 
                .replace(/@due\(\d{4}-\d{2}-\d{2}\)/g, '')
                .trim()
                .slice(0, 65) + (note.content.length > 65 ? '...' : '');
              
              return (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid ' + (isActive ? 'var(--border-active)' : 'var(--border-color)'),
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    position: 'relative'
                  }}
                  className={isActive ? 'note-card-selected' : 'glass-card'}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      left: '0',
                      top: '20%',
                      bottom: '20%',
                      width: '4px',
                      background: 'var(--grad-primary)',
                      borderRadius: '0 4px 4px 0'
                    }} />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {note.title || 'Untitled Note'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: isActive ? 0.9 : 0.4, padding: '0.1rem', transition: 'all var(--transition-fast)', color: 'var(--color-danger)' }}
                      className="hover-scale"
                      title="Delete note"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    <Folder size={10} style={{ color: 'var(--color-secondary)' }} />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{getNoteFolder(note.id)}</span>
                  </div>

                  <p style={{ fontSize: '0.725rem', color: isActive ? 'rgba(255, 255, 255, 0.7)' : 'var(--text-secondary)', margin: 0, lineHeight: '1.4', lineBreak: 'anywhere' }}>
                    {snippet || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Empty note</span>}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={10} />
                      {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    {note.tags && note.tags.length > 0 && (
                      <span style={{ background: 'var(--color-primary-glow)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--color-primary)', fontSize: '0.6rem', fontWeight: 600 }}>
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
         MAIN EDITOR: Title, content edit, markdown rendering (Redesigned)
         ========================================================================= */}
      <div 
        className="glass-panel" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          overflow: 'hidden', 
          padding: '1.5rem', 
          background: 'rgba(10, 13, 22, 0.3)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {activeNote ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.25rem' }}>
            
            {/* Header: Title edit & layout switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexShrink: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              
              {/* Title input */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    style={{
                      fontSize: '1.5rem',
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
                    <Loader size={16} className="spin-slow" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <Folder size={10} style={{ color: 'var(--color-secondary)' }} />
                  <span>{getNoteFolder(activeNote.id)} / {decodeURIComponent(activeNote.id).split('/').pop()}</span>
                </span>
              </div>

              {/* Layout Switch Mode (Sliding pill toggle) */}
              <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.45)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                {(['edit', 'preview', 'split'] as const).map(mode => {
                  const isActive = editorMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setEditorMode(mode)}
                      style={{
                        padding: '0.45rem 0.95rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        background: isActive ? 'var(--color-primary-glow)' : 'transparent',
                        border: isActive ? '1px solid var(--border-active)' : '1px solid transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
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

            {/* Split Panel: Workspace Content & Synced tasks sidebar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr ' + (extractedTasks.length > 0 ? '260px' : '0px'), gap: '1.25rem', flex: 1, minHeight: 0 }}>
              
              {/* Workspace Content */}
              <div style={{ display: 'flex', height: '100%', minHeight: 0, gap: '1.25rem', flex: 1 }}>
                {(editorMode === 'edit' || editorMode === 'split') && (
                  <textarea
                    value={tempContent}
                    onChange={(e) => setTempContent(e.target.value)}
                    style={{
                      flex: 1,
                      height: '100%',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      color: 'var(--text-primary)',
                      fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
                      fontSize: '0.875rem',
                      lineHeight: '1.65',
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
                    <MarkdownRenderer content={tempContent} onToggleCheckbox={handleToggleCheckbox} />
                  </div>
                )}
              </div>

              {/* Side Drawer: Synced Note Checklists Progress Tracker */}
              {extractedTasks.length > 0 && (
                <div 
                  className="glass-card custom-scroll animate-slide-in" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1.15rem', 
                    padding: '1.15rem', 
                    height: '100%', 
                    overflowY: 'auto', 
                    border: '1px solid var(--border-color)', 
                    background: 'rgba(10, 13, 22, 0.55)',
                    boxShadow: 'var(--shadow-md)'
                  }}
                >
                  {/* Local Checklist Progress Bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>NOTE CHECKLIST</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-secondary)' }}>{taskProgress.percent}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${taskProgress.percent}%`, 
                          height: '100%', 
                          background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)', 
                          borderRadius: '3px', 
                          transition: 'width var(--transition-normal) ease-out',
                          boxShadow: '0 0 8px var(--color-secondary)'
                        }} 
                      />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                      {taskProgress.completed} of {taskProgress.total} tasks completed
                    </span>
                  </div>

                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <CheckSquare size={12} style={{ color: 'var(--color-secondary)' }} />
                    TASKS IN NOTE ({extractedTasks.length})
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1, overflowY: 'auto' }} className="custom-scroll">
                    {extractedTasks.map((t, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleCheckbox(t.lineIndex)}
                        style={{
                          padding: '0.65rem 0.85rem',
                          background: t.completed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid ' + (t.completed ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-color)'),
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.3rem',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                        className="hover-scale"
                      >
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <input 
                            type="checkbox" 
                            checked={t.completed} 
                            readOnly 
                            style={{ 
                              marginTop: '0.15rem', 
                              width: '13px', 
                              height: '13px', 
                              accentColor: 'var(--color-success)',
                              cursor: 'pointer'
                            }} 
                          />
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: t.completed ? 'var(--text-secondary)' : 'var(--text-primary)', 
                            fontWeight: 500, 
                            textDecoration: t.completed ? 'line-through' : 'none', 
                            wordBreak: 'break-word', 
                            opacity: t.completed ? 0.65 : 1 
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
                            gap: '0.2rem', 
                            marginLeft: '1.15rem',
                            background: t.completed ? 'transparent' : 'var(--color-secondary-glow)',
                            padding: '0.05rem 0.35rem',
                            borderRadius: '4px',
                            width: 'fit-content',
                            border: t.completed ? 'none' : '1px solid rgba(6,182,212,0.2)'
                          }}>
                            <Calendar size={8} />
                            {t.dueDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', flexShrink: 0, lineHeight: '1.4' }}>
                    * Checkboxes are rendered local to the note. Checking items edits note markdown.
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '1.25rem' }}>
            <div 
              className="pulse-glow"
              style={{ 
                display: 'inline-flex', 
                padding: '1.25rem', 
                borderRadius: 'var(--radius-md)', 
                background: 'var(--color-primary-glow)', 
                border: '1px solid rgba(99, 102, 241, 0.15)', 
                color: 'var(--color-primary)' 
              }}
            >
              <Sparkles size={36} className="spin-slow" />
            </div>
            <div style={{ textAlign: 'center', maxWidth: '340px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Zenith Note Vault</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.4rem', lineHeight: '1.5' }}>
                Access and manage your Obsidian-compatible markdown notes. Select an existing note or click "+" to build a new one.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
