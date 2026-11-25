import{aX as R}from"./index-WihjGNOG.js";const c=t=>Math.round((Number(t)||0)*100)/100;function J(t,o,n){const i=s=>c((Number(s)||0)*o);return{...t,currency:n,items:t.items.map(s=>({...s,unit:i(s.unit)})),discount:t.discount?{...t.discount,amount:t.discount.amount!=null?i(t.discount.amount):void 0}:t.discount,plan:t.plan?.map(s=>({...s,amount:s.amount!=null?i(s.amount):s.amount})),dueAmount:t.dueAmount!=null?i(t.dueAmount):t.dueAmount,payments:t.payments?.map(s=>({...s,amount:i(s.amount)}))}}function E(t){let o=0,n=0;t.items.forEach(w=>{const m=c(w.qty*w.unit);o+=m,n+=c(m*Math.min(100,Math.max(0,w.discountPct||0))/100)}),o=c(o),n=c(n);const i=c(o-n),s=t.discount,u=s?c(Math.min(i,s.pct?i*Math.min(100,Math.max(0,s.pct))/100:Math.max(0,s.amount||0))):0,$=c(i-u),f=c($*Math.max(0,t.taxPct||0)/100),r=c($+f),d=n+u;return{gross:o,lineDiscounts:n,subtotal:i,discount:u,afterDiscount:$,tax:f,total:r,savedPct:o?Math.round(d/o*1e3)/10:0}}const e=t=>String(t??"").replace(/[&<>"']/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[o]),l=t=>c(t).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}),x=t=>(Math.round(t*10)/10).toString().replace(/\.0$/,"")+"%",M={quote:["عرض سعر","QUOTATION"],invoice:["فاتورة","INVOICE"]};function F(t,o=""){const n=E(t),i=e(t.currency),s=t.kind==="quote",u=n.lineDiscounts>0||n.discount>0,$=s?[["رقم العرض","Quote No.",t.number],["تاريخ العرض","Date",t.issueDate],["صالح حتى","Valid Until",t.dueDate],["فترة الخدمة","Service Period",t.period||"—"]]:[["رقم الفاتورة","Invoice No.",t.number],["تاريخ الإصدار","Issue Date",t.issueDate],["تاريخ الاستحقاق","Due Date",t.dueDate],["فترة الخدمة","Service Period",t.period||"—"]],f=t.items.map((a,g)=>{const h=c(a.qty*a.unit),y=Math.min(100,Math.max(0,a.discountPct||0)),S=c(h-h*y/100),C=y?`<s>${l(a.unit)}</s><br>${l(c(a.unit*(1-y/100)))}`:l(a.unit),A=y?`<s>${l(h)}</s><br><b>${l(S)}</b><span class="chip num">-${x(y)}</span>`:`<b>${l(h)}</b>`;return`<tr>
      <td class="n">${String(g+1).padStart(2,"0")}</td>
      <td class="svc"><div class="svc-t">${e(a.title)}${a.titleEn?` <span class="en">· ${e(a.titleEn)}</span>`:""}</div>${a.desc?`<div class="svc-d">${e(a.desc)}</div>`:""}</td>
      <td class="c">${e(a.qty)}</td><td class="c num">${C}</td><td class="c num">${A}</td></tr>`}).join(""),r=[];if(u&&r.push(v("السعر الأساسي","Original Price",`<s>${l(n.gross)}</s>`)),n.lineDiscounts&&r.push(v("خصومات الخدمات","Service Discounts","-"+l(n.lineDiscounts),"neg")),r.push(v("المجموع الفرعي","Subtotal",l(n.subtotal))),n.discount&&t.discount){const a=e(t.discount.name||"خصم")+(t.discount.pct?` <span class="num">(${x(t.discount.pct)})</span>`:"");r.push(v(a,"Discount","-"+l(n.discount),"neg"))}t.taxPct&&r.push(v(`الضريبة (${x(t.taxPct)})`,"Tax",l(n.tax)));const d=!s&&t.plan?t.plan.filter(a=>a.current)[0]:void 0,w=t.dueAmount!=null&&!s?c(t.dueAmount):d?c(d.amount??n.total*d.pct/100):n.total,m=s?[]:t.payments||[],D=c(m.reduce((a,g)=>a+(Number(g.amount)||0),0)),z=c(Math.max(0,w-D)),j=m.length?z<=0?"paid":"partial":"open";d&&!(t.payments&&t.payments.length)&&r.push(v("إجمالي العقد","Contract Total",l(n.total)));const k=t.plan&&t.plan.length?`
    <div class="plan">
      <div class="lbl">${s?"خطة الدفع":"الدفعات"} · <span class="en">${s?"PAYMENT PLAN":"PAYMENTS"}</span></div>
      <table>${t.plan.map((a,g)=>`<tr${a.current?' class="cur"':""}><td class="n">${g+1}</td><td><b>${e(a.label)}</b> <span class="num pp">${x(a.pct)}</span> <span class="svc-d">· ${e(a.when)}</span></td><td class="amt num"><b>${i} ${l(a.amount??n.total*a.pct/100)}</b></td></tr>`).join("")}</table>
    </div>`:"",p=t.payment,P=u&&s?`<div class="saved">وفّرت <span class="num">${i} ${l(n.gross-n.afterDiscount)}</span> · خصم <span class="num">${x(n.savedPct)}</span></div>`:"";return`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${e(M[t.kind][0])} ${e(t.number)}</title>
<style>${o}${U}</style></head><body><div class="page">
<header class="top">
  <div class="brand"><img src="${e(t.logoUrl)}" alt="">
    <div><div class="bn">Magmafy <span>OGP</span></div><div class="bt">شريك النمو أونلاين لقطاع الأثاث والديكور</div><div class="be">Online Growth Partner · Furniture &amp; Interiors</div></div></div>
  <div class="kind"><div class="ka">${M[t.kind][0]}</div><div class="ke">${M[t.kind][1]}</div>${j==="paid"?'<div class="badge ok">مدفوعة · PAID</div>':j==="partial"?'<div class="badge part">مدفوعة جزئيًا · PARTIALLY PAID</div>':""}</div>
</header>
<div class="bar"></div>
<section class="meta">${$.map(([a,g,h])=>`<div class="box"><div class="lbl2">${a} · <span class="en">${g}</span></div><div class="v">${e(h)}</div></div>`).join("")}</section>
<section class="parties">
  <div><div class="lbl">من · <span class="en">FROM</span></div><div class="pn">${e(t.from.name)}</div>
    ${[t.from.line,t.from.email,t.from.whatsapp?"واتساب: "+t.from.whatsapp:"",t.from.website].filter(Boolean).map(a=>`<div class="pl">${e(a)}</div>`).join("")}</div>
  <div><div class="lbl">${s?"مقدّم إلى":"فاتورة إلى"} · <span class="en">${s?"PREPARED FOR":"BILL TO"}</span></div><div class="pn">${e(t.client.business)}</div>
    ${[t.client.contact,t.client.city,[t.client.email,t.client.phone].filter(Boolean).join(" · "),t.client.taxId?"الرقم الضريبي: "+t.client.taxId:""].filter(Boolean).map(a=>`<div class="pl">${e(a)}</div>`).join("")}</div>
</section>
<table class="items"><thead><tr><th class="n">#</th><th>الخدمة · <span class="en">Service</span></th><th class="c">الكمية · <span class="en">Qty</span></th><th class="c">سعر الوحدة · <span class="en">Unit</span></th><th class="c">الإجمالي · <span class="en">Amount</span></th></tr></thead><tbody>${f}</tbody></table>
<section class="bottom">
  <div class="side">${j==="paid"?"":`<div class="paycard"><div class="lbl">بيانات الدفع · <span class="en">PAYMENT DETAILS</span></div>
    ${p.method?`<div class="pl">طريقة الدفع: ${e(p.method)}</div>`:""}${p.beneficiary?`<div class="pl">اسم المستفيد: ${e(p.beneficiary)}</div>`:""}
    ${p.iban?`<div class="pl ltr">IBAN: ${e(p.iban)}</div>`:""}${p.swift?`<div class="pl ltr">SWIFT / Routing: ${e(p.swift)}</div>`:""}
    ${p.method||p.iban||p.beneficiary?`<div class="pl">مرجع التحويل: اكتب رقم ${s?"العرض":"الفاتورة"} في وصف التحويل</div>`:'<div class="pl">هنرسل لك بيانات التحويل مع الفاتورة.</div>'}</div>`}${k}${m.length?`
    <div class="pays"><div class="lbl">سجل المدفوعات · <span class="en">PAYMENTS RECEIVED</span></div>
      <table>${m.map(a=>`<tr><td><b class="num">${e(a.date)}</b> <span class="svc-d">${[a.ref?'<span class="num">'+e(a.ref)+"</span>":"",a.from?e(a.from)+(a.account?' <span class="num">'+e(a.account)+"</span>":""):""].filter(Boolean).join(" · ")}</span></td><td class="amt num"><b>${i} ${l(a.amount)}</b></td></tr>`).join("")}</table></div>`:""}</div>
  <div class="totals">${r.join("")}
    ${m.length?v(d?"مستحق في هذه الفاتورة":"الإجمالي",d?"This Invoice":"Total",l(w))+v("المدفوع","Paid","-"+l(D),"neg"):""}
    <div class="due${j==="paid"?" ok":""}"><span>${s?"الإجمالي بعد الخصم":m.length?"المتبقي":"الإجمالي المستحق"} · <span class="en">${s?"Total":m.length?"Balance Due":"Total Due"}</span></span><b>${i} ${l(m.length?z:w)}</b></div>${d&&!m.length?`<div class="saved" style="color:#5d5768">${e(d.label)} · <span class="num">${x(d.pct)}</span> من إجمالي العقد</div>`:""}${P}</div>
</section>
${t.note?`<div class="note">${e(t.note)}</div>`:""}
<section class="terms"><div class="lbl">الشروط · <span class="en">TERMS</span></div>
  <div class="tc"><ol>${t.terms.map(a=>`<li>${e(a[0])}</li>`).join("")}</ol><ol class="ltr">${t.terms.map(a=>`<li>${e(a[1])}</li>`).join("")}</ol></div></section>
<footer><b>شكرًا لثقتكم · <span class="en">Thank you for your Trust</span></b><span>نحوّل متابعيك إلى زوّار لمعرضك</span></footer>
</div></body></html>`;function v(a,g,h,y=""){return`<div class="tr ${y}"><span>${a} · <span class="en">${g}</span></span><span class="num">${h}</span></div>`}}const U=`
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
.kind { text-align: left; position: relative; }
.ka { font-weight: 800; font-size: 25pt; line-height: 1; }
.ke { font-family: 'Inter', sans-serif; font-size: 8.5pt; letter-spacing: .32em; color: #ffb547; font-weight: 700; margin-top: 2mm; }
.bar { height: 1.4mm; background: linear-gradient(90deg, #7b3cff, #ff2e88 55%, #ff8a3d); }
.badge { position: absolute; left: 100%; bottom: 0; white-space: nowrap; margin-left: 4mm; padding: 1mm 3mm; border-radius: 10mm; font-size: 8.5pt; font-weight: 800; border: 1.5px solid; }
.badge.ok { color: #3fd69a; border-color: #3fd69a; }
.badge.part { color: #ffb547; border-color: #ffb547; }
.due.ok b { color: #3fd69a; }
.pays { margin-top: 3mm; }
.pays table { width: 100%; border-collapse: collapse; font-size: 9pt; }
.pays td { padding: 1mm 1mm; border-bottom: 1px solid #ece8f1; }
.pays .amt { text-align: left; white-space: nowrap; }
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
.items td { padding: 1.6mm 3mm; border-top: 1px solid #ece8f1; vertical-align: middle; }
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
.terms { margin: 3.5mm 11mm 0; }
.tc { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; font-size: 7.8pt; color: #3a3442; line-height: 1.5; }
.tc ol { padding-inline-start: 4mm; }
footer { margin: auto 11mm 0; padding-top: 3mm; border-top: 1px solid #e3dfe8; display: flex; justify-content: space-between; font-size: 9pt; color: #5d5768; }
footer b { color: #17121f; }
`,N="/Magmafy-CRM/assets/tajawal-arabic-400-normal-CyCXRvzh.woff2",B="/Magmafy-CRM/assets/tajawal-arabic-500-normal-BZ8ojJNu.woff2",L="/Magmafy-CRM/assets/tajawal-arabic-700-normal-D2-eand5.woff2",O="/Magmafy-CRM/assets/tajawal-arabic-800-normal-TQp-UTiE.woff2",q="/Magmafy-CRM/assets/tajawal-latin-400-normal-BVNSOH3d.woff2",Y="/Magmafy-CRM/assets/tajawal-latin-500-normal-CoYeBiSI.woff2",Q="/Magmafy-CRM/assets/tajawal-latin-700-normal-BypgxfGb.woff2",V="/Magmafy-CRM/assets/tajawal-latin-800-normal-CmI34b-g.woff2",G="/Magmafy-CRM/assets/inter-latin-wght-normal-C2S99t-D.woff2",I=t=>new URL(t,location.href).href,T="unicode-range:U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+2010-2011,U+FB50-FDFF,U+FE70-FEFC;",b=(t,o,n,i="")=>`@font-face{font-family:'${t}';font-weight:${o};font-display:block;src:url('${I(n)}') format('woff2');${i}}`;function H(){return[b("Tajawal","400",N,T),b("Tajawal","500",B,T),b("Tajawal","700",L,T),b("Tajawal","800",O,T),b("Tajawal","400",q),b("Tajawal","500",Y),b("Tajawal","700",Q),b("Tajawal","800",V),b("Inter","100 900",G)].join("")}const W=()=>I(R.basePath+"icon-512.png");function Z(t){return F({...t,logoUrl:W()},H())}function K(t,o){const n=document.createElement("iframe");n.setAttribute("aria-hidden","true"),n.style.cssText="position:fixed;inset:auto 0 0 auto;width:0;height:0;border:0;opacity:0",document.body.appendChild(n);const i=n.contentWindow;i.document.open(),i.document.write(t.replace(/<title>[^<]*<\/title>/,"<title>"+o.replace(/[<>&]/g,"")+"</title>")),i.document.close();const s=()=>{const f=document.title;document.title=o,i.focus(),i.print(),setTimeout(()=>{document.title=f,n.remove()},1500)},u=i.document.fonts,$=Array.from(i.document.images).map(f=>f.complete?Promise.resolve():new Promise(r=>{f.onload=f.onerror=r}));Promise.all([u?u.ready:Promise.resolve(),...$]).then(()=>setTimeout(s,150),()=>setTimeout(s,150))}function _(t,o){let n=String(t||"").replace(/\D/g,"");return/^05\d{8}$/.test(n)&&(n="966"+n.slice(1)),/^00/.test(n)&&(n=n.slice(2)),"https://wa.me/"+n+"?text="+encodeURIComponent(o)}const tt=(t,o="USD")=>o+" "+(Number(t)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});export{E as a,J as c,Z as d,tt as m,K as p,_ as w};
