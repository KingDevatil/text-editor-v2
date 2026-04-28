import type { Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { StreamLanguage } from '@codemirror/language';
import type { Language } from '../types';

// Custom INI language support using StreamLanguage
const iniLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.sol() && stream.peek() === '[') {
      stream.skipTo(']');
      stream.eat(']');
      return 'header';
    }
    if (stream.peek() === ';' || stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^\s*[a-zA-Z0-9_\-]+\s*=/)) {
      return 'keyword';
    }
    stream.skipToEnd();
    return null;
  },
  languageData: {
    commentTokens: { line: ';' },
  },
});

// Custom Shell/Bash language support using StreamLanguage
const shellLanguage = StreamLanguage.define({
  token(stream) {
    // Shebang
    if (stream.sol() && stream.match(/^#!/)) {
      stream.skipToEnd();
      return 'meta';
    }
    // Comments
    if (stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    // Strings
    if (stream.peek() === '"' || stream.peek() === "'") {
      const quote = stream.peek();
      stream.next();
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === quote) {
          break;
        }
      }
      return 'string';
    }
    // Variable substitution
    if (stream.match(/\$\{[^}]*\}/) || stream.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return 'variableName';
    }
    // Common shell keywords
    if (stream.match(/\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|exit|break|continue|shift|export|local|readonly|unset)\b/)) {
      return 'keyword';
    }
    // Built-in commands
    if (stream.match(/\b(?:echo|printf|cd|pwd|ls|cat|grep|sed|awk|test|\[|\])\b/)) {
      return 'builtin';
    }
    // Numbers
    if (stream.match(/\b\d+\b/)) {
      return 'number';
    }
    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '#' },
  },
});

// Simple log file highlighter: colorize severity keywords
import { ViewPlugin, ViewUpdate, Decoration } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const logSeverityDecorations = {
  error: Decoration.mark({ class: 'cm-log-error' }),
  warn: Decoration.mark({ class: 'cm-log-warn' }),
  info: Decoration.mark({ class: 'cm-log-info' }),
  debug: Decoration.mark({ class: 'cm-log-debug' }),
};

const logHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none;
    constructor(view: import('@codemirror/view').EditorView) {
      this.decorations = this.buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }
    buildDecorations(view: import('@codemirror/view').EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const regex = /\b(ERROR|FATAL|WARN(?:ING)?|INFO|DEBUG)\b/gi;
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text))) {
          const start = from + m.index;
          const end = start + m[0].length;
          const word = m[1].toUpperCase();
          if (word.startsWith('ERR') || word === 'FATAL') {
            builder.add(start, end, logSeverityDecorations.error);
          } else if (word.startsWith('WARN')) {
            builder.add(start, end, logSeverityDecorations.warn);
          } else if (word === 'INFO') {
            builder.add(start, end, logSeverityDecorations.info);
          } else if (word === 'DEBUG') {
            builder.add(start, end, logSeverityDecorations.debug);
          }
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

const logHighlight = (): Extension => logHighlightPlugin;

/**
 * Map our Language type to CodeMirror 6 language extensions.
 * Returns an array so we can compose multiple extensions if needed.
 */
export function getLanguageExtensions(lang: Language): Extension[] {
  switch (lang) {
    case 'javascript':
      return [javascript({ jsx: true, typescript: false })];
    case 'typescript':
      return [javascript({ jsx: true, typescript: true })];
    case 'html':
      return [html()];
    case 'css':
      return [css()];
    case 'json':
      return [json()];
    case 'python':
      return [python()];
    case 'java':
      return [java()];
    case 'cpp':
      return [cpp()];
    case 'c':
      return [cpp()];
    case 'rust':
      return [rust()];
    case 'go':
      return [go()];
    case 'markdown':
      return [markdown()];
    case 'yaml':
      return [yaml()];
    case 'xml':
      return [xml()];
    case 'sql':
      return [sql()];
    case 'shell':
      return [shellLanguage];
    case 'ini':
      return [iniLanguage];
    case 'log':
      return [logHighlight()];
    case 'csharp':
      // CM6 has no dedicated C# lang pack; treat as plain with basic word highlighting
      return [];
    case 'plaintext':
    default:
      return [];
  }
}
