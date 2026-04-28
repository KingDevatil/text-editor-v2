import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

/**
 * Go to definition (simplified): find the first occurrence of the word
 * under cursor and jump to it. If already at the first occurrence,
 * cycles to the next one.
 */
export function goToDefinition(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const word = view.state.wordAt(pos);
  if (!word || word.from === word.to) return false;

  const target = view.state.doc.sliceString(word.from, word.to);
  if (!target || target.length < 2) return false;

  // Search all occurrences
  const text = view.state.doc.toString();
  const occurrences: number[] = [];
  let idx = text.indexOf(target);
  while (idx !== -1) {
    // Ensure whole-word match by checking boundaries
    const before = idx === 0 || !/[a-zA-Z0-9_]/.test(text[idx - 1]);
    const after = idx + target.length >= text.length || !/[a-zA-Z0-9_]/.test(text[idx + target.length]);
    if (before && after) {
      occurrences.push(idx);
    }
    idx = text.indexOf(target, idx + 1);
  }

  if (occurrences.length <= 1) return false;

  // Find current occurrence index
  let currentIdx = occurrences.findIndex((o) => o === word.from);
  if (currentIdx === -1) currentIdx = 0;

  // Jump to next occurrence (cycle)
  const nextIdx = (currentIdx + 1) % occurrences.length;
  const nextPos = occurrences[nextIdx];

  view.dispatch({
    selection: { anchor: nextPos, head: nextPos + target.length },
    effects: EditorView.scrollIntoView(nextPos, { y: 'center' }),
  });

  return true;
}

/**
 * Format JSON content in the active editor view.
 * If text is selected, format only the selection.
 */
export function formatJSON(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;

  // Determine the range to format
  let from = selection.from;
  let to = selection.to;
  let formatAll = from === to;

  if (formatAll) {
    from = 0;
    to = state.doc.length;
  }

  const text = state.doc.sliceString(from, to);

  try {
    // Strip trailing commas before parsing (common in user-edited JSON)
    const cleaned = text.replace(/,\s*([}\]])/g, '$1');
    const parsed = JSON.parse(cleaned);
    const formatted = JSON.stringify(parsed, null, 2);

    view.dispatch({
      changes: { from, to, insert: formatted },
      selection: EditorSelection.cursor(from + formatted.length),
    });
    return true;
  } catch (err) {
    console.error('[formatJSON] Failed to parse JSON:', err);
    return false;
  }
}

/**
 * Format SQL-like content: uppercase keywords, basic indentation.
 * Lightweight — not a full SQL parser.
 */
export function formatSQL(view: EditorView): boolean {
  const { state } = view;
  const text = state.doc.toString();

  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE',
    'TABLE', 'DROP', 'ALTER', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
    'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
    'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
    'AS', 'DISTINCT', 'UNION', 'ALL', 'VALUES', 'SET', 'INTO',
  ];

  const keywordRegex = new RegExp(
    `\\b(${keywords.join('|')})\\b`,
    'gi'
  );

  // Simple formatting: uppercase keywords, add newline after semicolons
  let formatted = text
    .replace(keywordRegex, (match) => match.toUpperCase())
    .replace(/;/g, ';\n')
    .replace(/\n\s*\n/g, '\n') // collapse multiple newlines
    .trim();

  view.dispatch({
    changes: { from: 0, to: state.doc.length, insert: formatted },
    selection: EditorSelection.cursor(0),
  });
  return true;
}

/**
 * Format XML/HTML: basic indentation via a simple tag stack.
 * Not a full formatter — handles common cases.
 */
export function formatXML(view: EditorView): boolean {
  const { state } = view;
  const text = state.doc.toString();

  let formatted = '';
  let indent = 0;
  const indentStr = '  ';

  // Split by tags while preserving them
  const tokens = text.split(/(<\/?[^>]+>)/g);

  for (const token of tokens) {
    if (!token) continue;
    const trimmed = token.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('</')) {
      // Closing tag
      indent = Math.max(0, indent - 1);
      formatted += indentStr.repeat(indent) + trimmed + '\n';
    } else if (trimmed.startsWith('<')) {
      // Opening or self-closing tag
      if (!trimmed.endsWith('/>') && !trimmed.match(/<(br|hr|img|input|meta|link|area|base|col|embed|param|source|track|wbr)/i)) {
        formatted += indentStr.repeat(indent) + trimmed + '\n';
        indent++;
      } else {
        formatted += indentStr.repeat(indent) + trimmed + '\n';
      }
    } else {
      // Text content
      const lines = trimmed.split(/\n/).filter((l) => l.trim());
      for (const line of lines) {
        formatted += indentStr.repeat(indent) + line.trim() + '\n';
      }
    }
  }

  view.dispatch({
    changes: { from: 0, to: state.doc.length, insert: formatted.trim() + '\n' },
    selection: EditorSelection.cursor(0),
  });
  return true;
}

/**
 * Simple CSS formatter: adds newlines and indentation around braces/semicolons.
 */
function formatCSS(view: EditorView): boolean {
  const { state } = view;
  const text = state.doc.toString();

  let result = '';
  let indent = 0;
  const indentStr = '  ';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringChar) inString = false;
      result += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      result += ch;
      continue;
    }

    if (ch === '{') {
      result += ' ' + ch + '\n' + indentStr.repeat(++indent);
    } else if (ch === '}') {
      result += '\n' + indentStr.repeat(--indent) + ch + '\n' + indentStr.repeat(indent);
    } else if (ch === ';') {
      result += ch + '\n' + indentStr.repeat(indent);
    } else if (ch === '\n' || ch === '\t') {
      // collapse original whitespace
    } else if (ch === ' ') {
      if (result.length > 0 && !/\s$/.test(result)) result += ' ';
    } else {
      result += ch;
    }
  }

  view.dispatch({
    changes: { from: 0, to: state.doc.length, insert: result.trim() },
    selection: EditorSelection.cursor(0),
  });
  return true;
}

/**
 * Simple JS/TS formatter: basic brace/semicolon indentation.
 * Not a full formatter — safe for object literals and simple scripts.
 */
function formatJS(view: EditorView): boolean {
  const { state } = view;
  const text = state.doc.toString();

  let result = '';
  let indent = 0;
  const indentStr = '  ';
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1] || '';

    if (inLineComment) {
      result += ch;
      if (ch === '\n') {
        inLineComment = false;
        result += indentStr.repeat(indent);
      }
      continue;
    }

    if (inBlockComment) {
      result += ch;
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        result += next;
        i++;
      }
      continue;
    }

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringChar) inString = false;
      result += ch;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      result += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      result += ch;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      result += ch;
      continue;
    }

    if (ch === '{' || ch === '[') {
      result += ch + '\n' + indentStr.repeat(++indent);
    } else if (ch === '}' || ch === ']') {
      result += '\n' + indentStr.repeat(--indent) + ch;
    } else if (ch === ';') {
      result += ch + '\n' + indentStr.repeat(indent);
    } else if (ch === ',') {
      result += ch + ' ';
    } else if (ch === '\n' || ch === '\t') {
      // ignore original whitespace
    } else if (ch === ' ') {
      if (result.length > 0 && !/\s$/.test(result)) result += ' ';
    } else {
      result += ch;
    }
  }

  view.dispatch({
    changes: { from: 0, to: state.doc.length, insert: result.trim() },
    selection: EditorSelection.cursor(0),
  });
  return true;
}

/**
 * Dispatch a format command based on the current language.
 * Returns true if formatting was applied.
 */
export function formatDocument(view: EditorView, language: string): boolean {
  switch (language) {
    case 'json':
      return formatJSON(view);
    case 'xml':
    case 'html':
      return formatXML(view);
    case 'sql':
      return formatSQL(view);
    case 'css':
      return formatCSS(view);
    case 'javascript':
    case 'typescript':
      return formatJS(view);
    default:
      return false;
  }
}
