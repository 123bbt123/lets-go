import { useEffect, useRef, useState } from 'react';
import { formatHMS } from '../lib/time';

export type TimerStatus = 'idle' | 'running' | 'paused';

interface Props {
  status: TimerStatus;
  elapsedSec: number;
  onStart: () => void;
  onPauseToggle: () => void;
  onEnd: () => void;
}

export function Timer({ status, elapsedSec, onStart, onPauseToggle, onEnd }: Props) {
  return (
    <div className="card flex flex-col items-center py-8">
      {/* 大型计时显示 */}
      <div className="relative w-full flex flex-col items-center">
        <div className="font-mono text-[88px] leading-none font-bold text-slate-800 tabular-nums tracking-tight">
          {formatHMS(elapsedSec)}
        </div>
        <div className="mt-2 text-sm text-slate-400">
          {status === 'idle' ? '准备开始' : status === 'running' ? '运动中' : '已暂停'}
        </div>
      </div>

      {/* 按钮区（运动中会进入全屏运动模式，这里只在 idle 时展示入口） */}
      <div className="mt-8 flex items-center justify-center gap-6">
        {status === 'idle' ? (
          <button
            className="btn-primary w-44 h-14 text-lg shadow-lg shadow-brand-600/20"
            onClick={onStart}
          >
            let&apos;s go
          </button>
        ) : (
          <div className="text-sm text-slate-400 py-6">已在运动模式中</div>
        )}
      </div>
    </div>
  );
}

// ---------- 计时器核心 ----------

interface TimerSession {
  startedAt: number;   // epoch ms
  pausedAccum: number; // 累计暂停毫秒
  pausedAt: number | null; // 暂停开始时刻（null = 运行中）
}

const STORAGE_KEY = 'letsgo:timer-session';

function loadSession(): TimerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s?.startedAt !== 'number') return null;
    return {
      startedAt: s.startedAt,
      pausedAccum: typeof s.pausedAccum === 'number' ? s.pausedAccum : 0,
      pausedAt: typeof s.pausedAt === 'number' ? s.pausedAt : null,
    };
  } catch {
    return null;
  }
}

function calcElapsed(s: TimerSession): number {
  const ref = s.pausedAt ?? Date.now();
  return Math.max(0, Math.floor((ref - s.startedAt - s.pausedAccum) / 1000));
}

// 自定义 hook：时间戳驱动，后台/熄屏/刷新页面都不丢
export function useTimer() {
  const [session, setSession] = useState<TimerSession | null>(() => loadSession());
  const [elapsedSec, setElapsedSec] = useState<number>(() => {
    const s = loadSession();
    return s ? calcElapsed(s) : 0;
  });
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // 持久化：任何状态变化立刻写入 localStorage
  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [session]);

  // 跨标签页同步：session 存在 localStorage，另一个标签页开始/结束时本页要跟上，
  // 否则两个页面会各持有一份计时，各自结束一次 → 同一段运动被记录两条
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      const s = loadSession();
      setSession(s);
      setElapsedSec(s ? calcElapsed(s) : 0);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 计时 tick：从时间戳反推，切后台回来（visibilitychange）立即校准
  useEffect(() => {
    if (!session) return;
    const compute = () => setElapsedSec(calcElapsed(session));
    compute();
    if (session.pausedAt) return; // 暂停时不 tick

    const id = window.setInterval(compute, 250);
    const onVis = () => { if (!document.hidden) compute(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session]);

  const status: TimerStatus = !session ? 'idle' : session.pausedAt ? 'paused' : 'running';

  const start = () => {
    const now = Date.now();
    setSession({ startedAt: now, pausedAccum: 0, pausedAt: null });
    setElapsedSec(0);
  };

  const togglePause = () => {
    setSession(s => {
      if (!s) return s;
      if (s.pausedAt) {
        // 继续：把这段暂停时长累加进 pausedAccum
        return { ...s, pausedAccum: s.pausedAccum + (Date.now() - s.pausedAt), pausedAt: null };
      }
      // 暂停
      return { ...s, pausedAt: Date.now() };
    });
  };

  const end = () => {
    const s = sessionRef.current;
    let finalSec = 0;
    let started = new Date();
    if (s) {
      const pauseAdd = s.pausedAt ? Date.now() - s.pausedAt : 0;
      finalSec = Math.max(0, Math.floor((Date.now() - s.startedAt - s.pausedAccum - pauseAdd) / 1000));
      started = new Date(s.startedAt);
    }
    setSession(null);
    setElapsedSec(0);
    return { startedAt: started, durationSeconds: finalSec };
  };

  return { status, elapsedSec, startedAt: session?.startedAt ?? null, start, togglePause, end };
}
