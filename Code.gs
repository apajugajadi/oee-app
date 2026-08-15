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

const SESSION_HEADERS = ['id','mode','pu','puName','line','lineName','shift','date','productId','productName','packagingSize','startTime','endTime','nominalSpeed','before','after','reject','synced_at'];
const EVENT_HEADERS = ['id','sessionId','machineId','machineName','kategoriId','kode','kategori','groupingBesar','groupingSub','status','atribusi','type','category','start','end','durationMin','source','note','photoUrl','synced_at'];

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
    return jsonOut({ ok:false, error:'unknown action' });
  }catch(err){
    return jsonOut({ ok:false, error: err.message });
  }
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
  const now = new Date().toISOString();

  const existingSessIds = sessSheet.getLastRow()>1
    ? sessSheet.getRange(2,1,sessSheet.getLastRow()-1,1).getValues().flat() : [];
  (body.sessions||[]).forEach(s=>{
    if(existingSessIds.indexOf(s.id)!==-1) return; // skip duplikat
    sessSheet.appendRow([
      s.id, s.mode, s.pu, s.puName, s.line, s.lineName, s.shift, s.date,
      s.productId||'', s.productName||'', s.packagingSize||'',
      s.startTime, s.endTime, s.nominalSpeed, s.before, s.after, s.reject, now,
    ]);
  });

  const existingEvtIds = evtSheet.getLastRow()>1
    ? evtSheet.getRange(2,1,evtSheet.getLastRow()-1,1).getValues().flat() : [];
  (body.events||[]).forEach(ev=>{
    if(existingEvtIds.indexOf(ev.id)!==-1) return;
    const photoUrl = uploadPhoto(ev.photo, ev.id);
    evtSheet.appendRow([
      ev.id, ev.sessionId, ev.machineId, ev.machineName||'', ev.kategoriId||'',
      ev.kode||'', ev.kategori||'', ev.groupingBesar||'', ev.groupingSub||'', ev.status||'', ev.atribusi||'',
      ev.type, ev.category||'', ev.start, ev.end, ((ev.end-ev.start)/60000).toFixed(2),
      ev.source, ev.note||'', photoUrl, now,
    ]);
  });

  return jsonOut({ ok:true, sessionsAdded: (body.sessions||[]).length, eventsAdded: (body.events||[]).length });
}

function getAllData(){
  const sessSheet = ensureSheet(SESSIONS_SHEET, SESSION_HEADERS);
  const evtSheet = ensureSheet(EVENTS_SHEET, EVENT_HEADERS);

  const sessions = sheetToObjects(sessSheet).map(r=>({
    id:r.id, mode:r.mode, pu:r.pu, puName:r.puName, line:r.line, lineName:r.lineName,
    shift:r.shift, date:r.date, productId:r.productId, productName:r.productName, packagingSize:r.packagingSize,
    startTime:Number(r.startTime), endTime:Number(r.endTime),
    nominalSpeed:Number(r.nominalSpeed), before:Number(r.before), after:Number(r.after),
    reject:Number(r.reject), synced:true,
  }));
  const events = sheetToObjects(evtSheet).map(r=>({
    id:r.id, sessionId:r.sessionId, machineId:r.machineId, kategoriId:r.kategoriId,
    kode:r.kode, kategori:r.kategori, groupingBesar:r.groupingBesar, groupingSub:r.groupingSub,
    status:r.status, atribusi:r.atribusi,
    type:r.type, category:r.category, start:Number(r.start), end:Number(r.end),
    source:r.source, note:r.note, photoUrl:r.photoUrl, synced:true,
  }));
  return { sessions, events };
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
