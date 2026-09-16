import { useApp } from '../store/useApp';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: React.ReactNode }) {
  const { ready } = useApp();

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-brand-50/60 to-slate-50">
      <main className="flex-1 max-w-md w-full mx-auto pb-24 pt-4 px-4">
        {!ready ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-slate-400 text-sm">加载中…</div>
          </div>
        ) : (
          children
        )}
      </main>
      <BottomNav />
    </div>
  );
}