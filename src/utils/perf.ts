/**
 * Lightweight performance monitoring for the text editor.
 * Measures cold start, file open, tab switch, and typing latency.
 *
 * Usage:
 *   import { perf } from './perf';
 *   perf.mark('file-open-start');
 *   // ... open file ...
 *   perf.mark('file-open-end');
 *   perf.measure('file-open', 'file-open-start', 'file-open-end');
 *   perf.consoleReport();
 */

interface PerfEntry {
  name: string;
  duration: number;
  timestamp: number;
  meta?: Record<string, unknown>;
}

class PerfMonitor {
  private marks = new Map<string, number>();
  private measures: PerfEntry[] = [];
  private enabled = true;

  enable() { this.enabled = true; }
  disable() { this.enabled = false; }

  mark(name: string): void {
    if (!this.enabled) return;
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string, meta?: Record<string, unknown>): number | null {
    if (!this.enabled) return null;
    const start = this.marks.get(startMark);
    if (start === undefined) {
      console.warn(`[Perf] startMark "${startMark}" not found`);
      return null;
    }
    const end = endMark ? this.marks.get(endMark) : performance.now();
    if (endMark && end === undefined) {
      console.warn(`[Perf] endMark "${endMark}" not found`);
      return null;
    }
    const duration = Math.round((end! - start) * 100) / 100;
    this.measures.push({ name, duration, timestamp: Date.now(), meta });
    return duration;
  }

  /** Record a file open event */
  recordFileOpen(fileSizeBytes: number, durationMs: number): void {
    if (!this.enabled) return;
    this.measures.push({
      name: 'file-open',
      duration: Math.round(durationMs * 100) / 100,
      timestamp: Date.now(),
      meta: { sizeBytes: fileSizeBytes, sizeMB: Math.round(fileSizeBytes / 1024 / 1024 * 100) / 100 },
    });
  }

  /** Record a tab switch event */
  recordTabSwitch(durationMs: number): void {
    if (!this.enabled) return;
    this.measures.push({
      name: 'tab-switch',
      duration: Math.round(durationMs * 100) / 100,
      timestamp: Date.now(),
    });
  }

  /** Record typing latency */
  recordTypingLatency(durationMs: number): void {
    if (!this.enabled) return;
    this.measures.push({
      name: 'typing-latency',
      duration: Math.round(durationMs * 100) / 100,
      timestamp: Date.now(),
    });
  }

  /** Get average duration for a specific measure name */
  average(name: string): number {
    const items = this.measures.filter((m) => m.name === name);
    if (items.length === 0) return 0;
    return items.reduce((sum, m) => sum + m.duration, 0) / items.length;
  }

  /** Get all measures for a name */
  getMeasures(name: string): PerfEntry[] {
    return this.measures.filter((m) => m.name === name);
  }

  /** Get latest measure for a name */
  latest(name: string): PerfEntry | null {
    const items = this.measures.filter((m) => m.name === name);
    return items.length > 0 ? items[items.length - 1] : null;
  }

  /** Clear all measures */
  clear(): void {
    this.marks.clear();
    this.measures = [];
  }

  /** Output a formatted report to the console */
  consoleReport(): void {
    if (this.measures.length === 0) {
      console.log('[Perf] No measures recorded yet.');
      return;
    }

    const groups = new Map<string, PerfEntry[]>();
    for (const m of this.measures) {
      if (!groups.has(m.name)) groups.set(m.name, []);
      groups.get(m.name)!.push(m);
    }

    console.group('[Perf] Report');
    for (const [name, items] of groups) {
      const avg = items.reduce((s, m) => s + m.duration, 0) / items.length;
      const min = Math.min(...items.map((m) => m.duration));
      const max = Math.max(...items.map((m) => m.duration));
      const count = items.length;
      const last = items[items.length - 1];
      const metaStr = last.meta ? ` | ${JSON.stringify(last.meta)}` : '';
      console.log(
        `  ${name.padEnd(18)} avg=${avg.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms n=${count}${metaStr}`
      );
    }
    console.groupEnd();
  }

  /** Export as JSON for external analysis */
  exportJSON(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      measures: this.measures,
    }, null, 2);
  }
}

export const perf = new PerfMonitor();

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  (window as any).perf = perf;
}
