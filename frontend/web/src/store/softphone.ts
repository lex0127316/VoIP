/**
 * Centralised softphone state machine used across the web UI.
 *
 * The store coordinates WebRTC streams, the signalling websocket, and the
 * user-visible call state transitions (idle → connecting → ringing → in-call → ended).
 * Buffered signal frames ensure renegotiation payloads are never dropped even if
 * the peer connection has not finished initialising.
 * Each action below mirrors a user gesture (dial, answer, hangup) or an event
 * delivered from the Rust signalling service.
 */
'use client';

import create from 'zustand';
import SimplePeer, { Instance as PeerInstance, SignalData } from 'simple-peer';
import { fetchAuthToken } from '@/lib/auth/client';
import { SignalingClient, type SignalingEvent } from '@/lib/signaling/client';

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'ended' | 'error';
type SignalingStatus = 'disconnected' | 'connecting' | 'connected';

type LogEntry = {
  id: string;
  message: string;
  timestamp: number;
};

type SoftphoneStore = {
  callState: CallState;
  signalingStatus: SignalingStatus;
  dialNumber: string;
  incomingNumber: string | null;
  callId: string | null;
  statusMessage: string | null;
  error: string | null;
  eventLog: LogEntry[];
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectSignaling: () => Promise<void>;
  disconnectSignaling: () => void;
  startOutgoingCall: () => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  hangup: () => void;
  setDialNumber: (value: string) => void;
  handleSignalingEvent: (event: SignalingEvent) => void;
};

let signalingClient: SignalingClient | null = null;
let peer: PeerInstance | null = null;
// If the peer connection is not ready when remote SDP arrives we temporarily
// buffer it here. Once Simple-Peer initialises we flush in insertion order.
let queuedSignals: SignalData[] = [];

type SetState = (fn: (state: SoftphoneStore) => Partial<SoftphoneStore>) => void;
type GetState = () => SoftphoneStore;

function appendLog(set: SetState, message: string) {
  // Maintain a bounded log so the in-app console never grows unbounded.
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    message,
    timestamp: Date.now(),
  };

  set((state) => ({
    eventLog: [...state.eventLog.slice(-49), entry],
  }));
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function ensureLocalStream(set: SetState, get: GetState): Promise<MediaStream> {
  const existing = get().localStream;
  if (existing) {
    return existing;
  }

  // Lazily acquire the microphone only when the user initiates audio.
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  set(() => ({ localStream: stream }));
  return stream;
}

async function createPeer(
  initiator: boolean,
  callId: string,
  stream: MediaStream,
  set: SetState,
): Promise<PeerInstance> {
  return new Promise((resolve, reject) => {
    try {
      const instance = new SimplePeer({
        initiator,
        trickle: true,
        stream,
      });

      instance.on('signal', (data: SignalData) => {
        // Bubble raw SDP/ICE data to the signalling layer which forwards it to the peer.
        signalingClient?.send({ type: 'signal', callId, data });
      });

      instance.on('stream', (remoteStream) => {
        // Attach the remote track so the UI can play the caller audio.
        set(() => ({ remoteStream }));
      });

      instance.on('connect', () => {
        set(() => ({ callState: 'in-call', statusMessage: 'Connected' }));
        appendLog(set, 'Peer connection established');
      });

      instance.on('close', () => {
        appendLog(set, 'Peer connection closed');
      });

      instance.on('error', (error) => {
        console.error('peer error', error);
        set(() => ({ callState: 'error', error: error.message, statusMessage: 'Call failed' }));
      });

      resolve(instance);
    } catch (error) {
      reject(error);
    }
  });
}

function cleanupPeer(set: SetState, get: GetState) {
  if (peer) {
    peer.removeAllListeners();
    peer.destroy();
    peer = null;
  }
  // Tear down any media tracks to release the microphone/speaker promptly.
  const { localStream, remoteStream } = get();
  stopStream(localStream);
  stopStream(remoteStream);
  set(() => ({ localStream: null, remoteStream: null }));
  queuedSignals = [];
}

export const useSoftphoneStore = create<SoftphoneStore>((set, get) => ({
  callState: 'idle',
  signalingStatus: 'disconnected',
  dialNumber: '',
  incomingNumber: null,
  callId: null,
  statusMessage: null,
  error: null,
  eventLog: [],
  localStream: null,
  remoteStream: null,

  setDialNumber: (value: string) => set(() => ({ dialNumber: value })),

  connectSignaling: async () => {
    if (typeof window === 'undefined') {
      return;
    }

    // Prevent duplicate websocket handshakes when the UI renders multiple times.
    const currentStatus = get().signalingStatus;
    if (currentStatus === 'connected' || currentStatus === 'connecting') {
      return;
    }

    set(() => ({ signalingStatus: 'connecting', statusMessage: 'Connecting to signaling...' }));

    try {
      const token = await fetchAuthToken();
      if (!token) {
        throw new Error('Missing auth token');
      }

      // The signalling client relays events between this browser and the Rust service.
      signalingClient = new SignalingClient({
        onOpen: () => {
          set(() => ({ signalingStatus: 'connected', statusMessage: 'Signaling connected' }));
          appendLog(set, 'Connected to signaling service');
        },
        onEvent: (event) => get().handleSignalingEvent(event),
        onClose: () => {
          set(() => ({ signalingStatus: 'disconnected', statusMessage: 'Signaling disconnected' }));
          appendLog(set, 'Signaling disconnected');
        },
        onError: (error) => {
          console.error('signaling error', error);
          appendLog(set, 'Signaling error encountered');
        },
      });

      await signalingClient.connect(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to signaling';
      set(() => ({ signalingStatus: 'disconnected', statusMessage: message, error: message }));
      appendLog(set, `Signaling connection failed: ${message}`);
      signalingClient = null;
    }
  },

  disconnectSignaling: () => {
    // Typically invoked when the user signs out or closes the softphone panel.
    signalingClient?.disconnect();
    signalingClient = null;
    set(() => ({ signalingStatus: 'disconnected' }));
  },

  startOutgoingCall: async () => {
    if (!signalingClient || signalingClient.readyState !== WebSocket.OPEN) {
      appendLog(set, 'Cannot place call without signaling connection');
      return;
    }

    // Dial pad is always authoritative – empty numbers are ignored.
    const state = get();
    if (!state.dialNumber.trim()) {
      appendLog(set, 'Enter a destination number before calling');
      return;
    }

    const callId = crypto.randomUUID();
    set(() => ({ callState: 'connecting', statusMessage: 'Placing call...', callId, incomingNumber: null }));
    appendLog(set, `Dialing ${state.dialNumber}`);

    try {
      // Outbound calls originate as the initiator which triggers Simple-Peer to create offers.
      const stream = await ensureLocalStream(set, get);
      peer = await createPeer(true, callId, stream, set);
      queuedSignals.forEach((signal) => peer?.signal(signal));
      queuedSignals = [];

      signalingClient.send({
        type: 'call.initiate',
        callId,
        to: state.dialNumber,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start call';
      set(() => ({ callState: 'error', error: message, statusMessage: message }));
      appendLog(set, `Call error: ${message}`);
    }
  },

  acceptIncomingCall: async () => {
    const state = get();
    if (!state.callId) {
      return;
    }

    try {
      // Answering flips the direction – we join the existing offer.
      const stream = await ensureLocalStream(set, get);
      peer = await createPeer(false, state.callId, stream, set);
      queuedSignals.forEach((signal) => peer?.signal(signal));
      queuedSignals = [];

      signalingClient?.send({ type: 'call.answer', callId: state.callId });
      set(() => ({ callState: 'connecting', statusMessage: 'Answering call...' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to answer call';
      set(() => ({ callState: 'error', error: message, statusMessage: message }));
      appendLog(set, `Answer error: ${message}`);
    }
  },

  hangup: () => {
    const state = get();
    if (state.callId) {
      signalingClient?.send({ type: 'call.ended', callId: state.callId });
    }
    // Ensure both media and signalling state transitions to "idle".
    cleanupPeer(set, get);
    set(() => ({ callState: 'ended', statusMessage: 'Call ended', callId: null, incomingNumber: null }));
    appendLog(set, 'Call ended');
  },

  handleSignalingEvent: (event: SignalingEvent) => {
    // All signalling messages funnel through this reducer so we have a single
    // place to reason about call state transitions.
    const state = get();
    switch (event.type) {
      case 'call.incoming': {
        const callId = (event.callId as string) ?? crypto.randomUUID();
        const from = (event.from as string) ?? 'Unknown';
        set(() => ({ callId, callState: 'ringing', incomingNumber: from, statusMessage: 'Incoming call' }));
        appendLog(set, `Incoming call from ${from}`);
        break;
      }
      case 'call.ringing': {
        // Remote PBX confirmed the call is alerting the destination.
        set(() => ({ callState: 'ringing', statusMessage: 'Ringing...' }));
        appendLog(set, 'Remote phone ringing');
        break;
      }
      case 'call.connected': {
        set(() => ({ callState: 'in-call', statusMessage: 'Call connected' }));
        appendLog(set, 'Call connected');
        break;
      }
      case 'call.ended': {
        // Either party hung up – mirror the termination and release resources.
        appendLog(set, 'Remote ended the call');
        cleanupPeer(set, get);
        set(() => ({ callState: 'ended', statusMessage: 'Call ended by remote', callId: null, incomingNumber: null }));
        break;
      }
      case 'call.error': {
        // Transport/PBX errors surface as a final terminal state.
        const message = (event.message as string) ?? 'Call error';
        appendLog(set, message);
        set(() => ({ callState: 'error', statusMessage: message, error: message }));
        cleanupPeer(set, get);
        break;
      }
      case 'signal': {
        const data = event.data as SignalData | undefined;
        if (!data) {
          break;
        }

        // During setup we may not have a Simple-Peer instance yet. Buffer until ready.
        if (peer) {
          peer.signal(data);
        } else {
          queuedSignals.push(data);
        }
        break;
      }
      case 'presence': {
        // Presence events currently just surface in the on-screen log.
        const message = (event.message as string) ?? 'Presence update';
        appendLog(set, message);
        break;
      }
      default: {
        appendLog(set, `Unhandled signaling event: ${event.type}`);
      }
    }
  },
}));

export default useSoftphoneStore;


