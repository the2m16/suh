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
  setVal('sokh-director-name', p.director_name);
  setVal('sokh-accountant-name', p.accountant_name);
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
    director_name: getVal('sokh-director-name'), accountant_name: getVal('sokh-accountant-name'),
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

async function _renderND7() {
  const el = document.getElementById('gov-report-nd7');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const yearMonth = _govReportYearMonth();
  const [catMap, journalByEmp] = await Promise.all([_ensureNd7CategoryMap(), _fetchPayrollJournalForMonth(yearMonth)]);
  const p = _sokhOrgProfile || {};

  // Ажилтан бүрийг insured_type-аар нь 1-5 баганад ангилж, category-аар мөрчилнэ
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
      if (code === '3030') ndshEmployerTotal += 0; // 3030 нийт (доор задална)
    });
    // НДШ ажилтан/ажил олгогчийн задаргаа: 7020=ажил олгогчийн зардал, 3030=нийт өглөг
    const employerNdsh = byAccount['7020']?.debit || 0;
    const totalNdsh = byAccount['3030']?.credit || 0;
    ndshEmployerTotal += employerNdsh;
    ndshEmployeeTotal += Math.max(totalNdsh - employerNdsh, 0);
  });

  const totalsByRow = {}; rowKeys.forEach(k => { totalsByRow[k] = cols.reduce((s, c) => s + grid[k][c], 0); });
  const grandTotal = rowKeys.reduce((s, k) => s + totalsByRow[k], 0);

  el.innerHTML = `
    <div class="card mb-16" style="padding:20px">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-weight:700;font-size:14px">З-НД-7</div>
        <div style="font-size:13px">${esc(p.org_name || '(СӨХ тохиргоо хуудсанд байгууллагын нэрээ оруулна уу)')}-ИЙН НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ ТӨЛӨЛТИЙН ${yearMonth} ОНЫ ТАЙЛАН</div>
      </div>
      <div class="grid-2" style="font-size:12px;margin-bottom:16px">
        <div>Регистрийн дугаар: <strong>${esc(p.reg_number) || '—'}</strong></div>
        <div>НД бүртгэлийн дугаар: <strong>${esc(p.nd_reg_number) || '—'}</strong></div>
        <div>Хаяг: ${esc([p.province, p.district, p.khoroo, p.street, p.building].filter(Boolean).join(', ')) || '—'}</div>
        <div>Утас: ${esc(p.landline || p.mobile) || '—'}</div>
      </div>
      <div style="font-weight:600;font-size:12.5px;margin:14px 0 6px">1. Шимтгэл төлөлт (төгрөг)</div>
      <div class="table-wrap">
        <table class="data-table" style="font-size:11.5px">
          <thead><tr>
            <th>Үзүүлэлт</th>
            ${cols.map(c => `<th style="max-width:110px">${INSURED_TYPE_LABELS[c]}</th>`).join('')}
            <th>Бүгд</th>
          </tr></thead>
          <tbody>
            <tr><td class="dt-text">Даатгуулагчдын тоо</td>${cols.map(c => `<td class="dt-mono">${insuredCount[c] || 0}</td>`).join('')}<td class="dt-mono" style="font-weight:600">${activeEmployees.length}</td></tr>
            ${rowKeys.map(k => `<tr><td class="dt-text">${rowLabels[k]}</td>${cols.map(c => `<td class="dt-mono">${fmtMoney(grid[k][c])}</td>`).join('')}<td class="dt-mono" style="font-weight:600">${fmtMoney(totalsByRow[k])}</td></tr>`).join('')}
            <tr style="font-weight:700"><td class="dt-text">Нийт дүн</td>${cols.map(c => `<td class="dt-mono">${fmtMoney(rowKeys.reduce((s, k) => s + grid[k][c], 0))}</td>`).join('')}<td class="dt-mono">${fmtMoney(grandTotal)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="grid-2" style="margin-top:16px;font-size:12.5px">
        <div class="summary-row"><span class="summary-key">Төлбөл зохих НДШ (ажилтны хэсэг)</span><span class="summary-val">${fmtMoney(ndshEmployeeTotal)}</span></div>
        <div class="summary-row"><span class="summary-key">Төлбөл зохих НДШ (ажил олгогчийн хэсэг)</span><span class="summary-val">${fmtMoney(ndshEmployerTotal)}</span></div>
        <div class="summary-row" style="font-weight:700"><span class="summary-key">Нийт төлбөл зохих НДШ</span><span class="summary-val">${fmtMoney(ndshEmployeeTotal + ndshEmployerTotal)}</span></div>
      </div>
      <div class="grid-2" style="margin-top:24px;font-size:12px">
        <div>Дарга/захирал: ${esc(p.director_name) || '.......................'}</div>
        <div>Нягтлан бодогч: ${esc(p.accountant_name) || '.......................'}</div>
      </div>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:10px">⚠️ Энэ тайлан батлагдсан журналын дүнгээс уншсан анхны хувилбар — албан ёсны маягттай эцсийн байдлаар тулгаж баталгаажуулна уу.</div>
    </div>`;
}

async function _renderND8() {
  const el = document.getElementById('gov-report-nd8');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';
  const yearMonth = _govReportYearMonth();
  const [catMap, journalByEmp] = await Promise.all([_ensureNd7CategoryMap(), _fetchPayrollJournalForMonth(yearMonth)]);
  const p = _sokhOrgProfile || {};

  const activeEmployees = employees.filter(e => e.status === 'active' || journalByEmp[e.dbId]);
  const rows = activeEmployees.map((e, i) => {
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
    <div class="card" style="padding:20px">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-weight:700;font-size:14px">З-НД-8</div>
        <div style="font-size:13px">${esc(p.org_name) || '(СӨХ тохиргоо хуудсанд байгууллагын нэрээ оруулна уу)'}-Д АЖИЛЛАЖ БУЙ ДААТГУУЛАГЧИЙН ${yearMonth} НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ НОГДУУЛАЛТ</div>
        <div style="font-size:11px;color:var(--text-muted)">Ажил олгогчийн НД бүртгэлийн дугаар: ${esc(p.nd_reg_number) || '—'}</div>
      </div>
      <div class="table-wrap">
        <table class="data-table" style="font-size:11px" id="nd8-data-table">
          <thead><tr>
            <th>№</th><th>Регистр (МД)</th><th>Овог</th><th>Нэр</th><th>Даатгуулагчийн төрөл</th><th>Иргэншил</th>
            <th>Үндсэн цалин</th><th>Шагналт</th><th>Бусад нэмэгдэл</th><th>Э.амралт</th><th>Хоол/унаа</th><th>Түлээ/нүүрс</th>
            <th>Нийт орлого</th><th>НДШ (ажилтан)</th><th>НДШ (ажил олгогч)</th>
          </tr></thead>
          <tbody>
            ${rows.map((r, i) => `<tr>
              <td class="dt-mono">${i + 1}</td>
              <td class="dt-mono">${esc(r.e.registerNumber)}</td>
              <td class="dt-text">${esc(r.e.lastName || '')}</td>
              <td class="dt-text">${esc(r.e.firstName || r.e.fullName)}</td>
              <td class="dt-mono">${r.e.insuredType || 1}</td>
              <td class="dt-text">${r.e.nationality === 'foreign' ? 'Гадаад' : 'Монгол'}</td>
              <td class="dt-mono">${fmtMoney(r.byCat.base)}</td>
              <td class="dt-mono">${fmtMoney(r.byCat.bonus)}</td>
              <td class="dt-mono">${fmtMoney(r.byCat.other_addition)}</td>
              <td class="dt-mono">${fmtMoney(r.byCat.annual_leave)}</td>
              <td class="dt-mono">${fmtMoney(r.byCat.meal_transport)}</td>
              <td class="dt-mono">${fmtMoney(r.byCat.fuel_coal)}</td>
              <td class="dt-mono" style="font-weight:600">${fmtMoney(r.grossIncome)}</td>
              <td class="dt-mono">${fmtMoney(r.employeeNdsh)}</td>
              <td class="dt-mono">${fmtMoney(r.employerNdsh)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="font-size:10.5px;color:var(--text-muted);margin-top:10px">⚠️ Анхны хувилбар — албан ёсны маягттай эцсийн байдлаар тулгаж баталгаажуулна уу. "Ажил, мэргэжлийн ангилал" багана одоогоор ажилтны бүртгэлд бөглөгдөөгүй байвал хоосон гарна.</div>
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
