'use client';

import { useEffect, useMemo, useRef } from 'react';
import useSoftphoneStore from '@/store/softphone';

const CALL_STATE_LABELS: Record<string, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  ringing: 'Ringing',
  'in-call': 'In Call',
  ended: 'Ended',
  error: 'Error',
};

export default function Softphone(): JSX.Element {
  const {
    callState,
    signalingStatus,
    statusMessage,
    dialNumber,
    incomingNumber,
    eventLog,
    localStream,
    remoteStream,
    connectSignaling,
    startOutgoingCall,
    acceptIncomingCall,
    hangup,
    setDialNumber,
  } = useSoftphoneStore();

  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (localAudioRef.current && localStream) {
      localAudioRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const canStartCall = useMemo(() => callState === 'idle' || callState === 'ended', [callState]);
  const canAnswer = callState === 'ringing';
  const canHangup = callState === 'connecting' || callState === 'in-call' || callState === 'ringing';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 p-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="text-xl font-semibold text-slate-800">Softphone</h2>
          <p className="text-sm text-slate-500">Connect to the signaling service to place and receive calls using WebRTC.</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <span className={`rounded-full px-4 py-1 text-sm font-medium ${
              signalingStatus === 'connected'
                ? 'bg-emerald-100 text-emerald-700'
                : signalingStatus === 'connecting'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
            >
              Signaling: {signalingStatus}
            </span>
            <span className={`rounded-full px-4 py-1 text-sm font-medium ${
              callState === 'in-call'
                ? 'bg-blue-100 text-blue-700'
                : callState === 'error'
                  ? 'bg-red-100 text-red-600'
                  : callState === 'ringing'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
            }`}
            >
              Call: {CALL_STATE_LABELS[callState] ?? callState}
            </span>
            {incomingNumber && (
              <span className="rounded-full bg-purple-100 px-4 py-1 text-sm font-medium text-purple-700">
                Incoming from {incomingNumber}
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={connectSignaling}
              className="rounded-xl border border-emerald-500 bg-emerald-500 px-6 py-4 text-left text-white shadow-md transition hover:bg-emerald-600"
            >
              <div className="text-lg font-semibold">Connect signaling</div>
              <p className="text-sm text-emerald-100">Authenticate and subscribe to live call events.</p>
            </button>
            <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Dial number</label>
              <input
                value={dialNumber}
                onChange={(event) => setDialNumber(event.target.value)}
                placeholder="e.g. +1 555 123 4567"
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={startOutgoingCall}
                  disabled={!canStartCall}
                  className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Call
                </button>
                <button
                  type="button"
                  onClick={acceptIncomingCall}
                  disabled={!canAnswer}
                  className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Answer
                </button>
                <button
                  type="button"
                  onClick={hangup}
                  disabled={!canHangup}
                  className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Hang up
                </button>
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {statusMessage}
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Local audio</h3>
              <audio ref={localAudioRef} muted controls className="mt-3 w-full" />
              <p className="mt-2 text-xs text-slate-400">Your microphone stream (muted locally).</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Remote audio</h3>
              <audio ref={remoteAudioRef} controls className="mt-3 w-full" />
              <p className="mt-2 text-xs text-slate-400">Remote media stream from connected peer.</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
          <h3 className="text-sm font-semibold text-slate-700">Event log</h3>
          <div className="mt-3 h-72 overflow-y-auto rounded-md bg-white p-3 text-xs text-slate-600">
            {eventLog.length === 0 ? (
              <p className="text-slate-400">No events yet.</p>
            ) : (
              <ul className="space-y-2">
                {eventLog
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li key={entry.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                      <div className="font-medium text-slate-700">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                      <div>{entry.message}</div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


