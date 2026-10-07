"""
Cloud Webhook Server for Transport Safety AI.
A decoupled 24/7 centralized gateway.
Receives simulated and real GSM/SMS payloads when the edge vehicle loses IP connectivity.
Translates Twilio SMS strings into Firebase Realtime Database updates.
"""
from fastapi import FastAPI, Form, Request, HTTPException
from typing import Optional
import firebase_admin
from firebase_admin import credentials, db
import logging
from pathlib import Path
import os
import uvicorn

# Set up logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s [%(name)s]: %(message)s')
logger = logging.getLogger("CloudWebhookServer")

app = FastAPI(title="Transport Safety AI Cloud Webhook", version="1.0")

# Initialize Firebase for the Cloud Webhook (Server Side)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
key_path = BASE_DIR / "credentials" / "firebase_service_account.json"
db_url = os.getenv("FIREBASE_DATABASE_URL", "https://transport-safety-ai-default-rtdb.firebaseio.com/")

if not firebase_admin._apps:
    if key_path.exists():
        try:
            cred = credentials.Certificate(str(key_path))
            firebase_admin.initialize_app(cred, {'databaseURL': db_url})
            logger.info(f"✅ Cloud Server Firebase Authenticated: {db_url}")
        except Exception as e:
            logger.error(f"❌ Cloud Server Firebase Auth Failed: {e}")
    else:
        logger.warning(f"⚠️ Firebase JSON key missing at {key_path}. Cloud updates will fail!")

@app.post("/webhook/sms_fallback")
async def receive_sms_fallback(
    Body: str = Form(...) if Form else None,
    From: str = Form(...) if Form else None
):
    """
    Receives HTTP POST requests from Twilio containing inbound SMS messages.
    Expected Body Format: "SOS | LAT: 26.8467 | LON: 80.9462 | ID: BUS-12"
    """
    if not Body or not From:
        raise HTTPException(status_code=400, detail="Missing Body or From")
        
    logger.info(f"📥 Received Incoming SMS from {From}: {Body}")
    
    # Parse the incoming SMS string
    parts = [p.strip() for p in Body.split('|')]
    if len(parts) < 4 or parts[0] != "SOS":
        logger.warning("⚠️ Ignored SMS: Does not match expected SOS format.")
        return {"status": "ignored", "reason": "invalid_format"}

    try:
        lat_str = parts[1].split(":")[1].strip()
        lon_str = parts[2].split(":")[1].strip()
        vehicle_id = parts[3].split(":")[1].strip()
        
        lat = float(lat_str)
        lon = float(lon_str)
        
        logger.info(f"📍 Decoded Telemetry -> Vehicle: {vehicle_id} | LAT: {lat} | LON: {lon}")
        
        if firebase_admin._apps:
            # Sync to Firebase Realtime Database
            ref_path = f"vehicles/{vehicle_id}/location"
            db.reference(ref_path).update({
                "latitude": lat,
                "longitude": lon,
                "is_offline_sms_fallback": True
            })
            
            # Ensure SOS status is active in Cloud
            status_path = f"vehicles/{vehicle_id}/status"
            db.reference(status_path).update({
                "sos_triggered": True,
                "emergency_status": "CRITICAL - OFFLINE SMS MODE"
            })
            
            logger.info("✅ Successfully synchronized offline telemetry to Firebase!")
            return {"status": "success", "message": "Firebase Updated via SMS Fallback"}
        else:
            logger.error("❌ Firebase not initialized on Cloud Server.")
            raise HTTPException(status_code=500, detail="Firebase not configured on server")

    except Exception as e:
        logger.error(f"❌ Error parsing or syncing SMS payload: {e}")
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    logger.info("🚀 Starting Cloud Webhook Server on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
