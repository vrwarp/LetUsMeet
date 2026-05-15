import { Link } from "react-router-dom";
import { Scale, AlertTriangle, Gavel, FileText, ArrowLeft, Key } from "lucide-react";

export default function TermsOfServicePage() {
  const lastUpdated = "May 15, 2026";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-20">
      <Link to="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-brand-green transition-colors mb-12 font-medium">
        <ArrowLeft size={18} />
        Back to Home
      </Link>

      <header className="mb-16">
        <h1 className="text-4xl sm:text-6xl font-black text-brand-charcoal mb-6 tracking-tight">
          Terms of Service
        </h1>
        <p className="text-xl text-neutral-600 leading-relaxed font-medium">
          The legal bits. TL;DR: We provide the tools, you provide the keys. 
          Don't lose your passkey.
        </p>
        <div className="mt-8 inline-block px-4 py-2 bg-neutral-100 rounded-full text-sm font-bold text-neutral-500 uppercase tracking-wider">
          Last Updated: {lastUpdated}
        </div>
      </header>

      <div className="grid gap-12 sm:gap-16">
        {/* Self-Custody Warning */}
        <section className="bg-brand-red text-white rounded-[3rem] p-8 sm:p-12 relative overflow-hidden shadow-xl shadow-brand-red/20">
          <div className="absolute top-0 right-0 p-12 text-white/10 pointer-events-none">
            <Key size={200} strokeWidth={1} />
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/10 text-white rounded-2xl">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Self-Custody Risk Warning</h2>
          </div>
          <div className="space-y-6 relative z-10">
            <p className="text-lg font-bold leading-relaxed">
              LetUsMeet is a Zero-Knowledge service. We do not store your decryption keys.
            </p>
            <p className="text-white/90 leading-relaxed">
              If you lose your WebAuthn passkey or biometric identity used to secure your account, 
              and you have not backed it up via your device manufacturer (Apple, Google, Microsoft), 
              your data is <span className="underline decoration-2 underline-offset-4">PERMANENTLY UNRECOVERABLE</span>.
            </p>
            <p className="text-white/90 leading-relaxed font-bold">
              WE CANNOT RESET YOUR PASSWORD. WE CANNOT RECOVER YOUR POLLS.
            </p>
          </div>
        </section>

        {/* Acceptance of Terms */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <FileText size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">1. Acceptance of Terms</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              By accessing or using LetUsMeet, you agree to be bound by these Terms. 
              If you do not agree to all of the terms and conditions, you may not use the service.
              You must be at least 18 years old to use this service.
            </p>
          </div>
        </section>

        {/* Service Description */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <Scale size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">2. Description of Service</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              LetUsMeet provides a client-side cryptographic scheduling platform. 
              The service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. 
              We reserve the right to modify or discontinue the service at any time without notice.
            </p>
          </div>
        </section>

        {/* Limitation of Liability */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <Gavel size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">3. Limitation of Liability</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed space-y-4">
            <p>
              To the maximum extent permitted by law, LetUsMeet and its operator shall not be liable 
              for any indirect, incidental, special, consequential, or punitive damages, or any loss 
              of profits or revenues, whether incurred directly or indirectly, or any loss of data, 
              use, goodwill, or other intangible losses, resulting from:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your access to or use of or inability to access or use the service.</li>
              <li>Any conduct or content of any third party on the service.</li>
              <li>Any content obtained from the service.</li>
              <li><strong>Loss of cryptographic keys or passkeys.</strong></li>
              <li>Unauthorized access, use, or alteration of your transmissions or content.</li>
            </ul>
          </div>
        </section>

        {/* DMCA */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <FileText size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">4. DMCA Policy</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              We respect the intellectual property rights of others. Since our service is Zero-Knowledge, 
              we cannot review the contents of polls. If you believe your copyrighted work is being hosted 
              without authorization, please provide us with the Poll ID and a valid DMCA takedown notice.
            </p>
            <p>
              Designated Agent: <strong>letusmeet+privacy@vrwarp.com</strong>
            </p>
          </div>
        </section>

        {/* Governing Law */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <Scale size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">5. Governing Law</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              These Terms shall be governed by the laws of the State of California, without respect to 
              its conflict of laws principles. You agree to submit to the personal jurisdiction of the 
              courts located in Alameda County, California.
            </p>
          </div>
        </section>

        <footer className="pt-12 border-t border-neutral-100">
          <p className="text-sm text-neutral-500 italic">
            Questions about these terms? Reach out at <span className="font-bold text-brand-charcoal">letusmeet+legal@vrwarp.com</span>.
          </p>
        </footer>
      </div>
    </div>
  );
}
