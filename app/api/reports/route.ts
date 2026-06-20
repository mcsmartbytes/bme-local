import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bills, customers, invoices, payments, vendors } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const reportType = sp.get('type') || 'profit-loss';
  const startDate = sp.get('start_date');
  const endDate = sp.get('end_date');

  try {
    switch (reportType) {
      case 'profit-loss':
        return await generateProfitLossReport(user.id, startDate, endDate);
      case 'balance-sheet':
        return await generateBalanceSheetReport(user.id);
      case 'cash-flow':
        return await generateCashFlowReport(user.id, startDate, endDate);
      case 'accounts-receivable':
        return await generateARReport(user.id);
      case 'accounts-payable':
        return await generateAPReport(user.id);
      case 'customer-summary':
        return await generateCustomerSummary(user.id, startDate, endDate);
      case 'vendor-summary':
        return await generateVendorSummary(user.id, startDate, endDate);
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

function periodBounds(startDate?: string | null, endDate?: string | null) {
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const end = endDate || now.toISOString().split('T')[0];
  return { start, end };
}

async function generateProfitLossReport(userId: string, startDate?: string | null, endDate?: string | null) {
  const { start, end } = periodBounds(startDate, endDate);

  const invoicesList = await db.select({ total: invoices.total, issue_date: invoices.issue_date })
    .from(invoices)
    .where(and(
      eq(invoices.user_id, userId),
      eq(invoices.status, 'paid'),
      gte(invoices.issue_date, start),
      lte(invoices.issue_date, end),
    ));

  const billsList = await db.select({ total: bills.total, category: bills.category, bill_date: bills.bill_date })
    .from(bills)
    .where(and(
      eq(bills.user_id, userId),
      eq(bills.status, 'paid'),
      gte(bills.bill_date, start),
      lte(bills.bill_date, end),
    ));

  const totalIncome = invoicesList.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const totalExpenses = billsList.reduce((sum, b) => sum + Number(b.total || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  const expensesByCategory: Record<string, number> = {};
  billsList.forEach((b) => {
    const cat = b.category || 'Uncategorized';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(b.total || 0);
  });

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Profit & Loss Statement',
      period: { start, end },
      income: {
        total: totalIncome,
        invoiceCount: invoicesList.length,
      },
      expenses: {
        total: totalExpenses,
        billCount: billsList.length,
        byCategory: expensesByCategory,
      },
      netProfit,
      profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
    },
  });
}

async function generateBalanceSheetReport(userId: string) {
  const invoicesData = await db.select({
    total: invoices.total,
    amount_paid: invoices.amount_paid,
    status: invoices.status,
  }).from(invoices).where(eq(invoices.user_id, userId));

  const billsData = await db.select({
    total: bills.total,
    amount_paid: bills.amount_paid,
    status: bills.status,
  }).from(bills).where(eq(bills.user_id, userId));

  const accountsReceivable = invoicesData
    .filter((i) => ['sent', 'overdue'].includes(i.status || ''))
    .reduce((sum, i) => sum + (Number(i.total || 0) - Number(i.amount_paid || 0)), 0);

  const accountsPayable = billsData
    .filter((b) => ['unpaid', 'overdue'].includes(b.status || ''))
    .reduce((sum, b) => sum + (Number(b.total || 0) - Number(b.amount_paid || 0)), 0);

  const totalRevenue = invoicesData
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total || 0), 0);

  const totalExpenses = billsData
    .filter((b) => b.status === 'paid')
    .reduce((sum, b) => sum + Number(b.total || 0), 0);

  const retainedEarnings = totalRevenue - totalExpenses;

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Balance Sheet',
      asOf: new Date().toISOString().split('T')[0],
      assets: {
        accountsReceivable,
        totalAssets: accountsReceivable,
      },
      liabilities: {
        accountsPayable,
        totalLiabilities: accountsPayable,
      },
      equity: {
        retainedEarnings,
        totalEquity: retainedEarnings,
      },
      totalLiabilitiesAndEquity: accountsPayable + retainedEarnings,
    },
  });
}

async function generateCashFlowReport(userId: string, startDate?: string | null, endDate?: string | null) {
  const { start, end } = periodBounds(startDate, endDate);

  const paymentRows = await db.select({
    amount: payments.amount,
    type: payments.type,
    payment_date: payments.payment_date,
  }).from(payments)
    .where(and(
      eq(payments.user_id, userId),
      gte(payments.payment_date, start),
      lte(payments.payment_date, end),
    ));

  const cashIn = paymentRows
    .filter((p) => p.type === 'received')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const cashOut = paymentRows
    .filter((p) => p.type === 'made')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Cash Flow Statement',
      period: { start, end },
      operating: {
        cashIn,
        cashOut,
        netCashFlow: cashIn - cashOut,
      },
      netChange: cashIn - cashOut,
    },
  });
}

async function generateARReport(userId: string) {
  const invoiceRows = await db.select().from(invoices)
    .where(and(
      eq(invoices.user_id, userId),
      inArray(invoices.status, ['sent', 'overdue']),
    ))
    .orderBy(invoices.due_date);

  const customerIds = [...new Set(invoiceRows.map((i) => i.customer_id).filter(Boolean))] as string[];
  const customerMap = new Map<string, { name: string; email: string | null }>();
  if (customerIds.length > 0) {
    const customerRows = await db.select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
    }).from(customers).where(inArray(customers.id, customerIds));
    customerRows.forEach((c) => customerMap.set(c.id, { name: c.name, email: c.email }));
  }

  const today = new Date();
  const aging = {
    current: [] as Array<Record<string, unknown>>,
    days1to30: [] as Array<Record<string, unknown>>,
    days31to60: [] as Array<Record<string, unknown>>,
    days61to90: [] as Array<Record<string, unknown>>,
    over90: [] as Array<Record<string, unknown>>,
  };

  invoiceRows.forEach((inv) => {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const outstanding = Number(inv.total || 0) - Number(inv.amount_paid || 0);
    const customer = inv.customer_id ? customerMap.get(inv.customer_id) : null;

    const item = {
      invoiceNumber: inv.invoice_number,
      customer: customer?.name || 'Unknown',
      dueDate: inv.due_date,
      total: inv.total,
      outstanding,
      daysOverdue: Math.max(0, daysOverdue),
    };

    if (daysOverdue <= 0) aging.current.push(item);
    else if (daysOverdue <= 30) aging.days1to30.push(item);
    else if (daysOverdue <= 60) aging.days31to60.push(item);
    else if (daysOverdue <= 90) aging.days61to90.push(item);
    else aging.over90.push(item);
  });

  const sumOutstanding = (items: Array<{ outstanding: number }>) =>
    items.reduce((s, i) => s + i.outstanding, 0);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Accounts Receivable Aging',
      asOf: today.toISOString().split('T')[0],
      aging,
      totals: {
        current: sumOutstanding(aging.current as Array<{ outstanding: number }>),
        days1to30: sumOutstanding(aging.days1to30 as Array<{ outstanding: number }>),
        days31to60: sumOutstanding(aging.days31to60 as Array<{ outstanding: number }>),
        days61to90: sumOutstanding(aging.days61to90 as Array<{ outstanding: number }>),
        over90: sumOutstanding(aging.over90 as Array<{ outstanding: number }>),
      },
    },
  });
}

async function generateAPReport(userId: string) {
  const billRows = await db.select().from(bills)
    .where(and(
      eq(bills.user_id, userId),
      inArray(bills.status, ['unpaid', 'overdue']),
    ))
    .orderBy(bills.due_date);

  const vendorIds = [...new Set(billRows.map((b) => b.vendor_id).filter(Boolean))] as string[];
  const vendorMap = new Map<string, { name: string; email: string | null }>();
  if (vendorIds.length > 0) {
    const vendorRows = await db.select({
      id: vendors.id,
      name: vendors.name,
      email: vendors.email,
    }).from(vendors).where(inArray(vendors.id, vendorIds));
    vendorRows.forEach((v) => vendorMap.set(v.id, { name: v.name, email: v.email }));
  }

  const today = new Date();
  const aging = {
    current: [] as Array<Record<string, unknown>>,
    days1to30: [] as Array<Record<string, unknown>>,
    days31to60: [] as Array<Record<string, unknown>>,
    days61to90: [] as Array<Record<string, unknown>>,
    over90: [] as Array<Record<string, unknown>>,
  };

  billRows.forEach((bill) => {
    const dueDate = new Date(bill.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const outstanding = Number(bill.total || 0) - Number(bill.amount_paid || 0);
    const vendor = bill.vendor_id ? vendorMap.get(bill.vendor_id) : null;

    const item = {
      billNumber: bill.bill_number,
      vendor: vendor?.name || 'Unknown',
      dueDate: bill.due_date,
      total: bill.total,
      outstanding,
      daysOverdue: Math.max(0, daysOverdue),
    };

    if (daysOverdue <= 0) aging.current.push(item);
    else if (daysOverdue <= 30) aging.days1to30.push(item);
    else if (daysOverdue <= 60) aging.days31to60.push(item);
    else if (daysOverdue <= 90) aging.days61to90.push(item);
    else aging.over90.push(item);
  });

  const sumOutstanding = (items: Array<{ outstanding: number }>) =>
    items.reduce((s, i) => s + i.outstanding, 0);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Accounts Payable Aging',
      asOf: today.toISOString().split('T')[0],
      aging,
      totals: {
        current: sumOutstanding(aging.current as Array<{ outstanding: number }>),
        days1to30: sumOutstanding(aging.days1to30 as Array<{ outstanding: number }>),
        days31to60: sumOutstanding(aging.days31to60 as Array<{ outstanding: number }>),
        days61to90: sumOutstanding(aging.days61to90 as Array<{ outstanding: number }>),
        over90: sumOutstanding(aging.over90 as Array<{ outstanding: number }>),
      },
    },
  });
}

async function generateCustomerSummary(userId: string, startDate?: string | null, endDate?: string | null) {
  const { start, end } = periodBounds(startDate, endDate);

  const invoiceRows = await db.select({
    customer_id: invoices.customer_id,
    total: invoices.total,
    status: invoices.status,
  }).from(invoices)
    .where(and(
      eq(invoices.user_id, userId),
      gte(invoices.issue_date, start),
      lte(invoices.issue_date, end),
    ));

  const customerIds = [...new Set(invoiceRows.map((i) => i.customer_id).filter(Boolean))] as string[];
  const customerMap = new Map<string, string>();
  if (customerIds.length > 0) {
    const customerRows = await db.select({ id: customers.id, name: customers.name })
      .from(customers).where(inArray(customers.id, customerIds));
    customerRows.forEach((c) => customerMap.set(c.id, c.name));
  }

  const customerStats: Record<string, { name: string; totalBilled: number; totalPaid: number; invoiceCount: number }> = {};

  invoiceRows.forEach((inv) => {
    const custId = inv.customer_id || 'unknown';
    const custName = customerMap.get(custId) || 'Unknown';

    if (!customerStats[custId]) {
      customerStats[custId] = { name: custName, totalBilled: 0, totalPaid: 0, invoiceCount: 0 };
    }

    customerStats[custId].totalBilled += Number(inv.total || 0);
    customerStats[custId].invoiceCount += 1;
    if (inv.status === 'paid') {
      customerStats[custId].totalPaid += Number(inv.total || 0);
    }
  });

  const customerList = Object.entries(customerStats)
    .map(([id, stats]) => ({ id, ...stats, outstanding: stats.totalBilled - stats.totalPaid }))
    .sort((a, b) => b.totalBilled - a.totalBilled);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Customer Summary',
      period: { start, end },
      customers: customerList,
      totals: {
        totalBilled: customerList.reduce((s, c) => s + c.totalBilled, 0),
        totalPaid: customerList.reduce((s, c) => s + c.totalPaid, 0),
        totalOutstanding: customerList.reduce((s, c) => s + c.outstanding, 0),
      },
    },
  });
}

async function generateVendorSummary(userId: string, startDate?: string | null, endDate?: string | null) {
  const { start, end } = periodBounds(startDate, endDate);

  const billRows = await db.select({
    vendor_id: bills.vendor_id,
    total: bills.total,
    status: bills.status,
  }).from(bills)
    .where(and(
      eq(bills.user_id, userId),
      gte(bills.bill_date, start),
      lte(bills.bill_date, end),
    ));

  const vendorIds = [...new Set(billRows.map((b) => b.vendor_id).filter(Boolean))] as string[];
  const vendorMap = new Map<string, string>();
  if (vendorIds.length > 0) {
    const vendorRows = await db.select({ id: vendors.id, name: vendors.name })
      .from(vendors).where(inArray(vendors.id, vendorIds));
    vendorRows.forEach((v) => vendorMap.set(v.id, v.name));
  }

  const vendorStats: Record<string, { name: string; totalBilled: number; totalPaid: number; billCount: number }> = {};

  billRows.forEach((bill) => {
    const vendId = bill.vendor_id || 'unknown';
    const vendName = vendorMap.get(vendId) || 'Unknown';

    if (!vendorStats[vendId]) {
      vendorStats[vendId] = { name: vendName, totalBilled: 0, totalPaid: 0, billCount: 0 };
    }

    vendorStats[vendId].totalBilled += Number(bill.total || 0);
    vendorStats[vendId].billCount += 1;
    if (bill.status === 'paid') {
      vendorStats[vendId].totalPaid += Number(bill.total || 0);
    }
  });

  const vendorList = Object.entries(vendorStats)
    .map(([id, stats]) => ({ id, ...stats, outstanding: stats.totalBilled - stats.totalPaid }))
    .sort((a, b) => b.totalBilled - a.totalBilled);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Vendor Summary',
      period: { start, end },
      vendors: vendorList,
      totals: {
        totalBilled: vendorList.reduce((s, v) => s + v.totalBilled, 0),
        totalPaid: vendorList.reduce((s, v) => s + v.totalPaid, 0),
        totalOutstanding: vendorList.reduce((s, v) => s + v.outstanding, 0),
      },
    },
  });
}