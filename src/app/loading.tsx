import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="h-full flex items-center justify-center bg-[#080808]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="text-violet-500 animate-spin" size={28} />
        <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold">Loading...</p>
      </div>
    </div>
  );
}
