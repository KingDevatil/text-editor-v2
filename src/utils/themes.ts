import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';

export type EditorTheme = 'vs' | 'vs-dark' | 'sepia' | 'hc-black';

/**
 * Syntax highlighting via CSS classes (tok-keyword, tok-string, etc.).
 * Colors are defined in index.css for both light and dark themes.
 */
export const syntaxHighlightExtension: Extension = syntaxHighlighting(classHighlighter);

/**
 * Light theme ("vs") — white background, dark text.
 */
export const lightTheme: Extension = EditorView.theme(
  {
    '&': {
      backgroundColor: '#ffffff',
      color: '#333333',
    },
    '.cm-content': {
      caretColor: '#000000',
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      fontSize: '14px',
      lineHeight: '1.5',
    },
    '.cm-gutters': {
      backgroundColor: '#f5f5f5',
      color: '#6e7681',
      borderRight: '1px solid #e0e0e0',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#e8e8e8',
      color: '#333333',
    },
    '.cm-activeLine': {
      backgroundColor: '#f5f8fa',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(128, 128, 128, 0.25)',
    },
    '.cm-searchMatch': {
      backgroundColor: '#a8ac94',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#ffd700',
    },
    // Log severity colors (light)
    '.cm-log-error': { color: '#d32f2f', fontWeight: 'bold' },
    '.cm-log-warn': { color: '#f57c00', fontWeight: 'bold' },
    '.cm-log-info': { color: '#1976d2', fontWeight: 'bold' },
    '.cm-log-debug': { color: '#616161' },
  },
  { dark: false }
);

/**
 * Dark theme ("vs-dark") — dark background, light text.
 */
export const darkTheme: Extension = EditorView.theme(
  {
    '&': {
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
    },
    '.cm-content': {
      caretColor: '#d4d4d4',
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      fontSize: '14px',
      lineHeight: '1.5',
    },
    '.cm-gutters': {
      backgroundColor: '#252526',
      color: '#858585',
      borderRight: '1px solid #333333',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#2c2c2d',
      color: '#c6c6c6',
    },
    '.cm-activeLine': {
      backgroundColor: '#222426',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(160, 160, 160, 0.3)',
    },
    '.cm-searchMatch': {
      backgroundColor: '#515c6a',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#ffd700',
    },
    // Log severity colors (dark)
    '.cm-log-error': { color: '#f48771', fontWeight: 'bold' },
    '.cm-log-warn': { color: '#dcdcaa', fontWeight: 'bold' },
    '.cm-log-info': { color: '#4fc1ff', fontWeight: 'bold' },
    '.cm-log-debug': { color: '#808080' },
  },
  { dark: true }
);

/**
 * Sepia theme — warm, eye-friendly tones for long reading sessions.
 */
export const sepiaTheme: Extension = EditorView.theme(
  {
    '&': {
      backgroundColor: '#f4ecd8',
      color: '#5b4636',
    },
    '.cm-content': {
      caretColor: '#5b4636',
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      fontSize: '14px',
      lineHeight: '1.5',
    },
    '.cm-gutters': {
      backgroundColor: '#eaddc5',
      color: '#8c7b6c',
      borderRight: '1px solid #d7c9a9',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#dccba8',
      color: '#5b4636',
    },
    '.cm-activeLine': {
      backgroundColor: '#ebe0c8',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(160, 120, 80, 0.25)',
    },
    '.cm-searchMatch': {
      backgroundColor: '#c4b896',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#d4a017',
    },
  },
  { dark: false }
);

/**
 * High-contrast dark theme — for accessibility.
 */
export const hcDarkTheme: Extension = EditorView.theme(
  {
    '&': {
      backgroundColor: '#000000',
      color: '#ffffff',
    },
    '.cm-content': {
      caretColor: '#ffffff',
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      fontSize: '14px',
      lineHeight: '1.5',
    },
    '.cm-gutters': {
      backgroundColor: '#000000',
      color: '#ffffff',
      borderRight: '1px solid #ffffff',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
    },
    '.cm-activeLine': {
      backgroundColor: '#1a1a1a',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#0080ff',
    },
    '.cm-searchMatch': {
      backgroundColor: '#ff00ff',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#ffff00',
    },
  },
  { dark: true }
);

export function getThemeExtension(theme: EditorTheme): Extension {
  switch (theme) {
    case 'vs':
      return lightTheme;
    case 'vs-dark':
      return darkTheme;
    case 'sepia':
      return sepiaTheme;
    case 'hc-black':
      return hcDarkTheme;
    default:
      return darkTheme;
  }
}
