import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { getEditorContent } from '../hooks/useEditorStatePool';
import { generateHeadingSlugs, slugify } from '../utils/slugify';

interface MarkdownPreviewProps {
  tabId: string;
  theme: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = React.memo(({ tabId, theme }) => {
  const [content, setContent] = useState('');
  const rafRef = useRef<number | null>(null);
  const lastContentRef = useRef('');

  // Poll content changes using requestAnimationFrame (cheap, stops when offscreen)
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

  const containerRef = useRef<HTMLDivElement>(null);
  const deferredContent = React.useDeferredValue(content);
  const html = useMemo(() => {
    const raw = marked.parse(deferredContent, { async: false }) as string;
    const { htmlWithIds } = generateHeadingSlugs(raw);
    return htmlWithIds;
  }, [deferredContent]);

  const isDark = theme === 'vs-dark';

  // Intercept anchor clicks inside the overflow container
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    e.preventDefault();
    const rawId = decodeURIComponent(href.slice(1));
    let el = document.getElementById(rawId);
    // Fallback: if the href contains punctuation that slugify strips,
    // try the slugified version.
    if (!el) {
      el = document.getElementById(slugify(rawId));
    }
    if (el && containerRef.current) {
      const top = (el as HTMLElement).offsetTop - 24;
      containerRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto px-6 py-6"
      style={{
        backgroundColor: isDark ? '#0d1117' : '#ffffff',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
      onClick={handleClick}
    >
      <div
        className={`prose max-w-none ${isDark ? 'prose-invert' : ''}`}
        style={{ color: isDark ? '#a0aab4' : '#24292f' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
});

export default MarkdownPreview;
MarkdownPreview.displayName = 'MarkdownPreview';
