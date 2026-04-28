import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { getLanguageExtensionsSync } from '../utils/languageExtensions';
import { getThemeExtension, type EditorTheme } from '../utils/themes';
import type { Language } from '../types';

interface StatePool {
  states: Map<string, EditorState>;
}

const pool: StatePool = { states: new Map() };

function createBaseExtensions(
  language: Language,
  theme: EditorTheme,
  fontSize: number,
  readOnly: boolean
): Extension[] {
  const extensions: Extension[] = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    lineNumbers(),
    drawSelection(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of(searchKeymap),
    getThemeExtension(theme),
    EditorView.theme({
      '.cm-content': { fontSize: `${fontSize}px` },
    }),
  ];

  const langExts = getLanguageExtensionsSync(language);
  extensions.push(...langExts);

  if (readOnly) {
    extensions.push(EditorView.editable.of(false));
  }

  return extensions;
}

export function createEditorState(
  tabId: string,
  content: string,
  language: Language,
  theme: EditorTheme,
  fontSize: number,
  readOnly = false
): EditorState {
  const extensions = createBaseExtensions(language, theme, fontSize, readOnly);
  const state = EditorState.create({
    doc: content,
    extensions,
  });
  pool.states.set(tabId, state);
  return state;
}

export function getEditorState(tabId: string): EditorState | undefined {
  return pool.states.get(tabId);
}

export function setEditorState(tabId: string, state: EditorState): void {
  pool.states.set(tabId, state);
}

export function deleteEditorState(tabId: string): void {
  pool.states.delete(tabId);
}

export function getEditorContent(tabId: string): string {
  const state = pool.states.get(tabId);
  return state?.doc.toString() ?? '';
}

export function getEditorLineCount(tabId: string): number {
  const state = pool.states.get(tabId);
  return state?.doc.lines ?? 0;
}

export function getEditorValueLength(tabId: string): number {
  const state = pool.states.get(tabId);
  return state?.doc.length ?? 0;
}

export function hasEditorState(tabId: string): boolean {
  return pool.states.has(tabId);
}

/**
 * Replace content for an existing tab while preserving selection when possible.
 * Used when re-reading a file (encoding change, reload, drag-drop update).
 */
export function updateEditorContent(tabId: string, newContent: string): void {
  const oldState = pool.states.get(tabId);
  if (!oldState) return;

  const tr = oldState.update({
    changes: {
      from: 0,
      to: oldState.doc.length,
      insert: newContent,
    },
  });
  pool.states.set(tabId, tr.state);

  // If there's an active EditorView for this tab, dispatch the transaction
  const view = getActiveView(tabId);
  if (view) {
    view.dispatch(tr);
  }
}

// Track active EditorView instances per tab (set by CmEditor component)
const activeViews = new Map<string, EditorView>();

export function setActiveView(tabId: string, view: EditorView | null): void {
  if (view) {
    activeViews.set(tabId, view);
  } else {
    activeViews.delete(tabId);
  }
}

export function getActiveView(tabId: string): EditorView | undefined {
  return activeViews.get(tabId);
}
