import { describe, it, expect } from 'vitest';
import { counter, histogram, renderMetrics } from '../src/metrics.js';

describe('metrics', () => {
  it('counts and renders counter values', () => {
    const c = counter({ name: 'test_counter_total', help: 'count things', labelNames: ['kind'] });
    c.inc({ kind: 'a' });
    c.inc({ kind: 'a' });
    c.inc({ kind: 'b' }, 5);
    const out = renderMetrics();
    expect(out).toContain('test_counter_total{kind="a"} 2');
    expect(out).toContain('test_counter_total{kind="b"} 5');
    expect(out).toMatch(/^# HELP /m);
    expect(out).toMatch(/^# TYPE /m);
  });

  it('records and renders histogram buckets', () => {
    const h = histogram({
      name: 'test_hist_seconds',
      help: 'durations',
      labelNames: ['op'],
      buckets: [0.1, 1, 10],
    });
    h.observe({ op: 'x' }, 0.05);
    h.observe({ op: 'x' }, 0.5);
    h.observe({ op: 'x' }, 5);
    const out = renderMetrics();
    expect(out).toContain('test_hist_seconds_bucket{op="x",le="0.1"} 1');
    expect(out).toContain('test_hist_seconds_bucket{op="x",le="1"} 2');
    expect(out).toContain('test_hist_seconds_bucket{op="x",le="10"} 3');
    expect(out).toContain('test_hist_seconds_count{op="x"} 3');
  });

  it('emits zeroed series for unused metrics', () => {
    counter({ name: 'unused_counter_total', help: 'empty', labelNames: [] });
    const out = renderMetrics();
    expect(out).toContain('unused_counter_total 0');
  });

  it('includes default Node process metrics', () => {
    const out = renderMetrics();
    expect(out).toContain('nodejs_process_uptime_seconds');
    expect(out).toContain('nodejs_process_rss_bytes');
  });
});
