"""
Computer Vision Anomaly & Overcrowding Detection Engine.
Utilizes OpenCV for real-time optical frame extraction from webcam input
and YOLOv8 (Nano) deep learning model for rapid person detection and counting.
"""

import time
import logging
from pathlib import Path
from typing import Optional, Callable, Tuple, Any, Dict
import cv2
import numpy as np
from ultralytics import YOLO

from backend.config import settings

logger = logging.getLogger("YOLOCrowdMonitor")

class YOLOCrowdMonitor:
    """
    Real-time vision monitoring node. Evaluates cabin passenger density
    and raises automated alarms if geometric capacity threshold is violated.
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
        
        # State tracking
        self.current_passenger_count = 0
        self.is_overcrowded = False
        self._overcrowd_start_time: Optional[float] = None
        self.total_frames_processed = 0
        self._running = False

    def load_model(self) -> bool:
        """Initializes neural network weights into RAM/VRAM."""
        try:
            logger.info(f"Loading YOLOv8 neural model from '{self.model_path}'...")
            self.model = YOLO(self.model_path)
            logger.info("YOLOv8 Object Recognition Engine initialized successfully.")
            return True
        except Exception as err:
            logger.error(f"Failed loading YOLOv8 model weights: {err}")
            return False

    def initialize_camera(self) -> bool:
        """Opens optical interface connection via OpenCV VideoCapture."""
        try:
            self.capture = cv2.VideoCapture(self.camera_index)
            if not self.capture.isOpened():
                logger.warning(
                    f"⚠️ Webcam input index {self.camera_index} could not be accessed.\n"
                    "    -> Vision Monitor will allow testing via simulated or static image input."
                )
                return False
            logger.info(f"📹 Webcam optical interface successfully bounded to index {self.camera_index}.")
            return True
        except Exception as exc:
            logger.error(f"Error accessing optical device hardware: {exc}")
            return False

    def analyze_frame(self, frame: np.ndarray) -> Tuple[int, np.ndarray, bool]:
        """
        Executes inference on a single image array.
        Returns: (person_count, annotated_frame, status_changed_flag)
        """
        if self.model is None:
            if not self.load_model():
                return 0, frame, False

        # Run inference filtering exclusively for COCO class 0 (Person)
        results = self.model.predict(
            source=frame,
            classes=[settings.VISION_PERSON_CLASS_ID],
            conf=settings.VISION_CONFIDENCE_THRESHOLD,
            verbose=False
        )

        annotated_frame = results[0].plot()
        detected_persons = 0

        # Count filtered detection boxes
        boxes = results[0].boxes
        if boxes is not None:
            detected_persons = len(boxes)

        self.current_passenger_count = detected_persons
        status_changed = self._evaluate_hysteresis_threshold(detected_persons)
        
        # Draw dynamic telemetry HUD overlay directly onto visual output
        hud_color = (0, 0, 255) if self.is_overcrowded else (0, 220, 0)
        hud_text = f"CABIN LOAD: {detected_persons}/{self.threshold_count} [{'OVERCROWDED ALARM' if self.is_overcrowded else 'SAFE'}]"
        cv2.putText(annotated_frame, hud_text, (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.75, hud_color, 2, cv2.LINE_AA)

        self.total_frames_processed += 1
        return detected_persons, annotated_frame, status_changed

    def _evaluate_hysteresis_threshold(self, detected_persons: int) -> bool:
        """
        Applies time hysteresis to prevent fleeting false positives (e.g., passing pedestrians outside window)
        from immediately firing crowding alarms.
        """
        now = time.time()
        previous_state = self.is_overcrowded

        if detected_persons > self.threshold_count:
            if self._overcrowd_start_time is None:
                self._overcrowd_start_time = now
            elif (now - self._overcrowd_start_time) >= self.hysteresis_sec:
                self.is_overcrowded = True
        else:
            self._overcrowd_start_time = None
            self.is_overcrowded = False

        state_changed = (previous_state != self.is_overcrowded)
        if state_changed:
            if self.is_overcrowded:
                logger.warning(f"🚨 [ANOMALY DETECTED] Overcrowding threshold exceeded! Count: {detected_persons} passengers.")
            else:
                logger.info(f"✅ [ANOMALY RESOLVED] Cabin passenger density returned to safe operating margin ({detected_persons} passengers).")
            
            if self.on_anomaly_callback:
                try:
                    self.on_anomaly_callback(detected_persons, self.is_overcrowded)
                except Exception as err:
                    logger.error(f"Error executing visual anomaly callback: {err}")

        return state_changed

    def process_single_step(self, show_preview_window: bool = False) -> Dict[str, Any]:
        """
        Captures one live frame from webcam, executes evaluation, and returns structured telemetry metric.
        Ideal for synchronous polling inside multithreaded orchestrator loops.
        """
        if not self.capture or not self.capture.isOpened():
            # If camera isn't plugged in, return simulated stable state
            return {
                "passenger_count": self.current_passenger_count,
                "overcrowded": self.is_overcrowded,
                "hardware_online": False
            }

        success, frame = self.capture.read()
        if not success or frame is None:
            logger.error("Failed extracting optical stream frame from webcam hardware.")
            return {
                "passenger_count": self.current_passenger_count,
                "overcrowded": self.is_overcrowded,
                "hardware_online": False
            }

        count, annotated, changed = self.analyze_frame(frame)

        if show_preview_window:
            cv2.imshow(f"AI IoT Vehicle Optical Surveillance - [{settings.VEHICLE_ID}]", annotated)
            cv2.waitKey(1)  # Minimal refresh latency

        return {
            "passenger_count": count,
            "overcrowded": self.is_overcrowded,
            "hardware_online": True,
            "status_changed": changed
        }

    def simulate_crowd_spike(self, simulated_count: int = 8) -> None:
        """
        Manual simulation trigger allowing demonstration of overcrowding alarms without needing a crowded room.
        """
        logger.info(f"🤖 Manual crowd spike simulation executed with simulated count: {simulated_count} passengers.")
        self.current_passenger_count = simulated_count
        self._overcrowd_start_time = time.time() - (self.hysteresis_sec + 0.5)  # Expire hysteresis timer instantly
        self._evaluate_hysteresis_threshold(simulated_count)

    def release(self) -> None:
        """Terminates optical hardware bindings and dismisses UI windows."""
        logger.info("Releasing webcam optical handles...")
        self._running = False
        if self.capture and self.capture.isOpened():
            self.capture.release()
        cv2.destroyAllWindows()
        logger.info("Vision engine shut down completed.")
