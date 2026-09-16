// 一周从周一开始

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date): Date {
  // 周一为一周第一天
  const x = startOfDay(d);
  // getDay: 0=Sunday, 1=Monday, ..., 6=Saturday
  // 距离本周一的天数
  const day = x.getDay();
  const diff = (day + 6) % 7; // Monday=0
  x.setDate(x.getDate() - diff);
  return x;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// 返回过去 7 天（含今天）的 [Date, Date] 列表，已对齐到 0:00
export function last7Days(today: Date = new Date()): Date[] {
  const result: Date[] = [];
  const base = startOfDay(today);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    result.push(d);
  }
  return result;
}

// 取指定周的周一~周日（0 = 本周，-1 = 上周，-2 = 前两周……）
export function weekDays(weekOffset: number = 0): Date[] {
  const base = startOfWeek(new Date());
  base.setDate(base.getDate() + weekOffset * 7);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  return { start: startOfWeek(now), end: endOfWeek(now) };
}

export function getPreviousWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const curStart = startOfWeek(now);
  const prevStart = new Date(curStart);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(curStart);
  prevEnd.setMilliseconds(-1);
  return { start: prevStart, end: prevEnd };
}