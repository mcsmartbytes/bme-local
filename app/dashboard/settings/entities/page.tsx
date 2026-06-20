'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';
import { useEntity } from '@/contexts/EntityContext';

interface Entity {
  id: string;
  name: string;
  legal_name: string | null;
  entity_type: string;
  tax_id: string | null;
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function EntityManagementPage() {
  const { refreshEntities } = useEntity();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', legal_name: '', entity_type: 'company', tax_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const orgRes = await apiFetch('/api/organizations');
      const orgJson = await orgRes.json();
      if (!orgJson.success || !orgJson.data?.length) {
        setLoading(false);
        return;
      }
      const org = orgJson.data[0];
      setOrganization(org);

      const entRes = await apiFetch(`/api/entities?organization_id=${org.id}`);
      const entJson = await entRes.json();
      if (entJson.success) setEntities(entJson.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/entities', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organization.id,
          name: form.name,
          legal_name: form.legal_name || null,
          entity_type: form.entity_type,
          tax_id: form.tax_id || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowForm(false);
      setForm({ name: '', legal_name: '', entity_type: 'company', tax_id: '' });
      await loadData();
      await refreshEntities();
    } catch {
      alert('Failed to save entity');
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/settings" className="text-sm text-corporate-gray hover:text-primary-600">Settings</Link>
          <h1 className="text-2xl font-bold text-corporate-dark mt-1">Entities</h1>
          {organization && <p className="text-corporate-gray">{organization.name}</p>}
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">Add Entity</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <input className="input-field" required placeholder="Entity name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input-field" placeholder="Legal name" value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
          <select className="input-field" value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
            <option value="company">Company</option>
            <option value="division">Division</option>
            <option value="branch">Branch</option>
          </select>
          <input className="input-field" placeholder="Tax ID" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Tax ID</th>
            </tr>
          </thead>
          <tbody>
            {entities.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-8 text-corporate-gray">No entities yet</td></tr>
            ) : entities.map((entity) => (
              <tr key={entity.id}>
                <td>{entity.name}</td>
                <td className="capitalize">{entity.entity_type}</td>
                <td>{entity.tax_id || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}