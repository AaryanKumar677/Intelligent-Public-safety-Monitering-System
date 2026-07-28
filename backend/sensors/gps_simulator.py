"""
GPS Telemetry & Route Simulator.
Emulates real-time vehicular navigation across an authentic metropolitan transit path, # generating coordinate updates, speed calculations, and directional compass headings.
"""

import time
import math
import logging
from typing import Dict, Any, List, Tuple

from backend.config import settings

logger = logging.getLogger("GPSSimulator")

class GPSTelemetrySimulator:
    """
    Emulates onboard GPS hardware receiver by smoothly interpolating spatial coordinates
    along a configured urban bus route.
    """

    # Realistic municipal bus transit loop waypoints (Central Delhi corridor demo)
    DEFAULT_ROUTE_WAYPOINTS: List[Tuple[float, float, str]] = [
        (28.6139, 77.2090, "Connaught Place Central Bus Terminus"),
        (28.6152, 77.2110, "Barakhamba Road Metro Station"),
        (28.6175, 77.2145, "Mandi House Roundabout"),
        (28.6190, 77.2180, "Supreme Court Transit Hub"),
        (28.6212, 77.2215, "Pragati Maidan Gate No. 1"),
        (28.6245, 77.2250, "Indraprastha Park North Stop"),
        (28.6270, 77.2285, "Millennium Bus Depot South")
    ]

    def __init__(self, waypoints: Optional[List[Tuple[float, float, str]]] = None, speed_kmh: float = 35.0):
        self.waypoints = waypoints if waypoints is not None else self.DEFAULT_ROUTE_WAYPOINTS
        self.current_waypoint_index = 0
        self.target_waypoint_index = 1
        
        self.current_lat = self.waypoints[0][0]
        self.current_lng = self.waypoints[0][1]
        self.current_stop = self.waypoints[0][2]
        
        self.nominal_speed_kmh = speed_kmh
        self.current_speed_kmh = speed_kmh
        self.is_emergency_halt = False
        
        self.step_progress = 0.0
        self.interpolation_steps = 15.0  # Granularity of step interpolation between consecutive waypoints

    def _calculate_heading(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculates compass heading angle in degrees between two GPS coordinates."""
        d_lng = math.radians(lng2 - lng1)
        r_lat1 = math.radians(lat1)
        r_lat2 = math.radians(lat2)

        y = math.sin(d_lng) * math.cos(r_lat2)
        x = math.cos(r_lat1) * math.sin(r_lat2) - math.sin(r_lat1) * math.cos(r_lat2) * math.cos(d_lng)
        heading = math.degrees(math.atan2(y, x))
        return (heading + 360) % 360

    def set_emergency_halt(self, halt: bool) -> None:
        """Freezes vehicular motion telemetry when Level-1 critical SOS flag is raised."""
        self.is_emergency_halt = halt
        if halt:
            self.current_speed_kmh = 0.0
            logger.warning("📍 [GPS TELEMETRY] Emergency Halt activated -> Speed dropped to 0 km/h.")
        else:
            self.current_speed_kmh = self.nominal_speed_kmh
            logger.info("📍 [GPS TELEMETRY] Emergency Halt cleared -> Normal movement resumed.")

    def step(self) -> Dict[str, Any]:
        """
        Advances simulated vehicular location by one unit along active route corridor.
        Should be called once per telemetry polling loop interval.
        """
        if not self.is_emergency_halt:
            self.step_progress += (1.0 / self.interpolation_steps)

            if self.step_progress >= 1.0:
                self.step_progress = 0.0
                self.current_waypoint_index = self.target_waypoint_index
                self.target_waypoint_index = (self.current_waypoint_index + 1) % len(self.waypoints)
                self.current_stop = self.waypoints[self.current_waypoint_index][2]
                logger.debug(f"🚌 Vehicle arrived at waypoint: '{self.current_stop}'")

            # Perform linear geographical interpolation
            p1_lat, p1_lng, _ = self.waypoints[self.current_waypoint_index]
            p2_lat, p2_lng, next_stop = self.waypoints[self.target_waypoint_index]

            self.current_lat = p1_lat + (p2_lat - p1_lat) * self.step_progress
            self.current_lng = p1_lng + (p2_lng - p1_lng) * self.step_progress
            
            heading = self._calculate_heading(self.current_lat, self.current_lng, p2_lat, p2_lng)
            self.current_speed_kmh = round(self.nominal_speed_kmh + (math.sin(time.time()) * 3.5), 1)
        else:
            p2_lat, p2_lng, _ = self.waypoints[self.target_waypoint_index]
            heading = self._calculate_heading(self.current_lat, self.current_lng, p2_lat, p2_lng)

        telemetry_packet = {
            "latitude": round(self.current_lat, 6),
            "longitude": round(self.current_lng, 6),
            "speed_kmh": round(self.current_speed_kmh, 1),
            "heading_degrees": round(heading, 1),
            "current_stop_nearby": self.current_stop,
            "emergency_halt_active": self.is_emergency_halt,
            "timestamp": int(time.time())
        }

        return telemetry_packet

    def get_current_state(self) -> Dict[str, Any]:
        """Returns instantaneous snapshot of current coordinate packet without stepping forward."""
        return {
            "latitude": round(self.current_lat, 6),
            "longitude": round(self.current_lng, 6),
            "speed_kmh": round(self.current_speed_kmh, 1),
            "current_stop_nearby": self.current_stop,
            "emergency_halt_active": self.is_emergency_halt,
            "timestamp": int(time.time())
        }
