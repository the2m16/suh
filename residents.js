// residents.js — Сууц өмчлөгч, Байр, Тоотын төрлийн модуль (suh.html-ээс тусгаарлав)

async function db_loadResidents() {
  const {data,error} = await sb.from('residents').select('*').order('apt');
  if(error){console.error('residents load error:', JSON.stringify(error), error.message, error.code, error.details);return;}
  if(!data){console.error("residents: data is null");return;}
  residents = data.map(r=>({
    id:r.id, dbId:r.id, building:r.building, floor:r.floor, door:r.door, entrance:r.entrance, apt:r.apt,
    firstname:r.firstname||"", lastname:r.lastname||"", reg:r.reg||'', oeubd:r.oeubd||'', ownDate:r.own_date||'',
    phones:r.phones||[], emails:r.emails||[], phone:(r.phones||[])[0]||'',
    email:(r.emails||[])[0]||'', people:r.people||1, child1:r.child1||0, child2:r.child2||0, note:r.note||'',
    parkings:r.parkings||[], storages:r.storages||[], vehicles:r.vehicles||[]
  }));
}

async function db_saveResident(r) {
  const row = {
    building:r.building, floor:r.floor, door:r.door, entrance:r.entrance, apt:r.apt,
    firstname:r.firstname||"", lastname:r.lastname||"", reg:r.reg, oeubd:r.oeubd, own_date:r.ownDate,
    phones:r.phones, emails:r.emails, people:r.people,
    child1:r.child1||0, child2:r.child2||0, note:r.note||'',
    parkings:r.parkings, storages:r.storages, vehicles:r.vehicles
  };
  if(r.dbId) {
    // Байгаа мөрийг id-аар UPDATE — .select() ашиглаж RLS-ээс болж 0 мөр өөрчлөгдсөнийг илрүүлнэ
    const {data, error} = await sb.from('residents').update(row).eq('id', r.dbId).select();
    if(error) { console.error('resident update error:', error.message); return false; }
    if(!data || data.length === 0) { console.warn('resident update: 0 мөр — эрхгүй байж болзошгүй'); return false; }
    return true;
  } else {
    // Шинэ мөр INSERT
    const {data, error} = await sb.from('residents').insert(row).select().single();
    if(error){console.error('resident insert error:', error.message); return false;}
    if(data) r.dbId = data.id;
    return true;
  }
}

let editingResidentId = null;

let selectedBuilding = 101;

let BUILDINGS = [];  // Supabase-аас ачаална

let APT_TYPES = [];  // Supabase-аас ачаална

const GROUP_COLORS = {
  A: {bg:'rgba(245,158,11,0.12)', border:'#F59E0B', text:'#F59E0B'},
  B: {bg:'rgba(59,130,246,0.12)', border:'#3B82F6', text:'#3B82F6'},
  C: {bg:'rgba(100,116,139,0.12)', border:'#64748B', text:'#94A3B8'},
  D: {bg:'rgba(239,68,68,0.12)', border:'#EF4444', text:'#EF4444'},
  E: {bg:'rgba(168,85,247,0.12)', border:'#A855F7', text:'#A855F7'},
  F: {bg:'rgba(20,184,166,0.12)', border:'#14B8A6', text:'#14B8A6'},
};

async function db_loadBuildings() {
  const {data, error} = await sb.from('buildings').select('*').order('id');
  if(error){console.error('buildings load error:', error.message); return;}
  if(!data || data.length === 0){console.warn('buildings: хоосон'); return;}
  BUILDINGS = data.map(b=>({
    id: b.id,
    floors: b.floors,
    aptsPerFloor: b.apts_per_floor,
    group: b.group_name || 'A',
    label: b.label,
    entrances: b.entrances || 1,
    numbering_scheme: b.numbering_scheme || 'floor_door',
    seq_start: b.seq_start || 101
  }));
  // buildings ачаалагдсаны дараа select-уудыг шинэчлэх
  populateBuildingSelects();
}

async function db_loadAptTypes() {
  const {data, error} = await sb.from('apt_types').select('*');
  if(error){console.error('apt_types load error:', error.message); return;}
  APT_TYPES = data || [];
}

function populateBuildingSelects() {
  const configs = [
    {id: 'res-building', withEmpty: false},
    {id: 'pay-building-select', withEmpty: true},
    {id: 'admin-at-building', withEmpty: false},
    {id: 'admin-apttype-building-filter', withEmpty: true, emptyLabel: 'Бүх байр'},
  ];
  configs.forEach(({id, withEmpty, emptyLabel}) => {
    const el = document.getElementById(id);
    if(!el) return;
    const cur = el.value;
    const emptyText = emptyLabel || '— Байр сонгох —';
    const emptyOpt = withEmpty ? `<option value="">${emptyText}</option>` : '';
    el.innerHTML = emptyOpt + BUILDINGS.map(b=>`<option value="${b.id}">${esc(b.label)||b.id+'-р байр'}</option>`).join('');
    if(cur) el.value = cur;
  });
}

// Сонгосон байрны бодит давхар (buildings.floors) болон тоот (apt_types.door_numbers)-оос
// л сонгодог болгож, Байр→(Орц)→Давхар→Тоот-ыг Зогсоол/Агуулахтай ижил зарчмаар холбоно
function onResBuildingChange(keepFloor, keepDoor, keepEntrance) {
  const bldId = +document.getElementById('res-building').value;
  const bld = BUILDINGS.find(b=>b.id===bldId);
  const entranceWrap = document.getElementById('res-entrance-wrap');
  const entranceSel = document.getElementById('res-entrance');
  const entrances = bld?.entrances || 1;
  if(entrances > 1) {
    entranceWrap.style.display = 'block';
    const opts = [];
    for(let e=1; e<=entrances; e++) opts.push(e);
    entranceSel.innerHTML = opts.map(e=>`<option value="${e}">${e}-р орц</option>`).join('');
    if(keepEntrance && opts.includes(+keepEntrance)) entranceSel.value = keepEntrance;
  } else {
    entranceWrap.style.display = 'none';
    entranceSel.innerHTML = '';
  }

  const floorSel = document.getElementById('res-floor');
  const doorSel = document.getElementById('res-apt');
  const floorCount = bld?.floors || 0;
  const floorOpts = [];
  for(let f=1; f<=floorCount; f++) floorOpts.push(f);
  floorSel.innerHTML = floorOpts.map(f=>`<option value="${f}">${f}</option>`).join('');
  if(keepFloor && floorOpts.includes(+keepFloor)) floorSel.value = keepFloor;

  const doors = new Set();
  APT_TYPES.filter(t=>t.building_id===bldId).forEach(t=>(t.door_numbers||[]).forEach(d=>doors.add(d)));
  const doorOpts = [...doors].sort((a,b)=>a-b);
  doorSel.innerHTML = doorOpts.map(d=>`<option value="${d}">${d}</option>`).join('');
  if(keepDoor && doorOpts.includes(+keepDoor)) doorSel.value = keepDoor;
}
function onResEntranceChange() {} // Орц нь Давхар/Тоотын мужид нөлөөлдөггүй, зөвхөн бүртгэлд хадгалагдана

function getSqmByBuildingAndDoor(buildingId, doorNum) {
  const types = APT_TYPES.filter(t => t.building_id === buildingId);
  for(const t of types) {
    const doors = Array.isArray(t.door_numbers) ? t.door_numbers : [];
    if(doors.includes(doorNum)) return parseFloat(t.sqm) || 0;
  }
  // Fallback: хэрэв apt_types хоосон бол хуучин логик хэрэглэнэ
  if (buildingId >= 101 && buildingId <= 104) {
    return (doorNum===3||doorNum===4) ? 49.95 : 55.04;
  } else if (buildingId >= 105 && buildingId <= 109) {
    return (doorNum===1||doorNum===4) ? 117.67 : 117.83;
  } else if (buildingId >= 110 && buildingId <= 114) {
    return (doorNum===1||doorNum===4) ? 95.71 : 95.86;
  } else if (buildingId >= 115 && buildingId <= 118) {
    return (doorNum===1||doorNum===4) ? 69.92 : 79.98;
  }
  return 0;
}

function aptLabel(buildingId, floor, door, entrance) {
  if(entrance) return `${entrance}-${floor}${String(door).padStart(2,'0')}`;
  return `${floor}${String(door).padStart(2,'0')}`;
}

function getOverdueResidents(month = CUR_MONTH, year = CUR_YEAR) {
  const monthTx = transactions.filter(t=>t&&t.month===month&&t.year===year);
  const paidApts = [...new Set(monthTx.filter(t=>t.type==='income'&&t.category==='resident').map(t=>String(t.apt)))];
  return residents.filter(r=>r&&!paidApts.includes(String(r.apt)));
}

function residentSqm(r){ return getSqmByBuildingAndDoor(r.building, r.door); }

function renderResidents(filter='') {
  const body = document.getElementById('residents-table-body');
  if(!body) return;
  if(!Array.isArray(residents)) return;
  const canEditRes = canWrite('residents'), canDelRes = canDelete('residents');
  const list = filter ? residents.filter(r=>{
    if(!r) return false;
    const q = filter;
    return (r.firstname||'').toLowerCase().includes(q)||(r.lastname||'').toLowerCase().includes(q)||(r.owner||'').toLowerCase().includes(q)
      || String(r.building).includes(q)
      || String(r.apt).includes(q)
      || (r.phones||[r.phone||'']).join(' ').includes(q)
      || (r.parkings||[]).join(' ').toLowerCase().includes(q)
      || (r.storages||[]).join(' ').toLowerCase().includes(q)
      || (r.vehicles||[]).join(' ').toLowerCase().includes(q);
  }) : residents;
  if(!list.length){body.innerHTML='<tr><td colspan="17" style="text-align:center;padding:28px;color:var(--text-muted)">Сууц өмчлөгч олдсонгүй</td></tr>';return;}
  const paidThisMonth=transactions.filter(t=>t&&t.type==='income'&&t.category==='resident'&&t.month===CUR_MONTH&&t.year===CUR_YEAR).map(t=>String(t.apt));
  const MONTHS=[1,2,3,4,5,6,7,8,9,10,11,12];
  body.innerHTML=list.map((r,idx)=>{
    const sqm=residentSqm(r);const aptId=r.apt;const paid=paidThisMonth.map(String).includes(String(aptId));
    const phones=r.phones||[r.phone||''];
    const parkings=r.parkings||[];const storages=r.storages||[];
    const monthBadges=MONTHS.map(m=>{
      const wasPaid=transactions.some(t=>t&&String(t.apt)===String(aptId)&&t.type==='income'&&t.category==='resident'&&t.month===m&&t.year===CUR_YEAR);
      const isFuture=m>CUR_MONTH;
      const cls=isFuture?'future':(wasPaid?'paid':'unpaid');
      return `<span class="mbadge ${cls}" title="${m}-р сар">${m}</span>`;
    }).join('');
    return `<tr style="cursor:pointer" onclick="openResidentDetail(${r.id})">
      <td><div class="avatar" style="width:24px;height:24px;font-size:10px;background:${paid?'rgba(59,130,246,0.18)':'rgba(239,68,68,0.15)'};color:${paid?'#3B82F6':'#EF4444'}">${idx+1}</div></td>
      <td><span class="dt-title dt-mono">${r.building}</span></td>
      <td><span class="dt-title dt-mono">${String(r.apt)}</span></td>
      <td class="dt-text" style="white-space:nowrap">${sqm}<span class="dt-muted"> м²</span></td>
      <td class="dt-title">${esc(r.firstname)||'—'}</td><td class="dt-text">${esc(r.lastname)||'—'}</td>
      <td class="dt-text dt-mono">${esc(phones[0])||'—'}${phones.length>1?`<br><span class="dt-muted">+${phones.length-1}</span>`:''}</td>
      <td class="dt-text">${esc((r.emails||[r.email||'']).filter(Boolean)[0])||'—'}</td>
      <td class="dt-text">${esc(r.ownDate)||'—'}</td>
      <td class="dt-text" style="text-align:center">${r.people}</td>
      <td class="dt-text" style="text-align:center">${r.child1||0}</td>
      <td class="dt-text" style="text-align:center">${r.child2||0}</td>
      <td class="dt-muted">${parkings.length?parkings.map(esc).join('<br>'):'—'}</td>
      <td class="dt-muted">${storages.length?storages.map(esc).join('<br>'):'—'}</td>
      <td class="dt-muted">${(r.vehicles||[]).length?r.vehicles.map(esc).join(", "):"—"}</td>
      <td><div class="month-badges">${monthBadges}</div></td>
      <td><div class="flex gap-8">
        ${canEditRes?`<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editResident(${r.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`:''}
        ${canDelRes?`<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteResident(${r.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>`:''}
        ${!canEditRes&&!canDelRes?'<span style="color:var(--text-muted);font-size:11px">—</span>':''}
      </div></td>
    </tr>`;
  }).join('');
  const paid2=list.filter(r=>paidThisMonth.includes(String(r.apt))).length;
  const e1=document.getElementById('res-stat-total');const e2=document.getElementById('res-stat-paid');const e3=document.getElementById('res-stat-unpaid');
  if(e1)e1.textContent='Нийт: '+list.length+' өмчлөгч';
  if(e2)e2.innerHTML='<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--success);margin-right:5px;vertical-align:middle"></span>Төлбөрийн үлдэгдэлгүй: '+paid2;
  if(e3)e3.innerHTML='<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--danger);margin-right:5px;vertical-align:middle"></span>Төлбөрийн үлдэгдэлтэй: '+(list.length-paid2);
}

function filterResidents(){renderResidents(document.getElementById('resident-search').value.toLowerCase());}

function resetResidentModal() {
  // Утас
  document.getElementById('phone-rows').innerHTML=`<div class="phone-row" style="display:flex;gap:6px;margin-bottom:6px"><input type="tel" class="res-phone-input" placeholder="99001234" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="removeRow(this,'phone-row')" style="color:var(--danger);font-size:14px;padding:4px 8px">×</button></div>`;
  // И-мэйл
  document.getElementById('email-rows').innerHTML=`<div class="email-row" style="display:flex;gap:6px;margin-bottom:6px"><input type="email" class="res-email-input" placeholder="email@example.mn" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="removeRow(this,'email-row')" style="color:var(--danger);font-size:14px;padding:4px 8px">×</button></div>`;
  // Агуулах
  document.getElementById('res-has-storage').checked=false;
  document.getElementById('storage-section').style.display='none';
  document.getElementById('storage-rows').innerHTML='';
  // Зогсоол
  document.getElementById('res-has-parking').checked=false;
  document.getElementById('parking-section').style.display='none';
  document.getElementById('parking-rows').innerHTML='';
  document.getElementById('res-vehicle-rows').innerHTML = '';
  const hv=document.getElementById('res-has-vehicle');
  if(hv){hv.checked=false;document.getElementById('vehicle-section').style.display='none';}
  // Бусад
  ['res-building','res-floor','res-apt','res-firstname','res-lastname','res-reg','res-oeubd-letter','res-oeubd-num','res-own-date','res-child1','res-child2'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('res-building').value='101';
  onResBuildingChange();
  document.getElementById('res-people').value='2';
  const c1=document.getElementById('res-child1'); if(c1) c1.value='0';
  const c2=document.getElementById('res-child2'); if(c2) c2.value='0';
}

function openAddResident() {
  if(!canWrite('residents')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingResidentId = null;
  document.getElementById('modal-resident-title').textContent='Сууц өмчлөгч нэмэх';
  resetResidentModal();
  openModal('modal-resident');
}

function editResident(id) {
  if(!canWrite('residents')) { toast('Танд энэ үйлдлийг хийх эрх байхгүй байна','error'); return; }
  editingResidentId = id;
  const r = residents.find(x=>x.id===id); if(!r) return;
  document.getElementById('modal-resident-title').textContent='Сууц өмчлөгч засах';
  resetResidentModal();
  document.getElementById('res-building').value=r.building;
  onResBuildingChange(r.floor, r.door, r.entrance);
  document.getElementById('res-firstname').value = r.firstname||'';
  document.getElementById('res-lastname').value = r.lastname||'';
  if(document.getElementById('res-child1')) document.getElementById('res-child1').value=r.child1||0;
  if(document.getElementById('res-child2')) document.getElementById('res-child2').value=r.child2||0;
  document.getElementById('res-reg').value=r.reg||'';
  // ӨЭУБД хоёр талбарт задлах
  const oeubd=r.oeubd||'';
  document.getElementById('res-oeubd-letter').value=oeubd.length>0?oeubd[0]:'';
  document.getElementById('res-oeubd-num').value=oeubd.length>1?oeubd.slice(1):'';
  document.getElementById('res-own-date').value=r.ownDate||'';
  document.getElementById('res-people').value=r.people;
  // res-note хасагдсан учраас алгасна
  // Утас
  const phones=r.phones||[r.phone||''];
  document.getElementById('phone-rows').innerHTML='';
  phones.forEach(p=>addPhoneRow(p));
  // И-мэйл
  const emails=r.emails||[r.email||''];
  document.getElementById('email-rows').innerHTML='';
  emails.forEach(e=>addEmailRow(e));
  // Агуулах
  if(r.storages&&r.storages.length){
    document.getElementById('res-has-storage').checked=true;
    document.getElementById('storage-section').style.display='block';
    document.getElementById('storage-rows').innerHTML='';
    r.storages.forEach(s=>renderSpotPickerRow('storage', 'storage-rows', s, 'resident', r.id));
  }
  // Зогсоол
  if(r.parkings&&r.parkings.length){
    document.getElementById('res-has-parking').checked=true;
    document.getElementById('parking-section').style.display='block';
    document.getElementById('parking-rows').innerHTML='';
    r.parkings.forEach(p=>renderSpotPickerRow('parking', 'parking-rows', p, 'resident', r.id));
  }
  // Машин
  document.getElementById('res-vehicle-rows').innerHTML='';
  const hv=document.getElementById('res-has-vehicle');
  if(r.vehicles&&r.vehicles.length){
    if(hv){hv.checked=true;document.getElementById('vehicle-section').style.display='block';}
    r.vehicles.forEach(v=>addVehicleRow('res-vehicle-rows',v));
  } else {
    if(hv){hv.checked=false;document.getElementById('vehicle-section').style.display='none';}
  }
  openModal('modal-resident');
}

async function saveResident() {
  const building=+document.getElementById('res-building').value;
  const floor=+document.getElementById('res-floor').value;
  const door=+document.getElementById('res-apt').value;
  const entrance=+(document.getElementById('res-entrance').value)||null;
  const firstname = document.getElementById('res-firstname').value.trim();
  const lastname = document.getElementById('res-lastname').value.trim();
  if(!building||!floor||!door||!firstname){toast('Байр, давхар, хаалга, өмчлөгчийн нэрийг оруулна уу','error');return;}
  const aptId = makeAptId(building,floor,door,entrance);
  // ӨЭУБД нэгтгэх
  const oeubdLetter=document.getElementById('res-oeubd-letter').value.trim().toUpperCase();
  const oeubdNum=document.getElementById('res-oeubd-num').value.trim();
  const oeubd=oeubdLetter+oeubdNum;
  // Утас
  const phones=[...document.querySelectorAll('.res-phone-input')].map(i=>i.value.trim()).filter(Boolean);
  // И-мэйл
  const emails=[...document.querySelectorAll('.res-email-input')].map(i=>i.value.trim()).filter(Boolean);
  // Агуулах
  const storages=document.getElementById('res-has-storage').checked
    ? collectSpotValues('storage-rows')
    : [];
  // Зогсоол
  const parkings=document.getElementById('res-has-parking').checked
    ? collectSpotValues('parking-rows')
    : [];
  const data={building,floor,door,entrance,apt:aptId,firstname,lastname,dbId:editingResidentId?residents.find(r=>r.id===editingResidentId)?.dbId:null,
    reg:document.getElementById('res-reg').value.trim(),
    oeubd,
    ownDate:document.getElementById('res-own-date').value,
    phones,emails,
    phone:phones[0]||'',email:emails[0]||'',
    vehicles: getVehicles('res-vehicle-rows'),
    people:+document.getElementById('res-people').value,
    child1:+(document.getElementById('res-child1')?.value||0),
    child2:+(document.getElementById('res-child2')?.value||0),
    storages,parkings};
  if(!editingResidentId && residents.some(r=>r.apt===aptId)){toast('Тоот аль хэдийн бүртгэлтэй байна','error');return;}
  if(parkings.length) {
    const pErr = validateSpotAssignment('parking', parkings, 'resident', editingResidentId);
    if(pErr) { toast(pErr, 'error'); return; }
  }
  if(storages.length) {
    const sErr = validateSpotAssignment('storage', storages, 'resident', editingResidentId);
    if(sErr) { toast(sErr, 'error'); return; }
  }
  const ok = await db_saveResident(data);
  if(!ok) { toast('Хадгалахад алдаа гарлаа — таны рольд энэ үйлдэл хийх эрх байхгүй байж болзошгүй','error'); return; }
  if(editingResidentId) {
    const idx=residents.findIndex(r=>r.id===editingResidentId);
    if(idx>=0) residents[idx]={...residents[idx],...data};
    toast('Мэдээлэл шинэчлэгдлээ ✓','success');
  } else {
    residents.push({id:nextId++,...data});
    toast(`${apt} тоот өмчлөгч нэмэгдлээ ✓`,'success');
  }
  closeModal('modal-resident');
  renderResidents();
}

async function deleteResident(id) {
  if(!confirm('Устгах уу?')) return;
  const r = residents.find(x=>x&&x.id===id);
  const dbId = r ? (r.dbId || r.id) : id;
  const {data, error, count} = await sb.from('residents').delete({count:'exact'}).eq('id', dbId).select();
  if(error) {
    toast('Устгахад алдаа гарлаа: ' + error.message, 'error');
    return;
  }
  if(!data || data.length === 0) {
    toast('Устгах эрхгүй байна — таны рольд энэ үйлдэл хориотой', 'error');
    return;
  }
  residents = residents.filter(r=>r&&r.id!==id);
  renderResidents();updateSidebarCount();
  toast('Устгагдлаа','success');
}

function fmtApt(r){return String(r.apt);}

function _residentMatchesFilter(r, filter) {
  if(!filter) return true;
  const q = filter.toLowerCase();
  return String(r.apt).toLowerCase().includes(q)
    || (r.firstname||'').toLowerCase().includes(q)
    || (r.lastname||'').toLowerCase().includes(q);
}

function monthsUnpaidForResident(r) {
  const relevantTx = transactions.filter(t=>t&&String(t.apt)===String(r.apt)&&t.type==='income'&&t.category==='resident').sort((a,b)=>(b.year*100+b.month)-(a.year*100+a.month));
  const lastPay = relevantTx[0];
  if(!lastPay) return 999; // хэзээ ч төлөөгүй
  return Math.max(0, (CUR_YEAR - lastPay.year)*12 + (CUR_MONTH - lastPay.month));
}

function openResidentDetail(resId) {
  const r=residents.find(x=>x.id===resId); if(!r) return;
  const sqm=residentSqm(r);
  const paid=transactions.some(t=>String(t.apt)===String(r.apt)&&t.type==='income'&&t.category==='resident'&&t.month===CUR_MONTH);
  showAptDetail(r.apt,r.building,r.floor,r.door,r,paid,sqm);
}

function renderBuildingTabs() {
  const wrap = document.getElementById('building-tabs');
  if(wrap.children.length > 0) { highlightActiveTab(); return; }

  BUILDINGS.forEach((b, i)=>{
    const btn = document.createElement('button');
    btn.className='btn btn-outline btn-sm';
    btn.id='btab-'+b.id;
    btn.textContent = b.id;
    btn.style.cssText=`min-width:40px;font-weight:600;transition:all .15s;padding:5px 8px;`;
    btn.onclick=()=>{ selectedBuilding=b.id; highlightActiveTab(); renderAptGrid(b.id); };
    wrap.appendChild(btn);
  });
  highlightActiveTab();
}

function renderAptGrid(buildingId) {
  const bld = BUILDINGS.find(b=>b.id===buildingId);
  if(!bld) return;
  const thisMonth = CUR_MONTH;
  const paidAptIds = transactions.filter(t=>t&&t.type==='income'&&t.category==='resident'&&t.month===thisMonth).map(t=>String(t.apt));
  const container = document.getElementById('apt-grid-container');
  container.innerHTML='';

  // Header info
  const gc=GROUP_COLORS[bld.group];
  document.getElementById('apt-building-label').textContent = bld.label;
  document.getElementById('apt-building-meta').textContent =
    `${bld.floors} давхар · давхарт ${bld.aptsPerFloor} айл · нийт ${bld.floors*bld.aptsPerFloor} айл`;

  // Unit width based on count
  const unitW = bld.aptsPerFloor===6 ? 58 : 68;

  for(let f=bld.floors; f>=1; f--) {
    const row = document.createElement('div');
    row.className='apt-floor-row';
    const lbl=document.createElement('div');
    lbl.className='floor-label'; lbl.textContent=f+'F'; lbl.style.marginRight='5px';
    row.appendChild(lbl);

    for(let d=1; d<=bld.aptsPerFloor; d++) {
      const aptId = makeAptId(buildingId, f, d);
      const label = String(buildingId*10000 + f*100 + d);
      const sqm = getSqmByBuildingAndDoor(buildingId, d);
      const res = residents.find(r=>String(r.apt)===String(aptId));
      const paid = paidAptIds.includes(String(aptId));
      let cls = res ? (paid?'paid':'overdue') : 'empty';



      const cell=document.createElement('div');
      cell.className='apt-unit '+cls;
      cell.style.width=unitW+'px';
      cell.innerHTML=`<span style="font-size:11px;font-weight:700">${label}</span><span style="font-size:8px;opacity:.8">${sqm}м²</span>`;
      cell.title=`${buildingId}-р байр ${label} тоот${res?' · '+(res.firstname||res.owner||'')+(res.lastname?' '+res.lastname:''):' · Сууц өмчлөгч бүртгэлгүй'}`;
      cell.onclick=()=>showAptDetail(aptId, buildingId, f, d, res, paid, sqm);
      row.appendChild(cell);
    }
    container.appendChild(row);
  }
}

function _aptDetailResidentHTML(res, buildingId, floor, label, sqm, paid, history) {
  const phones = res.phones||[res.phone||''];
  const emails = res.emails||[res.email||''];
  const parkings = res.parkings||[];
  const storages = res.storages||[];
  const vehicles = res.vehicles||[];
  const sqmFee = sqm*(feeSettings.perSqm||2500);
  const util = feeSettings.utility||15000;
  const garFee = parkings.length*(feeSettings.garage||25000);
  const storFee = storages.reduce((s,label)=>s+getSpotSqm('storage',label),0)*(feeSettings.storageSqm||1500);
  const totalFee = sqmFee+util+garFee+storFee;

  const ownerSection = `
    <div class="flex-between mb-16">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="avatar" style="width:40px;height:40px;font-size:16px;background:rgba(59,130,246,0.2);color:#60A5FA">${esc((res.firstname||res.owner||"?")[0])}</div>
        <div>
          <div style="font-size:17px;font-weight:800">${esc(res.firstname||"")} ${esc(res.lastname||"")}</div>
          <div style="color:var(--text-muted);font-size:12px">${esc(phones.join(' · '))||'—'}</div>
        </div>
      </div>
      <span class="tag ${paid?'tag-success':'tag-danger'}" style="font-size:12px;padding:5px 12px">${paid?'✓ Төлсөн':'✗ Төлөөгүй'}</span>
    </div>`;

  const aptSection = `
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Тоотын мэдээлэл</div>
    <div class="summary-row"><span class="summary-key">Байр / Давхар / Тоот</span><span class="summary-val">${buildingId}-р байр · ${floor}F · ${label}</span></div>
    <div class="summary-row"><span class="summary-key">Талбай</span><span class="summary-val">${sqm} м²</span></div>
    <div class="summary-row"><span class="summary-key">Ам бүл</span><span class="summary-val">${res.people} хүн</span></div>
    ${parkings.length?`<div class="summary-row"><span class="summary-key">Зогсоол</span><span class="summary-val">${esc(parkings.join(', '))}</span></div>`:''}
    ${storages.length?`<div class="summary-row"><span class="summary-key">Агуулах</span><span class="summary-val">${esc(storages.join(', '))}</span></div>`:''}
    ${vehicles.length?`<div class="summary-row"><span class="summary-key">Машин</span><span class="summary-val">${esc(vehicles.join(', '))}</span></div>`:''}`;

  const ownerInfoSection = `
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin:12px 0 6px">Сууц өмчлөгчийн мэдээлэл</div>
    <div class="summary-row"><span class="summary-key">Регистр</span><span class="summary-val" style="font-size:12px">${esc(res.reg)||'—'}</span></div>
    ${res.oeubd?`<div class="summary-row"><span class="summary-key">ӨЭУБД</span><span class="summary-val" style="font-size:12px;font-variant-numeric:tabular-nums">${esc(res.oeubd)}</span></div>`:''}
    ${res.ownDate?`<div class="summary-row"><span class="summary-key">Өмчилсөн огноо</span><span class="summary-val">${esc(res.ownDate)}</span></div>`:''}
    <div class="summary-row"><span class="summary-key">Утас</span><span class="summary-val" style="font-size:12px">${esc(phones.join(', '))||'—'}</span></div>
    <div class="summary-row"><span class="summary-key">И-мэйл</span><span class="summary-val" style="font-size:12px">${esc(emails.filter(Boolean).join(', '))||'—'}</span></div>
    ${res.note?`<div class="summary-row"><span class="summary-key">Тэмдэглэл</span><span class="summary-val" style="font-size:12px;color:var(--text-dim)">${esc(res.note)}</span></div>`:''}`;

  const feeSection = `
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin:12px 0 6px">СӨХ-ийн төлбөр</div>
    <div class="summary-row"><span class="summary-key">Өрхийн төлбөр (${sqm}м²)</span><span class="summary-val font-mono">${fmt(sqmFee)}</span></div>
    <div class="summary-row"><span class="summary-key">Нэмэлт зардал</span><span class="summary-val font-mono">${fmt(util)}</span></div>
    ${garFee?`<div class="summary-row"><span class="summary-key">Гаражийн төлбөр</span><span class="summary-val font-mono">${fmt(garFee)}</span></div>`:''}
    ${storFee?`<div class="summary-row"><span class="summary-key">Агуулахын төлбөр</span><span class="summary-val font-mono">${fmt(storFee)}</span></div>`:''}
    <div class="summary-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px">
      <span class="summary-key" style="font-weight:700;color:var(--text)">Нийт сарын төлбөр</span>
      <span class="summary-val text-accent" style="font-size:15px">${fmt(totalFee)}</span>
    </div>`;

  const historySection = `
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin:12px 0 6px">Төлбөрийн түүх</div>
    ${history.length?history.map(t=>`
      <div class="summary-row">
        <span class="summary-key">${t.year}-${String(t.month).padStart(2,'0')} сар ${methodName(t.method)}</span>
        <span class="summary-val text-success font-mono">${fmt(t.amount)}</span>
      </div>`).join(''):'<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Төлбөрийн түүх байхгүй</div>'}`;

  return ownerSection + aptSection + ownerInfoSection + feeSection + historySection;
}

function _aptDetailEmptyHTML(buildingId, label, sqm) {
  return `<div class="empty-state">
    <div style="margin-bottom:6px;font-size:14px">${buildingId}-р байр ${label} тоот</div>
    <div style="font-size:12px;color:var(--text-muted)">Талбай: ${sqm} м²</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Сууц өмчлөгч бүртгэлгүй</div>
  </div>`;
}

function _aptDetailSetButtons(res) {
  const editBtn = document.getElementById('apt-detail-edit-btn');
  const payBtn = document.getElementById('apt-detail-pay-btn');
  if(res) {
    editBtn.textContent = 'Мэдээлэл засварлах';
    editBtn.style.display = '';
    payBtn.style.display = '';
  } else {
    editBtn.textContent = 'Сууц өмчлөгч бүртгэх';
    editBtn.style.display = '';
    payBtn.style.display = 'none';
  }
}

function showAptDetail(aptId, buildingId, floor, door, res, paid, sqm) {
  selectedAptForDetail = res;
  _aptDetailBuilding = buildingId;
  _aptDetailFloor = floor;
  _aptDetailDoor = door;
  const label = String(buildingId*10000 + floor*100 + door);
  document.getElementById('apt-detail-title').textContent = `${buildingId}-р байр · ${label} тоот`;
  const history = transactions.filter(t=>t&&String(t.apt)===String(aptId)&&t.type==='income'&&t.category==='resident').sort((a,b)=>b.id-a.id).slice(0,6);
  document.getElementById('apt-detail-body').innerHTML = res
    ? _aptDetailResidentHTML(res, buildingId, floor, label, sqm, paid, history)
    : _aptDetailEmptyHTML(buildingId, label, sqm);
  _aptDetailSetButtons(res);
  openModal('modal-apt-detail');
}

function aptDetailEdit() {
  closeModal('modal-apt-detail');
  if(selectedAptForDetail) {
    editResident(selectedAptForDetail.id);
  } else {
    openAddResident();
    // Pre-fill building/floor/door if known
    if(_aptDetailBuilding) {
      setTimeout(()=>{
        document.getElementById('res-building').value = _aptDetailBuilding;
        onResBuildingChange(_aptDetailFloor, _aptDetailDoor);
      }, 50);
    }
  }
}

let editingBuildingId = null;

let editingAptTypeId = null;

function getAptLabel(scheme, entrance, floor, door, aptsPerEntrance, seqStart, floors) {
  seqStart = seqStart || 101;
  floors = floors || floor;
  switch(scheme) {
    case 'floor_door':
      // давхар + хаалга (1-р давхар 2-р хаалга → 102)
      return String(floor) + String(door).padStart(2,'0');
    case 'sequential':
      // доороос дээш, ОРЦ ДАМЖИН үргэлжлүүлж дараалуулна (хуучин соц барилгын загвар):
      // 1-р орцны 1-р давхрын 1-р хаалганаас эхэлж, сүүлийн орцны хамгийн дээд давхрын сүүлийн хаалгаар төгсгөнө
      return String(seqStart + (entrance-1)*floors*aptsPerEntrance + (floor-1)*aptsPerEntrance + (door-1));
    case 'entrance_floor':
      // орц + давхар + хаалга (1-р орц 3-р давхар 2-р хаалга → 1302)
      return String(entrance) + String(floor) + String(door).padStart(2,'0');
    case 'floor_only':
      // давхар + хаалга (2 оронтой) → 12, 103
      return String(floor) + String(door);
    default:
      return String(floor) + String(door).padStart(2,'0');
  }
}

function renderAdminBuildingsTable() {
  const body = document.getElementById('admin-buildings-body');
  if(!body) return;
  if(!BUILDINGS.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Байр байхгүй</td></tr>';
    return;
  }
  const schemeNames = {floor_door:'Давхар+Хаалга', sequential:'Дараалсан', entrance_floor:'Орц+Давхар+Хаалга', floor_only:'Зөвхөн давхар'};
  body.innerHTML = BUILDINGS.map(b => {
    const gc = GROUP_COLORS[b.group] || GROUP_COLORS['A'];
    const entrances = b.entrances || 1;
    const scheme = schemeNames[b.numbering_scheme] || 'Давхар+Хаалга';
    return `<tr>
      <td><span class="dt-title dt-mono">${b.id}</span></td>
      <td class="dt-text">${esc(b.label)}</td>
      <td class="dt-text" style="text-align:center">${b.floors}</td>
      <td class="dt-text" style="text-align:center">${entrances > 1 ? entrances+'орц · ' : ''}${b.aptsPerFloor}/давхар</td>
      <td class="dt-muted">${scheme}</td>
      <td><span class="tag" style="background:${gc.bg};color:${gc.text};border:1px solid ${gc.border}">${b.group}</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="openEditBuilding(${b.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteBuilding(${b.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAddBuilding() {
  editingBuildingId = null;
  document.getElementById('admin-bld-id').value = '';
  document.getElementById('admin-bld-id').disabled = false;
  document.getElementById('admin-bld-label').value = '';
  document.getElementById('admin-bld-floors').value = '';
  document.getElementById('admin-bld-apts').value = '';
  document.getElementById('admin-bld-entrances').value = '1';
  document.getElementById('admin-bld-group').value = 'A';
  document.getElementById('admin-entrance-config').style.display = 'none';
  document.getElementById('admin-entrance-rows').innerHTML = '';
  // Default scheme
  const radio = document.querySelector('input[name="bld-scheme"][value="floor_door"]');
  if(radio) { radio.checked = true; onSchemeChange(); }
  document.getElementById('modal-admin-building-title').textContent = 'Байр нэмэх';
  openModal('modal-admin-building');
  updateBldPreview();
}

function openEditBuilding(id) {
  const b = BUILDINGS.find(x=>x.id===id);
  if(!b) return;
  editingBuildingId = id;
  document.getElementById('admin-bld-id').value = b.id;
  document.getElementById('admin-bld-id').disabled = true;
  document.getElementById('admin-bld-label').value = b.label;
  document.getElementById('admin-bld-floors').value = b.floors;
  document.getElementById('admin-bld-apts').value = b.aptsPerFloor;
  document.getElementById('admin-bld-entrances').value = b.entrances || 1;
  document.getElementById('admin-bld-group').value = b.group;
  onEntranceCountChange();
  // Scheme сонгох
  const scheme = b.numbering_scheme || 'floor_door';
  const radio = document.querySelector(`input[name="bld-scheme"][value="${scheme}"]`);
  if(radio) { radio.checked = true; onSchemeChange(); }
  if(scheme==='sequential' && b.seq_start) {
    const si = document.getElementById('seq-start');
    if(si) si.value = b.seq_start;
  }
  document.getElementById('modal-admin-building-title').textContent = 'Байрны бүтэц засах';
  openModal('modal-admin-building');
  updateBldPreview();
}

async function saveBuilding() {
  const id = +document.getElementById('admin-bld-id').value;
  const label = document.getElementById('admin-bld-label').value.trim();
  const floors = +document.getElementById('admin-bld-floors').value;
  const apts = +document.getElementById('admin-bld-apts').value;
  const entrances = +document.getElementById('admin-bld-entrances').value || 1;
  const group = document.getElementById('admin-bld-group').value;
  const scheme = document.querySelector('input[name="bld-scheme"]:checked')?.value || 'floor_door';
  const seqStart = +document.getElementById('seq-start')?.value || 101;

  if(!id || !label || !floors || !apts) { toast('Бүх талбарыг бөглөнө үү','error'); return; }

  const totalApts = floors * apts * entrances;
  const row = {
    id, label, floors,
    apts_per_floor: apts * entrances,  // нийт хаалга/давхар
    group_name: group,
    entrances,
    numbering_scheme: scheme,
    seq_start: scheme==='sequential' ? seqStart : null
  };

  const localRow = {
    id, label, floors,
    aptsPerFloor: apts * entrances,
    group, entrances,
    numbering_scheme: scheme,
    seq_start: seqStart
  };

  if(editingBuildingId) {
    if(id !== editingBuildingId) {
      // ID өөрчлөгдсөн — хуучин мөрийг устгаж шинэ ID-тайгаар оруулна
      const {error: delErr} = await sb.from('buildings').delete().eq('id', editingBuildingId);
      if(delErr){toast('Алдаа: '+delErr.message,'error');return;}
      const {error: insErr} = await sb.from('buildings').insert(row);
      if(insErr){toast('Алдаа: '+insErr.message,'error');return;}
    } else {
      const {error} = await sb.from('buildings').update({
        label, floors, apts_per_floor: apts*entrances,
        group_name: group, entrances, numbering_scheme: scheme,
        seq_start: scheme==='sequential' ? seqStart : null
      }).eq('id', editingBuildingId);
      if(error){toast('Алдаа: '+error.message,'error');return;}
    }
    const idx = BUILDINGS.findIndex(b=>b.id===editingBuildingId);
    if(idx>=0) BUILDINGS[idx] = localRow;
    toast('Байр шинэчлэгдлээ ✓','success');
  } else {
    const {error} = await sb.from('buildings').insert(row);
    if(error){toast('Алдаа: '+error.message,'error');return;}
    BUILDINGS.push(localRow);
    BUILDINGS.sort((a,b)=>a.id-b.id);
    toast(`Байр нэмэгдлээ ✓ (нийт ${totalApts} тоот)`,'success');
  }

  // Тухайн байранд "Тоот" (apt_types) тохиргоо огт байхгүй бол, Хаалганы дугаарыг (1..Тоотын тоо)
  // автоматаар үүсгэж өгнө — админ гараар "Тоот" таб руу орох шаардлагагүй болно
  const hasAptType = APT_TYPES.some(t=>t.building_id===id);
  if(!hasAptType) {
    const doorNumbers = Array.from({length: apts}, (_,i)=>i+1);
    const {data: newType, error: atErr} = await sb.from('apt_types')
      .insert({building_id: id, door_numbers: doorNumbers}).select().single();
    if(!atErr && newType) APT_TYPES.push(newType);
  }

  closeModal('modal-admin-building');
  populateBuildingSelects();
  renderAdminBuildingsTable();
  renderAdminPage();
}

async function deleteBuilding(id) {
  if(!confirm(id+'-р байрыг устгах уу? Холбоотой өгөгдлүүд хэвээр үлдэнэ.')) return;
  const {error} = await sb.from('buildings').delete().eq('id', id);
  if(error){toast('Устгахад алдаа: '+error.message,'error');return;}
  BUILDINGS = BUILDINGS.filter(b=>b.id!==id);
  populateBuildingSelects();
  renderAdminBuildingsTable();
  renderAdminPage();
  toast('Байр устгагдлаа','success');
}

function renderAptTypesTable() {
  const body = document.getElementById('admin-apttypes-body');
  if(!body) return;
  const filterBld = +document.getElementById('admin-apttype-building-filter').value || 0;
  let list = [...APT_TYPES];
  if(filterBld) list = list.filter(t=>t.building_id===filterBld);
  list.sort((a,b)=>a.building_id-b.building_id||(a.id-b.id));
  if(!list.length){
    body.innerHTML='<tr><td colspan="4" class="empty-state">Өгөгдөл байхгүй</td></tr>';
    return;
  }
  body.innerHTML = list.map(t=>{
    const bld = BUILDINGS.find(b=>b.id===t.building_id);
    const doors = Array.isArray(t.door_numbers) ? t.door_numbers.join(', ') : t.door_numbers;
    return `<tr>
      <td class="dt-text">${bld?esc(bld.label):t.building_id}</td>
      <td class="dt-text">Хаалга: <span class="dt-title">${doors}</span></td>
      <td class="dt-title dt-mono">${t.sqm} м²</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="openEditAptType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--text-muted)" title="Засах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteAptType(${t.id})" style="padding:4px;display:inline-flex;align-items:center;color:var(--danger)" title="Устгах"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAddAptType() {
  editingAptTypeId = null;
  document.getElementById('admin-at-building').value = BUILDINGS[0]?.id || '';
  document.getElementById('admin-at-doors').value = '';
  document.getElementById('admin-at-sqm').value = '';
  document.getElementById('modal-admin-apttype-title').textContent = 'Талбайн төрөл нэмэх';
  openModal('modal-admin-apttype');
}

function openEditAptType(id) {
  const t = APT_TYPES.find(x=>x.id===id);
  if(!t) return;
  editingAptTypeId = id;
  document.getElementById('admin-at-building').value = t.building_id;
  const doors = Array.isArray(t.door_numbers) ? t.door_numbers.join(',') : t.door_numbers;
  document.getElementById('admin-at-doors').value = doors;
  document.getElementById('admin-at-sqm').value = t.sqm;
  document.getElementById('modal-admin-apttype-title').textContent = 'Талбайн төрөл засах';
  openModal('modal-admin-apttype');
}

async function saveAptType() {
  const bldId = +document.getElementById('admin-at-building').value;
  const doorsRaw = document.getElementById('admin-at-doors').value.trim();
  const sqm = parseFloat(document.getElementById('admin-at-sqm').value);
  if(!bldId || !doorsRaw || !sqm) { toast('Бүх талбарыг бөглөнө үү','error'); return; }
  const doors = doorsRaw.split(/[,\s]+/).map(Number).filter(Boolean);
  if(!doors.length){ toast('Хаалга дугаарыг зөв оруулна уу (ж: 1,2,3)','error'); return; }

  const row = {building_id: bldId, door_numbers: doors, sqm};

  if(editingAptTypeId) {
    const {error} = await sb.from('apt_types').update(row).eq('id', editingAptTypeId);
    if(error){toast('Алдаа: '+error.message,'error');return;}
    const idx = APT_TYPES.findIndex(t=>t.id===editingAptTypeId);
    if(idx>=0) APT_TYPES[idx] = {...APT_TYPES[idx], ...row};
    toast('Талбайн төрөл шинэчлэгдлээ ✓','success');
  } else {
    const {data, error} = await sb.from('apt_types').insert(row).select().single();
    if(error){toast('Алдаа: '+error.message,'error');return;}
    APT_TYPES.push({id:data.id, ...row});
    toast('Талбайн төрөл нэмэгдлээ ✓','success');
  }
  closeModal('modal-admin-apttype');
  renderAptTypesTable();
}

async function deleteAptType(id) {
  if(!confirm('Энэ талбайн төрлийг устгах уу?')) return;
  const {error} = await sb.from('apt_types').delete().eq('id', id);
  if(error){toast('Устгахад алдаа: '+error.message,'error');return;}
  APT_TYPES = APT_TYPES.filter(t=>t.id!==id);
  renderAptTypesTable();
  toast('Устгагдлаа','success');
}
