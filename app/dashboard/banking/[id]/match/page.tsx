'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function BankMatchStubPage() {
  const params = useParams();
  const accountId = params.id as string;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-corporate-gray">
        <Link href="/dashboard/banking" className="hover:text-primary-600">Banking</Link>
        <span>/</span>
        <Link href={`/dashboard/banking/${accountId}`} className="hover:text-primary-600">Account</Link>
        <span>/</span>
        <span>Match</span>
      </div>
      <div className="card text-center py-12">
        <h1 className="text-xl font-bold text-corporate-dark mb-2">Transaction Matching</h1>
        <p className="text-corporate-gray mb-6">
          Matching bank transactions to invoices and bills is planned for a later sprint.
        </p>
        <Link href={`/dashboard/banking/${accountId}`} className="btn-primary">
          Back to Transactions
        </Link>
      </div>
    </div>
  );
}