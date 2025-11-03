'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError } from '@/lib/api/client';
import { apiFetch } from '@/lib/api/client';

type UseApiQueryOptions<TData> = {
  enabled?: boolean;
  pollIntervalMs?: number;
  fallbackData?: TData;
  transform?: (raw: unknown) => TData;
  onError?: (error: ApiError) => void;
};

type UseApiQueryResult<TData> = {
  data: TData | undefined;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
};

export function useApiQuery<TData = unknown>(path: string, options: UseApiQueryOptions<TData> = {}): UseApiQueryResult<TData> {
  const { enabled = true, pollIntervalMs, fallbackData, transform, onError } = options;
  const [data, setData] = useState<TData | undefined>(fallbackData);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<ApiError | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const transformRef = useRef<typeof transform>(transform);
  const onErrorRef = useRef<typeof onError>(onError);
  const fallbackRef = useRef<TData | undefined>(fallbackData);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    fallbackRef.current = fallbackData;
    if (fallbackData !== undefined && data === undefined) {
      setData(fallbackData);
    }
  }, [fallbackData, data]);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch<TData>(path, {
        transformResponse: transformRef.current,
      });
      setData(result);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      if (fallbackRef.current !== undefined) {
        setData(fallbackRef.current);
      }
      onErrorRef.current?.(apiError);
    } finally {
      setLoading(false);
    }
  }, [enabled, path]);

  useEffect(() => {
    fetchData();

    if (!pollIntervalMs) {
      return undefined;
    }

    pollTimer.current = setInterval(fetchData, pollIntervalMs);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
      }
    };
  }, [fetchData, pollIntervalMs]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

type UseApiMutationOptions<TInput, TResponse> = {
  onSuccess?: (response: TResponse, input: TInput) => void;
  onError?: (error: ApiError, input: TInput) => void;
};

type UseApiMutationResult<TInput, TResponse> = {
  loading: boolean;
  error: ApiError | null;
  mutate: (input: TInput) => Promise<TResponse | null>;
};

export function useApiMutation<TInput, TResponse = unknown>(
  path: string,
  options: UseApiMutationOptions<TInput, TResponse> = {},
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST',
): UseApiMutationResult<TInput, TResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (input: TInput) => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch<TResponse>(path, {
          method,
          body: JSON.stringify(input),
        });
        options.onSuccess?.(response, input);
        return response;
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError);
        options.onError?.(apiError, input);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [method, options, path],
  );

  return {
    loading,
    error,
    mutate,
  };
}


