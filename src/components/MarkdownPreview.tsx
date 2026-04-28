import React, { useState, useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import { getEditorContent } from '../hooks/useEditorStatePool';

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

  const deferredContent = React.useDeferredValue(content);
  const html = useMemo(() => {
    return marked.parse(deferredContent, { async: false }) as string;
  }, [deferredContent]);

  const isDark = theme === 'vs-dark';

  return (
    <div
      className="w-full h-full overflow-auto px-6 py-6"
      style={{
        backgroundColor: isDark ? '#0d1117' : '#ffffff',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
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
