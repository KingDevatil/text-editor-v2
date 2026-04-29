import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Undo, Redo, Scissors, Copy, ClipboardPaste, AlignLeft, Braces, Map, WrapText, Space, GitCompare, X, FileMinus, Crosshair, FolderOpen } from 'lucide-react';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, highlightWhitespace, highlightTrailingWhitespace, scrollPastEnd as scrollPastEndExt } from '@codemirror/view';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, undo, redo, selectAll, indentMore, indentLess } from '@codemirror/commands';
import { highlightSelectionMatches } from '@codemirror/search';
import { foldGutter, foldKeymap, bracketMatching } from '@codemirror/language';
import { unicodeHighlight as unicodeHighlightExt } from '../utils/unicodeHighlight';
import { loadLanguageExtensions, getLanguageExtensionsSync } from '../utils/languageExtensions';
import { getThemeExtension, syntaxHighlightExtension, type EditorTheme } from '../utils/themes';
import { formatDocument } from '../utils/cmCommands';
import { getLinterExtension } from '../utils/lint';
import { getAutocompleteExtension } from '../utils/autocomplete';
import { indentGuides } from '../utils/indentGuides';
import { hoverInfo } from '../utils/hover';
import { bracketColorization } from '../utils/bracketColorization';
import { signatureHelp } from '../utils/signatureHelp';
import { perf } from '../utils/perf';
import { isTauri } from '@tauri-apps/api/core';
import type { Language } from '../types';
import {
  getEditorState,
  setEditorState,
  setActiveView,
} from '../hooks/useEditorStatePool';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import Minimap from './Minimap';
import { useEditorStore } from '../hooks/useEditorStore';
import { goToDefinition } from '../utils/cmCommands';

interface CmEditorProps {
  tabId: string;
  language: Language;
  theme: EditorTheme;
  onChange: () => void;
  fontSize: number;
  readOnly?: boolean;
  initialContent?: string;
  largeFileOptimize?: boolean;
  wordWrap?: boolean;
  showWhitespace?: boolean;
  scrollPastEnd?: boolean;
  minimapVisible?: boolean;
  unicodeHighlight?: boolean;
}

// Compartments allow dynamic reconfiguration without recreating the state.
const languageCompartment = new Compartment();
const themeCompartment = new Compartment();
const fontSizeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const lintCompartment = new Compartment();
const autocompleteCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const unicodeHighlightCompartment = new Compartment();

const FORMATTABLE_LANGUAGES = new Set(['json', 'xml', 'html', 'css', 'javascript', 'typescript', 'sql']);

/** Write text to clipboard — uses Tauri plugin in desktop, falls back to navigator API in browser. */
async function writeClipboard(text: string): Promise<void> {
  if (isTauri()) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
    } catch {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  } else {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

/** Read text from clipboard — uses Tauri plugin in desktop, falls back to navigator API in browser. */
async function readClipboard(): Promise<string> {
  if (isTauri()) {
    try {
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
      return await readText();
    } catch {
      return navigator.clipboard.readText();
    }
  } else {
    return navigator.clipboard.readText();
  }
}

function buildBaseExtensions(
  lang: Language,
  theme: EditorTheme,
  fontSize: number,
  readOnly: boolean,
  largeFileOptimize: boolean,
  wordWrap: boolean,
  showWhitespace: boolean,
  enableScrollPastEnd: boolean,
  tabId: string,
  enableUnicodeHighlight: boolean,
): Extension[] {
  const exts: Extension[] = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    keymap.of([
      { key: 'Tab', run: indentMore, shift: indentLess },
    ]),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    syntaxHighlightExtension,
    languageCompartment.of(getLanguageExtensionsSync(lang)),
    themeCompartment.of(getThemeExtension(theme)),
    fontSizeCompartment.of(
      EditorView.theme({ '.cm-content': { fontSize: `${fontSize}px` } })
    ),
    readOnlyCompartment.of(EditorView.editable.of(!readOnly)),
    wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
    unicodeHighlightCompartment.of(enableUnicodeHighlight ? [...unicodeHighlightExt] : []),
  ];

  if (!largeFileOptimize) {
    exts.push(
      foldGutter(),
      keymap.of(foldKeymap),
      bracketMatching()
    );
  }

  if (showWhitespace) {
    exts.push(highlightWhitespace(), highlightTrailingWhitespace());
  }
  if (enableScrollPastEnd) {
    exts.push(scrollPastEndExt());
  }

  exts.push(lintCompartment.of(getLinterExtension(lang) || []));
  exts.push(autocompleteCompartment.of(getAutocompleteExtension(lang, tabId) || []));
  exts.push(...indentGuides);
  exts.push(hoverInfo);
  exts.push(bracketColorization);
  exts.push(signatureHelp());

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
  wordWrap = false,
  showWhitespace = false,
  scrollPastEnd: enableScrollPastEnd = true,
  minimapVisible = true,
  unicodeHighlight: enableUnicodeHighlight = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

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
      setEditorState(tabId, view.state);
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
          ...buildBaseExtensions(language, theme, fontSize, readOnly, largeFileOptimize, wordWrap, showWhitespace, enableScrollPastEnd, tabId, enableUnicodeHighlight),
          EditorView.updateListener.of((update) => {
            // Always save state to pool so that effects (language/theme changes)
            // are persisted, not just doc changes.
            setEditorState(tabId, update.state);
            if (update.docChanged) {
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

    // Ensure wordWrap is applied even when reusing a pooled state with stale config
    view.dispatch({
      effects: wordWrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });

    // Ensure fontSize is applied even when reusing a pooled state with stale config
    view.dispatch({
      effects: fontSizeCompartment.reconfigure(
        EditorView.theme({ '.cm-content': { fontSize: `${fontSize}px` } })
      ),
    });

    // Workaround: if CM6 default double-click word selection fails to show
    // visual highlight (but selection is logically set), force a re-draw.
    let dblClickCleanup: (() => void) | undefined;
    const cmContent = view.dom.querySelector('.cm-content') as HTMLElement | null;
    if (cmContent) {
      const handleDblClick = (e: MouseEvent) => {
        const v = viewRef.current;
        if (!v) return;
        const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null) return;
        const word = v.state.wordAt(pos);
        if (word && word.from !== word.to) {
          // Only dispatch if the current selection doesn't already match the word.
          // This avoids conflicting with CM6's built-in dblclick handler.
          const sel = v.state.selection.main;
          if (sel.from !== word.from || sel.to !== word.to) {
            v.dispatch({ selection: { anchor: word.from, head: word.to } });
          }
          // Do NOT stopPropagation — let CM6 handle the rest (highlighting, etc.)
        }
      };
      cmContent.addEventListener('dblclick', handleDblClick);
      dblClickCleanup = () => cmContent.removeEventListener('dblclick', handleDblClick);
    }

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
      dblClickCleanup?.();
      if (view) {
        setEditorState(tabId, view.state);
        setActiveView(tabId, null);
        view.destroy();
        viewRef.current = null;
      }
    };
  // Only re-run when tabId changes (or largeFileOptimize which affects base extensions).
  // Language/theme/fontSize/readOnly changes are handled by their own effects below.
  }, [tabId, largeFileOptimize]);

  // Dynamic reconfiguration: language (async load heavy packs)
  const langNonceRef = useRef(0);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const nonce = ++langNonceRef.current;
    console.log('[CmEditor] language change:', language, 'tabId:', tabId);

    // Apply lightweight extension immediately (clears old highlighting for heavy langs)
    view.dispatch({
      effects: [
        languageCompartment.reconfigure(getLanguageExtensionsSync(language)),
        lintCompartment.reconfigure(getLinterExtension(language) || []),
        autocompleteCompartment.reconfigure(getAutocompleteExtension(language, tabId) || []),
      ],
    });
    setEditorState(tabId, view.state);

    // Then load heavy pack in background
    loadLanguageExtensions(language).then((exts) => {
      // Ignore stale responses from rapid language switches
      if (nonce !== langNonceRef.current) {
        console.log('[CmEditor] language change stale, ignoring', language);
        return;
      }
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: languageCompartment.reconfigure(exts),
        });
        setEditorState(tabId, viewRef.current.state);
      }
    }).catch((err) => {
      console.error(`[CmEditor] Failed to load language ${language}:`, err);
    });
  }, [language, tabId]);

  // Dynamic reconfiguration: theme
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtension(theme)),
    });
    setEditorState(tabId, view.state);
  }, [theme, tabId]);

  // Dynamic reconfiguration: font size
  useEffect(() => {
    console.log('[CmEditor] fontSize effect', { fontSize, tabId, hasView: !!viewRef.current });
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontSizeCompartment.reconfigure(
        EditorView.theme({ '.cm-content': { fontSize: `${fontSize}px` } })
      ),
    });
    setEditorState(tabId, view.state);
  }, [fontSize, tabId]);

  // Dynamic reconfiguration: read-only
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorView.editable.of(!readOnly)),
    });
    setEditorState(tabId, view.state);
  }, [readOnly, tabId]);

  // Dynamic reconfiguration: word wrap
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wordWrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
    setEditorState(tabId, view.state);
  }, [wordWrap, tabId]);

  // Dynamic reconfiguration: unicode highlight
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: unicodeHighlightCompartment.reconfigure(enableUnicodeHighlight ? [...unicodeHighlightExt] : []),
    });
    setEditorState(tabId, view.state);
  }, [enableUnicodeHighlight, tabId]);

  // Build context menu items based on current editor state
  const buildMenuItems = useCallback((): ContextMenuItem[] => {
    const view = viewRef.current;
    if (!view) return [];

    const { state } = view;
    const hasSelection = state.selection.main.from !== state.selection.main.to;
    const canUndo = undo({ state, dispatch: () => {} });
    const canRedo = redo({ state, dispatch: () => {} });

    // Access global store for tab management and toggles
    const store = useEditorStore.getState();
    const allTabs = store.tabs;
    const otherTabs = allTabs.filter((t) => t.id !== tabId);
    const isDiffMode = store.diffMode;

    const items: ContextMenuItem[] = [
      {
        id: 'undo',
        label: '撤销',
        icon: <Undo size={14} />,
        shortcut: 'Ctrl+Z',
        disabled: !canUndo,
        action: () => undo(view),
      },
      {
        id: 'redo',
        label: '恢复',
        icon: <Redo size={14} />,
        shortcut: 'Ctrl+Y',
        disabled: !canRedo,
        action: () => redo(view),
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
          writeClipboard(text);
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
          writeClipboard(text);
        },
      },
      {
        id: 'paste',
        label: '粘贴',
        icon: <ClipboardPaste size={14} />,
        shortcut: 'Ctrl+V',
        action: () => {
          readClipboard().then((text) => {
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
        action: () => selectAll(view),
      },
      { id: 'divider-2', label: '', icon: null, divider: true, action: () => {} },
      {
        id: 'goto-def',
        label: '转到定义',
        icon: <Crosshair size={14} />,
        shortcut: 'F12',
        action: () => {
          const ok = goToDefinition(view);
          if (!ok) console.warn('[GoToDef] 无法找到定义（当前仅支持同文件内跳转）');
        },
      },
      { id: 'divider-3', label: '', icon: null, divider: true, action: () => {} },
      {
        id: 'format',
        label: hasSelection ? '格式化选区' : '格式化本行',
        icon: <Braces size={14} />,
        shortcut: 'Shift+Alt+F',
        action: () => {
          const ok = formatDocument(view, language, 'selection');
          if (!ok) console.warn('[Format] 格式化失败：请确保选区内容是有效的可格式化文本');
        },
      },
    ];

    // Tab management section
    if (otherTabs.length > 0) {
      items.push(
        { id: 'divider-tab', label: '', icon: null, divider: true, action: () => {} },
        {
          id: 'close-tab',
          label: '关闭标签页',
          icon: <X size={14} />,
          action: () => store.closeTab(tabId),
        }
      );
      if (otherTabs.length > 1) {
        items.push({
          id: 'close-other-tabs',
          label: '关闭其他标签页',
          icon: <FileMinus size={14} />,
          action: () => store.closeTabs(otherTabs.map((t) => t.id)),
        });
      }
      // Diff option
      if (!isDiffMode && otherTabs.length >= 1) {
        items.push({
          id: 'diff-with',
          label: `与 "${otherTabs[0].title}" 对比`,
          icon: <GitCompare size={14} />,
          action: () => {
            store.setDiffPair(tabId, otherTabs[0].id);
            store.setDiffMode(true);
          },
        });
      }
    }

    // Reveal in folder
    const currentTab = store.tabs.find((t) => t.id === tabId);
    if (currentTab?.filePath) {
      items.push(
        { id: 'divider-reveal', label: '', icon: null, divider: true, action: () => {} },
        {
          id: 'reveal-in-folder',
          label: '在文件夹中显示',
          icon: <FolderOpen size={14} />,
          action: async () => {
            if (currentTab.filePath) {
              try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('reveal_in_folder', { path: currentTab.filePath });
              } catch (err) {
                console.error('[Reveal] 打开文件夹失败:', err);
              }
            }
          },
        }
      );
    }

    // Exit diff mode
    if (isDiffMode) {
      items.push(
        { id: 'divider-diff', label: '', icon: null, divider: true, action: () => {} },
        {
          id: 'exit-diff',
          label: '退出对比',
          icon: <GitCompare size={14} />,
          action: () => {
            store.setDiffMode(false);
            store.setDiffPair(null, null);
          },
        }
      );
    }

    // View toggles
    items.push(
      { id: 'divider-view', label: '', icon: null, divider: true, action: () => {} },
      {
        id: 'toggle-minimap',
        label: store.minimapVisible ? '隐藏缩略图' : '显示缩略图',
        icon: <Map size={14} />,
        action: () => store.setMinimapVisible(!store.minimapVisible),
      },
      {
        id: 'toggle-wordwrap',
        label: store.wordWrap ? '关闭自动换行' : '开启自动换行',
        icon: <WrapText size={14} />,
        action: () => store.setWordWrap(!store.wordWrap),
      },
      {
        id: 'toggle-whitespace',
        label: store.showWhitespace ? '隐藏空白字符' : '显示空白字符',
        icon: <Space size={14} />,
        action: () => store.setShowWhitespace(!store.showWhitespace),
      }
    );

    return items;
  }, [language, canFormat, tabId]);

  // Context menu handler — compute items at click time to ensure viewRef is ready
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, items: buildMenuItems() });
  }, [buildMenuItems]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('contextmenu', handleContextMenu);
    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleContextMenu]);

  return (
    <div className={`flex w-full h-full overflow-hidden ${minimapVisible ? 'hide-scrollbar' : ''}`}>
      <div
        ref={containerRef}
        className="flex-1 h-full overflow-hidden"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace' }}
      >
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
      {minimapVisible && <Minimap viewRef={viewRef} theme={theme} />}
    </div>
  );
};

export default React.memo(CmEditor);
