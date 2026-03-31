export class StorageProviderError extends Error {
  statusCode: number;
  retryable: boolean;

  constructor(message: string, statusCode = 500, retryable = false) {
    super(message);
    this.name = "StorageProviderError";
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

type FetchRetryOptions = {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  shouldRetry?: (status: number) => boolean;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number, baseDelayMs: number) {
  const jitter = Math.floor(Math.random() * 50);
  return baseDelayMs * Math.pow(2, attempt) + jitter;
}

function withTimeoutSignal(timeoutMs: number) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  return {
    signal: ac.signal,
    clear: () => clearTimeout(timer),
  };
}

function formatErrorDetail(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const base = error.message || error.name || "unknown error";
  const cause = (error as Error & { cause?: unknown }).cause;
  if (!cause) {
    return base;
  }

  if (cause instanceof Error) {
    const code = (cause as Error & { code?: string }).code;
    return code ? `${base} (cause=${cause.message}, code=${code})` : `${base} (cause=${cause.message})`;
  }

  if (typeof cause === "object" && cause) {
    const maybeCode = (cause as { code?: string }).code;
    const maybeMessage = (cause as { message?: string }).message;
    if (maybeCode || maybeMessage) {
      return `${base} (cause=${maybeMessage || "unknown"}, code=${maybeCode || "n/a"})`;
    }
  }

  return `${base} (cause=${String(cause)})`;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: FetchRetryOptions = {}
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const shouldRetry = opts.shouldRetry ?? ((status) => status === 429 || status >= 500);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { signal, clear } = withTimeoutSignal(timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal });
      if (!res.ok && attempt < retries && shouldRetry(res.status)) {
        await delay(backoffMs(attempt, baseDelayMs));
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await delay(backoffMs(attempt, baseDelayMs));
        continue;
      }
  const detail = formatErrorDetail(e);
      throw new StorageProviderError(`Storage upstream unavailable: ${detail}`, 502, true);
    } finally {
      clear();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new StorageProviderError("Storage request failed", 502, true);
}

export async function safeResponseText(res: Response) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
