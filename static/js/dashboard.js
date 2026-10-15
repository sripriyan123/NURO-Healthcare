const $=id=>document.getElementById(id);
let currentState=null, historyView=true, rotating=true, glow=true, toastTimer;
const metricMap={heart_rate:['heartRate','heartStatus'],spo2:['spo2','spo2Status'],resp_rate:['respRate','respStatus'],temperature:['temperature','tempStatus']};
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function statusClass(s){return s==='Normal'?'normal':s==='Low'?'low':'high'}
function updateState(data){
 currentState=data;
 $('heartRate').textContent=data.vitals.heart_rate;const heroBpm=$('heroHeartRate');if(heroBpm)heroBpm.textContent=data.vitals.heart_rate;$('spo2').textContent=data.vitals.spo2;$('respRate').textContent=data.vitals.resp_rate;$('temperature').textContent=Number(data.vitals.temperature).toFixed(1);
 $('systolic').textContent=data.vitals.systolic;$('diastolic').textContent=data.vitals.diastolic;
 const statuses=[['heartStatus','heart_rate'],['spo2Status','spo2'],['respStatus','resp_rate'],['tempStatus','temperature']];
 statuses.forEach(([id,key])=>{const el=$(id);el.textContent=data.status[key].toUpperCase();el.className='status-chip '+statusClass(data.status[key])});
 const high=data.status.heart_rate!=='Normal'||data.status.spo2!=='Normal'||data.status.resp_rate!=='Normal'||data.status.temperature!=='Normal';
 $('bpNote').textContent=data.vitals.systolic>=140?'Above demo reference range':data.vitals.systolic<90?'Below demo reference range':'Within demo reference range';
 $('bpGauge').style.width=Math.max(8,Math.min(100,(data.vitals.systolic-70)/100*100))+'%';
 $('alertCount').textContent=String(data.events.filter(e=>e.severity==='warning'||e.severity==='critical').length).padStart(2,'0');
 $('eventList').innerHTML=data.events.length?data.events.map(e=>`<div class="event-item"><span class="event-mark ${e.severity}">${e.severity==='critical'?'!':e.severity==='warning'?'△':'✓'}</span><div><b>${escapeHtml(e.message)}</b><small>${e.time} · ${e.severity.toUpperCase()}</small></div></div>`).join(''):'<div class="empty-state">No events yet. Start a scenario to see activity.</div>';
 $('historyCount').textContent=`${data.history.length} observations captured`;$('updatedAt').textContent='Updated '+data.timestamp;
 const livePill=document.querySelector('.environment-pill');if(livePill){const label=data.source==='wokwi-esp32'?'WOKWI DEVICE LIVE':'LOCAL SIMULATION';livePill.innerHTML='<span class="live-dot"></span> '+escapeHtml(document.body.dataset.role.toUpperCase())+' · '+label;}
 const notice=document.querySelector('.notice-bar small');if(notice)notice.textContent=data.source==='wokwi-esp32'?'Readings received from the Wokwi ESP32 simulation. Demo data only; not for diagnosis.':'All patient values are generated demo data. Not for diagnosis or real patient monitoring.';
 drawHistory(data.history);drawSparks(data.history);updatePortalData(data);
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function fetchState(){try{const r=await fetch('/api/state');if(r.status===401){location.href='/';return}updateState(await r.json())}catch(e){toast('Could not reach local simulator API')}}
async function simulate(mode){
 document.querySelectorAll('.scenario-btn').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
 const labels={normal:'Baseline observation',tachycardia:'Tachycardia scenario',hypoxia:'Hypoxia scenario',fever:'Fever scenario',bradycardia:'Bradycardia scenario',reset:'Baseline observation'};
 $('scenarioLabel').textContent=labels[mode]||'Scenario';$('lastAction').textContent='Running '+(labels[mode]||mode).toLowerCase()+'…';
 try{const r=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})});if(!r.ok)throw new Error();updateState(await r.json());$('lastAction').textContent='Updated just now';toast((labels[mode]||'Scenario')+' simulated')}catch(e){toast('Simulation request failed')}
}
document.querySelectorAll('.scenario-btn').forEach(b=>b.addEventListener('click',()=>simulate(b.dataset.mode)));
$('resetBtn').addEventListener('click',()=>simulate('reset'));
$('logoutBtn').addEventListener('click',async()=>{await fetch('/logout',{method:'POST'});location.href='/'});
$('reportBtn').addEventListener('click',async()=>{
 try{const r=await fetch('/api/report');const data=await r.json();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vitasphere-simulation-report.json';a.click();URL.revokeObjectURL(a.href);toast('Simulation report exported')}
 catch(e){toast('Report export failed')}
});
$('clearHistoryBtn').addEventListener('click',()=>{if(currentState){currentState.history=[];drawHistory([]);$('historyCount').textContent='Local chart view cleared';toast('Chart view cleared (server history unchanged)')}});
function drawSparks(items){const last=items.slice(-12);const vals=last.length?last.map(x=>x.heart_rate):[84,82,86,83,88,84];['heartSpark','spo2Spark','respSpark','tempSpark'].forEach((id,idx)=>{const v=idx===0?vals:idx===1?(last.length?last.map(x=>x.spo2):[97,98,97,99,98]):idx===2?(last.length?last.map(x=>x.resp_rate):[16,15,17,16,16]):(last.length?last.map(x=>x.temperature):[36.8,36.9,36.8,37,36.9]);const el=$(id);el.innerHTML='<svg viewBox="0 0 100 25" preserveAspectRatio="none"><polyline points="'+v.map((n,i)=>`${i/(Math.max(1,v.length-1))*100},${22-(Number(n)-Math.min(...v))/(Math.max(...v)-Math.min(...v)||1)*18}`).join(' ')+'" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'})}
function drawHistory(items){
 const c=$('historyCanvas'),ctx=c.getContext('2d'),w=c.clientWidth||500,h=120,dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 ctx.strokeStyle='rgba(120,160,180,.14)';ctx.lineWidth=1;for(let y=15;y<h;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 if(!items.length){ctx.fillStyle='#78909e';ctx.font='12px Inter';ctx.fillText('Trigger a scenario to start capturing observations',12,60);return}
 const draw=(key,color,min,max)=>{ctx.beginPath();items.forEach((it,i)=>{const x=items.length===1?w/2:i/(items.length-1)*w;const y=h-12-(Number(it[key])-min)/(max-min)* (h-28);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke()};
 draw('heart_rate','#56e2bd',40,145);draw('spo2','#4ac8ed',80,100);
}
const canvas=$('ecgCanvas'),ctx=canvas.getContext('2d');let phase=0;
function drawECG(){
 const w=canvas.clientWidth||800,h=145,dpr=window.devicePixelRatio||1;if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr)}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 ctx.strokeStyle='rgba(82,160,166,.12)';ctx.lineWidth=1;for(let x=0;x<w;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 ctx.beginPath();for(let x=0;x<w;x++){const t=(x+phase)%150;let y=h*.52+Math.sin((x+phase)*.045)*2;if(t>25&&t<34)y-=Math.sin((t-25)/9*Math.PI)*13;if(t>48&&t<54)y+=Math.sin((t-48)/6*Math.PI)*45;if(t>=54&&t<61)y-=Math.sin((t-54)/7*Math.PI)*12;if(t>78&&t<105)y-=Math.sin((t-78)/27*Math.PI)*13; x?ctx.lineTo(x,y):ctx.moveTo(x,y)}
 ctx.strokeStyle='#59e1c2';ctx.lineWidth=2;ctx.shadowColor='#39d7bd';ctx.shadowBlur=8;ctx.stroke();ctx.shadowBlur=0;phase+=1;requestAnimationFrame(drawECG)
}
function setClock(){const d=new Date();$('clock').textContent=d.toLocaleTimeString('en-GB');$('dateLabel').textContent=d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}

setInterval(setClock,1000);setClock();fetchState();setInterval(fetchState,1000);drawECG();
window.addEventListener('resize',()=>{if(currentState)drawHistory(currentState.history)});

// VitaSphere V2 portal interactions and animated transitions
function updatePortalData(data){
 const v=data.vitals||{}, statuses=data.status||{};
 const abnormal=Object.values(statuses).some(x=>x!=='Normal');
 const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
 set('caretakerStatus',abnormal?'Needs review':'Stable');set('caretakerAlerts',String((data.events||[]).filter(e=>e.severity==='warning'||e.severity==='critical').length)+' active');set('caretakerUpdated',data.timestamp||'Just now');
 set('reportHR',v.heart_rate??'—');set('reportSpO2',v.spo2??'—');set('reportBP',(v.systolic??'—')+'/'+(v.diastolic??'—'));set('reportTemp',Number(v.temperature||0).toFixed(1));
 const summary=document.getElementById('reportEventSummary');if(summary)summary.innerHTML=(data.events||[]).slice(0,4).map(e=>`<div class="report-event"><span class="event-mark ${escapeHtml(e.severity)}">${e.severity==='critical'?'!':e.severity==='warning'?'△':'✓'}</span><div><b>${escapeHtml(e.message)}</b><small>${escapeHtml(e.time)}</small></div></div>`).join('')||'No simulated events yet.';
 renderDoctorRows(data);
}
function renderDoctorRows(data){
 const body=document.getElementById('doctorPatientRows');if(!body)return;
 const v=data.vitals||{},statuses=data.status||{};const abnormal=Object.values(statuses).some(x=>x!=='Normal');
 const filter=document.getElementById('reportFilter')?.value||'all';const q=(document.getElementById('patientSearch')?.value||'').toLowerCase();
 const row={name:'Anya Sharma',id:'VS-001',heart:v.heart_rate,spo2:v.spo2,bp:`${v.systolic}/${v.diastolic}`,temp:Number(v.temperature).toFixed(1),abnormal};
 const matchesSearch=(row.name+' '+row.id).toLowerCase().includes(q);const matchesFilter=filter==='all'||(filter==='abnormal'&&row.abnormal)||(filter==='normal'&&!row.abnormal);
 body.innerHTML=matchesSearch&&matchesFilter?`<tr class="row-animated"><td><div class="patient-name-cell"><span class="patient-avatar">AS</span><div><b>${row.name}</b><small>${row.id} · Demo patient</small></div></div></td><td>${row.heart} BPM</td><td>${row.spo2}%</td><td>${row.bp} mmHg</td><td>${row.temp}°C</td><td><span class="status-pill ${row.abnormal?'warning':'normal'}">${row.abnormal?'Flagged demo values':'Stable demo'}</span></td><td><button class="table-action" type="button" onclick="document.getElementById('vitals').scrollIntoView({behavior:'smooth'})">Review</button></td></tr>`:'<tr><td colspan="7" class="table-empty">No demo records match this filter.</td></tr>';
 const count=document.getElementById('doctorRecordCount');if(count)count.textContent=matchesSearch&&matchesFilter?'1 demo record':'0 matching records';
}
function downloadVitaReport(){if(!currentState){toast('Wait for the first simulated reading');return}const payload={product:'VitaSphere 3D Health Simulator',generated_at:new Date().toISOString(),demo_only:true,notice:'Simulated values only. Not for diagnosis or treatment.',subject:{name:'Anya Sharma',id:'VS-001'},...currentState};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vitasphere-demo-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast('Demo report downloaded');}
document.getElementById('doctorExportBtn')?.addEventListener('click',downloadVitaReport);document.getElementById('reportJsonBtn')?.addEventListener('click',downloadVitaReport);
document.getElementById('patientSearch')?.addEventListener('input',()=>currentState&&renderDoctorRows(currentState));document.getElementById('reportFilter')?.addEventListener('change',()=>currentState&&renderDoctorRows(currentState));
document.querySelectorAll('.sidebar .nav-item, .portal-shortcut').forEach(link=>link.addEventListener('click',e=>{const target=document.querySelector(link.getAttribute('href'));if(!target)return;e.preventDefault();document.querySelectorAll('.sidebar .nav-item').forEach(n=>n.classList.toggle('active',n===link));document.querySelectorAll('.portal-shortcut').forEach(n=>n.classList.toggle('active',n===link));const veil=document.getElementById('pageTransition');if(veil){veil.classList.add('active');setTimeout(()=>{target.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>veil.classList.remove('active'),420)},90)}else target.scrollIntoView({behavior:'smooth'});history.replaceState(null,'',link.getAttribute('href'));}));
const cursorGlow=document.getElementById('cursorGlow');window.addEventListener('pointermove',e=>{if(cursorGlow){cursorGlow.style.left=e.clientX+'px';cursorGlow.style.top=e.clientY+'px'}});

// Persistent dark/light theme for the dashboard
(function setupTheme(){
 const body=document.body,button=document.getElementById('themeToggle'),icon=document.getElementById('themeIcon'),label=document.getElementById('themeLabel');if(!button)return;
 let theme='dark';try{theme=localStorage.getItem('nuro-dashboard-theme')||'dark'}catch(e){}
 function apply(next){theme=next;body.classList.toggle('light-theme',theme==='light');icon.textContent=theme==='dark'?'☀':'☾';label.textContent=theme==='dark'?'Light mode':'Dark mode';button.setAttribute('aria-label','Switch to '+(theme==='dark'?'light':'dark')+' mode');try{localStorage.setItem('nuro-dashboard-theme',theme)}catch(e){}}
 button.addEventListener('click',()=>apply(theme==='dark'?'light':'dark'));apply(theme);
})();

// Patient-care workflow: persisted appointment requests, sample invoice downloads and nearby map search.
const apptForm=document.getElementById('appointmentForm');
async function loadAppointments(){
 const patientList=document.getElementById('myAppointments'),doctorList=document.getElementById('doctorAppointments');
 try{const r=await fetch('/api/appointments');if(!r.ok)throw new Error('Could not load appointments');const d=await r.json();
 const rows=d.appointments||[];const html=rows.length?rows.map(a=>`<div class="appointment-row"><div><b>${escapeHtml(a.department)} · ${escapeHtml(a.doctor_name)}</b><small>${escapeHtml(a.requested_date)} ${escapeHtml(a.requested_time)} · ${escapeHtml(a.patient_name||'You')}</small></div><span class="status-pill ${a.status==='confirmed'?'normal':a.status==='rejected'?'warning':'pending'}">${escapeHtml(a.status.toUpperCase())}</span>${document.body.dataset.role==='doctor'&&a.status==='pending'?`<button data-appointment-action="confirmed" data-id="${a.id}">Confirm</button><button data-appointment-action="rejected" data-id="${a.id}">Reject</button>`:''}</div>`).join(''):'<p>No appointment requests yet.</p>';
 if(patientList)patientList.innerHTML='<h3>My appointment requests</h3>'+html;
 if(doctorList)doctorList.innerHTML=html;
 }catch(e){if(patientList)patientList.textContent='Could not load appointment requests.';if(doctorList)doctorList.textContent='Could not load appointment requests.'}
}
apptForm?.addEventListener('submit',async e=>{e.preventDefault();const msg=document.getElementById('appointmentMessage'),data=Object.fromEntries(new FormData(apptForm));try{const r=await fetch('/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw Error(d.message||'Could not book appointment');msg.textContent=d.message;apptForm.reset();await loadAppointments()}catch(err){msg.textContent=err.message}});
document.getElementById('refreshAppointments')?.addEventListener('click',loadAppointments);
document.getElementById('doctorAppointments')?.addEventListener('click',async e=>{const b=e.target.closest('[data-appointment-action]');if(!b)return;try{const r=await fetch('/api/appointments/'+b.dataset.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:b.dataset.appointmentAction})});const d=await r.json();if(!r.ok)throw Error(d.message||'Could not update appointment');toast('Appointment '+d.status);loadAppointments()}catch(err){toast(err.message)}});
loadAppointments();
document.getElementById('patientPhoto')?.addEventListener('change',e=>{const f=e.target.files?.[0],img=document.getElementById('patientPhotoPreview');if(!f||!img)return;if(!f.type.startsWith('image/')){toast('Please choose an image file');return}const reader=new FileReader();reader.onload=()=>{img.src=reader.result;img.hidden=false};reader.readAsDataURL(f)});
const demoBills=[
 {date:'2026-09-18',department:'General Medicine',doctor:'Dr. Demo',items:'Consultation demo ₹300; Paracetamol 500 mg (sample) ₹40',total:340},
 {date:'2026-08-21',department:'Eye / Ophthalmology',doctor:'Dr. Meena',items:'Eye examination (sample) ₹500; Eye drops (sample) ₹120',total:620},
 {date:'2026-07-09',department:'Orthopaedics',doctor:'Dr. Kavitha',items:'Consultation demo ₹400; X-ray example ₹350',total:750},
 {date:'2026-06-02',department:'Dentistry',doctor:'Dr. Ravi',items:'Dental check-up (sample) ₹350; Cleaning example ₹600',total:950},
 {date:'2026-05-12',department:'Cardiology',doctor:'Dr. Arjun',items:'Consultation demo ₹500; ECG example ₹250',total:750}
];
function billText(b,i){return `NURO HEALTHCARE — SAMPLE INVOICE ${i+1}\\nNOT A REAL BILL / NOT FOR CLAIMS\\nVisit date: ${b.date}\\nDepartment: ${b.department}\\nDoctor: ${b.doctor}\\nItems: ${b.items}\\nTotal: INR ${b.total}\\nThis is sample demonstration data only.`}
function downloadText(filename,text){const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const billsEl=document.getElementById('sampleBills');if(billsEl)billsEl.innerHTML=demoBills.map((b,i)=>`<div class="sample-bill-row"><span><b>${b.date}</b><small>${b.department} · Sample ₹${b.total}</small></span><button type="button" data-bill="${i}">Download</button></div>`).join('');
billsEl?.addEventListener('click',e=>{const b=e.target.closest('[data-bill]');if(b){const i=Number(b.dataset.bill);downloadText(`sample-invoice-${i+1}.txt`,billText(demoBills[i],i))}});
document.getElementById('downloadAllBills')?.addEventListener('click',()=>demoBills.forEach((b,i)=>setTimeout(()=>downloadText(`sample-invoice-${i+1}.txt`,billText(b,i)),i*250)));
document.getElementById('nearbyHospitals')?.addEventListener('click',()=>{const msg=document.getElementById('nearbyMessage'),link=document.getElementById('nearbyMapLink');msg.textContent='Requesting location permission…';if(!navigator.geolocation){msg.textContent='Geolocation is not supported by this browser.';return}navigator.geolocation.getCurrentPosition(pos=>{const lat=pos.coords.latitude,lon=pos.coords.longitude;msg.textContent=`Location received. Search nearby hospitals and medical centres.`;link.innerHTML=`<a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/hospitals+and+medical+centres/@${lat},${lon},13z">Open nearby hospitals in Google Maps ↗</a>`},err=>{msg.textContent=err.code===1?'Location permission denied. You can search manually.':'Could not get location. Try again or search manually.';link.innerHTML='<a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/hospitals+near+me/">Search hospitals in Google Maps ↗</a>'},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})});
// Minimal bilingual labels on the dashboard; live records remain in the selected user's data.
const dashTranslations={'Patient simulation':'நோயாளர் சிமுலேஷன்','Overview':'கண்ணோட்டம்','Virtual patient':'மாதிரி நோயாளர்','Vital signals':'உடல் அறிகுறிகள்','Alerts & events':'எச்சரிக்கைகள் மற்றும் நிகழ்வுகள்','Trend history':'மாற்ற வரலாறு','Blood pressure':'இரத்த அழுத்தம்','Temperature':'உடல் வெப்பநிலை','Heart rate':'இதயத் துடிப்பு','Simulation controls':'சிமுலேஷன் கட்டுப்பாடுகள்','Normal fluctuation':'இயல்பான மாற்றம்','Tachycardia':'வேகமான இதயத் துடிப்பு','Hypoxia scenario':'குறைந்த ஆக்சிஜன் மாதிரி','Fever scenario':'காய்ச்சல் மாதிரி','Bradycardia':'மெதுவான இதயத் துடிப்பு','Reset to baseline':'அடிப்படை நிலைக்கு மீட்டமை','Patient care centre':'நோயாளர் பராமரிப்பு மையம்','Book your appointment':'மருத்துவர் சந்திப்பை பதிவு செய்யவும்','Hospitals & medical centres':'அருகிலுள்ள மருத்துவமனைகள்','Find nearby hospitals':'அருகிலுள்ள மருத்துவமனைகளைத் தேடு','Appointment approval requests':'சந்திப்பு ஒப்புதல் கோரிக்கைகள்'};
let dashboardLang='en';
document.getElementById('dashboardLanguageToggle')?.addEventListener('click',()=>{dashboardLang=dashboardLang==='en'?'ta':'en';document.documentElement.lang=dashboardLang==='ta'?'ta':'en';document.querySelectorAll('.section-heading h2,.report-card h3,.section-heading .eyebrow,.scenario-btn b,.scenario-btn small,.metric-label,.panel-description,.report-card>small').forEach(el=>{if(!el.dataset.enText)el.dataset.enText=el.textContent;const en=el.dataset.enText;el.textContent=dashboardLang==='ta'?(dashTranslations[en]||en):en})});
