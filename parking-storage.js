// parking-storage.js — Зогсоол, Агуулахын төрөл ба хамтын spot-picker модуль
// (suh.html-ээс тусгаарлав)
// Хамаарал: sb (db.js), BUILDINGS (buildings.js) шаардлагатай.
// Спот сонгогч (renderSpotPickerRow гэх мэт) нь Сууц өмчлөгч (residents.js) болон
// Аж ахуйн нэгжийн (businesses.js) маягтуудад ХАМТДАА ашиглагддаг тул
// энэ файлыг тэднээс ӨМНӨ ачаалах шаардлагатай.

// ============================================================
// БАЙРНЫ МЭДЭЭЛЭЛ — Supabase-аас динамикаар ачаална
// ============================================================





let PARKING_TYPES = [];
let STORAGE_TYPES = [];
async function db_loadParkingTypes() {
  const {data, error} = await sb.from('parking_types').select('*');
  if(error){console.error('parking_types load error:', error.message); return;}
  PARKING_TYPES = data || [];
}
async function db_loadStorageTypes() {
  const {data, error} = await sb.from('storage_types').select('*');
  if(error){console.error('storage_types load error:', error.message); return;}
  STORAGE_TYPES = data || [];
}
// PARKING_TYPES/STORAGE_TYPES-ийг мөр бүрчлэн задалж, residents.parkings/storages-тэй харьцуулж эзэмшигчийг олно
function renderParkingList() {
  const body = document.getElementById('apt-parking-list-body');
  if(!body) return;
  const rows = [];
  PARKING_TYPES.forEach(t=>{
    const bld = BUILDINGS.find(b=>b.id===t.building_id);
    const nums = Array.isArray(t.spot_numbers) ? t.spot_numbers : [];
    nums.forEach(num=>{
      const owner = residents.find(r=>r && (r.parkings||[]).includes(num));
      rows.push({building: bld?bld.label:t.building_id, num, sqm:t.sqm, owner});
    });
  });
  if(!rows.length){ body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Зогсоол бүртгэгдээгүй байна — эхлээд Хаягжилт тохиргоо хуудсанд нэмнэ vv</td></tr>'; return; }
  body.innerHTML = rows.map(row=>`<tr>
    <td class="dt-text">${esc(row.building)}</td>
    <td class="dt-title dt-mono">${esc(row.num)}</td>
    <td class="dt-text dt-mono">${row.sqm||'—'}</td>
    <td class="dt-text" style="cursor:${row.owner?'pointer':'default'}" ${row.owner?`onclick="openResidentDetail(${row.owner.id})"`:''}>${row.owner?esc(((row.owner.firstname||'')+' '+(row.owner.lastname||'')).trim()):'<span class="dt-muted">—</span>'}</td>
    <td>${row.owner?'<span style="color:var(--success);font-size:12px;font-weight:600">Эзэмшигчтэй</span>':'<span style="color:var(--text-muted);font-size:12px;font-weight:600">Хоосон</span>'}</td>
  </tr>`).join('');
}
function renderStorageList() {
  const body = document.getElementById('apt-storage-list-body');
  if(!body) return;
  const rows = [];
  STORAGE_TYPES.forEach(t=>{
    const bld = BUILDINGS.find(b=>b.id===t.building_id);
    const nums = Array.isArray(t.unit_numbers) ? t.unit_numbers : [];
    nums.forEach(num=>{
      const owner = residents.find(r=>r && (r.storages||[]).includes(num));
      rows.push({building: bld?bld.label:t.building_id, num, sqm:t.sqm, owner});
    });
  });
  if(!rows.length){ body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Агуулах бүртгэгдээгүй байна — эхлээд Хаягжилт тохиргоо хуудсанд нэмнэ vv</td></tr>'; return; }
  body.innerHTML = rows.map(row=>`<tr>
    <td class="dt-text">${esc(row.building)}</td>
    <td class="dt-title dt-mono">${esc(row.num)}</td>
    <td class="dt-text dt-mono">${row.sqm||'—'}</td>
    <td class="dt-text" style="cursor:${row.owner?'pointer':'default'}" ${row.owner?`onclick="openResidentDetail(${row.owner.id})"`:''}>${row.owner?esc(((row.owner.firstname||'')+' '+(row.owner.lastname||'')).trim()):'<span class="dt-muted">—</span>'}</td>
    <td>${row.owner?'<span style="color:var(--success);font-size:12px;font-weight:600">Эзэмшигчтэй</span>':'<span style="color:var(--text-muted);font-size:12px;font-weight:600">Хоосон</span>'}</td>
  </tr>`).join('');
}





// ============================================================
// ЗОГСООЛ (Parking types) — apt_types-тэй яг ижил загвар
// ============================================================
let editingParkingTypeId = null;
// Мужийн (davhar/vsэг+тоо) хэлбэрийг задлана: "B1-B6" -> ['B1','B2',...,'B6']; "B1" -> ['B1']
function parseAffixRange(str) {
  str = (str||'').trim();
  if(!str) return [];
  if(!str.includes('-')) return [str];
  const parts = str.split('-').map(s=>s.trim());
  if(parts.length!==2) return [str];
  const m1 = parts[0].match(/^([A-Za-z]*)(\d+)$/);
  const m2 = parts[1].match(/^([A-Za-z]*)(\d+)$/);
  if(!m1 || !m2) return [str];
  const prefix = m1[1] || m2[1] || '';
  const start = parseInt(m1[2],10), end = parseInt(m2[2],10);
  const hasLeadingZero = m1[2].length>1 && m1[2][0]==='0';
  const pad = m1[2].length;
  const result = [];
  for(let i=start;i<=end;i++){
    result.push(prefix + (hasLeadingZero ? String(i).padStart(pad,'0') : String(i)));
  }
  return result;
}
// Цэвэр үсгийн муж: "A-G" -> ['A','B','C','D','E','F','G']
function parseZoneRange(str) {
  str = (str||'').trim();
  if(!str) return [];
  if(!str.includes('-')) return [str.toUpperCase()];
  const parts = str.split('-').map(s=>s.trim());
  if(parts.length!==2 || parts[0].length!==1 || parts[1].length!==1) return [str.toUpperCase()];
  const startCode = parts[0].toUpperCase().charCodeAt(0), endCode = parts[1].toUpperCase().charCodeAt(0);
  const result = [];
  for(let c=startCode; c<=endCode; c++) result.push(String.fromCharCode(c));
  return result;
}
// Цэвэр тооны муж (тэг-угтвар мэдэрдэг): "001-121" -> ['001',...,'121']; "1-121" -> ['1',...,'121']
function parseNumberRange(str) {
  str = (str||'').trim();
  if(!str) return [];
  if(!str.includes('-')) return [str];
  const parts = str.split('-').map(s=>s.trim());
  if(parts.length!==2) return [str];
  const start = parseInt(parts[0],10), end = parseInt(parts[1],10);
  if(isNaN(start)||isNaN(end)) return [str];
  const hasLeadingZero = parts[0].length>1 && parts[0][0]==='0';
  const pad = parts[0].length;
  const result = [];
  for(let i=start;i<=end;i++){
    result.push(hasLeadingZero ? String(i).padStart(pad,'0') : String(i));
  }
  return result;
}
function renderParkingTypesTable() {
  const body = document.getElementById('admin-parking-body');
  if(!body) return;
  const filterBld = +document.getElementById('admin-parking-building-filter').value || 0;
  let list = [...PARKING_TYPES];
  if(filterBld) list = list.filter(t=>t.building_id===filterBld);
  list.sort((a,b)=>a.building_id-b.building_id||(a.floor_label||'').localeCompare(b.floor_label||'')||(a.zone_label||'').localeCompare(b.zone_label||''));
  if(!list.length){
    body.innerHTML='<tr><td colspan="6" class="empty-state">Өгөгдөл байхгүй</td></tr>';
    return;
  }
  body.innerHTML = list.map(t=>{
    const bld = BUILDINGS.find(b=>b.id===t.building_id);
    const nums = Array.isArray(t.spot_numbers) ? t.spot_numbers : [];
    const numsPreview = nums.length>6 ? nums.slice(0,6).join(', ')+`... (${nums.length})` : nums.join(', ');
    return `<tr>
      <td class="dt-text">${bld?esc(bld.label):(t.building_id||'—')}</td>
      <td class="dt-text">${esc(t.floor_label)||'—'}</td>
      <td class="dt-text">${esc(t.zone_label)||'—'}</td>
      <td class="dt-title" style="font-size:12px">${esc(numsPreview)||'—'}</td>
      <td class="dt-title dt-mono">${t.sqm||'—'}</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="openEditParkingType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteParkingType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
function updateParkingPreview() {
  const el = document.getElementById('admin-parking-preview');
  if(!el) return;
  const hasFloor = document.getElementById('admin-parking-has-floor').checked;
  const hasZone = document.getElementById('admin-parking-has-zone').checked;
  const floors = hasFloor ? parseAffixRange(document.getElementById('admin-parking-floor-range').value) : [null];
  const zones = hasZone ? parseZoneRange(document.getElementById('admin-parking-zone-range').value) : [null];
  const numbers = parseNumberRange(document.getElementById('admin-parking-numbers').value);
  const combos = floors.length * zones.length;
  el.textContent = numbers.length ? `${combos} бүлэг үүснэ, нийт ${combos*numbers.length} зогсоол` : '';
}
function openAddParkingType() {
  editingParkingTypeId = null;
  document.getElementById('admin-parking-building').innerHTML = BUILDINGS.map(b=>`<option value="${b.id}">${esc(b.label)}</option>`).join('');
  document.getElementById('admin-parking-has-building').checked = false;
  document.getElementById('admin-parking-building-wrap').style.display = 'none';
  document.getElementById('admin-parking-has-floor').checked = false;
  document.getElementById('admin-parking-floor-wrap').style.display = 'none';
  document.getElementById('admin-parking-floor-range').value = '';
  document.getElementById('admin-parking-has-zone').checked = false;
  document.getElementById('admin-parking-zone-wrap').style.display = 'none';
  document.getElementById('admin-parking-zone-range').value = '';
  document.getElementById('admin-parking-numbers').value = '';
  document.getElementById('admin-parking-sqm').value = '';
  document.getElementById('admin-parking-preview').textContent = '';
  document.getElementById('modal-admin-parking-title').textContent = 'Зогсоол нэмэх';
  ['admin-parking-floor-range','admin-parking-zone-range','admin-parking-numbers'].forEach(id=>{
    document.getElementById(id).oninput = updateParkingPreview;
  });
  openModal('modal-admin-parking');
}
function openEditParkingType(id) {
  const t = PARKING_TYPES.find(x=>x.id===id);
  if(!t) return;
  editingParkingTypeId = id;
  document.getElementById('admin-parking-building').innerHTML = BUILDINGS.map(b=>`<option value="${b.id}">${esc(b.label)}</option>`).join('');
  document.getElementById('admin-parking-has-building').checked = !!t.building_id;
  document.getElementById('admin-parking-building-wrap').style.display = t.building_id ? 'block' : 'none';
  if(t.building_id) document.getElementById('admin-parking-building').value = t.building_id;
  document.getElementById('admin-parking-has-floor').checked = !!t.floor_label;
  document.getElementById('admin-parking-floor-wrap').style.display = t.floor_label ? 'block' : 'none';
  document.getElementById('admin-parking-floor-range').value = t.floor_label||'';
  document.getElementById('admin-parking-has-zone').checked = !!t.zone_label;
  document.getElementById('admin-parking-zone-wrap').style.display = t.zone_label ? 'block' : 'none';
  document.getElementById('admin-parking-zone-range').value = t.zone_label||'';
  const nums = Array.isArray(t.spot_numbers) ? t.spot_numbers.join(',') : t.spot_numbers;
  document.getElementById('admin-parking-numbers').value = nums;
  document.getElementById('admin-parking-sqm').value = t.sqm||'';
  document.getElementById('admin-parking-preview').textContent = '';
  document.getElementById('modal-admin-parking-title').textContent = 'Зогсоол засах';
  openModal('modal-admin-parking');
}
async function saveParkingType() {
  const hasBuilding = document.getElementById('admin-parking-has-building').checked;
  const bldId = hasBuilding ? +document.getElementById('admin-parking-building').value : null;
  const numRaw = document.getElementById('admin-parking-numbers').value.trim();
  const sqm = parseFloat(document.getElementById('admin-parking-sqm').value) || null;
  if(!numRaw) { toast('Дугаарлалтын муж оруулна уу','error'); return; }
  const numbers = parseNumberRange(numRaw);

  if(editingParkingTypeId) {
    // Засах горим — энгийн, задаргаагүй шинэчлэлт (1 мөрийг л шинэчилнэ)
    const hasFloor = document.getElementById('admin-parking-has-floor').checked;
    const hasZone = document.getElementById('admin-parking-has-zone').checked;
    const row = {
      building_id: bldId,
      floor_label: hasFloor ? document.getElementById('admin-parking-floor-range').value.trim() : null,
      zone_label: hasZone ? document.getElementById('admin-parking-zone-range').value.trim() : null,
      spot_numbers: numbers, sqm
    };
    const {error} = await sb.from('parking_types').update(row).eq('id', editingParkingTypeId);
    if(error){toast('Алдаа: '+error.message,'error');return;}
    const idx = PARKING_TYPES.findIndex(t=>t.id===editingParkingTypeId);
    if(idx>=0) PARKING_TYPES[idx] = {...PARKING_TYPES[idx], ...row};
    toast('Зогсоол шинэчлэгдлээ ✓','success');
    closeModal('modal-admin-parking');
    renderParkingTypesTable();
    return;
  }

  // Шинээр нэмэх горим — Давхар × Бүс хослол бүр тусдаа мөр болж үүснэ
  const hasFloor = document.getElementById('admin-parking-has-floor').checked;
  const hasZone = document.getElementById('admin-parking-has-zone').checked;
  const floorRaw = document.getElementById('admin-parking-floor-range').value.trim();
  const zoneRaw = document.getElementById('admin-parking-zone-range').value.trim();
  if(hasFloor && !floorRaw) { toast('Давхрын муж оруулна уу','error'); return; }
  if(hasZone && !zoneRaw) { toast('Бүсчлэлийн муж оруулна уу','error'); return; }
  const floors = hasFloor ? parseAffixRange(floorRaw) : [null];
  const zones = hasZone ? parseZoneRange(zoneRaw) : [null];

  const rows = [];
  for(const floor of floors) {
    for(const zone of zones) {
      rows.push({building_id: bldId, floor_label: floor, zone_label: zone, spot_numbers: numbers, sqm});
    }
  }

  const {data, error} = await sb.from('parking_types').insert(rows).select();
  if(error){toast('Алдаа: '+error.message,'error');return;}
  PARKING_TYPES.push(...data);
  closeModal('modal-admin-parking');
  renderParkingTypesTable();
  toast(`${rows.length} бүлэг, нийт ${rows.length*numbers.length} зогсоол нэмэгдлээ ✓`,'success');
}
async function deleteParkingType(id) {
  if(!confirm('Энэ зогсоолыг устгах уу?')) return;
  const {error} = await sb.from('parking_types').delete().eq('id', id);
  if(error){toast('Устгахад алдаа: '+error.message,'error');return;}
  PARKING_TYPES = PARKING_TYPES.filter(t=>t.id!==id);
  renderParkingTypesTable();
  toast('Устгагдлаа','success');
}
// ============================================================
// ЗОГСООЛ СОНГОГЧ — Сууц өмчлөгч, Аж ахуйн нэгжийн бүртгэлд ХАМТДАА ашиглагдана
// ============================================================
// SPOT_KEY_MAP: 'parking' -> PARKING_TYPES массив + spot_numbers талбар + өмчлөгчийн 'parkings' талбар;
// 'storage' -> STORAGE_TYPES массив + unit_numbers талбар + өмчлөгчийн 'storages' талбар.
// Зогсоол, Агуулах хоёул ЯГ ИЖИЛ логикоор ажилладаг тул НЭГ л бүрэлдэхүүн хэсэг хоёуланд хүрдэг.
function _spotTypesArr(kind) { return kind==='storage' ? STORAGE_TYPES : PARKING_TYPES; }
function _spotNumField(kind) { return kind==='storage' ? 'unit_numbers' : 'spot_numbers'; }
function _spotOwnerField(kind) { return kind==='storage' ? 'storages' : 'parkings'; }
function spotFullLabel(floor, zone, num) {
  return [floor, zone, num].filter(Boolean).join('-');
}
function getSpotOwner(kind, fullLabel, excludeType, excludeId) {
  const ownerField = _spotOwnerField(kind);
  for(const r of residents) {
    if(!r) continue;
    if(excludeType==='resident' && r.id===excludeId) continue;
    if((r[ownerField]||[]).includes(fullLabel)) return {type:'resident', obj:r};
  }
  for(const b of businesses) {
    if(!b) continue;
    if(excludeType==='business' && b.id===excludeId) continue;
    if((b[ownerField]||[]).includes(fullLabel)) return {type:'business', obj:b};
  }
  return null;
}
let _spotRowCounter = 0;
function renderSpotPickerRow(kind, containerId, existingFullLabel, excludeType, excludeId) {
  const uid = ++_spotRowCounter;
  const typesArr = _spotTypesArr(kind);
  const numField = _spotNumField(kind);
  const floors = [...new Set(typesArr.map(t=>t.floor_label).filter(Boolean))];
  let initFloor = '', initZone = '', initNum = '';
  if(existingFullLabel) {
    typesArr.forEach(t=>{
      (t[numField]||[]).forEach(n=>{
        if(spotFullLabel(t.floor_label,t.zone_label,n) === existingFullLabel) {
          initFloor = t.floor_label||''; initZone = t.zone_label||''; initNum = n;
        }
      });
    });
    if(!initFloor && !initZone) initNum = existingFullLabel;
  }
  const row = document.createElement('div');
  row.className = 'spot-row';
  row.dataset.kind = kind;
  row.dataset.excludeType = excludeType||'';
  row.dataset.excludeId = excludeId||'';
  row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
  row.innerHTML = `
    ${floors.length ? `<select class="spot-floor-sel" style="width:auto;font-size:12px" onchange="onSpotFloorChange(this)">
      <option value="">Давхар</option>
      ${floors.map(f=>`<option value="${esc(f)}" ${f===initFloor?'selected':''}>${esc(f)}</option>`).join('')}
    </select>` : ''}
    <select class="spot-zone-sel" style="width:auto;font-size:12px;display:none" onchange="onSpotZoneChange(this)"></select>
    <input type="text" class="spot-num-input" list="spot-num-list-${uid}" placeholder="Дугаар" value="${esc(initNum)}" style="width:80px;text-align:center;font-size:13px" oninput="onSpotNumInput(this)">
    <datalist id="spot-num-list-${uid}"></datalist>
    <button type="button" onclick="this.closest('.spot-row').remove()" class="btn btn-ghost btn-sm" style="color:var(--danger);font-size:14px;padding:4px 8px">×</button>
  `;
  document.getElementById(containerId).appendChild(row);
  populateSpotZoneOptions(row, initFloor, initZone);
  populateSpotNumOptions(row, initFloor, initZone);
}
function onSpotFloorChange(sel) {
  const row = sel.closest('.spot-row');
  populateSpotZoneOptions(row, sel.value, '');
  populateSpotNumOptions(row, sel.value, '');
}
function onSpotZoneChange(sel) {
  const row = sel.closest('.spot-row');
  const floorSel = row.querySelector('.spot-floor-sel');
  populateSpotNumOptions(row, floorSel?floorSel.value:'', sel.value);
}
function onSpotNumInput(input) {
  const row = input.closest('.spot-row');
  const floorSel = row.querySelector('.spot-floor-sel');
  const zoneSel = row.querySelector('.spot-zone-sel');
  populateSpotNumOptions(row, floorSel?floorSel.value:'', zoneSel?zoneSel.value:'');
}
function populateSpotZoneOptions(row, floor, selectedZone) {
  const zoneSel = row.querySelector('.spot-zone-sel');
  if(!zoneSel) return;
  const kind = row.dataset.kind;
  const typesArr = _spotTypesArr(kind);
  const zones = [...new Set(typesArr.filter(t=>(t.floor_label||'')===(floor||'')).map(t=>t.zone_label).filter(Boolean))];
  zoneSel.style.display = zones.length ? '' : 'none';
  zoneSel.innerHTML = '<option value="">Бүс</option>' + zones.map(z=>`<option value="${esc(z)}" ${z===selectedZone?'selected':''}>${esc(z)}</option>`).join('');
}
function populateSpotNumOptions(row, floor, zone) {
  const kind = row.dataset.kind;
  const typesArr = _spotTypesArr(kind);
  const numField = _spotNumField(kind);
  const numInput = row.querySelector('.spot-num-input');
  const datalist = row.querySelector('datalist');
  const matching = typesArr.find(t => (t.floor_label||'')===(floor||'') && (t.zone_label||'')===(zone||''));
  if(!matching) { datalist.innerHTML = ''; return; }
  const excludeType = row.dataset.excludeType, excludeId = row.dataset.excludeId ? +row.dataset.excludeId : null;
  const currentVal = numInput.value.trim();
  const available = (matching[numField]||[]).filter(n=>{
    if(n === currentVal) return true;
    const full = spotFullLabel(floor, zone, n);
    return !getSpotOwner(kind, full, excludeType, excludeId);
  });
  datalist.innerHTML = available.map(n=>`<option value="${esc(n)}">`).join('');
}
function collectSpotValues(containerId) {
  const rows = document.querySelectorAll('#'+containerId+' .spot-row');
  const result = [];
  rows.forEach(row=>{
    const floorSel = row.querySelector('.spot-floor-sel');
    const zoneSel = row.querySelector('.spot-zone-sel');
    const num = row.querySelector('.spot-num-input').value.trim();
    if(num) result.push(spotFullLabel(floorSel?floorSel.value:'', zoneSel?zoneSel.value:'', num));
  });
  return result;
}
function validateSpotAssignment(kind, values, excludeType, excludeId) {
  const typesArr = _spotTypesArr(kind);
  const numField = _spotNumField(kind);
  const label = kind==='storage' ? 'агуулах' : 'зогсоол';
  const allValid = new Set();
  typesArr.forEach(t=>(t[numField]||[]).forEach(n=>allValid.add(spotFullLabel(t.floor_label,t.zone_label,n))));
  for(const full of values) {
    if(!allValid.has(full)) return `"${full}" гэсэн ${label} бүртгэлд олдсонгүй`;
    const owner = getSpotOwner(kind, full, excludeType, excludeId);
    if(owner) return `"${full}" ${label} аль хэдийн эзэнтэй байна`;
  }
  return null;
}
// Тухайн эзэмшигдсэн дугаарын (жишээ "B1-A-001") харгалзах м²-г Хаягжилт тохиргооноос олно
function getSpotSqm(kind, fullLabel) {
  const typesArr = _spotTypesArr(kind);
  const numField = _spotNumField(kind);
  for(const t of typesArr) {
    if((t[numField]||[]).some(n=>spotFullLabel(t.floor_label,t.zone_label,n)===fullLabel)) return +t.sqm||0;
  }
  return 0;
}
// ============================================================
// АГУУЛАХ (Storage types) — apt_types-тэй яг ижил загвар
// ============================================================
let editingStorageTypeId = null;
function renderStorageTypesTable() {
  const body = document.getElementById('admin-storage-body');
  if(!body) return;
  const filterBld = +document.getElementById('admin-storage-building-filter').value || 0;
  let list = [...STORAGE_TYPES];
  if(filterBld) list = list.filter(t=>t.building_id===filterBld);
  list.sort((a,b)=>a.building_id-b.building_id||(a.floor_label||'').localeCompare(b.floor_label||'')||(a.zone_label||'').localeCompare(b.zone_label||''));
  if(!list.length){
    body.innerHTML='<tr><td colspan="6" class="empty-state">Өгөгдөл байхгүй</td></tr>';
    return;
  }
  body.innerHTML = list.map(t=>{
    const bld = BUILDINGS.find(b=>b.id===t.building_id);
    const nums = Array.isArray(t.unit_numbers) ? t.unit_numbers : [];
    const numsPreview = nums.length>6 ? nums.slice(0,6).join(', ')+`... (${nums.length})` : nums.join(', ');
    return `<tr>
      <td class="dt-text">${bld?esc(bld.label):(t.building_id||'—')}</td>
      <td class="dt-text">${esc(t.floor_label)||'—'}</td>
      <td class="dt-text">${esc(t.zone_label)||'—'}</td>
      <td class="dt-title" style="font-size:12px">${esc(numsPreview)||'—'}</td>
      <td class="dt-title dt-mono">${t.sqm||'—'}</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="openEditStorageType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteStorageType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
function updateStoragePreview() {
  const el = document.getElementById('admin-storage-preview');
  if(!el) return;
  const hasFloor = document.getElementById('admin-storage-has-floor').checked;
  const hasZone = document.getElementById('admin-storage-has-zone').checked;
  const floors = hasFloor ? parseAffixRange(document.getElementById('admin-storage-floor-range').value) : [null];
  const zones = hasZone ? parseZoneRange(document.getElementById('admin-storage-zone-range').value) : [null];
  const numbers = parseNumberRange(document.getElementById('admin-storage-numbers').value);
  const combos = floors.length * zones.length;
  el.textContent = numbers.length ? `${combos} бүлэг үүснэ, нийт ${combos*numbers.length} агуулах` : '';
}
function openAddStorageType() {
  editingStorageTypeId = null;
  document.getElementById('admin-storage-building').innerHTML = BUILDINGS.map(b=>`<option value="${b.id}">${esc(b.label)}</option>`).join('');
  document.getElementById('admin-storage-has-building').checked = false;
  document.getElementById('admin-storage-building-wrap').style.display = 'none';
  document.getElementById('admin-storage-has-floor').checked = false;
  document.getElementById('admin-storage-floor-wrap').style.display = 'none';
  document.getElementById('admin-storage-floor-range').value = '';
  document.getElementById('admin-storage-has-zone').checked = false;
  document.getElementById('admin-storage-zone-wrap').style.display = 'none';
  document.getElementById('admin-storage-zone-range').value = '';
  document.getElementById('admin-storage-numbers').value = '';
  document.getElementById('admin-storage-sqm').value = '';
  document.getElementById('admin-storage-preview').textContent = '';
  document.getElementById('modal-admin-storage-title').textContent = 'Агуулах нэмэх';
  ['admin-storage-floor-range','admin-storage-zone-range','admin-storage-numbers'].forEach(id=>{
    document.getElementById(id).oninput = updateStoragePreview;
  });
  openModal('modal-admin-storage');
}
function openEditStorageType(id) {
  const t = STORAGE_TYPES.find(x=>x.id===id);
  if(!t) return;
  editingStorageTypeId = id;
  document.getElementById('admin-storage-building').innerHTML = BUILDINGS.map(b=>`<option value="${b.id}">${esc(b.label)}</option>`).join('');
  document.getElementById('admin-storage-has-building').checked = !!t.building_id;
  document.getElementById('admin-storage-building-wrap').style.display = t.building_id ? 'block' : 'none';
  if(t.building_id) document.getElementById('admin-storage-building').value = t.building_id;
  document.getElementById('admin-storage-has-floor').checked = !!t.floor_label;
  document.getElementById('admin-storage-floor-wrap').style.display = t.floor_label ? 'block' : 'none';
  document.getElementById('admin-storage-floor-range').value = t.floor_label||'';
  document.getElementById('admin-storage-has-zone').checked = !!t.zone_label;
  document.getElementById('admin-storage-zone-wrap').style.display = t.zone_label ? 'block' : 'none';
  document.getElementById('admin-storage-zone-range').value = t.zone_label||'';
  const nums = Array.isArray(t.unit_numbers) ? t.unit_numbers.join(',') : t.unit_numbers;
  document.getElementById('admin-storage-numbers').value = nums;
  document.getElementById('admin-storage-sqm').value = t.sqm||'';
  document.getElementById('admin-storage-preview').textContent = '';
  document.getElementById('modal-admin-storage-title').textContent = 'Агуулах засах';
  openModal('modal-admin-storage');
}
async function saveStorageType() {
  const hasBuilding = document.getElementById('admin-storage-has-building').checked;
  const bldId = hasBuilding ? +document.getElementById('admin-storage-building').value : null;
  const numRaw = document.getElementById('admin-storage-numbers').value.trim();
  const sqm = parseFloat(document.getElementById('admin-storage-sqm').value) || null;
  if(!numRaw) { toast('Дугаарлалтын муж оруулна уу','error'); return; }
  const numbers = parseNumberRange(numRaw);

  if(editingStorageTypeId) {
    const hasFloor = document.getElementById('admin-storage-has-floor').checked;
    const hasZone = document.getElementById('admin-storage-has-zone').checked;
    const row = {
      building_id: bldId,
      floor_label: hasFloor ? document.getElementById('admin-storage-floor-range').value.trim() : null,
      zone_label: hasZone ? document.getElementById('admin-storage-zone-range').value.trim() : null,
      unit_numbers: numbers, sqm
    };
    const {error} = await sb.from('storage_types').update(row).eq('id', editingStorageTypeId);
    if(error){toast('Алдаа: '+error.message,'error');return;}
    const idx = STORAGE_TYPES.findIndex(t=>t.id===editingStorageTypeId);
    if(idx>=0) STORAGE_TYPES[idx] = {...STORAGE_TYPES[idx], ...row};
    toast('Агуулах шинэчлэгдлээ ✓','success');
    closeModal('modal-admin-storage');
    renderStorageTypesTable();
    return;
  }

  const hasFloor = document.getElementById('admin-storage-has-floor').checked;
  const hasZone = document.getElementById('admin-storage-has-zone').checked;
  const floorRaw = document.getElementById('admin-storage-floor-range').value.trim();
  const zoneRaw = document.getElementById('admin-storage-zone-range').value.trim();
  if(hasFloor && !floorRaw) { toast('Давхрын муж оруулна уу','error'); return; }
  if(hasZone && !zoneRaw) { toast('Бүсчлэлийн муж оруулна уу','error'); return; }
  const floors = hasFloor ? parseAffixRange(floorRaw) : [null];
  const zones = hasZone ? parseZoneRange(zoneRaw) : [null];

  const rows = [];
  for(const floor of floors) {
    for(const zone of zones) {
      rows.push({building_id: bldId, floor_label: floor, zone_label: zone, unit_numbers: numbers, sqm});
    }
  }

  const {data, error} = await sb.from('storage_types').insert(rows).select();
  if(error){toast('Алдаа: '+error.message,'error');return;}
  STORAGE_TYPES.push(...data);
  closeModal('modal-admin-storage');
  renderStorageTypesTable();
  toast(`${rows.length} бүлэг, нийт ${rows.length*numbers.length} агуулах нэмэгдлээ ✓`,'success');
}
async function deleteStorageType(id) {
  if(!confirm('Энэ агуулахыг устгах уу?')) return;
  const {error} = await sb.from('storage_types').delete().eq('id', id);
  if(error){toast('Устгахад алдаа: '+error.message,'error');return;}
  STORAGE_TYPES = STORAGE_TYPES.filter(t=>t.id!==id);
  renderStorageTypesTable();
  toast('Устгагдлаа','success');
}
