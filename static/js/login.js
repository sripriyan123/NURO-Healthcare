const form=document.getElementById('loginForm');
const errorBox=document.getElementById('loginError');
const roleInput=document.getElementById('role');
const defaults={patient:'',caretaker:'',doctor:'doctor',admin:'sripriyan16042007@gmail.com'};

function setRole(role){
  roleInput.value=role;
  document.querySelectorAll('.role-tab').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
  document.getElementById('username').value=defaults[role]||'';
  document.getElementById('password').value='';
  errorBox.textContent='';
}
document.querySelectorAll('.role-tab').forEach(b=>b.addEventListener('click',()=>setRole(b.dataset.role)));
const otpButton=document.getElementById('otpModeButton');
if(otpButton) otpButton.remove();
const authMode=document.getElementById('authMode');
if(authMode) authMode.hidden=true;

document.getElementById('togglePass').addEventListener('click',()=>{
  const p=document.getElementById('password'),show=p.type==='password';
  p.type=show?'text':'password';
  document.getElementById('togglePass').textContent=show?'HIDE':'SHOW';
});
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=document.getElementById('loginSubmit');
  btn.disabled=true; errorBox.textContent='';
  const payload={
    username:document.getElementById('username').value,
    password:document.getElementById('password').value,
    role:roleInput.value
  };
  try{
    const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(!r.ok) throw Error(d.message||'Unable to sign in');
    window.location.href=d.redirect;
  }catch(err){errorBox.textContent=err.message;if(err.message.includes('Registration successful'))alert(err.message);btn.disabled=false;}
});
const loginPanel=document.getElementById('loginPanel'),registerPanel=document.getElementById('registerPanel');
document.getElementById('openRegister').addEventListener('click',()=>{
  loginPanel.hidden=true;registerPanel.hidden=false;
  document.getElementById('authTitle').textContent='CREATE YOUR CARE ACCOUNT';
  document.getElementById('authSubtitle').textContent='Complete every required field to get started.';if(typeof applyLanguage==='function')applyLanguage(currentLanguage);
});
document.getElementById('backLogin').addEventListener('click',()=>{
  registerPanel.hidden=true;loginPanel.hidden=false;
  document.getElementById('authTitle').textContent="LET'S GET YOU SIGNED IN";
  document.getElementById('authSubtitle').textContent='Choose your portal to continue securely.';if(typeof applyLanguage==='function')applyLanguage(currentLanguage);
});
document.getElementById('registerForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const regForm=e.currentTarget,err=document.getElementById('registerError'),btn=regForm.querySelector('button[type="submit"]');
  err.textContent='';btn.disabled=true;
  const data=Object.fromEntries(new FormData(regForm).entries());
  try{
    const r=await fetch('/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const d=await r.json();
    if(!r.ok)throw Error(d.message||'Could not create account');
    document.getElementById('createdUsername').textContent='LOGIN ID: '+d.username;document.querySelector('#successOverlay .success-card p').textContent=d.message||'Registration successful. Waiting for admin approval.';
    document.getElementById('successOverlay').hidden=false;
    regForm.reset();document.getElementById('successOverlay').classList.add('success-show');
  }catch(err){document.getElementById('registerError').textContent=err.message;}
  finally{btn.disabled=false;}
});
document.getElementById('successContinue').addEventListener('click',()=>{
  document.getElementById('successOverlay').hidden=true;
  document.getElementById('successOverlay').classList.remove('success-show');
  registerPanel.hidden=true;loginPanel.hidden=false;
  document.getElementById('authTitle').textContent="LET'S GET YOU SIGNED IN";
  document.getElementById('authSubtitle').textContent='Choose your portal to continue securely.';
  setRole('patient');
  document.getElementById('username').value=document.getElementById('createdUsername').textContent.replace('LOGIN ID: ','');if(typeof applyLanguage==='function')applyLanguage(currentLanguage);
});
setRole('patient');

// Tamil/English language switch: translates login, registration and approval feedback.
const translations={
"LET'S GET YOU SIGNED IN":"உள்நுழையுங்கள்",
"Choose your portal to continue securely.":"பாதுகாப்பாகத் தொடர உங்கள் பிரிவைத் தேர்ந்தெடுக்கவும்.",
"WELCOME TO NURO":"NURO-க்கு வரவேற்கிறோம்",
"BETTER CARE.":"சிறந்த பராமரிப்பு.",
"BRIGHTER FUTURE.":"ஒளிமயமான எதிர்காலம்.",
"Your family's care journey, brought together in one secure and friendly healthcare workspace.":"உங்கள் குடும்பத்தின் சுகாதாரப் பயணம் ஒரே பாதுகாப்பான தளத்தில்.",
"SMART CARE · CONNECTED LIVES":"சிறந்த பராமரிப்பு · இணைந்த வாழ்க்கை",
"CARE THAT CONNECTS":"இணைக்கும் பராமரிப்பு",
"Patient and caretaker, together":"நோயாளியும் பராமரிப்பாளரும் ஒன்றாக",
"SMART HEALTH INSIGHTS":"சுகாதாரத் தகவல்கள்",
"Understand simulated readings and trends":"மாதிரி அளவீடுகள் மற்றும் போக்குகளைப் புரிந்துகொள்ளுங்கள்",
"MADE FOR EVERY SCREEN":"அனைத்து திரைகளுக்கும்",
"Designed for phone, tablet and laptop":"மொபைல், டேப்லெட், கணினிக்கு ஏற்றது",
"NURO HEALTHCARE · YOUR CARE SPACE":"NURO HEALTHCARE · உங்கள் பராமரிப்பு தளம்",
"CARE WITH CONFIDENCE ↗":"நம்பிக்கையுடன் பராமரிப்பு ↗",
"User":"நோயாளர்","Caretaker":"பராமரிப்பாளர்","Doctor":"மருத்துவர்","Admin":"நிர்வாகி",
"LOGIN ID / USERNAME":"உள்நுழைவு ID / பயனர்பெயர்","PASSWORD":"கடவுச்சொல்",
"Enter your login ID":"உங்கள் மின்னஞ்சல் / உள்நுழைவு ID-ஐ உள்ளிடவும்","Enter your password":"கடவுச்சொல்லை உள்ளிடவும்",
"SHOW":"காட்டு","HIDE":"மறை","SIGN IN SECURELY":"பாதுகாப்பாக உள்நுழை",
"NEW TO NURO HEALTHCARE?":"NURO HEALTHCARE-க்கு புதியவரா?",
"CREATE PATIENT ACCOUNT":"புதிய கணக்கை உருவாக்கு",
"CREATE YOUR CARE ACCOUNT":"உங்கள் பராமரிப்பு கணக்கை உருவாக்குங்கள்",
"Complete every required field to get started.":"தொடர தேவையான அனைத்து விவரங்களையும் நிரப்பவும்.",
"ACCOUNT DETAILS":"கணக்கு விவரங்கள்","Patient / Account holder name *":"நோயாளர் / கணக்கு வைத்திருப்பவர் பெயர் *",
"Create login ID *":"உள்நுழைவு ID உருவாக்கவும் *","Create password *":"கடவுச்சொல் உருவாக்கவும் *",
"Patient mobile number *":"நோயாளியின் கைபேசி எண் *","Patient address *":"நோயாளியின் முகவரி *",
"District *":"மாவட்டம் *","State *":"மாநிலம் *","PIN code *":"அஞ்சல் குறியீடு *",
"CARETAKER DETAILS":"பராமரிப்பாளர் விவரங்கள்","Caretaker mobile number *":"பராமரிப்பாளர் கைபேசி எண் *",
"Caretaker address *":"பராமரிப்பாளர் முகவரி *","PATIENT HEALTH DETAILS":"நோயாளர் உடல்நல விவரங்கள்",
"Patient full name *":"நோயாளியின் முழுப் பெயர் *","Age (years) *":"வயது (ஆண்டுகள்) *",
"Weight (kg) *":"எடை (கிலோ) *","Height (cm) *":"உயரம் (செ.மீ.) *",
"CREATE MY ACCOUNT":"எனது கணக்கை உருவாக்கு","← BACK TO LOGIN":"← உள்நுழைவுக்குத் திரும்பு",
"SECURE ACCESS · SIMULATED HEALTH DATA · NOT A MEDICAL DEVICE":"பாதுகாப்பான அணுகல் · மாதிரி சுகாதாரத் தரவு · மருத்துவ சாதனம் அல்ல",
"ACCOUNT CREATED SUCCESSFULLY!":"கணக்கு பதிவு வெற்றிகரமாக முடிந்தது!",
"Your NURO HEALTHCARE account is ready.":"உங்கள் NURO HEALTHCARE பதிவு பெறப்பட்டது.",
"CONTINUE TO LOGIN":"உள்நுழைவுக்குத் தொடரவும்"
};
let currentLanguage='en';
function applyLanguage(lang){
 currentLanguage=lang;document.documentElement.lang=lang==='ta'?'ta':'en';
 document.querySelectorAll('.role-tab b').forEach(el=>{const en=el.dataset.en||el.textContent;el.dataset.en=en;el.textContent=lang==='ta'?(translations[en]||en):en});
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(n=>{if(!n.nodeValue.trim())return;let original=n.__englishText;if(!original){original=n.nodeValue;n.__englishText=original}
 const clean=original.trim();if(translations[clean]){const lead=original.match(/^\s*/)[0],tail=original.match(/\s*$/)[0];n.nodeValue=lead+(lang==='ta'?translations[clean]:clean)+tail}});
 document.querySelectorAll('[placeholder]').forEach(el=>{if(!el.dataset.enPlaceholder)el.dataset.enPlaceholder=el.placeholder;const en=el.dataset.enPlaceholder;const ta={'Enter your login ID':'உங்கள் மின்னஞ்சல் / ID','Enter your password':'கடவுச்சொல்லை உள்ளிடவும்','Full name':'முழுப் பெயர்','Unique username':'தனித்துவமான பயனர்பெயர்','At least 8 characters':'குறைந்தது 8 எழுத்துகள்','Mobile number':'கைபேசி எண்','House, street, area':'வீட்டு முகவரி','District':'மாவட்டம்','State':'மாநிலம்','6-digit PIN':'6 இலக்க அஞ்சல் குறியீடு','Caretaker mobile':'பராமரிப்பாளர் கைபேசி எண்','Caretaker full address':'பராமரிப்பாளர் முழு முகவரி','Patient full name':'நோயாளியின் முழுப் பெயர்','Age':'வயது','Weight in kg':'எடை (கிலோ)','Height in cm':'உயரம் (செ.மீ.)'};el.placeholder=lang==='ta'?(ta[en]||en):en});
 const title=document.getElementById('authTitle'),subtitle=document.getElementById('authSubtitle');
 if(title&&title.textContent.includes('உள்நுழையுங்கள்'))title.textContent=lang==='ta'?'உள்நுழையுங்கள்':"LET'S GET YOU SIGNED IN";
 if(subtitle&&subtitle.textContent.includes('பாதுகாப்பாக'))subtitle.textContent=lang==='ta'?'பாதுகாப்பாகத் தொடர உங்கள் பிரிவைத் தேர்ந்தெடுக்கவும்.':'Choose your portal to continue securely.';
 const toggle=document.getElementById('togglePass');if(toggle)toggle.textContent=document.getElementById('password').type==='password'?(lang==='ta'?'காட்டு':'SHOW'):(lang==='ta'?'மறை':'HIDE');
 const vid=document.getElementById('videoToggle');if(vid)vid.textContent=(document.getElementById('loginBgVideo')?.paused?'▶ ':'Ⅱ ')+(lang==='ta'?'பின்னணி வீடியோ: ':'Video: ')+(document.getElementById('loginBgVideo')?.paused?'OFF':'ON');
}
document.getElementById('languageToggle')?.addEventListener('click',()=>applyLanguage(currentLanguage==='en'?'ta':'en'));
applyLanguage('en');
function updateAnalogClock(){const d=new Date(),el=document.getElementById('analogTime'),date=document.getElementById('analogDate');if(el)el.textContent=d.toLocaleTimeString(currentLanguage==='ta'?'ta-IN':'en-GB',{hour12:false});if(date)date.textContent=d.toLocaleDateString(currentLanguage==='ta'?'ta-IN':'en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}
updateAnalogClock();setInterval(updateAnalogClock,1000);
document.getElementById('videoToggle')?.addEventListener('click',()=>{const v=document.getElementById('loginBgVideo');if(!v)return;if(v.paused){v.play().catch(()=>{});}else v.pause();const b=document.getElementById('videoToggle');b.textContent=(v.paused?'▶ ':'Ⅱ ')+(currentLanguage==='ta'?'பின்னணி வீடியோ: ':'Video: ')+(v.paused?'OFF':'ON');b.setAttribute('aria-pressed',String(!v.paused))});
