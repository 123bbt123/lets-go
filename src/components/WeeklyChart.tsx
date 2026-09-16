import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Category, ExerciseRecord } from '../types';
import { weekDays, isSameDay } from '../lib/week';
import { formatDateShort } from '../lib/time';

interface Props {
  topCategory: Category;
  childCategories: Category[];
  records: ExerciseRecord[];
}

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const COMPARE_RANGE = 12; // 对比周最多往前 12 周

// 统计给定 7 天里每天的分钟数
function sumByDay(records: ExerciseRecord[], ids: Set<string>, days: Date[]): number[] {
  return days.map(day => {
    const total = records.reduce((sum, r) => {
      const t = new Date(r.started_at);
      if (!isSameDay(t, day)) return sum;
      return sum + (r.allocations ?? [])
        .filter(a => ids.has(a.category_id))
        .reduce((s, a) => s + a.seconds, 0);
    }, 0);
    return Math.round(total / 60 * 10) / 10;
  });
}

function rangeLabel(days: Date[]): string {
  return `${formatDateShort(days[0])} - ${formatDateShort(days[6])}`;
}

function weekTitle(offset: number): string {
  if (offset === 0) return '本周';
  if (offset === -1) return '上周';
  return `${-offset} 周前`;
}

export function WeeklyChart({ topCategory, childCategories, records }: Props) {
  // 主周：0 = 本周，-1 = 上周……
  const [weekOffset, setWeekOffset] = useState(0);
  // 对比周：同为相对本周的偏移，null = 不对比
  const [compareOffset, setCompareOffset] = useState<number | null>(-1);

  const chartRef = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const matchingIds = useMemo(() => {
    const ids = new Set(childCategories.map(c => c.id));
    if (childCategories.length === 0) ids.add(topCategory.id);
    return ids;
  }, [topCategory, childCategories]);

  const days = useMemo(() => weekDays(weekOffset), [weekOffset]);
  const compareDays = useMemo(
    () => (compareOffset == null ? null : weekDays(compareOffset)),
    [compareOffset]
  );

  const series = useMemo(
    () => sumByDay(records, matchingIds, days),
    [records, matchingIds, days]
  );
  const compareSeries = useMemo(
    () => (compareDays ? sumByDay(records, matchingIds, compareDays) : null),
    [records, matchingIds, compareDays]
  );

  const total = series.reduce((s, v) => s + v, 0);
  const compareTotal = compareSeries?.reduce((s, v) => s + v, 0) ?? null;

  const color =
    topCategory.type === 'strength' ? '#ef4444' :
    topCategory.type === 'cardio' ? '#10b981' : '#8b5cf6';

  // 容器宽度变化（展开动画、旋转屏幕）时让 echarts 跟着重绘
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      try {
        chartRef.current?.getEchartsInstance?.()?.resize();
      } catch { /* ignore */ }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mainName = weekTitle(weekOffset);
  const cmpName = compareOffset == null ? '' : weekTitle(compareOffset);

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        if (!params?.length) return '';
        const rows = params.map(
          p => `${p.marker}${p.seriesName}：${p.value} 分钟`
        );
        return `${params[0].axisValue}<br/>${rows.join('<br/>')}`;
      },
    },
    legend: compareSeries
      ? {
          top: 0,
          right: 0,
          itemWidth: 14,
          itemHeight: 8,
          textStyle: { fontSize: 10, color: '#64748b' },
          data: [mainName, cmpName],
        }
      : undefined,
    // containLabel 很关键：否则窄屏上 y 轴「xx分」会被裁到画布外
    grid: { left: 4, right: 12, top: compareSeries ? 30 : 20, bottom: 2, containLabel: true },
    xAxis: {
      type: 'category',
      data: WEEKDAY_LABELS,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10, formatter: '{value}' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [
      {
        name: mainName,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
        lineStyle: { color, width: 3 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: color + '33' }, { offset: 1, color: color + '00' }],
          },
        },
        label: {
          show: true,
          position: 'top',
          distance: 4,
          color: '#475569',
          fontSize: 10,
          formatter: (p: any) => (p.value > 0 ? p.value : ''),
        },
        data: series,
      },
      ...(compareSeries
        ? [{
            name: cmpName,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 5,
            itemStyle: { color: '#94a3b8' },
            lineStyle: { color: '#94a3b8', width: 2, type: 'dashed' as const },
            label: { show: false },
            data: compareSeries,
          }]
        : []),
    ],
  };

  const compareOptions = Array.from({ length: COMPARE_RANGE }, (_, i) => -(i + 1));

  return (
    <div className="mt-3 border-t border-slate-100 pt-3" ref={boxRef}>
      <div className="text-xs text-slate-500 mb-2">{topCategory.name} · 每日时长</div>

      {/* 周切换 */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setWeekOffset(o => Math.max(-52, o - 1))}
          className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 active:scale-90 transition"
          aria-label="上一周"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>

        <div className="text-center">
          <div className="text-xs font-medium text-slate-700 tabular-nums">
            {rangeLabel(days)}
            <span className="ml-1.5 text-slate-400">{weekTitle(weekOffset)}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
            合计 {Math.round(total)} 分钟
            {compareTotal != null && (
              <> · 对比 {Math.round(compareTotal)} 分钟{diffText(total, compareTotal)}</>
            )}
          </div>
        </div>

        <button
          onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
          disabled={weekOffset >= 0}
          className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 active:scale-90 transition disabled:opacity-25 disabled:hover:bg-transparent"
          aria-label="下一周"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* 对比周选择 */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">对比周</span>
        <select
          value={compareOffset ?? ''}
          onChange={e => setCompareOffset(e.target.value === '' ? null : Number(e.target.value))}
          className="text-[11px] text-slate-600 border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400"
        >
          <option value="">不对比</option>
          {compareOptions.map(o => (
            <option key={o} value={o}>
              {weekTitle(o)}（{rangeLabel(weekDays(o))}）
            </option>
          ))}
        </select>
      </div>

      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge
        style={{ height: 230, width: '100%' }}
      />
    </div>
  );
}

// 与对比周的差值文案
function diffText(total: number, compare: number): string {
  if (compare <= 0) return total > 0 ? ' · 新增' : '';
  const pct = Math.round(((total - compare) / compare) * 100);
  if (pct === 0) return ' · 持平';
  return pct > 0 ? ` · +${pct}%` : ` · ${pct}%`;
}
