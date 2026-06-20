'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFirm } from '@/contexts/FirmContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/utils/apiFetch';

interface ClientStats {
  close_status: 'none' | 'open' | 'complete';
  close_pct: number;
  doc_count: number;
  open_task_count: number;
  overdue_task_count: number;
}

export default function FirmDashboardPage() {
  const { firm, clients, loading, selectClient, viewOwnBooks, refreshClients } = useFirm();
  const { user } = useAuth();
  const [clientStats, setClientStats] = useState<Record<string, ClientStats>>({});
  const [showCreateFirm, setShowCreateFirm] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [firmName, setFirmName] = useState('');
  const [clientName, setClientName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firm || clients.length === 0) return;
    apiFetch('/api/firms/client-stats').then((r) => r.json()).then((json) => {
      if (json.success) setClientStats(json.data || {});
    }).catch(() => {});
  }, [firm, clients]);

  const handleCreateFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/firms', {
        method: 'POST',
        body: JSON.stringify({ name: firmName }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowCreateFirm(false);
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create firm');
    } finally {
      setSaving(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/firms/clients', {
        method: 'POST',
        body: JSON.stringify({ name: clientName }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setClientName('');
      setShowAddClient(false);
      await refreshClients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add client');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-corporate-dark">Bookkeeper Firm</h1>
        <p className="text-corporate-gray">Create your firm to manage multiple client books.</p>
        {showCreateFirm ? (
          <form onSubmit={handleCreateFirm} className="card space-y-4">
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <input className="input-field" required value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="Firm name" />
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Creating...' : 'Create Firm'}</button>
          </form>
        ) : (
          <button onClick={() => setShowCreateFirm(true)} className="btn-primary">Set Up Firm</button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">{firm.name}</h1>
          <p className="text-corporate-gray">Welcome, {user?.name || user?.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={viewOwnBooks} className="btn-secondary">My Own Books</button>
          <button onClick={() => setShowAddClient(true)} className="btn-primary">Add Client</button>
        </div>
      </div>

      {showAddClient && (
        <form onSubmit={handleAddClient} className="card space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input className="input-field" required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client business name" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAddClient(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Adding...' : 'Add Client'}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => {
          const stats = clientStats[client.organization_id];
          return (
            <button
              key={client.id}
              onClick={() => selectClient(client)}
              className="card text-left hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold text-corporate-dark">{client.organizations?.name || 'Client'}</h3>
              <p className="text-sm text-corporate-gray capitalize mt-1">{client.status}</p>
              {stats && (
                <div className="mt-3 text-xs text-corporate-gray space-y-1">
                  <p>Close: {stats.close_status} ({stats.close_pct}%)</p>
                  <p>{stats.open_task_count} open tasks · {stats.doc_count} docs</p>
                  {stats.overdue_task_count > 0 && (
                    <p className="text-red-600">{stats.overdue_task_count} overdue</p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {clients.length === 0 && (
        <div className="card text-center py-12 text-corporate-gray">
          No clients yet. Add your first client to get started.
        </div>
      )}

      <Link href="/dashboard/tasks" className="text-primary-600 hover:text-primary-700 text-sm">
        View all tasks
      </Link>
    </div>
  );
}