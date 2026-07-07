// finance.js — Гүйлгээ, Төлбөр, Тайлан, Тарифын тохиргооны модуль
// (suh.html-ээс тусгаарлав)
// Хамаарал: sb (db.js), residents/businesses/assets дата (тэдгээрийн модулиуд).








// --- TRANSACTIONS ---
async function db_loadTransactions() {
  const {data,error} = await sb.from('transactions').select('*').order('id');
  if(error){console.error('transactions load error:', JSON.stringify(error), error.message);return;}
  if(!data){console.error('transactions: data is null');return;}
  transactions = data.filter(Boolean).map(t=>({
    id:t.id, apt:t.apt, aptId:t.resident_id, desc:t.description||'',
    subcat:t.subcat||'', type:t.type, amount:+t.amount, method:t.method||'',
    ref:t.ref||'', month:t.month, year:t.year, date:t.date||'',
    status:t.status||'completed', category:t.category||'', clienteleId:t.clientele_id||null, assetId:t.asset_id||null, businessId:t.business_id||null
  }));
}
async function db_saveTransaction(t) {
  const row = {
    apt:t.apt||null,
    resident_id:t.aptId||null,
    description:t.description||t.desc||'',
    subcat:t.subcat, type:t.type, amount:t.amount, method:t.method,
    ref:t.ref, month:t.month, year:t.year, date:t.date,
    status:t.status, category:t.category, clientele_id:t.clienteleId||null,
    business_id:t.businessId||null, asset_id:t.assetId||null
  };
  const {data,error} = await sb.from('transactions').insert(row).select().single();
  if(error){console.error('transaction insert error:',error); return false;}
  t.id = data.id;
  return true;
}
// --- SETTINGS ---
async function db_loadSettings() {
  const {data,error} = await sb.from('settings').select('*');
  if(error){console.error('settings load error:', JSON.stringify(error), error.message);return;}
  if(!data){console.error('settings: data null');return;}
  data.forEach(s=>{
    if(s.key==='fee') Object.assign(feeSettings, s.value);
    if(s.key==='rent') Object.assign(rentSettings, s.value);
  });
}
async function db_saveSettings(key, value) {
  const {error} = await sb.from('settings').upsert({key, value, updated_at:new Date().toISOString()}, {onConflict:'key'});
  if(error) { console.error('settings save error:', error.message); return false; }
  return true;
}
// ============================================================
// DATA STORE
// ============================================================

let feeSettings = {perSqm: 2500, utility: 15000, extra: 0, penalty: 2, garage: 25000, storageSqm: 1500, fundAmount: 5000000, pendingMonths: 1, overdueMonths: 2, riskMonths: 12};
function calcFee(sqm) {
  return sqm * feeSettings.perSqm + feeSettings.utility + feeSettings.extra;
}
// ============================================================
// ОРЛОГО / ЗАРЛАГЫН АНГИЛАЛ
// ============================================================
const INCOME_CATS = ['Айл, өрх, зогсоол, агуулах','Аж ахуйн нэгж','Антены, лифтний самбарын түрээс','Банкны хүүгийн орлого','Зогсоолын хураамж','Чипний орлого','Ажилчдаас авах авлага','Бусад'];
const EXPENSE_CATS = {
  'Урсгал зардал': ['Цалин хөлсний зардал','НДШ зардал','Татварын зардал (ХХОАТ)','Ашиглалтын зардалд төлсөн (цахилгаан, ус, дулаан, санхүүгийн програм)','Барилга гүйцэтгүүлсэн ажил, үйлчилгээ (харуул, хог ачит, лифт, генератор, ариутгал)','Цэвэрлэгээний материал','Гэрэлтүүлэг, цахилгаан кабель','Сантехникийн материал','Барилга, аж ахуйн материал','Лифтний сэлбэг','Ачааны машин, шалны машины сэлбэг','Камер, домофон, галын дохиоллын сэлбэг','Зогсоолын хаалга, хаалт, сэлбэг хэрэгсэл','Орцны хаалга, сэлбэг, шил','Интернет, шуудан холбоо, бичиг хэрэг','Баяр ёслолын зардал','Шатахуун, тээврийн хөлс','Банкны шимтгэл','Хангамжийн материал (БҮТЗЭ)','Ажилчдын хоолны материал','Нотриат, Шүүх эмнэлгийн зардал','Хохирлын үнэлгээний төлбөр','Бусад /данс андуурсан гүйлгээ буцаалт/'],
  'Хөрөнгө оруулалтын зардал': ['Шалны машины төлбөр','Автомат хаалганы төлбөр','Зогсоолын хаалга','Баримт шүүгээ','Сагсны талбай','Шалны чулуу','Бусад'],
  'Хуримтлалын сан': ['Хуримтлалын сан'],
  'Элэгдэл': ['Үндсэн хөрөнгийн элэгдэл'],
};
function onExpTypeChange() {
  loadExpCats(document.getElementById('exp-type').value);
}
// ============================================================
// FINANCE TABS
// ============================================================
function switchFinTab(name, el) {
  ['fin-income','fin-expenses'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.getElementById('fin-'+name).style.display='block';
  document.querySelectorAll('#fin-tabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  if(name==='income') renderIncomeTable();
  if(name==='expenses') renderExpenseTable();
}
function switchTariffTab(name, el) {
  ['tariff-fees','tariff-rent'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.getElementById('tariff-'+name).style.display='block';
  document.querySelectorAll('#tariff-tabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  populateTariffFields();
  if(name==='fees') calcFeePreview();
  if(name==='rent') calcRentPreview();
}
// DB-ээс ачаалсан feeSettings/rentSettings-г бодит HTML талбарт харуулна
// (Өмнө нь энэ холбоос байхгүй байсан тул F5 дарахад тохиргоо "ресетлэгдэж" харагддаг байсан алдаа)
function populateTariffFields() {
  const feeMap = {
    'fee-per-sqm': feeSettings.perSqm, 'fee-garage': feeSettings.garage, 'fee-storage': feeSettings.storageSqm,
    'fee-utility': feeSettings.utility, 'fee-penalty': feeSettings.penalty, 'fee-fund-amount': feeSettings.fundAmount,
    'fee-pending-months': feeSettings.pendingMonths, 'fee-overdue-months': feeSettings.overdueMonths, 'fee-risk-months': feeSettings.riskMonths,
  };
  const rentMap = {
    'rent-per-sqm': rentSettings.perSqm, 'rent-waste': rentSettings.waste, 'rent-extra': rentSettings.extra,
    'rent-penalty': rentSettings.penalty,
    'rent-pending-months': rentSettings.pendingMonths, 'rent-overdue-months': rentSettings.overdueMonths, 'rent-risk-months': rentSettings.riskMonths,
  };
  Object.entries({...feeMap, ...rentMap}).forEach(([id,val])=>{
    const el = document.getElementById(id);
    if(el && val!==undefined && val!==null) el.value = val;
  });
}
// view: 'list' (үндсэн жагсаалт) эсвэл 'depreciation' (элэгдэл) — ХОЁУЛАА ЯГ ТЭР НЭГ assets массиваас уншина








// --- Актлах ---
// --- Хөрөнгийн дэлгэрэнгүй (Info) modal ---

// --- Засварын дэлгэрэнгүй (Info) modal ---



// --- Засвар, үйлчилгээ ---





let rentSettings = {perSqm: 15000, waste: 50000, extra: 0, penalty: 2, pendingMonths: 1, overdueMonths: 2, riskMonths: 12};
function calcRentPreview() {
  rentSettings.perSqm = +(document.getElementById('rent-per-sqm')?.value)||15000;
  rentSettings.waste = +(document.getElementById('rent-waste')?.value)||50000;
  rentSettings.extra = +(document.getElementById('rent-extra')?.value)||0;
  const sqm = +(document.getElementById('rent-preview-sqm')?.value)||50;
  const units = +(document.getElementById('rent-preview-units')?.value)||1;
  const base = sqm * rentSettings.perSqm;
  const waste = units * rentSettings.waste;
  const extra = rentSettings.extra;
  const total = base + waste + extra;
  const el = document.getElementById('rent-preview-result'); if(!el) return;
  el.innerHTML = `
    <div class="summary-row"><span class="summary-key">Түрээсийн талбайн төлбөр (${sqm}м²)</span><span class="summary-val">${fmtMoney(base)}</span></div>
    <div class="summary-row"><span class="summary-key">Хог хаягдлын төлбөр (${units} нэгж)</span><span class="summary-val">${fmtMoney(waste)}</span></div>
    ${extra?`<div class="summary-row"><span class="summary-key">Нэмэлт үйлчилгээ</span><span class="summary-val">${fmtMoney(extra)}</span></div>`:''}
    <div class="summary-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
      <span class="summary-key" style="font-weight:700;color:var(--text)">Нийт түрээсийн төлбөр</span>
      <span class="summary-val text-accent" style="font-size:18px">${fmtMoney(total)}</span>
    </div>`;
}
async function saveRentSettings() {
  rentSettings.perSqm = +(document.getElementById('rent-per-sqm')?.value)||15000;
  rentSettings.waste = +(document.getElementById('rent-waste')?.value)||50000;
  rentSettings.extra = +(document.getElementById('rent-extra')?.value)||0;
  rentSettings.penalty = +(document.getElementById('rent-penalty')?.value)||2;
  rentSettings.pendingMonths = +(document.getElementById('rent-pending-months')?.value)||1;
  rentSettings.overdueMonths = +(document.getElementById('rent-overdue-months')?.value)||2;
  rentSettings.riskMonths = +(document.getElementById('rent-risk-months')?.value)||12;
  const ok = await db_saveSettings('rent', rentSettings);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — консол шалгана уу','error'); return; }
  toast('Түрээсийн төлбөрийн тохиргоо хадгалагдлаа','success');
}
// Гүйлгээний огноонд үндэслэн Он-ы dropdown-г динамикаар үүсгэнэ (Бүх он = анхны утга)
function populateYearFilterOptions(selectId, txType) {
  const sel = document.getElementById(selectId);
  if(!sel) return;
  const years = [...new Set(transactions.filter(t=>t && t.type===txType && t.year).map(t=>t.year))].sort((a,b)=>b-a);
  const expectedCount = years.length + 1; // +1 үчир "Бүх он"
  if(sel.options.length === expectedCount && sel.dataset.yearsKey === years.join(',')) return; // өөрчлөгдөөгүй бол дахин зурахгүй
  const curVal = sel.value;
  sel.innerHTML = '<option value="">Бүх он</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
  sel.value = curVal;
  sel.dataset.yearsKey = years.join(',');
}
function renderIncomeTable() {
  populateYearFilterOptions('inc-year-filter', 'income');
  const mf=document.getElementById('inc-month-filter')?.value;
  const yf=document.getElementById('inc-year-filter')?.value;
  const q=(document.getElementById('inc-apt-filter')?.value||'').toLowerCase();
  const list=transactions.filter(t=>{
    if(!t||t.type!=='income') return false;
    if(mf&&t.month!=mf) return false;
    if(yf&&t.year!=yf) return false;
    if(q){
      const r=residents.find(x=>String(x.apt)===String(t.apt));
      const aptStr=String(t.apt||'').toLowerCase();
      const nameStr=r?((r.firstname||'')+(r.lastname||'')).toLowerCase():'';
      const fmtStr=r?String(r.apt).toLowerCase():'';
      const descStr=(t.desc||'').toLowerCase();
      const subcatStr=(t.subcat||'').toLowerCase();
      if(!aptStr.includes(q)&&!nameStr.includes(q)&&!fmtStr.includes(q)&&!descStr.includes(q)&&!subcatStr.includes(q)) return false;
    }
    return true;
  }).sort((a,b)=>b.id-a.id);
  const body=document.getElementById('income-table-body');
  if(!body)return;
  body.innerHTML=list.map(t=>{
    const r=residents.find(x=>String(x.apt)===String(t.apt));
    return `<tr>
      <td class="dt-muted">${t.date}</td>
      <td><span class="dt-title dt-mono">${r?String(r.apt):'—'}</span></td>
      <td class="dt-text">${esc(t.desc)}</td>
      <td class="text-success dt-mono">${fmtMoney(t.amount)}</td>
      <td class="dt-text">${methodName(t.method)}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Орлого байхгүй</td></tr>';
}
function renderExpenseTable() {
  populateYearFilterOptions('exp-year-filter', 'expense');
  const mf=document.getElementById('tx-month-filter')?.value;
  const yf=document.getElementById('exp-year-filter')?.value;
  const subcatQ=(document.getElementById('exp-subcat-filter')?.value||'').toLowerCase();
  const list=transactions.filter(t=>{
    if(!t||t.type!=='expense') return false;
    if(mf&&t.month!=mf) return false;
    if(yf&&t.year!=yf) return false;
    if(subcatQ&&!(t.subcat||'').toLowerCase().includes(subcatQ)&&!(t.desc||'').toLowerCase().includes(subcatQ)) return false;
    return true;
  }).sort((a,b)=>b.id-a.id);
  const body=document.getElementById('expense-table-body');
  if(!body)return;
  body.innerHTML=list.map(t=>`<tr>
    <td class="dt-muted">${t.date}</td>
    <td class="dt-title">${esc(t.subcat||t.desc)}</td>
    <td class="dt-text">${(t.desc&&t.desc!==t.subcat)?esc(t.desc):''}</td>
    <td class="text-danger dt-mono">${fmtMoney(t.amount)}</td>
  </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Зарлага байхгүй</td></tr>';
}
function calcFeePreview() {
  feeSettings.perSqm=+document.getElementById('fee-per-sqm').value||2500;
  feeSettings.utility=+document.getElementById('fee-utility').value||15000;
  feeSettings.garage=+(document.getElementById('fee-garage')?.value)||25000;
  feeSettings.storageSqm=+(document.getElementById('fee-storage')?.value)||1500;
  const sqm=+(document.getElementById('preview-sqm')?.value)||95;
  const garages=+(document.getElementById('preview-garage')?.value)||0;
  const stSqm=+(document.getElementById('preview-storage-sqm')?.value)||0;
  const base=sqm*feeSettings.perSqm;const util=feeSettings.utility;
  const gar=garages*feeSettings.garage;const stor=stSqm*feeSettings.storageSqm;
  const total=base+util+gar+stor;
  const el=document.getElementById('fee-preview-result');if(!el)return;
  el.innerHTML=`
    <div class="summary-row"><span class="summary-key">Өрхийн СӨХ-ийн төлбөр (${sqm}м²)</span><span class="summary-val">${fmt(base)}</span></div>
    <div class="summary-row"><span class="summary-key">Нэмэлт зардал</span><span class="summary-val">${fmt(util)}</span></div>
    ${gar?`<div class="summary-row"><span class="summary-key">Гаражийн СӨХ-ийн төлбөр (${garages} зогсоол)</span><span class="summary-val">${fmt(gar)}</span></div>`:''}
    ${stor?`<div class="summary-row"><span class="summary-key">Агуулахын СӨХ-ийн төлбөр (${stSqm}м²)</span><span class="summary-val">${fmt(stor)}</span></div>`:''}
    <div class="summary-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
      <span class="summary-key font-bold" style="font-weight:700;color:var(--text)">Нийт СӨХ-ийн төлбөр</span>
      <span class="summary-val text-accent" style="font-size:18px">${fmt(total)}</span></div>`;
}
async function saveFeeSettings(){
  feeSettings.penalty=+document.getElementById('fee-penalty').value||2;
  feeSettings.garage=+(document.getElementById('fee-garage')?.value)||25000;
  feeSettings.storageSqm=+(document.getElementById('fee-storage')?.value)||1500;
  feeSettings.fundAmount=+(document.getElementById('fee-fund-amount')?.value)||5000000;
  feeSettings.pendingMonths=+(document.getElementById('fee-pending-months')?.value)||1;
  feeSettings.overdueMonths=+(document.getElementById('fee-overdue-months')?.value)||2;
  feeSettings.riskMonths=+(document.getElementById('fee-risk-months')?.value)||12;
  const ok = await db_saveSettings('fee', feeSettings);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — консол шалгана уу','error'); return; }
  toast('СӨХ-ийн төлбөрийн тохиргоо хадгалагдлаа ✓','success');
}
// ============================================================
// PAYMENTS
// ============================================================
// ============================================================
// ТӨЛБӨР — 4 tab тус бүр тусдаа функц
// ============================================================

function _payRow(r, bgColor, textColor, statusText, showBtn) {
  const fee = calcFee(residentSqm(r));
  return `<tr style="cursor:pointer" onclick="openResidentDetail(${r.id})">
    <td><span class="dt-title dt-mono">${String(r.apt)}</span></td>
    <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:${bgColor};color:${textColor}">${(r.firstname||r.owner||"?")[0]}</div><span class="dt-title">${esc((r.firstname||"")+" "+(r.lastname||""))}</span></div></td>
    <td class="dt-text dt-mono">${fmtMoney(fee)}</td>
    <td class="dt-text">${CUR_MONTH}-р сар</td>
    <td class="dt-muted">${CUR_YEAR}/${CUR_MONTH_STR}/25</td>
    <td class="dt-muted">—</td>
    <td style="color:${textColor};font-size:12px;font-weight:600;white-space:nowrap">${statusText}</td>
    <td>${showBtn?`<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();quickPayForApt(${r.id})">Бүртгэх</button>`:'<span class="dt-muted">—</span>'}</td>
  </tr>`;
}
function _bizMatchesFilter(b, filter) {
  if(!filter) return true;
  const q = filter.toLowerCase();
  return (b.name||'').toLowerCase().includes(q) || (b.regno||'').toLowerCase().includes(q);
}
function monthsUnpaidForBusiness(b) {
  const relevantTx = transactions.filter(t=>t&&t.businessId===b.id&&t.type==='income').sort((a,b2)=>(b2.year*100+b2.month)-(a.year*100+a.month));
  const lastPay = relevantTx[0];
  if(!lastPay) return 999;
  return Math.max(0, (CUR_YEAR - lastPay.year)*12 + (CUR_MONTH - lastPay.month));
}
function _bizThresholds(b) {
  const s = b.type==='tenant' ? rentSettings : feeSettings;
  return {pending: s.pendingMonths||1, overdue: s.overdueMonths||2, risk: s.riskMonths||12};
}
function _payRowBiz(b, bgColor, textColor, statusText, showBtn) {
  return `<tr style="cursor:pointer" onclick="openBusinessDetail(${b.id})">
    <td><span class="dt-title dt-mono">АА</span></td>
    <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:${bgColor};color:${textColor}">${(b.name||"?")[0]}</div><span class="dt-title">${esc(b.name)||''} <span class="dt-muted" style="font-size:10px">(Аж ахуй)</span></span></div></td>
    <td class="dt-text dt-mono">—</td>
    <td class="dt-text">${CUR_MONTH}-р сар</td>
    <td class="dt-muted">${CUR_YEAR}/${CUR_MONTH_STR}/25</td>
    <td class="dt-muted">—</td>
    <td style="color:${textColor};font-size:12px;font-weight:600;white-space:nowrap">${statusText}</td>
    <td>${showBtn?`<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openBizPayModal(businesses.find(x=>x.id===${b.id}))">Бүртгэх</button>`:'<span class="dt-muted">—</span>'}</td>
  </tr>`;
}
function _renderPayCompleted(body, filter='') {
  let paidTx = transactions.filter(t=>t&&t.type==='income').sort((a,b)=>b.id-a.id);
  if(filter) {
    const q = filter.toLowerCase();
    paidTx = paidTx.filter(t=>{
      const r = residents.find(x=>String(x.apt)===String(t.apt));
      const b = businesses.find(x=>x.id===t.businessId);
      return (r?String(r.apt):String(t.apt||'')).toLowerCase().includes(q)
        || (r?.firstname||'').toLowerCase().includes(q)
        || (r?.lastname||'').toLowerCase().includes(q)
        || (b?.name||'').toLowerCase().includes(q);
    });
  }
  body.innerHTML = paidTx.map(t=>{
    const r = residents.find(x=>String(x.apt)===String(t.apt));
    const b = !r ? businesses.find(x=>x.id===t.businessId) : null;
    if(b) {
      return `<tr style="cursor:pointer" onclick="openBusinessDetail(${b.id})">
        <td><span class="dt-title dt-mono">АА</span></td>
        <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:rgba(139,92,246,0.18);color:#8B5CF6">${(b.name||"?")[0]}</div><span class="dt-title">${esc(b.name)} <span class="dt-muted" style="font-size:10px">(Аж ахуй)</span></span></div></td>
        <td class="dt-text dt-mono">${fmtMoney(t.amount)}</td>
        <td class="dt-text">${t.month}-р сар</td>
        <td class="dt-muted">${t.date}</td>
        <td class="dt-text">${methodName(t.method)}</td>
        <td style="color:var(--success);font-size:12px;font-weight:600;white-space:nowrap">Төлсөн</td>
        <td class="dt-muted">—</td>
      </tr>`;
    }
    return `<tr style="cursor:pointer" onclick="if(${r?r.id:0})openResidentDetail(${r?r.id:0})">
      <td><span class="dt-title dt-mono">${r?String(r.apt):String(t.apt||'—')}</span></td>
      <td>${r?`<div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:rgba(59,130,246,0.18);color:#3B82F6">${(r.firstname||"?")[0]}</div><span class="dt-title">${esc(((r.firstname||"")+" "+(r.lastname||"")).trim())||"—"}</span></div>`:'<span class="dt-muted">—</span>'}</td>
      <td class="dt-text dt-mono">${fmtMoney(t.amount)}</td>
      <td class="dt-text">${t.month}-р сар</td>
      <td class="dt-muted">${t.date}</td>
      <td class="dt-text">${methodName(t.method)}</td>
      <td style="color:var(--success);font-size:12px;font-weight:600;white-space:nowrap">Төлсөн</td>
      <td class="dt-muted">—</td>
    </tr>`;
  }).join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Төлөгдсөн гүйлгээ байхгүй</td></tr>';
}
function _renderPayPending(body, paidAptIds, filter='') {
  const overdueThreshold = feeSettings.overdueMonths || 2;
  const pendingThreshold = feeSettings.pendingMonths || 1;
  const list = residents.filter(r=>{
    if(!r || paidAptIds.map(String).includes(String(r.apt))) return false;
    if(!_residentMatchesFilter(r, filter)) return false;
    const mu = monthsUnpaidForResident(r);
    return mu >= pendingThreshold && mu < overdueThreshold;
  });
  const paidBizIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='business'&&t.businessId&&t.month===CUR_MONTH).map(t=>t.businessId);
  const bizList = businesses.filter(b=>{
    if(!b || paidBizIds.includes(b.id)) return false;
    if(!_bizMatchesFilter(b, filter)) return false;
    const th = _bizThresholds(b);
    const mu = monthsUnpaidForBusiness(b);
    return mu >= th.pending && mu < th.overdue;
  });
  const rows = list.map(r=>_payRow(r,'rgba(245,158,11,0.15)','var(--warning)','Хүлээлттэй',true))
    .concat(bizList.map(b=>_payRowBiz(b,'rgba(245,158,11,0.15)','var(--warning)','Хүлээлттэй',true)));
  body.innerHTML = rows.join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Хүлээлттэй байхгүй</td></tr>';
}
function _renderPayOverdue(body, paidAptIds, filter='') {
  const overdueThreshold = feeSettings.overdueMonths || 2;
  const riskThreshold = feeSettings.riskMonths || 12;
  const list = residents.filter(r=>{
    if(!r || paidAptIds.map(String).includes(String(r.apt))) return false;
    if(!_residentMatchesFilter(r, filter)) return false;
    const mu = monthsUnpaidForResident(r);
    return mu >= overdueThreshold && mu < riskThreshold;
  });
  const paidBizIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='business'&&t.businessId&&t.month===CUR_MONTH).map(t=>t.businessId);
  const bizList = businesses.filter(b=>{
    if(!b || paidBizIds.includes(b.id)) return false;
    if(!_bizMatchesFilter(b, filter)) return false;
    const th = _bizThresholds(b);
    const mu = monthsUnpaidForBusiness(b);
    return mu >= th.overdue && mu < th.risk;
  });
  const rows = list.map(r=>_payRow(r,'rgba(239,68,68,0.15)','var(--danger)','Хэтэрсэн',true))
    .concat(bizList.map(b=>_payRowBiz(b,'rgba(239,68,68,0.15)','var(--danger)','Хэтэрсэн',true)));
  body.innerHTML = rows.join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Хугацаа хэтэрсэн байхгүй</td></tr>';
}
function _renderPayRisk(body, filter='') {
  const riskThreshold = feeSettings.riskMonths || 12;
  const riskResidents = residents.filter(r=>r && monthsUnpaidForResident(r) >= riskThreshold && _residentMatchesFilter(r, filter));
  const riskBiz = businesses.filter(b=>{
    if(!b || !_bizMatchesFilter(b, filter)) return false;
    return monthsUnpaidForBusiness(b) >= _bizThresholds(b).risk;
  });
  const residentRows = riskResidents.map(r=>{
    const fee = calcFee(residentSqm(r));
    const lastPay = transactions.filter(t=>t&&String(t.apt)===String(r.apt)&&t.type==='income'&&t.category==='resident').sort((a,b)=>(b.year*100+b.month)-(a.year*100+a.month))[0];
    const lastStr = lastPay ? `${lastPay.year}/${String(lastPay.month).padStart(2,'0')}` : 'Огт төлөөгүй';
    return `<tr style="cursor:pointer" onclick="openResidentDetail(${r.id})">
      <td><span class="dt-title dt-mono">${String(r.apt)}</span></td>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:rgba(239,68,68,0.2);color:#EF4444">${(r.firstname||"?")[0]}</div><span class="dt-title">${esc(((r.firstname||"")+" "+(r.lastname||"")).trim())||"—"}</span></div></td>
      <td class="dt-text dt-mono" style="color:var(--danger)">${fmtMoney(fee)}</td>
      <td class="dt-text" style="color:var(--danger)">${monthsUnpaidForResident(r)}+ сар</td>
      <td class="dt-muted">${lastStr}</td>
      <td class="dt-muted">—</td>
      <td style="color:var(--danger);font-size:12px;font-weight:600;white-space:nowrap">Эрсдэлтэй</td>
      <td><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();quickPayForApt(${r.id})">Бүртгэх</button></td>
    </tr>`;
  });
  const bizRows = riskBiz.map(b=>{
    const lastPay = transactions.filter(t=>t&&t.businessId===b.id&&t.type==='income').sort((a,b2)=>(b2.year*100+b2.month)-(a.year*100+a.month))[0];
    const lastStr = lastPay ? `${lastPay.year}/${String(lastPay.month).padStart(2,'0')}` : 'Огт төлөөгүй';
    return `<tr style="cursor:pointer" onclick="openBusinessDetail(${b.id})">
      <td><span class="dt-title dt-mono">АА</span></td>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:24px;height:24px;font-size:10px;background:rgba(239,68,68,0.2);color:#EF4444">${(b.name||"?")[0]}</div><span class="dt-title">${esc(b.name)} <span class="dt-muted" style="font-size:10px">(Аж ахуй)</span></span></div></td>
      <td class="dt-text dt-mono" style="color:var(--danger)">—</td>
      <td class="dt-text" style="color:var(--danger)">${monthsUnpaidForBusiness(b)}+ сар</td>
      <td class="dt-muted">${lastStr}</td>
      <td class="dt-muted">—</td>
      <td style="color:var(--danger);font-size:12px;font-weight:600;white-space:nowrap">Эрсдэлтэй</td>
      <td><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openBizPayModal(businesses.find(x=>x.id===${b.id}))">Бүртгэх</button></td>
    </tr>`;
  });
  body.innerHTML = residentRows.concat(bizRows).join('')||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Эрсдэлтэй байхгүй</td></tr>';
}
let currentPayTab = 'completed';
function renderPaymentsTable(tab='completed') {
  currentPayTab = tab;
  const body = document.getElementById('payments-table-body');
  const filter = document.getElementById('payments-search')?.value || '';
  const paidAptIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='resident'&&t.month===CUR_MONTH).map(t=>String(t.apt));
  if(tab==='completed') _renderPayCompleted(body, filter);
  else if(tab==='pending') _renderPayPending(body, paidAptIds, filter);
  else if(tab==='overdue') _renderPayOverdue(body, paidAptIds, filter);
  else if(tab==='risk') _renderPayRisk(body, filter);
}
function filterPayments() {
  renderPaymentsTable(currentPayTab);
}
function switchPayTab(tab,el){
  document.querySelectorAll('#page-payments .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderPaymentsTable(tab);
}
function openPayModal() {
  // Normal горим руу reset
  document.getElementById('pay-resident-info').style.display='none';
  document.getElementById('pay-select-section').style.display='block';
  document.getElementById('pay-building-select').value='';
  document.getElementById('pay-apt-select').innerHTML='<option value="">— Эхлээд байр сонгох —</option>';
  document.getElementById('pay-apt-select').disabled=true;
  document.getElementById('pay-fee-breakdown').style.display='none';
  document.getElementById('pay-overdue-warning').style.display='none';
  document.getElementById('pay-amount').value='';
  document.getElementById('pay-ref').value='';
  document.getElementById('qpay-apt-hint').textContent='байр-тоот';
  openModal('modal-payment');
}
function onPayBuildingChange() {
  const bId=+document.getElementById('pay-building-select').value;
  const aptSel=document.getElementById('pay-apt-select');
  aptSel.innerHTML='<option value="">— Тоот сонгох —</option>';
  document.getElementById('pay-fee-breakdown').style.display='none';
  document.getElementById('pay-overdue-warning').style.display='none';
  document.getElementById('pay-amount').value='';
  if(!bId){aptSel.disabled=true;return;}
  const bldRes=residents.filter(r=>r&&r.building===bId);
  if(bldRes.length){
    bldRes.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=String(r.apt)+' — '+(r.firstname||r.owner||'')+(r.lastname?' '+r.lastname:'');aptSel.appendChild(o);});
    aptSel.disabled=false;
  } else {
    aptSel.innerHTML='<option value="">Бүртгэлтэй өмчлөгч байхгүй</option>';aptSel.disabled=true;
  }
}
function onPayAptChange() {
  const resId=+document.getElementById('pay-apt-select').value;
  if(!resId){document.getElementById('pay-fee-breakdown').style.display='none';document.getElementById('pay-overdue-warning').style.display='none';return;}
  const r=residents.find(x=>x.id===resId);if(!r)return;
  const sqm=residentSqm(r);
  const base=sqm*(feeSettings.perSqm||2500);
  const util=feeSettings.utility||15000;
  const garCount=(r.parkings||[]).length;
  const storSqm=(r.storages||[]).reduce((s,x)=>s+(+x.sqm||0),0);
  const gar=garCount*(feeSettings.garage||25000);
  const stor=storSqm*(feeSettings.storageSqm||1500);
  const total=base+util+gar+stor;
  const aptCode=String(r.apt);
  const bd=document.getElementById('pay-fee-breakdown');
  bd.style.display='block';
  bd.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">📋 ${aptCode} — СӨХ-ийн төлбөрийн задаргаа</div>
    <div class="summary-row"><span class="summary-key">Өрхийн төлбөр (${sqm}м²)</span><span class="summary-val font-mono">${fmt(base)}</span></div>
    <div class="summary-row"><span class="summary-key">Нэмэлт зардал</span><span class="summary-val font-mono">${fmt(util)}</span></div>
    ${gar?`<div class="summary-row"><span class="summary-key">Гаражийн төлбөр (${garCount} зогсоол)</span><span class="summary-val font-mono">${fmt(gar)}</span></div>`:''}
    ${stor?`<div class="summary-row"><span class="summary-key">Агуулахын төлбөр (${storSqm}м²)</span><span class="summary-val font-mono">${fmt(stor)}</span></div>`:''}
    <div class="summary-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px">
      <span class="summary-key" style="font-weight:700;color:var(--text)">Нийт дүн</span>
      <span class="summary-val text-accent" style="font-size:16px">${fmt(total)}</span></div>`;
  document.getElementById('pay-amount').value=total;
  document.getElementById('qpay-apt-hint').textContent=aptCode;
  const hasPrev=transactions.some(t=>String(t.apt)===String(r.apt)&&t.type==='income'&&t.category==='resident'&&t.month===CUR_MONTH);
  const ow=document.getElementById('pay-overdue-warning');
  if(hasPrev){ow.style.display='block';ow.innerHTML='⚠️ Энэ айл 1-р сарын СӨХ-ийн төлбөрийг аль хэдийн төлсөн байна!';}
  else{ow.style.display='none';}
}
function quickPayForApt(resId) {
  const r=residents.find(x=>x.id===resId);if(!r)return;
  openPayModal();
  // Сууц өмчлөгчийн мэдээлэл харуулах горим
  document.getElementById('pay-resident-info').style.display='block';
  document.getElementById('pay-select-section').style.display='none';
  document.getElementById('pay-res-apt').textContent=String(r.apt);
  document.getElementById('pay-res-name').textContent=((r.firstname||'')+" "+(r.lastname||'')).trim()||r.owner||'—';
  // Сонгосон байдлаар тохируулах (savePayment-д хэрэгтэй)
  document.getElementById('pay-building-select').value=r.building;
  onPayBuildingChange();
  setTimeout(()=>{document.getElementById('pay-apt-select').value=resId;onPayAptChange();},60);
}
function selectPayMethod(el,method){
  document.querySelectorAll('.pay-method-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('pay-method').value=method;
  document.getElementById('qpay-info').style.display=method==='qpay'?'block':'none';
}
async function savePayment() {
  // Quick pay горимд pay-apt-select нуугдсан тул selectedAptForDetail ашиглана
  const selectEl = document.getElementById('pay-apt-select');
  const isQuickMode = document.getElementById('pay-resident-info').style.display !== 'none';
  let resId = isQuickMode
    ? (selectedAptForDetail?.id || 0)
    : +selectEl.value;
  if(!resId){toast('Тоот сонгоно уу','error');return;}
  const r=residents.find(x=>x.id===resId);
  if(!r){toast('Сууц өмчлөгч олдсонгүй','error');return;}
  const amount=+document.getElementById('pay-amount').value;
  const method=document.getElementById('pay-method').value;
  const ref=document.getElementById('pay-ref').value;
  const month=+document.getElementById('pay-month').value;
  if(!amount){toast('Дүн оруулна уу','error');return;}
  const data={
    apt:r.apt, aptId:r.id,
    description:'СӨХ-ийн төлбөр', subcat:'Сарын хураамж',
    type:'income', amount, method, ref,
    month, year:CUR_YEAR,
    date:todayStr(), status:'completed', category:'resident'
  };
  const ok = await db_saveTransaction(data);
  if(!ok) { toast('Бүртгэхэд алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  transactions.push({id:nextId++,dbId:data.id,...data});
  // Нягтлан бодох бүртгэлийн журнал бичилт (нэмэлт — гол гүйлгээг зогсоохгүй)
  if (typeof accountingRecordResidentPayment === 'function') {
    accountingRecordResidentPayment(r.apt, amount, todayStr(), `${r.apt} тоот — ${month}-р сарын хураамж`)
      .then(res => { if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error); })
      .catch(e => console.warn('Journal entry үүсгэхэд алдаа:', e));
  }
  closeModal('modal-payment');
  renderResidents();
  renderPaymentsTable('completed');
  if(document.getElementById('page-apartments')?.classList.contains('active')){
    renderAptGrid(selectedBuilding);
  }
  toast(`${String(r.apt)} ${month}-р сарын төлбөр бүртгэгдлээ ✓`,'success');
}
function loadExpCats(type){
  const catSel=document.getElementById('exp-category');
  catSel.innerHTML='';
  if(type==='income'){
    INCOME_CATS.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;catSel.appendChild(o);});
  } else {
    Object.entries(EXPENSE_CATS).forEach(([group,items])=>{
      const og=document.createElement('optgroup');og.label=group;
      items.forEach(item=>{const o=document.createElement('option');o.value=item;o.textContent=item;og.appendChild(o);});
      catSel.appendChild(og);
    });
  }
}
function openAddExpense(){
  document.getElementById('modal-expense-title').textContent='Зарлага нэмэх';
  document.getElementById('exp-type').value='expense';
  loadExpCats('expense');
  document.getElementById('exp-amount').value='';
  document.getElementById('exp-desc').value='';
  document.getElementById('exp-date').value=todayStr();
  populateClienteleSelect();
  document.getElementById('exp-clientele-group').style.display='block';
  document.getElementById('exp-clientele').value='';
  openModal('modal-expense');
}
function openAddIncome(){
  document.getElementById('modal-expense-title').textContent='Орлого нэмэх';
  document.getElementById('exp-type').value='income';
  loadExpCats('income');
  document.getElementById('exp-amount').value='';
  document.getElementById('exp-desc').value='';
  document.getElementById('exp-date').value=todayStr();
  document.getElementById('exp-clientele-group').style.display='none';
  openModal('modal-expense');
}
function populateClienteleSelect() {
  const sel = document.getElementById('exp-clientele');
  if(!sel) return;
  sel.innerHTML = '<option value="">— Сонгохгүй —</option>' +
    clientele.map(c=>`<option value="${c.id}">${esc(c.legalName)}</option>`).join('');
}
async function saveExpense(){
  const amount=+document.getElementById('exp-amount').value;
  const subcat=document.getElementById('exp-category').value;
  const desc=document.getElementById('exp-desc').value.trim()||subcat;
  const type=document.getElementById('exp-type').value;
  const dateRaw=document.getElementById('exp-date').value.trim();
  if(!amount){toast('Дүн оруулна уу','error');return;}
  const parts=dateRaw.replace(/\//g,'-').split('-');
  const month=+parts[1]||1; const year=+parts[0]||2026;
  const dateOut=parts[0]+'/'+String(parts[1]||'01').padStart(2,'0')+'/'+String(parts[2]||'01').padStart(2,'0');
  const clienteleIdRaw = type==='expense' ? document.getElementById('exp-clientele')?.value : '';
  const newTx = {id:nextId++,apt:null,desc,subcat,type,amount,method:'bank',ref:'',month,year,date:dateOut,status:'completed',category:type,clienteleId: clienteleIdRaw?+clienteleIdRaw:null};
  const ok = await db_saveTransaction(newTx);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  transactions.push(newTx);
  // Нягтлан бодох бүртгэлийн журнал бичилт (нэмэлт — гол гүйлгээг зогсоохгүй)
  if (typeof accountingRecordExpense === 'function') {
    const jeDate = parts[0]+'-'+String(parts[1]||'01').padStart(2,'0')+'-'+String(parts[2]||'01').padStart(2,'0');
    const jePromise = type==='expense'
      ? accountingRecordExpense(subcat, amount, jeDate, desc)
      : accountingRecordIncome(subcat, amount, jeDate, desc);
    jePromise
      .then(res => { if (!res.success) console.warn('Journal entry үүсгэхэд алдаа:', res.error); })
      .catch(e => console.warn('Journal entry үүсгэхэд алдаа:', e));
  }
  closeModal('modal-expense');
  if(type==='expense')renderExpenseTable();else renderIncomeTable();
  renderClientele();
  toast((type==='expense'?'Зарлага':'Орлого')+' нэмэгдлээ ✓','success');
}
function quickPay() {
  if(!selectedAptForDetail){closeModal('modal-apt-detail');return;}
  closeModal('modal-apt-detail');
  quickPayForApt(selectedAptForDetail.id);
}
