"""
Sensor suites package for Edge AI vehicular monitoring nodes.
Exports acoustic keyword detection, YOLOv8 vision machine learning, and GPS route telemetry simulation engines.
"""

from .sos_audio_listener import AudioSOSListener
from .crowd_monitor_yolo import YOLOCrowdMonitor
from .gps_simulator import GPSTelemetrySimulator
