import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { invoke, isTauri } from '@tauri-apps/api/core';

interface TitleBarProps {
  title?: string;
  isDark?: boolean;
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'Text Editor', isDark = false }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const check = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const w = getCurrentWindow();
        const max = await w.isMaximized();
        setIsMaximized(max);
      } catch {
        // ignore
      }
    };
    check();
  }, []);

  const handleMinimize = async () => {
    if (!isTauri()) return;
    try {
      await invoke('window_minimize');
    } catch (err) {
      console.error('[TitleBar] minimize failed:', err);
    }
  };

  const handleMaximize = async () => {
    if (!isTauri()) return;
    try {
      const result = await invoke<boolean>('window_maximize');
      setIsMaximized(result);
    } catch (err) {
      console.error('[TitleBar] maximize failed:', err);
    }
  };

  const handleClose = async () => {
    if (!isTauri()) return;
    try {
      await invoke('window_close');
    } catch (err) {
      console.error('[TitleBar] close failed:', err);
    }
  };

  const bgClass = isDark
    ? 'bg-gray-900 border-b border-gray-700/80'
    : 'bg-gray-50 border-b border-gray-200';

  const textClass = isDark ? 'text-gray-300' : 'text-gray-700';
  const btnHover = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200';
  const closeHover = isDark ? 'hover:bg-red-600' : 'hover:bg-red-500 hover:text-white';

  return (
    <div
      data-tauri-drag-region
      className={`relative flex items-center h-8 select-none shrink-0 ${bgClass}`}
    >
      {/* Left spacer — same width as right controls so title truly centers */}
      <div className="w-[120px] shrink-0" />

      {/* Drag region — title */}
      <div data-tauri-drag-region className="flex-1 flex items-center justify-center h-full px-2 overflow-hidden">
        <span className={`text-xs font-medium truncate ${textClass}`}>
          {title}
        </span>
      </div>

      {/* Window controls */}
      <div className="flex items-center justify-end h-full w-[120px] shrink-0">
        <button
          onClick={handleMinimize}
          className={`flex items-center justify-center w-10 h-full transition-colors ${btnHover} ${textClass}`}
          title="最小化"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className={`flex items-center justify-center w-10 h-full transition-colors ${btnHover} ${textClass}`}
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? <Maximize2 size={12} /> : <Square size={12} />}
        </button>
        <button
          onClick={handleClose}
          className={`flex items-center justify-center w-10 h-full transition-colors ${closeHover} ${textClass}`}
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(TitleBar);
