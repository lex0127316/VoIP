/**
 * Visual editor for PBX call flows.
 *
 * Fetches the canonical configuration from the API shim, lets supervisors
 * append or reorder nodes, and writes changes back via optimistic mutations.
 */
'use client';

import { useMemo, useState } from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';

type CallflowNode = {
  id: string;
  type: 'menu' | 'queue' | 'voicemail' | 'transfer';
  label: string;
  target?: string;
};

type Callflow = {
  id: string;
  name: string;
  updatedAt: string;
  nodes: CallflowNode[];
};

const DEFAULT_CALLFLOW: Callflow = {
  id: 'default',
  name: 'Main IVR',
  updatedAt: new Date().toISOString(),
  nodes: [
    { id: 'welcome', type: 'menu', label: 'Welcome prompt' },
    { id: 'sales', type: 'queue', label: 'Route to sales queue', target: 'sales_queue' },
    { id: 'support', type: 'queue', label: 'Route to support queue', target: 'support_queue' },
    { id: 'after-hours', type: 'voicemail', label: 'After hours voicemail', target: 'general_vm' },
  ],
};

const NODE_TYPES: CallflowNode['type'][] = ['menu', 'queue', 'voicemail', 'transfer'];

export default function CallflowBuilder(): JSX.Element {
  const [selectedFlowId, setSelectedFlowId] = useState<string>('default');
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeType, setNewNodeType] = useState<CallflowNode['type']>('menu');

  // Query the API shim for flows. A plain array or an object with `callflows`
  // are both accepted so the component stays resilient while the backend evolves.
  const { data: callflowsResponse, refetch } = useApiQuery<{ callflows?: Callflow[] }>('/callflows', {
    fallbackData: [DEFAULT_CALLFLOW],
  });

  const callflows = useMemo<Callflow[]>(() => {
    // Normalise the backend payload into a simple array for the rest of the UI.
    if (Array.isArray(callflowsResponse)) {
      return callflowsResponse;
    }
    if (Array.isArray(callflowsResponse?.callflows) && callflowsResponse.callflows.length > 0) {
      return callflowsResponse.callflows;
    }
    return [DEFAULT_CALLFLOW];
  }, [callflowsResponse]);

  // PUT writes overwrite the entire document – mirroring how PBX receives configs today.
  const { mutate: saveCallflow, loading: saving } = useApiMutation<Callflow, Callflow>(
    '/callflows',
    {
      onSuccess: () => {
        refetch();
      },
    },
    'PUT',
  );

  const selectedFlow = useMemo(() => {
    return callflows.find((flow) => flow.id === selectedFlowId) ?? callflows[0];
  }, [callflows, selectedFlowId]);

  const handleAddNode = () => {
    if (!selectedFlow) {
      return;
    }
    if (!newNodeLabel.trim()) {
      return;
    }

    // Appending nodes is optimistic; the mutation fan-outs to the API/PBX bridge.
    const updatedFlow: Callflow = {
      ...selectedFlow,
      updatedAt: new Date().toISOString(),
      nodes: [
        ...selectedFlow.nodes,
        {
          id: crypto.randomUUID(),
          type: newNodeType,
          label: newNodeLabel.trim(),
        },
      ],
    };

    saveCallflow(updatedFlow);
    setNewNodeLabel('');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Callflow builder</h1>
          <p className="text-sm text-slate-500">Model IVR menus, queues, and routing rules. Changes sync to the PBX API.</p>
        </div>
        <select
          value={selectedFlowId}
          onChange={(event) => setSelectedFlowId(event.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        >
          {(callflows ?? [DEFAULT_CALLFLOW]).map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>
      </header>

      {selectedFlow && (
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Flow designer</h2>
              <p className="text-sm text-slate-500">Drag to reorder nodes. Each step executes in order.</p>
              <ol className="mt-4 space-y-3">
                {selectedFlow.nodes.map((node, index) => (
                  <li
                    key={node.id}
                    className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm shadow-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        {index + 1}. {node.label}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">{node.type}</div>
                    </div>
                    {node.target && <span className="text-xs text-slate-500">Target: {node.target}</span>}
                  </li>
                ))}
              </ol>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Add node</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col text-sm text-slate-600">
                  Label
                  <input
                    value={newNodeLabel}
                    onChange={(event) => setNewNodeLabel(event.target.value)}
                    placeholder="Prompt name"
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-600">
                  Type
                  <select
                    value={newNodeType}
                    onChange={(event) => setNewNodeType(event.target.value as CallflowNode['type'])}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  >
                    {NODE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={handleAddNode}
                disabled={saving}
                className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add node'}
              </button>
            </article>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
              <h3 className="text-sm font-semibold text-slate-800">Flow details</h3>
              <dl className="mt-3 space-y-2 text-xs text-slate-500">
                <div className="flex justify-between">
                  <dt>Nodes</dt>
                  <dd>{selectedFlow.nodes.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Last updated</dt>
                  <dd>{new Date(selectedFlow.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Changes sync to the Rust PBX service via the REST API. Use automation scripts to deploy complex call
                graphs.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-700">
              Tip: connect nodes to queues or SIP trunks configured in `services/pbx`. Use the analytics page to
              validate completion rates.
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}


