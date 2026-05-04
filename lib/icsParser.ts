/**
 * ブラウザ内 ICS (iCalendar) パーサー
 * 依存ライブラリなし・完全無料・100%正確
 */

export interface ICSEvent {
  summary: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  rrule?: string;
  exdates: Date[];
}

// ─── 日付パース ────────────────────────────────────────────────────────────────

function parseICSDate(val: string): Date | null {
  const v = val.trim();
  // 終日: 20260507
  if (/^\d{8}$/.test(v)) {
    return new Date(+v.slice(0,4), +v.slice(4,6)-1, +v.slice(6,8), 0, 0, 0);
  }
  // UTC: 20260507T010000Z
  if (/^\d{8}T\d{6}Z$/.test(v)) {
    return new Date(Date.UTC(
      +v.slice(0,4), +v.slice(4,6)-1, +v.slice(6,8),
      +v.slice(9,11), +v.slice(11,13), +v.slice(13,15)
    ));
  }
  // ローカル: 20260507T100000
  if (/^\d{8}T\d{6}$/.test(v)) {
    return new Date(
      +v.slice(0,4), +v.slice(4,6)-1, +v.slice(6,8),
      +v.slice(9,11), +v.slice(11,13), +v.slice(13,15)
    );
  }
  return null;
}

// ─── 行の折り返し解除 ────────────────────────────────────────────────────────

function unfoldLines(content: string): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((acc: string[], line) => {
      if ((line[0] === ' ' || line[0] === '\t') && acc.length > 0) {
        acc[acc.length - 1] += line.slice(1);
      } else {
        acc.push(line);
      }
      return acc;
    }, []);
}

// ─── プロパティパース ────────────────────────────────────────────────────────

function parsePropLine(line: string): { key: string; params: Record<string,string>; value: string } | null {
  const ci = line.indexOf(':');
  if (ci < 0) return null;
  const keyPart = line.slice(0, ci);
  const value   = line.slice(ci + 1);
  const parts   = keyPart.split(';');
  const key     = parts[0].toUpperCase();
  const params: Record<string,string> = {};
  for (const p of parts.slice(1)) {
    const [pk, pv] = p.split('=');
    if (pk && pv) params[pk.toUpperCase()] = pv;
  }
  return { key, params, value };
}

// ─── ICS パース ──────────────────────────────────────────────────────────────

export function parseICS(content: string): ICSEvent[] {
  const lines = unfoldLines(content);
  const events: ICSEvent[] = [];

  let inEvent = false;
  let eventLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') { inEvent = true; eventLines = []; continue; }
    if (trimmed === 'END:VEVENT')   { inEvent = false; processEvent(eventLines, events); continue; }
    if (inEvent) eventLines.push(line);
  }

  return events;
}

function processEvent(lines: string[], out: ICSEvent[]) {
  let summary   = '(予定)';
  let startDate: Date | null = null;
  let endDate:   Date | null = null;
  let isAllDay   = false;
  let rrule:    string | undefined;
  const exdates: Date[] = [];

  for (const line of lines) {
    const prop = parsePropLine(line);
    if (!prop) continue;
    const { key, params, value } = prop;

    if (key === 'SUMMARY') {
      summary = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    } else if (key === 'DTSTART') {
      isAllDay  = params['VALUE'] === 'DATE' || /^\d{8}$/.test(value);
      startDate = parseICSDate(value);
    } else if (key === 'DTEND' || key === 'DUE') {
      endDate = parseICSDate(value);
    } else if (key === 'DURATION' && startDate && !endDate) {
      endDate = parseDuration(startDate, value);
    } else if (key === 'RRULE') {
      rrule = value;
    } else if (key === 'EXDATE') {
      for (const v of value.split(',')) {
        const d = parseICSDate(v.trim());
        if (d) exdates.push(d);
      }
    }
  }

  if (!startDate) return;
  const duration = isAllDay ? 86400000 : 3600000;
  out.push({
    summary,
    startDate,
    endDate: endDate ?? new Date(startDate.getTime() + duration),
    isAllDay,
    rrule,
    exdates,
  });
}

function parseDuration(start: Date, dur: string): Date {
  // PT1H, P1D, PT30M など
  const d = { weeks:0, days:0, hours:0, minutes:0 };
  const m = dur.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (m) {
    d.weeks   = +(m[1]??0);
    d.days    = +(m[2]??0);
    d.hours   = +(m[3]??0);
    d.minutes = +(m[4]??0);
  }
  const ms = ((d.weeks*7 + d.days)*24*60 + d.hours*60 + d.minutes) * 60000;
  return new Date(start.getTime() + (ms || 3600000));
}

// ─── 繰り返しイベントの展開 ─────────────────────────────────────────────────

const BYDAY_MAP: Record<string, number> = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };

function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

export function expandEvents(events: ICSEvent[], rangeStart: Date, rangeEnd: Date): ICSEvent[] {
  const result: ICSEvent[] = [];

  for (const ev of events) {
    if (!ev.rrule) {
      if (ev.endDate > rangeStart && ev.startDate <= rangeEnd) result.push(ev);
      continue;
    }

    const rr        = ev.rrule;
    const freq      = rr.match(/FREQ=(\w+)/)?.[1] ?? '';
    const untilStr  = rr.match(/UNTIL=(\d{8}T?\d{0,6}Z?)/)?.[1];
    const countStr  = rr.match(/COUNT=(\d+)/)?.[1];
    const interval  = +(rr.match(/INTERVAL=(\d+)/)?.[1] ?? '1');
    const bydayStr  = rr.match(/BYDAY=([A-Z,]+)/)?.[1];

    const until    = untilStr ? parseICSDate(untilStr) : null;
    const maxCount = countStr ? +countStr : 730; // 最大2年分
    const effectiveEnd = (until && until < rangeEnd) ? until : rangeEnd;
    const duration = ev.endDate.getTime() - ev.startDate.getTime();

    const isExcluded = (d: Date) => ev.exdates.some(ex => sameDay(ex, d));
    const addIfInRange = (s: Date) => {
      if (s >= rangeStart && s <= effectiveEnd && !isExcluded(s)) {
        result.push({ ...ev, startDate: new Date(s), endDate: new Date(s.getTime() + duration), rrule: undefined });
      }
    };

    if (freq === 'DAILY') {
      let cur = new Date(ev.startDate);
      let n = 0;
      while (cur <= effectiveEnd && n < maxCount) {
        addIfInRange(cur);
        cur = new Date(cur.getTime() + interval * 86400000);
        n++;
      }
    } else if (freq === 'WEEKLY') {
      const targetDays = bydayStr
        ? bydayStr.split(',').map(s => BYDAY_MAP[s.replace(/[^A-Z]/g,'')]).filter(d => d !== undefined)
        : [ev.startDate.getDay()];

      // rangeStart より前の直近の週起点を探す
      let weekBase = new Date(ev.startDate);
      while (new Date(weekBase.getTime() + interval*7*86400000) < rangeStart) {
        weekBase = new Date(weekBase.getTime() + interval*7*86400000);
      }

      let n = 0;
      let cur = new Date(weekBase);
      // 最大 (maxCount×7) 日スキャン
      while (cur <= effectiveEnd && n < maxCount) {
        if (targetDays.includes(cur.getDay()) && cur >= ev.startDate) {
          const s = new Date(cur);
          s.setHours(ev.startDate.getHours(), ev.startDate.getMinutes(), 0, 0);
          addIfInRange(s);
          n++;
        }
        cur = new Date(cur.getTime() + 86400000);
      }
    } else if (freq === 'MONTHLY') {
      let cur = new Date(ev.startDate);
      let n = 0;
      while (cur <= effectiveEnd && n < maxCount) {
        addIfInRange(cur);
        cur = new Date(cur);
        cur.setMonth(cur.getMonth() + interval);
        n++;
      }
    } else {
      // YEARLY や未対応：範囲内なら含める
      if (ev.endDate > rangeStart && ev.startDate <= rangeEnd) result.push(ev);
    }
  }

  return result;
}

// ─── ICSイベント → busy セル ────────────────────────────────────────────────

function rowToMin(label: string): number | null {
  const m1 = label.match(/^(\d{1,2}):(\d{2})/);
  if (m1) return +m1[1]*60 + +m1[2];
  const m2 = label.match(/(午前|午後)?(\d{1,2})時/);
  if (m2) {
    let h = +m2[2];
    if (m2[1]==='午後' && h!==12) h += 12;
    if (m2[1]==='午前' && h===12) h = 0;
    return h*60;
  }
  const m3 = label.match(/^(\d{1,2})$/);
  if (m3 && +m3[1]<=23) return +m3[1]*60;
  return null;
}

function eventDateMatchesCol(ev: ICSEvent, colLabel: string): boolean {
  const d = ev.startDate;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dateStr = `${m}/${day}`;

  // 日付照合: "5/7(月)" など
  if (colLabel.startsWith(dateStr) || colLabel.startsWith(`0${dateStr}`)) return true;

  // 曜日照合: "月", "(月)", "月曜" など
  const DOW = ['日','月','火','水','木','金','土'];
  const dc = DOW[d.getDay()];
  if (
    colLabel === dc ||
    colLabel === `${dc}曜` ||
    colLabel === `${dc}曜日` ||
    colLabel.includes(`(${dc})`) ||
    colLabel.includes(`${dc}曜`)
  ) return true;

  return false;
}

function rowOverlapsEvent(ri: number, rowLabels: string[], ev: ICSEvent): boolean {
  if (ev.isAllDay) return true;

  const rs = rowToMin(rowLabels[ri]);
  if (rs === null) return false;

  const nextRs = ri+1 < rowLabels.length ? rowToMin(rowLabels[ri+1]) : null;
  const re = nextRs ?? rs + 60;

  const es = ev.startDate.getHours()*60 + ev.startDate.getMinutes();
  let ee   = ev.endDate.getHours()*60   + ev.endDate.getMinutes();
  // 深夜0時終わり → 24:00 として扱う
  if (ee === 0 && ev.endDate.getDate() !== ev.startDate.getDate()) ee = 24*60;

  return rs < ee && re > es;
}

export interface MappingResult {
  freeCells: { row: number; col: number }[];
  busyCells: { row: number; col: number }[];
  matchedEvents: ICSEvent[];
  unmatchedEvents: ICSEvent[];
}

export function mapEventsToKOMARO(
  events: ICSEvent[],
  rowLabels: string[],
  colLabels: string[]
): MappingResult {
  const busySet = new Set<string>();
  const matchedSet = new Set<ICSEvent>();

  for (const ev of events) {
    let matched = false;
    for (let ci = 0; ci < colLabels.length; ci++) {
      if (!eventDateMatchesCol(ev, colLabels[ci])) continue;
      for (let ri = 0; ri < rowLabels.length; ri++) {
        if (rowOverlapsEvent(ri, rowLabels, ev)) {
          busySet.add(`${ri}-${ci}`);
          matched = true;
        }
      }
    }
    if (matched) matchedSet.add(ev);
  }

  const freeCells: { row: number; col: number }[] = [];
  const busyCells: { row: number; col: number }[] = [];

  for (let ri = 0; ri < rowLabels.length; ri++) {
    for (let ci = 0; ci < colLabels.length; ci++) {
      const cell = { row: ri, col: ci };
      if (busySet.has(`${ri}-${ci}`)) busyCells.push(cell);
      else freeCells.push(cell);
    }
  }

  return {
    freeCells,
    busyCells,
    matchedEvents: events.filter(e => matchedSet.has(e)),
    unmatchedEvents: events.filter(e => !matchedSet.has(e)),
  };
}
