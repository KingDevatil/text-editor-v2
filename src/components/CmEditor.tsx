import React, { useRef, useEffect } from 'react';
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { getLanguageExtensions } from '../utils/languageExtensions';
import { getThemeExtension, type EditorTheme } from '../utils/themes';
import type { Language } from '../types';
import {
  createEditorState,
  getEditorState,
  setEditorState,
  setActiveView,
} from '../hooks/useEditorStatePool';

interface CmEditorProps {
  tabId: string;
  language: Language;
  theme: EditorTheme;
  onChange: () => void;
  fontSize: number;
  readOnly?: boolean;
  initialContent?: string;
}

// Compartments allow dynamic reconfiguration without recreating the state.
const languageCompartment = new Compartment();
const themeCompartment = new Compartment();
const fontSizeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

function buildBaseExtensions(
  lang: Language,
  theme: EditorTheme,
  fontSize: number,
  readOnly: boolean
) {
  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    lineNumbers(),
    drawSelection(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of(searchKeymap),
    languageCompartment.of(getLanguageExtensions(lang)),
    themeCompartment.of(getThemeExtension(theme)),
    fontSizeCompartment.of(
      EditorView.theme({ '.cm-content': { fontSize: `${fontSize}px` } })
    ),
    readOnlyCompartment.of(EditorView.editable.of(!readOnly)),
  ];
}

const CmEditor: React.FC<CmEditorProps> = ({
  tabId,
  language,
  theme,
  onChange,
  fontSize,
  readOnly = false,
  initialContent = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep callback ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize or switch editor state when tabId changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let view = viewRef.current;

    // Save previous tab's state before switching
    if (view) {
      const prevState = view.state;
      // Find which tab this view was showing (we track via a data attribute or last known tab)
      // We handle this by destroying and recreating for simplicity in Phase 1
      view.destroy();
      viewRef.current = null;
    }

    // Get or create state for this tab
    let state = getEditorState(tabId);
    if (!state) {
      state = EditorState.create({
        doc: initialContent,
        extensions: [
          ...buildBaseExtensions(language, theme, fontSize, readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setEditorState(tabId, update.state);
              onChangeRef.current();
            }
          }),
        ],
      });
      setEditorState(tabId, state);
    }

    // Create new view
    view = new EditorView({
      state,
      parent: container,
    });
    viewRef.current = view;
    setActiveView(tabId, view);

    return () => {
      if (view) {
        setEditorState(tabId, view.state);
        setActiveView(tabId, null);
        view.destroy();
        viewRef.current = null;
      }
    };
  }, [tabId, language, theme, fontSize, readOnly, initialContent]);

  // Dynamic reconfiguration: language
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.reconfigure(getLanguageExtensions(language)),
    });
  }, [language]);

  // Dynamic reconfiguration: theme
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtension(theme)),
    });
  }, [theme]);

  // Dynamic reconfiguration: font size
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontSizeCompartment.reconfigure(
        EditorView.theme({ '.cm-content': { fontSize: `${fontSize}px` } })
      ),
    });
  }, [fontSize]);

  // Dynamic reconfiguration: read-only
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
      style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace' }}
    />
  );
};

export default React.memo(CmEditor);
