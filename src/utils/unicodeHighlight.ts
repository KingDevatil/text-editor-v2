import { ViewPlugin, ViewUpdate, Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

/**
 * Suspicious / invisible / full-width Unicode characters to highlight:
 * - U+200B-U+200F  zero-width spaces / marks
 * - U+FEFF         zero-width no-break space (BOM)
 * - U+00A0         non-breaking space
 * - U+3000         ideographic (full-width) space
 * - U+FF01-U+FF5E  full-width ASCII variants
 * - U+FFE0-U+FFE6  full-width symbol variants
 */
const SUSPICIOUS_CHARS = /[\u200B-\u200F\uFEFF\u00A0\u3000\uFF01-\uFF5E\uFFE0-\uFFE6]/g;

const UNICODE_HIGHLIGHT_THEME = EditorView.theme({
  '.cm-unicode-highlight': {
    backgroundColor: 'rgba(255, 80, 80, 0.22)',
    borderBottom: '2px wavy rgba(255, 60, 60, 0.75)',
  },
});

export const unicodeHighlightExtension = ViewPlugin.fromClass(
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
      const deco = Decoration.mark({ class: 'cm-unicode-highlight' });
      const doc = view.state.doc;

      // Scan the full document for small files, or viewport +/- buffer for large files
      const isLarge = doc.lines > 10000;
      const scanFrom = isLarge ? Math.max(0, view.viewport.from - 3000) : 0;
      const scanTo = isLarge ? Math.min(doc.length, view.viewport.to + 3000) : doc.length;

      for (let pos = scanFrom; pos < scanTo; ) {
        const line = doc.lineAt(pos);
        const text = line.text;
        let match: RegExpExecArray | null;
        while ((match = SUSPICIOUS_CHARS.exec(text)) !== null) {
          const from = line.from + match.index;
          const to = from + match[0].length;
          builder.add(from, to, deco);
        }
        SUSPICIOUS_CHARS.lastIndex = 0;
        pos = line.to + 1;
      }

      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

export const unicodeHighlight = [UNICODE_HIGHLIGHT_THEME, unicodeHighlightExtension];
