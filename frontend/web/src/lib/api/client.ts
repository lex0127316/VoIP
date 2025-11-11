/**
 * Shared HTTP utilities for talking to the Rust services.
 *
 * Handles base URL resolution (local vs production), JSON parsing and error
 * shaping so feature hooks can remain terse.
 */
'use client';

export type ApiError = {
  status: number;
  message: string;
};

export type ApiFetchOptions = RequestInit & {
  transformResponse?: (raw: unknown) => unknown;
  parseJson?: boolean;
};

const DEFAULT_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8081'
    : 'https://api.voip.example.com';

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL;
  }
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Unable to parse API response');
  }
}

export async function apiFetch<TResponse = unknown>(path: string, options: ApiFetchOptions = {}): Promise<TResponse> {
  const { transformResponse, parseJson = true, headers, ...rest } = options;
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await readJson(response)) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch (error) {
      message = error instanceof Error ? error.message : message;
    }

    const apiError: ApiError = {
      status: response.status,
      message,
    };
    throw apiError;
  }

  if (!parseJson) {
    // Caller explicitly wants the raw Response body/side-effects only.
    return undefined as TResponse;
  }

  const json = await readJson(response);
  return (transformResponse ? transformResponse(json) : json) as TResponse;
}


