// 全屏运动模式：只保留计时器 + 暂停/结束两个按钮
// 进入/退出带丝滑动画；运行中有呼吸光环

import { useEffect, useRef, useState } from 'react';
import { formatHMS, formatClockTime } from '../lib/time';
import type { TimerStatus } from './Timer';

interface Props {
  status: TimerStatus;
  elapsedSec: number;
  // 本次运动的开始时间戳（epoch ms），用于展示「开始于 08:10」
  startedAt: number | null;
  onPauseToggle: () => void;
  onEnd: () => void;
}

export function SportMode({ status, elapsedSec, startedAt, onPauseToggle, onEnd }: Props) {
  const [closing, setClosing] = useState(false);
  const endTimer = useRef<number | null>(null);

  // 退出动画播完再真正结束
  function handleEnd() {
    if (closing) return;
    setClosing(true);
    endTimer.current = window.setTimeout(() => onEnd(), 280);
  }

  useEffect(() => () => {
    if (endTimer.current) clearTimeout(endTimer.current);
  }, []);

  // 运动模式期间尽量保持屏幕常亮（失败静默忽略）
  useEffect(() => {
    let lock: any = null;
    (async () => {
      try {
        lock = await (navigator as any).wakeLock?.request('screen');
      } catch { /* 不支持则忽略 */ }
    })();
    return () => {
      try { lock?.release(); } catch { /* ignore */ }
    };
  }, []);

  const paused = status === 'paused';

  return (
    <div className={`fixed inset-0 z-[70] overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black sport-overlay ${closing ? 'sport-closing' : ''}`}>
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative h-full flex flex-col items-center justify-center px-6 select-none">
        {/* 状态徽标 */}
        <div className="sport-rise flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/8 border border-white/12 backdrop-blur-sm">
          <span className={`w-2 h-2 rounded-full ${paused ? 'bg-amber-400' : 'bg-emerald-400 sport-dot'}`} />
          <span className="text-xs font-medium text-white/80 tracking-wide">
            {paused ? '已暂停' : '运动中'}
          </span>
        </div>

        {/* 计时器 + 呼吸光环 */}
        <div className="relative mt-10 flex items-center justify-center">
          {!paused && (
            <div className="absolute w-64 h-64 rounded-full border-2 border-brand-400/40 blur-[2px] sport-breath" />
          )}
          {paused && (
            <div className="absolute w-64 h-64 rounded-full border-2 border-amber-400/20" />
          )}
          <div
            className="relative font-mono font-bold tabular-nums tracking-tight text-white sport-zoom"
            style={{ fontSize: 'clamp(64px, 24vw, 108px)', lineHeight: 1, textShadow: '0 4px 40px rgba(29, 84, 216, 0.35)' }}
          >
            {formatHMS(elapsedSec)}
          </div>
        </div>

        <div className="mt-6 text-xs text-white/35 sport-rise-2 text-center space-y-1">
          {startedAt != null && (
            <div className="tabular-nums">开始于 {formatClockTime(new Date(startedAt))}</div>
          )}
          <div>{paused ? '暂停期间不计入时长' : '熄屏 / 切后台都会持续计时'}</div>
        </div>

        {/* 按钮区 */}
        <div className="mt-14 flex items-center gap-12">
          {/* 暂停 / 继续 */}
          <button
            onClick={onPauseToggle}
            className="sport-rise-2 group flex flex-col items-center gap-2.5"
            aria-label={paused ? '继续' : '暂停'}
          >
            <span
              className={`flex items-center justify-center w-[76px] h-[76px] rounded-full backdrop-blur-md border transition-all duration-200 active:scale-90 ${
                paused
                  ? 'bg-emerald-400/15 border-emerald-300/30 shadow-[0_0_36px_rgba(52,211,153,0.25)]'
                  : 'bg-white/8 border-white/18 shadow-[0_0_28px_rgba(255,255,255,0.06)] group-hover:bg-white/12'
              }`}
            >
              {paused ? (
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-300 translate-x-[2px]" fill="currentColor">
                  <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
                  <rect x="6.5" y="5" width="4" height="14" rx="1.5" />
                  <rect x="13.5" y="5" width="4" height="14" rx="1.5" />
                </svg>
              )}
            </span>
            <span className={`text-xs font-medium ${paused ? 'text-emerald-300/90' : 'text-white/55'}`}>
              {paused ? '继续' : '暂停'}
            </span>
          </button>

          {/* 结束 */}
          <button
            onClick={handleEnd}
            className="sport-rise-3 group flex flex-col items-center gap-2.5"
            aria-label="结束"
          >
            <span className="flex items-center justify-center w-[76px] h-[76px] rounded-full bg-gradient-to-b from-sky-300 to-sky-500 border border-sky-200/40 shadow-[0_10px_36px_rgba(56,189,248,0.45)] transition-all duration-200 active:scale-90 group-hover:shadow-[0_10px_44px_rgba(56,189,248,0.6)]">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
              </svg>
            </span>
            <span className="text-xs font-medium text-white/55">结束</span>
          </button>
        </div>
      </div>
    </div>
  );
}
