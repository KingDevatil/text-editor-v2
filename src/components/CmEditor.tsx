import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Undo, Redo, Scissors, Copy, ClipboardPaste, AlignLeft, Braces } from 'lucide-react';
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, undo, redo, selectAll } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { foldGutter, foldKeymap, bracketMatching } from '@codemirror/language';
import { loadLanguageExtensions, getLanguageExtensionsSync } from '../utils/languageExtensions';
import { getThemeExtension, type EditorTheme } from '../utils/themes';
import { formatDocument } from '../utils/cmCommands';
import { perf } from '../utils/perf';
import type { Language } from '../types';
import {
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
  largeFileOptimize?: boolean;
}

// Compartments allow dynamic reconfiguration without recreating the state.
const languageCompartment = new Compartment();
const themeCompartment = new Compartment();
const fontSizeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

const FORMATTABLE_LANGUAGES = new Set(['json', 'xml', 'html', 'css', 'javascript', 'typescript', 'markdown', 'sql', 'yaml', 'ini']);

function buildBaseExtensions(
  lang: Language,
  theme: EditorTheme,
  fontSize: number,
  readOnly: boolean,
  largeFileOptimize: boolean
): Extension[] {
  const exts: Extension[] = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    lineNumbers(),
    drawSelection(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of(searchKeymap),
    languageCompartment.of(getLanguageExtensionsSync(lang)),
    themeCompartment.of(getThemeExtension(theme)),
    fontSizeCompartment.of(
      EditorView.theme({ '.cm-content': { fontSize: `${fontSize}px` } })
    ),
    readOnlyCompartment.of(EditorView.editable.of(!readOnly)),
  ];

  if (!largeFileOptimize) {
    exts.push(
      foldGutter(),
      keymap.of(foldKeymap),
      bracketMatching()
    );
  }

  return exts;
}

const CmEditor: React.FC<CmEditorProps> = ({
  tabId,
  language,
  theme,
  onChange,
  fontSize,
  readOnly = false,
  initialContent = '',
  largeFileOptimize = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const canFormat = FORMATTABLE_LANGUAGES.has(language);

  // Keep callback ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize or switch editor state when tabId changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let view = viewRef.current;
    let cancelled = false;

    // Save previous tab's state before switching
    if (view) {
      view.destroy();
      viewRef.current = null;
    }

    // Get or create state for this tab
    let state = getEditorState(tabId);
    if (!state) {
      perf.mark(`editor-init-start-${tabId}`);
      state = EditorState.create({
        doc: initialContent,
        extensions: [
          ...buildBaseExtensions(language, theme, fontSize, readOnly, largeFileOptimize),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setEditorState(tabId, update.state);
              onChangeRef.current();
            }
          }),
        ],
      });
      setEditorState(tabId, state);
      perf.mark(`editor-init-end-${tabId}`);
      perf.measure('editor-init', `editor-init-start-${tabId}`, `editor-init-end-${tabId}`, {
        tabId,
        language,
        docLength: initialContent.length,
      });
    }

    // Create new view
    view = new EditorView({
      state,
      parent: container,
    });
    viewRef.current = view;
    setActiveView(tabId, view);

    // Async load heavy language pack and apply when ready
    loadLanguageExtensions(language).then((exts) => {
      if (cancelled || !viewRef.current) return;
      viewRef.current.dispatch({
        effects: languageCompartment.reconfigure(exts),
      });
    }).catch((err) => {
      console.error(`[CmEditor] Failed to load language ${language}:`, err);
    });

    return () => {
      cancelled = true;
      if (view) {
        setEditorState(tabId, view.state);
        setActiveView(tabId, null);
        view.destroy();
        viewRef.current = null;
      }
    };
  }, [tabId, language, theme, fontSize, readOnly, initialContent, largeFileOptimize]);

  // Dynamic reconfiguration: language (async load heavy packs)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Apply lightweight extension immediately
    view.dispatch({
      effects: languageCompartment.reconfigure(getLanguageExtensionsSync(language)),
    });

    // Then load heavy pack in background
    loadLanguageExtensions(language).then((exts) => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: languageCompartment.reconfigure(exts),
        });
      }
    }).catch((err) => {
      console.error(`[CmEditor] Failed to load language ${language}:`, err);
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

  const menuItems = React.useMemo(() => buildMenuItems(), [buildMenuItems]);

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
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default React.memo(CmEditor);
