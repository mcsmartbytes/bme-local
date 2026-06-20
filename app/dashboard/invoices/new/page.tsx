'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    invoice_number: `INV-${String(Date.now()).slice(-4)}`,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0 },
  ]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCustomers = async () => {
    const res = await apiFetch('/api/customers');
    const json = await res.json();
    if (res.ok && json.success) {
      const customersData: Customer[] = json.data || [];
      setCustomers(customersData);

      const customerId = searchParams.get('customer');
      if (customerId) {
        const customer = customersData.find((c) => c.id === customerId);
        if (customer) {
          setSelectedCustomer(customer);
          setCustomerSearch(customer.name);
        }
      }
    }
    setPageLoading(false);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.company?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: String(Date.now()), description: '', quantity: 1, rate: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const tax = subtotal * 0;
  const total = subtotal + tax;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'sent') => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Please select a customer');
      return;
    }
    setLoading(true);

    try {
      const res = await apiFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          invoice_number: formData.invoice_number,
          issue_date: formData.issue_date,
          due_date: formData.due_date,
          notes: formData.notes,
          status,
          items: lineItems
            .filter((i) => i.description)
            .map(({ description, quantity, rate }) => ({ description, quantity, rate })),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        router.push('/dashboard/invoices');
      } else {
        alert(json.error || 'Failed to create invoice');
      }
    } catch {
      alert('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">New Invoice</h1>
          <p className="text-corporate-gray mt-1">Create a new customer invoice</p>
        </div>
        <Link href="/dashboard/invoices" className="btn-secondary">
          Cancel
        </Link>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'draft')}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Selection */}
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Customer</h2>
              <div ref={customerRef} className="relative">
                <label className="label">Select Customer *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) setSelectedCustomer(null);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="input-field pr-10"
                    placeholder="Search customers..."
                  />
                  <svg
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-corporate-gray">
                        <p>No customers found</p>
                        <Link
                          href="/dashboard/customers"
                          className="text-primary-600 hover:underline text-sm"
                        >
                          + Add a customer
                        </Link>
                      </div>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${
                            selectedCustomer?.id === customer.id ? 'bg-primary-50' : ''
                          }`}
                        >
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-600 font-semibold">
                              {customer.name.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-corporate-dark truncate">
                              {customer.name}
                            </p>
                            <p className="text-sm text-corporate-gray truncate">
                              {customer.company || customer.email}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="mt-3 p-3 bg-primary-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-semibold">
                          {selectedCustomer.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-corporate-dark">{selectedCustomer.name}</p>
                        <p className="text-sm text-corporate-gray">{selectedCustomer.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch('');
                      }}
                      className="text-corporate-gray hover:text-red-600"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Line Items</h2>
              <div className="space-y-4">
                <div className="hidden sm:grid sm:grid-cols-12 gap-4 text-xs font-semibold text-corporate-gray uppercase">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Rate</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>

                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 items-start">
                    <div className="col-span-12 sm:col-span-6">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        className="input-field"
                        placeholder="Enter description..."
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className="input-field"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) =>
                          updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)
                        }
                        className="input-field"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2">
                      <span className="font-medium text-corporate-dark">
                        {formatCurrency(item.quantity * item.rate)}
                      </span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="p-1 text-corporate-gray hover:text-red-600"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addLineItem}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Line Item
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Notes</h2>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Add any notes or payment instructions..."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Invoice Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Invoice Number</label>
                  <input
                    type="text"
                    value={formData.invoice_number}
                    onChange={(e) =>
                      setFormData({ ...formData, invoice_number: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Issue Date</label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {/* Job Selection — disabled until jobs API is available */}
            <div className="card opacity-60">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Link to Job</h2>
              <p className="text-sm text-corporate-gray mb-3">
                Job linking will be available in a future update.
              </p>
              <select disabled className="input-field cursor-not-allowed">
                <option>Coming later</option>
              </select>
            </div>

            <div className="card bg-corporate-light">
              <div className="space-y-3">
                <div className="flex justify-between text-corporate-slate">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-corporate-slate">
                  <span>Tax (0%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="border-t border-gray-300 pt-3 flex justify-between text-lg font-bold text-corporate-dark">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e as unknown as React.FormEvent, 'sent')}
                disabled={loading || !selectedCustomer}
                className="w-full btn-primary disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create & Send Invoice'}
              </button>
              <button
                type="submit"
                disabled={loading || !selectedCustomer}
                className="w-full btn-secondary disabled:opacity-50"
              >
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}