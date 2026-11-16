import { dayNum, dateOf, minuteNum } from './util.js';

export function clubLines(validLines, paramsFor) {
  const reqs = [];

  for (const l of validLines) {
    const params = paramsFor(l);
    let joined = null;

    if (l.item) {
      for (const r of reqs) {
        if (r.item?.item_code !== l.item.item_code || r.plant !== l.plant) continue;
        const first = r.lines[0];
        const okCreated = dayNum(l.created_at) - dayNum(first.created_at) <= params.club_days;
        const okNeed =
          !l.need_by || !first.need_by || Math.abs(dayNum(l.need_by) - dayNum(first.need_by)) <= params.club_needby_days;
        if (okCreated && okNeed) {
          joined = r;
          break;
        }
      }
    }

    if (joined) joined.lines.push(l);
    else reqs.push({ item: l.item, plant: l.plant, lines: [l] });
  }

  reqs.forEach((r, i) => {
    r.id = `REQ-${String(i + 1).padStart(4, '0')}`;
    r.first = r.lines[0];
    r.reqDate = dateOf(r.first.created_at);
    r.firstMinute = minuteNum(r.first.created_at);
    r.qty = r.lines.reduce((s, x) => s + x.quantity, 0);
    r.emergency = r.lines.some((x) => x.urgency.toLowerCase() === 'emergency');
  });
  return reqs;
}