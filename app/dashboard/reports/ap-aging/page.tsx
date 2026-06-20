'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';

interface AgingItem {
  billNumber: string;
  vendor: string;
  dueDate: string;
  total: number;
  outstanding: number;
  daysOverdue: number;
}

interface APReportData {
  asOf: string;
  aging: {
    current: AgingItem[];
    days1to30: AgingItem[];
    days31to60: AgingItem[];
    days61to90: AgingItem[];
    over90: AgingItem[];
  };
  totals: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
}

const buckets = [
  { key: 'current', label: 'Current' },
  { key: 'days1to30', label: '1-30 Days' },
  { key: 'days31to60', label: '31-60 Days' },
  { key: 'days61to90', label: '61-90 Days' },
  { key: 'over90', label: '90+ Days' },
] as const;

export default function APAgingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<APReportData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/reports?type=accounts-payable');
      const json = await res.json();
      if (json.success && json.data) setData(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const grandTotal = data
    ? Object.values(data.totals).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/reports" className="text-corporate-gray hover:text-corporate-dark">Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">A/P Aging Summary</h1>
          {data && <p className="text-corporate-gray">As of {data.asOf}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {buckets.map((bucket) => (
              <div key={bucket.key} className="stat-card">
                <p className="text-sm text-corporate-gray">{bucket.label}</p>
                <p className="text-xl font-bold">{formatCurrency(data.totals[bucket.key])}</p>
              </div>
            ))}
            <div className="stat-card bg-primary-50">
              <p className="text-sm text-primary-700">Total A/P</p>
              <p className="text-xl font-bold text-primary-700">{formatCurrency(grandTotal)}</p>
            </div>
          </div>

          {buckets.map((bucket) => {
            const items = data.aging[bucket.key];
            if (items.length === 0) return null;
            return (
              <div key={bucket.key} className="card overflow-hidden">
                <h2 className="text-lg font-semibold mb-4">{bucket.label}</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Vendor</th>
                      <th>Due Date</th>
                      <th className="text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={`${item.billNumber}-${i}`}>
                        <td>{item.billNumber}</td>
                        <td>{item.vendor}</td>
                        <td>{new Date(item.dueDate).toLocaleDateString()}</td>
                        <td className="text-right">{formatCurrency(item.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {grandTotal === 0 && (
            <div className="card text-center py-12 text-corporate-gray">No outstanding payables.</div>
          )}
        </>
      ) : (
        <div className="card text-center py-12 text-corporate-gray">Unable to load A/P aging.</div>
      )}
    </div>
  );
}