// ============================================================
// employees.js — Ажилтны бүртгэлийн модуль (Цалингийн модуль Phase 1)
// ============================================================
// Хамаарал: sb (db.js), canWrite/canDelete/canView (suh.html), esc/fmt/fmtMoney/
// todayStr/toast/openModal/closeModal (suh.html).
// Энэ бол зөвхөн бүртгэл — цалин ТООЦООЛОХ логик (ХХОАТ/НДШ) Phase 2-т орно.
// ============================================================

let employees = [];

// ------------------------------------------------------------
// ЦАЛИНГИЙН ХУУДАС (Pay slip) — Phase 4. Дахин ТООЦООЛОХГҮЙ, харин
// journal_lines-д АЛЬ ХЭДИЙН БИЧИГДСЭН бодит дүнг л уншиж харуулна
// (жинхэнэ ном/дэвтэртэй яг таарсан, найдвартай эх сурвалж).
// ------------------------------------------------------------
function printPaySlip() {
  document.body.classList.add('printing-payslip');
  window.print();
  // Хэвлэх цонх хаагдсаны дараа class-г арилгана (afterprint эвент бүх browser дээр
  // тогтвортой ажилладаггүй тул жижиг timeout-той хосолж найдвартай болгов)
  const cleanup = () => document.body.classList.remove('printing-payslip');
  window.onafterprint = cleanup;
  setTimeout(cleanup, 2000);
}

function populatePaySlipMonthSelect() {
  const sel = document.getElementById('payslip-month-select');
  if (!sel) return;
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push(`<option value="${ym}">${ym}</option>`);
  }
  sel.innerHTML = options.join('');
}

async function openPaySlip(employeeId) {
  const e = employees.find(x => x.id === employeeId); if (!e) return;
  document.getElementById('payslip-employee-id').value = employeeId;
  document.getElementById('payslip-employee-name').textContent = e.fullName;
  populatePaySlipMonthSelect();
  openModal('modal-payslip');
  await renderPaySlipContent();
}

async function renderPaySlipContent() {
  const employeeId = +document.getElementById('payslip-employee-id').value;
  const yearMonth = document.getElementById('payslip-month-select').value;
  const e = employees.find(x => x.id === employeeId); if (!e) return;
  const el = document.getElementById('payslip-body');
  el.innerHTML = '<div class="empty-state">Ачаалж байна...</div>';

  const party = 'employee:' + employeeId;
  const { data, error } = await sb
    .from('journal_entries')
    .select('id, entry_date, description, journal_lines(account_code, debit, credit, party)')
    .eq('reference', `payroll:employee:${employeeId}:${yearMonth}`)
    .limit(1);

  if (error) { el.innerHTML = '<div class="empty-state">Ачаалахад алдаа гарлаа</div>'; return; }
  if (!data || !data.length) { el.innerHTML = `<div class="empty-state">${yearMonth} сард цалин тооцоологдоогүй байна</div>`; return; }

  const lines = data[0].journal_lines.filter(l => l.party === party);
  const byAccount = {};
  lines.forEach(l => { byAccount[l.account_code] = { debit: +l.debit, credit: +l.credit }; });

  const gross = byAccount['7010']?.debit || 0;
  const ndshEmployer = byAccount['7020']?.debit || 0;
  const netPay = byAccount['1020']?.credit || 0;
  const ndshTotal = byAccount['3030']?.credit || 0;
  const ndshEmployee = +(ndshTotal - ndshEmployer).toFixed(2);
  const hhoat = byAccount['3020']?.credit || 0;

  el.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-weight:700;font-size:15px">${esc(e.fullName)}</div>
      <div style="font-size:12px;color:var(--text-muted)">${esc(e.position) || '—'} · ${yearMonth}</div>
    </div>
    <div class="summary-row"><span class="summary-key">Үндсэн цалин (нийт)</span><span class="summary-val">${fmtMoney(gross)}</span></div>
    <div class="summary-row"><span class="summary-key">НДШ (ажилтны хэсэг)</span><span class="summary-val" style="color:var(--danger)">-${fmtMoney(ndshEmployee)}</span></div>
    <div class="summary-row"><span class="summary-key">ХХОАТ</span><span class="summary-val" style="color:var(--danger)">-${fmtMoney(hhoat)}</span></div>
    <div style="border-top:1px solid var(--border);margin:10px 0"></div>
    <div class="summary-row" style="font-weight:700"><span class="summary-key">ГАРТ ОЛГОХ ДҮН</span><span class="summary-val">${fmtMoney(netPay)}</span></div>
    <div style="border-top:1px solid var(--border);margin:10px 0"></div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Ажил олгогчийн нэмэлт зардал:</div>
    <div class="summary-row"><span class="summary-key">НДШ (ажил олгогчийн хэсэг)</span><span class="summary-val">${fmtMoney(ndshEmployer)}</span></div>
    <div class="summary-row" style="font-weight:700"><span class="summary-key">Ажил олгогчид нийт өртөх зардал</span><span class="summary-val">${fmtMoney(gross + ndshEmployer)}</span></div>`;
}

// ============================================================
// ЦАЛИНГИЙН ТООЦООЛОЛ (Phase 2) — цэвэр функцүүд, Node.js-д 22 тестээр
// баталгаажсан (payroll-calc.js). Энд ЯГ ТЭР ХЭВЭЭР шилжүүлсэн.
// ⚠️ ЗӨВХӨН ТООЦООЛОЛ ХАРУУЛНА — journal entry автоматаар үүсгэдэггүй.
// (Бодит "цалингийн явц" journal entry үүсгэх функц Phase 3-т орно.)
// ============================================================

function calculateProgressiveTax(taxableAmount, brackets) {
  if (!taxableAmount || taxableAmount <= 0) return 0;
  const sorted = brackets.slice().sort((a, b) => a.bracket_order - b.bracket_order);
  for (const b of sorted) {
    const to = (b.threshold_to === null || b.threshold_to === undefined) ? Infinity : b.threshold_to;
    if (taxableAmount > b.threshold_from && taxableAmount <= to) {
      return +(b.base_amount + (taxableAmount - b.threshold_from) * b.rate_percent / 100).toFixed(2);
    }
  }
  const last = sorted[sorted.length - 1];
  return +(last.base_amount + (taxableAmount - last.threshold_from) * last.rate_percent / 100).toFixed(2);
}

function calculateSplitContribution(baseAmount, employeeRatePercent, employerRatePercent) {
  return {
    employeeAmount: +(baseAmount * employeeRatePercent / 100).toFixed(2),
    employerAmount: +(baseAmount * employerRatePercent / 100).toFixed(2),
  };
}

function calculatePayroll(grossSalary, ndshConfig, hhoatBrackets, opts = {}) {
  const ndshEnabled = ndshConfig && ndshConfig.enabled;
  const hhoatEnabled = opts.hhoatEnabled !== false;
  const ndsh = ndshEnabled
    ? calculateSplitContribution(grossSalary, ndshConfig.employee_rate_percent, ndshConfig.employer_rate_percent)
    : { employeeAmount: 0, employerAmount: 0 };
  const hhoatTaxableBase = Math.max(grossSalary - ndsh.employeeAmount, 0);
  const hhoat = hhoatEnabled ? calculateProgressiveTax(hhoatTaxableBase, hhoatBrackets) : 0;
  const netPay = +(grossSalary - ndsh.employeeAmount - hhoat).toFixed(2);
  return {
    grossSalary, ndshEmployee: ndsh.employeeAmount, ndshEmployer: ndsh.employerAmount,
    hhoatTaxableBase, hhoat, netPay,
    totalEmployerCost: +(grossSalary + ndsh.employerAmount).toFixed(2),
  };
}

// ------------------------------------------------------------
// САР БҮРИЙН ЦАЛИНГИЙН ЯВЦ (Phase 3) — journal entry бодитоор үүсгэнэ
// ------------------------------------------------------------

// Ажилтан нэгний цалингийн бичилтийн мөрүүдийг угсарна.
// Дт 7010 (Цалингийн зардал) + Дт 7020 (НДШ-ажил олгогч) =
// Кт 1020 (Гарт олгосон) + Кт 3030 (НД-ийн өглөг, ажилтан+ажил олгогч) + Кт 3020 (Татварын өглөг)
function buildPayrollLines(party, grossSalary, ndshConfig, hhoatBrackets, hhoatEnabled) {
  const p = calculatePayroll(grossSalary, ndshConfig, hhoatBrackets, { hhoatEnabled });
  const lines = [];
  lines.push({ account: '7010', debit: grossSalary, credit: 0, party });
  if (p.ndshEmployer > 0) lines.push({ account: '7020', debit: p.ndshEmployer, credit: 0, party });
  lines.push({ account: '1020', debit: 0, credit: p.netPay, party });
  const ndshPayable = +(p.ndshEmployee + p.ndshEmployer).toFixed(2);
  if (ndshPayable > 0) lines.push({ account: '3030', debit: 0, credit: ndshPayable, party });
  if (p.hhoat > 0) lines.push({ account: '3020', debit: 0, credit: p.hhoat, party });
  return { lines, payroll: p };
}

async function payrollCheckAlreadyRun(yearMonth) {
  const { data, error } = await sb.from('journal_entries').select('id').ilike('reference', `payroll:%:${yearMonth}`).limit(1);
  if (error) { console.error(error); return false; }
  return data && data.length > 0;
}

async function runMonthlyPayroll() {
  if (!canWrite('employees')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const yearMonth = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}`;
  if (await payrollCheckAlreadyRun(yearMonth)) {
    toast(`${yearMonth} сарын цалин аль хэдийн тооцоологдсон байна — дахин хийхгүй`, 'error');
    return;
  }
  const activeEmployees = employees.filter(e => e.status === 'active');
  if (!activeEmployees.length) { toast('Ажиллаж байгаа ажилтан алга', 'error'); return; }
  if (!confirm(`${yearMonth} сарын цалинг ${activeEmployees.length} ажилтанд тооцох уу?\n(Энэ үйлдлийг буцаах боломжгүй тул анхаарна уу.)`)) return;

  const { data: taxTypes, error: e1 } = await sb.from('tax_types').select('*');
  const { data: brackets, error: e2 } = await sb.from('tax_brackets').select('*').eq('tax_code', 'hhoat');
  if (e1 || e2) { toast('Татварын тохиргоо ачаалахад алдаа гарлаа', 'error'); return; }
  const ndshConfig = taxTypes.find(t => t.code === 'ndsh') || { enabled: false };
  const hhoatType = taxTypes.find(t => t.code === 'hhoat') || { enabled: false };

  // Сарын сүүлийн өдөр (цалин ажлын үр дүнгээр сар эцэст тооцогддог зарчмаар)
  const entryDate = new Date(CUR_YEAR, CUR_MONTH, 0).toISOString().slice(0, 10);

  let succeeded = 0, failed = 0;
  for (const e of activeEmployees) {
    const party = 'employee:' + e.id;
    const { lines } = buildPayrollLines(party, e.baseSalary, ndshConfig, brackets, hhoatType.enabled);
    const res = await db_createJournalEntry(
      entryDate, `${e.fullName} — ${yearMonth} сарын цалин`,
      `payroll:employee:${e.id}:${yearMonth}`, lines
    );
    res.success ? succeeded++ : failed++;
  }
  toast(`${yearMonth} сарын цалин: ${succeeded} амжилттай${failed ? ', ' + failed + ' алдаатай' : ''}`, failed ? 'error' : 'success');
  if (document.getElementById('page-employees')?.classList.contains('active')) renderPayrollPreview();
}

async function renderPayrollPreview() {
  const el = document.getElementById('payroll-preview-body');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="6" class="empty-state">Ачаалж байна...</td></tr>';

  const { data: taxTypes, error: e1 } = await sb.from('tax_types').select('*');
  const { data: brackets, error: e2 } = await sb.from('tax_brackets').select('*').eq('tax_code', 'hhoat');
  if (e1 || e2) { el.innerHTML = '<tr><td colspan="6" class="empty-state">Татварын тохиргоо ачаалахад алдаа гарлаа</td></tr>'; return; }

  const ndshConfig = taxTypes.find(t => t.code === 'ndsh') || { enabled: false };
  const hhoatType = taxTypes.find(t => t.code === 'hhoat') || { enabled: false };
  const activeEmployees = employees.filter(e => e.status === 'active');

  if (!activeEmployees.length) { el.innerHTML = '<tr><td colspan="6" class="empty-state">Ажиллаж байгаа ажилтан алга</td></tr>'; return; }

  let totalGross = 0, totalNdshEmp = 0, totalHhoat = 0, totalNet = 0;
  el.innerHTML = activeEmployees.map(e => {
    const p = calculatePayroll(e.baseSalary, ndshConfig, brackets, { hhoatEnabled: hhoatType.enabled });
    totalGross += p.grossSalary; totalNdshEmp += p.ndshEmployee; totalHhoat += p.hhoat; totalNet += p.netPay;
    return `<tr>
      <td class="dt-title">${esc(e.fullName)}</td>
      <td class="dt-mono" style="text-align:right">${fmtMoney(p.grossSalary)}</td>
      <td class="dt-mono" style="text-align:right">${fmtMoney(p.ndshEmployee)}</td>
      <td class="dt-mono" style="text-align:right">${fmtMoney(p.hhoat)}</td>
      <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(p.netPay)}</td>
      <td class="dt-mono" style="text-align:right;color:var(--text-muted)">${fmtMoney(p.totalEmployerCost)}</td>
    </tr>`;
  }).join('') + `
    <tr style="background:rgba(59,130,246,0.1);border-top:2px solid var(--border-light)">
      <td style="font-weight:700">НИЙТ</td>
      <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(totalGross)}</td>
      <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(totalNdshEmp)}</td>
      <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(totalHhoat)}</td>
      <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(totalNet)}</td>
      <td class="dt-mono" style="text-align:right;font-weight:700">${fmtMoney(totalGross + activeEmployees.reduce((s,e)=>{const p=calculatePayroll(e.baseSalary,ndshConfig,brackets,{hhoatEnabled:hhoatType.enabled});return s+p.ndshEmployer;},0))}</td>
    </tr>`;

  const warnEl = document.getElementById('payroll-preview-warning');
  if (warnEl) {
    warnEl.style.display = (!ndshConfig.enabled) ? 'block' : 'none';
  }
}

function switchEmployeeTab(name, el) {
  document.getElementById('employees-list-view').style.display = name === 'list' ? 'block' : 'none';
  document.getElementById('employees-payroll-view').style.display = name === 'payroll' ? 'block' : 'none';
  document.querySelectorAll('#employee-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (name === 'payroll') renderPayrollPreview();
}


async function db_loadEmployees() {
  const { data, error } = await sb.from('employees').select('*').order('full_name');
  if (error) { console.error('employees load error:', error.message); return; }
  employees = (data || []).map(e => ({
    id: e.id, dbId: e.id, fullName: e.full_name, registerNumber: e.register_number || '',
    position: e.position || '', baseSalary: +e.base_salary || 0, hireDate: e.hire_date || '',
    status: e.status, terminationDate: e.termination_date || '', phone: e.phone || '',
    bankAccount: e.bank_account || '', note: e.note || '',
  }));
}

async function db_saveEmployee(emp) {
  const row = {
    full_name: emp.fullName, register_number: emp.registerNumber || null, position: emp.position || null,
    base_salary: emp.baseSalary || 0, hire_date: emp.hireDate || null, status: emp.status,
    termination_date: emp.terminationDate || null, phone: emp.phone || null,
    bank_account: emp.bankAccount || null, note: emp.note || null,
  };
  if (emp.dbId) {
    const { error } = await sb.from('employees').update(row).eq('id', emp.dbId);
    if (error) { console.error(error.message); return false; }
    return true;
  }
  const { data, error } = await sb.from('employees').insert(row).select().single();
  if (error) { console.error(error.message); return false; }
  emp.dbId = data.id;
  return true;
}

async function db_deleteEmployee(dbId) {
  const { error } = await sb.from('employees').delete().eq('id', dbId);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------
function renderEmployeesTable(filter = '') {
  const body = document.getElementById('employees-table-body');
  if (!body) return;
  const canEdit = canWrite('employees'), canDel = canDelete('employees');
  const q = filter.toLowerCase();
  const list = employees.filter(e => {
    if (!q) return true;
    return (e.fullName || '').toLowerCase().includes(q) || (e.position || '').toLowerCase().includes(q);
  }).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">Ажилтан олдсонгүй</td></tr>`;
  } else {
    body.innerHTML = list.map(e => `
      <tr style="cursor:pointer" onclick="openEmployeeDetail(${e.id})">
        <td class="dt-title">${esc(e.fullName)}</td>
        <td class="dt-text">${esc(e.position) || '—'}</td>
        <td class="dt-text dt-mono" style="text-align:right">${fmtMoney(e.baseSalary)}</td>
        <td class="dt-text">${esc(e.hireDate) || '—'}</td>
        <td>${e.status === 'active'
          ? '<span class="tag tag-success">Ажиллаж байгаа</span>'
          : '<span class="tag" style="background:var(--danger-bg);color:var(--danger);border:1px solid var(--danger)">Чөлөөлөгдсөн</span>'}</td>
        <td onclick="event.stopPropagation()">${_rowActionIcons(e.id, canEdit, canDel, 'editEmployee', 'deleteEmployee')}</td>
      </tr>`).join('');
  }

  const stat = document.getElementById('employees-stat');
  if (stat) {
    const activeCount = employees.filter(e => e.status === 'active').length;
    const totalSalary = employees.filter(e => e.status === 'active').reduce((s, e) => s + e.baseSalary, 0);
    stat.textContent = `Нийт: ${employees.length} ажилтан · Ажиллаж байгаа: ${activeCount} · Сарын нийт үндсэн цалин: ${fmtMoney(totalSalary)}`;
  }
}

function filterEmployees() {
  renderEmployeesTable(document.getElementById('employee-search')?.value || '');
}

// ------------------------------------------------------------
// ADD / EDIT MODAL
// ------------------------------------------------------------
let editingEmployeeId = null;

function openAddEmployee() {
  if (!canWrite('employees')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  editingEmployeeId = null;
  document.getElementById('modal-employee-title').textContent = 'Ажилтан нэмэх';
  document.getElementById('employee-name').value = '';
  document.getElementById('employee-register').value = '';
  document.getElementById('employee-position').value = '';
  document.getElementById('employee-salary').value = '';
  document.getElementById('employee-hire-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('employee-status').value = 'active';
  document.getElementById('employee-phone').value = '';
  document.getElementById('employee-bank').value = '';
  document.getElementById('employee-note').value = '';
  openModal('modal-employee');
}

function editEmployee(id) {
  if (!canWrite('employees')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна', 'error'); return; }
  const e = employees.find(x => x.id === id); if (!e) return;
  editingEmployeeId = id;
  document.getElementById('modal-employee-title').textContent = 'Ажилтны мэдээлэл засах';
  document.getElementById('employee-name').value = e.fullName;
  document.getElementById('employee-register').value = e.registerNumber;
  document.getElementById('employee-position').value = e.position;
  document.getElementById('employee-salary').value = e.baseSalary;
  document.getElementById('employee-hire-date').value = e.hireDate;
  document.getElementById('employee-status').value = e.status;
  document.getElementById('employee-phone').value = e.phone;
  document.getElementById('employee-bank').value = e.bankAccount;
  document.getElementById('employee-note').value = e.note;
  openModal('modal-employee');
}

async function saveEmployee() {
  const fullName = document.getElementById('employee-name').value.trim();
  if (!fullName) { toast('Нэрийг оруулна уу', 'error'); return; }
  const baseSalary = +document.getElementById('employee-salary').value || 0;
  const _editing = editingEmployeeId ? employees.find(e => e.id === editingEmployeeId) : null;
  const emp = {
    id: _editing?.id || null, dbId: _editing?.dbId || null,
    fullName,
    registerNumber: document.getElementById('employee-register').value.trim(),
    position: document.getElementById('employee-position').value.trim(),
    baseSalary,
    hireDate: document.getElementById('employee-hire-date').value,
    status: document.getElementById('employee-status').value,
    terminationDate: _editing?.terminationDate || '',
    phone: document.getElementById('employee-phone').value.trim(),
    bankAccount: document.getElementById('employee-bank').value.trim(),
    note: document.getElementById('employee-note').value.trim(),
  };
  const ok = await db_saveEmployee(emp);
  if (!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй', 'error'); return; }
  if (editingEmployeeId) {
    const idx = employees.findIndex(e => e.id === editingEmployeeId);
    if (idx >= 0) employees[idx] = { ...employees[idx], ...emp };
    toast('Мэдээлэл шинэчлэгдлээ', 'success');
  } else {
    employees.push({ id: nextId++, ...emp });
    toast(fullName + ' нэмэгдлээ', 'success');
  }
  closeModal('modal-employee');
  renderEmployeesTable(document.getElementById('employee-search')?.value || '');
}

async function deleteEmployee(id) {
  if (!confirm('Устгах уу? Энэ үйлдлийг буцаах боломжгүй.')) return;
  const e = employees.find(x => x.id === id); if (!e) return;
  try {
    await db_deleteEmployee(e.dbId);
  } catch (err) {
    toast('Устгахад эрхгүй байна эсвэл алдаа гарлаа: ' + err.message, 'error');
    return;
  }
  employees = employees.filter(x => x.id !== id);
  renderEmployeesTable(document.getElementById('employee-search')?.value || '');
  toast('Устгагдлаа', 'success');
}

// ------------------------------------------------------------
// DETAIL VIEW (жижиг, зөвхөн харах — засах/устгах товч мөн энд байна)
// ------------------------------------------------------------
let selectedEmployeeForDetail = null;

function openEmployeeDetail(id) {
  const e = employees.find(x => x.id === id); if (!e) return;
  selectedEmployeeForDetail = e;
  document.getElementById('employee-detail-title').textContent = e.fullName;
  document.getElementById('employee-detail-body').innerHTML = `
    <div class="summary-row"><span class="summary-key">Албан тушаал</span><span class="summary-val">${esc(e.position) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Регистрийн дугаар</span><span class="summary-val">${esc(e.registerNumber) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Үндсэн цалин</span><span class="summary-val">${fmtMoney(e.baseSalary)}</span></div>
    <div class="summary-row"><span class="summary-key">Ажилд орсон огноо</span><span class="summary-val">${esc(e.hireDate) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Утас</span><span class="summary-val">${esc(e.phone) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Дансны дугаар</span><span class="summary-val">${esc(e.bankAccount) || '—'}</span></div>
    <div class="summary-row"><span class="summary-key">Төлөв</span><span class="summary-val">${e.status === 'active' ? 'Ажиллаж байгаа' : 'Чөлөөлөгдсөн'}</span></div>
    ${e.note ? `<div class="summary-row"><span class="summary-key">Тэмдэглэл</span><span class="summary-val" style="text-align:right;max-width:280px">${esc(e.note)}</span></div>` : ''}`;
  openModal('modal-employee-detail');
}

function employeeDetailEdit() {
  closeModal('modal-employee-detail');
  if (selectedEmployeeForDetail) editEmployee(selectedEmployeeForDetail.id);
}
