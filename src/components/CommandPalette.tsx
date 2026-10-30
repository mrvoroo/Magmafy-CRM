import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '../i18n';
import { useTheme } from '../app/theme';
import type { Bootstrap } from '../api/schemas';
import { digits } from '../lib/format';
import { Icon } from './Icon';
import { useOpenLead } from '../features/lead/useOpenLead';

type Cmd = { id: string; group: string; label: string; sub?: string; icon: string; run: () => void; keys?: string };

/** Ctrl/⌘+K: jump to any client or page, or run an action (FR-06). */
export function CommandPalette({ boot, open, onOpenChange, onAction }: { boot: Bootstrap; open: boolean; onOpenChange: (o: boolean) => void; onAction: (a: 'lead' | 'task' | 'message' | 'announcement') => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setPref } = useTheme();
  const nav = useNavigate();
  const openLead = useOpenLead();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setQ(''); setSel(0); } }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const go = (path: string) => () => nav(path);
    const pages: Cmd[] = [
      ['/', 'grid', t('مساحة العمل', 'Workspace')], ['/schedule', 'calendar', t('جدولك', 'Your schedule')], ['/contacts', 'contacts', t('جهات الاتصال', 'Contacts')],
      ['/companies', 'building', t('الشركات', 'Companies')], ['/tasks', 'tasks', t('المهام', 'Tasks')], ['/sales-tools/pipeline', 'board', t('المسار', 'Pipeline')],
      ['/sales-tools/reports', 'chart', t('التقارير', 'Reports')], ['/sales-tools/templates', 'template', t('القوالب', 'Templates')], ['/sales-tools/activity', 'activity', t('النشاط', 'Activity')],
      ['/inbox', 'inbox', t('المحادثات', 'Inbox')], ['/announcements', 'megaphone', t('الإعلانات', 'Announcements')], ['/settings', 'settings', t('الإعدادات', 'Settings')], ['/profile', 'user', t('حسابي', 'Profile')]
    ].map(([p, ic, l]) => ({ id: 'p' + p, group: t('الصفحات', 'Pages'), label: l, icon: ic, run: go(p) }));
    const actions: Cmd[] = [
      { id: 'a-lead', group: t('إجراءات', 'Actions'), label: t('عميل جديد', 'New client'), icon: 'plus', keys: 'N', run: () => onAction('lead') },
      { id: 'a-task', group: t('إجراءات', 'Actions'), label: t('مهمة جديدة', 'New task'), icon: 'tasks', keys: 'T', run: () => onAction('task') },
      { id: 'a-msg', group: t('إجراءات', 'Actions'), label: boot.me.isAdmin ? t('رسالة جديدة', 'New message') : t('رسالة للإدارة', 'Message the admins'), icon: 'inbox', keys: 'M', run: () => onAction('message') },
      ...(boot.me.isAdmin ? [{ id: 'a-ann', group: t('إجراءات', 'Actions'), label: t('إعلان جديد', 'New announcement'), icon: 'megaphone', run: () => onAction('announcement') }] : []),
      { id: 'a-theme', group: t('إجراءات', 'Actions'), label: theme === 'dark' ? t('الوضع الفاتح', 'Light mode') : t('الوضع الغامق', 'Dark mode'), icon: theme === 'dark' ? 'sun' : 'moon', run: () => setPref(theme === 'dark' ? 'light' : 'dark') },
      { id: 'a-lang', group: t('إجراءات', 'Actions'), label: lang === 'ar' ? 'English' : 'العربية', icon: 'globe', run: () => setLang(lang === 'ar' ? 'en' : 'ar') }
    ];
    return [...actions, ...pages];
  }, [boot.me.isAdmin, lang, nav, onAction, setLang, setPref, t, theme]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const d = digits(s);
    const leads: Cmd[] = s ? boot.leads.filter((l) => [l.business, l.name, l.email, l.city, l.id].some((x) => x.toLowerCase().includes(s)) || (d.length > 3 && digits(l.phone).includes(d)))
      .slice(0, 8).map((l) => ({ id: 'l' + l.id, group: t('العملاء', 'Clients'), label: l.business || l.name, sub: [l.name, l.city].filter(Boolean).join(' · '), icon: 'contacts', run: () => openLead(l.id) })) : [];
    const other = cmds.filter((c) => !s || c.label.toLowerCase().includes(s));
    return [...leads, ...other];
  }, [q, boot.leads, cmds, openLead, t]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const run = (c: Cmd | undefined) => { if (!c) return; onOpenChange(false); setTimeout(c.run, 0); };

  let lastGroup = '';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="cmdk" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{t('بحث وأوامر', 'Search and commands')}</Dialog.Title>
          <input className="cmdk__in" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('دور على عميل أو صفحة أو أمر…', 'Search clients, pages or actions…')}
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={results[sel] ? 'cmd-' + results[sel].id : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(results.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
            }} />
          <div className="cmdk__list" id="cmdk-list" role="listbox" ref={listRef}>
            {results.length === 0 ? <div className="empty">{t('مفيش نتايج', 'No results')}</div> : results.map((c, i) => {
              const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
              return (
                <div key={c.id}>
                  {head ? <div className="cmdk__grp">{head}</div> : null}
                  <div id={'cmd-' + c.id} className="cmdk__item" role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
                    <Icon name={c.icon} /><span>{c.label}{c.sub ? <span className="faint" style={{ fontSize: 12.5 }}> · {c.sub}</span> : null}</span>
                    {c.keys ? <small><kbd>{c.keys}</kbd></small> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
