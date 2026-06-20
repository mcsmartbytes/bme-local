'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function BankImportStubPage() {
  const params = useParams();
  const accountId = params.id as string;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-corporate-gray">
        <Link href="/dashboard/banking" className="hover:text-primary-600">Banking</Link>
        <span>/</span>
        <Link href={`/dashboard/banking/${accountId}`} className="hover:text-primary-600">Account</Link>
        <span>/</span>
        <span>Import</span>
      </div>
      <div className="card text-center py-12">
        <h1 className="text-xl font-bold text-corporate-dark mb-2">CSV Import</h1>
        <p className="text-corporate-gray mb-6">
          Bank CSV import is planned for a later sprint. You can add transactions manually via the API for now.
        </p>
        <Link href={`/dashboard/banking/${accountId}`} className="btn-primary">
          Back to Transactions
        </Link>
      </div>
    </div>
  );
}