/**
 * OEE MONITORING — Apps Script Backend
 * Deploy sebagai Web App (Execute as: Me, Access: Anyone with link).
 * Sheet baru akan otomatis dibuat/dipakai berdasarkan SHEET_ID di bawah.
 *
 * Setup:
 * 1. Buat Google Sheet baru, kosong.
 * 2. Copy Sheet ID dari URL-nya, isi ke SHEET_ID di bawah.
 * 3. Extensions > Apps Script, paste kode ini, Save.
 * 4. Deploy > New deployment > Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone with the link
 * 5. Copy URL hasil deploy, paste ke app (tab Sync > Apps Script Web App URL).
 */

const SHEET_ID = 'PASTE_SHEET_ID_DI_SINI';
const PHOTO_FOLDER_NAME = 'OEE Monitoring - Foto Downtime'; // folder Drive dibuat otomatis
const SESSIONS_SHEET = 'Sessions';
const EVENTS_SHEET = 'Events';
const PARAMETERS_SHEET = 'Parameters';
const COUNTER_SHEET = 'CounterPings'; // belum dipakai app — siap-siap buat upgrade counter sensor proximity (lihat SETUP.md)

const SESSION_HEADERS = ['id','mode','pu','puName','line','lineName','shift','date','productId','productName','packagingSize','startTime','endTime','nominalSpeed','plannedProductionMin','before','after','reject','synced_at'];
const EVENT_HEADERS = ['id','sessionId','kategoriId','kode','kategori','groupingBesar','groupingSub','status','atribusi','type','category','start','end','durationMin','source','note','photoUrl','synced_at'];
const PARAMETER_HEADERS = ['id','sessionId','machine','paramName','value','uom','note','recordedAt','synced_at'];
const COUNTER_HEADERS = ['id','deviceId','sessionId','count','ts','received_at'];

function getSS(){ return SpreadsheetApp.openById(SHEET_ID); }

function getPhotoFolder(){
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function uploadPhoto(dataUrl, eventId){
  if(!dataUrl) return '';
  try{
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if(!match) return '';
    const contentType = match[1];
    const bytes = Utilities.base64Decode(match[2]);
    const blob = Utilities.newBlob(bytes, contentType, eventId+'.jpg');
    const file = getPhotoFolder().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  }catch(err){
    return '';
  }
}

function ensureSheet(name, headers){
  const ss = getSS();
  let sh = ss.getSheetByName(name);
  if(!sh){
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else if(sh.getLastRow()===0){
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents);
    if(body.action==='sync'){
      return handleSync(body);
    }
    if(body.action==='counterPing'){
      return handleCounterPing(body);
    }
    return jsonOut({ ok:false, error:'unknown action' });
  }catch(err){
    return jsonOut({ ok:false, error: err.message });
  }
}

// Endpoint buat alat counter sensor proximity (ESP32) — lihat SETUP.md bab "Upgrade Counter Otomatis".
// Belum dipakai/dikonsumsi web app, cuma nampung data mentahnya dulu di sheet CounterPings.
function handleCounterPing(body){
  const sheet = ensureSheet(COUNTER_SHEET, COUNTER_HEADERS);
  sheet.appendRow([
    Utilities.getUuid(), body.deviceId||'', body.sessionId||'', body.count, body.ts||'', new Date().toISOString(),
  ]);
  return jsonOut({ ok:true });
}

function doGet(e){
  try{
    const action = e.parameter.action;
    if(action==='getData'){
      return jsonOut(getAllData());
    }
    return jsonOut({ ok:false, error:'unknown action' });
  }catch(err){
    return jsonOut({ ok:false, error: err.message });
  }
}

function handleSync(body){
  const sessSheet = ensureSheet(SESSIONS_SHEET, SESSION_HEADERS);
  const evtSheet = ensureSheet(EVENTS_SHEET, EVENT_HEADERS);
  const paramSheet = ensureSheet(PARAMETERS_SHEET, PARAMETER_HEADERS);
  const now = new Date().toISOString();

  const existingSessIds = sessSheet.getLastRow()>1
    ? sessSheet.getRange(2,1,sessSheet.getLastRow()-1,1).getValues().flat() : [];
  (body.sessions||[]).forEach(s=>{
    if(existingSessIds.indexOf(s.id)!==-1) return; // skip duplikat
    sessSheet.appendRow([
      s.id, s.mode, s.pu, s.puName, s.line, s.lineName, s.shift, s.date,
      s.productId||'', s.productName||'', s.packagingSize||'',
      s.startTime, s.endTime, s.nominalSpeed, s.plannedProductionMin||'', s.before, s.after, s.reject, now,
    ]);
  });

  const existingEvtIds = evtSheet.getLastRow()>1
    ? evtSheet.getRange(2,1,evtSheet.getLastRow()-1,1).getValues().flat() : [];
  (body.events||[]).forEach(ev=>{
    if(existingEvtIds.indexOf(ev.id)!==-1) return;
    const photoUrl = uploadPhoto(ev.photo, ev.id);
    evtSheet.appendRow([
      ev.id, ev.sessionId, ev.kategoriId||'',
      ev.kode||'', ev.kategori||'', ev.groupingBesar||'', ev.groupingSub||'', ev.status||'', ev.atribusi||'',
      ev.type, ev.category||'', ev.start, ev.end, ((ev.end-ev.start)/60000).toFixed(2),
      ev.source, ev.note||'', photoUrl, now,
    ]);
  });

  const existingParamIds = paramSheet.getLastRow()>1
    ? paramSheet.getRange(2,1,paramSheet.getLastRow()-1,1).getValues().flat() : [];
  (body.parameters||[]).forEach(p=>{
    if(existingParamIds.indexOf(p.id)!==-1) return;
    paramSheet.appendRow([
      p.id, p.sessionId, p.machine||'', p.paramName||'', p.value, p.uom||'', p.note||'', p.recordedAt, now,
    ]);
  });

  return jsonOut({ ok:true, sessionsAdded: (body.sessions||[]).length, eventsAdded: (body.events||[]).length, parametersAdded: (body.parameters||[]).length });
}

function getAllData(){
  const sessSheet = ensureSheet(SESSIONS_SHEET, SESSION_HEADERS);
  const evtSheet = ensureSheet(EVENTS_SHEET, EVENT_HEADERS);
  const paramSheet = ensureSheet(PARAMETERS_SHEET, PARAMETER_HEADERS);

  const sessions = sheetToObjects(sessSheet).map(r=>({
    id:r.id, mode:r.mode, pu:r.pu, puName:r.puName, line:r.line, lineName:r.lineName,
    shift:r.shift, date:r.date, productId:r.productId, productName:r.productName, packagingSize:r.packagingSize,
    startTime:Number(r.startTime), endTime:Number(r.endTime),
    nominalSpeed:Number(r.nominalSpeed), plannedProductionMin: r.plannedProductionMin ? Number(r.plannedProductionMin) : null,
    before:Number(r.before), after:Number(r.after),
    reject:Number(r.reject), synced:true,
  }));
  const events = sheetToObjects(evtSheet).map(r=>({
    id:r.id, sessionId:r.sessionId, kategoriId:r.kategoriId,
    kode:r.kode, kategori:r.kategori, groupingBesar:r.groupingBesar, groupingSub:r.groupingSub,
    status:r.status, atribusi:r.atribusi,
    type:r.type, category:r.category, start:Number(r.start), end:Number(r.end),
    source:r.source, note:r.note, photoUrl:r.photoUrl, synced:true,
  }));
  const parameters = sheetToObjects(paramSheet).map(r=>({
    id:r.id, sessionId:r.sessionId, machine:r.machine, paramName:r.paramName,
    value:Number(r.value), uom:r.uom, note:r.note, recordedAt:Number(r.recordedAt), synced:true,
  }));
  return { sessions, events, parameters };
}

function sheetToObjects(sh){
  const values = sh.getDataRange().getValues();
  if(values.length<2) return [];
  const headers = values[0];
  return values.slice(1).map(row=>{
    const o={};
    headers.forEach((h,i)=>o[h]=row[i]);
    return o;
  });
}

function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
