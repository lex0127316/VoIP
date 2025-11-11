'use client';

export type SignalingEvent = {
  type: string;
  [key: string]: unknown;
};

type SignalingCallbacks = {
  onEvent?: (event: SignalingEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
};

const DEFAULT_SIGNALING_URL =
  process.env.NODE_ENV === 'development'
    ? 'ws://localhost:8080/ws'
    : 'wss://signaling.voip.example.com/ws';

function buildUrl(token: string): string {
  if (typeof window === 'undefined') {
    return DEFAULT_SIGNALING_URL;
  }

  const base = process.env.NEXT_PUBLIC_SIGNALING_URL ?? DEFAULT_SIGNALING_URL;
  const url = new URL(base, window.location.href);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * Thin wrapper around the signalling websocket.
 *
 * The softphone store holds a single instance of this class which is
 * responsible for establishing the WS channel, parsing JSON messages emitted
 * by the Rust signalling service, and surfacing lifecycle callbacks.
 */
export class SignalingClient {
  #callbacks: SignalingCallbacks;
  #socket: WebSocket | null = null;
  #connectionPromise: Promise<void> | null = null;

  constructor(callbacks: SignalingCallbacks = {}) {
    this.#callbacks = callbacks;
  }

  connect(token: string): Promise<void> {
    if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // Reuse the in-flight promise so simultaneous callers share the same handshake.
    if (this.#connectionPromise) {
      return this.#connectionPromise;
    }

    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    this.#connectionPromise = new Promise((resolve, reject) => {
      try {
        const url = buildUrl(token);
        const socket = new WebSocket(url);
        this.#socket = socket;

        socket.onopen = () => {
          this.#callbacks.onOpen?.();
          resolve();
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as SignalingEvent;
            this.#callbacks.onEvent?.(payload);
          } catch (error) {
            // Bad payloads shouldn't tear down the whole connection.
            console.warn('failed to parse signaling payload', error);
          }
        };

        socket.onerror = (error) => {
          this.#callbacks.onError?.(error);
          if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
            this.#connectionPromise = null;
            reject(error instanceof ErrorEvent ? error.error ?? new Error(error.message) : new Error('WebSocket error'));
          }
        };

        socket.onclose = () => {
          this.#callbacks.onClose?.();
          this.#socket = null;
          this.#connectionPromise = null;
        };
      } catch (error) {
        reject(error);
        this.#connectionPromise = null;
      }
    });

    return this.#connectionPromise;
  }

  send(event: SignalingEvent): void {
    if (!this.#socket || this.#socket.readyState !== WebSocket.OPEN) {
      throw new Error('Signaling socket not connected');
    }

    // All events are JSON encoded to match the Rust server API.
    this.#socket.send(JSON.stringify(event));
  }

  disconnect(): void {
    this.#socket?.close();
    this.#socket = null;
    this.#connectionPromise = null;
  }

  get readyState(): number {
    return this.#socket?.readyState ?? WebSocket.CLOSED;
  }
}


