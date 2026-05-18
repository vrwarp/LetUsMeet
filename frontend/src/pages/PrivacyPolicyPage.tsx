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
          LetUsMeet is a zero-knowledge scheduling platform. This policy outlines how we protect your data through client-side encryption.
        </p>
        <div className="mt-8 inline-block px-4 py-2 bg-neutral-100 rounded-full text-sm font-bold text-neutral-500 uppercase tracking-wider">
          Last Updated: {lastUpdated}
        </div>
      </header>

      <div className="grid gap-12 sm:gap-16">
        {/* Data Privacy */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-brand-green/10 text-brand-green-dark rounded-2xl">
              <Shield size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Data Privacy & Encryption</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed space-y-4">
            <p>
              LetUsMeet employs <strong>client-side end-to-end encryption</strong>. All poll metadata, including titles, descriptions, and time slots, are encrypted on your device before transmission. 
            </p>
            <p className="font-bold text-brand-charcoal border-l-4 border-brand-green pl-6 py-2">
              LetUsMeet does not store or have access to the decryption keys required to view your data. 
              Encrypted content remains inaccessible to LetUsMeet and its hosting providers.
            </p>
          </div>
        </section>

        {/* Data Categories */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
              <Database size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Data Processing</h2>
          </div>
          <div className="bg-white border border-neutral-200 rounded-[2.5rem] p-8 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="pb-4 font-black uppercase text-xs tracking-widest text-neutral-400">Category</th>
                  <th className="pb-4 font-black uppercase text-xs tracking-widest text-neutral-400">Stored State</th>
                  <th className="pb-4 font-black uppercase text-xs tracking-widest text-neutral-400">Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                <tr>
                  <td className="py-4 font-bold text-brand-charcoal">Poll Metadata</td>
                  <td className="py-4 text-neutral-500">Encrypted Ciphertext</td>
                  <td className="py-4 text-brand-red font-bold">Zero Knowledge</td>
                </tr>
                <tr>
                  <td className="py-4 font-bold text-brand-charcoal">User Account</td>
                  <td className="py-4 text-neutral-500">Email, Display Name</td>
                  <td className="py-4 text-neutral-500">Authorized Personnel</td>
                </tr>
                <tr>
                  <td className="py-4 font-bold text-brand-charcoal">Analytics</td>
                  <td className="py-4 text-neutral-500">Aggregated Usage Data</td>
                  <td className="py-4 text-neutral-500">Authorized Personnel</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* AI Processing */}
        <section className="bg-neutral-900 text-white rounded-[3rem] p-8 sm:p-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/10 text-brand-green rounded-2xl">
              <Cpu size={28} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">AI Data Processing</h2>
          </div>
          <div className="space-y-6">
            <p className="text-lg text-neutral-300 leading-relaxed">
              Using Natural Language Extraction transmits your input query to a third-party AI sub-processor (Google Gemini) for parsing.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Eye size={18} className="text-brand-red" />
                Transient Plaintext Disclosure
              </h3>
              <p className="text-sm text-neutral-400">
                Input queries are transmitted in plaintext during the API request. Once processed, the structured data is returned to the client and immediately encrypted for storage. LetUsMeet does not persist raw AI queries.
              </p>
            </div>
          </div>
        </section>

        {/* Master Keys */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-brand-red/10 text-brand-red rounded-2xl">
              <Lock size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Key Management</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              LetUsMeet utilizes the <strong>WebAuthn PRF extension</strong> to derive Master Keys on-demand. These keys are used to wrap individual poll symmetric keys. 
            </p>
            <p className="mt-6 p-6 bg-neutral-100 rounded-3xl border border-neutral-200 font-bold text-brand-charcoal">
              Master Keys are never stored or transmitted to our servers. They remain solely in volatile memory on your local device during an active session.
            </p>
          </div>
        </section>

        {/* Deletion */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-800 text-white rounded-2xl">
              <Trash2 size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">Account Deletion</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              Account deletion is implemented via <strong>Cryptographic Shredding</strong>. Deleting your account permanently destroys your Keystore entries. 
            </p>
            <p>
              Following deletion, the corresponding encrypted poll data in our ledger becomes mathematically unrecoverable and effectively erased.
            </p>
          </div>
        </section>

        <footer className="pt-12 border-t border-neutral-100">
          <p className="text-sm text-neutral-500">
            For privacy inquiries, contact <span className="font-bold text-brand-charcoal">letusmeet+privacy@vrwarp.com</span>.
          </p>
        </footer>
      </div>
    </div>
  );
}
