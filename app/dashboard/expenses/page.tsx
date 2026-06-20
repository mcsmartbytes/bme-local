'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';

interface Category {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  vendor: string | null;
  is_business: boolean;
  payment_method?: string | null;
  notes?: string | null;
  category_id?: string | null;
  category: Category | null;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'business' | 'personal'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'quarter' | 'year'>('all');
  const [query, setQuery] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    date: '',
    vendor: '',
    payment_method: 'credit',
    is_business: true,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const response = await apiFetch('/api/categories?type=expense');
      const result = await response.json();
      if (result.success && result.data) setCategories(result.data);
    } catch {
      // ignore
    }
  }

  async function loadExpenses() {
    try {
      const response = await apiFetch('/api/expenses?pageSize=500');
      const result = await response.json();
      if (result.success && result.data) {
        setExpenses(result.data.map((row: Expense & { categories?: Category | null }) => ({
          ...row,
          category: row.category || row.categories || null,
        })));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExpense) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/expenses', {
        method: 'PUT',
        body: JSON.stringify({
          id: editingExpense.id,
          amount: parseFloat(editFormData.amount || '0'),
          description: editFormData.description,
          category_id: editFormData.category_id || null,
          date: editFormData.date,
          vendor: editFormData.vendor || null,
          payment_method: editFormData.payment_method || null,
          is_business: editFormData.is_business,
          notes: editFormData.notes || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const updatedCategory = categories.find((c) => c.id === editFormData.category_id) || null;
      setExpenses((prev) => prev.map((e) => e.id === editingExpense.id ? {
        ...e,
        amount: parseFloat(editFormData.amount || '0'),
        description: editFormData.description,
        category_id: editFormData.category_id || null,
        category: updatedCategory,
        date: editFormData.date,
        vendor: editFormData.vendor || null,
        payment_method: editFormData.payment_method,
        is_business: editFormData.is_business,
        notes: editFormData.notes || null,
      } : e));
      setEditingExpense(null);
    } catch {
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      const res = await apiFetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete expense');
    }
  }

  function getFilteredExpenses() {
    let filtered = expenses;
    if (filterType === 'business') filtered = filtered.filter((e) => e.is_business);
    else if (filterType === 'personal') filtered = filtered.filter((e) => !e.is_business);

    const now = new Date();
    if (dateRange === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter((e) => new Date(e.date) >= startOfMonth);
    } else if (dateRange === 'quarter') {
      const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      filtered = filtered.filter((e) => new Date(e.date) >= startOfQuarter);
    } else if (dateRange === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filtered = filtered.filter((e) => new Date(e.date) >= startOfYear);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((e) =>
        (e.description || '').toLowerCase().includes(q) ||
        (e.vendor || '').toLowerCase().includes(q),
      );
    }
    return filtered;
  }

  const filteredExpenses = getFilteredExpenses();
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const businessTotal = filteredExpenses.filter((e) => e.is_business).reduce((sum, e) => sum + e.amount, 0);
  const personalTotal = filteredExpenses.filter((e) => !e.is_business).reduce((sum, e) => sum + e.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Expenses</h1>
          <p className="text-corporate-gray mt-1">Track and manage business and personal expenses</p>
        </div>
        <Link href="/dashboard/expenses/new" className="btn-primary">
          Add Expense
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex flex-wrap gap-3">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)} className="input-field text-sm">
              <option value="all">All Types</option>
              <option value="business">Business Only</option>
              <option value="personal">Personal Only</option>
            </select>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value as typeof dateRange)} className="input-field text-sm">
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="input-field text-sm" />
          </div>
          <div className="bg-corporate-light rounded-lg p-3 grid grid-cols-3 gap-4 text-sm min-w-[280px]">
            <div><p className="text-corporate-gray">Total</p><p className="font-semibold">${totalAmount.toFixed(2)}</p></div>
            <div><p className="text-corporate-gray">Business</p><p className="font-semibold text-primary-600">${businessTotal.toFixed(2)}</p></div>
            <div><p className="text-corporate-gray">Personal</p><p className="font-semibold">${personalTotal.toFixed(2)}</p></div>
          </div>
        </div>
      </div>

      {filteredExpenses.length === 0 ? (
        <div className="card text-center py-12 text-corporate-gray">No expenses found.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Vendor</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{new Date(expense.date).toLocaleDateString()}</td>
                  <td>{expense.description}</td>
                  <td>{expense.category ? `${expense.category.icon || ''} ${expense.category.name}` : '-'}</td>
                  <td>{expense.vendor || '-'}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs ${expense.is_business ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-800'}`}>
                      {expense.is_business ? 'Business' : 'Personal'}
                    </span>
                  </td>
                  <td className="text-right font-medium">${expense.amount.toFixed(2)}</td>
                  <td className="text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingExpense(expense);
                        setEditFormData({
                          amount: expense.amount.toString(),
                          description: expense.description,
                          category_id: expense.category_id || '',
                          date: expense.date,
                          vendor: expense.vendor || '',
                          payment_method: expense.payment_method || 'credit',
                          is_business: expense.is_business,
                          notes: expense.notes || '',
                        });
                      }}
                      className="text-primary-600 hover:text-primary-700 text-sm"
                    >
                      Edit
                    </button>
                    <button onClick={() => deleteExpense(expense.id)} className="text-red-600 hover:text-red-700 text-sm">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-bold mb-4">Edit Expense</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="number" step="0.01" required value={editFormData.amount} onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })} className="input-field" placeholder="Amount" />
              <input type="date" required value={editFormData.date} onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })} className="input-field" />
              <input type="text" required value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} className="input-field" placeholder="Description" />
              <select value={editFormData.category_id} onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value })} className="input-field">
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
              <input type="text" value={editFormData.vendor} onChange={(e) => setEditFormData({ ...editFormData, vendor: e.target.value })} className="input-field" placeholder="Vendor" />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editFormData.is_business} onChange={(e) => setEditFormData({ ...editFormData, is_business: e.target.checked })} />
                Business expense
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingExpense(null)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}