// gov-reports.js — "СӨХ тохиргоо" + "Албан тайлан" (НД-7, НД-8) модуль.
// ⚠️ ЭНЭ ФАЙЛ ШИНЭ (2026-07-13) — цаашид ХХОАТ, ААНОАТ, НӨАТ, Санхүүгийн тайлан
// нэмэгдэхэд ЭНЭ ФАЙЛД нэмнэ. Ажлын хуваарь:
//   - СӨХ тохиргоо (org_profile): settings хүснэгэлд key='org_profile' jsonb-аар хадгална
//   - НД-7/НД-8: аль хэдийн ПОСТ хийгдсэн (sendMonthlyInvoice/цалингийн) journal_entries-ээс
//     уншиж угсарна — ЛАВ ДАХИН ТООЦООЛОХГҮЙ, зөвхөн батлагдсан журналын дүнг харуулна.
// ⚠️ Энэ бол анхны хувилбар — албан ёсны PDF/Excel маягттай ПИКСЕЛИЙН нарийвчлалтай
// тулгаагүй, зөвхөн МЭДЭЭЛЛИЙН БҮТЭЦ (баганууд, ангилал) нь зөв байхаар зохион бүтээв.
// Бодит бөглөсөн жишээтэй тулгаад, байрлалыг нарийвчлан тохируулах шаардлагатай.

// ============================================================
// СӨХ ТОХИРГОО (org_profile)
// ============================================================
let _sokhOrgProfile = null;

async function renderSokhSettingsPage() {
  const { data, error } = await sb.from('settings').select('value').eq('key', 'org_profile').maybeSingle();
  if (error) { console.error('org_profile load error:', error.message); }
  _sokhOrgProfile = (data && data.value) || { bank_accounts: [] };

  const p = _sokhOrgProfile;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setVal('sokh-org-name', p.org_name);
  setVal('sokh-reg-number', p.reg_number);
  setVal('sokh-activity-type', p.activity_type);
  setVal('sokh-nd-reg-number', p.nd_reg_number);
  setVal('sokh-province', p.province);
  setVal('sokh-district', p.district);
  setVal('sokh-khoroo', p.khoroo);
  setVal('sokh-street', p.street);
  setVal('sokh-building', p.building);
  setVal('sokh-gate-number', p.gate_number);
  setVal('sokh-landline', p.landline);
  setVal('sokh-mobile', p.mobile);
  setVal('sokh-fax', p.fax);
  setVal('sokh-email', p.email);
  setVal('sokh-website', p.website);
  document.getElementById('sokh-director-name').value = _findEmployeeNameByPosition('Гүйцэтгэх захирал');
  document.getElementById('sokh-accountant-name').value = _findEmployeeNameByPosition('Нягтлан бодогч');
  if (p.liability_type_code) document.getElementById('sokh-liability-type').value = p.liability_type_code;
  if (p.ownership_type_code) document.getElementById('sokh-ownership-type').value = p.ownership_type_code;

  renderSokhBankAccountsList(p.bank_accounts || []);
}

function renderSokhBankAccountsList(accounts) {
  const wrap = document.getElementById('sokh-bank-accounts-list');
  if (!wrap) return;
  if (!accounts.length) accounts = [{ bank_name: '', account_number: '' }];
  wrap.innerHTML = accounts.map((a, i) => `
    <div class="flex gap-8 mb-8" data-bank-row="${i}">
      <input type="text" placeholder="Банкны нэр" value="${esc(a.bank_name || '')}" style="flex:1" onchange="_sokhBankFieldChanged(${i},'bank_name',this.value)">
      <input type="text" placeholder="Дансны дугаар" value="${esc(a.account_number || '')}" style="flex:1" onchange="_sokhBankFieldChanged(${i},'account_number',this.value)">
      <button class="btn btn-ghost btn-sm" onclick="removeSokhBankAccountRow(${i})" title="Устгах">✕</button>
    </div>`).join('');
  wrap._accounts = accounts;
}
function _sokhBankFieldChanged(idx, field, value) {
  const wrap = document.getElementById('sokh-bank-accounts-list');
  if (wrap._accounts[idx]) wrap._accounts[idx][field] = value;
}
function addSokhBankAccountRow() {
  const wrap = document.getElementById('sokh-bank-accounts-list');
  const accounts = wrap._accounts || [];
  accounts.push({ bank_name: '', account_number: '' });
  renderSokhBankAccountsList(accounts);
}
function removeSokhBankAccountRow(idx) {
  const wrap = document.getElementById('sokh-bank-accounts-list');
  const accounts = (wrap._accounts || []).filter((_, i) => i !== idx);
  renderSokhBankAccountsList(accounts);
}

async function saveSokhSettings() {
  if (!canWrite('gov_reports') && currentProfile?.role !== 'admin') {
    toast('Танд энэ тохиргоог хадгалах эрх байхгүй байна', 'error'); return;
  }
  const getVal = id => document.getElementById(id)?.value.trim() || '';
  const wrap = document.getElementById('sokh-bank-accounts-list');
  const value = {
    org_name: getVal('sokh-org-name'), reg_number: getVal('sokh-reg-number'),
    activity_type: getVal('sokh-activity-type'), nd_reg_number: getVal('sokh-nd-reg-number'),
    province: getVal('sokh-province'), district: getVal('sokh-district'), khoroo: getVal('sokh-khoroo'),
    street: getVal('sokh-street'), building: getVal('sokh-building'), gate_number: getVal('sokh-gate-number'),
    landline: getVal('sokh-landline'), mobile: getVal('sokh-mobile'), fax: getVal('sokh-fax'),
    email: getVal('sokh-email'), website: getVal('sokh-website'),
    liability_type_code: document.getElementById('sokh-liability-type').value,
    ownership_type_code: document.getElementById('sokh-ownership-type').value,
    bank_accounts: (wrap._accounts || []).filter(a => a.bank_name || a.account_number),
  };
  const { error } = await sb.from('settings').upsert({ key: 'org_profile', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  _sokhOrgProfile = value;
  toast('СӨХ-ийн тохиргоо хадгалагдлаа ✓', 'success');
}

// ============================================================
// АЛБАН ТАЙЛАН (НД-7 / НД-8)
// ============================================================
// 70xx (болон бусад expense) данснаас salary_components.nd7_category руу
// хөрвүүлэх — ирээдүйд шинэ нэмэгдэл нэмэгдэхэд код өөрчлөх шаардлагагүй.
let _nd7CategoryByAccount = null;
async function _ensureNd7CategoryMap() {
  if (_nd7CategoryByAccount) return _nd7CategoryByAccount;
  const { data } = await sb.from('salary_components').select('expense_account, nd7_category');
  _nd7CategoryByAccount = { '7010': 'base' };
  (data || []).forEach(c => { if (c.expense_account) _nd7CategoryByAccount[c.expense_account] = c.nd7_category || 'other_addition'; });
  return _nd7CategoryByAccount;
}

// Тухайн сард аль хэдийн ПОСТ хийгдсэн (батлагдсан) цалингийн журналыг уншиж,
// ажилтан тус бүрээр нь account_code-оор нь бүлэглэнэ. ЛАВ дахин тооцоолохгүй.
async function _fetchPayrollJournalForMonth(yearMonth) {
  const { data, error } = await sb
    .from('journal_entries')
    .select('id, journal_lines(account_code, debit, credit, party)')
    .ilike('reference', `payroll:employee:%:${yearMonth}`);
  if (error) { console.error('payroll journal load error:', error.message); return {}; }
  const byEmployee = {}; // dbId -> {byAccount: {code:{debit,credit}}}
  (data || []).forEach(entry => {
    (entry.journal_lines || []).forEach(l => {
      const m = /^employee:(\d+)$/.exec(l.party || '');
      if (!m) return;
      const dbId = +m[1];
      byEmployee[dbId] = byEmployee[dbId] || {};
      byEmployee[dbId][l.account_code] = { debit: +l.debit || 0, credit: +l.credit || 0 };
    });
  });
  return byEmployee;
}

function _govReportYearMonth() {
  const y = document.getElementById('gov-report-year').value;
  const m = document.getElementById('gov-report-month').value;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function switchGovReportTab(name, el) {
  document.querySelectorAll('#gov-reports-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('gov-report-nd7').style.display = name === 'nd7' ? '' : 'none';
  document.getElementById('gov-report-nd8').style.display = name === 'nd8' ? '' : 'none';
}

async function renderGovReportsPage() {
  const yearEl = document.getElementById('gov-report-year');
  const monthEl = document.getElementById('gov-report-month');
  if (!yearEl.value) yearEl.value = new Date().getFullYear();
  if (!monthEl.options.length) {
    monthEl.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}-р сар</option>`).join('');
    monthEl.value = new Date().getMonth() + 1;
  }
  await renderSokhSettingsPage(); // org_profile кэшийг шинэчилнэ (тайланд шаардлагатай)
  await Promise.all([_renderND7(), _renderND8()]);
}

const INSURED_TYPE_LABELS = {
  1: 'Нийгмийн болон эрүүл мэндийн даатгалд хамрагдагчид',
  2: 'Зөвхөн эрүүл мэндийн даатгалд хамрагдагчид',
  3: 'Хүүхдээ асарч буй чөлөөтэй эх, дайчлагдагчид, гэрээгээр суралцагчид, цэргийн албан хаагчид',
  4: 'Тэтгэвэр тогтоолгосон ажиллагчид',
  5: 'Бусад',
};

const LIABILITY_TYPES = [
  { code: '11', label: 'Хувьцаат компани' }, { code: '12', label: 'Хязгаарлагдмал хариуцлагатай компани' },
  { code: '13', label: 'Бүх гишүүд нь хариуцлагатай нөхөрлөл' }, { code: '30', label: 'Зарим гишүүд нь хариуцлагатай нөхөрлөл' },
  { code: '31', label: 'Хоршоо' }, { code: 'other', label: 'Бусад' },
];
const OWNERSHIP_TYPES = [
  { code: '10', label: 'Төрийн өмчийн' }, { code: '21', label: 'Орон нутгийн өмчийн' },
  { code: '41', label: 'Хувийн' }, { code: '40', label: 'Хамтарсан' },
  { code: '60', label: 'Гадаадтай хамтарсан' }, { code: '61', label: 'Гадаад улсын' },
];

function _gfFieldRow(label, value) {
  return `<div class="gf-field-row"><div class="gf-field-label">${esc(label)}</div><div class="gf-field-value">${esc(value) || ''}</div></div>`;
}
function _gfCheckboxTable(items, selectedCode) {
  return `<table class="gov-form-table gf-checkbox-table">${items.map(it => `
    <tr style="${it.code === selectedCode ? 'font-weight:700;background:#eef' : ''}">
      <td>${it.code === selectedCode ? '● ' : '○ '}${esc(it.label)}</td>
      <td class="gf-code">${esc(it.code)}</td>
    </tr>`).join('')}</table>`;
}

async function _renderND7() {
  const el = document.getElementById('gov-report-nd7');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const yearMonth = _govReportYearMonth();
  const [year, month] = yearMonth.split('-');
  const [catMap, journalByEmp] = await Promise.all([_ensureNd7CategoryMap(), _fetchPayrollJournalForMonth(yearMonth)]);
  const p = _sokhOrgProfile || {};

  const cols = [1, 2, 3, 4, 5];
  const rowKeys = ['base', 'bonus', 'other_addition', 'annual_leave', 'meal_transport', 'fuel_coal'];
  const rowLabels = {
    base: 'Үндсэн ба нэмэгдэл цалин', bonus: 'Шагналт цалин', other_addition: 'Бусад нэмэгдэл цалин',
    annual_leave: 'Ээлжийн амралтын олговор', meal_transport: 'Хоол, унааны хөлс', fuel_coal: 'Түлээ, нүүрсний үнийн хөнгөлөлт',
  };
  const grid = {}; rowKeys.forEach(k => { grid[k] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; });
  const insuredCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let mongolCount = 0, foreignCount = 0;
  let ndshEmployeeTotal = 0, ndshEmployerTotal = 0;

  const activeEmployees = employees.filter(e => e.status === 'active' || journalByEmp[e.dbId]);
  activeEmployees.forEach(e => {
    const col = e.insuredType || 1;
    insuredCount[col] = (insuredCount[col] || 0) + 1;
    if (e.nationality === 'foreign') foreignCount++; else mongolCount++;
    const byAccount = journalByEmp[e.dbId] || {};
    Object.entries(byAccount).forEach(([code, amt]) => {
      const cat = catMap[code];
      if (cat && rowKeys.includes(cat)) grid[cat][col] = +(grid[cat][col] + (amt.debit || 0)).toFixed(2);
    });
    const employerNdsh = byAccount['7020']?.debit || 0;
    const totalNdsh = byAccount['3030']?.credit || 0;
    ndshEmployerTotal += employerNdsh;
    ndshEmployeeTotal += Math.max(totalNdsh - employerNdsh, 0);
  });

  const totalsByRow = {}; rowKeys.forEach(k => { totalsByRow[k] = cols.reduce((s, c) => s + grid[k][c], 0); });
  const grandTotal = rowKeys.reduce((s, k) => s + totalsByRow[k], 0);
  const bankRows = (p.bank_accounts && p.bank_accounts.length ? p.bank_accounts : [{}, {}, {}]);

  el.innerHTML = `
    <div class="gov-form-page">
      <div class="gf-topline">
        <div></div>
        <div style="text-align:right;max-width:340px">
          <div style="font-weight:700">З-НД-7</div>
          <div style="font-size:8px;color:#444">Үндэсний Статистикийн хорооны даргын 2020 оны 12 дугаар сарын 28-ны өдрийн А/73 дугаар тушаалаар зөвшөөрснөөр, Сангийн сайд, Хөдөлмөр, нийгмийн хамгааллын сайдын хамтарсан тушаалаар батлав.</div>
        </div>
      </div>
      <div class="gf-title">${esc(p.org_name) || '.......................'}-НИЙ НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ ТӨЛӨЛТИЙН ${year} ОНЫ ${+month}-Р САРЫН ТАЙЛАН</div>

      <div class="gf-section-title">А. АЖИЛ ОЛГОГЧИЙН МЭДЭЭЛЭЛ</div>
      <div style="margin-bottom:8px">Ажил олгогчийн нийгмийн даатгалын бүртгэлийн дугаар: <strong>${esc(p.nd_reg_number) || '.......................'}</strong></div>

      <div class="gf-subsection">А.1 Нэрийн хэсэг</div>
      ${_gfFieldRow('Байгууллагын регистрийн дугаар', p.reg_number)}
      ${_gfFieldRow('Ажил олгогчийн нэр', p.org_name)}
      ${_gfFieldRow('Үйл ажиллагааны чиглэл', p.activity_type)}

      <div class="gf-subsection">А.2 Хаягийн хэсэг</div>
      ${_gfFieldRow('Аймаг, нийслэлийн нэр', p.province)}
      ${_gfFieldRow('Сум, дүүргийн нэр', p.district)}
      ${_gfFieldRow('Баг, хорооны нэр', p.khoroo)}
      ${_gfFieldRow('Гудамж, хороолол', p.street)}
      ${_gfFieldRow('Байшин, байр', p.building)}
      ${_gfFieldRow('Хашаа, хаалганы дугаар', p.gate_number)}
      ${_gfFieldRow('Суурин утас', p.landline)}
      ${_gfFieldRow('Гар утас', p.mobile)}
      ${_gfFieldRow('Факс', p.fax)}
      ${_gfFieldRow('Цахим шуудан', p.email)}
      ${_gfFieldRow('Цахим хуудас', p.website)}

      <div style="display:flex;gap:16px;margin-top:10px">
        <div style="flex:1">
          <div class="gf-subsection">А.3 Хариуцлагын хэлбэр (тохирохыг дугуйлна уу)</div>
          ${_gfCheckboxTable(LIABILITY_TYPES, p.liability_type_code)}
        </div>
        <div style="flex:1">
          <div class="gf-subsection">А.4 Өмчийн хэлбэр (тохирохыг дугуйлна)</div>
          ${_gfCheckboxTable(OWNERSHIP_TYPES, p.ownership_type_code)}
        </div>
      </div>

      <div class="gf-subsection">А.5 Харилцах дансны мэдээлэл</div>
      <table class="gov-form-table">
        <thead><tr><th style="width:26px">№</th><th>Банкны нэр</th><th>Дансны дугаар</th></tr></thead>
        <tbody>${bankRows.map((a, i) => `<tr><td class="gf-code">${i + 1}</td><td>${esc(a.bank_name) || ''}</td><td>${esc(a.account_number) || ''}</td></tr>`).join('')}</tbody>
      </table>

      <div class="gf-sig-row">
        <div class="gf-sig-block">Захирал<div class="gf-sig-line">${esc(_findEmployeeNameByPosition('Гүйцэтгэх захирал')) || '.......................'}</div></div>
        <div class="gf-sig-block">Ня-бо<div class="gf-sig-line">${esc(_findEmployeeNameByPosition('Нягтлан бодогч')) || '.......................'}</div></div>
        <div class="gf-stamp-box">Тамга,<br>тэмдэг</div>
      </div>

      <div class="gf-footnote">
        1. Ажил олгогч нь А хэсгийн мэдээллийг жилд нэг удаа жил бүрийн 2-р сарын 5-ны дотор онлайн программд шивэх ба өөрчлөлт орсон бол дараа сарын 05-ны дотор маягтаар баталгаажуулан харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.<br>
        2. Ажил олгогч нь Б хэсгийн мэдээллийг сар бүрийн 5-ны дотор онлайн программд шивэх ба тоон гарын үсэг эсвэл цаасаар баталгаажуулж сар бүрийн 5-ны дотор харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.
      </div>

      <div style="page-break-before:always"></div>

      <div class="gf-section-title">Б. НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ ТӨЛӨЛТ</div>
      <div class="gf-subsection">1. Шимтгэл төлөлт (төгрөг)</div>
      <table class="gov-form-table">
        <thead>
          <tr><th rowspan="2">Үзүүлэлт</th>${cols.map(c => `<th style="max-width:95px">${INSURED_TYPE_LABELS[c]}</th>`).join('')}<th rowspan="2">Бүгд<br>6=(1+…+5)</th></tr>
          <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
        </thead>
        <tbody>
          <tr><td style="text-align:left">Даатгуулагчдын тоо</td>${cols.map(c => `<td>${insuredCount[c] || 0}</td>`).join('')}<td style="font-weight:700">${activeEmployees.length}</td></tr>
          <tr><td style="text-align:left;padding-left:14px">Монгол</td><td colspan="5"></td><td style="font-weight:700">${mongolCount}</td></tr>
          <tr><td style="text-align:left;padding-left:14px">Гадаад</td><td colspan="5"></td><td style="font-weight:700">${foreignCount}</td></tr>
          ${rowKeys.map(k => `<tr><td style="text-align:left">${rowLabels[k]}</td>${cols.map(c => `<td>${fmtMoney(grid[k][c])}</td>`).join('')}<td style="font-weight:700">${fmtMoney(totalsByRow[k])}</td></tr>`).join('')}
          <tr style="font-weight:700"><td style="text-align:left">Нийт дүн 9=(3+…+8)</td>${cols.map(c => `<td>${fmtMoney(rowKeys.reduce((s, k) => s + grid[k][c], 0))}</td>`).join('')}<td>${fmtMoney(grandTotal)}</td></tr>
        </tbody>
      </table>
      <div class="gf-footnote" style="margin-bottom:10px">⚠️ Шимтгэл ногдуулах хувь / Төлбөл зохих, Төлсөн, Буцаан олгосон шимтгэлийн мөрүүд одоогоор дэлгэрэнгүй тооцоологдоогүй тул орхив — доорх нэгдсэн НДШ дүнг үзнэ үү.</div>

      <div class="grid-2" style="margin-top:4px;font-size:11px">
        <div class="summary-row"><span class="summary-key">Төлбөл зохих НДШ (ажилтны хэсэг)</span><span class="summary-val">${fmtMoney(ndshEmployeeTotal)}</span></div>
        <div class="summary-row"><span class="summary-key">Төлбөл зохих НДШ (ажил олгогчийн хэсэг)</span><span class="summary-val">${fmtMoney(ndshEmployerTotal)}</span></div>
        <div class="summary-row" style="font-weight:700"><span class="summary-key">Нийт төлбөл зохих НДШ</span><span class="summary-val">${fmtMoney(ndshEmployeeTotal + ndshEmployerTotal)}</span></div>
      </div>

      <div class="gf-sig-row">
        <div class="gf-sig-block">Тайлан гаргасан<br>Дарга/захирал<div class="gf-sig-line">${esc(_findEmployeeNameByPosition('Гүйцэтгэх захирал')) || ''}</div></div>
        <div class="gf-sig-block">Нягтлан бодогч<div class="gf-sig-line">${esc(_findEmployeeNameByPosition('Нягтлан бодогч')) || ''}</div></div>
        <div class="gf-sig-block">Шалгаж, хүлээн авсан<br>НД байцаагч/ажилтан<div class="gf-sig-line">&nbsp;</div></div>
      </div>
    </div>`;
}

async function _renderND8() {
  const el = document.getElementById('gov-report-nd8');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const yearMonth = _govReportYearMonth();
  const [year, month] = yearMonth.split('-');
  const [catMap, journalByEmp] = await Promise.all([_ensureNd7CategoryMap(), _fetchPayrollJournalForMonth(yearMonth)]);
  const p = _sokhOrgProfile || {};

  const activeEmployees = employees.filter(e => e.status === 'active' || journalByEmp[e.dbId]);
  const rows = activeEmployees.map((e) => {
    const byAccount = journalByEmp[e.dbId] || {};
    const byCat = { base: 0, bonus: 0, other_addition: 0, annual_leave: 0, meal_transport: 0, fuel_coal: 0 };
    Object.entries(byAccount).forEach(([code, amt]) => {
      const cat = catMap[code];
      if (cat && byCat.hasOwnProperty(cat)) byCat[cat] += amt.debit || 0;
    });
    const grossIncome = Object.values(byCat).reduce((s, v) => s + v, 0);
    const employerNdsh = byAccount['7020']?.debit || 0;
    const totalNdsh = byAccount['3030']?.credit || 0;
    const employeeNdsh = Math.max(totalNdsh - employerNdsh, 0);
    return { e, byCat, grossIncome, employerNdsh, employeeNdsh };
  });

  el.innerHTML = `
    <div class="gov-form-page" style="max-width:100%">
      <div class="gf-topline">
        <div></div>
        <div style="text-align:right;max-width:340px">
          <div style="font-weight:700">З-НД-8</div>
          <div style="font-size:8px;color:#444">Үндэсний Статистикийн хорооны даргын 2020 оны 12 дугаар сарын 28-ны өдрийн А/73 дугаар тушаалаар зөвшөөрснөөр, Сангийн сайд, Хөдөлмөр, нийгмийн хамгааллын сайдын хамтарсан тушаалаар батлав.</div>
        </div>
      </div>
      <div class="gf-title">${esc(p.org_name) || '.......................'}-Д АЖИЛЛАЖ БУЙ ДААТГУУЛАГЧИЙН ${year} ОНЫ ${+month}-Р САРЫН НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ НОГДУУЛАЛТ</div>
      <div style="margin-bottom:8px">Ажил олгогчийн нийгмийн даатгалын бүртгэлийн дугаар: <strong>${esc(p.nd_reg_number) || '.......................'}</strong></div>

      <div class="table-wrap">
        <table class="gov-form-table" style="font-size:9.5px" id="nd8-data-table">
          <thead>
            <tr>
              <th rowspan="2">А</th><th rowspan="2">Регистр<br>(МД)</th>
              <th rowspan="2">Ургийн<br>овог</th><th rowspan="2">Эцэг/эхийн<br>нэр</th><th rowspan="2">Нэр</th>
              <th rowspan="2">Даатгуулагчийн<br>төрөл</th><th rowspan="2">Монгол/<br>Гадаад</th>
              <th colspan="6">Хөдөлмөрийн хөлс, түүнтэй адилтгах орлого /төгрөг/</th>
              <th rowspan="2">Нийт<br>дүн</th>
              <th colspan="2">Ногдуулсан шимтгэл /төгрөг/</th>
            </tr>
            <tr>
              <th>Үндсэн ба<br>нэмэгдэл</th><th>Шагналт</th><th>Бусад<br>нэмэгдэл</th><th>Э.амралт</th><th>Хоол,<br>унаа</th><th>Түлээ,<br>нүүрс</th>
              <th>Ажил<br>олгогч</th><th>Даатгуулагч</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `<tr>
              <td>${i + 1}</td>
              <td>${esc(r.e.registerNumber)}</td>
              <td>${esc(r.e.lastName || '')}</td>
              <td>${esc(r.e.parentName || '')}</td>
              <td>${esc(r.e.firstName || r.e.fullName)}</td>
              <td>${r.e.insuredType || 1}</td>
              <td>${r.e.nationality === 'foreign' ? 'Гадаад' : 'Монгол'}</td>
              <td>${fmtMoney(r.byCat.base)}</td>
              <td>${fmtMoney(r.byCat.bonus)}</td>
              <td>${fmtMoney(r.byCat.other_addition)}</td>
              <td>${fmtMoney(r.byCat.annual_leave)}</td>
              <td>${fmtMoney(r.byCat.meal_transport)}</td>
              <td>${fmtMoney(r.byCat.fuel_coal)}</td>
              <td style="font-weight:700">${fmtMoney(r.grossIncome)}</td>
              <td>${fmtMoney(r.employerNdsh)}</td>
              <td>${fmtMoney(r.employeeNdsh)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="gf-footnote">⚠️ Хуулиар НДШ 5 дэд төрөлд (тэтгэврийн, тэтгэмжийн, ажилгүйдлийн, ҮОМШӨ-ний, эрүүл мэндийн) задардаг ч, танай системд НДШ ганц НЭГДСЭН хувь хэмжээгээр тооцогддог тул "Ногдуулсан шимтгэл" баганад ЗӨВХӨН нэгдсэн нийт дүн харагдана — 5 дэд төрлөөр тусад нь харуулах бол tax_types тохиргоог өргөтгөх шаардлагатай.</div>

      <div class="gf-sig-row">
        <div class="gf-sig-block">Тайлан гаргаж нэгтгэсэн<br>Нягтлан бодогч<div class="gf-sig-line">${esc(_findEmployeeNameByPosition('Нягтлан бодогч')) || ''}</div></div>
        <div class="gf-sig-block">Тайлан хянасан<br>Дарга/захирал<div class="gf-sig-line">${esc(_findEmployeeNameByPosition('Гүйцэтгэх захирал')) || ''}</div></div>
        <div class="gf-sig-block">Шалгаж, хүлээж авсан<br>НД байцаагч<div class="gf-sig-line">&nbsp;</div></div>
      </div>
    </div>`;
}

function exportGovReportToXlsx() {
  const activeTab = document.querySelector('#gov-reports-tabs .tab.active');
  const isNd8 = activeTab && activeTab.textContent.trim() === 'НД-8';
  const tableId = isNd8 ? 'nd8-data-table' : null;
  const yearMonth = _govReportYearMonth();
  if (!tableId) { toast('НД-7 экспортыг НД-8 хүснэгэлийн адил XLSX болгож нэмэх төлөвлөгөөтэй — одоогоор Хэвлэх ашиглана уу', 'error'); return; }
  exportTableToXlsx(tableId, `НД-8_${yearMonth}.xlsx`);
}

// ============================================================
// СӨХ ТОХИРГОО — ТАБ ШИЛЖИЛТ
// ============================================================
function switchSokhSettingsTab(name, el) {
  document.querySelectorAll('#sokh-settings-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('sokh-report-info').style.display = name === 'report-info' ? '' : 'none';
  document.getElementById('sokh-positions').style.display = name === 'positions' ? '' : 'none';
  if (name === 'positions') renderJobPositionsTable();
}

// ============================================================
// АЛБАН ТУШААЛ (job_positions) — "СӨХ тохиргоо → Албан тушаал" таб.
// employees.position нь ТЕКСТЭЭР хадгалагддаг хэвээр (fixed_assets.responsible-тэй
// адил зарчим) — энэ жагсаалт зөвхөн Ажилтан modal-ийн dropdown-ий ЭХ СУРВАЛЖ.
// ============================================================
let jobPositions = [];

async function db_loadJobPositions() {
  const { data, error } = await sb.from('job_positions').select('*').order('sort_order').order('name');
  if (error) { console.error('job_positions load error:', error.message); return; }
  jobPositions = data || [];
}

function renderJobPositionsTable(filter = '') {
  const body = document.getElementById('job-positions-table-body');
  if (!body) return;
  const q = (filter || '').toLowerCase();
  const list = jobPositions.filter(p => p.name.toLowerCase().includes(q));
  if (!list.length) { body.innerHTML = '<tr><td colspan="2" class="empty-state">Албан тушаал бүртгэгдээгүй байна</td></tr>'; return; }
  const canEdit = currentProfile?.role === 'admin';
  const canDel = canEdit;
  body.innerHTML = list.map(p => `
    <tr>
      <td class="dt-text">${esc(p.name)}</td>
      <td>${_rowActionIcons(p.id, canEdit, canDel, 'editJobPosition', 'deleteJobPosition')}</td>
    </tr>`).join('');
}

let editingJobPositionId = null;
function openAddJobPosition() {
  if (currentProfile?.role !== 'admin') { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  editingJobPositionId = null;
  document.getElementById('modal-job-position-title').textContent = 'Албан тушаал нэмэх';
  document.getElementById('job-position-name').value = '';
  openModal('modal-job-position');
}
function editJobPosition(id) {
  if (currentProfile?.role !== 'admin') { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const p = jobPositions.find(x => x.id === id); if (!p) return;
  editingJobPositionId = id;
  document.getElementById('modal-job-position-title').textContent = 'Албан тушаал засах';
  document.getElementById('job-position-name').value = p.name;
  openModal('modal-job-position');
}
async function saveJobPosition() {
  const name = document.getElementById('job-position-name').value.trim();
  if (!name) { toast('Албан тушаалын нэрийг оруулна уу', 'error'); return; }
  if (editingJobPositionId) {
    const { error } = await sb.from('job_positions').update({ name }).eq('id', editingJobPositionId);
    if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  } else {
    const { error } = await sb.from('job_positions').insert({ name });
    if (error) { toast('Хадгалахад алдаа гарлаа: ' + error.message, 'error'); return; }
  }
  await db_loadJobPositions();
  renderJobPositionsTable(document.getElementById('job-position-search')?.value || '');
  closeModal('modal-job-position');
  toast('Хадгалагдлаа ✓', 'success');
}
async function deleteJobPosition(id) {
  if (currentProfile?.role !== 'admin') { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  if (!confirm('Устгах уу?')) return;
  const { error } = await sb.from('job_positions').delete().eq('id', id);
  if (error) { toast('Устгахад алдаа гарлаа: ' + error.message, 'error'); return; }
  await db_loadJobPositions();
  renderJobPositionsTable(document.getElementById('job-position-search')?.value || '');
  toast('Устгагдлаа', 'success');
}

// Ажилтан нэмэх/засах modal-ийн "Албан тушаал" dropdown-ыг job_positions-ээс угсарна.
function populateEmployeePositionSelect(keepValue) {
  const sel = document.getElementById('employee-position');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Албан тушаал сонгох —</option>' + jobPositions.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
  if (keepValue) sel.value = keepValue;
}

// "Гүйцэтгэх захирал"/"Нягтлан бодогч" албан тушаалтай (идэвхтэй) ажилтныг олж,
// "АЖИЛТАН Эцэг/эхийн нэр" форматаар буцаана. Олдохгүй бол хоосон.
function _findEmployeeNameByPosition(positionName) {
  const emp = employees.find(e => e.position === positionName && e.status === 'active');
  return emp ? _employeeDisplayName(emp) : '';
}
