"""
Sensor modules for edge device simulation.
Includes SpeechRecognition keyword listening, OpenCV/YOLOv8 crowd counting, and GPS coordinate emulation.
"""

from .sos_audio_listener import AudioSOSListener
from .crowd_monitor_yolo import YOLOCrowdMonitor
from .gps_simulator import GPSTelemetrySimulator
