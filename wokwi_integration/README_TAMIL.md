# NURO Healthcare + Wokwi integration (Tamil-English)

## Enna change pannirukkom?
- Flask backend-la `POST /api/wokwi/vitals` endpoint add pannirukkom.
- Endpoint `Authorization: Bearer ...` device token check pannum.
- Wokwi-la irundhu HR, SpO2, respiratory rate, temperature, BP, motion, alert values receive pannum.
- Patient/Caretaker dashboard `/api/state`-ai every second poll pannum; Wokwi value update aana dashboard-la automatic-aa update aagum.
- Dashboard-la `WOKWI DEVICE LIVE` / `LOCAL SIMULATION` source label kaattum.

## Connect panna thevaiyana steps
1. NURO app-ah public HTTPS hosting-la deploy pannu. Local `localhost` URL Wokwi cloud simulator-kku reach aagaadhu.
2. Hosting environment variables-la `WOKWI_DEVICE_TOKEN`-ku long random secret set pannu.
3. `wokwi_publish_patch.ino.txt`-la irukkura steps follow panni Wokwi project `sketch.ino`-la Wi-Fi + HTTPS POST code add pannu.
4. `NURO_API_URL`-la deployed website URL set pannu; `NURO_DEVICE_TOKEN`-la backend-la configure pannina same token set pannu.
5. Wokwi simulation start pannu. Serial monitor-la `NURO API HTTP status: 200` varanum. App-la Patient/Caretaker login panni values update aagudha check pannu.

## Important
- ZIP source code-la integration ready-aa irukku; aana Wokwi cloud project-ai external-aa edit/save panna mudiyadhu. Wokwi sketch patch-ai nee project editor-la paste panni Save pannanum.
- Website public HTTPS deployment illama direct cloud-to-cloud link work aagaadhu.
- Current build shared demo readings use pannudhu. `patient_id` ippo label mattum; individual patient/caretaker access mapping innum implement pannala. Real health data use panna koodadhu.
- Wokwi-la demo values mattum use pannu. Gemini API key-ai Wokwi sketch-la podaadha; backend secret environment variable-la mattum vechiru.
