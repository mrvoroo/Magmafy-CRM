/**
 * The Magmafy quote and invoice, as one A4 HTML document filled from data.
 * Same design as the approved invoice (Invoice_A4.pdf): black header with the mark, four detail boxes,
 * from / to, services table, totals with a black «total due» box, payment details, bilingual terms.
 * A quote adds the discount story (original price, discount name and %, price after) and the payment plan.
 * Pure function: the site shows it in an iframe and prints it to PDF; the server can email the same HTML.
 */

export type DocKind = 'quote' | 'invoice';

export type DocItem = {
  title: string;
  titleEn?: string;
  desc?: string;
  qty: number;
  unit: number;
  /** Discount on this line only, in percent (0–100). */
  discountPct?: number;
};

export type DocData = {
  kind: DocKind;
  number: string;
  issueDate: string;
  /** Invoice: due date. Quote: valid until. */
  dueDate: string;
  period?: string;
  currency: string;
  client: { business: string; contact?: string; city?: string; email?: string; phone?: string; taxId?: string };
  from: { name: string; line?: string; email?: string; whatsapp?: string; website?: string };
  items: DocItem[];
  /** A discount on the whole total, with the name the client sees («خصم عميل جديد»). */
  discount?: { name: string; pct?: number; amount?: number } | null;
  taxPct?: number;
  /** Payment plan (quote) or what this invoice covers. Percentages of the total. */
  plan?: { label: string; pct: number; when: string; current?: boolean }[];
  payment: { method?: string; beneficiary?: string; iban?: string; swift?: string };
  terms: [string, string][];
  note?: string;
  /** Invoice only: paid in full. */
  paid?: { date: string; ref?: string } | null;
  logoUrl: string;
};

export type DocTotals = {
  gross: number;
  lineDiscounts: number;
  subtotal: number;
  discount: number;
  afterDiscount: number;
  tax: number;
  total: number;
  savedPct: number;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Every number on the document comes from here, so the site, the PDF and the sheet agree. */
export function docTotals(d: Pick<DocData, 'items' | 'discount' | 'taxPct'>): DocTotals {
  let gross = 0, lineDiscounts = 0;
  d.items.forEach((it) => {
    const g = r2(it.qty * it.unit);
    gross += g;
    lineDiscounts += r2(g * Math.min(100, Math.max(0, it.discountPct || 0)) / 100);
  });
  gross = r2(gross); lineDiscounts = r2(lineDiscounts);
  const subtotal = r2(gross - lineDiscounts);
  const dc = d.discount;
  const discount = !dc ? 0 : r2(Math.min(subtotal, dc.pct ? subtotal * Math.min(100, Math.max(0, dc.pct)) / 100 : Math.max(0, dc.amount || 0)));
  const afterDiscount = r2(subtotal - discount);
  const tax = r2(afterDiscount * Math.max(0, d.taxPct || 0) / 100);
  const total = r2(afterDiscount + tax);
  const saved = lineDiscounts + discount;
  return { gross, lineDiscounts, subtotal, discount, afterDiscount, tax, total, savedPct: gross ? Math.round((saved / gross) * 1000) / 10 : 0 };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number) => r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '') + '%';

const TITLE: Record<DocKind, [string, string]> = { quote: ['عرض سعر', 'QUOTATION'], invoice: ['فاتورة', 'INVOICE'] };

/** fontCss: @font-face rules for Tajawal and Inter (the site passes its own bundled fonts). */
export function renderDoc(d: DocData, fontCss = ''): string {
  const t = docTotals(d);
  const cur = esc(d.currency);
  const isQuote = d.kind === 'quote';
  const anyDiscount = t.lineDiscounts > 0 || t.discount > 0;

  const meta: [string, string, string][] = isQuote
    ? [['رقم العرض', 'Quote No.', d.number], ['تاريخ العرض', 'Date', d.issueDate], ['صالح حتى', 'Valid Until', d.dueDate], ['فترة الخدمة', 'Service Period', d.period || '—']]
    : [['رقم الفاتورة', 'Invoice No.', d.number], ['تاريخ الإصدار', 'Issue Date', d.issueDate], ['تاريخ الاستحقاق', 'Due Date', d.dueDate], ['فترة الخدمة', 'Service Period', d.period || '—']];

  const rows = d.items.map((it, i) => {
    const g = r2(it.qty * it.unit);
    const dp = Math.min(100, Math.max(0, it.discountPct || 0));
    const net = r2(g - g * dp / 100);
    const unitCell = dp ? `<s>${money(it.unit)}</s><br>${money(r2(it.unit * (1 - dp / 100)))}` : money(it.unit);
    const amountCell = dp ? `<s>${money(g)}</s><br><b>${money(net)}</b><span class="chip num">-${pct(dp)}</span>` : `<b>${money(g)}</b>`;
    return `<tr>
      <td class="n">${String(i + 1).padStart(2, '0')}</td>
      <td class="svc"><div class="svc-t">${esc(it.title)}${it.titleEn ? ` <span class="en">· ${esc(it.titleEn)}</span>` : ''}</div>${it.desc ? `<div class="svc-d">${esc(it.desc)}</div>` : ''}</td>
      <td class="c">${esc(it.qty)}</td><td class="c num">${unitCell}</td><td class="c num">${amountCell}</td></tr>`;
  }).join('');

  const totalsRows: string[] = [];
  if (anyDiscount) totalsRows.push(row('السعر الأساسي', 'Original Price', `<s>${money(t.gross)}</s>`));
  if (t.lineDiscounts) totalsRows.push(row('خصومات الخدمات', 'Service Discounts', '-' + money(t.lineDiscounts), 'neg'));
  totalsRows.push(row('المجموع الفرعي', 'Subtotal', money(t.subtotal)));
  if (t.discount && d.discount) {
    const label = esc(d.discount.name || 'خصم') + (d.discount.pct ? ` <span class="num">(${pct(d.discount.pct)})</span>` : '');
    totalsRows.push(row(label, 'Discount', '-' + money(t.discount), 'neg'));
  }
  if (d.taxPct) totalsRows.push(row(`الضريبة (${pct(d.taxPct)})`, 'Tax', money(t.tax)));
  // An invoice for one payment of the plan asks only for that share.
  const now = !isQuote && d.plan ? d.plan.filter((p) => p.current)[0] : undefined;
  const dueNow = now ? r2(t.total * now.pct / 100) : t.total;
  if (now) totalsRows.push(row('إجمالي العقد', 'Contract Total', money(t.total)));

  const plan = d.plan && d.plan.length ? `
    <div class="plan">
      <div class="lbl">${isQuote ? 'خطة الدفع' : 'الدفعات'} · <span class="en">${isQuote ? 'PAYMENT PLAN' : 'PAYMENTS'}</span></div>
      <table>${d.plan.map((p, i) => `<tr${p.current ? ' class="cur"' : ''}><td class="n">${i + 1}</td><td><b>${esc(p.label)}</b> <span class="num pp">${pct(p.pct)}</span><div class="svc-d">${esc(p.when)}</div></td><td class="amt num"><b>${cur} ${money(t.total * p.pct / 100)}</b></td></tr>`).join('')}</table>
    </div>` : '';

  const pay = d.payment;
  const savedBadge = anyDiscount && isQuote ? `<div class="saved">وفّرت <span class="num">${cur} ${money(t.gross - t.afterDiscount)}</span> · خصم <span class="num">${pct(t.savedPct)}</span></div>` : '';

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(TITLE[d.kind][0])} ${esc(d.number)}</title>
<style>${fontCss}${CSS}</style></head><body><div class="page">
<header class="top">
  <div class="brand"><img src="${esc(d.logoUrl)}" alt="">
    <div><div class="bn">Magmafy <span>OGP</span></div><div class="bt">شريك النمو أونلاين لقطاع الأثاث والديكور</div><div class="be">Online Growth Partner · Furniture &amp; Interiors</div></div></div>
  <div class="kind"><div class="ka">${TITLE[d.kind][0]}</div><div class="ke">${TITLE[d.kind][1]}</div></div>
</header>
<div class="bar"></div>
${d.paid ? `<div class="stamp">مدفوعة · PAID<small>${esc(d.paid.date)}${d.paid.ref ? ' · ' + esc(d.paid.ref) : ''}</small></div>` : ''}
<section class="meta">${meta.map(([a, e, v]) => `<div class="box"><div class="lbl2">${a} · <span class="en">${e}</span></div><div class="v">${esc(v)}</div></div>`).join('')}</section>
<section class="parties">
  <div><div class="lbl">من · <span class="en">FROM</span></div><div class="pn">${esc(d.from.name)}</div>
    ${[d.from.line, d.from.email, d.from.whatsapp ? 'واتساب: ' + d.from.whatsapp : '', d.from.website].filter(Boolean).map((x) => `<div class="pl">${esc(x)}</div>`).join('')}</div>
  <div><div class="lbl">${isQuote ? 'مقدّم إلى' : 'فاتورة إلى'} · <span class="en">${isQuote ? 'PREPARED FOR' : 'BILL TO'}</span></div><div class="pn">${esc(d.client.business)}</div>
    ${[d.client.contact, d.client.city, [d.client.email, d.client.phone].filter(Boolean).join(' · '), d.client.taxId ? 'الرقم الضريبي: ' + d.client.taxId : ''].filter(Boolean).map((x) => `<div class="pl">${esc(x)}</div>`).join('')}</div>
</section>
<table class="items"><thead><tr><th class="n">#</th><th>الخدمة · <span class="en">Service</span></th><th class="c">الكمية · <span class="en">Qty</span></th><th class="c">سعر الوحدة · <span class="en">Unit</span></th><th class="c">الإجمالي · <span class="en">Amount</span></th></tr></thead><tbody>${rows}</tbody></table>
<section class="bottom">
  <div class="side"><div class="paycard"><div class="lbl">بيانات الدفع · <span class="en">PAYMENT DETAILS</span></div>
    ${pay.method ? `<div class="pl">طريقة الدفع: ${esc(pay.method)}</div>` : ''}${pay.beneficiary ? `<div class="pl">اسم المستفيد: ${esc(pay.beneficiary)}</div>` : ''}
    ${pay.iban ? `<div class="pl ltr">IBAN: ${esc(pay.iban)}</div>` : ''}${pay.swift ? `<div class="pl ltr">SWIFT / Routing: ${esc(pay.swift)}</div>` : ''}
    <div class="pl">مرجع التحويل: اكتب رقم ${isQuote ? 'العرض' : 'الفاتورة'} في وصف التحويل</div></div>${plan}</div>
  <div class="totals">${totalsRows.join('')}
    <div class="due"><span>${isQuote ? 'الإجمالي بعد الخصم' : 'الإجمالي المستحق'} · <span class="en">${isQuote ? 'Total' : 'Total Due'}</span></span><b>${cur} ${money(dueNow)}</b></div>${now ? `<div class="saved" style="color:#5d5768">${esc(now.label)} · <span class="num">${pct(now.pct)}</span> من إجمالي العقد</div>` : ''}${savedBadge}</div>
</section>
${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}
<section class="terms"><div class="lbl">الشروط · <span class="en">TERMS</span></div>
  <div class="tc"><ol>${d.terms.map((x) => `<li>${esc(x[0])}</li>`).join('')}</ol><ol class="ltr">${d.terms.map((x) => `<li>${esc(x[1])}</li>`).join('')}</ol></div></section>
<footer><b>شكرًا لثقتكم · <span class="en">Thank you for your Trust</span></b><span>نحوّل متابعيك إلى زوّار لمعرضك</span></footer>
</div></body></html>`;

  function row(ar: string, en: string, v: string, cls = '') {
    return `<div class="tr ${cls}"><span>${ar} · <span class="en">${en}</span></span><span class="num">${v}</span></div>`;
  }
}

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; }
body { font-family: 'Tajawal', 'Inter', system-ui, sans-serif; color: #17121f; font-size: 10.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; padding: 0 0 7mm; position: relative; display: flex; flex-direction: column; }
.en { font-family: 'Inter', 'Tajawal', sans-serif; font-weight: inherit; }
.num, .ltr { direction: ltr; unicode-bidi: isolate; font-family: 'Inter', 'Tajawal', sans-serif; font-variant-numeric: tabular-nums; }
.ltr { text-align: left; }
.top { background: #0e0b12; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 6mm 11mm 5mm; }
.brand { display: flex; gap: 4mm; align-items: center; }
.brand img { width: 15mm; height: 15mm; border-radius: 4mm; }
.bn { font-family: 'Inter', sans-serif; font-weight: 800; font-size: 20pt; letter-spacing: -.01em; direction: ltr; text-align: right; }
.bn span { font-size: 10pt; color: #ff3d8b; font-weight: 700; }
.bt { font-size: 10pt; opacity: .9; margin-top: .5mm; }
.be { font-family: 'Inter', sans-serif; font-size: 8pt; opacity: .65; direction: ltr; text-align: right; }
.kind { text-align: left; }
.ka { font-weight: 800; font-size: 25pt; line-height: 1; }
.ke { font-family: 'Inter', sans-serif; font-size: 8.5pt; letter-spacing: .32em; color: #ffb547; font-weight: 700; margin-top: 2mm; }
.bar { height: 1.4mm; background: linear-gradient(90deg, #7b3cff, #ff2e88 55%, #ff8a3d); }
.stamp { position: absolute; top: 60mm; left: 16mm; transform: rotate(-8deg); border: 2.5px solid #13a36b; color: #13a36b; padding: 2mm 5mm; border-radius: 3mm; font-weight: 800; font-size: 14pt; text-align: center; background: rgba(255,255,255,.85); }
.stamp small { display: block; font-size: 8pt; font-weight: 500; }
.meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 4mm 11mm 4mm; }
.box { border: 1px solid #e3dfe8; border-radius: 3mm; padding: 2mm 3mm; }
.lbl2 { font-size: 7.5pt; color: #807a89; }
.box .v { font-weight: 700; font-size: 10.5pt; margin-top: 1.4mm; }
.lbl { font-weight: 800; font-size: 8pt; color: #d6246f; letter-spacing: .03em; margin-bottom: 2mm; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin: 0 11mm 4mm; }
.pn { font-weight: 800; font-size: 12pt; margin-bottom: 1.5mm; }
.pl { font-size: 9pt; color: #3a3442; line-height: 1.6; }
.items { width: calc(100% - 22mm); margin: 0 11mm; border-collapse: separate; border-spacing: 0; border: 1px solid #e3dfe8; border-radius: 3.5mm; overflow: hidden; }
.items th { background: #f3eff8; font-size: 8pt; color: #5d5768; font-weight: 700; padding: 2.2mm 3mm; text-align: right; }
.items td { padding: 1.9mm 3mm; border-top: 1px solid #ece8f1; vertical-align: middle; }
.items .n { width: 10mm; color: #807a89; text-align: center; }
.items .c { text-align: center; width: 24mm; }
.svc-t { font-weight: 800; font-size: 10.5pt; }
.svc-t .en { font-weight: 700; }
.svc-d { font-size: 8.5pt; color: #807a89; margin-top: .8mm; }
s { color: #a39cab; font-weight: 400; }
.chip { display: inline-block; margin-top: 1mm; background: #ffe6f1; color: #d6246f; font-size: 7.5pt; font-weight: 700; padding: .3mm 1.8mm; border-radius: 10mm; }
.bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin: 4.5mm 11mm 0; align-items: start; }
.paycard { background: #f6f3fa; border-radius: 3.5mm; padding: 3.5mm 4.5mm; }
.tr { display: flex; justify-content: space-between; gap: 3mm; padding: 1.5mm 0; border-bottom: 1px solid #ece8f1; font-size: 9.5pt; }
.tr.neg .num { color: #d6246f; }
.due { margin-top: 3mm; background: #0e0b12; color: #fff; border-radius: 3mm; padding: 3.5mm 4.5mm; display: flex; justify-content: space-between; align-items: center; gap: 4mm; font-weight: 800; }
.due > span { white-space: nowrap; }
.due b { color: #ffb547; font-family: 'Inter', sans-serif; font-size: 13.5pt; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
.saved { margin-top: 2mm; text-align: center; font-size: 8.5pt; color: #13a36b; font-weight: 700; }
.plan { margin-top: 3.5mm; }
.plan table { width: 100%; border-collapse: collapse; font-size: 9pt; }
.plan .amt { text-align: left; white-space: nowrap; }
.pp { color: #807a89; font-size: 8pt; }
.plan tr.cur td { background: #fff4e6; }
.plan tr.cur td:first-child { border-radius: 0 2mm 2mm 0; } .plan tr.cur td:last-child { border-radius: 2mm 0 0 2mm; }
.plan td { padding: 1.1mm 2mm; border-bottom: 1px solid #ece8f1; }
.plan .n { width: 8mm; color: #807a89; }
.note { margin: 3.5mm 11mm 0; padding: 3mm 4mm; border-inline-start: 1mm solid #ff8a3d; background: #fff7ef; font-size: 9pt; border-radius: 1.5mm; }
.terms { margin: 4mm 11mm 0; }
.tc { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; font-size: 8pt; color: #3a3442; line-height: 1.65; }
.tc ol { padding-inline-start: 4mm; }
footer { margin: auto 11mm 0; padding-top: 4mm; border-top: 1px solid #e3dfe8; display: flex; justify-content: space-between; font-size: 9pt; color: #5d5768; }
footer b { color: #17121f; }
`;
