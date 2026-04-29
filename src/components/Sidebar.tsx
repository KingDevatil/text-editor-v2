import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileText, Settings, ChevronRight, ChevronDown, Folder, FolderOpen, RotateCcw, FolderOpenIcon, Star, HelpCircle, Palette } from 'lucide-react';
import ThemeEditor from './ThemeEditor';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry, EditorTab } from '../types';

interface SidebarProps {
  visible: boolean;
  width: number;
  unicodeHighlight: boolean;
  onToggleUnicodeHighlight: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  largeFileOptimize: boolean;
  onToggleLargeFileOptimize: () => void;
  minimapVisible: boolean;
  onToggleMinimap: () => void;
  wordWrap: boolean;
  onToggleWordWrap: () => void;
  projectPath: string | null;
  onProjectChange: (path: string | null) => void;
  onOpenFolder: () => void;
  openTabs: EditorTab[];
  onOpenFile: (filePath: string) => void;
  onRegisterDefaultApp?: () => void;
  onOpenHelp?: () => void;
}

interface TreeNodeProps {
  entry: DirEntry;
  depth: number;
  expandedDirs: Set<string>;
  dirCache: Map<string, DirEntry[]>;
  openFilePaths: Set<string>;
  onToggleDir: (path: string) => void;
  onOpenFile: (filePath: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  entry,
  depth,
  expandedDirs,
  dirCache,
  openFilePaths,
  onToggleDir,
  onOpenFile,
}) => {
  const isExpanded = expandedDirs.has(entry.path);
  const children = dirCache.get(entry.path) || [];
  const paddingLeft = 8 + depth * 14;

  if (entry.is_dir) {
    return (
      <div>
        <div
          className="flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer transition-colors hover:bg-[var(--te-bg-tertiary)] text-[var(--te-text-primary)]"
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => onToggleDir(entry.path)}
        >
          {isExpanded ? (
            <ChevronDown size={14} className="text-[var(--te-text-secondary)] shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-[var(--te-text-secondary)] shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen size={14} className="text-amber-500 shrink-0" />
          ) : (
            <Folder size={14} className="text-amber-500 shrink-0" />
          )}
          <span className="text-sm truncate select-none">{entry.name}</span>
        </div>
        {isExpanded && (
          <div>
            {children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                dirCache={dirCache}
                openFilePaths={openFilePaths}
                onToggleDir={onToggleDir}
                onOpenFile={onOpenFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isOpen = openFilePaths.has(entry.path);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer transition-colors text-[var(--te-text-primary)] ${
        isOpen
          ? 'bg-[color-mix(in_srgb,var(--te-primary)_10%,transparent)] text-[var(--te-primary)]'
          : 'hover:bg-[var(--te-bg-tertiary)]'
      }`}
      style={{ paddingLeft: `${paddingLeft + 18}px` }}
      onClick={() => onOpenFile(entry.path)}
      title={entry.path}
    >
      <FileText size={13} className="text-[var(--te-text-secondary)] shrink-0" />
      <span className="text-sm truncate select-none">{entry.name}</span>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = React.memo(({
  visible,
  width,
  unicodeHighlight,
  onToggleUnicodeHighlight,
  fontSize,
  onFontSizeChange,
  largeFileOptimize,
  onToggleLargeFileOptimize,
  minimapVisible,
  onToggleMinimap,
  wordWrap,
  onToggleWordWrap,
  projectPath,
  onProjectChange,
  onOpenFolder,
  openTabs,
  onOpenFile,
  onRegisterDefaultApp,
  onOpenHelp,
}) => {
  const [activeSection, setActiveSection] = useState<'files' | 'settings'>('files');
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirCache, setDirCache] = useState<Map<string, DirEntry[]>>(new Map());

  const openFilePaths = useMemo(() => {
    return new Set(openTabs.map((t) => t.filePath).filter(Boolean) as string[]);
  }, [openTabs]);

  const loadDirectory = useCallback(async (path: string) => {
    try {
      const entries = await invoke<DirEntry[]>('list_directory', { path });
      setDirCache((prev) => {
        const next = new Map(prev);
        next.set(path, entries);
        return next;
      });
    } catch (err) {
      console.error('Failed to list directory:', path, err);
    }
  }, []);

  const handleToggleDir = useCallback(
    async (path: string) => {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
      // Load children if not cached
      if (!dirCache.has(path)) {
        await loadDirectory(path);
      }
    },
    [dirCache, loadDirectory]
  );

  // Auto-load root directory when project changes
  useEffect(() => {
    if (projectPath) {
      queueMicrotask(() => {
        setExpandedDirs(new Set([projectPath]));
        setDirCache(new Map());
        loadDirectory(projectPath);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  const handleCloseFolder = useCallback(() => {
    onProjectChange(null);
    setExpandedDirs(new Set());
    setDirCache(new Map());
  }, [onProjectChange]);

  const handleRefresh = useCallback(async () => {
    if (!projectPath) return;
    // Refresh all expanded directories
    const toRefresh = [projectPath, ...Array.from(expandedDirs)];
    for (const path of toRefresh) {
      await loadDirectory(path);
    }
  }, [projectPath, expandedDirs, loadDirectory]);

  if (!visible) return null;

  const sectionBtnClass = (active: boolean) =>
    `relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
      active ? '' : 'hover:text-[var(--te-text-primary)]'
    }`;

  const rootEntries = projectPath ? dirCache.get(projectPath) || [] : [];

  return (
    <div
      className="flex flex-col border-r"
      style={{ width: `${width}px`, minWidth: `${width}px`, backgroundColor: 'var(--te-bg-secondary)', borderColor: 'var(--te-border)' }}
    >
      <div className="flex items-center border-b relative" style={{ borderColor: 'var(--te-border)' }}>
        <button
          onClick={() => setActiveSection('files')}
          className={sectionBtnClass(activeSection === 'files')}
          style={{ color: activeSection === 'files' ? 'var(--te-primary)' : 'var(--te-text-secondary)' }}
        >
          <FolderOpen size={14} />
          文件
        </button>
        <button
          onClick={() => setActiveSection('settings')}
          className={sectionBtnClass(activeSection === 'settings')}
          style={{ color: activeSection === 'settings' ? 'var(--te-primary)' : 'var(--te-text-secondary)' }}
        >
          <Settings size={14} />
          设置
        </button>
        <div
          className="absolute bottom-0 h-0.5 rounded-full transition-all duration-200"
          style={{
            width: '50%',
            left: activeSection === 'files' ? '0%' : '50%',
            backgroundColor: 'var(--te-primary)',
          }}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {activeSection === 'files' && (
          <div className="text-sm">
            {/* Project header */}
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--te-border)' }}>
              {projectPath ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <FolderOpenIcon size={14} className="text-amber-500 shrink-0" />
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--te-text-secondary)' }} title={projectPath}>
                      {projectPath.split(/[\\/]/).pop() || projectPath}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={onOpenFolder}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded border transition-colors hover:bg-[var(--te-bg-secondary)]"
                      style={{ backgroundColor: 'var(--te-bg-tertiary)', borderColor: 'var(--te-border)', color: 'var(--te-text-primary)' }}
                      title="打开其他文件夹"
                    >
                      <FolderOpenIcon size={10} />
                      打开
                    </button>
                    <button
                      onClick={handleRefresh}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded border transition-colors hover:bg-[var(--te-bg-secondary)]"
                      style={{ backgroundColor: 'var(--te-bg-tertiary)', borderColor: 'var(--te-border)', color: 'var(--te-text-primary)' }}
                    >
                      <RotateCcw size={10} />
                      刷新
                    </button>
                    <button
                      onClick={handleCloseFolder}
                      className="flex-1 px-2 py-1 text-[10px] rounded border transition-colors hover:bg-[var(--te-bg-secondary)]"
                      style={{ backgroundColor: 'var(--te-bg-tertiary)', borderColor: 'var(--te-border)', color: 'var(--te-text-primary)' }}
                    >
                      关闭
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={onOpenFolder}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors font-medium"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--te-primary) 10%, transparent)', color: 'var(--te-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--te-primary) 15%, transparent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--te-primary) 10%, transparent)'; }}
                >
                  <FolderOpenIcon size={14} />
                  打开文件夹
                </button>
              )}
            </div>

            {/* File tree */}
            <div className="p-1.5">
              {projectPath ? (
                rootEntries.length > 0 ? (
                  rootEntries.map((entry) => (
                    <TreeNode
                      key={entry.path}
                      entry={entry}
                      depth={0}
                      expandedDirs={expandedDirs}
                      dirCache={dirCache}
                      openFilePaths={openFilePaths}
                      onToggleDir={handleToggleDir}
                      onOpenFile={onOpenFile}
                    />
                  ))
                ) : (
                  <div className="text-center py-4 text-xs" style={{ color: 'var(--te-text-secondary)' }}>
                    空文件夹
                  </div>
                )
              ) : (
                <div className="text-center py-8 px-3">
                  <Folder size={32} className="mx-auto mb-2" style={{ color: 'color-mix(in srgb, var(--te-text-secondary) 50%, transparent)' }} />
                  <p className="text-xs" style={{ color: 'var(--te-text-secondary)' }}>
                    打开一个文件夹<br />开始浏览项目文件
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="space-y-4 text-sm p-3" style={{ color: 'var(--te-text-primary)' }}>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--te-text-secondary)' }}>
                编辑器设置
              </label>
              <div className="space-y-2.5 rounded-lg p-3 border" style={{ backgroundColor: 'var(--te-bg-tertiary)', borderColor: 'var(--te-border)' }}>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-[var(--te-text-primary)] transition-colors">全角半角检测</span>
                  <input
                    type="checkbox"
                    checked={unicodeHighlight}
                    onChange={onToggleUnicodeHighlight}
                    className="rounded border-[var(--te-border)] text-[var(--te-primary)] focus:ring-[var(--te-primary)]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-[var(--te-text-primary)] transition-colors">显示行号</span>
                  <input type="checkbox" defaultChecked className="rounded border-[var(--te-border)] text-[var(--te-primary)] focus:ring-[var(--te-primary)]" />
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-[var(--te-text-primary)] transition-colors">自动换行</span>
                  <input
                    type="checkbox"
                    checked={wordWrap}
                    onChange={onToggleWordWrap}
                    className="rounded border-[var(--te-border)] text-[var(--te-primary)] focus:ring-[var(--te-primary)]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-[var(--te-text-primary)] transition-colors">迷你地图</span>
                  <input
                    type="checkbox"
                    checked={minimapVisible}
                    onChange={onToggleMinimap}
                    className="rounded border-[var(--te-border)] text-[var(--te-primary)] focus:ring-[var(--te-primary)]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer group" title="打开大文件时自动禁用高亮、折叠等功能以提升性能">
                  <span className="text-sm text-[var(--te-text-primary)] transition-colors">大文件性能优化</span>
                  <input
                    type="checkbox"
                    checked={largeFileOptimize}
                    onChange={onToggleLargeFileOptimize}
                    className="rounded border-[var(--te-border)] text-[var(--te-primary)] focus:ring-[var(--te-primary)]"
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--te-text-secondary)' }}>
                应用设置
              </label>
              <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--te-bg-tertiary)', borderColor: 'var(--te-border)' }}>
                <button
                  onClick={onRegisterDefaultApp}
                  disabled={!onRegisterDefaultApp}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--te-primary) 10%, transparent)', color: 'var(--te-primary)' }}
                  onMouseEnter={(e) => { if (!onRegisterDefaultApp) return; e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--te-primary) 15%, transparent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--te-primary) 10%, transparent)'; }}
                >
                  <Star size={14} />
                  设为默认文本编辑器
                </button>
                <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--te-text-secondary)' }}>
                  注册为 .txt、.md、.js 等文件类型的默认打开方式
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--te-text-secondary)' }}>
                字体大小
              </label>
              <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--te-bg-tertiary)', borderColor: 'var(--te-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--te-text-primary)]">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={fontSize}
                  onChange={(e) => onFontSizeChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--te-text-secondary)' }}>
                主题外观
              </label>
              <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--te-bg-tertiary)', borderColor: 'var(--te-border)' }}>
                <button
                  onClick={() => setShowThemeEditor(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors font-medium hover:bg-[var(--te-bg-secondary)]"
                  style={{ backgroundColor: 'var(--te-bg-tertiary)', color: 'var(--te-text-primary)' }}
                >
                  <Palette size={14} />
                  编辑主题颜色
                </button>
                <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--te-text-secondary)' }}>
                  自定义亮色、暗色和独立主题的颜色配置
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--te-text-secondary)' }}>
                帮助
              </label>
              <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--te-bg-tertiary)', borderColor: 'var(--te-border)' }}>
                <button
                  onClick={onOpenHelp}
                  disabled={!onOpenHelp}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--te-bg-secondary)]"
                  style={{ backgroundColor: 'var(--te-bg-tertiary)', color: 'var(--te-text-primary)' }}
                >
                  <HelpCircle size={14} />
                  使用说明
                </button>
                <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--te-text-secondary)' }}>
                  查看编辑器快捷键与功能说明
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      {showThemeEditor && <ThemeEditor onClose={() => setShowThemeEditor(false)} />}
    </div>
  );
});

export default Sidebar;
Sidebar.displayName = 'Sidebar';
