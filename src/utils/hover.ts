import { hoverTooltip, type Tooltip } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

/**
 * Lightweight hover tooltip showing the word/token under cursor.
 * For JSON, also shows the path to the hovered key/value.
 */
function buildTooltip(view: EditorView, pos: number): Tooltip | null {
  const word = view.state.wordAt(pos);
  if (!word || word.from === word.to) return null;

  const token = view.state.doc.sliceString(word.from, word.to);
  const line = view.state.doc.lineAt(pos);

  // Simple type inference for display
  let typeLabel = 'identifier';
  const lang = (view.state.facet as unknown as { language?: { name: string } })?.language?.name || '';

  if (lang.includes('json')) {
    // Try to build a simple path for JSON
    const path = buildJsonPath(view, pos);
    if (path) {
      return {
        pos: word.from,
        end: word.to,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-hover-tooltip';
          dom.innerHTML = `<div class="font-mono text-xs">${escapeHtml(token)}</div><div class="text-[10px] opacity-70 mt-0.5">${escapeHtml(path)}</div>`;
          return { dom };
        },
      };
    }
  }

  // Detect common patterns
  const lineText = line.text;
  if (/^\s*(const|let|var)\s+/.test(lineText) && lineText.indexOf(token) > lineText.indexOf('const')) {
    typeLabel = 'variable';
  } else if (/^\s*(function)\s+/.test(lineText)) {
    typeLabel = 'function';
  } else if (/^\s*(import)\s+/.test(lineText)) {
    typeLabel = 'module';
  } else if (/^\s*(class)\s+/.test(lineText)) {
    typeLabel = 'class';
  }

  return {
    pos: word.from,
    end: word.to,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-hover-tooltip';
      dom.innerHTML = `<span class="font-mono text-xs">${escapeHtml(token)}</span><span class="text-[10px] opacity-60 ml-1.5">${typeLabel}</span>`;
      return { dom };
    },
  };
}

/**
 * Walk backwards to build a crude JSON path like `root.arr[0].key`.
 */
function buildJsonPath(view: EditorView, pos: number): string | null {
  const doc = view.state.doc;
  const currentLine = doc.lineAt(pos).number;
  const parts: string[] = [];

  // Find the key on the current line (if any)
  const line = doc.line(currentLine);
  const keyMatch = line.text.match(/"([^"]+)"\s*:/);
  if (keyMatch) {
    parts.unshift(keyMatch[1]);
  }

  // Walk up to find parent contexts
  let bracketDepth = 0;
  for (let i = line.from - 1; i >= 0; i--) {
    const ch = doc.sliceString(i, i + 1);
    if (ch === '}' || ch === ']') bracketDepth++;
    else if (ch === '{' || ch === '[') {
      if (bracketDepth === 0) {
        if (ch === '[') {
          // Count commas between this [ and the target line,
          // but only at depth 0 (ignore commas inside nested objects/arrays)
          let commaCount = 0;
          let nestedDepth = 0;
          for (let j = i + 1; j < pos; j++) {
            const c = doc.sliceString(j, j + 1);
            if (c === '{' || c === '[') nestedDepth++;
            else if (c === '}' || c === ']') nestedDepth--;
            else if (c === ',' && nestedDepth === 0) commaCount++;
          }
          parts.unshift(`[${commaCount}]`);
        }
        // Look for key on the line containing this {
        const parentLine = doc.lineAt(i);
        const parentKey = parentLine.text.match(/"([^"]+)"\s*:/);
        if (parentKey) {
          parts.unshift(parentKey[1]);
        }
      } else {
        bracketDepth--;
      }
    }
  }

  if (parts.length === 0) return null;
  return parts.join('.');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * CM6 hover tooltip extension.
 */
export const hoverInfo = hoverTooltip(
  (view, pos) => {
    return buildTooltip(view, pos);
  },
  {
    hideOnChange: true,
    hoverTime: 400, // ms before tooltip appears
  }
);
