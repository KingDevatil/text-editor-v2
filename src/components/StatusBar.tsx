import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FileType, ChevronUp } from 'lucide-react';
import * as monaco from 'monaco-editor';
import type { EditorTab, Encoding } from '../types';

interface StatusBarProps {
  activeTab: EditorTab | null;
  theme: string;
  onEncodingChange?: (encoding: Encoding) => void;
  onLanguageChange?: (language: string) => void;
}

const ENCODINGS: Encoding[] = [
  'UTF-8',
  'UTF-8 BOM',
  'ANSI',
  'GBK',
  'GB2312',
  'GB18030',
  'BIG5',
  'Shift-JIS',
  'EUC-KR',
  'ISO-8859-1',
  'Windows-1252',
];

const LANGUAGES = [
  { id: 'plaintext', label: 'Plain Text' },
  { id: 'json', label: 'JSON' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'xml', label: 'XML' },
  { id: 'yaml', label: 'YAML' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
  { id: 'ini', label: 'INI' },
  { id: 'log', label: 'Log' },
  { id: 'shell', label: 'Shell' },
];

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, onClose]);
}

const StatusBar: React.FC<StatusBarProps> = React.memo(({ activeTab, theme, onEncodingChange, onLanguageChange }) => {
  const [wordCount, setWordCount] = useState(0);
  const [calculating, setCalculating] = useState(false);

  // O(1) quick stats - immediately available, no blocking
  const quickStats = useMemo(() => {
    if (!activeTab) return { lineCount: 0, charCount: 0 };
    const model = monaco.editor.getModel(monaco.Uri.parse(activeTab.modelUri));
    if (!model) return { lineCount: 0, charCount: 0 };
    return {
      lineCount: model.getLineCount(),
      charCount: model.getValueLength(),
    };
  }, [activeTab?.modelUri]);

  // Async debounced word count - does not block UI
  // Re-calculates when tab changes or model content changes
  useEffect(() => {
    if (!activeTab) {
      setWordCount(0);
      setCalculating(false);
      return;
    }
    const model = monaco.editor.getModel(monaco.Uri.parse(activeTab.modelUri));
    if (!model) {
      setWordCount(0);
      setCalculating(false);
      return;
    }

    const isLarge = model.getValueLength() > 500 * 1024;
    if (isLarge) setCalculating(true);

    const doCount = () => {
      let count = 0;
      const lineCount = model.getLineCount();
      const limit = Math.min(lineCount, 100000);
      for (let i = 1; i <= limit; i++) {
        const line = model.getLineContent(i);
        // 字数 = 汉字 + 英文单词 + 数字串（标点、空格不计入）
        const matches = line.match(/[\u4e00-\u9fa5]|[a-zA-Z]+|[0-9]+/g);
        if (matches) {
          count += matches.length;
        }
      }
      setWordCount(count);
      setCalculating(false);
    };

    // Initial count
    const timer = setTimeout(doCount, isLarge ? 800 : 300);

    // Re-count on content change (debounced)
    let changeTimer: ReturnType<typeof setTimeout> | null = null;
    const disposable = model.onDidChangeContent(() => {
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(doCount, isLarge ? 800 : 300);
    });

    return () => {
      clearTimeout(timer);
      if (changeTimer) clearTimeout(changeTimer);
      disposable.dispose();
    };
  }, [activeTab?.modelUri]);

  const isDark = theme === 'vs-dark' || theme === 'hc-black';

  const [encOpen, setEncOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const encRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useClickOutside(encRef, () => setEncOpen(false));
  useClickOutside(langRef, () => setLangOpen(false));

  const itemClass = (isActive: boolean) =>
    `block w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
      isActive
        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-medium'
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;

  return (
    <div
      className={`flex items-center justify-between px-3 h-7 text-xs select-none relative border-t ${
        isDark
          ? 'bg-gray-900 border-gray-700 text-gray-300'
          : 'bg-gray-50 border-gray-200 text-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {activeTab && (
          <>
            {/* Language Mode Switcher */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => { setLangOpen(!langOpen); setEncOpen(false); }}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'
                }`}
                title="点击切换语言模式"
              >
                <FileType size={12} />
                <span className="font-medium">{activeTab.language.toUpperCase()}</span>
                <ChevronUp size={10} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>
              {langOpen && (
                <div
                  className={`absolute bottom-full left-0 mb-1 py-1.5 rounded-lg shadow-xl border z-50 min-w-[150px] max-h-64 overflow-auto ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => { onLanguageChange?.(lang.id); setLangOpen(false); }}
                      className={itemClass(activeTab.language === lang.id)}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              activeTab.isDirty
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            }`}>
              {activeTab.isDirty ? '已修改' : '已保存'}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {activeTab && (
          <>
            <span className="tabular-nums">行 {quickStats.lineCount}</span>
            <span className="tabular-nums">字符 {quickStats.charCount}</span>
            <span className="tabular-nums">字数 {calculating ? '...' : wordCount.toLocaleString()}</span>
          </>
        )}
        {/* Encoding Switcher */}
        <div className="relative" ref={encRef}>
          <button
            onClick={() => { setEncOpen(!encOpen); setLangOpen(false); }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'
            }`}
            title="点击切换编码"
          >
            <span className="font-medium">{activeTab?.encoding || 'UTF-8'}</span>
            <ChevronUp size={10} className={`transition-transform ${encOpen ? 'rotate-180' : ''}`} />
          </button>
          {encOpen && (
            <div
              className={`absolute bottom-full right-0 mb-1 py-1.5 rounded-lg shadow-xl border z-50 min-w-[150px] ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}
            >
              {ENCODINGS.map((enc) => (
                <button
                  key={enc}
                  onClick={() => { onEncodingChange?.(enc); setEncOpen(false); }}
                  className={itemClass(activeTab?.encoding === enc)}
                >
                  {enc}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default StatusBar;
StatusBar.displayName = 'StatusBar';
