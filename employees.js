// ============================================================
// employees.js — Ажилтны бүртгэлийн модуль (Цалингийн модуль Phase 1)
// ============================================================
// Хамаарал: sb (db.js), canWrite/canDelete/canView (suh.html), esc/fmt/fmtMoney/
// todayStr/toast/openModal/closeModal (suh.html).
// Энэ бол зөвхөн бүртгэл — цалин ТООЦООЛОХ логик (ХХОАТ/НДШ) Phase 2-т орно.
// ============================================================

let employees = [];

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
// Preview харах — "Ажилтны бүртгэл" хуудсанд шинэ товч/tab-аар дуудагдана
// ------------------------------------------------------------
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
