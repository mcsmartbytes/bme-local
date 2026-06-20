'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';

type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';

interface EstimateItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
}

interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string;
  status: EstimateStatus;
  issue_date: string;
  expiry_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  converted_invoice_id: string | null;
  customers?: {
    id: string;
    name: string;
    email: string;
    company: string;
    address?: string;
    phone?: string;
  } | null;
  estimate_items?: EstimateItem[];
}

export default function EstimateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const estimateId = params.id as string;

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEstimate();
  }, [estimateId]);

  const loadEstimate = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/estimates?id=${estimateId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setEstimate(json.data);
      } else {
        router.push('/dashboard/estimates');
      }
    } catch (error) {
      console.error('Error loading estimate:', error);
      router.push('/dashboard/estimates');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: EstimateStatus) => {
    if (!estimate) return;
    setUpdating(true);

    try {
      const res = await apiFetch('/api/estimates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: estimate.id, status }),
      });
      const result = await res.json();
      if (result.success) {
        setEstimate({ ...estimate, status });
      } else {
        alert(result.error || 'Failed to update estimate');
      }
    } catch {
      alert('Failed to update estimate');
    } finally {
      setUpdating(false);
    }
  };

  const convertToInvoice = async () => {
    if (!estimate || estimate.status === 'converted') return;
    if (!confirm('Convert this estimate to an invoice?')) return;

    setConverting(true);
    try {
      const res = await apiFetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ convert_to_invoice: true, estimate_id: estimate.id }),
      });
      const result = await res.json();
      if (result.success && result.data?.invoice_id) {
        router.push(`/dashboard/invoices/${result.data.invoice_id}`);
      } else {
        alert(result.error || 'Failed to convert estimate');
      }
    } catch {
      alert('Failed to convert estimate');
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    if (!estimate) return;
    if (!confirm('Delete this estimate? This cannot be undone.')) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/estimates?id=${estimate.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        router.push('/dashboard/estimates');
      } else {
        alert(result.error || 'Failed to delete estimate');
      }
    } catch {
      alert('Failed to delete estimate');
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      amount || 0
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: EstimateStatus) => {
    const styles: Record<EstimateStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
      converted: 'bg-purple-100 text-purple-700',
    };
    const labels: Record<EstimateStatus, string> = {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      declined: 'Declined',
      expired: 'Expired',
      converted: 'Converted to Invoice',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="text-center py-12">
        <p className="text-corporate-gray">Estimate not found</p>
        <Link
          href="/dashboard/estimates"
          className="text-primary-600 hover:text-primary-700 mt-2 inline-block"
        >
          Back to Estimates
        </Link>
      </div>
    );
  }

  const lineItems = (estimate.estimate_items || []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const isExpired =
    new Date(estimate.expiry_date) < new Date() && estimate.status === 'sent';
  const displayStatus: EstimateStatus = isExpired ? 'expired' : estimate.status;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/estimates" className="text-corporate-gray hover:text-corporate-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <span className="text-lg font-semibold text-corporate-dark">
              {estimate.estimate_number}
            </span>
            {getStatusBadge(displayStatus)}
          </div>
          <p className="text-corporate-gray">
            Created on {formatDate(estimate.issue_date)}
            {estimate.status !== 'converted' && (
              <> • Expires {formatDate(estimate.expiry_date)}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {estimate.status === 'draft' && (
            <button
              type="button"
              onClick={() => updateStatus('sent')}
              disabled={updating}
              className="btn-primary disabled:opacity-50"
            >
              {updating ? 'Sending...' : 'Send Estimate'}
            </button>
          )}
          {estimate.status === 'sent' && !isExpired && (
            <>
              <button
                type="button"
                onClick={() => updateStatus('accepted')}
                disabled={updating}
                className="btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                Mark Accepted
              </button>
              <button
                type="button"
                onClick={() => updateStatus('declined')}
                disabled={updating}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
              >
                Mark Declined
              </button>
            </>
          )}
          {estimate.status === 'accepted' && (
            <button
              type="button"
              onClick={convertToInvoice}
              disabled={converting}
              className="btn-primary bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              {converting ? 'Converting...' : 'Convert to Invoice'}
            </button>
          )}
          {estimate.status === 'converted' && estimate.converted_invoice_id && (
            <Link
              href={`/dashboard/invoices/${estimate.converted_invoice_id}`}
              className="btn-secondary"
            >
              View Invoice
            </Link>
          )}
          {estimate.status === 'draft' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-corporate-dark mb-1">ESTIMATE</h2>
            <p className="text-corporate-gray">{estimate.estimate_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-corporate-gray">Issue Date</p>
            <p className="font-medium text-corporate-dark">{formatDate(estimate.issue_date)}</p>
            <p className="text-sm text-corporate-gray mt-2">Valid Until</p>
            <p className={`font-medium ${isExpired ? 'text-red-600' : 'text-corporate-dark'}`}>
              {formatDate(estimate.expiry_date)}
              {isExpired && ' (Expired)'}
            </p>
          </div>
        </div>

        <div className="py-6 border-b border-gray-200">
          <p className="text-sm text-corporate-gray mb-2">Prepared For</p>
          {estimate.customers && (
            <div>
              <p className="font-semibold text-corporate-dark">{estimate.customers.name}</p>
              {estimate.customers.company && (
                <p className="text-corporate-slate">{estimate.customers.company}</p>
              )}
              {estimate.customers.address && (
                <p className="text-corporate-slate">{estimate.customers.address}</p>
              )}
              {estimate.customers.email && (
                <p className="text-corporate-slate">{estimate.customers.email}</p>
              )}
              {estimate.customers.phone && (
                <p className="text-corporate-slate">{estimate.customers.phone}</p>
              )}
            </div>
          )}
        </div>

        <div className="py-6">
          {lineItems.length === 0 ? (
            <p className="text-corporate-gray text-sm">No line items on this estimate.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-corporate-gray border-b border-gray-200">
                  <th className="pb-3">Description</th>
                  <th className="pb-3 text-right">Qty</th>
                  <th className="pb-3 text-right">Rate</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-4 text-corporate-dark">{item.description}</td>
                    <td className="py-4 text-right text-corporate-slate">{item.quantity}</td>
                    <td className="py-4 text-right text-corporate-slate">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="py-4 text-right font-medium text-corporate-dark">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-corporate-slate">
                <span>Subtotal</span>
                <span>{formatCurrency(estimate.subtotal)}</span>
              </div>
              <div className="flex justify-between text-corporate-slate">
                <span>Tax</span>
                <span>{formatCurrency(estimate.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-corporate-dark pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatCurrency(estimate.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {(estimate.notes || estimate.terms) && (
          <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
            {estimate.notes && (
              <div>
                <p className="text-sm font-medium text-corporate-gray mb-1">Notes</p>
                <p className="text-corporate-slate whitespace-pre-wrap">{estimate.notes}</p>
              </div>
            )}
            {estimate.terms && (
              <div>
                <p className="text-sm font-medium text-corporate-gray mb-1">Terms & Conditions</p>
                <p className="text-corporate-slate whitespace-pre-wrap">{estimate.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}