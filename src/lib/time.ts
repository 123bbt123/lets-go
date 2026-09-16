// 时间格式化、日期工具（统一以本地时区）

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(sec)}`;
  return `${pad2(m)}:${pad2(sec)}`;
}

export function formatMinutes(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}秒`;
  if (s === 0) return `${m}分钟`;
  return `${m}分${s}秒`;
}

export function formatShortMinutes(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0 && s === 0) return '0分';
  if (s === 0) return `${m}分`;
  return `${m}分${s}秒`;
}

export function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatDateFull(date: Date): string {
  const y = date.getFullYear();
  return `${y}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// 时刻，如 08:10
export function formatClockTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// 运动时间段，如 9/15 08:10 - 08:55
export function formatTimeRange(start: Date, durationSeconds: number): string {
  const end = new Date(start.getTime() + Math.max(0, durationSeconds) * 1000);
  const sameDay = start.toDateString() === end.toDateString();
  const startText = `${start.getMonth() + 1}/${start.getDate()} ${formatClockTime(start)}`;
  const endText = sameDay
    ? formatClockTime(end)
    : `${end.getMonth() + 1}/${end.getDate()} ${formatClockTime(end)}`;
  return `${startText} - ${endText}`;
}