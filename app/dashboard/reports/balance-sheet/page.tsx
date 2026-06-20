'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';

interface BalanceSheetData {
  asOf: string;
  assets: { accountsReceivable: number; totalAssets: number };
  liabilities: { accountsPayable: number; totalLiabilities: number };
  equity: { retainedEarnings: number; totalEquity: number };
  totalLiabilitiesAndEquity: number;
}

export default function BalanceSheetPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BalanceSheetData | null>(null);

  useEffect(() => {
    loadBalanceSheet();
  }, []);

  const loadBalanceSheet = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/reports?type=balance-sheet');
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/reports" className="text-corporate-gray hover:text-corporate-dark">Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Balance Sheet</h1>
          {data && <p className="text-corporate-gray">As of {data.asOf}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : data ? (
        <div className="card space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-green-700 mb-4">Assets</h2>
            <div className="flex justify-between py-2 border-b">
              <span>Accounts Receivable</span>
              <span>{formatCurrency(data.assets.accountsReceivable)}</span>
            </div>
            <div className="flex justify-between py-3 font-bold bg-green-50 px-3 rounded-lg mt-2">
              <span>Total Assets</span>
              <span>{formatCurrency(data.assets.totalAssets)}</span>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-red-700 mb-4">Liabilities</h2>
            <div className="flex justify-between py-2 border-b">
              <span>Accounts Payable</span>
              <span>{formatCurrency(data.liabilities.accountsPayable)}</span>
            </div>
            <div className="flex justify-between py-3 font-bold bg-red-50 px-3 rounded-lg mt-2">
              <span>Total Liabilities</span>
              <span>{formatCurrency(data.liabilities.totalLiabilities)}</span>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary-700 mb-4">Equity</h2>
            <div className="flex justify-between py-2 border-b">
              <span>Retained Earnings</span>
              <span>{formatCurrency(data.equity.retainedEarnings)}</span>
            </div>
            <div className="flex justify-between py-3 font-bold bg-primary-50 px-3 rounded-lg mt-2">
              <span>Total Equity</span>
              <span>{formatCurrency(data.equity.totalEquity)}</span>
            </div>
          </section>

          <div className="flex justify-between py-4 border-t-2 font-bold text-lg">
            <span>Total Liabilities + Equity</span>
            <span>{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12 text-corporate-gray">Unable to load balance sheet.</div>
      )}
    </div>
  );
}