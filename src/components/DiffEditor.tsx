import React, { useRef, useEffect } from 'react';
import { MergeView } from '@codemirror/merge';
import { history, historyKeymap } from '@codemirror/commands';
import { lineNumbers, keymap, EditorView } from '@codemirror/view';
import { getThemeExtension, syntaxHighlightExtension, type EditorTheme } from '../utils/themes';

interface DiffEditorProps {
  leftContent: string;
  rightContent: string;
  theme: EditorTheme;
}

const DiffEditor: React.FC<DiffEditorProps> = ({ leftContent, rightContent, theme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Destroy previous merge view if any
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
      mergeViewRef.current = null;
    }

    const baseExtensions = [
      history(),
      keymap.of(historyKeymap),
      lineNumbers(),
      syntaxHighlightExtension,
      getThemeExtension(theme),
      EditorView.editable.of(false),
    ];

    const mergeView = new MergeView({
      a: {
        doc: leftContent,
        extensions: baseExtensions,
      },
      b: {
        doc: rightContent,
        extensions: baseExtensions,
      },
      parent: container,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
    });

    mergeViewRef.current = mergeView;

    return () => {
      mergeView.destroy();
      mergeViewRef.current = null;
    };
  }, [leftContent, rightContent, theme]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto"
      style={{
        fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace',
      }}
    />
  );
};

export default React.memo(DiffEditor);
