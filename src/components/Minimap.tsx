import React, { useRef, useEffect, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import type { EditorTheme } from '../utils/themes';

interface MinimapProps {
  viewRef: React.MutableRefObject<EditorView | null>;
  theme: EditorTheme;
}

const Minimap: React.FC<MinimapProps> = ({ viewRef, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let pollId: ReturnType<typeof setTimeout>;
    let lastDocLen = -1;
    let lastVpFrom = -1;
    let lastVpTo = -1;
    let lastW = -1;
    let lastH = -1;

    const W = 120;

    const render = () => {
      const view = viewRef.current;
      if (!view) {
        // View not ready yet — poll at 10Hz instead of 60fps RAF to save CPU
        pollId = setTimeout(render, 100);
        return;
      }

      const doc = view.state.doc;
      const viewport = view.viewport;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const H = rect.height;

      // Only repaint when doc, viewport, or canvas size actually changed
      if (
        doc.length === lastDocLen &&
        viewport.from === lastVpFrom &&
        viewport.to === lastVpTo &&
        W === lastW &&
        H === lastH
      ) {
        rafId = requestAnimationFrame(render);
        return;
      }

      lastDocLen = doc.length;
      lastVpFrom = viewport.from;
      lastVpTo = viewport.to;

      // Update canvas size only when it actually changed
      if (W !== lastW || H !== lastH) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
        lastW = W;
        lastH = H;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const isDark = theme === 'vs-dark';
      ctx.fillStyle = isDark ? '#1e1e1e' : '#f3f3f3';
      ctx.fillRect(0, 0, W, H);

      const lines = doc.lines;
      let lineH = H / lines;
      let step = 1;

      // 对于超大文件，按块采样避免逐行循环过慢
      if (lineH < 0.5) {
        step = Math.ceil(0.5 / lineH);
        lineH = H / (lines / step);
      }

      // 绘制代码缩略：每行/每块用一条灰线表示，长度和透明度随字符数变化
      ctx.fillStyle = isDark ? '#8b949e' : '#57606a';
      for (let i = 1; i <= lines; i += step) {
        let maxLen = 0;
        for (let j = 0; j < step && i + j <= lines; j++) {
          const len = doc.line(i + j).text.trim().length;
          if (len > maxLen) maxLen = len;
        }
        if (maxLen === 0) continue;

        const y = Math.floor((i - 1) / step) * lineH;
        const intensity = Math.min(maxLen / 80, 1);
        ctx.globalAlpha = 0.2 + intensity * 0.4;
        ctx.fillRect(2, y, (W - 4) * intensity, Math.max(lineH, 1));
      }
      ctx.globalAlpha = 1;

      // 绘制当前视口覆盖层
      const fromLine = doc.lineAt(viewport.from).number;
      const toLine = doc.lineAt(viewport.to).number;
      const vpY = (fromLine - 1) / step * lineH;
      const vpH = Math.max((toLine - fromLine + 1) / step * lineH, 3);

      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, vpY, W, vpH);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, vpY + 0.5, W - 1, vpH - 1);

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(pollId);
    };
  }, [viewRef, theme]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const view = viewRef.current;
      const container = containerRef.current;
      if (!view || !container) return;

      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = Math.max(0, Math.min(1, y / rect.height));
      const targetLine = Math.floor(ratio * view.state.doc.lines) + 1;
      const line = view.state.doc.line(
        Math.min(targetLine, view.state.doc.lines)
      );

      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start' }),
      });
    },
    [viewRef]
  );

  return (
    <div
      ref={containerRef}
      className="w-[120px] h-full flex-shrink-0 relative cursor-pointer select-none border-l"
      style={{
        borderColor:
          theme === 'vs-dark'
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)',
      }}
      onClick={handleClick}
      title="点击跳转到对应位置"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export default React.memo(Minimap);
