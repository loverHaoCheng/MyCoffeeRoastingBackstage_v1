import { describe, expect, it } from 'vitest';

import { AppError } from '@/shared/errors/AppError';
import { HttpClient, resolveHttpClientAbsoluteUrl } from '@/services/httpClient';

describe('HttpClient', () => {
  it('returns unified API payloads', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.example.test',
      fetcher: () =>
        Promise.resolve(new Response(JSON.stringify({ code: 0, message: 'ok', data: { id: 1 } }), {
          status: 200,
        })),
    });

    await expect(client.get<{ id: number }>('/beans/1')).resolves.toEqual({
      code: 0,
      message: 'ok',
      data: { id: 1 },
    });
  });

  it('converts HTTP failures to AppError', async () => {
    const client = new HttpClient({
      baseUrl: 'https://api.example.test',
      fetcher: () =>
        Promise.resolve(new Response(JSON.stringify({ code: 500, message: 'server error', data: null }), {
          status: 500,
        })),
    });

    await expect(client.get<null>('/broken')).rejects.toBeInstanceOf(AppError);
  });

  it('serializes JSON request bodies', async () => {
    let capturedBody: BodyInit | null | undefined;

    const client = new HttpClient({
      baseUrl: 'https://api.example.test',
      fetcher: (_input, init) => {
        capturedBody = init?.body;
        return Promise.resolve(
          new Response(JSON.stringify({ code: 0, message: 'created', data: { id: 2 } }), {
            status: 200,
          }),
        );
      },
    });

    await client.post<{ id: number }>('/beans', { name: 'Guji' });

    expect(capturedBody).toBe(JSON.stringify({ name: 'Guji' }));
  });

  it('resolves relative request urls against the current browser origin', () => {
    expect(resolveHttpClientAbsoluteUrl('/ai/bean-image-recognition')).toBe(
      'http://localhost:3000/api/ai/bean-image-recognition',
    );
  });

  it('keeps absolute request urls unchanged', () => {
    expect(resolveHttpClientAbsoluteUrl('/health', 'https://api.example.test/api')).toBe(
      'https://api.example.test/api/health',
    );
  });
});
