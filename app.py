from flask import Flask, render_template, request, jsonify, session, redirect, url_for, abort
from functools import wraps
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import random, os, sqlite3, hmac
from werkzeug.utils import secure_filename

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'vitasphere.db')
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-only-change-this-secret-before-deployment')
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax', MAX_CONTENT_LENGTH=2 * 1024 * 1024 * 1024)
UPLOAD_DIR = os.path.join(BASE_DIR, 'static', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

vitals = {'heart_rate':84,'spo2':98,'resp_rate':16,'temperature':36.9,'systolic':118,'diastolic':76}
history=[]; events=[]
# Wokwi ESP32 bridge: configure WOKWI_DEVICE_TOKEN in the server environment.
WOKWI_DEVICE_TOKEN = os.environ.get('WOKWI_DEVICE_TOKEN', '')
reading_source = 'local-simulation'
last_device_update = None
last_device_id = None
last_patient_id = None

def db():
    conn=sqlite3.connect(DB_PATH); conn.row_factory=sqlite3.Row; return conn

def init_db():
    with db() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('patient','caretaker','doctor','admin')), password_hash TEXT NOT NULL, phone TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, approved INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)''')
        # Upgrade databases created by older project versions.
        cols={r['name'] for r in c.execute('PRAGMA table_info(users)').fetchall()}
        if 'approved' not in cols:
            c.execute('ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1')
            c.execute("UPDATE users SET approved=0 WHERE role IN ('patient','caretaker') AND username NOT IN ('patient','caretaker')")
        c.execute('''CREATE TABLE IF NOT EXISTS patient_profiles(user_id INTEGER PRIMARY KEY, address TEXT, caretaker_phone TEXT, caretaker_address TEXT, district TEXT, state TEXT, pincode TEXT, patient_name TEXT, age INTEGER, weight REAL, height REAL, FOREIGN KEY(user_id) REFERENCES users(id))''')
        c.execute('''CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY AUTOINCREMENT, patient_username TEXT NOT NULL, patient_name TEXT NOT NULL, department TEXT NOT NULL, doctor_name TEXT NOT NULL, requested_date TEXT NOT NULL, requested_time TEXT NOT NULL, reason TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, FOREIGN KEY(patient_username) REFERENCES users(username))''')
        c.execute('''CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, action TEXT NOT NULL, target TEXT, created_at TEXT NOT NULL)''')
        seeds=[
            ('sripriyan16042007@gmail.com','NURO Healthcare Admin','admin','9655018398',''),
            ('doctor','Dr. Demo','doctor','123','')
        ]
        for username,name,role,password,phone in seeds:
            c.execute('''INSERT INTO users(username,display_name,role,password_hash,phone,active,approved,created_at)
                         VALUES(?,?,?,?,?,1,1,?)
                         ON CONFLICT(username) DO UPDATE SET
                         display_name=excluded.display_name,
                         role=excluded.role,
                         password_hash=excluded.password_hash,
                         active=1, approved=1''',
                      (username,name,role,generate_password_hash(password),phone,datetime.now().isoformat(timespec='seconds')))

def audit(actor, action, target=''):
    with db() as c: c.execute('INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)',(actor,action,target,datetime.now().isoformat(timespec='seconds')))

def classify(key,value):
    if key=='heart_rate': return 'High' if value>100 else ('Low' if value<60 else 'Normal')
    if key=='spo2': return 'Low' if value<95 else 'Normal'
    if key=='resp_rate': return 'High' if value>20 else ('Low' if value<12 else 'Normal')
    if key=='temperature': return 'High' if value>=38 else ('Low' if value<36 else 'Normal')
    if key=='systolic': return 'High' if value>=140 else ('Low' if value<90 else 'Normal')
    return 'Normal'

def snapshot(): return {'time':datetime.now().strftime('%H:%M:%S'),**vitals.copy()}
def record_event(message,severity='info'):
    events.insert(0,{'time':datetime.now().strftime('%H:%M:%S'),'message':message,'severity':severity}); del events[20:]

def login_required(fn):
    @wraps(fn)
    def wrapped(*a,**kw):
        if not session.get('logged_in'): return jsonify({'error':'Please log in first.'}),401
        return fn(*a,**kw)
    return wrapped

def admin_required(fn):
    @wraps(fn)
    def wrapped(*a,**kw):
        if not session.get('logged_in'): return redirect('/')
        if session.get('role')!='admin': abort(403)
        return fn(*a,**kw)
    return wrapped

@app.route('/')
def index():
    if session.get('logged_in'): return redirect(url_for('admin_panel' if session.get('role')=='admin' else 'dashboard'))
    return render_template('login.html', background_video=('/static/uploads/login_background.mp4' if os.path.exists(os.path.join(UPLOAD_DIR,'login_background.mp4')) else ('/static/uploads/login_background.webm' if os.path.exists(os.path.join(UPLOAD_DIR,'login_background.webm')) else None)))

@app.route('/login',methods=['POST'])
def login():
    data=request.get_json(silent=True) or request.form
    username=str(data.get('username','')).strip().lower(); password=str(data.get('password','')); role=str(data.get('role','patient')).strip().lower()
    with db() as c: user=c.execute('SELECT * FROM users WHERE username=?',(username,)).fetchone()
    if user and check_password_hash(user['password_hash'],password) and role==user['role']:
        if not user['active']:
            return jsonify({'ok':False,'code':'disabled','message':'This account is disabled. Contact the administrator. / இந்த கணக்கு முடக்கப்பட்டுள்ளது. நிர்வாகியைத் தொடர்புகொள்ளவும்.'}),403
        if not user['approved']:
            return jsonify({'ok':False,'code':'pending','message':'Registration successful. Please wait for admin approval before logging in. / பதிவு வெற்றிகரமாக முடிந்தது. நிர்வாகி ஒப்புதல் அளிக்கும் வரை காத்திருக்கவும்.'}),403
        session.clear(); session.update(logged_in=True,username=user['username'],role=user['role'],display_name=user['display_name'])
        audit(username,'login',''); record_event(f"{user['role'].title()} account signed in",'success')
        return jsonify({'ok':True,'redirect':url_for('admin_panel' if user['role']=='admin' else 'dashboard')})
    return jsonify({'ok':False,'message':'Wrong information: check your login ID, password and selected portal. / தவறான தகவல்: உங்கள் மின்னஞ்சல்/உள்நுழைவு ID, கடவுச்சொல் மற்றும் தேர்ந்தெடுத்த பிரிவைச் சரிபார்க்கவும்.'}),401

@app.route('/register', methods=['POST'])
def register():
    data=request.get_json(silent=True) or {}
    name=str(data.get('name','')).strip(); username=str(data.get('username','')).strip().lower(); password=str(data.get('password',''))
    role=str(data.get('role','patient')).strip().lower(); phone=str(data.get('phone','')).strip(); address=str(data.get('address','')).strip(); caretaker_phone=str(data.get('caretaker_phone','')).strip(); caretaker_address=str(data.get('caretaker_address','')).strip()
    district=str(data.get('district','')).strip(); state=str(data.get('state','')).strip(); pincode=str(data.get('pincode','')).strip(); patient_name=str(data.get('patient_name','')).strip()
    try: age=int(data.get('age',''))
    except (TypeError,ValueError): age=0
    try: weight=float(data.get('weight',''))
    except (TypeError,ValueError): weight=0
    try: height=float(data.get('height',''))
    except (TypeError,ValueError): height=0
    required=[name,username,password,phone,address,caretaker_phone,caretaker_address,district,state,pincode,patient_name]
    if role not in ('patient','caretaker') or not all(required) or len(username)<3 or len(password)<8 or not (1<=age<=120) or not (1<=weight<=500) or not (30<=height<=250) or not pincode.isdigit() or len(pincode)!=6:
        return jsonify({'ok':False,'message':'Fill all required fields. Password must be 8+ characters; PIN code must contain 6 digits; check patient measurements.'}),400
    try:
        with db() as c:
            cur=c.execute('INSERT INTO users(username,display_name,role,password_hash,phone,active,approved,created_at) VALUES(?,?,?,?,?,1,0,?)',(username,name,role,generate_password_hash(password),phone,datetime.now().isoformat(timespec='seconds')))
            c.execute('INSERT INTO patient_profiles(user_id,address,caretaker_phone,caretaker_address,district,state,pincode,patient_name,age,weight,height) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(cur.lastrowid,address,caretaker_phone,caretaker_address,district,state,pincode,patient_name,age,weight,height))
        audit(username,'self_register_pending_approval',role); return jsonify({'ok':True,'message':'Registration successful. Please wait for admin approval before logging in. / பதிவு வெற்றிகரமாக முடிந்தது. நிர்வாகி ஒப்புதல் அளிக்கும் வரை காத்திருக்கவும்.','username':username,'pending_approval':True}),201
    except sqlite3.IntegrityError: return jsonify({'ok':False,'message':'That username already exists. Choose another username.'}),409

@app.route('/api/admin/upload-background',methods=['POST'])
@admin_required
def upload_background():
    f=request.files.get('video')
    if not f or not f.filename: return jsonify({'ok':False,'message':'Choose an MP4 or WebM video first.'}),400
    ext=os.path.splitext(secure_filename(f.filename))[1].lower()
    if ext not in ('.mp4','.webm'): return jsonify({'ok':False,'message':'Only MP4 and WebM videos are supported.'}),400
    filename='login_background'+ext
    # remove previous background video to avoid stale choices
    for old in ('login_background.mp4','login_background.webm'):
        path=os.path.join(UPLOAD_DIR,old)
        if os.path.exists(path): os.remove(path)
    f.save(os.path.join(UPLOAD_DIR,filename)); audit(session['username'],'upload_login_background',filename)
    return jsonify({'ok':True,'message':'Login background video uploaded. Refresh the login page to view it.','url':'/static/uploads/'+filename})

@app.route('/forgot-password',methods=['POST'])
def forgot_password():
    data=request.get_json(silent=True) or request.form; email=str(data.get('email','')).strip()
    if not email or '@' not in email: return jsonify({'ok':False,'message':'Enter a valid email address.'}),400
    return jsonify({'ok':True,'message':'Password recovery delivery is not configured on this local build.'})

@app.route('/logout',methods=['POST'])
def logout():
    session.clear(); return jsonify({'ok':True,'redirect':'/'})

@app.route('/dashboard')
def dashboard():
    if not session.get('logged_in'): return redirect('/')
    if session.get('role')=='admin': return redirect(url_for('admin_panel'))
    return render_template('dashboard.html',username=session.get('username','User'),role=session.get('role','patient'),display_name=session.get('display_name','User'))

@app.route('/admin')
@admin_required
def admin_panel(): return render_template('admin.html',display_name=session.get('display_name','Administrator'))

@app.route('/api/state')
@login_required
def state():
    return jsonify({'vitals':vitals,'history':history[-30:],'events':events[:8],'status':{k:classify(k,v) for k,v in vitals.items()},'demo_mode':True,'source':reading_source,'last_device_update':last_device_update,'device_id':last_device_id,'patient_id':last_patient_id,'timestamp':datetime.now().strftime('%d %b %Y · %H:%M:%S')})

@app.route('/api/simulate',methods=['POST'])
@login_required
def simulate():
    global reading_source
    data=request.get_json(silent=True) or {}; mode=data.get('mode','normal')
    if mode=='tachycardia': vitals.update(heart_rate=random.randint(112,138),spo2=random.randint(94,98),resp_rate=random.randint(20,25)); message,severity='Elevated heart rate detected in simulation','warning'
    elif mode=='hypoxia': vitals.update(heart_rate=random.randint(96,118),spo2=random.randint(84,91),resp_rate=random.randint(22,29)); message,severity='Low SpO₂ scenario: simulated oxygen alert','critical'
    elif mode=='fever': vitals.update(temperature=round(random.uniform(38.1,39.3),1),heart_rate=random.randint(94,116)); message,severity='Elevated temperature scenario activated','warning'
    elif mode=='bradycardia': vitals.update(heart_rate=random.randint(42,55),spo2=random.randint(95,99)); message,severity='Low heart-rate scenario activated','warning'
    elif mode=='reset': vitals.update(heart_rate=84,spo2=98,resp_rate=16,temperature=36.9,systolic=118,diastolic=76); message,severity='Simulation reset to baseline values','success'
    else:
        vitals.update(
            heart_rate=max(62,min(98,vitals['heart_rate']+random.randint(-5,5))),
            spo2=max(95,min(99,vitals['spo2']+random.choice([-1,0,0,1]))),
            resp_rate=max(12,min(20,vitals['resp_rate']+random.choice([-1,0,1]))),
            temperature=round(max(36.3,min(37.5,vitals['temperature']+random.uniform(-.1,.1))),1),
            systolic=max(105,min(130,vitals['systolic']+random.randint(-3,3))),
            diastolic=max(65,min(85,vitals['diastolic']+random.randint(-2,2)))
        )
        message,severity='Normal vital fluctuation simulated','info'
    reading_source='local-simulation'
    record_event(message,severity); history.append(snapshot()); del history[:-60]
    return state()

@app.route('/api/wokwi/vitals', methods=['POST'])
def wokwi_vitals_ingest():
    """Accept demo vitals from a Wokwi ESP32 using a server-side shared token."""
    global reading_source, last_device_update, last_device_id, last_patient_id
    if not WOKWI_DEVICE_TOKEN:
        return jsonify({'ok':False,'message':'Wokwi ingest is disabled: configure WOKWI_DEVICE_TOKEN on the server.'}),503
    auth = request.headers.get('Authorization','')
    supplied = auth[7:].strip() if auth.lower().startswith('bearer ') else ''
    if not supplied or not hmac.compare_digest(supplied, WOKWI_DEVICE_TOKEN):
        return jsonify({'ok':False,'message':'Invalid device token.'}),401
    data=request.get_json(silent=True) or {}
    try:
        incoming={
            'heart_rate':float(data['heart_rate']),
            'spo2':float(data['spo2']),
            'resp_rate':float(data.get('resp_rate',16)),
            'temperature':float(data.get('temperature',36.9)),
            'systolic':float(data.get('systolic',118)),
            'diastolic':float(data.get('diastolic',76)),
        }
    except (KeyError,TypeError,ValueError):
        return jsonify({'ok':False,'message':'Required numeric fields: heart_rate and spo2; other vitals are optional.'}),400
    # Basic bounds reject malformed payloads, not medical triage thresholds.
    bounds={'heart_rate':(20,250),'spo2':(50,100),'resp_rate':(2,80),'temperature':(25,45),'systolic':(40,300),'diastolic':(20,200)}
    for key,(low,high) in bounds.items():
        if not low <= incoming[key] <= high:
            return jsonify({'ok':False,'message':f'{key} is outside accepted demo-data bounds.'}),400
    vitals.update(incoming)
    reading_source='wokwi-esp32'
    last_device_update=datetime.now().isoformat(timespec='seconds')
    last_device_id=str(data.get('device_id','wokwi-esp32'))[:80]
    last_patient_id=str(data.get('patient_id','demo-patient'))[:80]
    alert=bool(data.get('alert',False))
    motion=bool(data.get('motion',False))
    message=('Wokwi device alert reported' if alert else 'Wokwi vitals updated') + (f' · motion={motion}' if motion else '')
    record_event(message,'critical' if alert else ('warning' if any(classify(k,v)!='Normal' for k,v in incoming.items()) else 'success'))
    history.append(snapshot()); del history[:-60]
    return jsonify({'ok':True,'source':reading_source,'received_at':last_device_update,'patient_id':last_patient_id})

@app.route('/api/appointments', methods=['GET','POST'])
@login_required
def appointments_api():
    role=session.get('role')
    if request.method=='POST':
        if role!='patient': return jsonify({'ok':False,'message':'Only patient accounts can request appointments.'}),403
        data=request.get_json(silent=True) or {}
        department=str(data.get('department','')).strip(); doctor_name=str(data.get('doctor_name','')).strip()
        requested_date=str(data.get('date','')).strip(); requested_time=str(data.get('time','')).strip(); reason=str(data.get('reason','')).strip()
        if not all([department,doctor_name,requested_date,requested_time]):
            return jsonify({'ok':False,'message':'Choose a department, doctor, date and time.'}),400
        try:
            datetime.strptime(requested_date,'%Y-%m-%d')
            datetime.strptime(requested_time,'%H:%M')
        except ValueError: return jsonify({'ok':False,'message':'Invalid date or time.'}),400
        with db() as c:
            c.execute('INSERT INTO appointments(patient_username,patient_name,department,doctor_name,requested_date,requested_time,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
                      (session['username'],session.get('display_name','Patient'),department,doctor_name,requested_date,requested_time,reason,'pending',datetime.now().isoformat(timespec='seconds')))
        audit(session['username'],'appointment_requested',department+' / '+doctor_name)
        return jsonify({'ok':True,'message':'Appointment request sent to the doctor for confirmation.','status':'pending'}),201
    with db() as c:
        if role=='admin': rows=c.execute('SELECT * FROM appointments ORDER BY requested_date DESC, requested_time DESC').fetchall()
        elif role=='doctor': rows=c.execute('SELECT * FROM appointments ORDER BY requested_date,requested_time').fetchall()
        else: rows=c.execute('SELECT * FROM appointments WHERE patient_username=? ORDER BY requested_date DESC,requested_time DESC',(session['username'],)).fetchall()
    return jsonify({'appointments':[dict(r) for r in rows]})

@app.route('/api/appointments/<int:appointment_id>', methods=['PATCH'])
@login_required
def update_appointment(appointment_id):
    if session.get('role') not in ('doctor','admin'): return jsonify({'ok':False,'message':'Doctor or admin access required.'}),403
    data=request.get_json(silent=True) or {}; status=data.get('status')
    if status not in ('confirmed','rejected'): return jsonify({'ok':False,'message':'Invalid appointment status.'}),400
    with db() as c:
        row=c.execute('SELECT * FROM appointments WHERE id=?',(appointment_id,)).fetchone()
        if not row:return jsonify({'ok':False,'message':'Appointment not found.'}),404
        c.execute('UPDATE appointments SET status=? WHERE id=?',(status,appointment_id))
    audit(session['username'],'appointment_'+status,str(appointment_id))
    return jsonify({'ok':True,'status':status})

@app.route('/api/report')
@login_required
def report(): return jsonify({'title':'NURO HEALTHCARE Simulation Summary','generated_at':datetime.now().isoformat(timespec='seconds'),'notice':'SIMULATED DEMO DATA — not a medical record or diagnostic output.','vitals':vitals,'history':history[-30:],'events':events[:10]})

@app.route('/api/admin/overview')
@admin_required
def admin_overview():
    with db() as c:
        users=c.execute('SELECT id,username,display_name,role,phone,active,approved,created_at FROM users ORDER BY id DESC').fetchall()
        logs=c.execute('SELECT id,actor,action,target,created_at FROM audit ORDER BY id DESC LIMIT 12').fetchall()
        counts={r['role']:r['n'] for r in c.execute('SELECT role,COUNT(*) n FROM users GROUP BY role').fetchall()}
        total=c.execute('SELECT COUNT(*) n FROM audit').fetchone()['n']
    return jsonify({'otp_enabled':False,'users':[dict(r) for r in users],'logs':[dict(r) for r in logs],'counts':counts,'total_users':len(users),'audit_events':total,'active_users':sum(r['active'] and r['approved'] for r in users),'pending_users':sum(not r['approved'] for r in users),'simulation_events':len(events),'history_points':len(history)})

@app.route('/api/admin/users',methods=['POST'])
@admin_required
def create_user():
    data=request.get_json(silent=True) or {}; username=str(data.get('username','')).strip().lower(); name=str(data.get('display_name','')).strip(); role=str(data.get('role','patient')).lower(); password=str(data.get('password','')); phone=str(data.get('phone','')).strip()
    if not username or not name or len(username)<3 or role not in ('patient','caretaker','doctor') or len(password)<8: return jsonify({'ok':False,'message':'Provide username (3+ chars), full name, valid role and password (8+ chars).'}),400
    try:
        with db() as c: c.execute('INSERT INTO users(username,display_name,role,password_hash,phone,active,approved,created_at) VALUES(?,?,?,?,?,1,1,?)',(username,name,role,generate_password_hash(password),phone,datetime.now().isoformat(timespec='seconds')))
        audit(session['username'],'create_user',username); return jsonify({'ok':True,'message':'User created.'})
    except sqlite3.IntegrityError: return jsonify({'ok':False,'message':'That username already exists.'}),409

@app.route('/api/admin/users/<int:user_id>',methods=['PATCH','DELETE'])
@admin_required
def manage_user(user_id):
    with db() as c: user=c.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone()
    if not user: return jsonify({'ok':False,'message':'User not found.'}),404
    if user['role']=='admin' or user['username']==session.get('username'): return jsonify({'ok':False,'message':'Admin accounts cannot be changed or deleted here.'}),403
    if request.method=='DELETE':
        with db() as c: c.execute('DELETE FROM users WHERE id=?',(user_id,))
        audit(session['username'],'delete_user',user['username']); return jsonify({'ok':True})
    data=request.get_json(silent=True) or {}
    if 'approved' in data:
        approved=1 if data.get('approved') else 0
        with db() as c: c.execute('UPDATE users SET approved=? WHERE id=?',(approved,user_id))
        audit(session['username'],'approve_registration' if approved else 'revoke_approval',user['username'])
        return jsonify({'ok':True,'approved':bool(approved)})
    active=1 if data.get('active') else 0
    with db() as c: c.execute('UPDATE users SET active=? WHERE id=?',(active,user_id))
    audit(session['username'],'update_user_status',user['username']); return jsonify({'ok':True})

@app.route('/api/admin/export-users')
@admin_required
def export_users():
    import csv, io
    output=io.StringIO()
    writer=csv.writer(output)
    writer.writerow(['id','username','display_name','role','phone','active','approved','created_at'])
    with db() as c:
        rows=c.execute('SELECT id,username,display_name,role,phone,active,approved,created_at FROM users ORDER BY id').fetchall()
        writer.writerows([tuple(r) for r in rows])
    from flask import Response
    return Response('\ufeff'+output.getvalue(),mimetype='text/csv; charset=utf-8',headers={'Content-Disposition':'attachment; filename=nuro-user-analytics.csv'})

@app.route('/api/admin/audit/<int:log_id>',methods=['DELETE'])
@admin_required
def delete_audit(log_id):
    with db() as c: c.execute('DELETE FROM audit WHERE id=?',(log_id,))
    audit(session['username'],'delete_audit_log',str(log_id)); return jsonify({'ok':True})

@app.errorhandler(403)
def forbidden(_): return render_template('error.html',code=403,message='Administrator access is required.'),403

init_db()
if __name__=='__main__': app.run(debug=os.environ.get('FLASK_DEBUG','0')=='1',host='127.0.0.1',port=5000)
