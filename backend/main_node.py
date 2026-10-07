"""
Intelligent Public Transport Safety Monitoring System - Main Edge Node Orchestrator.
Unifies real-time acoustic distress listening, OpenCV/YOLOv8 vision crowd counting,
GPS coordinates routing simulation, Cloud WebSocket syncing, and automated responder notifications.
"""

import sys
import time
import signal
import logging
import argparse
import threading
from pathlib import Path
from typing import Dict, Any

# Ensure project root is present in Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings, firebase_config
from backend.sensors import AudioSOSListener, YOLOCrowdMonitor, GPSTelemetrySimulator
from backend.services import dispatch_emergency_notification
from backend.services.notification_service import _dispatcher

# Configure formatting for system execution loggers
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s [%(name)s]: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("EdgeOrchestrator")

class IntelligentTransitNode:
    """
    Master supervisory controller representing an active public transit vehicle edge IoT node.
    """

    def __init__(self, enable_preview_window: bool = False):
        self.enable_preview = enable_preview_window
        self.vehicle_id = settings.VEHICLE_ID
        self.is_running = False
        
        # System status registers
        self.sos_active = False
        self.crowd_alert_active = False
        self.last_known_telemetry: Dict[str, Any] = {}

        # Initialize subsystem modules
        logger.info(f"Initializing Edge IoT node architecture for vehicle: '{self.vehicle_id}'...")
        self.gps_engine = GPSTelemetrySimulator()
        
        self.audio_engine = AudioSOSListener(
            callback=self._on_acoustic_sos_detected
        )
        
        self.vision_engine = YOLOCrowdMonitor(
            on_anomaly_callback=self._on_vision_anomaly_detected
        )

        self._console_thread: Optional[threading.Thread] = None

    def _on_acoustic_sos_detected(self, matched_keyword: str, timestamp: float) -> None:
        """Callback invoked immediately when speech recognition identifies distress keywords."""
        logger.critical(f"🚨 ACOUSTIC SOS EVENT INTERCEPTED! Matched word: '{matched_keyword.upper()}'")
        self.sos_active = True
        
        # Freeze vehicular motion in GPS telemetry simulator
        self.gps_engine.set_emergency_halt(True)
        telemetry = self.gps_engine.get_current_state()

        # Zero-latency priority transmission to Cloud RTDB
        emergency_payload = {
            "sos_triggered": True,
            "sos_keyword_matched": matched_keyword,
            "incident_timestamp": int(timestamp),
            "emergency_status": "CRITICAL - LEVEL 1 ACTIVE SOS"
        }
        firebase_config.trigger_emergency_override(self.vehicle_id, emergency_payload)

        # Dispatch automated SMS / Telegram alerts
        dispatch_emergency_notification(
            alert_type="Acoustic SOS Emergency Triggered",
            details=f"Passenger vocalized emergency distress keyword: '{matched_keyword.upper()}'. Cabin in danger.",
            telemetry=telemetry
        )

        # Trigger AI Voice Calls with 3-time retry
        maps_link = f"https://www.google.com/maps?q={telemetry.get('latitude')},{telemetry.get('longitude')}"
        _dispatcher.trigger_emergency_voice_call(
            victim_contacts=[settings.TWILIO_RECIPIENT_PHONE], 
            police_contact="+1911", # Demo police number
            tracking_link=maps_link
        )

        # Start continuous 3-second live GPS polling to Firebase (or SMS Fallback if offline)
        def push_gps_payload(state):
            payload = {
                "vehicle_id": self.vehicle_id,
                "location": {
                    "latitude": state["latitude"],
                    "longitude": state["longitude"],
                    "speed_kmh": state["speed_kmh"],
                    "heading": state["heading_degrees"],
                    "current_stop": state["current_stop_nearby"]
                },
                "status": {
                    "sos_triggered": True
                }
            }
            firebase_config.update_vehicle_telemetry(self.vehicle_id, payload)
            
        self.gps_engine.start_continuous_tracking(push_callback=push_gps_payload, interval=3.0)

    def _on_vision_anomaly_detected(self, person_count: int, overcrowded: bool) -> None:
        """Callback invoked when YOLOv8 crowd counter crosses established geometry limits."""
        self.crowd_alert_active = overcrowded
        telemetry = self.gps_engine.get_current_state()
        
        status_msg = "OVERCROWDED - LEVEL 2 WARNING" if overcrowded else "SAFE - CABIN LOAD NORMAL"
        logger.warning(f"📊 Crowd Load Shift: {person_count} persons -> Status: {status_msg}")

        # Sync updated load capacity metrics to Cloud RTDB
        cloud_payload = {
            "crowd_alert": overcrowded,
            "passenger_count": person_count,
            "cabin_load_status": status_msg
        }
        firebase_config.update_vehicle_telemetry(self.vehicle_id, {"status": cloud_payload})

        if overcrowded:
            dispatch_emergency_notification(
                alert_type="Cabin Overcrowding Warning",
                details=f"Detected passenger density ({person_count}) exceeded safe threshold ({settings.CROWD_THRESHOLD_COUNT}). Suffocation & safety hazard.",
                telemetry=telemetry
            )

    def _start_interactive_console(self) -> None:
        """Background keyboard interrupt handler to allow easy simulation commands during grading defenses."""
        print(
            "\n" + "="*75 + "\n"
            "🎮 ACADEMIC DEFENSE INTERACTIVE SIMULATOR READY:\n"
            "   -> Type 'sos' + [ENTER]    : Simulate hearing emergency keyword 'Bachao'\n"
            "   -> Type 'crowd' + [ENTER] : Simulate overcrowding anomaly spike (8 people)\n"
            "   -> Type 'safe' + [ENTER]   : Reset overcrowding count back to normal (2 people)\n"
            "   -> Type 'clear' + [ENTER] : Acknowledge and clear active Level-1 SOS alarm\n"
            "   -> Type 'quit' + [ENTER]   : Gracefully terminate all sensors and shutdown\n"
            + "="*75 + "\n"
        )
        while self.is_running:
            try:
                command = sys.stdin.readline().strip().lower()
                if not command:
                    continue
                if command == 'sos':
                    self.audio_engine.simulate_keyword_trigger("Bachao (Simulated Input)")
                elif command == 'crowd':
                    self.vision_engine.simulate_crowd_spike(simulated_count=8)
                elif command == 'safe':
                    self.vision_engine.simulate_crowd_spike(simulated_count=2)
                elif command == 'clear':
                    self._reset_sos_alarm()
                elif command in ['quit', 'exit', 'q']:
                    logger.info("Shutdown requested via interactive console...")
                    self.stop()
                    break
            except Exception:
                break

    def _reset_sos_alarm(self) -> None:
        """Clears active emergency override flag and resumes vehicular navigation."""
        logger.info("🛡️ Clearing emergency SOS overrides and resuming normal vehicle navigation...")
        self.sos_active = False
        self.gps_engine.set_emergency_halt(False)
        self.gps_engine.stop_continuous_tracking()
        
        clear_payload = {
            "sos_triggered": False,
            "sos_keyword_matched": "None",
            "emergency_status": "SAFE - NORMAL TRANSIT OPERATIONS"
        }
        firebase_config.trigger_emergency_override(self.vehicle_id, clear_payload)

    def start(self) -> None:
        """Launches multithreaded sensor capture engines and main telemetry heartbeat loop."""
        if self.is_running:
            return

        logger.info("=========================================================")
        logger.info(f"🚀 LAUNCHING TRANSIT SAFETY NODE: {self.vehicle_id}")
        logger.info("=========================================================")

        # Establish Firebase authentication binding
        firebase_config.initialize_firebase()

        # Initialize hardware peripherals
        self.vision_engine.initialize_camera()
        self.vision_engine.load_model()
        
        self.is_running = True

        # Spawn asynchronous audio background listening daemon
        self.audio_engine.start()

        # Spawn interactive presentation console daemon
        self._console_thread = threading.Thread(target=self._start_interactive_console, name="InteractiveConsole", daemon=True)
        self._console_thread.start()

        # Execute primary non-blocking telemetry and optical surveillance processing loop
        try:
            last_telemetry_sync = 0.0

            while self.is_running:
                loop_start = time.time()

                # Step 1: Advance GPS route coordinates simulation
                geo_telemetry = self.gps_engine.step()
                self.last_known_telemetry = geo_telemetry

                # Step 2: Evaluate live webcam frame via YOLOv8 engine (Running without 2s sleep for smooth video)
                vision_metrics = self.vision_engine.process_single_step(show_preview_window=self.enable_preview)

                # Step 3 & 4: Compile and Transmit telemetry only every TELEMETRY_INTERVAL_SEC (default 2s)
                if loop_start - last_telemetry_sync >= settings.TELEMETRY_INTERVAL_SEC:
                    master_state_payload = {
                        "vehicle_id": self.vehicle_id,
                        "route_name": settings.VEHICLE_ROUTE_NAME,
                        "location": {
                            "latitude": geo_telemetry["latitude"],
                            "longitude": geo_telemetry["longitude"],
                            "speed_kmh": geo_telemetry["speed_kmh"],
                            "heading": geo_telemetry["heading_degrees"],
                            "current_stop": geo_telemetry["current_stop_nearby"]
                        },
                        "metrics": {
                            "passenger_count": vision_metrics["passenger_count"],
                            "hardware_camera_online": vision_metrics["hardware_online"],
                            "last_heartbeat": geo_telemetry["timestamp"]
                        },
                        "status": {
                            "sos_triggered": self.sos_active,
                            "crowd_alert": self.crowd_alert_active,
                            "emergency_halt": geo_telemetry["emergency_halt_active"]
                        }
                    }

                    # Transmit unified telemetry to Firebase Cloud
                    firebase_config.update_vehicle_telemetry(self.vehicle_id, master_state_payload)
                    logger.debug(f"📡 Telemetry heartbeat synced -> Stop: '{geo_telemetry['current_stop_nearby']}' | Pax: {vision_metrics['passenger_count']}")
                    
                    last_telemetry_sync = loop_start

                # Sleep slightly to yield thread and prevent 100% CPU usage (~30 FPS target)
                time.sleep(0.03)

        except KeyboardInterrupt:
            logger.info("KeyboardInterrupt intercepted in primary orchestrator loop.")
        finally:
            self.stop()

    def stop(self) -> None:
        """Safely shuts down asynchronous sensor threads, hardware locks, and CV windows."""
        if not self.is_running:
            return
        logger.info("Initiating graceful system termination sequence...")
        self.is_running = False
        self.audio_engine.stop()
        self.vision_engine.release()
        logger.info("✨ Transit Safety Node shut down completely. Good luck with your project defense!")

def parse_arguments():
    parser = argparse.ArgumentParser(description="Intelligent Public Transport Safety Monitoring System Node")
    parser.add_argument("--show-video", action="store_true", help="Enable OpenCV video surveillance UI window")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_arguments()
    node_runtime = IntelligentTransitNode(enable_preview_window=args.show_video)
    
    def signal_handler(sig, frame):
        logger.info("System SIGINT received. Stopping...")
        node_runtime.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    node_runtime.start()
