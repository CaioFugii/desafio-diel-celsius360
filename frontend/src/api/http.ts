export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryParams = Record<string, string | number | undefined>;

export interface HttpClient {
  get<T>(path: string, params?: QueryParams, signal?: AbortSignal): Promise<T>;
}

export function toQueryString(params: QueryParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body as { message: unknown };
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
  }
  return `HTTP ${status}`;
}

export function createHttpClient(baseUrl = '/api', fetchImpl: typeof fetch = fetch): HttpClient {
  return {
    async get<T>(path: string, params?: QueryParams, signal?: AbortSignal): Promise<T> {
      const res = await fetchImpl(`${baseUrl}${path}${toQueryString(params)}`, {
        signal,
        headers: { Accept: 'application/json' },
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.status));
      return body as T;
    },
  };
}
