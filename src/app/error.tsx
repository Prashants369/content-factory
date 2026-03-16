'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="h-full flex items-center justify-center bg-[#080808] p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {error.message || 'An unexpected error occurred while rendering this page.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
          >
            <RefreshCw size={12} /> Try Again
          </button>
          <a
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2a2a] hover:bg-[#1a1a1a] text-neutral-400 text-xs font-bold transition-colors"
          >
            <Home size={12} /> Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
