'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/utils/apiFetch';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalRevenue: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  customersCount: number;
  vendorsCount: number;
  invoicesDue: number;
  billsDue: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  amount?: number;
  date: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    (async () => {
      try {
        const res = await apiFetch('/api/dashboard');
        const json = await res.json();
        if (res.ok && json.success) {
          setStats(json.data.stats);
          setRecentActivity(json.data.recentActivity || []);
          setCompanyName(json.data.companyName || user.business_name || user.name || 'Your Business');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, router]);

  if (loading || authLoading) {
    return <div className="p-8 text-corporate-gray">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-corporate-dark mb-1">{companyName}</h1>
      <p className="text-corporate-gray mb-8">Welcome back, {user?.name || user?.email}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Revenue (paid)" value={stats?.totalRevenue ?? 0} prefix="$" />
        <StatCard label="Receivables" value={stats?.outstandingReceivables ?? 0} prefix="$" />
        <StatCard label="Payables" value={stats?.outstandingPayables ?? 0} prefix="$" />
        <StatCard label="Customers" value={stats?.customersCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-corporate-navy mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/customers" className="btn-secondary">Customers</Link>
            <Link href="/dashboard/invoices" className="btn-secondary">Invoices</Link>
            <Link href="/dashboard/bills" className="btn-secondary">Bills</Link>
            <Link href="/dashboard/vendors" className="btn-secondary">Vendors</Link>
            <Link href="/dashboard/accounts" className="btn-secondary">Chart of Accounts</Link>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-corporate-navy mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-corporate-gray text-sm">No recent activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map(a => (
                <li key={a.id} className="text-sm flex justify-between">
                  <span>{a.description}</span>
                  <span className="text-corporate-gray">{a.date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(stats?.invoicesDue ?? 0) > 0 && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          {stats?.invoicesDue} invoice(s) past due — <Link href="/dashboard/invoices" className="text-primary-600 underline">review</Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, prefix = '' }: { label: string; value: number; prefix?: string }) {
  const formatted = prefix
    ? `${prefix}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : String(value);
  return (
    <div className="stat-card">
      <p className="text-sm text-corporate-gray">{label}</p>
      <p className="text-2xl font-bold text-corporate-dark mt-1">{formatted}</p>
    </div>
  );
}