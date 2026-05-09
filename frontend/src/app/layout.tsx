import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "../index.css";
import Header from "@/components/Header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "LetUsMeet - Simple Group Scheduling",
  description: "Coordinate meetings and events effortlessly with LetUsMeet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-neutral-50 text-brand-charcoal font-sans flex flex-col">
        <Header />
        <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
          {children}
        </main>
        <footer className="border-t border-neutral-200 py-8 mt-auto w-full bg-neutral-50">
          <div className="max-w-5xl mx-auto px-4 text-center text-sm text-neutral-500 font-medium">
            <p>© 2026 <span className="text-brand-green font-bold">LetUs</span><span className="text-brand-red font-bold">Meet</span>. Simple group scheduling.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
