import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, X, Replace, ReplaceAll, ChevronRight, ChevronLeft } from 'lucide-react';
import { SearchCursor } from '@codemirror/search';
import { useEditorStore } from '../hooks/useEditorStore';
import { getActiveView } from '../hooks/useEditorStatePool';

interface FindReplaceProps {
  visible: boolean;
  onClose: () => void;
}

const FindReplace: React.FC<FindReplaceProps> = ({ visible, onClose }) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  const activeTabId = useEditorStore((s) => s.activeTabId);

  useEffect(() => {
    if (visible && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [visible]);

  // Update match count whenever find text or case sensitivity changes
  useEffect(() => {
    if (!findText) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }
    const view = activeTabId ? getActiveView(activeTabId) : undefined;
    if (!view) return;

    const doc = view.state.doc;
    let count = 0;
    const cursor = new SearchCursor(doc, findText, 0, doc.length, caseSensitive);
    while (!cursor.next().done) {
      count++;
    }
    setMatchCount(count);
    setCurrentMatch(count > 0 ? 1 : 0);
  }, [findText, caseSensitive, activeTabId]);

  const getView = useCallback(() => {
    return activeTabId ? getActiveView(activeTabId) : undefined;
  }, [activeTabId]);

  const findNext = useCallback(() => {
    const view = getView();
    if (!view || !findText) return;

    const { state } = view;
    const cursor = new SearchCursor(
      state.doc,
      findText,
      state.selection.main.to,
      state.doc.length,
      caseSensitive
    );
    const result = cursor.next();
    if (!result.done) {
      view.dispatch({
        selection: { anchor: result.value.from, head: result.value.to },
        scrollIntoView: true,
      });
      setCurrentMatch((prev) => (prev < matchCount ? prev + 1 : 1));
    } else {
      // Wrap around to beginning
      const wrapCursor = new SearchCursor(state.doc, findText, 0, state.doc.length, caseSensitive);
      const wrapResult = wrapCursor.next();
      if (!wrapResult.done) {
        view.dispatch({
          selection: { anchor: wrapResult.value.from, head: wrapResult.value.to },
          scrollIntoView: true,
        });
        setCurrentMatch(1);
      }
    }
  }, [getView, findText, caseSensitive, matchCount]);

  const findPrevious = useCallback(() => {
    const view = getView();
    if (!view || !findText) return;

    const { state } = view;
    const from = state.selection.main.from;

    // Search from beginning to current position to find all matches before cursor
    const cursor = new SearchCursor(state.doc, findText, 0, from, caseSensitive);
    let lastMatch: { from: number; to: number } | null = null;
    while (!cursor.next().done) {
      lastMatch = cursor.value;
    }

    if (lastMatch) {
      view.dispatch({
        selection: { anchor: lastMatch.from, head: lastMatch.to },
        scrollIntoView: true,
      });
      setCurrentMatch((prev) => (prev > 1 ? prev - 1 : matchCount));
    } else {
      // Wrap around to end
      const wrapCursor = new SearchCursor(state.doc, findText, 0, state.doc.length, caseSensitive);
      let finalMatch: { from: number; to: number } | null = null;
      while (!wrapCursor.next().done) {
        finalMatch = wrapCursor.value;
      }
      if (finalMatch) {
        view.dispatch({
          selection: { anchor: finalMatch.from, head: finalMatch.to },
          scrollIntoView: true,
        });
        setCurrentMatch(matchCount);
      }
    }
  }, [getView, findText, caseSensitive, matchCount]);

  const handleReplace = useCallback(() => {
    const view = getView();
    if (!view || !findText) return;

    const { state } = view;
    const sel = state.selection.main;

    // Check if current selection matches
    const selectedText = state.doc.sliceString(sel.from, sel.to);
    const matches = caseSensitive
      ? selectedText === findText
      : selectedText.toLowerCase() === findText.toLowerCase();

    if (matches && sel.from !== sel.to) {
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: replaceText },
        selection: { anchor: sel.from + replaceText.length },
      });
      // Find next after replace
      setTimeout(() => findNext(), 0);
    } else {
      findNext();
    }
  }, [getView, findText, replaceText, caseSensitive, findNext]);

  const handleReplaceAll = useCallback(() => {
    const view = getView();
    if (!view || !findText) return;

    const { state } = view;
    const changes: { from: number; to: number; insert: string }[] = [];

    const cursor = new SearchCursor(state.doc, findText, 0, state.doc.length, caseSensitive);
    while (!cursor.next().done) {
      changes.push({ from: cursor.value.from, to: cursor.value.to, insert: replaceText });
    }

    if (changes.length === 0) return;

    // Apply changes from end to start to avoid position shifts
    changes.reverse();
    view.dispatch({
      changes,
      selection: { anchor: changes[changes.length - 1].from + replaceText.length },
    });
    setMatchCount(0);
    setCurrentMatch(0);
  }, [getView, findText, replaceText, caseSensitive]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    },
    [onClose, findNext, findPrevious]
  );

  if (!visible) return null;

  const inputClass =
    'px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all';

  const iconBtnClass =
    'p-1.5 rounded-lg hover:bg-gray-200/80 dark:hover:bg-gray-700/80 text-gray-500 dark:text-gray-400 transition-colors active:scale-95';

  const disabledBtnClass = 'opacity-40 cursor-not-allowed active:scale-100';

  const canAct = !!findText && !!activeTabId;

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 border-b border-gray-200 dark:border-gray-700/80 bg-gray-50 dark:bg-gray-900 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={findInputRef}
              type="text"
              placeholder="查找"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} w-full border-gray-300 dark:border-gray-600`}
            />
            {matchCount > 0 && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 select-none">
                {currentMatch}/{matchCount}
              </span>
            )}
          </div>
          {showReplace && (
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="替换为"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`${inputClass} w-full border-gray-300 dark:border-gray-600`}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            title="上一个"
            className={`${iconBtnClass} ${!canAct ? disabledBtnClass : ''}`}
            onClick={findPrevious}
            disabled={!canAct}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            title="下一个"
            className={`${iconBtnClass} ${!canAct ? disabledBtnClass : ''}`}
            onClick={findNext}
            disabled={!canAct}
          >
            <ChevronRight size={14} />
          </button>
          {showReplace && (
            <>
              <button
                title="替换"
                className={`${iconBtnClass} ${!canAct ? disabledBtnClass : ''}`}
                onClick={handleReplace}
                disabled={!canAct}
              >
                <Replace size={14} />
              </button>
              <button
                title="全部替换"
                className={`${iconBtnClass} ${!canAct ? disabledBtnClass : ''}`}
                onClick={handleReplaceAll}
                disabled={!canAct}
              >
                <ReplaceAll size={14} />
              </button>
            </>
          )}
          <button
            onClick={() => setShowReplace(!showReplace)}
            className={iconBtnClass}
            title={showReplace ? '隐藏替换' : '显示替换'}
          >
            {showReplace ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={onClose} className={iconBtnClass} title="关闭 (Esc)">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <span>区分大小写</span>
        </label>
        <span className="text-gray-400 dark:text-gray-500">Enter: 下一个, Shift+Enter: 上一个, Esc: 关闭</span>
      </div>
    </div>
  );
};

export default React.memo(FindReplace);
