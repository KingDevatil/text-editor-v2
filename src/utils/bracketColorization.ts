import { ViewPlugin, ViewUpdate, Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const BRACKETS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};
const CLOSE_BRACKETS = new Set(Object.values(BRACKETS));
const DEPTH_COLORS = 4;

/**
 * Lightweight bracket-pair colorization for the visible viewport.
 * Only brackets that are fully matched within the viewport get colored.
 * Depth is computed relative to the viewport start (not document start),
 * which is good enough for visual feedback.
 */
export const bracketColorization = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const { from, to } = view.viewport;
      const text = view.state.doc.sliceString(from, to);

      const stack: { char: string; pos: number }[] = [];
      let inString = false;
      let stringChar = '';
      let inComment = false;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1] || '';

        // Skip comments (// ... \n, /* ... */)
        if (!inString && !inComment && ch === '/' && next === '/') {
          inComment = true;
          i++;
          continue;
        }
        if (inComment && ch === '\n') {
          inComment = false;
          continue;
        }
        if (!inString && !inComment && ch === '/' && next === '*') {
          inComment = true;
          i++;
          continue;
        }
        if (inComment && ch === '*' && next === '/') {
          inComment = false;
          i++;
          continue;
        }
        if (inComment) continue;

        // Skip strings ("...", '...', `...`)
        if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
          inString = true;
          stringChar = ch;
          continue;
        }
        if (inString) {
          if (ch === '\\') {
            i++; // skip escaped char
            continue;
          }
          if (ch === stringChar) {
            inString = false;
          }
          continue;
        }

        if (ch in BRACKETS) {
          stack.push({ char: ch, pos: from + i });
        } else if (CLOSE_BRACKETS.has(ch)) {
          const last = stack.pop();
          if (last && BRACKETS[last.char] === ch) {
            const depth = stack.length % DEPTH_COLORS;
            const cls = `cm-bracket-depth-${depth}`;
            builder.add(last.pos, last.pos + 1, Decoration.mark({ class: cls }));
            builder.add(from + i, from + i + 1, Decoration.mark({ class: cls }));
          }
        }
      }

      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);
