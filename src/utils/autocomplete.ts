import { autocompletion, type CompletionContext, type Completion } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';

/* ── Language keyword dictionaries ─────────────────────────────── */
const JS_KEYWORDS = [
  'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'do',
  'return', 'class', 'extends', 'import', 'export', 'from', 'default',
  'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'this',
  'typeof', 'instanceof', 'in', 'of', 'void', 'delete', 'yield',
  'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
  'console', 'log', 'warn', 'error', 'info', 'dir', 'time', 'timeEnd',
  'document', 'window', 'globalThis', 'process',
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math',
  'JSON', 'Promise', 'Set', 'Map', 'WeakSet', 'WeakMap', 'RegExp',
  'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
];

const TS_KEYWORDS = [
  ...JS_KEYWORDS,
  'interface', 'type', 'enum', 'namespace', 'module', 'declare',
  'implements', 'public', 'private', 'protected', 'readonly',
  'abstract', 'as', 'satisfies', 'infer', 'keyof', 'typeof',
  'unknown', 'never', 'any', 'object', 'symbol', 'bigint',
  'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit',
  'Exclude', 'Extract', 'NonNullable', 'Parameters', 'ReturnType',
];

const CSS_KEYWORDS = [
  'display', 'position', 'width', 'height', 'margin', 'padding',
  'color', 'background', 'background-color', 'background-image',
  'border', 'border-radius', 'border-color', 'border-width',
  'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
  'grid', 'grid-template', 'grid-gap', 'grid-column', 'grid-row',
  'top', 'left', 'right', 'bottom', 'z-index', 'overflow',
  'font-size', 'font-family', 'font-weight', 'font-style',
  'text-align', 'text-decoration', 'text-transform', 'line-height',
  'letter-spacing', 'white-space', 'word-wrap', 'word-break',
  'cursor', 'float', 'clear', 'content', 'box-sizing',
  'max-width', 'min-width', 'max-height', 'min-height',
  'opacity', 'transform', 'transition', 'animation', 'visibility',
  'list-style', 'vertical-align', 'pointer-events', 'user-select',
  'none', 'block', 'inline', 'inline-block', 'flex', 'grid',
  'absolute', 'relative', 'fixed', 'sticky', 'static',
  'center', 'space-between', 'space-around', 'stretch',
  'hidden', 'visible', 'scroll', 'auto', 'transparent',
  'solid', 'dashed', 'dotted',
];

const HTML_TAGS = [
  'div', 'span', 'p', 'a', 'img', 'input', 'button', 'form',
  'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'script', 'style', 'link', 'meta', 'title', 'base',
  'head', 'body', 'html', 'nav', 'header', 'footer',
  'section', 'article', 'aside', 'main', 'figure', 'figcaption',
  'label', 'select', 'option', 'optgroup', 'textarea',
  'iframe', 'canvas', 'svg', 'video', 'audio', 'source',
  'br', 'hr', 'wbr', 'strong', 'em', 'code', 'pre',
  'id', 'class', 'style', 'src', 'href', 'alt', 'title',
  'type', 'name', 'value', 'placeholder', 'disabled', 'readonly',
  'checked', 'selected', 'required', 'multiple',
];

const JSON_KEYWORDS = ['true', 'false', 'null'];

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE',
  'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'INDEX',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY',
  'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT',
  'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'ASC', 'DESC', 'AS', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
];

const KEYWORDS: Record<string, string[]> = {
  javascript: JS_KEYWORDS,
  typescript: TS_KEYWORDS,
  css: CSS_KEYWORDS,
  html: HTML_TAGS,
  xml: HTML_TAGS,
  json: JSON_KEYWORDS,
  sql: SQL_KEYWORDS,
};

/* ── Word cache (global, single active editor assumption) ─────── */
let wordCache: Completion[] | null = null;
let lastDocLen = -1;
let lastDocLines = -1;

function buildWordCache(doc: { lines: number; line: (n: number) => { text: string } }): Completion[] {
  const words = new Set<string>();
  const regex = /[a-zA-Z_]\w{2,}/g;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i).text;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(line)) !== null) {
      words.add(m[0]);
    }
  }

  const list: Completion[] = [];
  for (const w of words) {
    list.push({ label: w, type: 'variable' });
  }
  return list;
}

function getWordCompletions(doc: { lines: number; line: (n: number) => { text: string }; length: number }): Completion[] {
  if (doc.length === lastDocLen && doc.lines === lastDocLines && wordCache) {
    return wordCache;
  }
  wordCache = buildWordCache(doc);
  lastDocLen = doc.length;
  lastDocLines = doc.lines;
  return wordCache;
}

/* ── Completion source factory ────────────────────────────────── */
function createCompletionSource(language: string) {
  const keywords = KEYWORDS[language] || [];

  return (context: CompletionContext) => {
    // Match the word before cursor
    const word = context.matchBefore(/[a-zA-Z_]\w*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const prefix = word.text;
    const options: Completion[] = [];
    const seen = new Set<string>();

    // 1. Keywords (typed as 'keyword')
    for (const kw of keywords) {
      if (kw.startsWith(prefix) && !seen.has(kw)) {
        seen.add(kw);
        options.push({ label: kw, type: 'keyword' });
      }
    }

    // 2. Words from document (typed as 'variable')
    // Skip for very large files (>200KB) to keep it snappy
    if (context.state.doc.length < 200_000) {
      const docWords = getWordCompletions(context.state.doc);
      for (const w of docWords) {
        if (w.label.startsWith(prefix) && w.label !== prefix && !seen.has(w.label)) {
          seen.add(w.label);
          options.push(w);
        }
      }
    }

    if (options.length === 0) return null;

    return {
      from: word.from,
      options,
      validFor: /^[a-zA-Z_]\w*$/,
    };
  };
}

/**
 * Return a CM6 autocompletion extension for the given language.
 * Falls back to word-based completion only if no keywords are defined.
 */
export function getAutocompleteExtension(language: string): Extension | null {
  const hasKeywords = language in KEYWORDS;
  const hasLighterCompletion = language === 'markdown' || language === 'yaml' || language === 'ini';

  if (!hasKeywords && !hasLighterCompletion) {
    return null;
  }

  return autocompletion({
    override: [createCompletionSource(language)],
    defaultKeymap: true,
    icons: false,
    closeOnBlur: true,
    activateOnTyping: true,
    activateOnTypingDelay: 75,
  });
}
