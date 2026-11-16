
export const dayNum = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

export const minuteNum = (s) => {
  const str = String(s).replace('T', ' ');
  const [date, time = '00:00'] = str.split(' ');
  const [h, mi] = time.split(':').map(Number);
  return dayNum(date) * 1440 + (h || 0) * 60 + (mi || 0);
};

export const dateOf = (s) => String(s).slice(0, 10);
export const addDays = (s, n) => new Date((dayNum(s) + n) * 86400000).toISOString().slice(0, 10);
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;