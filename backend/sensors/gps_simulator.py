"""
GPS Route Telemetry Simulator & Emergency Vehicular Halt Controller.
Simulates realistic municipal public transit vehicle navigation along established
metropolitan GPS waypoints, computing live heading angles, speed dynamics,
and enforcing instant navigational halts upon receiving Level-1 distress override triggers.
"""

import time
import math
import logging
import threading
import requests
from typing import Dict, Any, List, Tuple

logger = logging.getLogger("GPSSimulator")

class GPSTelemetrySimulator:
    """
    Simulates transit vehicular telematics (Lat, Lng, Speed, Compass Heading, Nearby Bus Stops).
    Interlinked with SOS safety circuits to instantly freeze coordinates during emergency alarms.
    """

    def __init__(self, step_distance_km: float = 0.05, nominal_speed_kmh: float = 35.0):
        self.step_distance_km = step_distance_km
        self.nominal_speed_kmh = nominal_speed_kmh
        
        # Municipal transit route landmarks (Central Delhi Metropolitan Corridor)
        self.route_waypoints: List[Dict[str, Any]] = [
            {"name": "Connaught Place Central Hub", "coords": (28.6328, 77.2197)},
            {"name": "Janpath Road Corridor", "coords": (28.6218, 77.2173)},
            {"name": "Parliament Street Police Precinct", "coords": (28.6210, 77.2100)},
            {"name": "Central Secretariat Metro Gateway", "coords": (28.6146, 77.2115)},
            {"name": "India Gate Roundabout", "coords": (28.6129, 77.2295)},
            {"name": "Tilak Marg Supreme Court Station", "coords": (28.6185, 77.2255)},
            {"name": "Mandi House Art Hub", "coords": (28.6258, 77.2343)},
            {"name": "Barakhamba Road Commercial District", "coords": (28.6304, 77.2268)}
        ]

        # Bypass IP-API and use precise requested location: Takrohi, Indira Nagar, Lucknow
        real_lat = 26.8830
        real_lon = 81.0020
        real_city = "Takrohi, Indira Nagar, Lucknow"
        
        logger.info(f"✅ Real precise location configured: {real_city} ({real_lat}, {real_lon})")
        
        # Override the initial coordinates with real physical location
        self.route_waypoints.insert(0, {"name": f"Physical Location ({real_city})", "coords": (real_lat, real_lon)})
        self.route_waypoints.insert(1, {"name": f"Near {real_city} Hub", "coords": (real_lat + 0.005, real_lon + 0.005)})

        # Internal movement navigation tracking
        self.current_waypoint_idx = 0
        self.current_lat, self.current_lng = self.route_waypoints[0]["coords"]
        self.target_lat, self.target_lng = self.route_waypoints[1]["coords"]
        
        self.current_speed_kmh = self.nominal_speed_kmh
        self.current_heading_deg = 0.0
        self.emergency_halt_active = False
        
        self._compute_initial_heading()
        logger.info("🛰️ GPS Telemetry Simulation Engine mounted and ready.")

    def _compute_initial_heading(self) -> None:
        """Calculates compass heading azimuth vector toward active target waypoint."""
        lat1 = math.radians(self.current_lat)
        lng1 = math.radians(self.current_lng)
        lat2 = math.radians(self.target_lat)
        lng2 = math.radians(self.target_lng)
        
        d_lng = lng2 - lng1
        x = math.sin(d_lng) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1) * math.cos(lat2) * math.cos(d_lng))
        
        initial_bearing = math.atan2(x, y)
        heading = (math.degrees(initial_bearing) + 360) % 360
        self.current_heading_deg = round(heading, 1)

    def set_emergency_halt(self, halt: bool) -> None:
        """
        Safety interlock feature: Freezes vehicular navigation instantaneously when
        acoustic SOS keyword recognition or Level-1 distress override fires.
        """
        if self.emergency_halt_active == halt:
            return
        
        self.emergency_halt_active = halt
        if halt:
            self.current_speed_kmh = 0.0
            logger.critical("🛑 [EMERGENCY VEHICULAR HALT ENGAGED] Vehicle stopped at current coordinates. Telemetry locked.")
        else:
            self.current_speed_kmh = self.nominal_speed_kmh
            logger.info("🟢 [EMERGENCY HALT RELEASED] Transit navigation resuming nominal schedule.")

    def step(self) -> Dict[str, Any]:
        """
        Advances vehicular trajectory along transit corridor for one step interval.
        Returns unified telematics status dictionary.
        """
        if self.emergency_halt_active:
            # During emergency override, maintain frozen coordinates to guide incoming rescue reaction team
            return self.get_current_state()

        # Calculate vector displacement toward target waypoint
        d_lat = self.target_lat - self.current_lat
        d_lng = self.target_lng - self.current_lng
        euclidean_dist = math.sqrt(d_lat**2 + d_lng**2)

        # Step magnitude ~ 0.0006 coord units per interval (~60 meters)
        step_magnitude = 0.00065
        
        if euclidean_dist < step_magnitude:
            # Reached target landmark; advance to next consecutive municipal transit stop
            self.current_lat, self.current_lng = self.target_lat, self.target_lng
            self.current_waypoint_idx = (self.current_waypoint_idx + 1) % len(self.route_waypoints)
            next_idx = (self.current_waypoint_idx + 1) % len(self.route_waypoints)
            
            self.target_lat, self.target_lng = self.route_waypoints[next_idx]["coords"]
            self._compute_initial_heading()
            logger.debug(f"🚏 Vehicle arrived near waypoint: '{self.route_waypoints[self.current_waypoint_idx]['name']}'")
        else:
            # Interpolate position smoothly toward target waypoint
            fraction = step_magnitude / euclidean_dist
            self.current_lat += d_lat * fraction
            self.current_lng += d_lng * fraction
            self._compute_initial_heading()

        return self.get_current_state()

    def get_current_state(self) -> Dict[str, Any]:
        """Returns consolidated telematics payload formatted for cloud transmission and dashboard rendering."""
        nearby_landmark = self.route_waypoints[self.current_waypoint_idx]["name"]
        return {
            "latitude": round(self.current_lat, 6),
            "longitude": round(self.current_lng, 6),
            "speed_kmh": round(self.current_speed_kmh, 1),
            "heading_degrees": self.current_heading_deg,
            "current_stop_nearby": nearby_landmark,
            "emergency_halt_active": self.emergency_halt_active,
            "timestamp": int(time.time())
        }

    def start_continuous_tracking(self, push_callback, interval: float = 3.0) -> None:
        """
        Starts a continuous high-frequency background polling loop.
        Calls the provided push_callback with the current state every 'interval' seconds.
        """
        if hasattr(self, '_tracking_thread') and self._tracking_thread.is_alive():
            logger.info("Continuous tracking already active.")
            return

        self._stop_tracking = False

        def _tracking_loop():
            logger.info(f"🚀 Started {interval}-second continuous live tracking loop.")
            while not getattr(self, '_stop_tracking', False):
                state = self.get_current_state()
                try:
                    push_callback(state)
                except Exception as exc:
                    logger.error(f"Error in continuous tracking callback: {exc}")
                time.sleep(interval)

        self._tracking_thread = threading.Thread(target=_tracking_loop, daemon=True)
        self._tracking_thread.start()

    def stop_continuous_tracking(self) -> None:
        """Stops the continuous tracking loop."""
        self._stop_tracking = True
        if hasattr(self, '_tracking_thread'):
            self._tracking_thread.join(timeout=1.0)
        logger.info("🛑 Stopped continuous live tracking loop.")
