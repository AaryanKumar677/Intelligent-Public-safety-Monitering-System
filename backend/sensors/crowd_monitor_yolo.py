"""
Computer Vision Anomaly & Overcrowding Detection Engine.
Utilizes OpenCV for optical frame extraction from default webcam interface (Index 0)
and Ultralytics YOLOv8 Nano deep learning neural model for real-time person counting.
Includes temporal hysteresis filtering and evaluation simulation triggers.
"""

import time
import logging
from pathlib import Path
from typing import Optional, Callable, Dict, Any

import cv2
import numpy as np
from ultralytics import YOLO

from backend.config import settings

logger = logging.getLogger("YOLOCrowdMonitor")

class YOLOCrowdMonitor:
    """
    Real-time machine vision monitoring edge node. Evaluates passenger density inside
    transit cabin and invokes automated alarm protocols upon exceeding geometry thresholds.
    """

    def __init__(
        self,
        camera_index: int = settings.VISION_CAMERA_INDEX,
        model_path: str = settings.VISION_MODEL_WEIGHTS,
        threshold_count: int = settings.CROWD_THRESHOLD_COUNT,
        hysteresis_sec: float = settings.CROWD_HYSTERESIS_SEC,
        on_anomaly_callback: Optional[Callable[[int, bool], None]] = None
    ):
        self.camera_index = camera_index
        self.model_path = model_path
        self.threshold_count = threshold_count
        self.hysteresis_sec = hysteresis_sec
        self.on_anomaly_callback = on_anomaly_callback
        
        self.model: Optional[YOLO] = None
        self.capture: Optional[cv2.VideoCapture] = None
        
        # Internal state & time-hysteresis evaluation registers
        self.current_passenger_count = 0
        self.is_overcrowded = False
        self._overcrowd_start_time: Optional[float] = None
        self.total_frames_processed = 0
        self._running = False
        self._simulated_override_count: Optional[int] = None
        self._hardware_online = False

    def load_model(self) -> bool:
        """Initializes Ultralytics YOLOv8 neural network weights into system RAM/VRAM."""
        try:
            logger.info(f"🧠 Loading YOLOv8 architecture weights from '{self.model_path}'...")
            self.model = YOLO(self.model_path)
            logger.info("✅ YOLOv8 Deep Learning Recognition Engine loaded successfully.")
            return True
        except Exception as exc:
            logger.error(f"Failed to load YOLO model weights ('{self.model_path}'): {exc}")
            return False

    def initialize_camera(self) -> bool:
        """Opens video capture channel on confirmed hardware interface device Index 0."""
        logger.info(f"📹 Mounting Video Surveillance channel on Hardware Index [{self.camera_index}]...")
        try:
            self.capture = cv2.VideoCapture(self.camera_index)
            if not self.capture.isOpened():
                logger.warning(
                    f"[!] Could not acquire physical video stream on Index [{self.camera_index}].\n"
                    "    -> Initializing optical surveillance in MOCK SIMULATION MODE.\n"
                    "    -> You can simulate overcrowding spikes during academic defense by typing 'crowd' in terminal!"
                )
                self._hardware_online = False
                self._running = True
                return False
            
            # Request 720p HD frame resolution if supported by peripheral
            self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            
            self._hardware_online = True
            self._running = True
            logger.info("✅ Optical Video Capture pipeline established successfully.")
            return True
        except Exception as err:
            logger.error(f"Hardware camera initialization fault: {err}")
            self._hardware_online = False
            self._running = True
            return False

    def _evaluate_hysteresis_alarm(self, detected_count: int, now_time: float) -> None:
        """
        Executes temporal hysteresis evaluation. Overcrowded conditions must persist continuously
        for >= CROWD_HYSTERESIS_SEC (default 2.0s) to prevent false positives from transient shadow flickers.
        """
        if detected_count > self.threshold_count:
            if self._overcrowd_start_time is None:
                self._overcrowd_start_time = now_time
                logger.debug(f"Density threshold exceeded ({detected_count} > {self.threshold_count}). Hysteresis timer started...")
            elif (now_time - self._overcrowd_start_time) >= self.hysteresis_sec:
                if not self.is_overcrowded:
                    self.is_overcrowded = True
                    logger.warning(
                        f"📊 [HYSTERESIS TRIGGERED] Overcrowding sustained for >= {self.hysteresis_sec}s! "
                        f"Confirmed Passenger Density: {detected_count}"
                    )
                    if self.on_anomaly_callback:
                        self.on_anomaly_callback(detected_count, True)
        else:
            if self._overcrowd_start_time is not None:
                logger.debug(f"Passenger density dropped back to safe zone ({detected_count}). Hysteresis reset.")
                self._overcrowd_start_time = None
            if self.is_overcrowded:
                self.is_overcrowded = False
                logger.info(f"🟢 [SAFE STATE RESTORED] Cabin load normalized ({detected_count} persons).")
                if self.on_anomaly_callback:
                    self.on_anomaly_callback(detected_count, False)

    def process_single_step(self, show_preview_window: bool = True) -> Dict[str, Any]:
        """
        Executes a single optical inference step: captures video frame, evaluates person bounding boxes,
        computes capacity HUD graphics, and triggers hysteresis alarms.
        """
        now = time.time()

        # 1. Handle Simulated Override Mode during defense evaluations
        if self._simulated_override_count is not None:
            pax_count = self._simulated_override_count
            self.current_passenger_count = pax_count
            self._evaluate_hysteresis_alarm(pax_count, now)
            return {
                "passenger_count": pax_count,
                "overcrowded": self.is_overcrowded,
                "hardware_online": self._hardware_online,
                "timestamp": int(now)
            }

        # 2. Handle Mock hardware absence
        if not self._hardware_online or self.capture is None or not self.capture.isOpened():
            # Default to baseline simulated cabin count of 2 safe passengers
            pax_count = 2
            self.current_passenger_count = pax_count
            self._evaluate_hysteresis_alarm(pax_count, now)
            return {
                "passenger_count": pax_count,
                "overcrowded": False,
                "hardware_online": False,
                "timestamp": int(now)
            }

        # 3. Perform live neural vision inference on physical video stream
        ret, frame = self.capture.read()
        if not ret or frame is None:
            logger.warning("Dropped optical video frame. Retaining previous density evaluation.")
            return {
                "passenger_count": self.current_passenger_count,
                "overcrowded": self.is_overcrowded,
                "hardware_online": self._hardware_online,
                "timestamp": int(now)
            }

        self.total_frames_processed += 1
        pax_count = 0

        # Run YOLOv8 rapid tensor prediction
        if self.model:
            results = self.model.predict(
                source=frame,
                conf=settings.VISION_CONFIDENCE_THRESHOLD,
                classes=[settings.VISION_PERSON_CLASS_ID],  # Strictly restrict detection to standard COCO Class 0 ('person')
                verbose=False
            )

            # Draw visual bounding box silhouettes and tally passenger instances
            if len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                pax_count = len(boxes)
                frame = results[0].plot()

        self.current_passenger_count = pax_count
        self._evaluate_hysteresis_alarm(pax_count, now)

        # 4. Render Head-Up Display (HUD) diagnostics across live OpenCV presentation video window
        if show_preview_window:
            status_text = "STATUS: SAFE CABIN LOAD" if not self.is_overcrowded else "WARNING: OVERCROWDED HAZARD!"
            status_color = (0, 217, 126) if not self.is_overcrowded else (45, 58, 255) # BGR Format
            
            # Draw semi-transparent HUD header backdrop
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, 0), (frame.shape[1], 70), (10, 15, 26), -1)
            cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

            # Embed real-time text overlay metrics
            cv2.putText(frame, f"AI SURVEILLANCE: {status_text}", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
            cv2.putText(frame, f"PASSENGER DENSITY: {pax_count} (Limit: {self.threshold_count}) | FPS Eval: Active", (20, 56), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (240, 244, 248), 1)

            try:
                cv2.imshow("Intelligent Public Transport Safety - Live YOLOv8 Surveillance", frame)
                cv2.waitKey(1)
            except Exception as cv_err:
                logger.debug(f"OpenCV GUI display context error (possibly headless shell): {cv_err}")

        return {
            "passenger_count": pax_count,
            "overcrowded": self.is_overcrowded,
            "hardware_online": True,
            "timestamp": int(now)
        }

    def simulate_crowd_spike(self, simulated_count: int = 8) -> None:
        """Academic evaluation utility to simulate crowd density spikes directly from terminal command prompt."""
        logger.warning(f"👥 [EVALUATION SIMULATION] Overriding vision count to {simulated_count} persons (Threshold: {self.threshold_count}).")
        self._simulated_override_count = simulated_count
        now = time.time()
        self.current_passenger_count = simulated_count
        # Force instantaneous hysteresis test
        self._overcrowd_start_time = now - (self.hysteresis_sec + 0.5)
        self._evaluate_hysteresis_alarm(simulated_count, now)

    def clear_simulated_override(self) -> None:
        """Restores physical hardware inference mode."""
        logger.info("🟢 Clearing simulated crowd override. Reverting to physical machine vision sensor input.")
        self._simulated_override_count = None

    def release(self) -> None:
        """Releases physical webcam peripheral locks and destroys UI windows."""
        logger.info("Releasing optical machine vision peripheral interfaces...")
        self._running = False
        if self.capture and self.capture.isOpened():
            self.capture.release()
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass
        logger.info("Vision engine terminated cleanly.")
