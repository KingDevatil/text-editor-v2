import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Undo, Redo, Scissors, Copy, ClipboardPaste, AlignLeft, Braces } from 'lucide-react';
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, undo, redo, selectAll } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { getLanguageExtensions } from '../utils/languageExtensions';
import { getThemeExtension, type EditorTheme } from '../utils/themes';
import { formatDocument } from '../utils/cmCommands';
import type { Language } from '../types';
import {
  createEditorState,
  getEditorState,
  setEditorState,
  setActiveView,
} from '../hooks/useEditorStatePool';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';

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

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const canFormat = ['json', 'xml', 'html', 'css', 'javascript', 'typescript', 'markdown', 'sql', 'yaml', 'ini'].includes(language);

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

  // Build context menu items based on current editor state
  const buildMenuItems = useCallback((): ContextMenuItem[] => {
    const view = viewRef.current;
    if (!view) return [];

    const { state } = view;
    const hasSelection = state.selection.main.from !== state.selection.main.to;
    const canUndo = undo({ state, dispatch: () => {} });
    const canRedo = redo({ state, dispatch: () => {} });

    return [
      {
        id: 'undo',
        label: '撤销',
        icon: <Undo size={14} />,
        shortcut: 'Ctrl+Z',
        disabled: !canUndo,
        action: () => {
          undo(view);
        },
      },
      {
        id: 'redo',
        label: '恢复',
        icon: <Redo size={14} />,
        shortcut: 'Ctrl+Y',
        disabled: !canRedo,
        action: () => {
          redo(view);
        },
      },
      { id: 'divider-1', label: '', icon: null, divider: true, action: () => {} },
      {
        id: 'cut',
        label: '剪切',
        icon: <Scissors size={14} />,
        shortcut: 'Ctrl+X',
        disabled: !hasSelection,
        action: () => {
          const text = state.doc.sliceString(state.selection.main.from, state.selection.main.to);
          navigator.clipboard.writeText(text).catch(() => {});
          view.dispatch({
            changes: { from: state.selection.main.from, to: state.selection.main.to, insert: '' },
          });
        },
      },
      {
        id: 'copy',
        label: '复制',
        icon: <Copy size={14} />,
        shortcut: 'Ctrl+C',
        disabled: !hasSelection,
        action: () => {
          const text = state.doc.sliceString(state.selection.main.from, state.selection.main.to);
          navigator.clipboard.writeText(text).catch(() => {});
        },
      },
      {
        id: 'paste',
        label: '粘贴',
        icon: <ClipboardPaste size={14} />,
        shortcut: 'Ctrl+V',
        action: () => {
          navigator.clipboard.readText().then((text) => {
            view.dispatch({
              changes: { from: state.selection.main.from, to: state.selection.main.to, insert: text },
              selection: { anchor: state.selection.main.from + text.length },
            });
          }).catch(() => {});
        },
      },
      {
        id: 'select-all',
        label: '全选',
        icon: <AlignLeft size={14} />,
        shortcut: 'Ctrl+A',
        action: () => {
          selectAll(view);
        },
      },
      { id: 'divider-2', label: '', icon: null, divider: true, action: () => {} },
      {
        id: 'format',
        label: '格式化',
        icon: <Braces size={14} />,
        shortcut: 'Shift+Alt+F',
        disabled: !canFormat,
        action: () => {
          formatDocument(view, language);
        },
      },
    ];
  }, [language, canFormat]);

  // Context menu handler
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('contextmenu', handleContextMenu);
    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleContextMenu]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
      style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace' }}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default React.memo(CmEditor);
