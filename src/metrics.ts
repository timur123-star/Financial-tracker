/**
 * Tiny zero-dependency Prometheus text-exposition implementation.
 *
 * We could pull in `prom-client`, but the bot only needs counters + a single
 * histogram, and avoiding a transitive dep is worth ~30 lines of code. The
 * format follows the
 * [Prometheus exposition spec](https://prometheus.io/docs/instrumenting/exposition_formats/).
 */

interface CounterMetric {
  kind: 'counter';
  name: string;
  help: string;
  labelNames: string[];
  values: Map<string, number>;
}

interface HistogramMetric {
  kind: 'histogram';
  name: string;
  help: string;
  labelNames: string[];
  buckets: number[];
  // value-key -> { buckets[counts...], sum, count }
  values: Map<string, { buckets: number[]; sum: number; count: number }>;
}

type Metric = CounterMetric | HistogramMetric;

const registry = new Map<string, Metric>();

function labelKey(labelNames: string[], labels: Record<string, string | number>): string {
  if (labelNames.length === 0) return '';
  return labelNames.map((n) => `${n}=${labels[n] ?? ''}`).join('|');
}

function labelStr(labelNames: string[], key: string): string {
  if (!key) return '';
  const pairs = key.split('|').map((p) => {
    const [k, v] = p.split('=');
    return `${k}="${escapeLabelValue(v ?? '')}"`;
  });
  void labelNames;
  return `{${pairs.join(',')}}`;
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

export function counter(opts: { name: string; help: string; labelNames?: string[] }): {
  inc(labels?: Record<string, string | number>, value?: number): void;
} {
  const labelNames = opts.labelNames ?? [];
  const m: CounterMetric = {
    kind: 'counter',
    name: opts.name,
    help: opts.help,
    labelNames,
    values: new Map(),
  };
  registry.set(opts.name, m);
  return {
    inc(labels = {}, value = 1) {
      const key = labelKey(labelNames, labels);
      m.values.set(key, (m.values.get(key) ?? 0) + value);
    },
  };
}

export function histogram(opts: {
  name: string;
  help: string;
  labelNames?: string[];
  buckets?: number[];
}): {
  observe(labels: Record<string, string | number>, value: number): void;
  startTimer(labels?: Record<string, string | number>): () => void;
} {
  const labelNames = opts.labelNames ?? [];
  const buckets = (
    opts.buckets ?? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ).slice();
  const m: HistogramMetric = {
    kind: 'histogram',
    name: opts.name,
    help: opts.help,
    labelNames,
    buckets,
    values: new Map(),
  };
  registry.set(opts.name, m);
  return {
    observe(labels, value) {
      const key = labelKey(labelNames, labels);
      let entry = m.values.get(key);
      if (!entry) {
        entry = { buckets: new Array<number>(buckets.length).fill(0), sum: 0, count: 0 };
        m.values.set(key, entry);
      }
      entry.sum += value;
      entry.count += 1;
      for (let i = 0; i < buckets.length; i++) {
        if (value <= buckets[i]) entry.buckets[i] += 1;
      }
    },
    startTimer(labels = {}) {
      const start = process.hrtime.bigint();
      return () => {
        const elapsedSec = Number(process.hrtime.bigint() - start) / 1e9;
        this.observe(labels, elapsedSec);
      };
    },
  };
}

export function renderMetrics(): string {
  const out: string[] = [];
  for (const m of registry.values()) {
    out.push(`# HELP ${m.name} ${m.help}`);
    out.push(`# TYPE ${m.name} ${m.kind}`);
    if (m.kind === 'counter') {
      if (m.values.size === 0) {
        out.push(`${m.name} 0`);
      } else {
        for (const [key, val] of m.values.entries()) {
          out.push(`${m.name}${labelStr(m.labelNames, key)} ${val}`);
        }
      }
    } else {
      // histogram
      if (m.values.size === 0) {
        // Emit an empty series so dashboards don't blow up.
        for (const b of m.buckets) out.push(`${m.name}_bucket{le="${b}"} 0`);
        out.push(`${m.name}_bucket{le="+Inf"} 0`);
        out.push(`${m.name}_sum 0`);
        out.push(`${m.name}_count 0`);
      } else {
        for (const [key, entry] of m.values.entries()) {
          const baseLabels = labelStr(m.labelNames, key);
          const baseInner = baseLabels.slice(1, -1); // strip { }
          const sep = baseInner ? ',' : '';
          for (let i = 0; i < m.buckets.length; i++) {
            const le = m.buckets[i];
            out.push(`${m.name}_bucket{${baseInner}${sep}le="${le}"} ${entry.buckets[i]}`);
          }
          out.push(`${m.name}_bucket{${baseInner}${sep}le="+Inf"} ${entry.count}`);
          out.push(`${m.name}_sum${baseLabels} ${entry.sum}`);
          out.push(`${m.name}_count${baseLabels} ${entry.count}`);
        }
      }
    }
  }
  // Default Node.js process metrics — RSS + uptime are useful for any dashboard.
  const mem = process.memoryUsage();
  out.push(`# HELP nodejs_process_uptime_seconds Process uptime in seconds.`);
  out.push(`# TYPE nodejs_process_uptime_seconds gauge`);
  out.push(`nodejs_process_uptime_seconds ${process.uptime()}`);
  out.push(`# HELP nodejs_process_rss_bytes Resident set size in bytes.`);
  out.push(`# TYPE nodejs_process_rss_bytes gauge`);
  out.push(`nodejs_process_rss_bytes ${mem.rss}`);
  out.push(`# HELP nodejs_process_heap_used_bytes Heap used in bytes.`);
  out.push(`# TYPE nodejs_process_heap_used_bytes gauge`);
  out.push(`nodejs_process_heap_used_bytes ${mem.heapUsed}`);
  return out.join('\n') + '\n';
}

// ----- Pre-registered application metrics -----

export const metrics = {
  updates: counter({
    name: 'bot_updates_total',
    help: 'Telegram updates received by type.',
    labelNames: ['type'],
  }),
  transactions: counter({
    name: 'bot_transactions_total',
    help: 'Transactions successfully inserted by type.',
    labelNames: ['type'],
  }),
  errors: counter({
    name: 'bot_errors_total',
    help: 'Caught errors by component.',
    labelNames: ['component'],
  }),
  subscriptionsCharged: counter({
    name: 'bot_subscriptions_charged_total',
    help: 'Recurring subscription charges performed by cron.',
  }),
  rateLimitDrops: counter({
    name: 'bot_ratelimit_drops_total',
    help: 'Events dropped by the per-user rate limiter.',
  }),
  voiceTranscriptions: counter({
    name: 'bot_voice_transcriptions_total',
    help: 'Voice messages transcribed via Whisper.',
    labelNames: ['result'],
  }),
  csvImports: counter({
    name: 'bot_csv_imports_total',
    help: 'CSV imports performed.',
    labelNames: ['result'],
  }),
  handlerDuration: histogram({
    name: 'bot_handler_duration_seconds',
    help: 'End-to-end handler execution time.',
    labelNames: ['kind'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  }),
};
