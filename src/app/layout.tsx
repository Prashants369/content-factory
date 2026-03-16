import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import SystemStatusBar from '@/components/SystemStatusBar';
import AIAssistant from '@/components/AIAssistant';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Influencer Factory',
  description: 'Manage 5-20 AI influencers with n8n and ComfyUI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${inter.className} bg-[#0a0a0a] h-screen flex text-slate-100 overflow-hidden relative`}>
        {/* Grid Overlay */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px] pointer-events-none z-0" />

        <Sidebar />

        <main className="flex-1 relative z-10 overflow-y-auto h-screen scrollbar-hide flex flex-col">
          {/* Live system status bar — always at top */}
          <SystemStatusBar />
          <div className="flex-1">
            {children}
          </div>
        </main>

        {/* Floating AI assistant — available on every page */}
        <AIAssistant />
      </body>
    </html>
  );
}

