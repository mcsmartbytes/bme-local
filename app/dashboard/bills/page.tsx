'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/utils/apiFetch';
import { useEntity } from '@/contexts/EntityContext';

interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string;
  total: number;
  amount_paid: number;
  status: 'draft' | 'unpaid' | 'paid' | 'overdue' | 'partial';
  bill_date: string;
  due_date: string;
  category: string;
  vendors?: { id: string; name: string; email: string; company: string } | null;
}

interface ParsedLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface ParsedInvoice {
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  po_number: string | null;
  line_items: ParsedLineItem[];
  subtotal: number | null;
  tax_amount: number | null;
  total_amount_due: number;
  confidence_flags: string[];
}

export default function BillsPage() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { currentEntityId } = useEntity();

  // Invoice import state
  const [showImport, setShowImport]     = useState(false);
  const [importFile, setImportFile]     = useState<File | null>(null);
  const [importDrag, setImportDrag]     = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importError, setImportError]   = useState('');
  const [parsed, setParsed]             = useState<ParsedInvoice | null>(null);
  const [creating, setCreating]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetImport = () => {
    setShowImport(false); setImportFile(null); setImportError('');
    setParsed(null); setImporting(false); setCreating(false);
  };

  const handleParse = async () => {
    if (!importFile) return;
    setImporting(true); setImportError(''); setParsed(null);
    const form = new FormData();
    form.append('file', importFile);
    try {
      const res  = await apiFetch('/api/documents/parse-invoice', { method: 'POST', body: form });
      const json = await res.json();
      if (!json.success) { setImportError(json.error ?? 'Extraction failed'); return; }
      setParsed(json.data.parsed);
    } catch {
      setImportError('Parse failed — check your connection');
    } finally {
      setImporting(false);
    }
  };

  const handleCreateBill = async () => {
    if (!importFile || !parsed) return;
    setCreating(true); setImportError('');
    const form = new FormData();
    form.append('file', importFile);
    form.append('create_bill', 'true');
    try {
      const res  = await apiFetch('/api/documents/parse-invoice', { method: 'POST', body: form });
      const json = await res.json();
      if (!json.success) { setImportError(json.error ?? 'Bill creation failed'); return; }
      resetImport();
      if (json.data.bill?.id) {
        router.push(`/dashboard/bills/${json.data.bill.id}`);
      } else {
        loadBills();
      }
    } catch {
      setImportError('Bill creation failed');
    } finally {
      setCreating(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setImportDrag(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') { setImportFile(f); setParsed(null); }
    else setImportError('Only PDF files are accepted');
  };

  useEffect(() => {
    loadBills();
  }, [currentEntityId]);

  const loadBills = async () => {
    const res = await apiFetch('/api/bills');
    const result = await res.json();
    if (result.success) setBills(result.data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bill? This cannot be undone.')) return;

    const res = await apiFetch(`/api/bills?id=${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      loadBills();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusDisplay = (bill: Bill) => {
    // Show "Partial" if unpaid but has some payments
    const effectiveStatus = (bill.status === 'unpaid' && (bill.amount_paid || 0) > 0)
      ? 'partial' : bill.status;
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      unpaid: 'bg-orange-100 text-orange-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      partial: 'bg-yellow-100 text-yellow-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[effectiveStatus] || styles.draft}`}>
        {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
      </span>
    );
  };

  const filteredBills = bills.filter(bill => {
    const vendorName = bill.vendors?.name || '';
    const matchesSearch = bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = {
    all: bills.reduce((sum, b) => sum + b.total, 0),
    unpaid: bills.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + b.total - (b.amount_paid || 0), 0),
    overdue: bills.filter(b => b.status === 'overdue').reduce((sum, b) => sum + b.total - (b.amount_paid || 0), 0),
    paid: bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.total, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Bills</h1>
          <p className="text-corporate-gray mt-1">Track and pay vendor bills</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-primary-300 text-primary-700 hover:bg-primary-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Import Invoice
          </button>
          <Link href="/dashboard/bills/new" className="btn-primary flex items-center gap-2 justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Bill
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary-200" onClick={() => setStatusFilter('all')}>
          <p className="text-sm text-corporate-gray">Total Bills</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totals.all)}</p>
          <p className="text-xs text-corporate-gray">{bills.length} bills</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-orange-200" onClick={() => setStatusFilter('unpaid')}>
          <p className="text-sm text-corporate-gray">Unpaid</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(totals.unpaid)}</p>
          <p className="text-xs text-corporate-gray">{bills.filter(b => b.status === 'unpaid').length} bills</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-red-200" onClick={() => setStatusFilter('overdue')}>
          <p className="text-sm text-corporate-gray">Overdue</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totals.overdue)}</p>
          <p className="text-xs text-corporate-gray">{bills.filter(b => b.status === 'overdue').length} bills</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-green-200" onClick={() => setStatusFilter('paid')}>
          <p className="text-sm text-corporate-gray">Paid</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totals.paid)}</p>
          <p className="text-xs text-corporate-gray">{bills.filter(b => b.status === 'paid').length} bills</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search bills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Bills table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Vendor</th>
                <th>Category</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="text-right">Balance Due</th>
                <th className="text-right">Total</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-corporate-gray">
                    {bills.length === 0 ? (
                      <div>
                        <p>No bills yet.</p>
                        <Link href="/dashboard/bills/new" className="text-primary-600 hover:text-primary-700 mt-1 inline-block">
                          Create your first bill
                        </Link>
                      </div>
                    ) : (
                      'No bills match your search'
                    )}
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const balanceDue = bill.total - (bill.amount_paid || 0);
                  return (
                    <tr key={bill.id}>
                      <td>
                        <Link href={`/dashboard/bills/${bill.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                          {bill.bill_number}
                        </Link>
                      </td>
                      <td>
                        <p className="font-medium text-corporate-dark">{bill.vendors?.name || '-'}</p>
                        {bill.vendors?.email && (
                          <p className="text-xs text-corporate-gray">{bill.vendors.email}</p>
                        )}
                      </td>
                      <td>
                        {bill.category ? (
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs text-corporate-slate">
                            {bill.category}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="text-corporate-slate">
                        {new Date(bill.due_date).toLocaleDateString()}
                      </td>
                      <td>{getStatusDisplay(bill)}</td>
                      <td className="text-right font-semibold text-corporate-dark">
                        {bill.status === 'paid' ? '-' : formatCurrency(balanceDue)}
                      </td>
                      <td className="text-right text-corporate-slate">
                        {formatCurrency(bill.total)}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/bills/${bill.id}`}
                            className="p-2 text-corporate-gray hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="View"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          {(bill.status === 'unpaid' || bill.status === 'overdue' || bill.status === 'partial') && (
                            <Link
                              href={`/dashboard/payments/pay?bill=${bill.id}`}
                              className="p-2 text-corporate-gray hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Pay Bill"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </Link>
                          )}
                          {bill.status !== 'paid' && (
                            <button
                              onClick={() => handleDelete(bill.id)}
                              className="p-2 text-corporate-gray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Import Invoice Modal ─────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Import Invoice from PDF</h2>
                <p className="text-sm text-gray-500 mt-0.5">Drop a vendor invoice — Claude extracts all fields automatically</p>
              </div>
              <button onClick={resetImport} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{importError}</div>
              )}

              {/* Drop zone */}
              {!parsed && (
                <div
                  onDragOver={e => { e.preventDefault(); setImportDrag(true); }}
                  onDragLeave={() => setImportDrag(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                    importDrag ? 'border-primary-400 bg-primary-50' :
                    importFile ? 'border-emerald-400 bg-emerald-50' :
                    'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    ref={fileRef} type="file" accept=".pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setParsed(null); setImportError(''); } }}
                  />
                  {importFile ? (
                    <div>
                      <p className="text-base font-medium text-emerald-700">{importFile.name}</p>
                      <p className="text-sm text-emerald-600 mt-1">{(importFile.size / 1024).toFixed(0)} KB — ready to extract</p>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-gray-500">Drop PDF invoice here or <span className="text-primary-600 font-medium">browse</span></p>
                      <p className="text-xs text-gray-400 mt-1">Max 25 MB · PDF only</p>
                    </div>
                  )}
                </div>
              )}

              {/* Parsed preview */}
              {parsed && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-emerald-700 font-medium">Extraction complete — review before creating the bill</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Vendor"        value={parsed.vendor_name} />
                    <Field label="Invoice #"     value={parsed.invoice_number} />
                    <Field label="Invoice date"  value={parsed.invoice_date} />
                    <Field label="Due date"      value={parsed.due_date} />
                    <Field label="Payment terms" value={parsed.payment_terms} />
                    <Field label="PO reference"  value={parsed.po_number} />
                  </div>

                  {parsed.line_items.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Line Items</p>
                      <div className="bg-gray-50 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Description</th>
                              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Qty</th>
                              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Unit Price</th>
                              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {parsed.line_items.slice(0, 8).map((li, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 text-gray-700">{li.description}</td>
                                <td className="px-3 py-2 text-right text-gray-600">{li.quantity}</td>
                                <td className="px-3 py-2 text-right text-gray-600">${li.unit_price.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-medium text-gray-800">${li.line_total.toFixed(2)}</td>
                              </tr>
                            ))}
                            {parsed.line_items.length > 8 && (
                              <tr><td colSpan={4} className="px-3 py-2 text-xs text-gray-400 text-center">+{parsed.line_items.length - 8} more items</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    {parsed.subtotal != null && <Field label="Subtotal"  value={`$${parsed.subtotal.toFixed(2)}`} />}
                    {parsed.tax_amount != null && <Field label="Tax"     value={`$${parsed.tax_amount.toFixed(2)}`} />}
                    <Field label="Total due" value={`$${parsed.total_amount_due.toFixed(2)}`} highlight />
                  </div>

                  {parsed.confidence_flags.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Review these fields — Claude flagged them as uncertain:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {parsed.confidence_flags.map((f, i) => <li key={i} className="text-xs text-amber-700">{f}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <button onClick={resetImport} className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
                  Cancel
                </button>
                <div className="flex items-center gap-3">
                  {parsed && (
                    <button
                      onClick={() => { setParsed(null); setImportFile(null); }}
                      className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      Try another file
                    </button>
                  )}
                  {!parsed ? (
                    <button
                      onClick={handleParse}
                      disabled={!importFile || importing}
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {importing ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Extracting…</>
                      ) : 'Extract Data'}
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateBill}
                      disabled={creating}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {creating ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating Bill…</>
                      ) : 'Create Bill'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-primary-700 text-base' : 'text-gray-800'}`}>
        {value ?? <span className="text-gray-400 font-normal">—</span>}
      </p>
    </div>
  );
}
