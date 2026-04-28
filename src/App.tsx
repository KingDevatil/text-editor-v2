import React, { useRef, useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open, confirm } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from './hooks/useEditorStore';
import { useFileOpener } from './hooks/useFileOpener';
import { getEditorContent, updateEditorContent, getActiveView } from './hooks/useEditorStatePool';
import { formatDocument } from './utils/cmCommands';
import type { Encoding } from './types';
import Toolbar from './components/Toolbar';
import TabBar from './components/TabBar';
import FindReplace from './components/FindReplace';
import StatusBar from './components/StatusBar';
import Sidebar from './components/Sidebar';
import MarkdownPreview from './components/MarkdownPreview';
import CmEditor from './components/CmEditor';

function App() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeGroup1TabId = useEditorStore((s) => s.activeGroup1TabId);
  const activeGroup2TabId = useEditorStore((s) => s.activeGroup2TabId);
  const theme = useEditorStore((s) => s.theme);
  const sidebarVisible = useEditorStore((s) => s.sidebarVisible);
  const findReplaceVisible = useEditorStore((s) => s.findReplaceVisible);
  const unicodeHighlight = useEditorStore((s) => s.unicodeHighlight);
  const fontSize = useEditorStore((s) => s.fontSize);
  const previewVisible = useEditorStore((s) => s.previewVisible);
  const splitMode = useEditorStore((s) => s.splitMode);
  const projectPath = useEditorStore((s) => s.projectPath);
  const largeFileOptimize = useEditorStore((s) => s.largeFileOptimize);
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId) || null);

  const setActiveTabId = useEditorStore((s) => s.setActiveTabId);
  const setActiveGroup1TabId = useEditorStore((s) => s.setActiveGroup1TabId);
  const setActiveGroup2TabId = useEditorStore((s) => s.setActiveGroup2TabId);
  const setTheme = useEditorStore((s) => s.setTheme);
  const setSidebarVisible = useEditorStore((s) => s.setSidebarVisible);
  const setFindReplaceVisible = useEditorStore((s) => s.setFindReplaceVisible);
  const setUnicodeHighlight = useEditorStore((s) => s.setUnicodeHighlight);
  const setFontSize = useEditorStore((s) => s.setFontSize);
  const setPreviewVisible = useEditorStore((s) => s.setPreviewVisible);
  const setSplitMode = useEditorStore((s) => s.setSplitMode);
  const setProjectPath = useEditorStore((s) => s.setProjectPath);
  const setLargeFileOptimize = useEditorStore((s) => s.setLargeFileOptimize);
  const setTabEncoding = useEditorStore((s) => s.setTabEncoding);
  const setTabLanguage = useEditorStore((s) => s.setTabLanguage);
  const createTab = useEditorStore((s) => s.createTab);
  const markTabDirty = useEditorStore((s) => s.markTabDirty);
  const closeTab = useEditorStore((s) => s.closeTab);
  const closeTabs = useEditorStore((s) => s.closeTabs);
  const markTabSaved = useEditorStore((s) => s.markTabSaved);
  const renameTab = useEditorStore((s) => s.renameTab);
  const moveTabToGroup = useEditorStore((s) => s.moveTabToGroup);

  const openFile = useFileOpener();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SIDEBAR_WIDTH = 220;

  // Auto-disable split when less than 2 tabs
  useEffect(() => {
    if (splitMode && tabs.length < 2) {
      setSplitMode(false);
    }
  }, [tabs.length, splitMode, setSplitMode]);

  // Show window after paint completes to avoid blank screen
  useEffect(() => {
    if (!isTauri()) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        getCurrentWindow().show().catch(() => {});
      });
    });
  }, []);

  // Listen for file open events from backend (single instance / file association)
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<string>('open-file', (event) => {
        openFile(event.payload);
      });
    };

    setupListener();

    invoke<string[]>('get_pending_files')
      .then((files) => {
        for (const filePath of files) {
          openFile(filePath);
        }
      })
      .catch((err) => {
        console.error('Failed to get pending files:', err);
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [openFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            handleNewFile();
            break;
          case 'o':
            e.preventDefault();
            handleOpenFile();
            break;
          case 's':
            e.preventDefault();
            handleSaveFile();
            break;
          case 'f':
            e.preventDefault();
            setFindReplaceVisible(!findReplaceVisible);
            break;
        }
      }
      // Format document shortcut
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFormat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [findReplaceVisible, setFindReplaceVisible]);

  const handleNewFile = useCallback(() => {
    const group = activeTab?.group || 1;
    createTab('Untitled', undefined, undefined, group);
  }, [createTab, activeTab]);

  const handleNewFileInGroup = useCallback((group: 1 | 2) => {
    createTab('Untitled', undefined, undefined, group);
  }, [createTab]);

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const filePromises: Promise<void>[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = (file as any).path as string | undefined || file.name;
        const fileName = file.name;

        filePromises.push((async () => {
          try {
            if (isTauri() && filePath) {
              await openFile(filePath);
            } else {
              const text = await file.text();
              const currentTabs = useEditorStore.getState().tabs;
              const existing = currentTabs.find((t) => t.title === fileName);
              if (existing) {
                setActiveTabId(existing.id);
                updateEditorContent(existing.id, text);
              } else {
                createTab(fileName, undefined, undefined, 1, 'UTF-8', text);
              }
            }
          } catch (err) {
            console.error('Failed to read file:', fileName, err);
            if (isTauri() && filePath) {
              alert(`无法读取文件: ${fileName}`);
            }
          }
        })());
      }

      await Promise.all(filePromises);
      e.target.value = '';
    },
    [openFile, setActiveTabId, createTab]
  );

  const handleSaveFile = useCallback(async () => {
    if (!activeTab) return;

    try {
      if (isTauri() && activeTab.filePath) {
        const content = getEditorContent(activeTab.id);
        await invoke('write_file_with_encoding', {
          path: activeTab.filePath,
          content,
          encoding: activeTab.encoding,
        });
        markTabSaved(activeTab.id);
        return;
      }

      if ('showSaveFilePicker' in window) {
        const pickerOpts = {
          suggestedName: activeTab.title,
          types: [
            {
              description: 'Text Files',
              accept: { 'text/plain': ['.txt', '.md', '.js', '.ts', '.html', '.css', '.json', '.py', '.rs'] },
            },
          ],
        };
        // @ts-ignore
        const handle = await window.showSaveFilePicker(pickerOpts);
        const writable = await handle.createWritable();
        await writable.write(getEditorContent(activeTab.id));
        await writable.close();
        markTabSaved(activeTab.id);
        renameTab(activeTab.id, handle.name);
      } else {
        const blob = new Blob([getEditorContent(activeTab.id)], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeTab.title;
        a.click();
        URL.revokeObjectURL(url);
        markTabSaved(activeTab.id);
      }
    } catch (err) {
      console.log('Save cancelled or failed', err);
    }
  }, [activeTab, markTabSaved, renameTab]);

  const handleOpenFolder = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const selected = await open({ directory: true });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setProjectPath(path);
      }
    } catch (err) {
      console.error('[OpenFolder] failed:', err);
    }
  }, [setProjectPath]);

  const handleSidebarOpenFile = useCallback(
    async (filePath: string) => {
      if (!isTauri()) return;
      await openFile(filePath);
    },
    [openFile]
  );

  const handleTabClick = useCallback((id: string, group: 1 | 2) => {
    if (group === 1) {
      setActiveGroup1TabId(id);
    } else {
      setActiveGroup2TabId(id);
    }
    setActiveTabId(id);
  }, [setActiveGroup1TabId, setActiveGroup2TabId, setActiveTabId]);

  const handleTabClose = useCallback((id: string) => {
    closeTab(id);
  }, [closeTab]);

  const handleCloseTabs = useCallback((ids: string[]) => {
    closeTabs(ids);
  }, [closeTabs]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      if (prev === 'vs') return 'vs-dark';
      if (prev === 'vs-dark') return 'hc-black';
      return 'vs';
    });
  }, [setTheme]);

  const handleEditorChange = useCallback(
    (tabId: string) => () => {
      markTabDirty(tabId, true);
    },
    [markTabDirty]
  );

  const handleEncodingChange = useCallback(
    async (enc: Encoding) => {
      if (!activeTab) return;
      const tabId = activeTab.id;
      const filePath = activeTab.filePath;
      setTabEncoding(tabId, enc);

      if (isTauri() && filePath) {
        try {
          const text = await invoke<string>('read_file_with_encoding', {
            path: filePath,
            encoding: enc,
          });
          updateEditorContent(tabId, text);
        } catch (err) {
          console.error('[EncodingChange] failed to re-read file with encoding:', enc, err);
        }
      }
    },
    [activeTab, setTabEncoding]
  );

  const isDark = theme === 'vs-dark' || theme === 'hc-black';

  // Handle file drop using Tauri native drag-drop events
  useEffect(() => {
    if (!isTauri()) return;

    let processing = false;
    const p1 = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        if (processing) return;
        processing = true;
        setTimeout(() => { processing = false; }, 500);
        for (const filePath of event.payload.paths) {
          invoke<{ text: string; encoding: string }>('read_file_auto_detect', { path: filePath })
            .then((result) => {
              openFile(filePath, { text: result.text, encoding: result.encoding });
            })
            .catch((err) => {
              console.error('Failed to read dropped file:', filePath, err);
            });
        }
      }
    });

    return () => {
      p1.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [openFile]);

  // Window close confirmation (Tauri + browser)
  useEffect(() => {
    const getStore = useEditorStore.getState;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (getStore().tabs.some((t) => t.isDirty)) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    let tauriUnlisten: (() => void) | undefined;
    if (isTauri()) {
      getCurrentWindow().onCloseRequested((event) => {
        const dirtyTabs = getStore().tabs.filter((t) => t.isDirty);
        if (dirtyTabs.length > 0) {
          const names = dirtyTabs.map((t) => `"${t.title}"`).join(', ');
          event.preventDefault();
          confirm(`${names} 有未保存的更改，确定要退出吗？`, { title: '未保存的更改' }).then((ok) => {
            if (ok) {
              getCurrentWindow().destroy();
            }
          }).catch(() => {});
        }
      }).then((unlisten) => { tauriUnlisten = unlisten; }).catch(() => {});
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (tauriUnlisten) tauriUnlisten();
    };
  }, []);

  // Browser fallback: HTML5 Drag and Drop
  useEffect(() => {
    if (isTauri()) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;

        try {
          const text = await file.text();
          const existing = tabs.find((t) => t.title === fileName);
          if (existing) {
            setActiveTabId(existing.id);
            updateEditorContent(existing.id, text);
          } else {
            createTab(fileName, undefined, undefined, 1, 'UTF-8', text);
          }
        } catch (err) {
          console.error('Failed to read dropped file:', fileName, err);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [tabs, setActiveTabId, createTab]);

  const handleRegisterDefaultApp = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const result = await invoke<string>('register_as_default_app');
      alert(result);
    } catch (err) {
      alert(String(err));
    }
  }, []);

  const canFormat = activeTab
    ? ['json', 'xml', 'html', 'css', 'javascript', 'typescript', 'markdown', 'sql', 'yaml', 'ini'].includes(activeTab.language)
    : false;

  const handleFormat = useCallback(() => {
    if (!activeTab) return;
    const view = getActiveView(activeTab.id);
    if (!view) return;
    const ok = formatDocument(view, activeTab.language);
    if (ok) {
      markTabDirty(activeTab.id, true);
    }
  }, [activeTab, markTabDirty]);

  const group1Tab = tabs.find((t) => t.id === activeGroup1TabId);
  const canPreview = group1Tab?.language === 'markdown';
  const canSplit = tabs.length >= 2;

  const handleToggleSplit = useCallback(() => {
    setSplitMode(!splitMode);
  }, [splitMode, setSplitMode]);

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'dark' : ''}`}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
        accept=".txt,.md,.js,.jsx,.mjs,.cjs,.ts,.tsx,.mts,.cts,.html,.htm,.xhtml,.css,.scss,.sass,.less,.json,.jsonc,.json5,.py,.pyw,.java,.cpp,.cc,.cxx,.c,.h,.hpp,.cs,.rs,.go,.mdx,.yml,.yaml,.xml,.svg,.wsdl,.xsd,.xsl,.xslt,.sql,.mysql,.pgsql,.sqlite,.ini,.cfg,.inf,.csv,.tsv,.env,.properties,.log,.sh,.bash,.zsh"
      />

      <Toolbar
        onNewFile={handleNewFile}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onSaveFile={handleSaveFile}
        onToggleFindReplace={() => setFindReplaceVisible(!findReplaceVisible)}
        onToggleTheme={handleToggleTheme}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        onFormat={handleFormat}
        onTogglePreview={() => setPreviewVisible(!previewVisible)}
        onToggleSplit={handleToggleSplit}
        canFormat={canFormat}
        canPreview={canPreview}
        previewActive={previewVisible}
        canSplit={canSplit}
        splitActive={splitMode}
        theme={theme}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          visible={sidebarVisible}
          width={SIDEBAR_WIDTH}
          unicodeHighlight={unicodeHighlight}
          onToggleUnicodeHighlight={() => setUnicodeHighlight(!unicodeHighlight)}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          largeFileOptimize={largeFileOptimize}
          onToggleLargeFileOptimize={() => setLargeFileOptimize(!largeFileOptimize)}
          projectPath={projectPath}
          onProjectChange={setProjectPath}
          onOpenFolder={handleOpenFolder}
          openTabs={tabs}
          onOpenFile={handleSidebarOpenFile}
          onRegisterDefaultApp={handleRegisterDefaultApp}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            activeGroup1TabId={activeGroup1TabId}
            activeGroup2TabId={activeGroup2TabId}
            splitMode={splitMode}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewFile={handleNewFile}
            onNewFileInGroup={handleNewFileInGroup}
            onMoveTabToGroup={moveTabToGroup}
            onCloseTabs={handleCloseTabs}
          />

          <FindReplace
            visible={findReplaceVisible}
            onClose={() => setFindReplaceVisible(false)}
          />

          <div className="flex flex-1 overflow-hidden">
            {group1Tab ? (
              <>
                <div className={`h-full ${splitMode || (previewVisible && canPreview) ? 'w-1/2' : 'w-full'}`}>
                  <CmEditor
                    tabId={group1Tab.id}
                    language={group1Tab.language as any}
                    theme={theme}
                    onChange={handleEditorChange(group1Tab.id)}
                    fontSize={fontSize}
                    initialContent={group1Tab.initialContent || ''}
                  />
                </div>
                {splitMode && (
                  <>
                    <div className="w-px bg-gray-200 dark:bg-gray-800 self-stretch" />
                    <div className="w-1/2 h-full">
                      {activeGroup2TabId ? (
                        <CmEditor
                          tabId={activeGroup2TabId}
                          language={tabs.find((t) => t.id === activeGroup2TabId)?.language as any}
                          theme={theme}
                          onChange={handleEditorChange(activeGroup2TabId)}
                          fontSize={fontSize}
                          initialContent={tabs.find((t) => t.id === activeGroup2TabId)?.initialContent || ''}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 bg-white dark:bg-gray-900">
                          <p className="text-sm">选择标签页开始编辑</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {previewVisible && canPreview && (
                  <>
                    <div className="w-px bg-gray-200 dark:bg-gray-800 self-stretch" />
                    <div className="w-1/2 h-full">
                      <MarkdownPreview tabId={group1Tab.id} theme={theme} />
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600 bg-white dark:bg-gray-900">
                <div className="text-center">
                  <p className="text-lg mb-2">没有打开的文件</p>
                  <p className="text-sm">点击"新建"或"打开"开始编辑</p>
                </div>
              </div>
            )}
          </div>

          <StatusBar
            activeTab={activeTab}
            theme={theme}
            onEncodingChange={handleEncodingChange}
            onLanguageChange={(lang) => {
              if (activeTab) {
                setTabLanguage(activeTab.id, lang);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
