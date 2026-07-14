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
  { code: '10', label: 'Хувьцаат компани' }, { code: '11', label: 'Хязгаарлагдмал хариуцлагатай компани' },
  { code: '20', label: 'Бүх гишүүд нь хариуцлагатай нөхөрлөл' }, { code: '21', label: 'Зарим гишүүд нь хариуцлагатай нөхөрлөл' },
  { code: '30', label: 'Хоршоо' }, { code: '40', label: 'Төрийн өмчит үйлдвэрийн газар' },
  { code: '41', label: 'Орон нутгийн өмчит үйлдвэрийн газар' }, { code: '60', label: 'Төсөвт байгууллага' },
  { code: '61', label: 'Үүнээс: Цэрэг цагдаагийн' }, { code: '70', label: 'Төрийн бус байгууллага' },
  { code: '80', label: 'Бусад' },
];
// Өмчийн хэлбэр нь 3 бүлэгт хуваагдана (Төрийн/Орон нутгийн/Хувийн), бүлэг тус бүрд
// хэд хэдэн код-label — _gfCheckboxTable()-той адилгүй тул тусдаа рендерлэнэ.
const OWNERSHIP_GROUPS = [
  { group: 'Төрийн', items: [{ code: '11', label: 'өмчийн' }, { code: '12', label: 'өмчийн оролцоотой' }, { code: '13', label: 'хамтарсан (....%)' }] },
  { group: 'Орон нутгийн', items: [{ code: '30', label: 'өмчийн' }, { code: '31', label: 'өмчийн оролцоотой' }, { code: '32', label: 'хамтарсан (....%)' }] },
  { group: 'Хувийн', items: [{ code: '21', label: 'Монгол Улсын' }, { code: '22', label: 'гадаадтай хамтарсан (....%)' }, { code: '23', label: 'гадаад улсын' }] },
];

function _gfFieldRow(label, value) {
  return `<div class="gf-field-row"><div class="gf-field-label">${esc(label)}</div><div class="gf-field-value">${esc(value) || ''}</div></div>`;
}
function _gfCheckboxTable(items, selectedCode) {
  return `<table class="gov-form-table gf-checkbox-table"><tbody>${items.map(it => `
    <tr style="${it.code === selectedCode ? 'font-weight:700' : ''}">
      <td>${it.code === selectedCode ? '● ' : '○ '}${esc(it.label)}</td>
      <td class="gf-code">${esc(it.code)}</td>
    </tr>`).join('')}</tbody></table>`;
}
// А.4 Өмчийн хэлбэр — 3 бүлэгт (Төрийн/Орон нутгийн/Хувийн) хуваагдсан тусгай хүснэгэл
function _gfOwnershipTable(selectedCode) {
  return `<table class="gov-form-table gf-checkbox-table"><tbody>
    ${OWNERSHIP_GROUPS.map(g => g.items.map((it, i) => `
      <tr style="${it.code === selectedCode ? 'font-weight:700' : ''}">
        ${i === 0 ? `<td rowspan="${g.items.length}" style="width:70px;vertical-align:top">${esc(g.group)}</td>` : ''}
        <td>${it.code === selectedCode ? '● ' : '○ '}${esc(it.label)}</td>
        <td class="gf-code">${esc(it.code)}</td>
      </tr>`).join('')).join('')}
  </tbody></table>`;
}
// Гараар бичихэд зориулсан "хайрцаглаг" тоон нүд (регистр, утас, даатгуулагчийн
// төрлийн код) — тэмдэгт бүрийг тусдаа жижиг нүдэнд харуулж, бодит маягтын
// дүрсийг хэвлэлтэд хадгална. n = нийт нүдний тоо (утга дутуу бол хоосон үлдэнэ).
function _gfDigitBoxes(value, n) {
  const chars = (value || '').toString().split('');
  const boxes = [];
  for (let i = 0; i < n; i++) boxes.push(`<span>${esc(chars[i] || '')}</span>`);
  return `<span class="gf-digit-boxes">${boxes.join('')}</span>`;
}

function _findEmployeePhoneByPosition(positionName) {
  const emp = employees.find(e => e.position === positionName && e.status === 'active');
  return emp ? (emp.phone || '') : '';
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
  const rowMD = { base: 3, bonus: 4, other_addition: 5, annual_leave: 6, meal_transport: 7, fuel_coal: 8 };
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
  const bankRows = (p.bank_accounts && p.bank_accounts.length ? p.bank_accounts : [{}, {}, {}, {}, {}]);
  const ndshRate = ndshEmployerTotal + ndshEmployeeTotal > 0 && grandTotal > 0
    ? ((ndshEmployerTotal + ndshEmployeeTotal) / grandTotal * 100).toFixed(2) : '';

  el.innerHTML = `
    <div class="gov-form-page">
      <div class="gf-topline">
        <div style="max-width:380px">Үндэсний Статистикийн хорооны даргын 2020 оны 12 дугаар сарын 28-ны өдрийн А/73 дугаар тушаалаар зөвшөөрснөөр, Сангийн сайд, Хөдөлмөр, нийгмийн хамгааллын сайдын 20 .... оны .... сарын .... -ны өдрийн .... дугаар хамтарсан тушаалаар батлав.</div>
        <div style="font-weight:700;white-space:nowrap">З-НД-7</div>
      </div>
      <div class="gf-title">${esc(p.org_name) || '.....................................'}-НИЙ НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ ТӨЛӨЛТИЙН ${year} ОНЫ<br>${+month}-Р САРЫН ТАЙЛАН</div>

      <div class="gf-section-title">А. АЖИЛ ОЛГОГЧИЙН МЭДЭЭЛЭЛ</div>

      <div class="gf-subsection">А.1 Нэрийн хэсэг</div>
      <table class="gov-form-table">
        <thead><tr><th style="width:230px"></th><th>Нэр</th><th style="width:160px">Код</th></tr></thead>
        <tbody>
          <tr><td>Ажил олгогчийн нэр</td><td colspan="2">${esc(p.org_name) || ''}</td></tr>
          <tr><td>Байгууллагын регистрийн дугаар</td><td colspan="2">${_gfDigitBoxes(p.reg_number, 7)}</td></tr>
          <tr><td>Үйл ажиллагааны чиглэл</td><td>${esc(p.activity_type) || ''}</td><td></td></tr>
        </tbody>
      </table>

      <div class="gf-subsection">А.2 Хаягийн хэсэг</div>
      <div style="display:flex;gap:0">
        <table class="gov-form-table" style="flex:1.3">
          <thead><tr><th>Байршил</th><th>Нэр</th><th style="width:50px">Код</th></tr></thead>
          <tbody>
            <tr><td>Аймаг, нийслэлийн нэр, код</td><td>${esc(p.province) || ''}</td><td></td></tr>
            <tr><td>Сум, дүүргийн нэр, код</td><td>${esc(p.district) || ''}</td><td></td></tr>
            <tr><td>Баг, хорооны нэр, код</td><td>${esc(p.khoroo) || ''}</td><td></td></tr>
            <tr><td>Гудамж, хороолол</td><td colspan="2">${esc(p.street) || ''}</td></tr>
            <tr><td>Байшин, байр</td><td colspan="2">${esc(p.building) || ''}</td></tr>
            <tr><td>Хашаа, хаалганы дугаар</td><td colspan="2">${esc(p.gate_number) || ''}</td></tr>
          </tbody>
        </table>
        <table class="gov-form-table" style="flex:1">
          <tbody>
            <tr><td style="width:80px">Суурин утас</td><td>${esc(p.landline) || ''}</td></tr>
            <tr><td rowspan="3" style="width:80px">Гар утас</td><td>Захирал: ${esc(_findEmployeePhoneByPosition('Гүйцэтгэх захирал')) || ''}</td></tr>
            <tr><td>Ня-бо: ${esc(_findEmployeePhoneByPosition('Нягтлан бодогч')) || ''}</td></tr>
            <tr><td>${esc(p.mobile) || ''}</td></tr>
            <tr><td>Факс</td><td>${esc(p.fax) || ''}</td></tr>
            <tr><td>Цахим шуудан</td><td>${esc(p.email) || ''}</td></tr>
            <tr><td>Цахим хуудас</td><td>${esc(p.website) || ''}</td></tr>
          </tbody>
        </table>
      </div>

      <div style="display:flex;gap:16px;margin-top:10px">
        <div style="flex:1">
          <div class="gf-subsection">А.3 Хариуцлагын хэлбэр /тохирохыг дугуйлна уу/</div>
          ${_gfCheckboxTable(LIABILITY_TYPES, p.liability_type_code)}
        </div>
        <div style="flex:1.2">
          <div class="gf-subsection">А.4 Өмчийн хэлбэр /тохирохыг дугуйлна/</div>
          ${_gfOwnershipTable(p.ownership_type_code)}
        </div>
      </div>

      <div class="gf-subsection">А.5 Харилцах дансны мэдээлэл</div>
      <table class="gov-form-table">
        <thead><tr><th style="width:26px">№</th><th>Банкны нэр</th><th>Дансны дугаар</th></tr></thead>
        <tbody>${bankRows.map((a, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(a.bank_name) || ''}</td><td>${a.account_number ? _gfDigitBoxes(a.account_number, 11) : ''}</td></tr>`).join('')}</tbody>
      </table>

      <div class="gf-sig-row">
        <div class="gf-sig-block">Тамга, тэмдэг<div class="gf-stamp-box" style="margin-top:6px">Т</div></div>
        <div class="gf-sig-block">Дарга/захирал: ...............<div class="gf-sig-line">/${esc(_findEmployeeNameByPosition('Гүйцэтгэх захирал')) || '..........'}/</div></div>
        <div class="gf-sig-block">Нягтлан бодогч: ...............<div class="gf-sig-line">/${esc(_findEmployeeNameByPosition('Нягтлан бодогч')) || '..........'}/</div></div>
      </div>

      <div class="gf-footnote">
        1. Ажил олгогч нь А хэсгийн мэдээллийг жилд нэг удаа жил бүрийн 2-р сарын 5-ны дотор онлайн программд шивэх ба өөрчлөлт орсон бол дараа сарын 05-ны дотор маягтаар баталгаажуулан харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.<br>
        2. Ажил олгогч нь Б хэсгийн мэдээллийг сар бүрийн 5-ны дотор онлайн программд шивэх ба тоон гарын үсэг эсвэл цаасаар баталгаажуулж сар бүрийн 5-ны дотор харьяа аймаг, дүүрэг/сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.
      </div>

      <div style="page-break-before:always"></div>

      <div class="gf-section-title">Б. НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ ТӨЛӨЛТ</div>
      <div style="margin-bottom:10px">Ажил олгогчийн нийгмийн даатгалын бүртгэлийн дугаар: ${_gfDigitBoxes(p.nd_reg_number, 9)}</div>

      <div class="gf-subsection">1. Шимтгэл төлөлт (төгрөг)</div>
      <table class="gov-form-table" style="font-size:9.5px">
        <thead>
          <tr><th rowspan="3" style="width:180px">Үзүүлэлт</th><th rowspan="3" style="width:22px">МД</th><th colspan="6">Шимтгэл төлөлт</th></tr>
          <tr>${cols.map(c => `<th style="max-width:90px">${INSURED_TYPE_LABELS[c]}</th>`).join('')}<th rowspan="2">Бүгд<br>6=(1+…+5)</th></tr>
          <tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
        </thead>
        <tbody>
          <tr><td rowspan="2" style="text-align:left">Даатгуулагчдын тоо</td><td>1</td><td colspan="5"></td><td style="font-weight:700">${mongolCount}</td></tr>
          <tr><td>2</td><td colspan="5"></td><td style="font-weight:700">${foreignCount}</td></tr>
          ${rowKeys.map(k => `<tr>${k === 'base' ? `<td rowspan="${rowKeys.length}" style="text-align:left">Даатгуулагчийн хөдөлмөрийн хөлс, түүнтэй адилтгах орлого</td>` : ''}<td>${rowMD[k]}</td>${cols.map(c => `<td>${fmtMoney(grid[k][c])}</td>`).join('')}<td style="font-weight:700">${fmtMoney(totalsByRow[k])}</td></tr>`).join('')}
          <tr style="font-weight:700"><td style="text-align:left" colspan="2">Дүн 9=(3+…+8)</td>${cols.map(c => `<td>${fmtMoney(rowKeys.reduce((s, k) => s + grid[k][c], 0))}</td>`).join('')}<td>${fmtMoney(grandTotal)}</td></tr>
          <tr><td style="text-align:left" colspan="2">Шимтгэл ногдуулах хувь</td><td colspan="5"></td><td>${ndshRate}</td></tr>
          <tr><td rowspan="2" style="text-align:left">Нийгмийн даатгалын санд</td><td>11</td><td colspan="5">Төлбөл зохих НДШ-ийн дүн 11=(9*10)/100</td><td style="font-weight:700">${fmtMoney(ndshEmployeeTotal + ndshEmployerTotal)}</td></tr>
          <tr><td>12</td><td>Төлсөн НДШ-ийн дүн</td><td>х</td><td>х</td><td>х</td><td>х</td><td>х</td><td>${fmtMoney(ndshEmployeeTotal + ndshEmployerTotal)}</td></tr>
          <tr><td style="text-align:left" colspan="2">Нийгмийн даатгалын байгууллагаас буцаан олгосон шимтгэлийн дүн</td><td>х</td><td>х</td><td>х</td><td>х</td><td>х</td><td></td></tr>
        </tbody>
      </table>

      <div class="gf-footnote" style="margin-bottom:6px">⚠️ НДШ (ажилтан/ажил олгогчийн хэсэг) нэгдсэн дүнгээр: ажилтны хэсэг ${fmtMoney(ndshEmployeeTotal)}₮, ажил олгогчийн хэсэг ${fmtMoney(ndshEmployerTotal)}₮.</div>

      <div class="gf-subsection">2. Шимтгэлийн үлдэгдэл /төгрөгөөр/</div>
      <table class="gov-form-table">
        <thead><tr><th style="width:26px">№</th><th>Үзүүлэлт</th><th>Илүү</th><th>Дутуу</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>...... оны .... сарын 1-ний үлдэгдэл</td><td></td><td></td></tr>
          <tr><td>2</td><td>...... оны .... сарын ...... -ний үлдэгдэл</td><td></td><td></td></tr>
        </tbody>
      </table>

      <div class="gf-subsection">3. Тухайн сард дансанд шилжүүлсэн шимтгэл /төгрөгөөр/</div>
      <table class="gov-form-table">
        <thead><tr><th style="width:26px">№</th><th>Он</th><th>Сар</th><th>Өдөр</th><th>Дүн</th></tr></thead>
        <tbody>
          ${[1,2,3,4,5].map(i => `<tr><td>${i}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
          <tr><td colspan="4" style="text-align:center;font-weight:700">Нийт дүн</td><td></td></tr>
        </tbody>
      </table>

      <div class="gf-sig-row">
        <div class="gf-sig-block">Тайлан гаргасан:<br>Тамга, тэмдэг<br>Дарга/захирал: ................ /${esc(_findEmployeeNameByPosition('Гүйцэтгэх захирал')) || '.......'}/<div class="gf-sig-line">(гарын үсэг) (нэр)</div>Нягтлан бодогч: ................/ ${esc(_findEmployeeNameByPosition('Нягтлан бодогч')) || '.......'}/</div>
        <div class="gf-sig-block">Шалгаж, хүлээн авсан:<br>Тэмдэг<br>Нийгмийн даатгалын байцаагч /ажилтан/: ........................ / ............./<div class="gf-sig-line">(гарын үсэг) (нэр)</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:10px">
        <div>Огноо: .....................</div>
        <div>Огноо: .....................</div>
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

  // Хуудас 1: багана А, 1-7, 9 (8 алгасагдана — жинхэнэ маягтад ч мөн адил хоосон)
  const page1Rows = rows.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${esc(r.e.lastName || '')}</td>
    <td>${esc(r.e.parentName || '')}</td>
    <td>${esc(r.e.firstName || r.e.fullName)}</td>
    <td>${_gfDigitBoxes(r.e.registerNumber, 10)}</td>
    <td>${r.e.nationality !== 'foreign' ? '✓' : ''}</td>
    <td>${r.e.nationality === 'foreign' ? '✓' : ''}</td>
    <td>${_gfDigitBoxes(r.e.insuredType || 1, 3)}</td>
    <td>${fmtMoney(r.byCat.base)}</td>
  </tr>`).join('');
  const page1Total = `<tr style="font-weight:700"><td colspan="8" style="text-align:center">Дүн</td><td>${fmtMoney(rows.reduce((s, r) => s + r.byCat.base, 0))}</td></tr>`;

  // Хуудас 2 (үргэлжлэл): багана 10, 12-18, 19-21 (11 алгасагдана — жинхэнэ маягтад ч мөн адил)
  const page2Rows = rows.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${fmtMoney(r.byCat.bonus)}</td>
    <td>${fmtMoney(r.byCat.other_addition)}</td>
    <td>${fmtMoney(r.byCat.annual_leave)}</td>
    <td>${fmtMoney(r.byCat.meal_transport)}</td>
    <td>${fmtMoney(r.byCat.fuel_coal)}</td>
    <td style="font-weight:700">${fmtMoney(r.grossIncome)}</td>
    <td>${fmtMoney(r.employerNdsh)}</td>
    <td>${fmtMoney(r.employeeNdsh)}</td>
    <td>${_gfDigitBoxes(r.e.occupationCode, 4)}</td>
    <td>${_gfDigitBoxes(r.e.phone, 10)}</td>
    <td></td>
  </tr>`).join('');

  el.innerHTML = `
    <div class="gov-form-page" style="max-width:100%">
      <div class="gf-topline">
        <div style="max-width:380px">Үндэсний Статистикийн хорооны даргын 2020 оны 12 дугаар сарын 28-ны өдрийн А/73 дугаар тушаалаар зөвшөөрснөөр, Сангийн сайд, Хөдөлмөр, нийгмийн хамгааллын сайдын 20 .... оны .... сарын .... -ны өдрийн .... дугаар хамтарсан тушаалаар батлав.</div>
        <div style="font-weight:700;white-space:nowrap">З-НД-8</div>
      </div>
      <div class="gf-title">${esc(p.org_name) || '.....................................'}-Д АЖИЛЛАЖ БУЙ ДААТГУУЛАГЧИЙН ${year} ОНЫ<br>${+month}-Р САРЫН НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ НОГДУУЛАЛТ</div>
      <div style="margin-bottom:8px">Ажил олгогчийн нийгмийн даатгалын бүртгэлийн дугаар: ${_gfDigitBoxes(p.nd_reg_number, 9)}</div>

      <div class="gf-footnote" style="margin-bottom:8px">
        1. Ажил олгогч нь 1-18-р баганын мэдээллийг сар бүрийн 5-ны дотор онлайн программд шивж, тоон гарын үсэг эсвэл цаасаар баталгаажуулж, харьяа аймаг, дүүрэг /сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.<br>
        2. Ажил олгогч нь тодруулсан 19-р баганын мэдээллийг улирлын дараа сарын 5-ны дотор онлайн программд шивж, тоон гарын үсэг эсвэл цаасаар баталгаажуулж харьяа аймаг, дүүрэг /сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.<br>
        3. Ажил олгогч нь тодруулсан 20, 21-р баганын мэдээллийг жил бүрийн 2-р сарын 5-ны дотор, хэрэв өөрчлөлт орсон тохиолдолд улирлын дараа сарын 5-ны дотор онлайн программд шивэх ба тоон гарын үсэг эсвэл цаасаар баталгаажуулж аймаг, дүүрэг /сум/-ийн нийгмийн даатгалын байгууллагад ирүүлнэ.
      </div>

      <table class="gov-form-table" style="font-size:9px" id="nd8-data-table">
        <thead>
          <tr><th rowspan="3" style="width:20px"></th><th colspan="9">Даатгуулагчийн</th></tr>
          <tr>
            <th rowspan="2">Ургийн овог</th><th rowspan="2">Эцэг/эхийн нэр</th><th rowspan="2">Нэр</th>
            <th rowspan="2">Регистрийн дугаар</th><th rowspan="2">Монгол</th><th rowspan="2">Гадаад</th>
            <th rowspan="2">Даатгуулагчийн төрөл</th>
            <th rowspan="2">Хөдөлмөрийн хөлс, түүнтэй адилтгах орлого /төгрөг/</th>
          </tr>
          <tr></tr>
          <tr><th>А</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>9</th></tr>
        </thead>
        <tbody>${page1Rows}${page1Total}</tbody>
      </table>

      <div style="page-break-before:always"></div>
      <div style="text-align:right;font-weight:700;font-size:11px;margin-bottom:6px">З-НД-8 үргэлжлэл</div>

      <table class="gov-form-table" style="font-size:9px">
        <thead>
          <tr><th rowspan="3" style="width:20px"></th><th colspan="6">Хөдөлмөрийн хөлс, түүнтэй адилтгах орлого /төгрөг/</th><th colspan="3">Ногдуулсан шимтгэл /төгрөг/</th><th colspan="3">Даатгуулагчийн</th></tr>
          <tr>
            <th rowspan="2">Шагналт цалин</th><th rowspan="2">Бусад нэмэгдэл цалин</th><th rowspan="2">Ээлжийн амралтын олговор</th><th rowspan="2">Хоол унааны хөлс</th><th rowspan="2">Түлээ, нүүрсний үнийн хөнгөлөлт</th><th rowspan="2">Нийт дүн</th>
            <th colspan="2">Үнээс:</th><th rowspan="2">Ажил, мэргэжлийн ангилал</th><th rowspan="2">Харилцах утасны дугаар</th><th rowspan="2">Цахим шуудангийн хаяг</th>
          </tr>
          <tr><th>Ажил олгогч</th><th>Даатгуулагч</th></tr>
          <tr><th>А</th><th>10</th><th>12</th><th>13</th><th>14</th><th>15</th><th>16</th><th>17</th><th>18</th><th>19</th><th>20</th><th>21</th></tr>
        </thead>
        <tbody>${page2Rows}</tbody>
      </table>

      <div class="gf-footnote">⚠️ Хуулиар НДШ 5 дэд төрөлд (тэтгэврийн, тэтгэмжийн, ажилгүйдлийн, ҮОМШӨ-ний, эрүүл мэндийн) задардаг ч, танай системд НДШ ганц НЭГДСЭН хувь хэмжээгээр тооцогддог тул 17/18-р баганад ЗӨВХӨН нэгдсэн нийт дүн харагдана.</div>

      <div class="gf-sig-row">
        <div class="gf-sig-block">Тайлан гаргаж нэгтгэсэн: ...............<div class="gf-sig-line">/Албан тушаал/ /Нэр/<br>${esc(_findEmployeeNameByPosition('Нягтлан бодогч')) || ''}</div></div>
        <div class="gf-sig-block">Тайлан хянасан: ...............<div class="gf-sig-line">/Албан тушаал/ /Нэр/<br>${esc(_findEmployeeNameByPosition('Гүйцэтгэх захирал')) || ''}</div></div>
        <div class="gf-sig-block">Шалгаж, хүлээж авсан:<br>Нийгмийн даатгалын байцаагч<div class="gf-sig-line">/Албан тушаал/ /Нэр/</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:10px">
        <div>Баталгаажуулалт — 20 ... оны ... сарын ... өдөр</div>
        <div>Баталгаажуулалт — 20 ... оны ... сарын ... өдөр</div>
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
