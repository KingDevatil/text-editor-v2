import { linter, type Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

/**
 * JSON linter — uses JSON.parse() to detect syntax errors.
 */
function jsonLinter(view: EditorView): Diagnostic[] {
  const text = view.state.doc.toString();
  if (!text.trim()) return [];

  try {
    JSON.parse(text);
    return [];
  } catch (e: any) {
    // Try to extract position from error message
    const match = e.message.match(/position (\d+)/i);
    let pos = 0;
    if (match) {
      pos = parseInt(match[1], 10);
    }

    const line = view.state.doc.lineAt(Math.min(pos, view.state.doc.length));
    return [
      {
        from: line.from,
        to: line.to,
        severity: 'error',
        message: `JSON: ${e.message}`,
      },
    ];
  }
}

/**
 * JS/TS linter — uses new Function() to detect syntax errors.
 * Very lightweight, catches obvious syntax issues.
 */
function jsLinter(view: EditorView): Diagnostic[] {
  const text = view.state.doc.toString();
  if (!text.trim()) return [];

  try {
    new Function(text);
    return [];
  } catch (e: any) {
    // new Function errors look like "Unexpected token '}' (1:15)"
    const match = e.message.match(/\((\d+):(\d+)\)/);
    let lineNum = 1;
    let col = 0;
    if (match) {
      lineNum = parseInt(match[1], 10);
      col = parseInt(match[2], 10);
    }

    const line = view.state.doc.line(Math.min(lineNum, view.state.doc.lines));
    const from = line.from + Math.min(col, line.length);

    return [
      {
        from,
        to: Math.min(from + 1, line.to),
        severity: 'error',
        message: `Syntax: ${e.message}`,
      },
    ];
  }
}

/**
 * Simple XML/HTML linter — checks for basic tag mismatch.
 */
function xmlLinter(view: EditorView): Diagnostic[] {
  const text = view.state.doc.toString();
  if (!text.trim()) return [];

  const diagnostics: Diagnostic[] = [];
  const stack: { tag: string; from: number }[] = [];
  const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^>]*?\/?>/g;
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(text)) !== null) {
    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    const pos = m.index;

    if (isClose) {
      const last = stack.pop();
      if (!last || last.tag !== tag) {
        const line = view.state.doc.lineAt(pos);
        diagnostics.push({
          from: line.from,
          to: line.to,
          severity: 'error',
          message: last
            ? `Tag mismatch: expected </${last.tag}> but found </${tag}>`
            : `Unexpected closing tag </${tag}>`,
        });
      }
    } else if (!m[0].endsWith('/>')) {
      // Self-closing tags don't need matching close
      stack.push({ tag, from: pos });
    }
  }

  // Unclosed tags
  for (const unclosed of stack) {
    const line = view.state.doc.lineAt(unclosed.from);
    diagnostics.push({
      from: line.from,
      to: line.to,
      severity: 'warning',
      message: `Unclosed tag <${unclosed.tag}>`,
    });
  }

  return diagnostics;
}

/**
 * Simple CSS linter — checks brace balance.
 */
function cssLinter(view: EditorView): Diagnostic[] {
  const text = view.state.doc.toString();
  let depth = 0;
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      if (depth === 0) {
        const line = view.state.doc.lineAt(i);
        diagnostics.push({
          from: line.from,
          to: line.to,
          severity: 'error',
          message: 'Unexpected closing brace }',
        });
      } else {
        depth--;
      }
    }
  }

  if (depth > 0) {
    const lastLine = view.state.doc.line(view.state.doc.lines);
    diagnostics.push({
      from: lastLine.from,
      to: lastLine.to,
      severity: 'error',
      message: `Missing ${depth} closing brace(s)`,
    });
  }

  return diagnostics;
}

/**
 * Return a CM6 linter extension for the given language, or null if none available.
 */
export function getLinterExtension(language: string): Extension | null {
  switch (language) {
    case 'json':
      return linter(jsonLinter);
    case 'javascript':
    case 'typescript':
      return linter(jsLinter);
    case 'xml':
    case 'html':
      return linter(xmlLinter);
    case 'css':
      return linter(cssLinter);
    default:
      return null;
  }
}
