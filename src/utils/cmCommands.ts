import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

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
    const parsed = JSON.parse(text);
    const formatted = JSON.stringify(parsed, null, 2);

    view.dispatch({
      changes: { from, to, insert: formatted },
      selection: EditorSelection.cursor(from + formatted.length),
    });
    return true;
  } catch {
    // Invalid JSON — don't modify
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
    default:
      return false;
  }
}
