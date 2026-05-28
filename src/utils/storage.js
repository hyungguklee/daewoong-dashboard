const KEYS = {
  hospital2nd: 'dashboard_hospital2nd',
  hospital110: 'dashboard_hospital110',
};

export function getStoredData(taskId) {
  try {
    const raw = localStorage.getItem(KEYS[taskId] || taskId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveData(taskId, data) {
  localStorage.setItem(KEYS[taskId] || taskId, JSON.stringify(data));
}

export function mergeMonthlyData(existing, incoming) {
  if (!existing) return incoming;
  const merged = { ...existing };
  const period = incoming.period;

  if (!merged.history) merged.history = {};
  merged.history[period] = {
    total: incoming.total,
    divisions: incoming.divisions,
    offices: incoming.offices,
  };

  merged.period = incoming.period;
  merged.total = incoming.total;
  merged.divisions = incoming.divisions;
  merged.offices = incoming.offices;
  merged.hospitalData = incoming.hospitalData;

  if (incoming.trendData) {
    if (!merged.trendData) merged.trendData = { divisions: {}, offices: {}, total: {} };
    Object.entries(incoming.trendData?.total || {}).forEach(([m, v]) => { merged.trendData.total[m] = v; });
    Object.entries(incoming.trendData?.divisions || {}).forEach(([div, months]) => {
      if (!merged.trendData.divisions[div]) merged.trendData.divisions[div] = {};
      Object.entries(months).forEach(([m, v]) => { merged.trendData.divisions[div][m] = v; });
    });
  }

  return merged;
}
