/**
 * Magmafy OS · Phase 4 — API for the standalone CRM site (React, hosted on GitHub Pages).
 *
 * The site talks to this script with one request shape:
 *   POST /exec   Content-Type: text/plain   { action: 'crm', fn, args, token }
 *   → { ok: true, data }  or  { ok: false, code, error }
 * codes: SESSION_EXPIRED · FORBIDDEN · UNKNOWN_FUNCTION · APP_ERROR (Arabic message for the user) · SERVER
 *
 * New tabs (made by «① تجهيز الشيت»): الإعلانات · القراءات · المحادثات · الرسائل · الإشعارات · طلبات الانضمام · سجل التعديلات
 * The exact shape of every answer is the Zod schema in the site repo: src/api/schemas.ts.
 */

/* =========================================================================
 * 1. Gateway
 * ========================================================================= */

function crmGateway_(body) {
  const fn = String(body.fn || '');
  const args = Array.isArray(body.args) ? body.args : [];
  try {
    let data;
    if (fn === 'crmRequestCode') data = crmRequestCode(args[0]);
    else if (fn === 'crmVerifyCode') data = crmVerifyCode(args[0], args[1]);
    else if (fn === 'crmLogout') data = crmLogout(args[0]);
    else if (fn === 'crmRequestAccess') data = crmRequestAccess(args[0]);
    else data = crmCall(body.token, fn, args);
    return { ok: true, data: data };
  } catch (err) {
    const msg = String((err && err.message) || err);
    if (msg === 'SESSION_EXPIRED') return { ok: false, code: 'SESSION_EXPIRED', error: 'الجلسة خلصت، سجّل دخول تاني' };
    if (msg === 'unknown_function') return { ok: false, code: 'UNKNOWN_FUNCTION', error: 'unknown_function' };
    if (msg.indexOf('غير مصرح لك بدخول') === 0) return { ok: false, code: 'FORBIDDEN', error: msg };
    if (/[؀-ۿ]/.test(msg)) return { ok: false, code: 'APP_ERROR', error: msg };
    logError_('crm:' + fn, err, {});
    return { ok: false, code: 'SERVER', error: 'حصلت مشكلة في السيرفر، جرّب تاني' };
  }
}

/** Every function the signed-in site may call. crmCall (Crm.gs) checks the token, then looks the name up here. */
function crmApi_() {
  return {
    crmBootstrap: crmBootstrap, crmLead: crmLead, crmSaveLead: crmSaveLead, crmDeleteLead: crmDeleteLead,
    crmAddActivity: crmAddActivity, crmAddTask: crmAddTask, crmSetTask: crmSetTask, crmUpdateBooking: crmUpdateBooking,
    crmSendEmail: crmSendEmail, crmLogWhatsApp: crmLogWhatsApp, crmDashboard: crmDashboard,
    crmActivityFeed: crmActivityFeed, crmBulkUpdateLeads: crmBulkUpdateLeads, crmSaveTemplate: crmSaveTemplate,
    crmSaveTeamMember: crmSaveTeamMember, crmSettings: crmSettings, crmSaveSettings: crmSaveSettings,
    crmPulse: crmPulse, crmNotifications: crmNotifications, crmMarkNotifications: crmMarkNotifications,
    crmAnnouncements: crmAnnouncements, crmSaveAnnouncement: crmSaveAnnouncement, crmAckAnnouncement: crmAckAnnouncement,
    crmAnnouncementStats: crmAnnouncementStats, crmRemindAnnouncement: crmRemindAnnouncement,
    crmThreads: crmThreads, crmThread: crmThread, crmSendMessage: crmSendMessage, crmEditMessage: crmEditMessage,
    crmSaveThread: crmSaveThread, crmAccessRequests: crmAccessRequests, crmHandleAccess: crmHandleAccess, crmAudit: crmAudit
  };
}

/* =========================================================================
 * 2. Small helpers
 * ========================================================================= */

const EMAIL_RE_ = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function yesv_(v) { return v === true || /^(نعم|yes|true|1)$/i.test(String(v == null ? '' : v).trim()); }
function str_(v) { return v == null ? '' : v instanceof Date ? (isNaN(v) ? '' : v.toISOString()) : String(v); }
function ms_(v) { const d = toDate_(v); return d ? d.getTime() : 0; }
function splitList_(v) { return (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,،]\s*/)).map((s) => String(s).trim()).filter(String); }
function byDateDesc_(field) { return (a, b) => ms_(b[field]) - ms_(a[field]); }

/** Sequential ids that keep growing past 9999 (N-00001 …). Hold the script lock. */
function seqId_(prefix, pad) {
  const props = PropertiesService.getScriptProperties();
  const n = Number(props.getProperty('SEQ_' + prefix) || 0) + 1;
  props.setProperty('SEQ_' + prefix, String(n));
  const s = String(n);
  return prefix + '-' + (s.length >= pad ? s : new Array(pad - s.length + 1).join('0') + s);
}

/** A cursor page: items newest first, next = the date to pass as «before» for the next page. */
function pageOf_(items, q, field, defLimit) {
  q = q || {};
  if (q.before) { const b = ms_(q.before); items = items.filter((x) => ms_(x[field]) < b); }
  const limit = Math.max(1, Math.min(200, Number(q.limit) || defLimit));
  const page = items.slice(0, limit);
  return { items: ser_(page), next: items.length > limit ? str_(page[page.length - 1][field]) : null };
}

function activeTeam_() { return table_('TEAM').rows.filter((r) => yesv_(r.active)); }
function adminEmails_(team) { return (team || activeTeam_()).filter((t) => t.role === ADMIN_ROLE).map((t) => String(t.email).toLowerCase()); }
function emailOfName_(name, team) { const t = (team || activeTeam_()).filter((x) => x.name === name)[0]; return t ? String(t.email).toLowerCase() : ''; }

/* =========================================================================
 * 3. Audit log, notifications, pulse version
 * ========================================================================= */

/**
 * One row per changed field for edits, one row with the whole record for create/delete.
 * Never lets a logging problem break the action itself.
 */
function auditLog_(me, source, action, entity, entityId, before, after, note) {
  try {
    const by = me || { email: '', name: 'نظام' };
    const t = table_('AUDIT');
    const base = { byEmail: by.email || '', byName: by.name || '', source: source, action: action, entity: entity, entityId: String(entityId || ''), note: note || '' };
    const cut = (v) => str_(v).slice(0, 2000);
    if (action === 'تعديل' && before && after) {
      Object.keys(after).forEach((k) => {
        if (k === 'updated' || k === '_row') return;
        if (str_(before[k]) === str_(after[k])) return;
        t.append(Object.assign({ id: seqId_('AU', 6), date: new Date(), field: k, oldValue: cut(before[k]), newValue: cut(after[k]) }, base));
      });
      if (note && !Object.keys(after).some((k) => k !== 'updated' && k !== '_row' && str_(before[k]) !== str_(after[k]))) {
        t.append(Object.assign({ id: seqId_('AU', 6), date: new Date(), field: '', oldValue: '', newValue: '' }, base));
      }
    } else {
      const strip = (o) => { if (!o) return ''; const c = {}; Object.keys(o).forEach((k) => { if (k !== '_row') c[k] = str_(o[k]); }); return JSON.stringify(c); };
      t.append(Object.assign({ id: seqId_('AU', 6), date: new Date(), field: '', oldValue: cut(strip(before)), newValue: cut(strip(after)) }, base));
    }
  } catch (err) { logError_('audit', err, { entity: entity, id: entityId }); }
}

/** Puts a bell notification in each person's list (once each, never to `except`). Hold the script lock. */
function notify_(emails, n, except) {
  try {
    const t = table_('NOTIFICATIONS');
    const seen = {};
    except = String(except || '').toLowerCase();
    (emails || []).forEach((e) => {
      e = String(e || '').trim().toLowerCase();
      if (!e || e === except || seen[e]) return;
      seen[e] = 1;
      t.append({ id: seqId_('N', 5), date: new Date(), toEmail: e, kind: n.kind, title: String(n.title || '').slice(0, 200), refType: n.refType || '', refId: n.refId || '', by: n.by || '', readAt: '' });
      bump_(e);
    });
  } catch (err) { logError_('notify', err, { kind: n && n.kind }); }
}

/** Something changed for this person: their next «pulse» is recomputed instead of cached. */
function bump_(email) {
  email = String(email || '').toLowerCase();
  PropertiesService.getScriptProperties().setProperty('PV_' + email, String(Date.now()));
  CacheService.getScriptCache().remove('pulse:' + email);
}
function bumpAll_(emails) { (emails || []).forEach(bump_); }

/** Called by handleBooking_ (Code.gs) after a booking from the public website. */
function notifyNewBooking_(lead, booking) {
  withLock_(() => {
    const team = activeTeam_();
    const ownerEmail = lead.owner ? emailOfName_(lead.owner, team) : '';
    notify_(ownerEmail ? [ownerEmail] : adminEmails_(team), {
      kind: 'اجتماع جديد', title: 'حجز جديد: ' + (lead.business || lead.name) + ' · ' + booking.meetingType, refType: 'عميل', refId: lead.id, by: 'الموقع'
    });
    auditLog_({ email: '', name: 'الموقع' }, 'الموقع', 'إنشاء', 'اجتماع', booking.id, null, booking);
  });
}

/** Called by handleEdit_ (Code.gs): records a hand edit in the sheet. */
function auditSheetEdit_(e, sheetName, header) {
  const map = {};
  map[SHEET.LEADS] = ['عميل', 'ID']; map[SHEET.BOOKINGS] = ['اجتماع', 'ID']; map[SHEET.TASKS] = ['مهمة', 'ID'];
  map[SHEET.TEMPLATES] = ['قالب', 'ID']; map[SHEET.TEAM] = ['عضو', 'البريد']; map[SHEET.SETTINGS] = ['إعداد', 'الإعداد'];
  map[SHEET.ANNOUNCEMENTS] = ['إعلان', 'ID'];
  const m = map[sheetName];
  if (!m || String(e.oldValue == null ? '' : e.oldValue) === String(e.value == null ? '' : e.value)) return;
  const sh = e.range.getSheet();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf(m[1]) + 1;
  const id = idCol ? sh.getRange(e.range.getRow(), idCol).getValue() : e.range.getRow();
  const who = editor_();
  const team = table_('TEAM').rows.filter((r) => String(r.email).toLowerCase() === String(who).toLowerCase())[0];
  const t = table_('AUDIT');
  t.append({ id: seqId_('AU', 6), date: new Date(), byEmail: String(who), byName: team ? team.name : String(who), source: 'الشيت', action: 'تعديل', entity: m[0], entityId: String(id), field: String(header), oldValue: str_(e.oldValue).slice(0, 2000), newValue: str_(e.value).slice(0, 2000), note: '' });
}

/* =========================================================================
 * 4. Inbox context: announcements, threads, messages, read marks
 * ========================================================================= */

/** Reads the inbox tabs once per request. */
function inboxCtx_() {
  return {
    team: activeTeam_(),
    anns: table_('ANNOUNCEMENTS'),
    threads: table_('THREADS'),
    messages: table_('MESSAGES'),
    reads: table_('READS')
  };
}

function annStatus_(a) {
  if (a.status === 'مسودة' || a.status === 'مؤرشف') return a.status;
  if (a.startsAt && ms_(a.startsAt) > Date.now()) return 'مجدول';
  if (a.expiresAt && ms_(a.expiresAt) < Date.now()) return 'مؤرشف';
  return 'منشور';
}

function audienceEmails_(audience, team) {
  const parts = splitList_(audience);
  const all = !parts.length || parts.indexOf('الكل') >= 0;
  return team.filter((t) => all || parts.indexOf(t.role) >= 0 || parts.indexOf(String(t.email).toLowerCase()) >= 0)
    .map((t) => String(t.email).toLowerCase());
}

function readOf_(ctx, kind, refId, email) {
  return ctx.reads.rows.filter((r) => r.kind === kind && r.refId === refId && String(r.email).toLowerCase() === email)[0] || null;
}

function annView_(me, a, ctx) {
  const r = readOf_(ctx, 'إعلان', a.id, me.email);
  const v = Object.assign({}, a);
  delete v._row;
  v.status = annStatus_(a);
  v.seenAt = r ? str_(r.seenAt) : '';
  v.ackAt = r ? str_(r.ackAt) : '';
  return v;
}

function liveAnnouncements_(me, ctx) {
  return ctx.anns.rows.filter((a) => annStatus_(a) === 'منشور' && audienceEmails_(a.audience, ctx.team).indexOf(me.email) >= 0)
    .map((a) => annView_(me, a, ctx))
    .sort((a, b) => (yesv_(b.pinned) ? 1 : 0) - (yesv_(a.pinned) ? 1 : 0) || ms_(b.startsAt || b.created) - ms_(a.startsAt || a.created));
}

function threadMembers_(t, ctx) {
  const m = splitList_(t.members).map((x) => x.toLowerCase());
  if (t.type !== 'مباشرة') return m;
  adminEmails_(ctx.team).forEach((a) => { if (m.indexOf(a) < 0) m.push(a); });
  return m;
}
function inThread_(me, t, ctx) { return threadMembers_(t, ctx).indexOf(me.email) >= 0; }

function unreadIn_(me, t, ctx) {
  const r = readOf_(ctx, 'محادثة', t.id, me.email);
  const last = r ? ms_(r.seenAt) : 0;
  return ctx.messages.rows.filter((m) => m.threadId === t.id && String(m.fromEmail).toLowerCase() !== me.email && !m.deletedAt && ms_(m.date) > last).length;
}

/** Marks seen (and acknowledged). Hold the script lock. */
function setRead_(me, ctx, kind, refId, ack) {
  const now = new Date();
  const r = readOf_(ctx, kind, refId, me.email);
  if (!r) {
    const row = { kind: kind, refId: refId, email: me.email, name: me.name, seenAt: now, ackAt: ack ? now : '' };
    ctx.reads.append(row);
    ctx.reads.rows.push(row);
    return row;
  }
  const patch = {};
  if (!r.seenAt || kind === 'محادثة') patch.seenAt = now;
  if (ack && !r.ackAt) patch.ackAt = now;
  if (Object.keys(patch).length) { ctx.reads.update(r._row, patch); Object.assign(r, patch); }
  return r;
}

function msgView_(m) {
  const v = Object.assign({}, m);
  delete v._row;
  if (v.deletedAt) v.body = '';
  return v;
}

function pulseOf_(me, ctx) {
  const notifs = table_('NOTIFICATIONS').rows.filter((n) => String(n.toEmail).toLowerCase() === me.email && !n.readAt).length;
  const messages = ctx.threads.rows.filter((t) => inThread_(me, t, ctx)).reduce((s, t) => s + unreadIn_(me, t, ctx), 0);
  const anns = liveAnnouncements_(me, ctx);
  const urgent = anns.filter((a) => a.level === 'عاجل' && yesv_(a.requireAck) && !a.ackAt)[0] || null;
  const version = PropertiesService.getScriptProperties().getProperty('PV_' + me.email) || '0';
  return { version: version + '.' + notifs + '.' + messages, unread: { notifications: notifs, messages: messages, announcements: anns.filter((a) => !a.seenAt).length }, urgent: urgent };
}

/* =========================================================================
 * 5. Pulse + notifications
 * ========================================================================= */

/** Polled by the site every few seconds; cached per person until something changes for them (max 2 min). */
function crmPulse() {
  const me = requireUser_();
  const cache = CacheService.getScriptCache();
  const key = 'pulse:' + me.email;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const out = ser_(pulseOf_(me, inboxCtx_()));
  cache.put(key, JSON.stringify(out), 120);
  return out;
}

function crmNotifications(q) {
  const me = requireUser_();
  q = q || {};
  let items = table_('NOTIFICATIONS').rows.filter((n) => String(n.toEmail).toLowerCase() === me.email).sort(byDateDesc_('date'));
  if (q.unreadOnly) items = items.filter((n) => !n.readAt);
  return pageOf_(items, q, 'date', 30);
}

function crmMarkNotifications(q) {
  const me = requireUser_();
  q = q || {};
  const ids = Array.isArray(q.ids) ? q.ids : [];
  return withLock_(() => {
    const t = table_('NOTIFICATIONS');
    const mine = t.rows.filter((n) => String(n.toEmail).toLowerCase() === me.email && !n.readAt);
    const now = new Date();
    let left = 0;
    mine.forEach((n) => { if (q.all || ids.indexOf(n.id) >= 0) t.update(n._row, { readAt: now }); else left++; });
    bump_(me.email);
    return { ok: true, unread: left };
  });
}

/* =========================================================================
 * 6. Announcements
 * ========================================================================= */

function crmAnnouncements(q) {
  const me = requireUser_();
  q = q || {};
  const ctx = inboxCtx_();
  let items = ctx.anns.rows.filter((a) => me.isAdmin || audienceEmails_(a.audience, ctx.team).indexOf(me.email) >= 0)
    .map((a) => annView_(me, a, ctx))
    .filter((a) => me.isAdmin || a.status === 'منشور' || a.status === 'مؤرشف');
  if (q.status) items = items.filter((a) => a.status === q.status);
  items.sort((a, b) => (yesv_(b.pinned) ? 1 : 0) - (yesv_(a.pinned) ? 1 : 0) || ms_(b.startsAt || b.created) - ms_(a.startsAt || a.created));
  return { items: ser_(items), next: null };
}

function crmSaveAnnouncement(a) {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('الإعلانات للأدمن بس');
  a = a || {};
  const title = clean_(a.title, 120), body = String(a.body == null ? '' : a.body).trim().slice(0, 4000);
  if (!title || !body) throw new Error('اكتب العنوان والنص');
  if (['معلومة', 'مهم', 'عاجل'].indexOf(a.level) < 0) throw new Error('اختار الأهمية');
  const status = ['مسودة', 'منشور', 'مؤرشف'].indexOf(a.status) >= 0 ? a.status : 'منشور';
  const startsAt = toDate_(a.startsAt) || new Date();
  const expiresAt = toDate_(a.expiresAt) || '';
  if (expiresAt && expiresAt <= startsAt) throw new Error('تاريخ الانتهاء لازم يكون بعد البداية');

  const res = withLock_(() => {
    const ctx = inboxCtx_();
    let row = a.id ? ctx.anns.rows.filter((x) => x.id === a.id)[0] : null;
    const before = row ? Object.assign({}, row) : null;
    const wasLive = row ? annStatus_(row) === 'منشور' : false;
    const patch = {
      title: title, body: body, level: a.level, audience: splitList_(a.audience).join(', ') || 'الكل',
      pinned: yesv_(a.pinned) ? 'نعم' : 'لا', requireAck: yesv_(a.requireAck) ? 'نعم' : 'لا', emailCopy: yesv_(a.emailCopy) ? 'نعم' : 'لا',
      startsAt: startsAt, expiresAt: expiresAt, status: status, updated: new Date()
    };
    if (!row) {
      row = Object.assign({ id: seqId_('ANN', 4), created: new Date(), by: me.name, threadId: '' }, patch);
      ctx.anns.append(row);
      row._row = ctx.anns.sheet.getLastRow();
    } else {
      ctx.anns.update(row._row, patch);
      Object.assign(row, patch);
    }
    if (a.reAck) ctx.reads.rows.forEach((r) => { if (r.kind === 'إعلان' && r.refId === row.id && r.ackAt) ctx.reads.update(r._row, { ackAt: '' }); });
    const audience = audienceEmails_(row.audience, ctx.team);
    const live = annStatus_(row) === 'منشور';
    if (live && !row.threadId) {
      const th = { id: seqId_('TH', 4), created: new Date(), createdBy: me.email, title: title, type: 'إعلان', members: audience.join(', '), leadId: '', announcementId: row.id, lastMessageAt: new Date(), status: 'مفتوحة' };
      ctx.threads.append(th);
      ctx.anns.update(row._row, { threadId: th.id });
      row.threadId = th.id;
    }
    if (live && !wasLive) {
      notify_(audience, { kind: 'إعلان', title: (row.level === 'عاجل' ? '🔴 ' : '') + title, refType: 'إعلان', refId: row.id, by: me.name }, me.email);
    }
    bumpAll_(audience);
    auditLog_(me, 'CRM', before ? 'تعديل' : 'إنشاء', 'إعلان', row.id, before, row);
    return { row: row, mail: live && !wasLive && yesv_(row.emailCopy) ? audience.filter((e) => e !== me.email) : [], ctx: ctx };
  });

  // Email copy outside the lock (slow).
  if (res.mail.length) {
    try {
      const brand = setting_('BRAND') || 'Magmafy';
      const url = setting_('CRM_URL');
      MailApp.sendEmail({
        to: me.email, bcc: res.mail.join(','), name: brand + ' CRM', subject: (res.row.level === 'عاجل' ? '🔴 ' : '') + 'إعلان: ' + title, body: body,
        htmlBody: emailShell_(true, '<h2 style="margin:0 0 10px">' + esc_(title) + '</h2><div style="white-space:pre-wrap">' + esc_(body) + '</div>' + (url ? button_(url + '#/announcements/' + res.row.id, 'افتح الإعلان') : ''), brand + ' CRM')
      });
    } catch (err) { logError_('announcement:mail', err, { id: res.row.id }); }
  }
  return ser_({ ok: true, announcement: annView_(me, res.row, res.ctx) });
}

function crmAckAnnouncement(id, o) {
  const me = requireUser_();
  o = o || {};
  return withLock_(() => {
    const ctx = inboxCtx_();
    const a = ctx.anns.rows.filter((x) => x.id === id)[0];
    if (!a || !(me.isAdmin || audienceEmails_(a.audience, ctx.team).indexOf(me.email) >= 0)) throw new Error('الإعلان غير موجود');
    const r = setRead_(me, ctx, 'إعلان', id, !!o.ack);
    if (o.ack) auditLog_(me, 'CRM', 'تعديل', 'إعلان', id, null, null, 'قريت وفهمت');
    bump_(me.email);
    return ser_({ ok: true, seenAt: r.seenAt, ackAt: r.ackAt || '' });
  });
}

function crmAnnouncementStats(id) {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('للأدمن بس');
  const ctx = inboxCtx_();
  const a = ctx.anns.rows.filter((x) => x.id === id)[0];
  if (!a) throw new Error('الإعلان غير موجود');
  return ser_({
    audience: audienceEmails_(a.audience, ctx.team).map((e) => {
      const r = readOf_(ctx, 'إعلان', id, e);
      const t = ctx.team.filter((x) => String(x.email).toLowerCase() === e)[0];
      return { email: e, name: t ? t.name : e, seenAt: r ? str_(r.seenAt) : '', ackAt: r ? str_(r.ackAt) : '' };
    })
  });
}

function crmRemindAnnouncement(id) {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('للأدمن بس');
  return withLock_(() => {
    const ctx = inboxCtx_();
    const a = ctx.anns.rows.filter((x) => x.id === id)[0];
    if (!a) throw new Error('الإعلان غير موجود');
    const pending = audienceEmails_(a.audience, ctx.team).filter((e) => { const r = readOf_(ctx, 'إعلان', id, e); return !(r && r.ackAt) && e !== me.email; });
    notify_(pending, { kind: 'إعلان', title: 'تذكير: ' + a.title, refType: 'إعلان', refId: id, by: me.name }, me.email);
    return { ok: true, reminded: pending.length };
  });
}

/* =========================================================================
 * 7. Team chat (threads + messages)
 * ========================================================================= */

function crmThreads() {
  const me = requireUser_();
  const ctx = inboxCtx_();
  const items = ctx.threads.rows.filter((t) => inThread_(me, t, ctx)).map((t) => {
    const msgs = ctx.messages.rows.filter((m) => m.threadId === t.id);
    const last = msgs[msgs.length - 1];
    const v = Object.assign({}, t);
    delete v._row;
    v.unread = unreadIn_(me, t, ctx);
    v.lastMessage = last ? { fromName: last.fromName, body: last.deletedAt ? '' : String(last.body).slice(0, 200), date: last.date } : null;
    return v;
  }).sort(byDateDesc_('lastMessageAt'));
  return ser_({ items: items });
}

function crmThread(id, q) {
  const me = requireUser_();
  q = q || {};
  return withLock_(() => {
    const ctx = inboxCtx_();
    const t = ctx.threads.rows.filter((x) => x.id === id)[0];
    if (!t || !inThread_(me, t, ctx)) throw new Error('المحادثة غير موجودة');
    let ms = ctx.messages.rows.filter((m) => m.threadId === id);
    let page, next = null;
    if (q.after) {
      const after = ms_(q.after);
      page = ms.filter((m) => ms_(m.date) > after || ms_(m.editedAt) > after || ms_(m.deletedAt) > after);
    } else {
      if (q.before) { const b = ms_(q.before); ms = ms.filter((m) => ms_(m.date) < b); }
      const limit = Math.max(1, Math.min(200, Number(q.limit) || 50));
      page = ms.slice(-limit);
      next = ms.length > limit ? str_(page[0].date) : null;
    }
    const hadUnread = unreadIn_(me, t, ctx) > 0;
    setRead_(me, ctx, 'محادثة', id, false);
    if (hadUnread) bump_(me.email);
    const readBy = {};
    ctx.reads.rows.filter((r) => r.kind === 'محادثة' && r.refId === id && String(r.email).toLowerCase() !== me.email)
      .forEach((r) => { readBy[String(r.email).toLowerCase()] = str_(r.seenAt); });
    const v = Object.assign({}, t);
    delete v._row;
    return ser_({ thread: v, messages: page.map(msgView_), next: next, readBy: readBy });
  });
}

function crmSendMessage(d) {
  const me = requireUser_();
  d = d || {};
  const body = String(d.body == null ? '' : d.body).trim().slice(0, 4000);
  if (!body) throw new Error('اكتب الرسالة');
  return withLock_(() => {
    const ctx = inboxCtx_();
    let t = d.threadId ? ctx.threads.rows.filter((x) => x.id === d.threadId)[0] : null;
    if (!t) {
      // A direct line between one team member and management. Staff can only open their own.
      const target = !d.to || d.to === 'management' ? me.email : String(d.to).trim().toLowerCase();
      if (target !== me.email && !me.isAdmin) throw new Error('تقدر تبعت للإدارة بس');
      if (!ctx.team.some((x) => String(x.email).toLowerCase() === target)) throw new Error('العضو مش في الفريق');
      t = ctx.threads.rows.filter((x) => x.type === 'مباشرة' && String(x.members).toLowerCase() === target)[0];
      if (!t) {
        t = { id: seqId_('TH', 4), created: new Date(), createdBy: me.email, title: '', type: 'مباشرة', members: target, leadId: '', announcementId: '', lastMessageAt: new Date(), status: 'مفتوحة' };
        ctx.threads.append(t);
        t._row = ctx.threads.sheet.getLastRow();
        ctx.threads.rows.push(t);
      }
    }
    if (!inThread_(me, t, ctx)) throw new Error('المحادثة غير موجودة');
    if (t.status === 'مقفولة') throw new Error('المحادثة مقفولة');
    const members = threadMembers_(t, ctx);
    const mentions = ctx.team.filter((m) => body.indexOf('@' + m.name) >= 0 && members.indexOf(String(m.email).toLowerCase()) >= 0).map((m) => String(m.email).toLowerCase());
    const now = new Date();
    const m = { id: seqId_('MSG', 5), date: now, threadId: t.id, fromEmail: me.email, fromName: me.name, body: body, replyTo: String(d.replyTo || ''), mentions: mentions.join(', '), editedAt: '', deletedAt: '', deletedBy: '' };
    ctx.messages.append(m);
    ctx.threads.update(t._row, { lastMessageAt: now });
    t.lastMessageAt = now;
    setRead_(me, ctx, 'محادثة', t.id, false);
    const label = t.type === 'مباشرة' ? me.name : (t.title || me.name);
    notify_(members.filter((e) => mentions.indexOf(e) < 0), { kind: 'رسالة', title: label + ': ' + body.slice(0, 90), refType: 'محادثة', refId: t.id, by: me.name }, me.email);
    notify_(mentions, { kind: 'منشن', title: me.name + ' عمل لك منشن: ' + body.slice(0, 80), refType: 'محادثة', refId: t.id, by: me.name }, me.email);
    bump_(me.email);
    auditLog_(me, 'CRM', 'إرسال', 'رسالة', m.id, null, { threadId: t.id, body: body });
    const tv = Object.assign({}, t);
    delete tv._row;
    return ser_({ ok: true, message: m, thread: tv });
  });
}

function crmEditMessage(id, d) {
  const me = requireUser_();
  d = d || {};
  return withLock_(() => {
    const t = table_('MESSAGES');
    const m = t.rows.filter((x) => x.id === id)[0];
    if (!m) throw new Error('الرسالة غير موجودة');
    const own = String(m.fromEmail).toLowerCase() === me.email;
    if (!own && !me.isAdmin) throw new Error('غير مصرح');
    const before = Object.assign({}, m);
    let patch;
    if (d.delete) {
      patch = { deletedAt: new Date(), deletedBy: me.name };
    } else {
      if (!own) throw new Error('تقدر تعدل رسايلك بس');
      if (Date.now() - ms_(m.date) > 15 * 60000) throw new Error('التعديل متاح أول 15 دقيقة بس');
      const body = String(d.body == null ? '' : d.body).trim().slice(0, 4000);
      if (!body) throw new Error('اكتب الرسالة');
      patch = { body: body, editedAt: new Date() };
    }
    t.update(m._row, patch);
    Object.assign(m, patch);
    auditLog_(me, 'CRM', d.delete ? 'حذف' : 'تعديل', 'رسالة', id, before, m);
    return ser_({ ok: true, message: msgView_(m) });
  });
}

/** Admins make group threads; anyone who can see a lead can open (or reuse) that lead's thread. */
function crmSaveThread(t) {
  const me = requireUser_();
  t = t || {};
  const isLeadThread = t.type === 'عميل';
  if (!me.isAdmin && !isLeadThread) throw new Error('للأدمن بس');
  return withLock_(() => {
    const ctx = inboxCtx_();
    let row = t.id ? ctx.threads.rows.filter((x) => x.id === t.id)[0] : null;
    if (!row && isLeadThread && t.leadId) row = ctx.threads.rows.filter((x) => x.type === 'عميل' && x.leadId === t.leadId)[0] || null;
    if (row && !me.isAdmin && !inThread_(me, row, ctx) && !isLeadThread) throw new Error('المحادثة غير موجودة');
    const before = row ? Object.assign({}, row) : null;
    const teamEmails = ctx.team.map((x) => String(x.email).toLowerCase());
    const members = splitList_(t.members).map((x) => x.toLowerCase()).filter((e) => teamEmails.indexOf(e) >= 0);
    if (!row) {
      if (isLeadThread) visibleLead_(me, String(t.leadId || ''));
      row = { id: seqId_('TH', 4), created: new Date(), createdBy: me.email, title: clean_(t.title, 120), type: isLeadThread ? 'عميل' : (['مجموعة', 'مباشرة'].indexOf(t.type) >= 0 ? t.type : 'مجموعة'), members: '', leadId: String(t.leadId || ''), announcementId: '', lastMessageAt: new Date(), status: 'مفتوحة' };
      ctx.threads.append(row);
      row._row = ctx.threads.sheet.getLastRow();
    }
    const patch = {};
    if (t.title !== undefined) patch.title = clean_(t.title, 120);
    const all = [me.email].concat(members, splitList_(row.members).map((x) => x.toLowerCase()));
    patch.members = all.filter((e, i) => e && all.indexOf(e) === i).join(', ');
    if (t.status && ['مفتوحة', 'مقفولة'].indexOf(t.status) >= 0 && me.isAdmin) patch.status = t.status;
    ctx.threads.update(row._row, patch);
    Object.assign(row, patch);
    bumpAll_(splitList_(row.members));
    auditLog_(me, 'CRM', before ? 'تعديل' : 'إنشاء', 'محادثة', row.id, before, row);
    const v = Object.assign({}, row);
    delete v._row;
    return ser_({ ok: true, thread: v });
  });
}

/* =========================================================================
 * 8. Team, settings, templates, access requests
 * ========================================================================= */

/** Public (no sign-in): someone asks to join. Same answer whatever happens, so it can't probe the team list. */
function crmRequestAccess(d) {
  d = d || {};
  const email = String(d.email || '').trim().toLowerCase();
  if (!EMAIL_RE_.test(email)) throw new Error('اكتب إيميل صحيح');
  const cache = CacheService.getScriptCache();
  if (cache.get('access:' + email)) return { ok: true };
  cache.put('access:' + email, '1', 3600);
  if (teamMember_(email)) return { ok: true };
  withLock_(() => {
    const t = table_('ACCESS');
    if (t.rows.some((r) => String(r.email).toLowerCase() === email && r.status === 'جديد')) return;
    const row = { id: seqId_('AR', 4), date: new Date(), email: email, name: clean_(d.name, 100), message: clean_(d.message, 1000), status: 'جديد', handledBy: '', handledAt: '' };
    t.append(row);
    notify_(adminEmails_(), { kind: 'طلب انضمام', title: 'طلب انضمام: ' + (row.name || email), refType: 'طلب', refId: row.id, by: row.name || email });
  });
  return { ok: true };
}

function crmAccessRequests() {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('للأدمن بس');
  return ser_({ items: table_('ACCESS').rows.slice().sort(byDateDesc_('date')) });
}

function crmHandleAccess(id, d) {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('للأدمن بس');
  d = d || {};
  if (['accept', 'reject'].indexOf(d.decision) < 0) throw new Error('اختار قبول أو رفض');
  const r = withLock_(() => {
    const t = table_('ACCESS');
    const row = t.rows.filter((x) => x.id === id)[0];
    if (!row) throw new Error('الطلب غير موجود');
    if (row.status !== 'جديد') throw new Error('الطلب ده اتعامل معاه قبل كده');
    if (d.decision === 'accept') {
      const m = Object.assign({ email: row.email, name: row.name || String(row.email).split('@')[0], role: 'مبيعات', whatsapp: '', active: true }, d.member || {});
      saveTeamMemberCore_(me, m);
    }
    const before = Object.assign({}, row);
    const patch = { status: d.decision === 'accept' ? 'اتقبل' : 'اترفض', handledBy: me.name, handledAt: new Date() };
    t.update(row._row, patch);
    Object.assign(row, patch);
    auditLog_(me, 'CRM', 'تعديل', 'طلب انضمام', id, before, row, clean_(d.reason, 300));
    return row;
  });
  if (d.decision === 'accept') {
    try {
      const brand = setting_('BRAND') || 'Magmafy';
      const url = setting_('CRM_URL');
      MailApp.sendEmail({
        to: r.email, name: brand + ' CRM', subject: 'اتقبل طلبك في ' + brand + ' CRM',
        body: 'أهلاً، اتقبل طلبك. ادخل بإيميلك ده وهيوصلك كود دخول' + (url ? ': ' + url : '.'),
        htmlBody: emailShell_(true, 'أهلاً ' + esc_(r.name || '') + '،<br>اتقبل طلبك في ' + esc_(brand) + ' CRM. ادخل بإيميلك ده وهيوصلك كود دخول.' + (url ? '<br>' + button_(url, 'ادخل الـ CRM') : ''), brand + ' CRM')
      });
    } catch (err) { logError_('access:mail', err, { id: id }); }
  }
  return { ok: true };
}

function crmSaveTeamMember(m) {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('الفريق للأدمن بس');
  return withLock_(() => {
    saveTeamMemberCore_(me, m || {});
    return ser_({ ok: true, team: table_('TEAM').rows.map((r) => ({ name: r.name, email: r.email, role: r.role, whatsapp: r.whatsapp, active: yesv_(r.active) })) });
  });
}

/** Adds or edits a «الفريق» row. Hold the script lock. */
function saveTeamMemberCore_(me, m) {
  const email = String(m.email || '').trim().toLowerCase();
  if (!EMAIL_RE_.test(email)) throw new Error('إيميل غير صحيح');
  if (LISTS['الدور'].indexOf(m.role) < 0) throw new Error('اختار الدور');
  const t = table_('TEAM');
  const row = t.rows.filter((r) => String(r.email).trim().toLowerCase() === email)[0];
  const active = m.active === false || m.active === 'لا' ? 'لا' : 'نعم';
  const admins = t.rows.filter((r) => r.role === ADMIN_ROLE && yesv_(r.active));
  if (row && row.role === ADMIN_ROLE && (active === 'لا' || m.role !== ADMIN_ROLE) && admins.length <= 1) throw new Error('لازم يفضل أدمن واحد نشط على الأقل');
  const whatsapp = normPhone_(m.whatsapp || '').replace(/^\+/, '');
  if (!row) {
    const name = clean_(m.name, 100);
    if (!name) throw new Error('اكتب الاسم');
    if (t.rows.some((r) => r.name === name)) throw new Error('الاسم ده موجود في الفريق');
    const n = { name: name, email: email, role: m.role, whatsapp: whatsapp, active: active };
    t.append(n);
    auditLog_(me, 'CRM', 'إنشاء', 'عضو', email, null, n);
  } else {
    const before = Object.assign({}, row);
    const patch = { role: m.role, whatsapp: whatsapp, active: active };
    t.update(row._row, patch);
    auditLog_(me, 'CRM', 'تعديل', 'عضو', email, before, Object.assign({}, row, patch));
  }
}

function crmSettings() {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('الإعدادات للأدمن بس');
  return ser_(table_('SETTINGS').rows.map((r) => ({ key: r.key, value: str_(r.value), help: r.help })));
}

function crmSaveSettings(v) {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('الإعدادات للأدمن بس');
  v = v || {};
  return withLock_(() => {
    const t = table_('SETTINGS');
    const team = table_('TEAM').rows.map((r) => r.name);
    Object.keys(v).forEach((k) => {
      const row = t.rows.filter((r) => r.key === k)[0];
      if (!row) throw new Error('إعداد غير مسموح: ' + k);
      const val = String(v[k] == null ? '' : v[k]).trim();
      if (/^(STALE_DAYS|TARGET_|CHAT_POLL|MEETING_MINUTES)/.test(k) && val && !(Number(val) >= 0)) throw new Error('القيمة لازم تكون رقم: ' + k);
      if (k === 'CHAT_POLL_SECONDS' && val && Number(val) < 5) throw new Error('أقل قيمة 5 ثواني');
      if (k === 'DEFAULT_OWNER' && val && team.indexOf(val) < 0) throw new Error('المسؤول لازم يكون من الفريق');
      if ((k === 'CRM_URL' || k === 'SITE_URL') && val && !/^https:\/\//.test(val)) throw new Error('الرابط لازم يبدأ بـ https://');
      if (str_(row.value) !== val) {
        auditLog_(me, 'CRM', 'تعديل', 'إعداد', k, { value: str_(row.value) }, { value: val });
        t.update(row._row, { value: val });
        row.value = val;
      }
    });
    SETTINGS_CACHE = null;
    CacheService.getScriptCache().remove('busy');
    return ser_({ ok: true, settings: t.rows.map((r) => ({ key: r.key, value: str_(r.value), help: r.help })) });
  });
}

function crmSaveTemplate(tp) {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('القوالب للأدمن بس');
  tp = tp || {};
  if (['واتساب', 'إيميل'].indexOf(tp.channel) < 0) throw new Error('اختار القناة');
  const name = clean_(tp.name, 120), body = String(tp.body == null ? '' : tp.body).trim().slice(0, 5000);
  if (!name || !body) throw new Error('اكتب الاسم والنص');
  const subject = clean_(tp.subject, 200);
  if (tp.channel === 'إيميل' && !subject) throw new Error('اكتب عنوان الإيميل');
  return withLock_(() => {
    const t = table_('TEMPLATES');
    let row = tp.id ? t.rows.filter((x) => x.id === tp.id)[0] : null;
    const before = row ? Object.assign({}, row) : null;
    const patch = { channel: tp.channel, name: name, stage: clean_(tp.stage, 60), subject: subject, body: body, active: tp.active === false ? 'لا' : 'نعم' };
    if (!row) {
      row = Object.assign({ id: seqId_('TPL', 3) }, patch);
      t.append(row);
    } else {
      t.update(row._row, patch);
      Object.assign(row, patch);
    }
    auditLog_(me, 'CRM', before ? 'تعديل' : 'إنشاء', 'قالب', row.id, before, row);
    return ser_({ ok: true, template: row });
  });
}

/* =========================================================================
 * 9. Leads in bulk, activity feed, audit log
 * ========================================================================= */

function crmBulkUpdateLeads(d) {
  requireUser_();
  d = d || {};
  if (!Array.isArray(d.ids) || !d.ids.length) throw new Error('اختار عملاء');
  if (d.ids.length > 100) throw new Error('أقصى عدد 100 عميل');
  const patch = {};
  ['owner', 'stage', 'priority', 'nextFollowUp', 'lostReason'].forEach((k) => { if (d.patch && k in d.patch) patch[k] = d.patch[k]; });
  if (!Object.keys(patch).length) throw new Error('مفيش تعديل');
  const updated = [], failed = [];
  d.ids.forEach((id) => {
    try {
      const r = crmSaveLead(Object.assign({}, patch, { id: id }));
      if (r && r.ok && r.lead) updated.push(r.lead); else failed.push({ id: id, error: (r && r.error) || 'لم يتم' });
    } catch (err) { failed.push({ id: id, error: String((err && err.message) || err) }); }
  });
  return { ok: true, updated: updated, failed: failed };
}

function crmActivityFeed(q) {
  const me = requireUser_();
  q = q || {};
  const vis = {};
  table_('LEADS').rows.forEach((l) => { if (canSee_(me, l)) vis[l.id] = 1; });
  let items = table_('ACTIVITY').rows.filter((a) => (a.leadId ? vis[a.leadId] : me.isAdmin));
  if (q.kind) items = items.filter((a) => a.kind === q.kind);
  if (q.by) items = items.filter((a) => a.by === q.by);
  items.sort(byDateDesc_('date'));
  return pageOf_(items, q, 'date', 50);
}

function crmAudit(q) {
  const me = requireUser_();
  if (!me.isAdmin) throw new Error('سجل التعديلات للأدمن بس');
  q = q || {};
  let items = table_('AUDIT').rows;
  ['byEmail', 'entity', 'entityId', 'action', 'source'].forEach((k) => { if (q[k]) items = items.filter((a) => String(a[k]) === String(q[k])); });
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.from || '')) { const f = riyadhToUtc_(q.from, '00:00').getTime(); items = items.filter((a) => ms_(a.date) >= f); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.to || '')) { const to = riyadhToUtc_(q.to, '00:00').getTime() + 86400000; items = items.filter((a) => ms_(a.date) < to); }
  items = items.slice().sort(byDateDesc_('date'));
  return pageOf_(items, q, 'date', 100);
}
