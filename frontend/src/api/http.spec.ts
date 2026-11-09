import { ApiError, createHttpClient, toQueryString } from './http';

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  } as Response;
}

describe('toQueryString', () => {
  it('skips undefined and empty values', () => {
    expect(toQueryString({ a: 1, b: undefined, c: '', d: 'x y' })).toBe('?a=1&d=x+y');
  });

  it('returns an empty string when nothing is left', () => {
    expect(toQueryString()).toBe('');
    expect(toQueryString({ a: undefined })).toBe('');
  });
});

describe('createHttpClient', () => {
  it('requests base url + path + query and returns the JSON body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { ok: true }));
    const http = createHttpClient('/api', fetchImpl);
    const signal = new AbortController().signal;

    await expect(http.get('/stores', { page: 2 }, signal)).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith('/api/stores?page=2', {
      signal,
      headers: { Accept: 'application/json' },
    });
  });

  it('turns validation errors into an ApiError with the joined messages', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(response(400, { message: ['period must be 1d', 'page must be > 0'] }));
    const error = await createHttpClient('/api', fetchImpl).get('/stores').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'period must be 1d; page must be > 0' });
  });

  it('uses a plain string message when the API sends one', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(404, { message: 'zone X not found' }));
    await expect(createHttpClient('/api', fetchImpl).get('/zones/X/summary')).rejects.toMatchObject({
      status: 404,
      message: 'zone X not found',
    });
  });

  it('falls back to the HTTP status when the body is not usable', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(502, new Error('not json')))
      .mockResolvedValueOnce(response(500, { message: 42 }));
    const http = createHttpClient('/api', fetchImpl);

    await expect(http.get('/stores')).rejects.toMatchObject({ message: 'HTTP 502' });
    await expect(http.get('/stores')).rejects.toMatchObject({ message: 'HTTP 500' });
  });
});
