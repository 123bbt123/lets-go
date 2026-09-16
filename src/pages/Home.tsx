import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/useApp';
import { Timer, useTimer } from '../components/Timer';
import { SportMode } from '../components/SportMode';
import { TodayWeekProgress } from '../components/TodayWeekProgress';
import { TopCategoryPicker } from '../components/TopCategoryPicker';
import { AllocationDialog } from '../components/AllocationDialog';
import { Category } from '../types';
import { getStoredUsername } from '../lib/userAuth';

export function Home() {
  const { categories, records, settings, createRecord } = useApp();
  const timer = useTimer();
  const username = getStoredUsername();

  const [pickingTop, setPickingTop] = useState(false);
  const [allocFor, setAllocFor] = useState<Category | null>(null);
  const [endedSession, setEndedSession] = useState<{ startedAt: Date; durationSeconds: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  // 写入锁：防止一次运动被重复提交（双击确认、网络慢时用户再点一次）
  const savingRef = useRef(false);

  // 统一走这里弹提示，避免定时器残留导致组件卸载后还在 setState
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const { top, childrenByParent } = groupCategoriesWithChildren();

  function groupCategoriesWithChildren() {
    const topCats = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const map: Record<string, Category[]> = {};
    for (const c of categories) {
      if (c.parent_id) {
        if (!map[c.parent_id]) map[c.parent_id] = [];
        map[c.parent_id].push(c);
      }
    }
    for (const k in map) map[k].sort((a, b) => a.sort_order - b.sort_order);
    return { top: topCats, childrenByParent: map };
  }

  function handleEnd() {
    const result = timer.end();
    if (result.durationSeconds <= 0) {
      showToast('运动时间不足 1 秒，未记录');
      setEndedSession(null);
      setPickingTop(false);
      return;
    }
    setEndedSession(result);
    setPickingTop(true);
  }

  function handlePickedTop(topCat: Category) {
    setPickingTop(false);
    setAllocFor(topCat);
  }

  async function handleConfirm(allocs: { category_id: string; seconds: number }[]) {
    if (!endedSession || savingRef.current) return;
    const totalAlloc = allocs.reduce((s, a) => s + a.seconds, 0);
    if (totalAlloc <= 0) {
      setAllocFor(null);
      setEndedSession(null);
      showToast('未分配时长，本次运动未记录');
      return;
    }
    savingRef.current = true;
    try {
      await createRecord(endedSession.startedAt, endedSession.durationSeconds, allocs);
      setAllocFor(null);
      setEndedSession(null);
      showToast('已记录运动');
    } catch (e) {
      showToast('保存失败，请重试');
      console.error('保存运动记录失败', e);
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <div className="space-y-4">
      <header className="px-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">let's go</div>
          <h1 className="text-2xl font-bold text-slate-800">让一分钟的运动也存在意义</h1>
        </div>
        {username && (
          <span className="flex-shrink-0 mt-1 text-[10px] text-slate-300 select-all">
            {username}
          </span>
        )}
      </header>

      <Timer
        status={timer.status}
        elapsedSec={timer.elapsedSec}
        onStart={timer.start}
        onPauseToggle={timer.togglePause}
        onEnd={handleEnd}
      />

      {/* 运动模式：全屏覆盖，只留计时器和暂停/结束 */}
      {timer.status !== 'idle' && (
        <SportMode
          status={timer.status}
          elapsedSec={timer.elapsedSec}
          startedAt={timer.startedAt}
          onPauseToggle={timer.togglePause}
          onEnd={handleEnd}
        />
      )}

      <TodayWeekProgress records={records} categories={categories} settings={settings} />

      {endedSession && pickingTop && (
        <TopCategoryPicker
          topCategories={top}
          onPick={handlePickedTop}
          onCancel={() => {
            setPickingTop(false);
            setEndedSession(null);
            showToast('已取消，本次运动未记录');
          }}
        />
      )}

      {allocFor && endedSession && (
        <AllocationDialog
          topCategory={allocFor}
          topColor={
            allocFor.type === 'strength' ? '#ef4444' :
            allocFor.type === 'cardio' ? '#10b981' : '#8b5cf6'
          }
          totalSeconds={endedSession.durationSeconds}
          onCancel={() => {
            setAllocFor(null);
            setEndedSession(null);
            showToast('已取消，本次运动未记录');
          }}
          onConfirm={handleConfirm}
        />
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-slate-900/90 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}