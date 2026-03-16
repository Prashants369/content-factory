import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center bg-[#080808] p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-neutral-500/10 border border-neutral-500/20 flex items-center justify-center mx-auto">
          <Search size={28} className="text-neutral-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white mb-2">Page Not Found</h2>
          <p className="text-xs text-neutral-500">
            The page you're looking for doesn't exist in the Factory OS.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
        >
          <Home size={12} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
