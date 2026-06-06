import React from 'react';

// ---------------------------------------------------------------------------
// Inline parser: bold, italic, inline code, plain text
// ---------------------------------------------------------------------------
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Process in order: bold+italic (***), bold (**), italic (*), inline code (`)
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // ***bold italic***
      parts.push(
        <strong key={match.index} style={{ fontStyle: 'italic' }}>
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // **bold**
      parts.push(<strong key={match.index}>{match[3]}</strong>);
    } else if (match[4]) {
      // *italic*
      parts.push(<em key={match.index}>{match[4]}</em>);
    } else if (match[5]) {
      // `code`
      parts.push(
        <code
          key={match.index}
          className="md-inline-code"
        >
          {match[5]}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Block token types
// ---------------------------------------------------------------------------
type Token =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'hr' }
  | { type: 'table'; headers: string[]; alignments: ('left' | 'center' | 'right' | null)[]; rows: string[][] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'code_block'; lang: string; code: string }
  | { type: 'blank' }
  | { type: 'paragraph'; lines: string[] };

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------
function tokenise(markdown: string): Token[] {
  const lines = markdown.split('\n');
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- Blank line ---
    if (line.trim() === '') {
      tokens.push({ type: 'blank' });
      i++;
      continue;
    }

    // --- Fenced code block ---
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      tokens.push({ type: 'code_block', lang, code: codeLines.join('\n') });
      continue;
    }

    // --- Heading ---
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      tokens.push({
        type: 'heading',
        level: Math.min(headingMatch[1].length, 4) as 1 | 2 | 3 | 4,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // --- Horizontal rule ---
    if (/^[-*_]{3,}$/.test(line.trim())) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    // --- Blockquote ---
    if (line.startsWith('> ')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      tokens.push({ type: 'blockquote', lines: bqLines });
      continue;
    }

    // --- Table (detect via pipe on this line AND next line is separator) ---
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\|?[\s\-:|]+\|/.test(lines[i + 1])
    ) {
      const parseRow = (r: string) =>
        r
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(line);
      const separators = parseRow(lines[i + 1]);
      const alignments: ('left' | 'center' | 'right' | null)[] = separators.map((s) => {
        const t = s.trim();
        if (t.startsWith(':') && t.endsWith(':')) return 'center';
        if (t.endsWith(':')) return 'right';
        if (t.startsWith(':')) return 'left';
        return null;
      });

      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseRow(lines[i]));
        i++;
      }
      tokens.push({ type: 'table', headers, alignments, rows });
      continue;
    }

    // --- Unordered list ---
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ''));
        i++;
      }
      tokens.push({ type: 'ul', items });
      continue;
    }

    // --- Ordered list ---
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      tokens.push({ type: 'ol', items });
      continue;
    }

    // --- Paragraph ---
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^[-*_]{3,}$/.test(lines[i].trim()) &&
      !lines[i].includes('|')
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      tokens.push({ type: 'paragraph', lines: paraLines });
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
function renderToken(token: Token, index: number): React.ReactNode {
  switch (token.type) {
    case 'blank':
      return null;

    case 'hr':
      return <hr key={index} className="md-hr" />;

    case 'heading': {
      const Tag = `h${token.level}` as 'h1' | 'h2' | 'h3' | 'h4';
      const cls = ['md-h1', 'md-h2', 'md-h3', 'md-h4'][token.level - 1];
      return (
        <Tag key={index} className={cls}>
          {parseInline(token.text)}
        </Tag>
      );
    }

    case 'paragraph':
      return (
        <p key={index} className="md-p">
          {parseInline(token.lines.join(' '))}
        </p>
      );

    case 'ul':
      return (
        <ul key={index} className="md-ul">
          {token.items.map((item, j) => (
            <li key={j} className="md-li">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={index} className="md-ol">
          {token.items.map((item, j) => (
            <li key={j} className="md-li">
              {parseInline(item)}
            </li>
          ))}
        </ol>
      );

    case 'blockquote':
      return (
        <blockquote key={index} className="md-blockquote">
          {token.lines.map((l, j) => (
            <p key={j} className="md-p" style={{ margin: 0 }}>
              {parseInline(l)}
            </p>
          ))}
        </blockquote>
      );

    case 'code_block':
      return (
        <pre key={index} className="md-pre">
          <code>{token.code}</code>
        </pre>
      );

    case 'table': {
      return (
        <div key={index} className="md-table-wrapper">
          <table className="md-table">
            <thead>
              <tr>
                {token.headers.map((h, j) => (
                  <th
                    key={j}
                    className="md-th"
                    style={{ textAlign: token.alignments[j] || 'left' }}
                  >
                    {parseInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {token.rows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? 'md-tr-even' : 'md-tr-odd'}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="md-td"
                      style={{ textAlign: token.alignments[cIdx] || 'left' }}
                    >
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = ({ content, className = '' }: MarkdownRendererProps) => {
  const tokens = tokenise(content);
  return (
    <div className={`md-root ${className}`}>
      {tokens.map((token, i) => renderToken(token, i))}
    </div>
  );
};
