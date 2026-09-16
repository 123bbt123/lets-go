// src/lib/week.ts
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function getCurrentWeekRange() {
  const now = /* @__PURE__ */ new Date();
  return { start: startOfWeek(now), end: endOfWeek(now) };
}
function getPreviousWeekRange() {
  const now = /* @__PURE__ */ new Date();
  const curStart = startOfWeek(now);
  const prevStart = new Date(curStart);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(curStart);
  prevEnd.setMilliseconds(-1);
  return { start: prevStart, end: prevEnd };
}

// src/lib/level.ts
function sumSecondsByType(records, type, categoryIds) {
  let total = 0;
  for (const r of records) {
    for (const a of r.allocations) {
      if (categoryIds.has(a.category_id)) {
        total += a.seconds;
      }
    }
  }
  return total;
}
function computeTotalsByType(records, typeToChildIds) {
  const result = { strength: 0, cardio: 0, recovery: 0 };
  for (const r of records) {
    for (const a of r.allocations) {
      for (const t of ["strength", "cardio", "recovery"]) {
        if (typeToChildIds[t].includes(a.category_id)) {
          result[t] += a.seconds;
          break;
        }
      }
    }
  }
  return result;
}
function completionRates(totals, goals) {
  return {
    strength: goals.strength > 0 ? totals.strength / (goals.strength * 60) : 0,
    cardio: goals.cardio > 0 ? totals.cardio / (goals.cardio * 60) : 0,
    recovery: goals.recovery > 0 ? totals.recovery / (goals.recovery * 60) : 0
  };
}
function allAbove(rates, threshold) {
  return rates.strength >= threshold && rates.cardio >= threshold && rates.recovery >= threshold;
}
function allBelow(rates, threshold) {
  return rates.strength <= threshold && rates.cardio <= threshold && rates.recovery <= threshold;
}
function evaluateLevel(records, currentGoalsMin, typeToChildIds) {
  const cur = getCurrentWeekRange();
  const prev = getPreviousWeekRange();
  const curRecords = records.filter((r) => {
    const t = new Date(r.started_at);
    return t >= cur.start && t <= cur.end;
  });
  const prevRecords = records.filter((r) => {
    const t = new Date(r.started_at);
    return t >= prev.start && t <= prev.end;
  });
  const curTotals = computeTotalsByType(curRecords, typeToChildIds);
  const prevTotals = computeTotalsByType(prevRecords, typeToChildIds);
  const curRates = completionRates(curTotals, currentGoalsMin);
  const prevRates = completionRates(prevTotals, currentGoalsMin);
  const hasAnyActivity = curTotals.strength + curTotals.cardio + curTotals.recovery > 0 || prevTotals.strength + prevTotals.cardio + prevTotals.recovery > 0;
  const canLevelUp = hasAnyActivity && allAbove(curRates, 1) && allAbove(prevRates, 1);
  const canLevelDown = !canLevelUp && hasAnyActivity && allBelow(curRates, 0.5) && allBelow(prevRates, 0.5);
  return {
    canLevelUp,
    canLevelDown,
    currentWeekRates: curRates,
    previousWeekRates: prevRates
  };
}
function applyLevelMultiplier(baseGoals, level) {
  const factor = 1 + 0.05 * (level - 1);
  return {
    strength: Math.round(baseGoals.strength * factor),
    cardio: Math.round(baseGoals.cardio * factor),
    recovery: Math.round(baseGoals.recovery * factor)
  };
}
var DEFAULT_BASE_GOALS_MIN = {
  strength: 80,
  cardio: 100,
  recovery: 30
};
export {
  DEFAULT_BASE_GOALS_MIN,
  allAbove,
  allBelow,
  applyLevelMultiplier,
  completionRates,
  computeTotalsByType,
  evaluateLevel,
  sumSecondsByType
};
