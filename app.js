/* ===================== OEE MONITORING APP =====================
   Offline-first: semua data disimpan di localStorage dulu.
   Sync manual/otomatis ke Google Sheet via Apps Script Web App.
   Rumus OEE mengikuti workbook referensi SAT (Availability/Performance/Quality).
================================================================= */

const STORAGE_KEY = 'oee_app_state_v1';
const ADMIN_PIN = '2027'; // ganti setelah deploy

// Fitur counter otomatis via sensor proximity (upgrade hardware, lihat SETUP.md) — SENGAJA BELUM DIBANGUN.
// Backend-nya (action=counterPing di Code.gs -> sheet CounterPings) udah siap nampung data begitu alatnya jadi,
// tapi belum ada UI/logic konsumsi di app ini. Nyalain fitur ini nanti setelah hardware-nya beres di-tes.
const FEATURE_AUTO_COUNTER = false;

// Master Kategori Downtime standar (kode, nama kategori, grouping/fungsi, status).
// Status default: 'Unplanned' kecuali yang jelas-jelas aktivitas terjadwal (CF, SO, PM, SM)
// yang saya set 'Planned' -> exclude dari waktu produksi. Cek & sesuaikan di Admin kalau ada yang keliru.
const DOWNTIME_MASTER = [
  ['TD','Tunggu Dispatch','Distribusi','Unplanned'],
  ['TPL','Tunggu PaLLET','Distribusi','Unplanned'],
  ['FM','Bencana','Internal PU','Unplanned'],
  ['CF','Change Format','Internal PU','Planned dengan Toleransi'],
  ['FL','Flushing','Internal PU','Unplanned'],
  ['FO','Foaming','Internal PU','Unplanned'],
  ['FTR','Ganti/cek filter bag','Internal PU','Unplanned'],
  ['MP','Minyak Panas/Busa','Internal PU','Unplanned'],
  ['RP','Repack','Internal PU','Unplanned'],
  ['RFL','Repeat Flushing','Internal PU','Unplanned'],
  ['SO','Stock Opname','Internal PU','Planned (Penuh)'],
  ['TE','Time Out Eksternal','Internal PU','Unplanned'],
  ['TI','Time Out Internal','Internal PU','Unplanned'],
  ['TP','Tunggu /Selesai program produksi','Internal PU','Unplanned'],
  ['TF','Tunggu Forklift','Internal PU','Unplanned'],
  ['TJ','Tunggu Jalur','Internal PU','Unplanned'],
  ['TMI','Tunggu material akibat internal FIlling','Internal PU','Unplanned'],
  ['TMM','Tunggu Material dari MWH','Internal PU','Unplanned'],
  ['TB','Tunggu Minyak Blending (koreksi)','Internal PU','Unplanned'],
  ['TM','Tunggu Mobil Flexi/IBC','Internal PU','Unplanned'],
  ['TO','Tunggu Operator','Internal PU','Unplanned'],
  ['TPI','Tunggu Persiapan IBC / Flexi Bag','Internal PU','Unplanned'],
  ['TBD','Tunggu Proses Bongkar Drum Kosong','Internal PU','Unplanned'],
  ['SB','Tunggu Sablon','Internal PU','Unplanned'],
  ['TSD','Tunggu supply drum dari bordes','Internal PU','Unplanned'],
  ['TV','Tunggu Vendor','Internal PU','Unplanned'],
  ['TBA','Tunggu Blending Karena Shortage Aditif','Production RMP','Unplanned'],
  ['TBO','Tunggu Blending Karena Shortage Base Oil','Production RMP','Unplanned'],
  ['TMS','Tunggu material akibat supplier','Production RMP','Unplanned'],
  ['TP','Tunggu program produksi','Production RMP','Unplanned'],
  ['DM','Defect Material in process (eksternal)','Quality','Unplanned'],
  ['QH','QC Incoming material / QC hold','Quality','Unplanned'],
  ['TS','Sampling','Quality','Unplanned'],
  ['TL','Tunggu Release Lab','Quality','Unplanned'],
  ['BCW','Bottle Check Weigher','Technical Services','Unplanned'],
  ['CP','Capper','Technical Services','Unplanned'],
  ['CE','Carton Erector','Technical Services','Unplanned'],
  ['CS','Carton Sealer','Technical Services','Unplanned'],
  ['CW','Carton Weigher','Technical Services','Unplanned'],
  ['CM','Conveyor','Technical Services','Unplanned'],
  ['CB','Conveyor Bridge','Technical Services','Unplanned'],
  ['DL','Defect Lubcel','Technical Services','Unplanned'],
  ['DI','Devider','Technical Services','Unplanned'],
  ['IS','Induction Sealer','Technical Services','Unplanned'],
  ['KP','Kendala Pompa','Technical Services','Unplanned'],
  ['LB','Label','Technical Services','Unplanned'],
  ['LK','Label karton','Technical Services','Unplanned'],
  ['LS','Laser/printer','Technical Services','Unplanned'],
  ['MD','Marking Doos','Technical Services','Unplanned'],
  ['MF','Mesin Filler','Technical Services','Unplanned'],
  ['OR','Orienter','Technical Services','Unplanned'],
  ['PL','Palletizer','Technical Services','Unplanned'],
  ['PM','Preventive Maintenance','Technical Services','Planned (Penuh)'],
  ['RO','Robotic Packer','Technical Services','Unplanned'],
  ['SM','Setting mesin','All Fungsi','Planned dengan Toleransi'],
  ['SP','Spiral Conveyor','Technical Services','Unplanned'],
  ['TT','Tunggu Personel Teknik','Technical Services','Unplanned'],
  ['UN','Unscramble','Technical Services','Unplanned'],
  ['TU','Utillity','Technical Services','Unplanned'],
  ['start-end produksi','start-end produksi','Internal PU','Unplanned'],
  ['blank/operator lupa isi','blank/operator lupa isi','Internal PU','Unplanned'],
  ['IT','Idle Time','Idle Time','Unplanned'],
  ['TAB','Tunggu Antrian Blending','Internal PU','Unplanned'],
  ['GP','Ganti Program','Internal PU','Unplanned'],
  ['TBOP','Tunggu Blending Operasional','Internal PU','Unplanned'],
  ['TPA','Tunggu IBC','Internal PU','Unplanned'],
].map(([kode,kategori,fungsi,status],i)=>({
  id:'cat'+(i+1), kode, kategori, groupingBesar:fungsi, groupingSub:fungsi, status, atribusi:'',
}));

// Master Mesin — diambil dari nama alat fisik di grouping "Technical Services" (bukan alasan downtime
// kaya "Kendala Pompa"/"Preventive Maintenance"/"Tunggu Personel Teknik"/"Utillity"/"Defect Lubcel").
const MACHINE_MASTER = [
  'Bottle Check Weigher','Capper','Carton Erector','Carton Sealer','Carton Weigher',
  'Conveyor','Conveyor Bridge','Devider','Induction Sealer','Label','Label Karton',
  'Laser/Printer','Marking Doos','Mesin Filler','Orienter','Palletizer','Robotic Packer',
  'Spiral Conveyor','Unscramble',
].map((name,i)=>({ id:'mac'+(i+1), name }));

const defaultState = {
  config: {
    pus: [
      { id: 'pug', name: 'PUG', lines: [{id:'fl03', name:'FL-03'}] },
      { id: 'puc', name: 'PUC', lines: [{id:'fl-c1', name:'FL-C1'}] },
      { id: 'puj', name: 'PUJ', lines: [{id:'fl-j1', name:'FL-J1'}] },
    ],
    machines: MACHINE_MASTER,
    // Master Kategori terpusat, skema MASTER_KATEGORI (bukan lagi per-mesin).
    // status: 'Unplanned' | 'Planned (Penuh)' | 'Planned dengan Toleransi'
    // Unplanned -> masuk hitungan OEE (internal). Planned apapun -> exclude (external). Raw, tanpa toleransi.
    categories: DOWNTIME_MASTER,
    // Master produk & speed ideal per line -> auto-isi nominal speed pas mulai sesi
    products: [
      { id:'p1', lineId:'fl03', name:'Contoh Produk A', packagingSize:'220ml', idealSpeed:30 },
    ],
  },
  sessions: [],   // {id, mode, pu, line, shift, date, startTime, endTime, nominalSpeed, before, after, reject, synced}
  events: [],     // {id, sessionId, kategoriId, type, category, start, end(ms), source, note, synced}
  parameters: [], // {id, sessionId, machine, paramName, value, uom, note, recordedAt, synced}
  activeSessionId: null,
  lineTimer: null, // {type:'running'|'downtime', kategoriId, note, photo, startedAt} — satu timer buat seluruh line/sesi
};

let state = loadState();
let clockInterval = null;

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return JSON.parse(JSON.stringify(defaultState));
    const parsed = JSON.parse(raw);
    const merged = Object.assign(JSON.parse(JSON.stringify(defaultState)), parsed);
    // Object.assign di atas cuma shallow-merge di level atas — kalau "config" udah ada di data lama
    // (dari sebelum field baru kayak machines ditambahin), dia bakal overwrite config bawaan
    // secara utuh dan bikin sub-key baru itu hilang/undefined. Merge config secara terpisah biar aman.
    merged.config = Object.assign(JSON.parse(JSON.stringify(defaultState.config)), parsed.config || {});
    return merged;
  }catch(e){ return JSON.parse(JSON.stringify(defaultState)); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
let toastTimer = null;
function toast(msg, persistent){
  const t=document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.toggle('error', !!persistent);
  t.classList.add('show');
  if(toastTimer){ clearTimeout(toastTimer); toastTimer=null; }
  if(!persistent){
    toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
  }
}
function dismissToast(){
  if(toastTimer){ clearTimeout(toastTimer); toastTimer=null; }
  document.getElementById('toast').classList.remove('show');
}
function fmtDuration(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const h=String(Math.floor(s/3600)).padStart(2,'0');
  const m=String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss=String(s%60).padStart(2,'0');
  return h+':'+m+':'+ss;
}

/* ===================== PHOTO CAPTURE (kompresi di HP sebelum disimpan) ===================== */
let pendingPhoto = { reason: null, man: null };
function compressImage(file, maxWidth, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function handlePhotoSelect(e, ctx){
  const file = e.target.files[0];
  if(!file) return;
  toast('Memproses foto...');
  try{
    const dataUrl = await compressImage(file, 900, 0.6);
    pendingPhoto[ctx] = dataUrl;
    document.getElementById(ctx+'PhotoPreview').src = dataUrl;
    document.getElementById(ctx+'PhotoPreviewWrap').style.display = 'block';
  }catch(err){
    toast('Gagal memproses foto', true);
  }
}
function removePhoto(ctx){
  pendingPhoto[ctx] = null;
  document.getElementById(ctx+'PhotoPreviewWrap').style.display = 'none';
  document.getElementById(ctx+'PhotoInput').value = '';
}

/* ===================== NAV ===================== */
function switchTab(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  if(view==='dashboard') renderDashboard();
  if(view==='sync') renderSyncView();
  if(view==='admin') renderAdmin();
}

/* ===================== INIT / FORM POPULATE ===================== */
function populatePUSelects(){
  const puSel = document.getElementById('sPU');
  const fPU = document.getElementById('fPU');
  const lineParent = document.getElementById('lineParentPU');
  [puSel, fPU, lineParent].forEach(sel=>{ if(sel) sel.innerHTML=''; });
  if(fPU) fPU.innerHTML='<option value="">Semua PU</option>';
  state.config.pus.forEach(pu=>{
    const o=document.createElement('option'); o.value=pu.id; o.textContent=pu.name;
    puSel.appendChild(o.cloneNode(true));
    fPU.appendChild(o.cloneNode(true));
    lineParent.appendChild(o.cloneNode(true));
  });
  populateLineSelect(state.config.pus[0]?.id);
  populateProdLineSel();
}
function populateProdLineSel(){
  const sel = document.getElementById('prodLineSel');
  if(!sel) return;
  sel.innerHTML='';
  state.config.pus.forEach(pu=>{
    pu.lines.forEach(l=>{
      const o=document.createElement('option'); o.value=l.id; o.textContent=pu.name+' / '+l.name; sel.appendChild(o);
    });
  });
}
function populateLineSelect(puId){
  const sLine = document.getElementById('sLine');
  sLine.innerHTML='';
  const pu = state.config.pus.find(p=>p.id===puId);
  (pu?pu.lines:[]).forEach(l=>{
    const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; sLine.appendChild(o);
  });
  populateProductSelect(sLine.value);
}
function populateProductSelect(lineId){
  const sel = document.getElementById('sProduct');
  if(!sel) return;
  sel.innerHTML = '<option value="">— pilih produk (opsional, auto isi speed) —</option>';
  state.config.products.filter(p=>p.lineId===lineId).forEach(p=>{
    const o=document.createElement('option');
    o.value=p.id; o.textContent = p.name+' — '+p.packagingSize+' ('+p.idealSpeed+' bpm)';
    sel.appendChild(o);
  });
}
function onProductSelect(){
  const id = document.getElementById('sProduct').value;
  const p = state.config.products.find(x=>x.id===id);
  if(p) document.getElementById('sSpeed').value = p.idealSpeed;
}
document.addEventListener('DOMContentLoaded', ()=>{
  populatePUSelects();
  document.getElementById('sPU').addEventListener('change', e=>populateLineSelect(e.target.value));
  document.getElementById('sLine').addEventListener('change', e=>populateProductSelect(e.target.value));
  const savedUrl = localStorage.getItem('oee_api_url');
  if(savedUrl) document.getElementById('apiUrl').value = savedUrl;
  renderActiveSession();
  updateNetBadge();
  setInterval(updateNetBadge, 4000);
  clockInterval = setInterval(tickTimers, 1000);
});
window.addEventListener('online', updateNetBadge);
window.addEventListener('offline', updateNetBadge);
function updateNetBadge(){
  const b=document.getElementById('netBadge');
  if(navigator.onLine){ b.textContent='Online'; b.className='badge online'; }
  else { b.textContent='Offline'; b.className='badge offline'; }
}

/* ===================== SESSION ===================== */
function startSession(){
  const pu = document.getElementById('sPU').value;
  const line = document.getElementById('sLine').value;
  const puName = state.config.pus.find(p=>p.id===pu)?.name || pu;
  const lineName = state.config.pus.find(p=>p.id===pu)?.lines.find(l=>l.id===line)?.name || line;
  const speed = parseFloat(document.getElementById('sSpeed').value);
  const before = parseFloat(document.getElementById('sBefore').value);
  if(!speed || isNaN(before)){ toast('Isi nominal speed & counter awal dulu'); return; }
  const productId = document.getElementById('sProduct').value || null;
  const product = state.config.products.find(p=>p.id===productId);
  const plannedHours = parseFloat(document.getElementById('sPlannedHours').value);
  const plannedProductionMin = (!isNaN(plannedHours) && plannedHours>0) ? plannedHours*60 : null;

  const session = {
    id: uid(),
    mode: document.getElementById('sMode').value,
    pu, puName, line, lineName,
    shift: document.getElementById('sShift').value,
    date: new Date().toISOString().slice(0,10),
    startTime: Date.now(),
    endTime: null,
    productId, productName: product?product.name:null, packagingSize: product?product.packagingSize:null,
    nominalSpeed: speed,
    plannedProductionMin,
    before, after: null, reject: 0,
    synced: false,
  };
  state.sessions.push(session);
  state.activeSessionId = session.id;
  state.lineTimer = { type:'running', startedAt: session.startTime };
  saveState();
  renderActiveSession();
  toast('Sesi dimulai');
}

function getActiveSession(){ return state.sessions.find(s=>s.id===state.activeSessionId); }

function renderActiveSession(){
  const sess = getActiveSession();
  document.getElementById('noActiveSession').style.display = sess ? 'none' : 'block';
  document.getElementById('activeSessionCard').style.display = sess ? 'block' : 'none';
  document.getElementById('eventLogCard').style.display = sess ? 'block' : 'none';
  document.getElementById('paramLogCard').style.display = sess ? 'block' : 'none';
  if(!sess) return;

  document.getElementById('activeSessionInfo').textContent =
    `${sess.mode==='observasi'?'Observasi':'Harian'} · ${sess.puName} / ${sess.lineName} · ${sess.shift} · mulai ${new Date(sess.startTime).toLocaleTimeString('id-ID')}`
    + (sess.productName ? ` · ${sess.productName} (${sess.packagingSize})` : '')
    + (sess.plannedProductionMin ? ` · Target: ${(sess.plannedProductionMin/60).toFixed(1)} jam` : '');
  document.getElementById('sessionElapsed').textContent = fmtDuration(Date.now()-sess.startTime);

  renderLineStatus();
  renderLiveKpis();
  renderEventLog();
  renderParamLog();
}

function renderLineStatus(){
  const box = document.getElementById('lineStatusBox');
  const btn = document.getElementById('lineToggleBtn');
  const t = state.lineTimer;
  if(!t){
    box.className = 'line-status';
    document.getElementById('lineStatusLbl').textContent = '—';
    document.getElementById('lineStatusVal').textContent = '--:--:--';
    return;
  }
  box.className = 'line-status ' + (t.type==='running' ? 'running' : 'down');
  document.getElementById('lineStatusLbl').textContent = t.type==='running' ? 'Running' : 'Downtime';
  document.getElementById('lineStatusVal').textContent = fmtDuration(Date.now()-t.startedAt);
  btn.textContent = t.type==='running' ? '⏸ Downtime' : '▶ Selesai Downtime';
}

function tickTimers(){
  const sess = getActiveSession();
  if(!sess) return;
  document.getElementById('sessionElapsed').textContent = fmtDuration(Date.now()-sess.startTime);
  if(state.lineTimer){
    document.getElementById('lineStatusVal').textContent = fmtDuration(Date.now()-state.lineTimer.startedAt);
  }
  renderLiveKpis();
}

function onLineToggle(){
  const timer = state.lineTimer;
  if(!timer){
    // belum ada timer -> mulai downtime, munculkan reason picker
    openReasonModal();
    return;
  }
  if(timer.type==='downtime'){
    // stop downtime -> commit event, lalu mulai running
    commitEvent(timer, 'downtime');
    state.lineTimer = { type:'running', startedAt: Date.now() };
  } else {
    // stop running -> commit event running, lalu buka reason picker buat downtime baru
    commitEvent(timer, 'running');
    state.lineTimer = null;
    openReasonModal();
  }
  saveState();
  renderLineStatus();
  renderEventLog();
  renderLiveKpis();
}

// Status kategori -> tag internal/external dipakai kalkulasi OEE.
// Unplanned = internal (masuk hitungan, kurangi Availability). Planned apapun = external (exclude).
function statusToCategoryTag(status){
  return status==='Unplanned' ? 'internal' : 'external';
}

function commitEvent(timer, type){
  const sess = getActiveSession();
  const kat = state.config.categories.find(c=>c.id===timer.kategoriId);
  state.events.push({
    id: uid(),
    sessionId: sess.id,
    kategoriId: timer.kategoriId || null,
    type,
    category: type==='downtime' ? (kat?statusToCategoryTag(kat.status):'internal') : null,
    start: timer.startedAt,
    end: Date.now(),
    source: 'stopwatch',
    note: timer.note || '',
    photo: timer.photo || null,
    synced: false,
  });
}

function openReasonModal(){
  document.getElementById('reasonModalTitle').textContent = 'Pilih Kategori Downtime';
  document.getElementById('reasonSearch').value='';
  renderReasonChips('');
  document.getElementById('reasonNote').value='';
  pendingPhoto.reason = null;
  document.getElementById('reasonPhotoInput').value = '';
  document.getElementById('reasonPhotoPreviewWrap').style.display = 'none';
  document.getElementById('reasonModalBg').classList.add('active');
}
function filterReasonChips(){ renderReasonChips(document.getElementById('reasonSearch').value); }
function renderReasonChips(query){
  const q = (query||'').toLowerCase();
  const cats = state.config.categories.filter(c=>
    !q || c.kode.toLowerCase().includes(q) || c.kategori.toLowerCase().includes(q));
  const wrap = document.getElementById('reasonChips');
  wrap.innerHTML='';
  if(cats.length===0){ wrap.innerHTML='<span class="muted">Belum ada kategori. Tambah di tab Admin.</span>'; return; }
  cats.forEach(c=>{
    const chip = document.createElement('div');
    chip.className='chip'; chip.textContent = c.kode+' — '+c.kategori + (c.status!=='Unplanned'?' (planned)':'');
    chip.dataset.id = c.id;
    chip.onclick = ()=>{
      document.querySelectorAll('#reasonChips .chip').forEach(x=>x.classList.remove('sel'));
      chip.classList.add('sel');
    };
    wrap.appendChild(chip);
  });
}
function confirmDowntimeReason(){
  const sel = document.querySelector('#reasonChips .chip.sel');
  const note = document.getElementById('reasonNote').value;
  state.lineTimer = {
    type:'downtime',
    kategoriId: sel ? sel.dataset.id : null,
    note,
    photo: pendingPhoto.reason,
    startedAt: Date.now(),
  };
  saveState();
  closeModal('reasonModalBg');
  renderLineStatus();
}
function cancelReasonModal(){
  closeModal('reasonModalBg');
  // kalau lagi transisi running->downtime terus dibatalin, balikin ke running biar gak nyangkut
  if(getActiveSession() && !state.lineTimer){
    state.lineTimer = { type:'running', startedAt: Date.now() };
    saveState();
    renderLineStatus();
  }
}
function closeModal(id){ document.getElementById(id).classList.remove('active'); }

/* ===================== MANUAL EVENT ===================== */
function openManualModal(){
  document.getElementById('manType').value='downtime';
  renderManualReasons();
  const now = new Date();
  document.getElementById('manStart').value = now.toTimeString().slice(0,8);
  document.getElementById('manEnd').value = now.toTimeString().slice(0,8);
  document.getElementById('manNote').value='';
  pendingPhoto.man = null;
  document.getElementById('manPhotoInput').value = '';
  document.getElementById('manPhotoPreviewWrap').style.display = 'none';
  document.getElementById('manualModalBg').classList.add('active');
}
function renderManualReasons(){
  const type = document.getElementById('manType').value;
  const wrap = document.getElementById('manReasonWrap');
  wrap.style.display = type==='downtime' ? 'block' : 'none';
  if(type!=='downtime') return;
  const sel = document.getElementById('manReason');
  sel.innerHTML='';
  state.config.categories.forEach(c=>{
    const o=document.createElement('option'); o.value=c.id; o.textContent=c.kode+' — '+c.kategori+(c.status!=='Unplanned'?' (planned)':''); sel.appendChild(o);
  });
}
function saveManualEvent(){
  const sess = getActiveSession();
  if(!sess){ toast('Tidak ada sesi aktif'); return; }
  const type = document.getElementById('manType').value;
  const kategoriId = type==='downtime' ? document.getElementById('manReason').value : null;
  const kat = state.config.categories.find(c=>c.id===kategoriId);
  const [sh,sm,ss] = document.getElementById('manStart').value.split(':').map(Number);
  const [eh,em,es] = document.getElementById('manEnd').value.split(':').map(Number);
  const base = new Date(sess.date);
  const start = new Date(base); start.setHours(sh,sm,ss||0,0);
  const end = new Date(base); end.setHours(eh,em,es||0,0);
  if(end <= start){ toast('Jam selesai harus lebih besar dari jam mulai'); return; }
  state.events.push({
    id: uid(), sessionId: sess.id, kategoriId,
    type, category: type==='downtime' ? (kat?statusToCategoryTag(kat.status):'internal') : null,
    start: start.getTime(), end: end.getTime(),
    source:'manual', note: document.getElementById('manNote').value, photo: pendingPhoto.man, synced:false,
  });
  saveState();
  closeModal('manualModalBg');
  renderEventLog();
  renderLiveKpis();
  toast('Event tersimpan');
}

/* ===================== PARAMETER MESIN ===================== */
function openParamModal(){
  if(state.config.machines.length===0){ toast('Belum ada Master Mesin — tambah dulu di tab Admin', true); return; }
  const sel = document.getElementById('paramMachine');
  sel.innerHTML = state.config.machines.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
  document.getElementById('paramName').value='';
  document.getElementById('paramValue').value='';
  document.getElementById('paramUom').value='';
  document.getElementById('paramNote').value='';
  document.getElementById('paramModalBg').classList.add('active');
}
function saveParameter(){
  const sess = getActiveSession();
  if(!sess){ toast('Tidak ada sesi aktif'); return; }
  const machine = document.getElementById('paramMachine').value;
  const paramName = document.getElementById('paramName').value.trim();
  const value = document.getElementById('paramValue').value;
  if(!machine || !paramName || value===''){ toast('Isi mesin, nama parameter, & value dulu'); return; }
  state.parameters.push({
    id: uid(), sessionId: sess.id,
    machine, paramName, value: parseFloat(value),
    uom: document.getElementById('paramUom').value.trim(),
    note: document.getElementById('paramNote').value,
    recordedAt: Date.now(), synced: false,
  });
  saveState();
  closeModal('paramModalBg');
  renderParamLog();
  toast('Parameter tersimpan');
}
function renderParamLog(){
  const sess = getActiveSession();
  const wrap = document.getElementById('paramLog');
  if(!sess){ wrap.innerHTML='<div class="empty">Belum ada sesi</div>'; return; }
  const params = state.parameters.filter(p=>p.sessionId===sess.id).sort((a,b)=>b.recordedAt-a.recordedAt);
  if(params.length===0){ wrap.innerHTML='<div class="empty">Belum ada parameter</div>'; return; }
  wrap.innerHTML='';
  params.forEach(p=>{
    const row = document.createElement('div');
    row.className='event-item';
    row.innerHTML = `<div><b>${p.machine}</b> — ${p.paramName}<br>
        <span class="muted">${p.value}${p.uom?' '+p.uom:''} · ${new Date(p.recordedAt).toLocaleTimeString('id-ID')}${p.note?' · '+p.note:''}</span></div>
      <div style="display:flex; align-items:center;">
        <span class="sync-dot ${p.synced?'done':'pending'}"></span>
        <button class="btn-ghost" onclick="deleteParameter('${p.id}')">🗑</button>
      </div>`;
    wrap.appendChild(row);
  });
}
function deleteParameter(id){
  if(!confirm('Hapus parameter ini?')) return;
  state.parameters = state.parameters.filter(p=>p.id!==id);
  saveState();
  renderParamLog();
}

function viewPhoto(eventId){
  const ev = state.events.find(e=>e.id===eventId);
  if(!ev || !ev.photo) return;
  document.getElementById('photoViewImg').src = ev.photo;
  document.getElementById('photoViewBg').classList.add('active');
}
function editEventNote(id){
  const ev = state.events.find(e=>e.id===id);
  if(!ev) return;
  const n = prompt('Edit catatan event:', ev.note||'');
  if(n===null) return;
  ev.note = n; ev.synced=false; saveState(); renderEventLog();
}
function deleteEvent(id){
  if(!confirm('Hapus event ini?')) return;
  state.events = state.events.filter(e=>e.id!==id);
  saveState(); renderEventLog(); renderLiveKpis();
}

function renderEventLog(){
  const sess = getActiveSession();
  const wrap = document.getElementById('eventLog');
  if(!sess){ wrap.innerHTML='<div class="empty">Belum ada sesi</div>'; return; }
  const evs = state.events.filter(e=>e.sessionId===sess.id).sort((a,b)=>b.start-a.start);
  if(evs.length===0){ wrap.innerHTML='<div class="empty">Belum ada event</div>'; return; }
  wrap.innerHTML='';
  evs.forEach(ev=>{
    const kat = state.config.categories.find(x=>x.id===ev.kategoriId);
    const dur = fmtDuration(ev.end-ev.start);
    const tagClass = ev.type==='running' ? 'running' : (ev.category||'internal');
    const row = document.createElement('div');
    row.className='event-item';
    row.innerHTML = `<div><span class="tag ${tagClass}">${ev.type==='running'?'Running':(ev.category==='external'?'Ext':'Int')}</span>
        <b>${ev.type==='running' ? 'Line Running' : (kat?kat.kode+' — '+kat.kategori:'Downtime')}</b><br>
        <span class="muted">${new Date(ev.start).toLocaleTimeString('id-ID')}–${new Date(ev.end).toLocaleTimeString('id-ID')} (${dur}) ${ev.source==='manual'?'· manual':''}</span></div>
      <div style="display:flex; align-items:center;">
        <span class="sync-dot ${ev.synced?'done':'pending'}"></span>
        <button class="btn-ghost" onclick="editEventNote('${ev.id}')">✎</button>
        <button class="btn-ghost" onclick="deleteEvent('${ev.id}')">🗑</button>
        ${ev.photo ? `<img class="event-thumb" src="${ev.photo}" onclick="viewPhoto('${ev.id}')">` : ''}
      </div>`;
    wrap.appendChild(row);
  });
}

/* ===================== OEE CALCULATION (persis logika Matrix di file referensi) ===================== */
function calcOEE(session, events){
  const recordingMs = (session.endTime || Date.now()) - session.startTime;
  const recordingMin = recordingMs/60000;
  // Basis waktu produksi: pakai Planned Production Time kalau diisi (misal target SAT/running test 4 jam),
  // kalau kosong ya pakai waktu real sesi (behavior existing).
  const basisMin = session.plannedProductionMin || recordingMin;

  const evs = events.filter(e=>e.sessionId===session.id);
  const externalMin = evs.filter(e=>e.type==='downtime' && e.category==='external')
    .reduce((s,e)=>s+(e.end-e.start),0)/60000;
  const internalMin = evs.filter(e=>e.type==='downtime' && e.category==='internal')
    .reduce((s,e)=>s+(e.end-e.start),0)/60000;

  const actualRuntime = basisMin - externalMin; // = Waktu produksi - Customer time (K7)
  const actualProduced = (session.after!=null ? session.after - session.before - (session.reject||0) : null); // Sheet1 B11
  const reject = session.reject || 0;

  let availability=null, performance=null, quality=null, oee=null, actualSpeed=null;
  if(actualRuntime>0){
    availability = (actualRuntime - internalMin) / actualRuntime; // K15
  }
  if(actualRuntime>0 && actualProduced!=null && session.nominalSpeed){
    performance = actualProduced / (session.nominalSpeed * actualRuntime); // K16
  }
  if(actualProduced && actualProduced>0){
    quality = (actualProduced - reject) / actualProduced * 100; // K17
  }
  if(availability!=null && performance!=null && quality!=null){
    oee = availability * performance * quality / 100; // K18
  }
  if(actualProduced!=null && actualRuntime>0){
    actualSpeed = actualProduced / actualRuntime; // unit sama kayak Nominal Speed (bpm)
  }
  return { recordingMin, basisMin, externalMin, internalMin, actualRuntime, actualProduced, availability, performance, quality, oee, actualSpeed };
}

// Toggle tampilan Availability doang (live view) -> lihat dampak eksternal kalau ikut dihitung sebagai downtime.
// OEE/Performance/Quality tetap pakai rumus standar (Actual Runtime = Total - Eksternal), gak kepengaruh toggle ini.
let availabilityIncludesExternal = false;
function toggleAvailabilityMode(){
  availabilityIncludesExternal = !availabilityIncludesExternal;
  renderLiveKpis();
}
function calcAvailabilityWithExternal(r){
  if(r.basisMin<=0) return null;
  return (r.basisMin - r.internalMin - r.externalMin) / r.basisMin;
}

function renderLiveKpis(){
  const sess = getActiveSession();
  if(!sess) return;
  const r = calcOEE(sess, state.events);
  const availVal = availabilityIncludesExternal ? calcAvailabilityWithExternal(r) : r.availability;
  const availLbl = availabilityIncludesExternal ? 'Availability (+Eksternal) 🔄' : 'Availability (Internal saja) 🔄';
  const wrap = document.getElementById('liveKpis');
  wrap.innerHTML = `
    <div class="kpi oee"><div class="val">${r.oee!=null?(r.oee*100).toFixed(1)+'%':'—'}</div><div class="lbl">OEE (live, provisional)</div></div>
    <div class="kpi" onclick="toggleAvailabilityMode()" style="cursor:pointer">
      <div class="val">${availVal!=null?(availVal*100).toFixed(0)+'%':'—'}</div>
      <div class="lbl">${availLbl}</div>
    </div>
    <div class="kpi"><div class="val">${r.performance!=null?(r.performance*100).toFixed(0)+'%':'—'}</div><div class="lbl">Performance</div></div>
    <div class="kpi"><div class="val">${r.actualSpeed!=null?r.actualSpeed.toFixed(1):'—'}</div><div class="lbl">Actual Speed (bpm)</div></div>
    <div class="kpi"><div class="val">${fmtDuration(r.internalMin*60000)}</div><div class="lbl">Internal Downtime</div></div>
    <div class="kpi"><div class="val">${fmtDuration(r.externalMin*60000)}</div><div class="lbl">External (excluded)</div></div>
  `;
}

/* ===================== END SESSION ===================== */
function openEndSessionModal(){
  const sess = getActiveSession();
  if(state.lineTimer && state.lineTimer.type==='downtime'){
    const dur = fmtDuration(Date.now()-state.lineTimer.startedAt);
    if(!confirm(`Status masih Downtime (udah jalan ${dur}). Kalau lanjut, downtime ini bakal langsung dicatat selesai sampai sekarang. Lanjut akhiri sesi?`)) return;
  }
  document.getElementById('endAfter').value = '';
  document.getElementById('endReject').value = 0;
  document.getElementById('endPreview').innerHTML='';
  document.getElementById('endAfter').oninput = document.getElementById('endReject').oninput = ()=>{
    const after = parseFloat(document.getElementById('endAfter').value);
    const reject = parseFloat(document.getElementById('endReject').value)||0;
    if(isNaN(after)) return;
    const preview = Object.assign({}, sess, { after, reject, endTime: Date.now() });
    const r = calcOEE(preview, state.events);
    document.getElementById('endPreview').innerHTML = `
      <div class="kpi oee"><div class="val">${r.oee!=null?(r.oee*100).toFixed(1)+'%':'—'}</div><div class="lbl">OEE</div></div>
      <div class="kpi"><div class="val">${r.availability!=null?(r.availability*100).toFixed(0)+'%':'—'}</div><div class="lbl">Availability</div></div>
      <div class="kpi"><div class="val">${r.performance!=null?(r.performance*100).toFixed(0)+'%':'—'}</div><div class="lbl">Performance</div></div>
      <div class="kpi"><div class="val">${r.quality!=null?r.quality.toFixed(1)+'%':'—'}</div><div class="lbl">Quality</div></div>
      <div class="kpi"><div class="val">${r.actualSpeed!=null?r.actualSpeed.toFixed(1):'—'}</div><div class="lbl">Actual Speed (bpm)</div></div>
    `;
  };
  document.getElementById('endModalBg').classList.add('active');
}
function finishSession(){
  const sess = getActiveSession();
  const after = parseFloat(document.getElementById('endAfter').value);
  if(isNaN(after)){ toast('Isi product counter akhir'); return; }
  // commit timer yang masih jalan
  if(state.lineTimer){
    commitEvent(state.lineTimer, state.lineTimer.type);
  }
  state.lineTimer = null;
  sess.after = after;
  sess.reject = parseFloat(document.getElementById('endReject').value)||0;
  sess.endTime = Date.now();
  state.activeSessionId = null;
  saveState();
  closeModal('endModalBg');
  renderActiveSession();
  toast('Sesi selesai & tersimpan lokal. Jangan lupa sync!');
}

/* ===================== DASHBOARD ===================== */
let remoteData = { sessions: [], events: [], parameters: [] };

// Bar chart sederhana buat ranking (Pareto downtime, dst): entries = [[label, ms], ...] sudah ke-sort desc.
function renderBarList(containerId, entries){
  const wrap = document.getElementById(containerId);
  if(!entries.length){ wrap.innerHTML = '<div class="empty">Belum ada downtime</div>'; return; }
  const max = Math.max(...entries.map(e=>e[1]));
  wrap.innerHTML = entries.map(([label,ms])=>{
    const pct = max>0 ? Math.max(ms/max*100, 3) : 0;
    return `<div class="bar-row">
      <div class="bar-row-top"><span class="bar-label">${label}</span><span class="bar-value">${fmtDuration(ms)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}
function renderDashboard(){
  const fPU = document.getElementById('fPU').value;
  const fLine = document.getElementById('fLine').value;
  const fMode = document.getElementById('fMode').value;

  const allSessions = [...state.sessions, ...remoteData.sessions.filter(rs=>!state.sessions.find(ls=>ls.id===rs.id))]
    .filter(s=>s.endTime);
  const allEvents = [...state.events, ...remoteData.events.filter(re=>!state.events.find(le=>le.id===re.id))];

  const filtered = allSessions.filter(s=>
    (!fPU || s.pu===fPU) && (!fLine || s.line===fLine) && (!fMode || s.mode===fMode)
  );

  if(filtered.length===0){
    document.getElementById('dashKpis').innerHTML = '<div class="empty" style="grid-column:1/-1">Belum ada sesi selesai yang cocok filter</div>';
    document.getElementById('paretoList').innerHTML = '<div class="empty">Belum ada data</div>';
    document.getElementById('sessionHistory').innerHTML = '<div class="empty">Belum ada data</div>';
    return;
  }

  let sumOee=0, sumAvail=0, sumPerf=0, sumQual=0, n=0;
  const reasonAgg = {};
  const fungsiAgg = {};
  filtered.forEach(s=>{
    const r = calcOEE(s, allEvents);
    if(r.oee!=null){ sumOee+=r.oee; sumAvail+=r.availability; sumPerf+=r.performance; sumQual+=r.quality; n++; }
    allEvents.filter(e=>e.sessionId===s.id && e.type==='downtime').forEach(e=>{
      const kat = state.config.categories.find(x=>x.id===e.kategoriId);
      const key = kat ? (kat.kode+' — '+kat.kategori) : 'Lainnya';
      reasonAgg[key] = (reasonAgg[key]||0) + (e.end-e.start);
      const fKey = kat ? kat.groupingBesar : 'Lainnya';
      fungsiAgg[fKey] = (fungsiAgg[fKey]||0) + (e.end-e.start);
    });
  });

  document.getElementById('dashKpis').innerHTML = n>0 ? `
    <div class="kpi oee"><div class="val">${(sumOee/n*100).toFixed(1)}%</div><div class="lbl">Avg OEE</div></div>
    <div class="kpi"><div class="val">${(sumAvail/n*100).toFixed(0)}%</div><div class="lbl">Avg Availability</div></div>
    <div class="kpi"><div class="val">${(sumPerf/n*100).toFixed(0)}%</div><div class="lbl">Avg Performance</div></div>
    <div class="kpi"><div class="val">${(sumQual/n).toFixed(1)}%</div><div class="lbl">Avg Quality</div></div>
  ` : '<div class="empty" style="grid-column:1/-1">Data belum cukup buat hitung OEE (isi product counter akhir dulu)</div>';

  const sortedReasons = Object.entries(reasonAgg).sort((a,b)=>b[1]-a[1]).slice(0,6);
  renderBarList('paretoList', sortedReasons);

  const sortedFungsi = Object.entries(fungsiAgg).sort((a,b)=>b[1]-a[1]);
  renderBarList('fungsiList', sortedFungsi);

  document.getElementById('sessionHistory').innerHTML = filtered.sort((a,b)=>b.startTime-a.startTime).slice(0,15).map(s=>{
    const r = calcOEE(s, allEvents);
    const fmt1 = v => v!=null ? v.toFixed(1) : '—';
    const stat = (lbl,val) => `<span>${lbl} <b>${val}</b></span>`;
    return `<div class="sess-row">
      <div class="sess-row-top">
        <span>${s.date} · ${s.puName||s.pu}/${s.lineName||s.line} · ${s.shift}${s.productName?' · '+s.productName:''}</span>
        <b>${r.oee!=null?(r.oee*100).toFixed(1)+'%':'—'}</b>
      </div>
      <div class="sess-raw">
        ${stat('Nominal', fmt1(s.nominalSpeed)+' bpm')}
        ${stat('Actual', fmt1(r.actualSpeed)+' bpm')}
        ${stat('Counter', (s.before??'—')+' → '+(s.after??'—'))}
        ${stat('Reject', s.reject??0)}
        ${stat('Produced', r.actualProduced??'—')}
        ${stat('Runtime', fmt1(r.actualRuntime)+' min')}
        ${stat('Int DT', fmt1(r.internalMin)+' min')}
        ${stat('Ext DT', fmt1(r.externalMin)+' min')}
        ${stat('Avail', r.availability!=null?(r.availability*100).toFixed(0)+'%':'—')}
        ${stat('Perf', r.performance!=null?(r.performance*100).toFixed(0)+'%':'—')}
        ${stat('Qual', r.quality!=null?r.quality.toFixed(1)+'%':'—')}
      </div>
    </div>`;
  }).join('');
}

function populateFilterLines(){
  const fPU = document.getElementById('fPU');
  const fLine = document.getElementById('fLine');
  fLine.innerHTML = '<option value="">Semua Line</option>';
  const pu = state.config.pus.find(p=>p.id===fPU.value);
  (pu?pu.lines:state.config.pus.flatMap(p=>p.lines)).forEach(l=>{
    const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; fLine.appendChild(o);
  });
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('fPU').addEventListener('change', ()=>{ populateFilterLines(); renderDashboard(); });
  document.getElementById('fLine').addEventListener('change', renderDashboard);
  document.getElementById('fMode').addEventListener('change', renderDashboard);
  populateFilterLines();
});

async function pullDashboard(){
  const url = localStorage.getItem('oee_api_url');
  if(!url){ toast('Set Apps Script URL dulu di tab Sync'); return; }
  try{
    toast('Menarik data...');
    const res = await fetch(url+'?action=getData');
    const data = await res.json();
    remoteData.sessions = data.sessions || [];
    remoteData.events = data.events || [];
    remoteData.parameters = data.parameters || [];
    toast('Data terbaru berhasil ditarik');
    renderDashboard();
  }catch(e){
    toast('Gagal tarik data — cek koneksi/URL', true);
  }
}

/* ===================== SYNC ===================== */
function renderSyncView(){
  document.getElementById('pendingSessCount').textContent = state.sessions.filter(s=>!s.synced && s.endTime).length;
  document.getElementById('pendingEvtCount').textContent = state.events.filter(e=>!e.synced).length;
  document.getElementById('pendingParamCount').textContent = state.parameters.filter(p=>!p.synced).length;
}
function saveApiUrl(){
  const v = document.getElementById('apiUrl').value.trim();
  localStorage.setItem('oee_api_url', v);
  toast('URL tersimpan');
}
async function syncAll(){
  const url = localStorage.getItem('oee_api_url');
  if(!url){ toast('Set Apps Script URL dulu'); return; }
  const pendingSessions = state.sessions.filter(s=>!s.synced && s.endTime);
  const pendingEvents = state.events.filter(e=>!e.synced).map(e=>{
    const k = state.config.categories.find(x=>x.id===e.kategoriId);
    return Object.assign({}, e, {
      kode: k ? k.kode : '', kategori: k ? k.kategori : '',
      groupingBesar: k ? k.groupingBesar : '', groupingSub: k ? k.groupingSub : '',
      status: k ? k.status : '', atribusi: k ? k.atribusi : '',
    });
  });
  const pendingParameters = state.parameters.filter(p=>!p.synced);
  if(pendingSessions.length===0 && pendingEvents.length===0 && pendingParameters.length===0){ toast('Tidak ada data baru untuk sync'); return; }
  document.getElementById('syncStatus').textContent = 'Mengirim '+pendingSessions.length+' sesi, '+pendingEvents.length+' event & '+pendingParameters.length+' parameter...';
  try{
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({ action:'sync', sessions: pendingSessions, events: pendingEvents, parameters: pendingParameters }),
    });
    const result = await res.json();
    if(result.ok){
      pendingSessions.forEach(s=>s.synced=true);
      pendingEvents.forEach(e=>e.synced=true);
      pendingParameters.forEach(p=>p.synced=true);
      saveState();
      renderSyncView();
      document.getElementById('syncStatus').textContent = 'Sync berhasil: '+new Date().toLocaleTimeString('id-ID');
      toast('Sync berhasil');
    } else {
      document.getElementById('syncStatus').textContent = 'Gagal: '+(result.error||'unknown error');
      toast('Sync gagal: '+(result.error||'unknown error'), true);
    }
  }catch(e){
    document.getElementById('syncStatus').textContent = 'Gagal konek ke server — data tetap aman di lokal, coba lagi nanti.';
    toast('Sync gagal — gagal konek ke server. Data tetap aman di lokal.', true);
  }
}
function clearSyncedData(){
  if(!confirm('Hapus semua sesi & event yang sudah ter-sync dari HP ini?')) return;
  state.sessions = state.sessions.filter(s=>!s.synced);
  state.events = state.events.filter(e=>!e.synced);
  state.parameters = state.parameters.filter(p=>!p.synced);
  saveState();
  renderSyncView();
  toast('Data lokal yang sudah sync dihapus');
}

function exportBackup(){
  const data = {
    exportedAt: new Date().toISOString(),
    sessions: state.sessions,
    events: state.events,
    parameters: state.parameters,
    config: state.config,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oee-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Backup diunduh');
}

/* ===================== ADMIN ===================== */
function checkAdminPin(){
  if(document.getElementById('adminPin').value === ADMIN_PIN){
    document.getElementById('adminLock').style.display='none';
    document.getElementById('adminPanel').style.display='block';
    renderAdmin();
  } else { toast('PIN salah'); }
}
function renderAdmin(){
  if(document.getElementById('adminPanel').style.display==='none') return;
  // PU & Line list
  const puWrap = document.getElementById('puLineList');
  puWrap.innerHTML = state.config.pus.map(pu=>`
    <div class="list-row"><b>${pu.name}</b>
      <button class="btn-ghost" onclick="deletePU('${pu.id}')">🗑</button></div>
    ${pu.lines.map(l=>`<div class="list-row" style="padding-left:14px"><span class="muted">↳ ${l.name}</span>
      <button class="btn-ghost" onclick="deleteLine('${pu.id}','${l.id}')">🗑</button></div>`).join('')}
  `).join('');
  const parentSel = document.getElementById('lineParentPU');
  parentSel.innerHTML = state.config.pus.map(pu=>`<option value="${pu.id}">${pu.name}</option>`).join('');

  document.getElementById('machineList').innerHTML = state.config.machines.map(m=>
    `<div class="list-row"><span>${m.name}</span><button class="btn-ghost" onclick="deleteMachine('${m.id}')">🗑</button></div>`
  ).join('') || '<div class="empty">Belum ada mesin</div>';

  renderProductList();
  renderKategoriList();
}
function addMachine(){
  const name = document.getElementById('newMachine').value.trim();
  if(!name) return;
  state.config.machines.push({ id: uid(), name });
  saveState(); document.getElementById('newMachine').value=''; renderAdmin();
}
function deleteMachine(id){
  if(!confirm('Hapus mesin ini?')) return;
  state.config.machines = state.config.machines.filter(m=>m.id!==id);
  saveState(); renderAdmin();
}
function importStandardMasterData(){
  if(!confirm(`Ini bakal GANTI semua Master Kategori Downtime (jadi ${DOWNTIME_MASTER.length} kategori standar) & Master Mesin (jadi ${MACHINE_MASTER.length} mesin standar) yang ada sekarang. Sesi/event yang udah tercatat gak kepengaruh. Lanjut?`)) return;
  state.config.categories = JSON.parse(JSON.stringify(DOWNTIME_MASTER));
  state.config.machines = JSON.parse(JSON.stringify(MACHINE_MASTER));
  saveState();
  renderAdmin();
  toast('Master data standar berhasil di-import');
}
function renderProductList(){
  document.getElementById('productList').innerHTML = state.config.products.map(p=>{
    const lineLabel = state.config.pus.flatMap(pu=>pu.lines.map(l=>({id:l.id, label:pu.name+'/'+l.name}))).find(x=>x.id===p.lineId);
    return `<div class="list-row"><span><b>${p.name}</b> — ${p.packagingSize} · ${p.idealSpeed} bpm<br>
      <span class="muted">${lineLabel?lineLabel.label:'?'}</span></span>
      <button class="btn-ghost" onclick="deleteProduct('${p.id}')">🗑</button></div>`;
  }).join('') || '<div class="empty">Belum ada produk</div>';
}
function renderKategoriList(){
  document.getElementById('kategoriList').innerHTML = state.config.categories.map(c=>{
    const tag = statusToCategoryTag(c.status);
    return `<div class="list-row"><span><b>${c.kode}</b> ${c.kategori} <span class="tag ${tag}">${c.status}</span><br>
      <span class="muted">${c.groupingBesar} / ${c.groupingSub}${c.atribusi?' · '+c.atribusi:''}</span></span>
      <span style="display:flex; align-items:center; flex-shrink:0;">
        <button class="btn-ghost" onclick="editKategori('${c.id}')">✎</button>
        <button class="btn-ghost" onclick="deleteKategori('${c.id}')">🗑</button>
      </span></div>`;
  }).join('') || '<div class="empty">Belum ada kategori</div>';
}
function addPU(){
  const name = document.getElementById('newPU').value.trim();
  if(!name) return;
  state.config.pus.push({ id: uid(), name, lines: [] });
  saveState(); document.getElementById('newPU').value=''; populatePUSelects(); renderAdmin();
}
function deletePU(id){
  if(!confirm('Hapus PU ini beserta line-nya?')) return;
  state.config.pus = state.config.pus.filter(p=>p.id!==id);
  saveState(); populatePUSelects(); renderAdmin();
}
function addLine(){
  const puId = document.getElementById('lineParentPU').value;
  const name = document.getElementById('newLine').value.trim();
  if(!name) return;
  const pu = state.config.pus.find(p=>p.id===puId);
  pu.lines.push({ id: uid(), name });
  saveState(); document.getElementById('newLine').value=''; populatePUSelects(); renderAdmin();
}
function deleteLine(puId, lineId){
  const pu = state.config.pus.find(p=>p.id===puId);
  pu.lines = pu.lines.filter(l=>l.id!==lineId);
  saveState(); populatePUSelects(); renderAdmin();
}
function addProduct(){
  const lineId = document.getElementById('prodLineSel').value;
  const name = document.getElementById('newProdName').value.trim();
  const packagingSize = document.getElementById('newProdSize').value.trim();
  const idealSpeed = parseFloat(document.getElementById('newProdSpeed').value);
  if(!name || !packagingSize || !idealSpeed){ toast('Isi nama produk, ukuran kemasan & speed dulu'); return; }
  state.config.products.push({ id: uid(), lineId, name, packagingSize, idealSpeed });
  saveState();
  ['newProdName','newProdSize','newProdSpeed'].forEach(id=>document.getElementById(id).value='');
  renderProductList();
  populateProductSelect(document.getElementById('sLine').value);
}
function deleteProduct(id){
  state.config.products = state.config.products.filter(p=>p.id!==id);
  saveState(); renderProductList();
  populateProductSelect(document.getElementById('sLine').value);
}

let editingKategoriId = null;
function addKategori(){
  const kode = document.getElementById('newKode').value.trim();
  const kategori = document.getElementById('newKategori').value.trim();
  const groupingBesar = document.getElementById('newGroupingBesar').value.trim();
  const groupingSub = document.getElementById('newGroupingSub').value.trim();
  const status = document.getElementById('newStatus').value;
  const atribusi = document.getElementById('newAtribusi').value.trim();
  if(!kode || !kategori){ toast('Isi Kode & Nama Kategori dulu'); return; }
  if(editingKategoriId){
    const c = state.config.categories.find(x=>x.id===editingKategoriId);
    if(c) Object.assign(c, { kode, kategori, groupingBesar, groupingSub, status, atribusi });
  } else {
    state.config.categories.push({ id: uid(), kode, kategori, groupingBesar, groupingSub, status, atribusi });
  }
  saveState();
  cancelEditKategori();
  renderKategoriList();
}
function editKategori(id){
  const c = state.config.categories.find(x=>x.id===id);
  if(!c) return;
  editingKategoriId = id;
  document.getElementById('newKode').value = c.kode;
  document.getElementById('newKategori').value = c.kategori;
  document.getElementById('newGroupingBesar').value = c.groupingBesar;
  document.getElementById('newGroupingSub').value = c.groupingSub;
  document.getElementById('newStatus').value = c.status;
  document.getElementById('newAtribusi').value = c.atribusi || '';
  document.getElementById('kategoriFormBtn').textContent = '✓ Update Kategori';
  document.getElementById('kategoriCancelBtn').style.display = 'block';
}
function cancelEditKategori(){
  editingKategoriId = null;
  ['newKode','newKategori','newGroupingBesar','newGroupingSub','newAtribusi'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('newStatus').value = 'Unplanned';
  document.getElementById('kategoriFormBtn').textContent = '+ Tambah Kategori';
  document.getElementById('kategoriCancelBtn').style.display = 'none';
}
function deleteKategori(id){
  if(!confirm('Hapus kategori ini?')) return;
  state.config.categories = state.config.categories.filter(c=>c.id!==id);
  if(editingKategoriId===id) cancelEditKategori();
  saveState(); renderKategoriList();
}
