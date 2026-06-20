'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: 'draft' | 'posted';
  total_debits: number;
  total_credits: number;
  created_at: string;
  journal_entry_lines?: JournalLine[];
}

interface JournalLine {
  id: string;
  account_id: string;
  description: string;
  debit: number;
  credit: number;
  accounts?: {
    code: string;
    name: string;
    type: string;
  } | null;
}

export default function JournalEntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const entryId = params.id as string;
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  const loadEntry = async () => {
    try {
      const res = await apiFetch(`/api/journal-entries?id=${entryId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setEntry(json.data);
      } else {
        router.push('/dashboard/journal');
      }
    } catch (error) {
      console.error('Error loading journal entry:', error);
      router.push('/dashboard/journal');
    } finally {
      setLoading(false);
    }
  };

  const postEntry = async () => {
    if (!entry || entry.status === 'posted') return;

    if (Math.abs(entry.total_debits - entry.total_credits) >= 0.01) {
      alert('Cannot post: Debits and credits must be equal');
      return;
    }

    setPosting(true);
    try {
      const res = await apiFetch('/api/journal-entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, status: 'posted' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setEntry(json.data);
      } else {
        alert(json.error || 'Failed to post entry');
      }
    } catch (error) {
      console.error('Error posting journal entry:', error);
      alert('Failed to post entry');
    } finally {
      setPosting(false);
    }
  };

  const deleteEntry = async () => {
    if (!entry || entry.status === 'posted') return;
    if (!confirm('Are you sure you want to delete this journal entry?')) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/journal-entries?id=${entry.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        router.push('/dashboard/journal');
      } else {
        alert(json.error || 'Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      alert('Failed to delete entry');
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-12">
        <p className="text-corporate-gray">Journal entry not found</p>
        <Link href="/dashboard/journal" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          Back to Journal Entries
        </Link>
      </div>
    );
  }

  const lines = entry.journal_entry_lines || [];
  const isBalanced = Math.abs(entry.total_debits - entry.total_credits) < 0.01;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/journal" className="text-corporate-gray hover:text-corporate-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-lg font-semibold text-corporate-dark">{entry.entry_number}</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                entry.status === 'posted'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {entry.status === 'posted' ? 'Posted' : 'Draft'}
            </span>
          </div>
          <p className="text-corporate-gray">{formatDate(entry.entry_date)}</p>
        </div>
        <div className="flex items-center gap-3">
          {entry.status === 'draft' && (
            <>
              <button
                onClick={postEntry}
                disabled={posting || !isBalanced}
                className="btn-primary disabled:opacity-50"
              >
                {posting ? 'Posting...' : 'Post Entry'}
              </button>
              <button
                onClick={deleteEntry}
                disabled={deleting}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-sm text-corporate-gray">Entry Number</p>
            <p className="font-medium text-corporate-dark">{entry.entry_number}</p>
          </div>
          <div>
            <p className="text-sm text-corporate-gray">Date</p>
            <p className="font-medium text-corporate-dark">{formatDate(entry.entry_date)}</p>
          </div>
          <div>
            <p className="text-sm text-corporate-gray">Status</p>
            <p className={`font-medium ${entry.status === 'posted' ? 'text-green-600' : 'text-yellow-600'}`}>
              {entry.status === 'posted' ? 'Posted' : 'Draft'}
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm text-corporate-gray mb-1">Description</p>
          <p className="text-corporate-dark">{entry.description}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-corporate-dark mb-4">Journal Lines</h2>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Description</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <p className="font-medium text-corporate-dark">
                      {line.accounts?.code} - {line.accounts?.name}
                    </p>
                    <p className="text-xs text-corporate-gray">{line.accounts?.type}</p>
                  </td>
                  <td className="text-corporate-slate">{line.description || '—'}</td>
                  <td className="text-right font-medium text-corporate-dark">
                    {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                  </td>
                  <td className="text-right font-medium text-corporate-dark">
                    {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={2} className="font-semibold text-corporate-dark">
                  Totals
                </td>
                <td className="text-right font-bold text-corporate-dark">
                  {formatCurrency(entry.total_debits)}
                </td>
                <td className="text-right font-bold text-corporate-dark">
                  {formatCurrency(entry.total_credits)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={`mt-4 p-4 rounded-lg ${isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`font-medium ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
              {isBalanced ? '✓ Entry is balanced' : '✗ Entry is out of balance'}
            </span>
            {!isBalanced && (
              <span className="text-red-700 font-medium">
                Difference: {formatCurrency(Math.abs(entry.total_debits - entry.total_credits))}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-gray-50">
        <p className="text-sm text-corporate-gray">
          Created on {new Date(entry.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}