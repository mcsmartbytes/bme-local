'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useFirm } from '@/contexts/FirmContext';
import { useEntity } from '@/contexts/EntityContext';
import { useFeatureToggle } from '@/contexts/FeatureToggleContext';
import EntitySwitcher from '@/components/EntitySwitcher';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavCategory {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

// Top-level items (no category)
const topItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
];

// Categorized navigation
const navCategories: NavCategory[] = [
  {
    id: 'sales',
    label: 'Sales & Revenue',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    items: [
      { href: '/dashboard/customers', label: 'Customers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7' },
      { href: '/dashboard/estimates', label: 'Estimates', icon: 'M9 5H7a2 2 0 00-2 2v12' },
      { href: '/dashboard/invoices', label: 'Invoices', icon: 'M9 12h6m-6 4h6' },
      { href: '/dashboard/deposits', label: 'Deposits', icon: 'M17 9V7a2 2 0 00-2-2H5' },
    ],
  },
  {
    id: 'purchasing',
    label: 'Purchasing & Costs',
    icon: 'M3 10h18',
    items: [
      { href: '/dashboard/vendors', label: 'Vendors', icon: 'M19 21V5a2 2 0 00-2-2H7' },
      { href: '/dashboard/bills', label: 'Bills', icon: 'M17 9V7a2 2 0 00-2-2H5' },
      { href: '/dashboard/expenses', label: 'Expenses', icon: 'M9 14l6-6' },
      { href: '/dashboard/bridge-inbox', label: 'Recent Activity', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
      { href: '/dashboard/payments', label: 'Payments', icon: 'M12 8c-1.657 0-3 .895-3 2' },
    ],
  },

  // -----------------------------
  // NEW PAYROLL SECTION
  // -----------------------------
  {
    id: 'payroll',
    label: 'Payroll',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z',
    items: [
      {
        href: '/dashboard/payroll',
        label: 'Payroll Dashboard',
        icon: 'M3 13h2v-2H3v2zm4 0h2V7H7v6zm4 0h2V4h-2v9zm4 0h2v-6h-2v6zm4 0h2v-3h-2v3z'
      },
      {
        href: '/dashboard/payroll/employees',
        label: 'Employees',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7'
      },
      {
        href: '/dashboard/payroll/timecards',
        label: 'Timecards',
        icon: 'M9 5H7a2 2 0 00-2 2v12'
      },
      {
        href: '/dashboard/payroll/runs',
        label: 'Payroll Runs',
        icon: 'M12 8c-1.657 0-3 .895-3 2'
      },
      {
        href: '/dashboard/payroll/contractors',
        label: '1099 Contractors',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586'
      }
    ],
  },

  {
    id: 'accounting',
    label: 'Accounting',
    icon: 'M9 7h6',
    items: [
      { href: '/dashboard/accounts', label: 'Chart of Accounts', icon: 'M9 7h6' },
      { href: '/dashboard/journal', label: 'Journal Entries', icon: 'M12 6.253v13' },
      { href: '/dashboard/banking', label: 'Banking', icon: 'M3 10h18' },
      { href: '/dashboard/products', label: 'Products & Services', icon: 'M20 7l-8-4-8 4' },
      { href: '/dashboard/categories', label: 'Categories', icon: 'M7 7h.01' },
      { href: '/dashboard/tax', label: 'Tax Center', icon: 'M9 12h6' },
    ],
  },

  {
    id: 'reports',
    label: 'Reports & Tools',
    icon: 'M9 19v-6',
    items: [
      { href: '/dashboard/reports', label: 'All Reports', icon: 'M9 19v-6' },
      { href: '/dashboard/reports/contractors', label: '1099 Contractor Report', icon: 'M9 12h6m-6 4h6' },
      { href: '/dashboard/expenses/dashboard', label: 'Expense Insights', icon: 'M11 3.055' },
      { href: '/dashboard/expenses/budgets', label: 'Budgets', icon: 'M11 3.055' },
      { href: '/dashboard/expenses/mileage', label: 'Mileage Tracker', icon: 'M9 20l-5.447' },
      { href: '/dashboard/expenses/subscriptions', label: 'Subscriptions', icon: 'M4 4v5' },
      { href: '/dashboard/expenses/price-tracker', label: 'Price Tracker', icon: 'M7 12l3-3' },
      { href: '/dashboard/irs', label: 'IRS References', icon: 'M9 12h6' },
    ],
  },
];

const bottomItems: NavItem[] = [
  { href: '/dashboard/settings/entities', label: 'Entities', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isEmbedded, signOut } = useAuth();
  const { isBookkeeper, selectedClient, clearClient } = useFirm();
  const { entities } = useEntity();
  const { isFeatureEnabled } = useFeatureToggle();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const cat of navCategories) {
      if (cat.items.some(item => pathname === item.href || pathname.startsWith(item.href))) {
        initial.add(cat.id);
      }
    }
    return initial;
  });

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!loading && !user && !isEmbedded) {
      router.push('/login');
    }
  }, [user, loading, isEmbedded, router]);

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-corporate-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isEmbedded) {
    return (
      <div className="min-h-screen bg-corporate-light">
        <main className="p-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-corporate-light">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-corporate-dark transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-corporate-navy">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-bold text-white">Books Made Easy</span>
          </div>

          {isBookkeeper && selectedClient && (
            <div className="px-4 py-3 bg-corporate-navy border-b border-corporate-navy">
              <button
                onClick={() => {
                  router.push('/firm-dashboard');
                  clearClient();
                }}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors mb-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Clients
              </button>
              <p className="text-sm font-medium text-white truncate">
                {selectedClient.organizations?.name || 'Client'}
              </p>
            </div>
          )}

          <EntitySwitcher />

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {topItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-corporate-navy hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}

            {navCategories
            .filter((category) => {
              if (category.id === 'jobs' && !isFeatureEnabled('job_costing')) return false;
              return true;
            })
            .map((category) => {
              const isOpen = openCategories.has(category.id);
              const hasActiveChild = category.items.some(
                item => pathname === item.href || pathname.startsWith(item.href)
              );

              return (
                <div key={category.id}>
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      hasActiveChild && !isOpen
                        ? 'bg-corporate-navy text-white'
                        : 'text-gray-300 hover:bg-corporate-navy hover:text-white'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={category.icon} />
                    </svg>
                    <span className="font-medium flex-1 text-left">{category.label}</span>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-corporate-navy pl-2">
                      {category.items.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                              isActive
                                ? 'bg-primary-600 text-white'
                                : 'text-gray-400 hover:bg-corporate-navy hover:text-white'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                            <span className="font-medium">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="pt-4 mt-4 border-t border-corporate-navy">
              {bottomItems.filter(item =>
                item.href !== '/dashboard/settings/entities' || isBookkeeper || entities.length > 1
              ).map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-300 hover:bg-corporate-navy hover:text-white'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {isBookkeeper && (
            <div className="px-4 pt-2 pb-0">
              <Link
                href="/firm-dashboard"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  pathname === '/firm-dashboard' || pathname.startsWith('/firm-dashboard')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-corporate-navy hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-medium">Bookkeeper Portal</span>
              </Link>
            </div>
          )}

          <div className="px-4 py-4 border-t border-corporate-navy">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full mt-2 flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-corporate-navy hover:text-white rounded-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-corporate-slate hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex-1 lg:flex-none"></div>

            <div className="flex items-center gap-4">
              {/* Notification bell removed 2026-04-28 — was non-functional and
                  appearing as a duplicate alongside other UI badges. Will
                  return when wired to Recent Activity or transaction_alerts
                  with a real click-through. */}
            </div>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}