import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="bg-neutral-50 rounded-[3rem] p-10 border border-neutral-100">
        <div className="w-16 h-16 bg-brand-green-light/30 text-brand-green rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Compass size={32} />
        </div>
        <h2 className="text-2xl font-bold text-neutral-800 mb-4">Page not found</h2>
        <p className="text-neutral-600 mb-8">
          We couldn't find the page you were looking for. The link may be broken or the page may have moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary-green inline-block">
            Go home
          </Link>
          <Link
            to="/create"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-neutral-600 border border-neutral-200 rounded-2xl font-bold hover:bg-neutral-100 transition-colors"
          >
            Create a poll
          </Link>
        </div>
      </div>
    </div>
  );
}
