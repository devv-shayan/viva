import { AssessDeltaSchema, type AssessDelta, type AssessRequest } from "./assess-types";

export const INITIAL_ASSESS_DEADLINE_MS = 3_000;
const MIN_ASSESS_DEADLINE_MS = 2_500;
const MAX_ASSESS_DEADLINE_MS = 5_000;
const MAX_LATENCY_SAMPLES = 20;

export type AssessLatencyMetrics = {
  deadlineMs: number;
  latestMs: number;
  medianMs: number;
  samplesMs: number[];
  worstMs: number;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type MetricsLogger = (
  message: string,
  metrics: Omit<AssessLatencyMetrics, "samplesMs"> & { count: number },
) => void;

export class AssessTimeoutError extends Error {
  constructor() {
    super("Viva could not assess that answer before its deadline.");
    this.name = "AssessTimeoutError";
  }
}

export class AssessClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssessClientError";
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getAssessDeadlineMs(metrics: Pick<AssessLatencyMetrics, "samplesMs">) {
  if (metrics.samplesMs.length === 0) {
    return INITIAL_ASSESS_DEADLINE_MS;
  }

  const medianMs = median(metrics.samplesMs);
  const worstMs = Math.max(...metrics.samplesMs);

  return clamp(
    Math.ceil(Math.max(medianMs * 2, worstMs * 1.25 + 250)),
    MIN_ASSESS_DEADLINE_MS,
    MAX_ASSESS_DEADLINE_MS,
  );
}

export function createAssessLatencyMetrics(): AssessLatencyMetrics {
  return {
    deadlineMs: INITIAL_ASSESS_DEADLINE_MS,
    latestMs: 0,
    medianMs: 0,
    samplesMs: [],
    worstMs: 0,
  };
}

export function recordAssessLatency(
  previous: AssessLatencyMetrics,
  elapsedMs: number,
): AssessLatencyMetrics {
  const samplesMs = [...previous.samplesMs, Math.max(0, Math.round(elapsedMs))].slice(
    -MAX_LATENCY_SAMPLES,
  );

  return {
    deadlineMs: getAssessDeadlineMs({ samplesMs }),
    latestMs: samplesMs.at(-1) ?? 0,
    medianMs: median(samplesMs),
    samplesMs,
    worstMs: Math.max(...samplesMs),
  };
}

export function logAssessLatency(
  metrics: AssessLatencyMetrics,
  log: MetricsLogger = console.info,
) {
  log("Viva assess latency", {
    count: metrics.samplesMs.length,
    deadlineMs: metrics.deadlineMs,
    latestMs: metrics.latestMs,
    medianMs: metrics.medianMs,
    worstMs: metrics.worstMs,
  });
}

function errorMessageFromResponse(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return "Viva could not process that answer.";
}

export type RequestAssessmentOptions = {
  deadlineMs?: number;
  fetchImpl?: FetchLike;
  log?: MetricsLogger;
  metrics?: AssessLatencyMetrics;
  now?: () => number;
  onMetrics?: (metrics: AssessLatencyMetrics) => void;
  signal?: AbortSignal;
};

export type AssessmentResult = {
  delta: AssessDelta;
  metrics: AssessLatencyMetrics;
};

/**
 * Every completed request logs one latency sample, including a timeout. The
 * caller keeps the returned metrics in a ref so the next deadline is based on
 * evidence from this defense rather than a fixed guess.
 */
export async function requestAssessment(
  request: AssessRequest,
  options: RequestAssessmentOptions = {},
): Promise<AssessmentResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? performance.now.bind(performance);
  const previousMetrics = options.metrics ?? createAssessLatencyMetrics();
  const deadlineMs = options.deadlineMs ?? previousMetrics.deadlineMs;
  const controller = new AbortController();
  let timedOut = false;
  let externallyAborted = false;
  const startedAtMs = now();
  const abortForExternalSignal = () => {
    externallyAborted = true;
    controller.abort();
  };
  let recordedMetrics: AssessLatencyMetrics | null = null;
  let didRecordLatency = false;

  const finalizeLatency = (): AssessLatencyMetrics => {
    if (!didRecordLatency) {
      didRecordLatency = true;
      recordedMetrics = recordAssessLatency(
        previousMetrics,
        now() - startedAtMs,
      );
      logAssessLatency(recordedMetrics, options.log);
      options.onMetrics?.(recordedMetrics);
    }

    return recordedMetrics ?? previousMetrics;
  };

  options.signal?.addEventListener("abort", abortForExternalSignal, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deadlineMs);

  try {
    const response = await fetchImpl("/api/assess", {
      body: JSON.stringify(request),
      cache: "no-store",
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new AssessClientError(errorMessageFromResponse(body));
    }

    const parsed = AssessDeltaSchema.safeParse(body);

    if (!parsed.success) {
      throw new AssessClientError("Viva received an unusable assessment result.");
    }

    return {
      delta: parsed.data,
      metrics: finalizeLatency(),
    };
  } catch (error) {
    if (timedOut) {
      throw new AssessTimeoutError();
    }

    if (error instanceof AssessClientError) {
      throw error;
    }

    throw new AssessClientError("Viva could not process that answer.");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortForExternalSignal);

    // A user pause/reconnect/finish is not service latency. Recording it would
    // make the next deadline look faster than the assess route actually is.
    if (!externallyAborted) {
      finalizeLatency();
    }
  }
}
