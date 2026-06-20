'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';

interface Report {
  id: string;
  name: string;
  description: string;
  category: string;
  href: string;
}

const reports: Report[] = [
  { id: 'profit-loss', name: 'Profit & Loss', description: 'Income and expenses summary', category: 'Financial Statements', href: '/dashboard/reports/profit-loss' },
  { id: 'balance-sheet', name: 'Balance Sheet', description: 'Assets, liabilities, and equity', category: 'Financial Statements', href: '/dashboard/reports/balance-sheet' },
  { id: 'ar-aging', name: 'A/R Aging Summary', description: 'Outstanding customer balances by age', category: 'Receivables', href: '/dashboard/reports/ar-aging' },
  { id: 'ap-aging', name: 'A/P Aging Summary', description: 'Outstanding vendor balances by age', category: 'Payables', href: '/dashboard/reports/ap-aging' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [quickStats, setQuickStats] = useState({ revenue: 0, expenses: 0, netIncome: 0, margin: 0 });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await apiFetch('/api/reports?type=profit-loss');
        const json = await res.json();
        if (json.success && json.data) {
          const revenue = json.data.income?.total || 0;
          const expenses = json.data.expenses?.total || 0;
          const netIncome = json.data.netProfit || 0;
          const margin = json.data.profitMargin || 0;
          setQuickStats({ revenue, expenses, netIncome, margin });
        }
      } catch {
        // ignore
      }
    };
    loadStats();
  }, []);

  const categories = ['all', ...Array.from(new Set(reports.map((r) => r.category)))];
  const filteredReports = selectedCategory === 'all'
    ? reports
    : reports.filter((r) => r.category === selectedCategory);

  const groupedReports = filteredReports.reduce((groups, report) => {
    if (!groups[report.category]) groups[report.category] = [];
    groups[report.category].push(report);
    return groups;
  }, {} as Record<string, Report[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-corporate-dark">Reports</h1>
        <p className="text-corporate-gray mt-1">Generate financial reports and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">YTD Revenue</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(quickStats.revenue)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">YTD Expenses</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(quickStats.expenses)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Net Income</p>
          <p className={`text-xl font-bold ${quickStats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(quickStats.netIncome)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Profit Margin</p>
          <p className="text-xl font-bold text-corporate-dark">{quickStats.margin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="card">
        <label className="label">Category</label>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="input-field max-w-xs">
          <option value="all">All Reports</option>
          {categories.filter((c) => c !== 'all').map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      {Object.entries(groupedReports).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold text-corporate-dark mb-3">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((report) => (
              <Link key={report.id} href={report.href} className="card hover:shadow-lg transition-shadow">
                <h3 className="font-semibold text-corporate-dark">{report.name}</h3>
                <p className="text-sm text-corporate-gray mt-1">{report.description}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}