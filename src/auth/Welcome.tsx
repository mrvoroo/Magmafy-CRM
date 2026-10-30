import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { store } from '../lib/storage';
import { useWorldScene } from '../three/WorldProvider';
import { QuickPrefs } from '../components/Prefs';
import { Wordmark } from '../components/Logo';
import type { Shape } from '../three/world';

const SLIDES: { shape: Shape; title: [string, string]; body: [string, string] }[] = [
  { shape: 'volcano', title: ['كل عملاءك في مكان واحد', 'Every client in one place'], body: ['من أول حجز على الموقع لحد ما يبقى عميل بيدفع: المسار، الاجتماعات، والمتابعة.', 'From the first website booking to a paying client: pipeline, meetings and follow-ups.'] },
  { shape: 'research', title: ['يومك واضح من أول نظرة', 'Your day at a glance'], body: ['جدولك، مهامك، واللي محتاج انتباهك النهارده، في شاشة واحدة.', 'Your schedule, your tasks and what needs attention today, on one screen.'] },
  { shape: 'galaxy', title: ['الفريق كله على نفس الصفحة', 'The whole team, in sync'], body: ['إعلانات الإدارة، محادثات الفريق، وكل تعديل متسجل في الشيت.', 'Admin announcements, team chat, and every change recorded in the sheet.'] }
];

export function Welcome() {
  const { t, dir } = useI18n();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  useWorldScene({ shape: s.shape, x: dir === 'rtl' ? -2.4 : 2.4, y: 0.6, scale: 0.95, opacity: 0.95 }, [i, dir]);
  const done = () => { store.set('mg-crm-welcomed', '1'); nav('/login', { replace: true }); };
  return (
    <div className="onb">
      <div className="auth__top"><QuickPrefs /></div>
      <div className="auth__brand" style={{ position: 'absolute', top: 24, insetInlineStart: 'clamp(16px, 6vw, 96px)' }}><Wordmark size={44} suffix="CRM" /></div>
      <div key={i} className="page-enter stack" style={{ gap: 18 }}>
        <h1 className="display">{t(s.title[0], s.title[1])}</h1>
        <p>{t(s.body[0], s.body[1])}</p>
      </div>
      <div className="row" style={{ gap: 18 }}>
        <div className="onb__dots" aria-label={t('الشاشة ', 'Screen ') + (i + 1) + '/3'}>{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <span className="grow" />
        <button className="btn btn--ghost" onClick={done}>{t('تخطّي', 'Skip')}</button>
        <button className="btn btn--grad" onClick={() => (i < 2 ? setI(i + 1) : done())}>{i < 2 ? t('التالي', 'Next') : t('يلا نبدأ', 'Get started')}</button>
      </div>
    </div>
  );
}
