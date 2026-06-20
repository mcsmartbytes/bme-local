'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';

interface ReportData {
  income: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number;
}

export default function ProfitLossReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData>({
    income: [],
    expenses: [],
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    profitMargin: 0,
  });
  const [dateRange, setDateRange] = useState('this-year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const getDateRange = (range: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (range) {
      case 'this-month':
        return {
          start: new Date(year, month, 1).toISOString().split('T')[0],
          end: new Date(year, month + 1, 0).toISOString().split('T')[0],
        };
      case 'last-month':
        return {
          start: new Date(year, month - 1, 1).toISOString().split('T')[0],
          end: new Date(year, month, 0).toISOString().split('T')[0],
        };
      case 'this-quarter': {
        const qStart = Math.floor(month / 3) * 3;
        return {
          start: new Date(year, qStart, 1).toISOString().split('T')[0],
          end: new Date(year, qStart + 3, 0).toISOString().split('T')[0],
        };
      }
      case 'this-year':
        return {
          start: new Date(year, 0, 1).toISOString().split('T')[0],
          end: new Date(year, 11, 31).toISOString().split('T')[0],
        };
      case 'last-year':
        return {
          start: new Date(year - 1, 0, 1).toISOString().split('T')[0],
          end: new Date(year - 1, 11, 31).toISOString().split('T')[0],
        };
      default:
        return { start: startDate, end: endDate };
    }
  };

  useEffect(() => {
    const dates = getDateRange(dateRange);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }, [dateRange]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    loadReportData();
  }, [startDate, endDate]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/reports?type=profit-loss&start_date=${startDate}&end_date=${endDate}`);
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        const expenses = Object.entries(d.expenses?.byCategory || {}).map(([category, amount]) => ({
          category,
          amount: Number(amount),
        })).sort((a, b) => b.amount - a.amount);

        setData({
          income: [{ category: 'Sales Revenue', amount: d.income?.total || 0 }],
          expenses,
          totalIncome: d.income?.total || 0,
          totalExpenses: d.expenses?.total || 0,
          netIncome: d.netProfit || 0,
          profitMargin: d.profitMargin || 0,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDateRange = () => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/reports" className="text-corporate-gray hover:text-corporate-dark">Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Profit & Loss</h1>
          <p className="text-corporate-gray">{formatDateRange()}</p>
        </div>
      </div>

      <div className="card">
        <label className="label">Date Range</label>
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="input-field max-w-xs">
          <option value="this-month">This Month</option>
          <option value="last-month">Last Month</option>
          <option value="this-quarter">This Quarter</option>
          <option value="this-year">This Year</option>
          <option value="last-year">Last Year</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card"><p className="text-sm text-corporate-gray">Total Income</p><p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalIncome)}</p></div>
            <div className="stat-card"><p className="text-sm text-corporate-gray">Total Expenses</p><p className="text-2xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</p></div>
            <div className="stat-card"><p className="text-sm text-corporate-gray">Net Income</p><p className={`text-2xl font-bold ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(data.netIncome)}</p></div>
          </div>

          <div className="card space-y-6">
            <h2 className="text-lg font-semibold">Profit & Loss Statement</h2>
            <div>
              <h3 className="text-sm font-semibold text-corporate-gray uppercase mb-3">Income</h3>
              {data.income.map((item, index) => (
                <div key={index} className="flex justify-between py-2 border-b">
                  <span>{item.category}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-corporate-gray uppercase mb-3">Expenses</h3>
              {data.expenses.length === 0 ? (
                <p className="text-corporate-gray text-sm">No expenses for this period</p>
              ) : data.expenses.map((item, index) => (
                <div key={index} className="flex justify-between py-2 border-b">
                  <span>{item.category}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
            <div className={`p-4 rounded-lg ${data.netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="flex justify-between">
                <span className="font-semibold">Net {data.netIncome >= 0 ? 'Income' : 'Loss'}</span>
                <span className="font-bold">{formatCurrency(Math.abs(data.netIncome))}</span>
              </div>
              <p className="text-sm mt-2">Profit margin: {data.profitMargin.toFixed(1)}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}