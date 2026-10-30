import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBoot } from '../../app/boot';
import { useActions } from '../../app/actions';
import { useI18n } from '../../i18n';
import { useNow } from '../../lib/hooks';
import { DAY, dayKey, todayKey, toDate } from '../../lib/time';
import { fDate, fTime, money, rel } from '../../lib/format';
import { interest, isLate, isStale, leadName } from '../../lib/rules';
import { ACTIVE, PATH } from '../../api/schemas';
import type { Lead } from '../../api/schemas';
import { Avatar, Chip, Empty, HScroll, IconButton, StatBig, Tip } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { LeadCard, DayCard, type DayItem } from '../lead/cards';
import { MeetingBox } from '../lead/LeadView';
import { useLeadOps } from '../lead/mutations';
import { useOpenLead } from '../lead/useOpenLead';
import { useWorldScene } from '../../three/WorldProvider';

type InterestF = 'all' | 'hot' | 'high' | 'medium' | 'low' | 'none';
type DayF = 'all' | 'urgent' | 'today' | 'late' | 'done';

export function Workspace() {
  const { t, v, lang } = useI18n();
  const boot = useBoot();
  const actions = useActions();
  const nav = useNavigate();
  const openLead = useOpenLead();
  const now = useNow(60_000);
  const t0 = todayKey();
  const me = boot.me;
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [titleVisible, setTitleVisible] = useState(true);
  const [leadF, setLeadF] = useState<InterestF>('all');
  const [dayF, setDayF] = useState<DayF>('all');
  const [leadQ, setLeadQ] = useState('');
  const [dayQ, setDayQ] = useState('');
  const [showLeadSearch, setShowLeadSearch] = useState(false);
  const [showDaySearch, setShowDaySearch] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // The volcano sits in the «O» of WORKSPACE; once the title scrolls away it becomes a faint core in the corner.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setTitleVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useWorldScene(titleVisible && slot ? { shape: 'volcano', anchor: slot, anchorFit: 2.3, opacity: 1 } : { shape: 'core', corner: 'end-bottom', scale: 0.45, opacity: 0.12 }, [titleVisible, slot]);

  /* ---------- numbers (FR-11) ---------- */
  const monthStart = t0.slice(0, 8) + '01';
  const prevMonthStart = (() => { const [y, m] = t0.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 10); })();
  const inMonth = (iso: string, from: string, to: string) => { const k = dayKey(iso); return !!k && k >= from && k < to; };
  const open = boot.leads.filter((l) => ACTIVE.includes(l.stage));
  const wonNow = boot.leads.filter((l) => inMonth(l.clientSince, monthStart, '9999')).length;
  const wonPrev = boot.leads.filter((l) => inMonth(l.clientSince, prevMonthStart, monthStart)).length;
  const lostAt = (l: Lead) => (l.stage === 'خسرناه' ? l.updated : '');
  const lostNow = boot.leads.filter((l) => inMonth(lostAt(l), monthStart, '9999')).length;
  const lostPrev = boot.leads.filter((l) => inMonth(lostAt(l), prevMonthStart, monthStart)).length;
  const openPrev = boot.leads.filter((l) => ACTIVE.includes(l.stage) && dayKey(l.created) < monthStart).length;

  /* ---------- New Leads (FR-12) ---------- */
  const fresh = useMemo(() => {
    const s = leadQ.trim().toLowerCase();
    return boot.leads
      .filter((l) => ['جديد', 'تم التواصل'].includes(l.stage) && Date.now() - Date.parse(l.created) < 14 * DAY)
      .filter((l) => leadF === 'all' || interest(l).key === leadF)
      .filter((l) => !s || [l.business, l.name, l.city, l.phone].some((x) => x.toLowerCase().includes(s)))
      .sort((a, b) => ({ 'عالية': 0, 'متوسطة': 1, 'منخفضة': 2 }[a.priority] ?? 3) - ({ 'عالية': 0, 'متوسطة': 1, 'منخفضة': 2 }[b.priority] ?? 3) || Date.parse(b.created) - Date.parse(a.created));
  }, [boot.leads, leadF, leadQ]);
  const freshAll = boot.leads.filter((l) => ['جديد', 'تم التواصل'].includes(l.stage) && Date.now() - Date.parse(l.created) < 14 * DAY);

  /* ---------- Day's tasks (FR-13) ---------- */
  const leadsById = useMemo(() => new Map(boot.leads.map((l) => [l.id, l])), [boot.leads]);
  const dayItems = useMemo<DayItem[]>(() => {
    const meets: DayItem[] = boot.bookings.filter((b) => dayKey(b.start) === t0 && !['ملغي', 'أعيدت جدولته'].includes(b.status)).map((b) => ({ kind: 'meet', b, lead: leadsById.get(b.leadId) }));
    const tasks: DayItem[] = boot.tasks.filter((x) => (x.status === 'مفتوحة' && (dayKey(x.due) === t0 || isLate(x))) || (x.status === 'تمت' && dayKey(x.doneAt) === t0)).map((x) => ({ kind: 'task', t: x, lead: leadsById.get(x.leadId) }));
    const at = (i: DayItem) => Date.parse(i.kind === 'meet' ? i.b.start : i.t.due);
    return [...meets, ...tasks].sort((a, b) => at(a) - at(b));
  }, [boot.bookings, boot.tasks, leadsById, t0]);
  const done = (i: DayItem) => (i.kind === 'meet' ? i.b.status !== 'مؤكد' : i.t.status !== 'مفتوحة');
  const dayFiltered = dayItems.filter((i) => {
    const s = dayQ.trim().toLowerCase();
    if (s && ![i.kind === 'meet' ? i.b.business + i.b.name : i.t.task + i.t.leadName].some((x) => x.toLowerCase().includes(s))) return false;
    if (dayF === 'all') return !done(i);
    if (dayF === 'done') return done(i);
    if (dayF === 'late') return i.kind === 'task' && isLate(i.t);
    if (dayF === 'today') return !done(i) && dayKey(i.kind === 'meet' ? i.b.start : i.t.due) === t0;
    return !done(i) && i.lead?.priority === 'عالية';
  });
  const nextIdx = dayFiltered.findIndex((i) => !done(i) && Date.parse(i.kind === 'meet' ? i.b.start : i.t.due) + (i.kind === 'meet' ? 45 * 60e3 : 0) >= now);
  const hlIdx = nextIdx >= 0 ? nextIdx : dayFiltered.findIndex((i) => !done(i));

  /* ---------- side panel: next meeting + summary (FR-14) ---------- */
  const nextMeet = boot.bookings.filter((b) => b.status === 'مؤكد' && Date.parse(b.start) + 45 * 60e3 > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  const needsOutcome = boot.bookings.filter((b) => b.status === 'مؤكد' && Date.parse(b.start) < now - 3600e3).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  const panelMeet = nextMeet || needsOutcome[0];

  /* ---------- attention (FR-15) ---------- */
  const noReply = boot.leads.filter((l) => !l.firstReply && (l.stage === 'جديد' && l.type !== 'محتمل' || l.stage === 'اجتماع محجوز'));
  const follow = boot.leads.filter((l) => isStale(l, boot.settings.staleDays)).sort((a, b) => Date.parse(a.lastContact || a.created) - Date.parse(b.lastContact || b.created));
  const renew = boot.leads.filter((l) => l.type === 'حالي' && l.renewal && Date.parse(l.renewal) < now + 21 * DAY && Date.parse(l.renewal) > now - DAY);

  const name = me.name.split(' ')[0];
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: 'numeric', hour12: false }).format(new Date(now)));
  const meetsToday = dayItems.filter((i) => i.kind === 'meet' && !done(i)).length;
  const lateCount = boot.tasks.filter(isLate).length;

  return (
    <div>
      <div className="page-head">
        <h1 ref={titleRef} className="page-title display" aria-label={t('مساحة العمل', 'Workspace')}>
          {lang === 'en' ? <>W<span ref={setSlot} className="vslot" aria-hidden="true" />RKSPACE</> : <>مساحة العمل<span ref={setSlot} className="vslot" aria-hidden="true" style={{ marginInlineStart: '.25em' }} /></>}
        </h1>
        <button className="btn btn--primary" onClick={() => actions.newTask()}><span className="btn__plus"><Icon name="plus" /></span>{t('مهمة جديدة', 'New task')}</button>
        <div className="stats-row">
          <StatBig value={open.length} unit={t('صفقة', 'Deals')} delta={open.length - openPrev} deltaLabel={t('عن الشهر اللي فات', 'vs last month')} />
          <StatBig value={wonNow} unit={t('اتكسبت', 'won')} delta={wonNow - wonPrev} deltaLabel={t('عن الشهر اللي فات', 'vs last month')} />
          <StatBig value={lostNow} unit={t('خسرناها', 'lost')} delta={lostNow - lostPrev} invert deltaLabel={t('عن الشهر اللي فات', 'vs last month')} />
        </div>
      </div>
      <p className="muted" style={{ marginTop: -14, marginBottom: 30, fontSize: 15.5 }}>
        {hour < 12 ? t('صباح الخير', 'Good morning') : t('مساء الخير', 'Good evening')}{t('، ', ', ')}{name}. {meetsToday ? <><b style={{ color: 'var(--ink)' }}>{meetsToday}</b>{meetsToday === 1 ? t(' اجتماع النهارده', ' meeting today') : t(' اجتماعات النهارده', ' meetings today')}</> : t('مفيش اجتماعات النهارده', 'No meetings today')}
        {lateCount ? <>{t('، و', ', and ')}<b style={{ color: 'var(--bad)' }}>{lateCount}</b>{t(' مهام متأخرة', ' overdue tasks')}</> : t('، ومفيش مهام متأخرة', ', nothing overdue')}.
      </p>

      <div className="ws-cols">
        <div style={{ minWidth: 0 }}>
          <section className="section" aria-label={t('عملاء جداد', 'New leads')}>
            <HScroll label={t('عملاء جداد', 'New leads')} head={<>
              <h2>{t('عملاء جداد', 'New Leads')}</h2>
              <span className="count"><b>{freshAll.length}</b> {t('عملاء', 'Leads')}</span>
              <IconButton icon="search" label={t('بحث في العملاء الجداد', 'Search new leads')} onClick={() => setShowLeadSearch((x) => !x)} size="sm" />
              <IconButton icon="filter" label={t('كل العملاء', 'All contacts')} onClick={() => nav('/contacts?view=prospects')} size="sm" />
              {showLeadSearch ? <input className="input input--sm" style={{ width: 200 }} autoFocus value={leadQ} onChange={(e) => setLeadQ(e.target.value)} placeholder={t('اسم، مدينة، جوال', 'Name, city, phone')} /> : null}
              <div className="chips">
                {([['all', t('الكل', 'All')], ['hot', t('🔥 ساخن', '🔥 Hot')], ['high', t('اهتمام عالي', 'High interest')], ['medium', t('اهتمام متوسط', 'Medium interest')], ['low', t('اهتمام ضعيف', 'Low interest')], ['none', t('بدون تقييم', 'Not rated')]] as [InterestF, string][]).map(([k, l]) => <Chip key={k} on={leadF === k} onClick={() => setLeadF(k)}>{l}</Chip>)}
              </div>
            </>}>
              {fresh.length ? fresh.map((l) => <div role="listitem" key={l.id}><LeadCard lead={l} /></div>) : <div role="listitem" style={{ gridColumn: '1 / -1' }}><div className="card"><Empty title={t('مفيش عملاء جداد بالفلتر ده', 'No new leads for this filter')} action={<button className="btn btn--primary" onClick={actions.newLead}><span className="btn__plus"><Icon name="plus" /></span>{t('عميل جديد', 'New client')}</button>} /></div></div>}
            </HScroll>
          </section>

          <section className="section" aria-label={t('مهام يومك', 'Your day')}>
            <HScroll wide label={t('مهام يومك', 'Your day')} head={<>
              <h2>{t('مهام يومك', 'Your Day’s Tasks')}</h2>
              <span className="count"><b>{dayItems.filter((i) => !done(i)).length}</b> {t('مهام', 'Tasks')}</span>
              <IconButton icon="search" label={t('بحث في مهام اليوم', 'Search today')} onClick={() => setShowDaySearch((x) => !x)} size="sm" />
              <IconButton icon="filter" label={t('كل المهام', 'All tasks')} onClick={() => nav('/tasks')} size="sm" />
              {showDaySearch ? <input className="input input--sm" style={{ width: 200 }} autoFocus value={dayQ} onChange={(e) => setDayQ(e.target.value)} placeholder={t('مهمة أو عميل', 'Task or client')} /> : null}
              <div className="chips">
                {([['all', t('الكل', 'All')], ['urgent', t('🔥 مستعجل', '🔥 Hot')], ['today', t('مستحقة النهارده', 'Due today')], ['late', t('متأخرة', 'Overdue')], ['done', t('خلصت', 'Completed')]] as [DayF, string][]).map(([k, l]) => <Chip key={k} on={dayF === k} onClick={() => setDayF(k)}>{l}</Chip>)}
              </div>
            </>}>
              {dayFiltered.length ? dayFiltered.map((i, k) => <div role="listitem" key={i.kind === 'meet' ? i.b.id : i.t.id} className={done(i) && dayF !== 'done' ? 'is-striking' : ''}><DayCard item={i} highlight={k === hlIdx} /></div>)
                : <div role="listitem" style={{ gridColumn: '1 / -1' }}><div className="card"><Empty title={dayF === 'done' ? t('لسه ماخلصتش حاجة النهارده', 'Nothing completed yet today') : t('يومك فاضي', 'Your day is clear')} action={<button className="btn" onClick={() => actions.book()}><Icon name="calendar" />{t('احجز اجتماع', 'Book a meeting')}</button>}>{dayF === 'done' ? null : t('مفيش اجتماعات ولا مهام مستحقة.', 'No meetings or tasks due.')}</Empty></div></div>}
            </HScroll>
          </section>

          <section className="section attn" aria-label={t('محتاج انتباهك', 'Needs your attention')}>
            <div className="sec-head"><h2>{t('محتاج انتباهك', 'Needs your attention')}</h2></div>
            <AttentionList noReply={noReply} needsOutcome={needsOutcome} follow={follow} renew={renew} />
          </section>

          <section className="section">
            <div className="sec-head"><h2>{t('المسار دلوقتي', 'Pipeline now')}</h2><button className="btn btn--sm btn--ghost" onClick={() => nav('/sales-tools/pipeline')}>{t('افتح المسار', 'Open pipeline')}<Icon name="arrow" /></button></div>
            <div className="heat" role="list">
              {PATH.map((s, i) => {
                const list = boot.leads.filter((l) => l.stage === s && !(l.type === 'محتمل' && s === 'جديد'));
                const val = list.reduce((a, l) => a + ((i === 7 ? l.mrr : l.dealValue) || 0), 0);
                return (
                  <Tip key={s} label={v(s) + ': ' + list.length + (val ? ' · ' + money(val) + (i === 7 ? t(' ر.س شهريًا', ' SAR/mo') : t(' ر.س', ' SAR')) : '')}>
                    <button role="listitem" style={{ background: `var(--heat-${i})`, color: i >= 3 ? '#fff' : 'var(--ink)' }} onClick={() => nav('/contacts?stage=' + encodeURIComponent(s))}>
                      <span>{v(s)}</span><b>{list.length}</b><small>{val ? money(val) : ' '}</small>
                    </button>
                  </Tip>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="side-panel" aria-label={t('الاجتماع والملخص', 'Meeting and summary')}>
          {panelMeet ? <MeetPanel bookingId={panelMeet.id} isNext={panelMeet === nextMeet} now={now} /> : (
            <div className="card"><Empty title={t('مفيش اجتماعات جاية', 'No upcoming meetings')} action={<button className="btn btn--hl" onClick={() => actions.book()}><Icon name="calendar" />{t('احجز اجتماع', 'Book a meeting')}</button>} /></div>
          )}
        </aside>
      </div>
    </div>
  );

  function AttentionList({ noReply, needsOutcome, follow, renew }: { noReply: Lead[]; needsOutcome: typeof boot.bookings; follow: Lead[]; renew: Lead[] }) {
    const rows: JSX.Element[] = [];
    const head = (k: string, l: string, n: number) => rows.push(<div key={k} className="subhead">{l} · <span className="num">{n}</span></div>);
    const row = (key: string, l: Lead | undefined, title: string, sub: string, end: string, late: boolean, action: JSX.Element) => rows.push(
      <div key={key} className="item" role="button" tabIndex={0} onClick={() => l && openLead(l.id)} onKeyDown={(e) => e.key === 'Enter' && l && openLead(l.id)}>
        <Avatar name={title} size="sm" />
        <div className="t"><b>{title}</b><small>{sub}</small></div>
        <span className={'end' + (late ? ' late' : '')}>{end}</span>
        <span onClick={(e) => e.stopPropagation()}>{action}</span>
      </div>);
    if (noReply.length) { head('h1', t('عملاء جداد لسه مارديناش عليهم', 'New leads with no reply yet'), noReply.length); noReply.slice(0, 5).forEach((l) => row('n' + l.id, l, leadName(l), [l.name, v(l.source)].filter(Boolean).join(' · '), rel(l.created, lang), true, <button className="btn btn--sm btn--hl" disabled={!l.phone} onClick={() => actions.compose(l, 'واتساب')}><Icon name="wa" />{t('رحّب بيه', 'Welcome')}</button>)); }
    if (needsOutcome.length) { head('h2', t('اجتماعات محتاجة نتيجة', 'Meetings without an outcome'), needsOutcome.length); needsOutcome.slice(0, 5).forEach((b) => { const l = leadsById.get(b.leadId); row('o' + b.id, l, b.business || b.name, b.meetingType, fDate(b.start, lang), true, <button className="btn btn--sm" onClick={() => openLead(b.leadId, 'log')}><Icon name="note" />{t('سجّل النتيجة', 'Log outcome')}</button>); }); }
    if (follow.length) { head('h3', t('محتاجين متابعة', 'Need a follow-up'), follow.length); follow.slice(0, 5).forEach((l) => row('f' + l.id, l, leadName(l), v(l.stage), l.lastContact ? t('آخر تواصل ', 'Last contact ') + rel(l.lastContact, lang) : t('ماتواصلناش', 'Not contacted'), true,
      l.stage === 'عرض مرسل' ? <button className="btn btn--sm" disabled={!l.phone} onClick={() => actions.compose(l, 'واتساب')}><Icon name="wa" />{t('تابع العرض', 'Follow up')}</button> : <button className="btn btn--sm" onClick={() => actions.logActivity(l)}><Icon name="note" />{t('سجّل تواصل', 'Log contact')}</button>)); }
    if (renew.length) { head('h4', t('تجديدات قريبة', 'Upcoming renewals'), renew.length); renew.forEach((l) => row('r' + l.id, l, leadName(l), money(l.mrr) + t(' ر.س شهريًا', ' SAR/mo'), fDate(l.renewal, lang), false, <button className="btn btn--sm" disabled={!l.phone} onClick={() => actions.compose(l, 'واتساب')}><Icon name="wa" />{t('كلّمه', 'Reach out')}</button>)); }
    return <div className="list">{rows.length ? rows : <Empty title={t('كله تمام', 'All clear')}>{t('مفيش متابعات متأخرة ولا اجتماعات من غير نتيجة.', 'No overdue follow-ups and no meetings without an outcome.')}</Empty>}</div>;
  }
}

function MeetPanel({ bookingId, isNext, now }: { bookingId: string; isNext: boolean; now: number }) {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const actions = useActions();
  const openLead = useOpenLead();
  const ops = useLeadOps();
  const b = boot.bookings.find((x) => x.id === bookingId)!;
  const lead = boot.leads.find((l) => l.id === b.leadId);
  const mins = Math.round((Date.parse(b.start) - now) / 60000);
  const countdown = mins > 0 ? (mins < 60 ? mins + t(' دقيقة', ' min') : mins < 1440 ? Math.floor(mins / 60) + t(' س ', 'h ') + (mins % 60) + t(' د', 'm') : rel(b.start, lang)) : mins > -45 ? t('شغال دلوقتي', 'Live now') : t('عدّى', 'Passed');
  const lastEmail = undefined as undefined | { title: string };
  return (
    <>
      <div className="meet-card">
        <div className="row"><span className="tag" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>{isNext ? t('الاجتماع الجاي', 'Next meeting') : t('محتاج نتيجة', 'Needs an outcome')}</span><span className="grow" /><IconButton icon="arrow" label={t('افتح العميل', 'Open client')} onClick={() => openLead(b.leadId, 'log')} /></div>
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={b.business || b.name} size="xl" />
          <div style={{ minWidth: 0 }}>
            <div className="meet-card__count">{countdown}</div>
            <div style={{ fontSize: 15, fontWeight: 500 }} className="ellipsis">{b.business || b.name}</div>
            <div style={{ fontSize: 12.5, opacity: 0.85 }}>{fTime(b.start, lang)} · {b.platform} · {b.meetingType}</div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
          {b.meetLink ? <a className="ibtn" href={b.meetLink} target="_blank" rel="noopener noreferrer" aria-label={t('ادخل الاجتماع', 'Join')}><Icon name="video" /></a> : null}
          {lead?.phone ? <a className="ibtn" href={'tel:' + lead.phone} aria-label={t('اتصل', 'Call')}><Icon name="phone" /></a> : null}
          {lead?.phone ? <IconButton icon="wa" label={t('واتساب', 'WhatsApp')} onClick={() => actions.compose(lead, 'واتساب')} /> : null}
          {lead?.email ? <IconButton icon="mail" label={t('إيميل', 'Email')} onClick={() => actions.compose(lead, 'إيميل')} /> : null}
          <IconButton icon="close" variant="bad" label={t('لم يحضر', 'No-show')} onClick={() => ops.updateBooking(b.id, b.leadId, { status: 'لم يحضر' })} />
        </div>
      </div>
      <div className="summary">
        <div className="summary__head"><span className="ibtn ibtn--solid ibtn--sm" aria-hidden="true"><Icon name="sparkle" /></span><h3>{t('الملخص', 'Summary')}</h3></div>
        <div className="tl">
          <div className="tl__item">
            <span className="tl__time">{fTime(b.start, lang).replace(/\s?[صمAPM]+$/i, '')}</span>
            <div className="tl__box">
              <h4>{t('المستندات', 'Documents')}</h4>
              <div className="docs">
                {lead?.link ? <a className="doc" href={/^https?:/.test(lead.link) ? lead.link : 'https://' + lead.link} target="_blank" rel="noopener noreferrer"><span className="doc__paper">{[0, 1, 2, 3, 4, 5].map((k) => <i key={k} />)}</span><span>{t('رابط العميل', 'Client link')}</span></a> : null}
                {lead?.readiness != null ? <button className="doc" style={{ background: 'none', border: 0 }} onClick={() => openLead(b.leadId, 'scope')}><span className="doc__paper">{[0, 1, 2, 3, 4, 5].map((k) => <i key={k} />)}</span><span>{t('الجاهزية ', 'Readiness ')}{lead.readiness}</span></button> : null}
                <button className="doc" style={{ background: 'none', border: 0 }} onClick={() => openLead(b.leadId, 'docs')}><span className="doc__paper">{[0, 1, 2, 3, 4, 5].map((k) => <i key={k} />)}</span><span>{lastEmail ? lastEmail.title : t('كل المستندات', 'All documents')}</span></button>
              </div>
            </div>
          </div>
          {b.clientNotes ? <div className="tl__item"><span className="tl__time">✎</span><div className="tl__box"><h4>{t('العميل كتب', 'Client wrote')}</h4><p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)' }}>{b.clientNotes}</p></div></div> : null}
          <div className="tl__item">
            <span className="tl__time">★</span>
            <div className="tl__box tl__box--hl">
              <h4><Icon name="edit" size={15} />{t('الهدف (نتيجة الاجتماع)', 'Goal (meeting outcome)')}</h4>
              <MeetingBox b={b} statuses={boot.lists['حالة الاجتماع']} onStatus={(s) => ops.updateBooking(b.id, b.leadId, { status: s })} onOutcome={(o) => ops.updateBooking(b.id, b.leadId, { outcome: o })} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
void toDate;
