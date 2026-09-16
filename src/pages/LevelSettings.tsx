// 等级设置页：等级 + 三项目标 + 升降级提示 + 数据重置
// 从设置页点击 Lv. 徽章进入

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, typeToChildIds } from '../store/useApp';
import { applyLevelMultiplier, DEFAULT_BASE_GOALS_MIN, evaluateLevel } from '../lib/level';
import { getCurrentWeekRange } from '../lib/week';

// 升降级提示的「本周不再提醒」标记，按周失效，下周会重新评估
const DISMISS_KEY = 'letsgo:level-prompt-dismissed';

function currentWeekKey(): string {
  return getCurrentWeekRange().start.toISOString().slice(0, 10);
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === currentWeekKey();
  } catch {
    return false;
  }
}

export function LevelSettings() {
  const navigate = useNavigate();
  const { categories, records, settings, saveSettings, resetAll } = useApp();
  const [resetting, setResetting] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);

  // 「本周不再提醒」：只影响提示展示，不改变任何数据
  function dismissPrompt() {
    try {
      localStorage.setItem(DISMISS_KEY, currentWeekKey());
    } catch { /* ignore */ }
    setDismissed(true);
  }

  const map = typeToChildIds(categories);
  const check = useMemo(() => {
    if (!settings) return null;
    const goals = {
      strength: settings.strength_goal_min,
      cardio: settings.cardio_goal_min,
      recovery: settings.recovery_goal_min,
    };
    return evaluateLevel(records, goals, map);
  }, [records, settings, map]);

  if (!settings) {
    return <div className="text-center text-slate-400 py-12">加载中…</div>;
  }

  async function handleReset() {
    if (!confirm('确定要还原原始数据吗？\n\n所有运动记录将被清空，自定义分类会被移除，等级和目标恢复到初始状态（Lv.1）。\n此操作不可撤销。')) return;
    setResetting(true);
    try {
      await resetAll();
    } catch (e) {
      alert('重置失败：' + (e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="px-1 flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 -ml-2 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-95 transition"
          aria-label="返回设置"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div>
          <div className="text-xs text-slate-400">任务与等级</div>
          <h1 className="text-2xl font-bold text-slate-800">等级设置</h1>
        </div>
      </header>

      <LevelCard
        level={settings.level}
        strength={settings.strength_goal_min}
        cardio={settings.cardio_goal_min}
        recovery={settings.recovery_goal_min}
      />

      <GoalEditor settings={settings} onSave={saveSettings} />

      {check && !dismissed && (check.canLevelUp || check.canLevelDown) && (
        <LevelPrompt
          canUp={check.canLevelUp}
          canDown={check.canLevelDown}
          currentLevel={settings.level}
          onDismiss={dismissPrompt}
          onUp={async () => {
            const newLevel = settings.level + 1;
            const goals = applyLevelMultiplier(DEFAULT_BASE_GOALS_MIN, newLevel);
            await saveSettings({
              level: newLevel,
              strength_goal_min: goals.strength,
              cardio_goal_min: goals.cardio,
              recovery_goal_min: goals.recovery,
            });
            dismissPrompt();
          }}
          onDown={async () => {
            const newLevel = Math.max(1, settings.level - 1);
            const goals = applyLevelMultiplier(DEFAULT_BASE_GOALS_MIN, newLevel);
            await saveSettings({
              level: newLevel,
              strength_goal_min: goals.strength,
              cardio_goal_min: goals.cardio,
              recovery_goal_min: goals.recovery,
            });
            dismissPrompt();
          }}
        />
      )}

      <CurrentWeekStats check={check} settings={settings} />

      <ResetCard onReset={handleReset} resetting={resetting} />
    </div>
  );
}

function LevelCard({
  level, strength, cardio, recovery,
}: { level: number; strength: number; cardio: number; recovery: number }) {
  return (
    <div className="card relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-100 rounded-full -mr-12 -mt-12 opacity-50" />
      <div className="relative">
        <div className="text-xs text-slate-500">当前等级</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-brand-700">Lv {level}</span>
          <span className="text-sm text-slate-400">每升一级，目标 +5%</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <GoalStat label="力量" value={strength} color="#ef4444" />
          <GoalStat label="有氧" value={cardio} color="#10b981" />
          <GoalStat label="拉伸" value={recovery} color="#8b5cf6" />
        </div>
      </div>
    </div>
  );
}

function GoalStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-800 tabular-nums">{value}</div>
      <div className="text-xs text-slate-400">分钟/周</div>
      <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
        <div className="h-full" style={{ background: color, width: '100%' }} />
      </div>
    </div>
  );
}

function GoalEditor({ settings, onSave }: { settings: any; onSave: (p: any) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [strength, setStrength] = useState(settings.strength_goal_min);
  const [cardio, setCardio] = useState(settings.cardio_goal_min);
  const [recovery, setRecovery] = useState(settings.recovery_goal_min);

  function open() {
    setStrength(settings.strength_goal_min);
    setCardio(settings.cardio_goal_min);
    setRecovery(settings.recovery_goal_min);
    setEditing(true);
  }

  async function save() {
    await onSave({
      strength_goal_min: Math.max(1, Math.round(strength)),
      cardio_goal_min: Math.max(1, Math.round(cardio)),
      recovery_goal_min: Math.max(1, Math.round(recovery)),
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <button onClick={open} className="card w-full flex items-center justify-between active:scale-[0.99] transition-transform">
        <div>
          <div className="font-medium text-slate-800">修改本周目标</div>
          <div className="text-xs text-slate-500 mt-0.5">自定义三大类的周目标时长</div>
        </div>
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    );
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-medium text-slate-800">自定义每周目标（分钟）</h3>
      <GoalSlider color="#ef4444" label="力量训练" value={strength} onChange={setStrength} />
      <GoalSlider color="#10b981" label="有氧运动" value={cardio} onChange={setCardio} />
      <GoalSlider color="#8b5cf6" label="拉伸恢复" value={recovery} onChange={setRecovery} />
      <div className="flex gap-2 pt-2">
        <button className="btn-secondary flex-1 py-2.5" onClick={() => setEditing(false)}>取消</button>
        <button className="btn-primary flex-1 py-2.5" onClick={save}>保存</button>
      </div>
    </div>
  );
}

function GoalSlider({ color, label, value, onChange }: { color: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-800 tabular-nums">{value} 分钟</span>
      </div>
      <input
        type="range"
        min={5}
        max={300}
        step={5}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="alloc w-full"
        style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - 5) / 295) * 100}%, #e2e8f0 ${((value - 5) / 295) * 100}%, #e2e8f0 100%)` }}
      />
    </div>
  );
}

function LevelPrompt({
  canUp, canDown, currentLevel, onUp, onDown, onDismiss,
}: {
  canUp: boolean;
  canDown: boolean;
  currentLevel: number;
  onUp: () => Promise<void>;
  onDown: () => Promise<void>;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-3">
      {canUp && (
        <div className="card bg-emerald-50 border-emerald-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-emerald-900">升级提示 🎉</div>
              <div className="text-xs text-emerald-700 mt-1">你已经连续 2 周完成全部目标，可以升级到 Lv {currentLevel + 1}，新等级目标将增加 5%。</div>
              <div className="mt-3 flex gap-2">
                <button className="btn-secondary py-2 px-4 text-sm" onClick={onDismiss}>本周不再提醒</button>
                <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 text-sm rounded-full transition-colors" onClick={onUp}>
                  升级到 Lv {currentLevel + 1}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {canDown && (
        <div className="card bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-amber-900">降级提示</div>
              <div className="text-xs text-amber-700 mt-1">你已经连续 2 周完成度很低，可以选择降级到 Lv {Math.max(1, currentLevel - 1)}，目标将减少 5%。</div>
              <div className="mt-3 flex gap-2">
                <button className="btn-secondary py-2 px-4 text-sm" onClick={onDismiss}>本周不再提醒</button>
                <button className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 text-sm rounded-full transition-colors" onClick={onDown}>
                  降级到 Lv {Math.max(1, currentLevel - 1)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CurrentWeekStats({ check, settings }: { check: any; settings: any }) {
  if (!check) return null;
  const pct = (r: number) => Math.round(r * 100);
  return (
    <div className="card">
      <div className="text-xs text-slate-500">本周完成率</div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <RateBox label="力量" pct={pct(check.currentWeekRates.strength)} color="#ef4444" />
        <RateBox label="有氧" pct={pct(check.currentWeekRates.cardio)} color="#10b981" />
        <RateBox label="拉伸" pct={pct(check.currentWeekRates.recovery)} color="#8b5cf6" />
      </div>
      <div className="mt-4 text-xs text-slate-400">
        <div>上周完成率：力量 {pct(check.previousWeekRates.strength)}% · 有氧 {pct(check.previousWeekRates.cardio)}% · 拉伸 {pct(check.previousWeekRates.recovery)}%</div>
        <div className="mt-1">当连续 2 周三大类完成率均 ≥ 100% 时可升级，均 ≤ 50% 时可降级。</div>
      </div>
    </div>
  );
}

function RateBox({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>{pct}%</div>
      <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
        <div className="h-full" style={{ background: color, width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function ResetCard({ onReset, resetting }: { onReset: () => void; resetting: boolean }) {
  return (
    <div className="card border-red-100">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-800">还原原始数据</div>
          <div className="text-xs text-slate-500 mt-0.5">清空运动记录、恢复默认分类、等级重置为 Lv.1</div>
        </div>
        <button
          onClick={onReset}
          disabled={resetting}
          className="flex-shrink-0 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-full hover:bg-red-50 disabled:opacity-50"
        >
          {resetting ? '重置中…' : '重置'}
        </button>
      </div>
    </div>
  );
}
