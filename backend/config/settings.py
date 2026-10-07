"""
Global Settings & Configuration Registry for Transit Safety System Node.
Loads environment parameters from .env and configures hardware bindings and thresholds.
Confirmed Specifications: Hardware Index 0 (Webcam/Mic) & Telegram API Gateway.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Resolve root workspace directory path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"

# Load environment secrets if .env file exists
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

# =====================================================================
# 1. VEHICLE IDENTIFICATION & PROTOCOLS
# =====================================================================
VEHICLE_ID = os.getenv("VEHICLE_ID", "BUS-104-DL01")
VEHICLE_ROUTE_NAME = os.getenv("VEHICLE_ROUTE", "ROUTE_412_METRO_LINK")
TELEMETRY_INTERVAL_SEC = float(os.getenv("TELEMETRY_INTERVAL_SEC", "2.0"))

# =====================================================================
# 2. CLOUD DATABASE & OFFLINE BUFFER RESILIENCE
# =====================================================================
FIREBASE_DATABASE_URL = os.getenv(
    "FIREBASE_DATABASE_URL", 
    "https://transport-safety-ai-default-rtdb.firebaseio.com/"
)

_account_key_raw = os.getenv(
    "FIREBASE_SERVICE_ACCOUNT_KEY", 
    str(BASE_DIR / "credentials" / "firebase_service_account.json")
)
FIREBASE_SERVICE_ACCOUNT_KEY = (
    Path(_account_key_raw) if Path(_account_key_raw).is_absolute() 
    else BASE_DIR / _account_key_raw
)

# Resilient Offline Buffering Queue parameters
OFFLINE_BUFFER_MAX_SIZE = int(os.getenv("OFFLINE_BUFFER_MAX_SIZE", "50"))
RETRY_FLUSH_INTERVAL_SEC = float(os.getenv("RETRY_FLUSH_INTERVAL_SEC", "3.0"))

# =====================================================================
# 3. ACOUSTIC SOS DETECTION PARAMETERS (GOOGLE WEB SPEECH API)
# =====================================================================
# Keywords that trigger instantaneous Level-1 Critical Emergency override
AUDIO_SOS_KEYWORDS = {
    "bachao",
    "help",
    "emergency",
    "save me",
    "police",
    "bachao bachao"
}

# Confirmed Hardware Index: 1 (Microphone Array - Realtek)
AUDIO_DEVICE_INDEX = 1
AUDIO_ENERGY_THRESHOLD = int(os.getenv("AUDIO_ENERGY_THRESHOLD", "300"))
AUDIO_LISTEN_TIMEOUT_SEC = int(os.getenv("AUDIO_LISTEN_TIMEOUT_SEC", "3"))
AUDIO_DEBOUNCE_SEC = float(os.getenv("AUDIO_DEBOUNCE_SEC", "8.0"))

# =====================================================================
# 4. COMPUTER VISION CROWD MONITORING (YOLOv8 NANO)
# =====================================================================
# Confirmed Hardware Index 0 (Primary Integrated Laptop Webcam)
VISION_CAMERA_INDEX = int(os.getenv("VISION_CAMERA_INDEX", "0"))
VISION_MODEL_WEIGHTS = os.getenv("VISION_MODEL_WEIGHTS", "yolov8n.pt")
VISION_PERSON_CLASS_ID = 0  # COCO Standard class index for 'person'
VISION_CONFIDENCE_THRESHOLD = float(os.getenv("VISION_CONFIDENCE", "0.45"))
CROWD_THRESHOLD_COUNT = int(os.getenv("CROWD_THRESHOLD_COUNT", "5"))
CROWD_HYSTERESIS_SEC = float(os.getenv("CROWD_HYSTERESIS_SEC", "2.0"))

# =====================================================================
# 5. FALLBACK NOTIFICATION GATEWAY (TELEGRAM BOT API)
# =====================================================================
# Confirmed Operational Primary Gateway: 'telegram' (or 'mock' fallback)
NOTIFICATION_PROVIDER = os.getenv("NOTIFICATION_PROVIDER", "telegram").lower()

# Telegram Bot configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# Twilio REST Configuration (Optional fallback alternative)
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_SENDER_PHONE = os.getenv("TWILIO_SENDER_PHONE", "")
TWILIO_RECIPIENT_PHONE = os.getenv("TWILIO_RECIPIENT_PHONE", "+918318326641")
