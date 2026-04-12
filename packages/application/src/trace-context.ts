// Unified trace context for cross-cutting observability.
// Propagates through orchestration and replay paths.

let spanSeq = 0;

export type TraceContext = {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly caseId: string | null;
  readonly requestId: string | null;
  readonly module: string;
  readonly action: string;
  readonly startedAt: string;
};

export type TraceContextSummary = {
  readonly traceId: string;
  readonly rootSpanId: string;
  readonly totalSpans: number;
  readonly modules: readonly string[];
  readonly actions: readonly string[];
};

export const startTraceContext = (
  traceId: string,
  module: string,
  action: string,
  opts?: { caseId?: string; requestId?: string; startedAt?: string }
): TraceContext => ({
  traceId,
  spanId: `${traceId}-span-${++spanSeq}`,
  parentSpanId: null,
  caseId: opts?.caseId ?? null,
  requestId: opts?.requestId ?? null,
  module,
  action,
  startedAt: opts?.startedAt ?? new Date().toISOString()
});

export const deriveChildTraceContext = (
  parent: TraceContext,
  module: string,
  action: string,
  startedAt?: string
): TraceContext => ({
  traceId: parent.traceId,
  spanId: `${parent.traceId}-span-${++spanSeq}`,
  parentSpanId: parent.spanId,
  caseId: parent.caseId,
  requestId: parent.requestId,
  module,
  action,
  startedAt: startedAt ?? new Date().toISOString()
});

export const buildTraceContextSummary = (
  root: TraceContext,
  children: readonly TraceContext[]
): TraceContextSummary => {
  const all = [root, ...children];
  return {
    traceId: root.traceId,
    rootSpanId: root.spanId,
    totalSpans: all.length,
    modules: [...new Set(all.map(c => c.module))],
    actions: all.map(c => c.action)
  };
};
