import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Books Made Easy - Local',
  description: 'Local smart database version',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}