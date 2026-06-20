'use client';

interface FirmClient {
  id: string;
  organizations?: { name: string } | null;
}

/** Stub — bookkeeper firm dashboard port deferred to later sprint. */
export default function BookkeeperClientDashboard({ client }: { client: FirmClient }) {
  return (
    <div className="card text-center py-12">
      <h2 className="text-lg font-semibold text-corporate-dark">
        {client.organizations?.name ?? 'Client'} dashboard
      </h2>
      <p className="text-corporate-gray mt-2">Bookkeeper client view coming in a later sprint.</p>
    </div>
  );
}