"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** JSON fetch against our own /api. Throws ApiError carrying the server's `{ error }` message. */
export async function api<T>(path: string, init: { method?: string; json?: unknown; body?: BodyInit } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.json !== undefined || init.body ? "POST" : "GET"),
    headers: init.json !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Something went wrong. Please try again.");
  return data as T;
}

type State<T> = { data: T | undefined; error: ApiError | null; loading: boolean };

/**
 * GET hook. Keeps the previous data on screen while refetching (no skeleton flash).
 * A 409 means onboarding is not done, so it sends the user there.
 */
export function useApi<T>(path: string | null) {
  const router = useRouter();
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: path !== null });
  const seq = useRef(0);

  /** Applies a response unless a newer request has started since. */
  const settle = useCallback(
    (mine: number, request: Promise<T>) =>
      request
        .then((data) => {
          if (mine === seq.current) setState({ data, error: null, loading: false });
        })
        .catch((e) => {
          const err = e instanceof ApiError ? e : new ApiError(0, "Could not reach the server.");
          if (err.status === 409) router.replace("/onboarding");
          if (err.status === 401) router.replace("/login");
          if (mine === seq.current) setState((s) => ({ data: s.data, error: err, loading: false }));
        }),
    [router],
  );

  useEffect(() => {
    if (path === null) return;
    settle(++seq.current, api<T>(path));
  }, [path, settle]);

  /** Refetch, keeping the previous data on screen and flagging `loading`. */
  const reload = useCallback(async () => {
    if (path === null) return;
    setState((s) => ({ ...s, loading: true }));
    await settle(++seq.current, api<T>(path));
  }, [path, settle]);

  return { ...state, reload, setData: (data: T) => setState({ data, error: null, loading: false }) };
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
