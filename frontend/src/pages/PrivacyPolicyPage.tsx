import { Link } from "react-router-dom";
import { Shield, Lock, Eye, Cpu, Database, Trash2, ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const lastUpdated = "May 15, 2026";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-20">
      <Link to="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-brand-green transition-colors mb-12 font-medium">
        <ArrowLeft size={18} />
        Back to Home
      </Link>

      <header className="mb-16">
        <h1 className="text-4xl sm:text-6xl font-black text-brand-charcoal mb-6 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xl text-neutral-600 leading-relaxed font-medium">
          LetUsMeet is built on a <span className="text-brand-green-dark font-bold">Zero-Knowledge</span> foundation. 
          We believe your schedule and meetings are none of our business.
        </p>
        <div className="mt-8 inline-block px-4 py-2 bg-neutral-100 rounded-full text-sm font-bold text-neutral-500 uppercase tracking-wider">
          Last Updated: {lastUpdated}
        </div>
      </header>

      <div className="grid gap-12 sm:gap-16">
        {/* Core Philosophy */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-brand-green/10 text-brand-green-dark rounded-2xl">
              <Shield size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Our Zero-Knowledge Promise</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed space-y-4">
            <p>
              Unlike traditional scheduling tools, LetUsMeet uses <strong>client-side end-to-end encryption</strong>. 
              This means the titles, descriptions, times, and participants of your polls are encrypted on your device 
              before they ever reach our servers.
            </p>
            <p className="font-bold text-brand-charcoal">
              We do not have the keys to decrypt your data. Even if our database were compromised, 
              your private meeting details remain illegible strings of random characters.
            </p>
          </div>
        </section>

        {/* Data Collection */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
              <Database size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Data We Collect</h2>
          </div>
          <div className="bg-white border border-neutral-200 rounded-[2.5rem] p-8 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="pb-4 font-black uppercase text-xs tracking-widest text-neutral-400">Category</th>
                  <th className="pb-4 font-black uppercase text-xs tracking-widest text-neutral-400">What we see</th>
                  <th className="pb-4 font-black uppercase text-xs tracking-widest text-neutral-400">What we DON'T see</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                <tr>
                  <td className="py-4 font-bold text-brand-charcoal">Poll Content</td>
                  <td className="py-4 text-neutral-500">Encrypted blobs (Ciphertext)</td>
                  <td className="py-4 text-brand-red font-bold">Titles, Dates, Locations</td>
                </tr>
                <tr>
                  <td className="py-4 font-bold text-brand-charcoal">User Account</td>
                  <td className="py-4 text-neutral-500">Email, Name (if via Google)</td>
                  <td className="py-4 text-brand-red font-bold">Your decryption keys</td>
                </tr>
                <tr>
                  <td className="py-4 font-bold text-brand-charcoal">Analytics</td>
                  <td className="py-4 text-neutral-500">Page views, browser type</td>
                  <td className="py-4 text-brand-red font-bold">Personal identity context</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* AI Disclosure */}
        <section className="bg-brand-charcoal text-white rounded-[3rem] p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 text-white/5 pointer-events-none">
            <Cpu size={200} strokeWidth={1} />
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/10 text-brand-green rounded-2xl">
              <Cpu size={28} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">AI & Transient Data</h2>
          </div>
          <div className="space-y-6 relative z-10">
            <p className="text-lg text-neutral-300 leading-relaxed">
              When you use our <span className="text-white font-bold">Natural Language Extraction</span> feature 
              (e.g., typing "Lunch next Friday at 12"), your input is sent to our AI sub-processor (Google Gemini) 
              to turn it into structured dates.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Eye size={18} className="text-brand-red" />
                Transient Plaintext Exposure
              </h3>
              <p className="text-sm text-neutral-400">
                During this specific request, the query is unencrypted. Google Gemini receives the text to process it. 
                Once the dates are returned to your browser, they are immediately encrypted and added to the ZK ledger. 
                We do not store your raw AI queries on our servers.
              </p>
            </div>
          </div>
        </section>

        {/* Passkeys */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-brand-red/10 text-brand-red rounded-2xl">
              <Lock size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Master Keys & Passkeys</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              We use the <strong>WebAuthn PRF extension</strong> to derive a Master Key from your device's biometric or security key login. 
              This key is used to "wrap" your individual poll keys. 
            </p>
            <p className="mt-6 p-6 bg-neutral-100 rounded-3xl border border-neutral-200 font-bold text-brand-charcoal">
              LetUsMeet never sees, stores, or transmits your Master Key. It lives only in your browser's memory 
              and is derived on-demand when you authenticate.
            </p>
          </div>
        </section>

        {/* Deletion */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-800 text-white rounded-2xl">
              <Trash2 size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Your Right to Erasure</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              Under GDPR, you have the right to be forgotten. In our system, this is achieved through <strong>Cryptographic Shredding</strong>. 
              When you delete your account, we delete your "Keystore"—the 
              database containing the keys to your polls. 
            </p>
            <p>
              Without these keys, the data remaining in our ledger is mathematically impossible to recover, 
              effectively erasing your information from existence.
            </p>
          </div>
        </section>

        <footer className="pt-12 border-t border-neutral-100">
          <p className="text-sm text-neutral-500 italic">
            For any privacy-related inquiries, please contact our designated agent at <span className="font-bold text-brand-charcoal">letusmeet+privacy@vrwarp.com</span>.
          </p>
        </footer>
      </div>
    </div>
  );
}
