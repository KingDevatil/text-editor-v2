import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FileType, ChevronUp } from 'lucide-react';
import type { EditorTab, Encoding } from '../types';
import { getEditorContent, getEditorLineCount, getEditorValueLength } from '../hooks/useEditorStatePool';

interface StatusBarProps {
  activeTab: EditorTab | null;
  theme: string;
  onEncodingChange?: (encoding: Encoding) => void;
  onLanguageChange?: (language: string) => void;
  wordWrap?: boolean;
  onToggleWordWrap?: () => void;
  showWhitespace?: boolean;
  onToggleShowWhitespace?: () => void;
  minimapVisible?: boolean;
  onToggleMinimap?: () => void;
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

function countWords(text: string): number {
  let count = 0;
  const lines = text.split('\n');
  const limit = Math.min(lines.length, 100000);
  for (let i = 0; i < limit; i++) {
    const matches = lines[i].match(/[\u4e00-\u9fa5]|[a-zA-Z]+|[0-9]+/g);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

const StatusBar: React.FC<StatusBarProps> = React.memo(({
  activeTab, theme, onEncodingChange, onLanguageChange,
  wordWrap, onToggleWordWrap, showWhitespace, onToggleShowWhitespace,
  minimapVisible, onToggleMinimap,
}) => {
  const [wordCount, setWordCount] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastContentRef = useRef('');

  // Quick stats from state pool
  const quickStats = useMemo(() => {
    if (!activeTab) return { lineCount: 0, charCount: 0 };
    return {
      lineCount: getEditorLineCount(activeTab.id),
      charCount: getEditorValueLength(activeTab.id),
    };
  }, [activeTab?.id]);

  // Async debounced word count via polling (CM6 has no model.onDidChangeContent)
  useEffect(() => {
    if (!activeTab) {
      setWordCount(0);
      setCalculating(false);
      return;
    }

    const poll = () => {
      const content = getEditorContent(activeTab.id);
      if (content !== lastContentRef.current) {
        lastContentRef.current = content;
        const isLarge = content.length > 500 * 1024;
        if (isLarge) setCalculating(true);

        // Defer heavy counting
        setTimeout(() => {
          setWordCount(countWords(content));
          setCalculating(false);
        }, isLarge ? 800 : 300);
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [activeTab?.id]);

  const isDark = theme === 'vs-dark';

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
        {activeTab && (
          <>
            <button
              onClick={onToggleWordWrap}
              className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer text-[10px] font-medium ${
                wordWrap
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
              }`}
              title="自动换行"
            >
              换行
            </button>
            <button
              onClick={onToggleShowWhitespace}
              className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer text-[10px] font-medium ${
                showWhitespace
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
              }`}
              title="显示空白字符"
            >
              空白
            </button>
            <button
              onClick={onToggleMinimap}
              className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer text-[10px] font-medium ${
                minimapVisible
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
              }`}
              title="代码缩略图"
            >
              缩略图
            </button>
          </>
        )}
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
