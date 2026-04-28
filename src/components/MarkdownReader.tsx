import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { marked } from 'marked';
import {
  X,
  Type,
  List,
  Moon,
  Sun,
  ChevronUp,
  Maximize2,
} from 'lucide-react';
import { getEditorContent } from '../hooks/useEditorStatePool';
import type { EditorTheme } from '../utils/themes';

interface MarkdownReaderProps {
  tabId: string;
  theme: EditorTheme;
  onExit: () => void;
  onToggleTheme: () => void;
}

interface TocItem {
  level: number;
  text: string;
  id: string;
}

const MarkdownReader: React.FC<MarkdownReaderProps> = React.memo(({
  tabId,
  theme,
  onExit,
  onToggleTheme,
}) => {
  const [content, setContent] = useState('');
  const [readerFontSize, setReaderFontSize] = useState(16);
  const [tocVisible, setTocVisible] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastContentRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Poll content changes
  useEffect(() => {
    const poll = () => {
      const current = getEditorContent(tabId);
      if (current !== lastContentRef.current) {
        lastContentRef.current = current;
        setContent(current);
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [tabId]);

  const deferredContent = React.useDeferredValue(content);

  const { html, toc } = useMemo(() => {
    const raw = marked.parse(deferredContent, { async: false }) as string;

    // Extract TOC from headings
    const items: TocItem[] = [];
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    let match;
    while ((match = headingRegex.exec(raw)) !== null) {
      const level = parseInt(match[1], 10);
      const text = match[2].replace(/<[^>]+>/g, '');
      const id = `heading-${items.length}`;
      items.push({ level, text, id });
    }

    // Inject IDs into HTML
    let idx = 0;
    const htmlWithIds = raw.replace(/<h([1-6])([^>]*)>/gi, (_m, level, attrs) => {
      const id = `heading-${idx++}`;
      return `<h${level}${attrs} id="${id}">`;
    });

    return { html: htmlWithIds, toc: items };
  }, [deferredContent]);

  // Scroll tracking
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollTop(el.scrollTop > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el && scrollRef.current) {
      const top = el.offsetTop - 24;
      scrollRef.current.scrollTo({ top, behavior: 'smooth' });
    }
    setTocVisible(false);
  }, []);

  // Keyboard: ESC to exit
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit]);

  const isDark = theme === 'vs-dark';

  const bgColor = isDark ? '#0d1117' : '#ffffff';
  const textColor = isDark ? '#a0aab4' : '#24292f';
  const proseInvert = isDark ? 'prose-invert' : '';

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col"
      style={{ backgroundColor: bgColor }}
    >
      {/* Floating top bar */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-gray-200/10 dark:border-gray-700/30"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300"
            title="退出阅读模式 (ESC)"
          >
            <X size={16} />
            <span className="hidden sm:inline">退出阅读</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* TOC toggle */}
          <button
            onClick={() => setTocVisible(!tocVisible)}
            className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-lg transition-all hover:bg-black/5 dark:hover:bg-white/10 ${tocVisible ? 'bg-black/5 dark:bg-white/10' : ''}`}
            title="目录"
            style={{ color: textColor }}
          >
            <List size={16} />
          </button>

          {/* Font size */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setReaderFontSize((s) => Math.max(12, s - 1))}
              className="px-2 py-1.5 rounded-lg transition-all hover:bg-black/5 dark:hover:bg-white/10"
              title="减小字号"
              style={{ color: textColor }}
            >
              <Type size={14} />
            </button>
            <span className="text-xs w-6 text-center tabular-nums" style={{ color: textColor }}>
              {readerFontSize}
            </span>
            <button
              onClick={() => setReaderFontSize((s) => Math.min(24, s + 1))}
              className="px-2 py-1.5 rounded-lg transition-all hover:bg-black/5 dark:hover:bg-white/10"
              title="增大字号"
              style={{ color: textColor }}
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Theme */}
          <button
            onClick={onToggleTheme}
            className="px-2 py-1.5 rounded-lg transition-all hover:bg-black/5 dark:hover:bg-white/10"
            title="切换主题"
            style={{ color: textColor }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* TOC sidebar overlay */}
      {tocVisible && toc.length > 0 && (
        <div className="absolute left-0 top-12 bottom-0 w-64 z-40 border-r border-gray-200/10 dark:border-gray-700/30 overflow-auto"
          style={{ backgroundColor: bgColor }}
        >
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: textColor }}>目录</h3>
            <nav className="space-y-1">
              {toc.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToHeading(item.id)}
                  className="block w-full text-left text-sm rounded-md px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10 truncate"
                  style={{
                    color: textColor,
                    paddingLeft: `${(item.level - 1) * 12 + 8}px`,
                    opacity: item.level === 1 ? 1 : 0.75,
                    fontWeight: item.level === 1 ? 500 : 400,
                  }}
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div className="mx-auto px-6 py-10 max-w-3xl">
          <div
            className={`prose ${proseInvert} max-w-none reader-prose`}
            style={{
              color: textColor,
              fontSize: `${readerFontSize}px`,
              lineHeight: '1.8',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="absolute bottom-6 right-6 p-2 rounded-full shadow-lg transition-all hover:scale-110 z-40"
          style={{
            backgroundColor: isDark ? '#30363d' : '#ffffff',
            color: isDark ? '#a0aab4' : '#24292f',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}
          title="回到顶部"
        >
          <ChevronUp size={20} />
        </button>
      )}
    </div>
  );
});

MarkdownReader.displayName = 'MarkdownReader';

export default MarkdownReader;
