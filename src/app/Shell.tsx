import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useBootstrap, usePulse } from '../api/queries';
import { BootCtx } from './boot';
import { ActionsProvider, useActions } from './actions';
import { useI18n } from '../i18n';
import { useTheme } from './theme';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { Avatar, IconButton, Tip, Skel } from '../components/ui';
import { ScheduleBar } from '../components/ScheduleBar';
import { NotificationsBell } from '../components/NotificationsPanel';
import { CommandPalette } from '../components/CommandPalette';
import { AnnouncementBanner, UrgentModal } from '../components/Announcements';
import { errorText } from '../api/errors';
import { LostReasonProvider } from '../features/lead/mutations';
import { isLate } from '../lib/rules';
import { useOnline } from '../lib/hooks';
import type { Bootstrap } from '../api/schemas';
import { api } from '../api/endpoints';
import { refreshDevice } from '../lib/push';

const LeadDrawer = lazy(() => import('../features/lead/LeadView').then((m) => ({ default: m.LeadDrawer })));

export function Shell() {
  const { t, lang } = useI18n();
  const boot = useBootstrap();
  if (boot.isLoading || (!boot.data && !boot.isError)) return <BootSkeleton />;
  if (!boot.data) {
    return (
      <div className="auth" style={{ gridTemplateColumns: '1fr' }}>
        <div className="auth__box" style={{ maxWidth: 480 }}>
          <h1 className="display">{t('الـ CRM مافتحش', 'The CRM didn’t load')}</h1>
          <p>{errorText(boot.error, lang)}</p>
          <button className="btn btn--primary btn--plain" onClick={() => boot.refetch()}>{t('حمّل تاني', 'Reload')}</button>
        </div>
      </div>
    );
  }
  return (
    <BootCtx.Provider value={boot.data}>
      <LostReasonProvider reasons={boot.data.lists['سبب الخسارة'] || []}>
        <ActionsProvider>
          <ShellFrame boot={boot.data} refreshing={boot.isFetching} onRefresh={() => boot.refetch()} />
        </ActionsProvider>
      </LostReasonProvider>
    </BootCtx.Provider>
  );
}

function ShellFrame({ boot, refreshing, onRefresh }: { boot: Bootstrap; refreshing: boolean; onRefresh: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, pref, setPref } = useTheme();
  const { signOut, authed } = useAuth();
  const actions = useActions();
  const nav = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const pulse = usePulse(authed);
  const online = useOnline();
  // A new version of the site is downloaded and waiting (see main.tsx).
  const [update, setUpdate] = useState(false);
  // Keep this device's push subscription known to the server (once a day).
  const pushKey = boot.settings.pushKey;
  useEffect(() => { if (pushKey) void refreshDevice(api, pushKey); }, [pushKey]);
  useEffect(() => { const on = () => setUpdate(true); window.addEventListener('mg-update', on); return () => window.removeEventListener('mg-update', on); }, []);
  const [cmdk, setCmdk] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const me = boot.me;
  const lateTasks = boot.tasks.filter(isLate).length;
  const unreadMsgs = pulse.data?.unread.messages ?? boot.inbox?.unread ?? 0;
  const unreadAnns = pulse.data?.unread.announcements ?? boot.announcements.filter((a) => !a.seenAt).length;
  const unreadNotifs = pulse.data?.unread.notifications ?? 0;
  const leadId = params.get('lead');

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 6);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  // Keyboard shortcuts: Ctrl/⌘+K, «/», N, T, M.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdk(true); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') { e.preventDefault(); setCmdk(true); }
      else if (e.key === 'n' || e.key === 'ى') { e.preventDefault(); actions.newLead(); }
      else if (e.key === 't' || e.key === 'ف') { e.preventDefault(); actions.newTask(); }
      else if (e.key === 'm' || e.key === 'ة') { e.preventDefault(); actions.newThread(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [actions]);

  const NAV: [string, string, string, number?][] = [
    ['/', 'grid', t('مساحة العمل', 'Workspace')],
    ['/contacts', 'contacts', t('جهات الاتصال', 'Contacts')],
    ['/companies', 'building', t('الشركات', 'Companies')],
    ['/tasks', 'tasks', t('المهام', 'Tasks'), lateTasks],
    ['/sales-tools', 'tools', t('أدوات البيع', 'Sales tools')],
    ['/inbox', 'inbox', t('المحادثات', 'Inbox'), unreadMsgs],
    ['/announcements', 'megaphone', t('الإعلانات', 'Announcements'), unreadAnns]
  ];
  const active = (p: string) => (p === '/' ? loc.pathname === '/' : loc.pathname.startsWith(p));

  return (
    <>
      <div className="shell">
        <div className="shell__logo"><NavLink to="/" className="logo-btn" aria-label="Magmafy CRM"><Logo size={40} /></NavLink></div>
        <header className={'shell__hdr' + (scrolled ? ' is-scrolled' : '')}>
          <NavLink to="/" className="logo-btn show-sm" aria-label="Magmafy CRM"><Logo size={36} /></NavLink>
          <ScheduleBar boot={boot} />
          <IconButton icon="search" label={t('بحث (Ctrl+K)', 'Search (Ctrl+K)')} onClick={() => setCmdk(true)} className="hide-sm" />
          <NotificationsBell unread={unreadNotifs} />
          <Menu.Root>
            <Menu.Trigger asChild>
              <button className="ibtn" aria-label={t('قايمة الحساب', 'Account menu')} style={{ border: 0, padding: 0 }}><Avatar name={me.name} /></button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className="menu" align="end" sideOffset={8}>
                <div style={{ padding: '10px 12px 8px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Avatar name={me.name} size="sm" />
                  <div style={{ minWidth: 0 }}><b style={{ display: 'block', fontWeight: 500 }}>{me.name}</b><small className="faint ltr">{me.email}</small></div>
                </div>
                <Menu.Separator className="menu__sep" />
                <Menu.Item className="menu__item" onSelect={() => nav('/profile')}><Icon name="user" />{t('حسابي', 'Profile')}</Menu.Item>
                <Menu.Item className="menu__item" onSelect={() => nav('/settings')}><Icon name="settings" />{t('الإعدادات', 'Settings')}</Menu.Item>
                <Menu.Item className="menu__item" onSelect={onRefresh}><Icon name="refresh" />{refreshing ? t('بيتحدّث…', 'Refreshing…') : t('تحديث البيانات', 'Refresh data')}</Menu.Item>
                <Menu.Separator className="menu__sep" />
                <div className="menu__label">{t('المظهر', 'Appearance')}</div>
                {([['dark', 'moon', t('غامق', 'Dark')], ['light', 'sun', t('فاتح', 'Light')], ['auto', 'monitor', t('حسب الجهاز', 'System')]] as const).map(([k, ic, l]) => (
                  <Menu.Item key={k} className="menu__item" onSelect={() => setPref(k)}><Icon name={ic} />{l}{pref === k ? <Icon name="check" className="faint" /> : null}</Menu.Item>
                ))}
                <Menu.Item className="menu__item" onSelect={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" />{lang === 'ar' ? 'English' : 'العربية'}</Menu.Item>
                {boot.settings.sheetUrl ? <Menu.Item className="menu__item" onSelect={() => window.open(boot.settings.sheetUrl, '_blank', 'noopener')}><Icon name="template" />{t('افتح الشيت', 'Open the sheet')}</Menu.Item> : null}
                <Menu.Separator className="menu__sep" />
                <Menu.Item className="menu__item" onSelect={() => signOut()}><Icon name="logout" />{t('خروج', 'Sign out')}</Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </header>

        <nav className="shell__rail" aria-label={t('القائمة الرئيسية', 'Main menu')}>
          <IconButton icon="back" label={t('رجوع', 'Back')} flip onClick={() => nav(-1)} />
          <div className="rail__sep" />
          {NAV.map(([p, ic, label, n]) => (
            <div className="rail__item" key={p}>
              <Tip label={label} side={document.documentElement.dir === 'rtl' ? 'left' : 'right'}>
                <NavLink to={p} end={p === '/'} className="ibtn" aria-label={label} aria-current={active(p) ? 'page' : undefined}>
                  <Icon name={ic} />{n ? <span className={'cnt' + (p === '/tasks' ? ' cnt--bad' : '')}>{n > 9 ? '9+' : n}</span> : null}
                </NavLink>
              </Tip>
            </div>
          ))}
          <div className="rail__foot">
            <IconButton icon="plus" variant="hl" label={t('عميل جديد (N)', 'New client (N)')} onClick={actions.newLead} />
            <Tip label={t('الإعدادات', 'Settings')} side={document.documentElement.dir === 'rtl' ? 'left' : 'right'}>
              <NavLink to="/settings" className="ibtn" aria-label={t('الإعدادات', 'Settings')} aria-current={active('/settings') ? 'page' : undefined}><Icon name="settings" /></NavLink>
            </Tip>
            <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? t('الوضع الفاتح', 'Light mode') : t('الوضع الغامق', 'Dark mode')} onClick={() => setPref(theme === 'dark' ? 'light' : 'dark')} />
          </div>
        </nav>

        <div className="shell__banner">
          {!online ? <div className="banner banner--عاجل" role="alert"><span className="pulse-dot" />{t('مفيش نت دلوقتي. البيانات اللي قدامك للقراية بس لحد ما النت يرجع.', 'You’re offline. What you see is read-only until you’re back online.')}</div> : null}
          {update ? (
            <div className="banner" role="status"><Icon name="sparkle" size={16} /><span className="grow">{t('فيه نسخة جديدة من الموقع.', 'A new version is available.')}</span>
              <button className="btn btn--sm btn--primary btn--plain" onClick={() => { navigator.serviceWorker?.getRegistration().then((r) => (r?.waiting ? r.waiting.postMessage('skip') : location.reload())); }}>{t('حدّث', 'Update')}</button></div>
          ) : null}
          <AnnouncementBanner boot={boot} />
        </div>

        <main className="shell__main" id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="bnav" aria-label={t('التنقل', 'Navigation')}>
        {([['/', 'grid', t('مساحة العمل', 'Workspace')], ['/contacts', 'contacts', t('جهات الاتصال', 'Contacts')], ['/schedule', 'calendar', t('جدولك', 'Schedule')], ['/inbox', 'inbox', t('المحادثات', 'Inbox')], ['/more', 'more', t('المزيد', 'More')]] as const).map(([p, ic, l]) => (
          <NavLink key={p} to={p} end={p === '/'} className="ibtn" aria-label={l} aria-current={active(p) ? 'page' : undefined}>
            <Icon name={ic} />{p === '/inbox' && unreadMsgs ? <span className="cnt">{unreadMsgs}</span> : null}
          </NavLink>
        ))}
      </nav>

      <Suspense fallback={null}>{leadId ? <LeadDrawer id={leadId} onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('lead'); n.delete('ltab'); return n; })} /> : null}</Suspense>
      <CommandPalette boot={boot} open={cmdk} onOpenChange={setCmdk} onAction={(a) => (a === 'lead' ? actions.newLead() : a === 'task' ? actions.newTask() : a === 'message' ? actions.newThread() : actions.editAnnouncement())} />
      <UrgentModal pulse={pulse.data} boot={boot} />
    </>
  );
}

function BootSkeleton() {
  return (
    <div className="shell">
      <div className="shell__logo"><Logo /></div>
      <header className="shell__hdr"><Skel h={56} w="100%" r={999} /></header>
      <nav className="shell__rail">{[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={44} w={44} r={999} />)}</nav>
      <main className="shell__main" aria-busy="true">
        <div className="stack" style={{ gap: 22 }}>
          <Skel h={64} w="46%" r={20} />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>{[0, 1, 2, 3].map((i) => <Skel key={i} h={180} />)}</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>{[0, 1, 2].map((i) => <Skel key={i} h={230} />)}</div>
        </div>
      </main>
    </div>
  );
}
