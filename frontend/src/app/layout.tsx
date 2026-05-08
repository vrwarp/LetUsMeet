import '../index.css';
import Header from '../components/Header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LetUsMeet',
  description: 'Simple group scheduling.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-brand-charcoal font-sans flex flex-col">
        <Header />
        <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
