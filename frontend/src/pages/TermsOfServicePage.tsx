import { Link } from "react-router-dom";
import { Scale, AlertTriangle, Gavel, FileText, ArrowLeft } from "lucide-react";

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
          These Terms of Service govern your use of LetUsMeet. By using the service, you agree to the following terms and conditions.
        </p>
        <div className="mt-8 inline-block px-4 py-2 bg-neutral-100 rounded-full text-sm font-bold text-neutral-500 uppercase tracking-wider">
          Last Updated: {lastUpdated}
        </div>
      </header>

      <div className="grid gap-12 sm:gap-16">
        {/* Self-Custody Risk */}
        <section className="bg-brand-red text-white rounded-[3rem] p-8 sm:p-12 shadow-xl shadow-brand-red/10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/10 text-white rounded-2xl">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Self-Custody Risk Disclosure</h2>
          </div>
          <div className="space-y-6">
            <p className="text-lg font-bold leading-relaxed">
              LetUsMeet is a zero-knowledge service. Decryption keys are managed solely by the user.
            </p>
            <p className="text-white/90 leading-relaxed">
              Loss of the WebAuthn passkey or biometric identity used to secure an account results in the <strong>permanent and unrecoverable loss of all associated data</strong>. LetUsMeet cannot recover accounts or data in the event of key loss.
            </p>
          </div>
        </section>

        {/* 1. Acceptance */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <FileText size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">1. Acceptance of Terms</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              By accessing LetUsMeet, you agree to be bound by these Terms. If you do not agree to these terms, you may not use the service. Use of the service is restricted to individuals 18 years of age or older.
            </p>
          </div>
        </section>

        {/* 2. Service Scope */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <Scale size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">2. Scope of Service</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              LetUsMeet provides a client-side cryptographic scheduling platform. The service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. We reserve the right to modify or terminate the service at any time without notice.
            </p>
          </div>
        </section>

        {/* 3. Liability */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <Gavel size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">3. Limitation of Liability</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed space-y-4">
            <p>
              To the maximum extent permitted by law, LetUsMeet shall not be liable for any indirect, incidental, special, or consequential damages resulting from:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access to or inability to access the service.</li>
              <li>Conduct or content of any third party on the service.</li>
              <li><strong>Loss of cryptographic keys or passkeys.</strong></li>
              <li>Unauthorized access, use, or alteration of content.</li>
            </ul>
          </div>
        </section>

        {/* 4. Intellectual Property */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <FileText size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">4. Intellectual Property</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              LetUsMeet cannot review encrypted poll contents. If you believe your intellectual property is being infringed, please provide a valid DMCA notice including the Poll ID.
            </p>
            <p>
              Designated Agent: <strong>letusmeet+privacy@vrwarp.com</strong>
            </p>
          </div>
        </section>

        {/* 5. Jurisdiction */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-neutral-100 text-neutral-600 rounded-2xl">
              <Scale size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-charcoal uppercase tracking-tight">5. Governing Law</h2>
          </div>
          <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed">
            <p>
              These Terms are governed by the laws of the State of California. Any disputes shall be settled in the courts of Alameda County, California.
            </p>
          </div>
        </section>

        <footer className="pt-12 border-t border-neutral-100">
          <p className="text-sm text-neutral-500">
            Contact: <span className="font-bold text-brand-charcoal">letusmeet+legal@vrwarp.com</span>.
          </p>
        </footer>
      </div>
    </div>
  );
}
