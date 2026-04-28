import React, { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import * as monaco from 'monaco-editor';

interface MarkdownPreviewProps {
  modelUri: string;
  theme: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = React.memo(({ modelUri, theme }) => {
  const [content, setContent] = useState('');

  // Listen to Monaco model content changes for real-time preview
  useEffect(() => {
    const model = monaco.editor.getModel(monaco.Uri.parse(modelUri));
    if (!model) {
      setContent('');
      return;
    }
    setContent(model.getValue());

    const disposable = model.onDidChangeContent(() => {
      setContent(model.getValue());
    });
    return () => disposable.dispose();
  }, [modelUri]);

  // Debounced markdown rendering using useDeferredValue
  const deferredContent = React.useDeferredValue(content);
  const html = useMemo(() => {
    return marked.parse(deferredContent, { async: false }) as string;
  }, [deferredContent]);

  const isDark = theme === 'vs-dark' || theme === 'hc-black';

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
        style={{ color: isDark ? '#c9d1d9' : '#24292f' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
});

export default MarkdownPreview;
MarkdownPreview.displayName = 'MarkdownPreview';
