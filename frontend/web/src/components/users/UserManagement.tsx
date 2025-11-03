'use client';

import { useState } from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'supervisor';
  status: 'active' | 'invited' | 'disabled';
};

const FALLBACK_USERS: UserRecord[] = [
  { id: '1', name: 'Avery Harper', email: 'avery@example.com', role: 'admin', status: 'active' },
  { id: '2', name: 'Morgan Lee', email: 'morgan@example.com', role: 'agent', status: 'active' },
  { id: '3', name: 'Riley Chen', email: 'riley@example.com', role: 'supervisor', status: 'invited' },
];

export default function UserManagement(): JSX.Element {
  const [selectedRole, setSelectedRole] = useState<'all' | UserRecord['role']>('all');

  const { data: usersResponse, loading, error, refetch } = useApiQuery<{ users?: UserRecord[] }>('/users', {
    fallbackData: FALLBACK_USERS,
    pollIntervalMs: 60000,
  });

  const latestUsers = Array.isArray(usersResponse) ? usersResponse : usersResponse?.users;
  const users = latestUsers ?? FALLBACK_USERS;

  const { mutate: inviteUser, loading: inviting } = useApiMutation<Partial<UserRecord>, UserRecord>(
    '/users',
    {
      onSuccess: () => {
        refetch();
      },
    },
  );

  const filteredUsers = users.filter((user) => selectedRole === 'all' || user.role === selectedRole);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Manage access to the VoIP platform. Updates sync via the REST API.</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
          onClick={() =>
            inviteUser({
              name: 'New Agent',
              email: `agent+${Date.now()}@example.com`,
              role: 'agent',
              status: 'invited',
            })
          }
          disabled={inviting}
        >
          {inviting ? 'Inviting…' : 'Invite user'}
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Unable to load user list. Showing cached data.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">{filteredUsers.length} users</div>
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as typeof selectedRole)}
            className="w-48 rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All roles</option>
            <option value="admin">Admins</option>
            <option value="supervisor">Supervisors</option>
            <option value="agent">Agents</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{user.name}</td>
                  <td className="px-3 py-2 text-slate-500">{user.email}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase text-slate-600">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium uppercase ${
                        user.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : user.status === 'invited'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="mt-4 text-xs text-slate-400">Refreshing user directory…</div>
        )}
      </section>
    </div>
  );
}


