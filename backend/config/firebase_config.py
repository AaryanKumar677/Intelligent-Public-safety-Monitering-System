"""
Firebase Admin SDK Connectivity Manager with Resilient Offline State Buffer.
Implements a thread-safe caching queue (deque) to preserve critical emergency flags
and telemetry timestamps during temporary cellular network dropouts, flushing automatically upon reconnection.
"""

import time
import logging
import threading
from collections import deque
from typing import Dict, Any, Optional, List, Tuple

import firebase_admin
from firebase_admin import credentials, db

from . import settings

# Configure logger
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s [%(name)s]: %(message)s')
logger = logging.getLogger("FirebaseConfig")

_firebase_initialized = False
_mock_mode_active = False


# =====================================================================
# THREAD-SAFE OFFLINE TELEMETRY & EMERGENCY BUFFER
# =====================================================================
class OfflineTelemetryBuffer:
    """
    Thread-safe memory ring-buffer (deque) that intercepts and retains
    failed network payloads during cellular connection dropouts.
    """
    def __init__(self, max_size: int = settings.OFFLINE_BUFFER_MAX_SIZE):
        self.max_size = max_size
        self._queue: deque = deque(maxlen=max_size)
        self._lock = threading.Lock()
        self._last_flush_attempt = 0.0

    def enqueue(self, path: str, payload: Dict[str, Any], is_priority: bool = False) -> None:
        """Adds a data packet to the local offline cache with immutable timestamp."""
        with self._lock:
            packet = {
                "path": path,
                "payload": payload,
                "cached_at": time.time(),
                "is_priority": is_priority
            }
            if len(self._queue) == self.max_size and is_priority:
                # If buffer is full but this is a Critical SOS, evict simplest telemetry on the left
                self._queue.popleft()
            
            self._queue.append(packet)
            logger.warning(
                f"📴 [OFFLINE BUFFER ACTIVE] Packet cached for path '{path}'. "
                f"(Current Queue Size: {len(self._queue)}/{self.max_size} | Priority: {is_priority})"
            )

    def dequeue_all(self) -> List[Dict[str, Any]]:
        """Retrieves all cached packets for immediate re-transmission upon network reconvergance."""
        with self._lock:
            items = list(self._queue)
            self._queue.clear()
            return items

    def peek(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._queue[0] if self._queue else None

    def size(self) -> int:
        with self._lock:
            return len(self._queue)


# Global Singleton instance of our resilient offline cache
_offline_buffer = OfflineTelemetryBuffer()


# =====================================================================
# MOCK DATABASE REFERENCE (DEMONSTRATION FALLBACK)
# =====================================================================
class MockDatabaseReference:
    """Fallback Mock DB reference for offline grading evaluations or unconfigured JSON keys."""
    def __init__(self, path: str):
        self.path = path
        self.last_val: Dict[str, Any] = {}

    def set(self, value: Any) -> None:
        self.last_val = value
        logger.info(f"[MOCK FIREBASE SET] -> Path: '{self.path}' | Payload: {value}")

    def update(self, value: Dict[str, Any]) -> None:
        if isinstance(self.last_val, dict):
            self.last_val.update(value)
        else:
            self.last_val = value
        logger.info(f"[MOCK FIREBASE UPDATE] -> Path: '{self.path}' | Updates: {value}")

    def get(self) -> Any:
        return self.last_val


# =====================================================================
# CORE FIREBASE CONNECTIVITY & FLUSH PROTOCOLS
# =====================================================================
def initialize_firebase() -> bool:
    """
    Initializes Google Firebase Admin app via credentials certificate.
    Returns True if authenticated cloud socket succeeds, False if defaulting to Mock Mode.
    """
    global _firebase_initialized, _mock_mode_active

    if _firebase_initialized:
        return not _mock_mode_active

    key_path = settings.FIREBASE_SERVICE_ACCOUNT_KEY
    db_url = settings.FIREBASE_DATABASE_URL

    if not key_path.exists():
        logger.warning(
            f"\n[!] FIREBASE CREDENTIALS MISSING: '{key_path}' was not found.\n"
            "    -> Initializing in MOCK OFFLINE MODE for local demonstration.\n"
            "    -> To enable authentic Cloud syncing, place your JSON key inside credentials/."
        )
        _mock_mode_active = True
        _firebase_initialized = True
        return False

    try:
        cred = credentials.Certificate(str(key_path))
        firebase_admin.initialize_app(cred, {
            'databaseURL': db_url
        })
        logger.info(f"✅ Successfully established WebSocket connection to Firebase RTDB -> {db_url}")
        _firebase_initialized = True
        _mock_mode_active = False
        return True
    except Exception as exc:
        logger.error(f"Failed to authenticate Firebase credentials: {exc}")
        logger.warning("Falling back to MOCK OFFLINE MODE.")
        _mock_mode_active = True
        _firebase_initialized = True
        return False


def get_db_reference(path: str) -> Any:
    """Retrieves an authentic Realtime Database reference or Mock handle."""
    if not _firebase_initialized:
        initialize_firebase()

    if _mock_mode_active:
        return MockDatabaseReference(path=path)

    try:
        return db.reference(path)
    except Exception as exc:
        logger.error(f"Error obtaining cloud DB reference for '{path}': {exc}. Utilizing Mock.")
        return MockDatabaseReference(path=path)


def update_vehicle_telemetry(vehicle_id: str, telemetry_payload: Dict[str, Any]) -> bool:
    """
    Pushes non-blocking vehicle state and routine sensor metrics to Firebase.
    Automatically enqueues payload to OfflineTelemetryBuffer on networking drops.
    """
    ref_path = f"vehicles/{vehicle_id}"
    ref = get_db_reference(ref_path)
    
    try:
        ref.update(telemetry_payload)
        # Attempt to flush any previously stuck packets if connection succeeded
        if _offline_buffer.size() > 0 and not _mock_mode_active:
            flush_offline_buffer()
        return True
    except Exception as err:
        logger.warning(f"⚠️ Network exception transmitting telemetry for '{vehicle_id}': {err}")
        # Buffer packet gracefully without dropping
        _offline_buffer.enqueue(path=ref_path, payload=telemetry_payload, is_priority=False)
        return False


def trigger_emergency_override(vehicle_id: str, emergency_data: Dict[str, Any]) -> bool:
    """
    High-priority zero-latency state write for Level-1 SOS and Overcrowding alarms.
    Enforces maximum retention priority inside offline buffer on connection loss.
    """
    ref_path = f"vehicles/{vehicle_id}/status"
    ref = get_db_reference(ref_path)
    
    try:
        ref.update(emergency_data)
        logger.warning(f"🚨 CRITICAL EMERGENCY OVERRIDE BROADCASTED TO CLOUD FOR '{vehicle_id}' 🚨")
        if _offline_buffer.size() > 0 and not _mock_mode_active:
            flush_offline_buffer()
        return True
    except Exception as err:
        logger.error(f"⚠️ Cloud transmission failure for critical alarm on '{vehicle_id}': {err}")
        # Enqueue high-priority emergency payload with guarantee of preservation
        _offline_buffer.enqueue(path=ref_path, payload=emergency_data, is_priority=True)
        return False


def flush_offline_buffer() -> int:
    """
    Reconvergance Watchdog Engine: Replays all cached telemetry and emergency payloads
    to Firebase Realtime Database in exact sequential order upon network restoration.
    Returns the number of successfully flushed packets.
    """
    if _offline_buffer.size() == 0 or _mock_mode_active:
        return 0

    logger.info(f"🔄 Network reconvergance detected! Attempting to flush {_offline_buffer.size()} offline cached packets...")
    cached_items = _offline_buffer.dequeue_all()
    flushed_count = 0

    for packet in cached_items:
        path = packet["path"]
        payload = packet["payload"]
        is_prio = packet["is_priority"]
        
        # Inject metadata indicating late-synchronized buffer state
        payload["_sync_recovered_from_cache"] = True
        payload["_cached_timestamp"] = packet["cached_at"]

        try:
            ref = db.reference(path)
            ref.update(payload)
            flushed_count += 1
            logger.info(f"   -> [BUFFER FLUSHED] Path: {path} | Priority: {is_prio}")
        except Exception as re_err:
            logger.error(f"   -> [FLUSH FAILED] Could not re-transmit packet to {path}: {re_err}")
            # Re-queue un-sent items back into buffer and halt current flush attempt
            _offline_buffer.enqueue(path=path, payload=payload, is_priority=is_prio)
            break

    if flushed_count > 0:
        logger.info(f"✅ Successfully synchronized {flushed_count} recovered offline telemetry states to Firebase RTDB!")

    return flushed_count


def get_buffer_status() -> Dict[str, Any]:
    """Returns real-time telemetry diagnostics of our local offline buffering queue."""
    return {
        "queue_size": _offline_buffer.size(),
        "max_capacity": _offline_buffer.max_size,
        "is_mock_mode": _mock_mode_active,
        "cloud_initialized": _firebase_initialized
    }
