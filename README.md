# VitaSphere — Responsive Health Simulation & Care Portal

A responsive Flask + SQLite application with a bright yellow/blue sign-in screen, animated abstract background (no animated human on login), patient/caretaker/doctor workspaces, a compact administrator rail, user administration, role analytics, audit events, simulated vital-sign scenarios, trend charts and JSON report export.

## 1. Run locally (Windows PowerShell, line by line)

Open the extracted `VitaSphere` folder in VS Code, choose **Terminal → New Terminal**, then run each line separately:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
$env:SECRET_KEY = (python -c "import secrets; print(secrets.token_hex(32))")
python app.py
```

If PowerShell blocks activation, run this once in the same terminal and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Then open **http://127.0.0.1:5000** in your browser. Keep the terminal open while using the website. The SQLite database (`vitasphere.db`) is created automatically on first launch.

## 2. Starter accounts

| Portal | Username | Password |
|---|---|---|
| Administrator | `sripriyan16042007@gmail.com` | `9655018398` |
| Doctor | `doctor` | `123` |
| Caretaker | Register, then wait for admin approval | Chosen during registration |
| User / patient | Register, then wait for admin approval | Chosen during registration |

These are local starter credentials only. Change them and configure a strong `SECRET_KEY` before deploying anywhere. Do not publish this starter database or use the default credentials in a public environment.

## 3. Features

- Responsive login and portal layouts for mobile, tablet and laptop.
- Yellow/blue design, animated abstract background, accessible form labels and reduced-motion support.
- Password sign-in plus a 6-digit OTP flow for user/caretaker/doctor roles.
- Administrator-only `/admin` console; ordinary roles cannot access its HTML page or API.
- SQLite-backed account creation, enable/disable, delete, role-based account counts and recent audit history.
- Responsive role distribution bar chart and account search.
- Existing virtual patient simulation, vital cards, ECG-style demo waveform, trend history, event stream and report export.

## 4. OTP and deployment boundary

The OTP currently runs in **local development mode**: the code is returned to the browser so the workflow can be tested without a messaging service. It expires after five minutes and is not delivered to a real phone/email. For real deployment, connect a verified SMS/email OTP provider, remove the development-code response, add rate limiting and CSRF protections, use HTTPS, configure secure cookies and production WSGI hosting, rotate the seeded passwords, and review privacy/security obligations before storing any real health data.

All health readings and the virtual patient are simulated. This is not a medical device and must not be used for diagnosis or treatment. The 3D model uses Three.js from a CDN, so internet access is needed for that specific model; the rest of the local application can still run without the CDN.

## Approval workflow and language controls

- New patient registrations are stored as pending and cannot sign in until an administrator approves them.
- Admin can approve pending registrations from **User management**.
- Login screen includes Tamil/English switching, a live local clock, animated background and background-video on/off control.
- Admin can upload an MP4/WebM login background from the admin console.
- The admin and doctor credentials above are local starter credentials requested for this project. **Do not deploy them publicly**; change them before any real use.
- The app remains a prototype: appointment booking, real nearby-hospital maps, real medical-device ECG acquisition, and secure production-grade handling of medical records require additional integrations and deployment hardening. All displayed vitals are simulated.

## Wokwi ESP32 live demo bridge

The app includes an optional authenticated Wokwi ingestion endpoint (`POST /api/wokwi/vitals`). Configure `WOKWI_DEVICE_TOKEN` as a server environment variable to enable it. See `wokwi_integration/README_TAMIL.md` and `wokwi_integration/wokwi_publish_patch.ino.txt` for the Wokwi sketch patch and deployment steps. The dashboard polls the state API every second and labels readings as `WOKWI DEVICE LIVE` when the device is the active source.

This is a shared demonstration stream, not per-patient medical data isolation. Deploy behind HTTPS, use only simulated values, and do not send real patient data through the Wokwi public gateway. The `patient_id` field is currently a label, not an account-link authorization mechanism.

## Free Render deployment

This project includes `render.yaml` and `Procfile` for a Render Web Service.
1. Push the contents of this folder to a GitHub repository.
2. In Render, choose **New → Blueprint** and connect that repository (or create a Web Service manually).
3. Set `WOKWI_DEVICE_TOKEN` to a long random secret in Render's environment settings. Use the same token in the Wokwi sketch patch.
4. Render generates `SECRET_KEY` from `render.yaml`.

**Important demo limitations:** Render free web services can sleep and their local filesystem is ephemeral. This app currently stores its SQLite database and uploaded files locally, so data can be lost on restart/redeploy/spin-down. This deployment setup is for demo/testing, not real patient data or clinical use. Use a persistent database/storage and production security review before real use.
