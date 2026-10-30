import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Bootstrap } from '../api/schemas';
import { useI18n } from '../i18n';
import { useIsMobile, useNow } from '../lib/hooks';
import { dayKey, todayKey, minutesOfDay } from '../lib/time';
import { fDate, fTime } from '../lib/format';
import { leadName } from '../lib/rules';
import { Avatar, IconButton, Tip } from './ui';
import { Icon } from './Icon';
import { useOpenLead } from '../features/lead/useOpenLead';

const START = 9 * 60, END = 19 * 60; // the bar covers 9 am – 7 pm Riyadh

/** «Your Schedule»: today's meetings and tasks on a time axis, with a moving «now» marker. */
export function ScheduleBar({ boot }: { boot: Bootstrap }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const openLead = useOpenLead();
  const now = useNow(60_000);
  const t0 = todayKey();
  const events = useMemo(() => {
    const leads = new Map(boot.leads.map((l) => [l.id, l]));
    const meets = boot.bookings.filter((b) => dayKey(b.start) === t0 && !['ملغي', 'أعيدت جدولته'].includes(b.status))
      .map((b) => ({ id: b.id, at: b.start, leadId: b.leadId, label: b.business || b.name, kind: 'meet' as const, names: [b.name] }));
    const tasks = boot.tasks.filter((x) => x.status === 'مفتوحة' && dayKey(x.due) === t0)
      .map((x) => ({ id: x.id, at: x.due, leadId: x.leadId, label: x.task, kind: 'task' as const, names: [leadName(leads.get(x.leadId)) || x.owner] }));
    return [...meets, ...tasks].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }, [boot, t0]);

  const pos = (iso: string) => Math.max(2, Math.min(98, ((minutesOfDay(new Date(iso)) - START) / (END - START)) * 100));
  const nowM = minutesOfDay(new Date(now));
  const nowPct = Math.max(0, Math.min(100, ((nowM - START) / (END - START)) * 100));
  const hours = [9, 11, 13, 15, 17, 19];
  const mobile = useIsMobile();

  if (mobile) {
    // Phones: just what's next today (FR-10).
    const next = events.find((e) => Date.parse(e.at) + 30 * 60e3 >= now) || null;
    return (
      <div className="sched" role="region" aria-label={t('جدولك النهارده', 'Your schedule today')} style={{ paddingInlineStart: 16 }}>
        {next ? (
          <button type="button" className="row grow" style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => (next.leadId ? openLead(next.leadId) : nav('/tasks'))}>
            <span className="num" style={{ fontWeight: 600 }}>{fTime(next.at, lang)}</span>
            <span className="ellipsis" style={{ fontSize: 13 }}>{next.label}</span>
          </button>
        ) : <span className="grow" style={{ fontSize: 13 }}>{t('يومك فاضي', 'Your day is clear')}</span>}
        <IconButton icon="arrow" size="sm" label={t('افتح جدولك', 'Open your schedule')} onClick={() => nav('/schedule')} />
      </div>
    );
  }

  return (
    <div className="sched" role="region" aria-label={t('جدولك النهارده', 'Your schedule today')}>
      <span className="sched__title">{t('جدولك', 'Your Schedule')}</span>
      <span className="sched__date"><i><Icon name="calendar" /></i>{fDate(new Date(now), lang)}</span>
      <div className="sched__track">
        <div className="sched__past" style={{ width: nowPct + '%' }} />
        <div className="sched__hours" aria-hidden="true">{hours.map((h) => <span key={h}>{fTime(new Date(Date.UTC(2020, 0, 1, h - 3)), lang).replace(':00', '')}</span>)}</div>
        {events.length === 0 ? <div className="sched__empty" style={{ position: 'relative', zIndex: 2, lineHeight: '44px' }}>{t('يومك فاضي', 'Your day is clear')}</div> : null}
        {events.map((e) => (
          <Tip key={e.id} label={fTime(e.at, lang) + ' · ' + e.label}>
            <button type="button" className={'sched__ev' + (Date.parse(e.at) < now ? ' is-past' : '')} style={{ insetInlineStart: pos(e.at) + '%' }}
              onClick={() => (e.leadId ? openLead(e.leadId) : nav('/tasks'))} aria-label={fTime(e.at, lang) + ' ' + e.label}>
              {e.kind === 'meet' ? <Avatar name={e.names[0]} size="xs" /> : <span className="av av--xs"><Icon name="tasks" size={12} /></span>}
              <span className="num">{fTime(e.at, lang)}</span>
            </button>
          </Tip>
        ))}
        {nowPct > 0 && nowPct < 100 ? <>
          <div className="sched__now" style={{ insetInlineStart: nowPct + '%' }} aria-hidden="true" />
          <span className="sched__nowlbl" style={{ insetInlineStart: nowPct + '%' }}>{fTime(new Date(now), lang)}</span>
        </> : null}
      </div>
      <IconButton icon="arrow" label={t('افتح جدولك', 'Open your schedule')} onClick={() => nav('/schedule')} />
    </div>
  );
}
