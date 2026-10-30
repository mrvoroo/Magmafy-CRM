/**
 * A small in-memory stand-in for the Apps Script services the backend uses
 * (SpreadsheetApp, PropertiesService, CacheService, LockService, Utilities, MailApp, Session, ContentService …),
 * so Code.gs + Crm.gs + Api.gs can run in Node exactly as written and be checked against the site's schemas.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

type Cell = unknown;

class Range {
  constructor(private sh: Sheet, private r: number, private c: number, private nr = 1, private nc = 1) {}
  getValues() {
    const out: Cell[][] = [];
    for (let i = 0; i < this.nr; i++) {
      const row: Cell[] = [];
      for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j));
      out.push(row);
    }
    return out;
  }
  getValue() { return this.sh.get(this.r, this.c); }
  setValues(v: Cell[][]) { v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this; }
  setValue(v: Cell) { this.sh.set(this.r, this.c, v); return this; }
  getRow() { return this.r; }
  getColumn() { return this.c; }
  getNumRows() { return this.nr; }
  getSheet() { return this.sh; }
  // formatting: no-ops
  setNumberFormat() { return this; } setDataValidation() { return this; } setBackground() { return this; } setFontColor() { return this; }
  setFontWeight() { return this; } setVerticalAlignment() { return this; } setWrap() { return this; } setFontSize() { return this; }
  setNote() { return this; } clearNote() { return this; } setFormula(f: string) { this.sh.set(this.r, this.c, f); return this; }
}

/** Sheets turns what you type into numbers / dates; mimic the part that matters (numbers). */
function coerce(v: Cell): Cell {
  if (typeof v === 'string') {
    if (v.startsWith("'")) return v.slice(1);
    if (/^-?\d+(\.\d+)?$/.test(v.trim()) && v.trim().length < 15) return Number(v);
  }
  return v instanceof Date ? new Date(v.getTime()) : v;
}

export class Sheet {
  data: Cell[][] = [];
  maxRows = 1000;
  constructor(public name: string) {}
  get(r: number, c: number) { const v = this.data[r - 1]?.[c - 1]; return v === undefined || v === null ? '' : v instanceof Date ? new Date(v.getTime()) : v; }
  set(r: number, c: number, v: Cell) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = coerce(v); }
  getName() { return this.name; }
  getLastRow() { for (let i = this.data.length; i > 0; i--) if (this.data[i - 1].some((x) => x !== '' && x != null)) return i; return 0; }
  getLastColumn() { return this.data.reduce((m, row) => { let k = 0; row.forEach((x, i) => { if (x !== '' && x != null) k = i + 1; }); return Math.max(m, k); }, 0); }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(_a: number, n: number) { this.maxRows += n; }
  getRange(a: number | string, c = 1, nr = 1, nc = 1) { if (typeof a === 'string') return new Range(this, 1, 1); return new Range(this, a, c, nr, nc); }
  appendRow(row: Cell[]) { const r = this.getLastRow() + 1; row.forEach((x, i) => this.set(r, i + 1, x)); }
  deleteRows(r: number, n: number) { this.data.splice(r - 1, n); }
  clear() { this.data = []; }
  setRightToLeft() {} setFrozenRows() {} setRowHeight() {} setColumnWidth() {} setColumnWidths() {} hideSheet() {}
  getConditionalFormatRules() { return []; } setConditionalFormatRules() {}
}

export class Spreadsheet {
  sheets: Sheet[] = [];
  getSheetByName(n: string) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n: string) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s: Sheet) { this.sheets = this.sheets.filter((x) => x !== s); }
  getId() { return 'SS1'; } getUrl() { return 'https://docs.google.com/spreadsheets/d/SS1'; }
  setSpreadsheetTimeZone() {} setSpreadsheetLocale() {} setActiveSheet() {} moveActiveSheet() {} toast() {}
}

function fmt(d: Date, tz: string, p: string) {
  const off = tz === 'Asia/Riyadh' ? 3 : 0;
  const x = new Date(d.getTime() + off * 3600e3);
  const pad = (n: number, k = 2) => String(n).padStart(k, '0');
  const map: Record<string, string> = {
    yyyy: String(x.getUTCFullYear()), MM: pad(x.getUTCMonth() + 1), dd: pad(x.getUTCDate()), HH: pad(x.getUTCHours()), mm: pad(x.getUTCMinutes()),
    u: String(x.getUTCDay() || 7), d: String(x.getUTCDate()), M: String(x.getUTCMonth() + 1), H: String(x.getUTCHours())
  };
  return p.replace(/yyyy|MM|dd|HH|mm|u|d|M|H/g, (t) => map[t]);
}

export type Sim = ReturnType<typeof createSim>;

export function createSim(opts: { owner: string }) {
  const ss = new Spreadsheet();
  const props = new Map<string, string>();
  const cache = new Map<string, { v: string; until: number }>();
  const mails: Record<string, unknown>[] = [];
  let activeUser = '';

  const builder = () => { const b: Record<string, () => unknown> = {}; ['requireValueInRange', 'setAllowInvalid', 'whenTextEqualTo', 'setBackground', 'setFontColor', 'setRanges'].forEach((k) => { b[k] = () => b; }); b.build = () => ({}); return b; };
  const ctx: Record<string, unknown> = {
    console,
    SpreadsheetApp: {
      getActive: () => ss, openById: () => ss, getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addSeparator() { return this; }, addToUi() {} }) }),
      newDataValidation: builder, newConditionalFormatRule: builder
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => (props.has(k) ? props.get(k)! : null), setProperty: (k: string, v: string) => { props.set(k, String(v)); },
        deleteProperty: (k: string) => { props.delete(k); }, getProperties: () => Object.fromEntries(props)
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => { const e = cache.get(k); return e && e.until > Date.now() ? e.v : null; },
        put: (k: string, v: string, s = 600) => { cache.set(k, { v: String(v), until: Date.now() + s * 1000 }); },
        remove: (k: string) => { cache.delete(k); }
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    Utilities: {
      formatDate: fmt, getUuid: () => randomUUID(),
      computeDigest: (_a: unknown, s: string) => Array.from(createHash('sha256').update(s, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }
    },
    MailApp: { sendEmail: (m: Record<string, unknown>) => { mails.push(m); } },
    Session: { getActiveUser: () => ({ getEmail: () => activeUser }), getEffectiveUser: () => ({ getEmail: () => opts.owner }) },
    ContentService: { createTextOutput: (t: string) => ({ setMimeType() { return this; }, getContent: () => t, text: t }), MimeType: { JSON: 'json' } },
    HtmlService: { createHtmlOutputFromFile: () => ({ setTitle() { return this; }, addMetaTag() { return this; }, setFaviconUrl() { return this; } }) },
    ScriptApp: { getProjectTriggers: () => [] },
    CalendarApp: {
      getCalendarById: () => ({ getEvents: () => [], createEvent: () => ({ getId: () => 'EV1' }), getEventById: () => null }),
      getDefaultCalendar: () => ({ getEvents: () => [] }), GuestStatus: { NO: 'NO' }
    }
  };
  vm.createContext(ctx);
  const dir = join(__dirname, '..');
  // Apps Script puts every .gs file in one global scope; concatenating does the same.
  const src = ['Code.gs', 'Crm.gs', 'Api.gs'].map((f) => readFileSync(join(dir, f), 'utf8')).join('\n;\n');
  vm.runInContext(src + '\n;globalThis.__run = (name, args) => eval(name).apply(null, args || []);', ctx, { filename: 'backend.gs' });
  const run = (name: string, ...args: unknown[]) => (ctx as { __run: (n: string, a: unknown[]) => unknown }).__run(name, args);

  return {
    ss, props, mails, run,
    as(email: string) { activeUser = email; },
    /** What the site does: POST {action:'crm', fn, args, token} and read the JSON envelope. */
    post(body: Record<string, unknown>) {
      const out = run('doPost', { postData: { contents: JSON.stringify(body) } }) as { text: string };
      return JSON.parse(out.text) as { ok: boolean; data?: unknown; code?: string; error?: string };
    },
    get(params: Record<string, string>) { return JSON.parse((run('doGet', { parameter: params }) as { text: string }).text); },
    /** Puts the emailed OTP straight into the cache (we can't read the email in a test). */
    otpFor(email: string) {
      const code = '424242';
      const h = createHash('sha256').update(code, 'utf8').digest('hex');
      ctx.CacheService && (ctx as { CacheService: { getScriptCache: () => { put: (k: string, v: string, s: number) => void } } }).CacheService.getScriptCache().put('otp:' + email, JSON.stringify({ h, n: 0 }), 600);
      return code;
    },
    sheet(name: string) { return ss.getSheetByName(name)!; }
  };
}
