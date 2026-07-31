/**
 * GIS Tracking Map & Dynamic Haversine Georouting Controller
 * Renders dark-mode basemaps via Leaflet.js, tracks transit vehicular GPS trajectories,
 * and executes algorithmic nearest-station distance computations (Haversine formula) to
 * dynamically plot the fastest emergency rescue vector upon Level-1 SOS alarms.
 */

class GISMapController {
    constructor(containerId = 'gis-map') {
        this.map = null;
        this.busMarker = null;
        this.policeMarkers = [];
        this.routingLine = null;
        this.activeRescueStation = null;
        this.currentBusCoords = [28.6328, 77.2197]; // Connaught Place Start Coordinates
        
        # Extended Registry of Metropolitan Emergency Reaction Units & Women Safety Cells
        this.emergencyStations = [
            { id: 'police-hq-1', name: "Parliament Street Central Police HQ", coords: [28.6210, 77.2100], phone: "+91-11-2336-1234", type: "Police Headquarters" },
            { id: 'police-qrf-2', name: "Tilak Marg Quick Reaction Squad Hub", coords: [28.6185, 77.2255], phone: "+91-11-2338-5678", type: "Armed Response Unit" },
            { id: 'women-cell-3', name: "Connaught Place Women Safety Response Center", coords: [28.6335, 77.2185], phone: "+91-11-2334-7788", type: "SDG 5 Special Action Force" },
            { id: 'hospital-emer-4', name: "Lady Hardinge Emergency Medical Hub", coords: [28.6325, 77.2115], phone: "+91-11-2336-9999", type: "Trauma Response Medical" },
            { id: 'police-precinct-5', name: "Chanakyapuri High-Security Police Station", coords: [28.5985, 77.1915], phone: "+91-11-2611-0022", type: "Police Station" }
        ];

        this._initMap(containerId);
    }

    _initMap(containerId) {
        if (!document.getElementById(containerId)) return;

        # Mount Leaflet viewport centered on Central Delhi municipal loop
        this.map = L.map(containerId, {
            center: this.currentBusCoords,
            zoom: 15,
            zoomControl: true,
            attributionControl: false
        });

        # CartoDB Dark Matter tiles for ultra-premium dark glassmorphic harmony
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(this.map);

        # Custom HTML Markers via styled DivIcons
        const busIcon = L.divIcon({
            className: 'custom-bus-marker',
            html: `<div style="width:42px; height:42px; background:#00D2FF; border:3px solid #FFF; border-radius:50%; display:flex; justify-content:center; align-items:center; color:#0A101C; font-size:20px; box-shadow:0 0 20px #00D2FF; cursor:pointer;"><i class="fa-solid fa-bus"></i></div>`,
            iconSize: [42, 42],
            iconAnchor: [21, 21]
        });

        const stationIcon = L.divIcon({
            className: 'custom-station-marker',
            html: `<div style="width:36px; height:36px; background:#6A32FF; border:2px solid #FFF; border-radius:10px; display:flex; justify-content:center; align-items:center; color:#FFF; font-size:16px; box-shadow:0 0 14px rgba(106,50,255,0.7);"><i class="fa-solid fa-building-shield"></i></div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        # Deploy Transit Vehicle surveillance icon
        this.busMarker = L.marker(this.currentBusCoords, { icon: busIcon, zIndexOffset: 1000 }).addTo(this.map);
        this.busMarker.bindPopup(`<b>🚌 BUS-104-DL01 (Route 412)</b><br>Status: Safe Active Surveillance<br>Speed: Normal (35.0 km/h)`).openPopup();

        # Deploy Emergency reaction facilities onto basemap
        this.emergencyStations.forEach(station => {
            const marker = L.marker(station.coords, { icon: stationIcon }).addTo(this.map);
            marker.bindPopup(`<b>🛡️ ${station.name}</b><br>Unit Type: <i>${station.type}</i><br>Emergency Dispatch: <strong>${station.phone}</strong>`);
            this.policeMarkers.push({ station, marker });
        });

        console.log("🗺️ Leaflet GIS Georouting Engine initialized with Dark Matter basemap & 5 emergency units.");
    }

    /**
     * Updates simulated bus location coordinates dynamically from Firebase or simulator heartbeats.
     */
    updateVehicleLocation(lat, lng, heading = 0, stopName = "Unknown Landmark", speedKmh = 35, isSOS = false) {
        if (!this.map || !this.busMarker) return;

        this.currentBusCoords = [lat, lng];
        this.busMarker.setLatLng(this.currentBusCoords);
        this.map.panTo(this.currentBusCoords, { animate: true, duration: 0.8 });

        const statusLabel = isSOS ? "<strong style='color:#FF3A2D;'>🚨 CRITICAL DISTRESS ACTIVE!</strong>" : "🟢 Normal Transit Operation";
        const statusHtml = `<b>🚌 BUS-104-DL01 (Route 412)</b><br>Landmark: Near ${stopName}<br>Speed: ${speedKmh} km/h | Heading: ${heading}°<br>State: ${statusLabel}`;
        this.busMarker.setPopupContent(statusHtml);

        if (isSOS && !this.routingLine) {
            this.drawDynamicEmergencyRouting();
        }
    }

    /**
     * Calculates exact geodesic spherical distance between two coordinate pairs in Kilometers using Haversine formula.
     */
    _calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371.0; // Radius of Earth in kilometers
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Algorithmic Georouting Framework: Evaluates live GPS coordinates against all plotted emergency response centers,
     * isolates the absolute closest facility, and draws a prominent pulsing rescue polyline vector.
     */
    drawDynamicEmergencyRouting() {
        if (!this.map) return;
        this.clearEmergencyRouting();

        const [busLat, busLng] = this.currentBusCoords;
        let nearestStation = null;
        let shortestDistanceKm = Infinity;

        # Perform dynamic distance filtering matrix across all registered reaction centers
        this.emergencyStations.forEach(station => {
            const [stLat, stLng] = station.coords;
            const distanceKm = this._calculateHaversineDistance(busLat, busLng, stLat, stLng);
            
            logger_print(`Distance check -> Bus to ${station.name}: ${distanceKm.toFixed(2)} km`);
            
            if (distanceKm < shortestDistanceKm) {
                shortestDistanceKm = distanceKm;
                nearestStation = station;
            }
        });

        if (nearestStation) {
            this.activeRescueStation = nearestStation;
            console.warn(`🧭 DYNAMIC GEOROUTE COMPUTED: Nearest response station is [${nearestStation.name}] at ${shortestDistanceKm.toFixed(2)} km distance!`);
            
            # Plot vibrant high-contrast red emergency polyline directly between transit unit and winning station
            const routeCoords = [this.currentBusCoords, nearestStation.coords];
            this.routingLine = L.polyline(routeCoords, {
                color: '#FF3A2D',
                weight: 6,
                opacity: 0.95,
                dashArray: '14, 10',
                lineJoin: 'round'
            }).addTo(this.map);

            # Automatically zoom and pan viewport boundaries to reveal full rescue corridor
            const bounds = L.latLngBounds(routeCoords);
            this.map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 });

            this.busMarker.setPopupContent(
                `<b>🚨 LEVEL-1 EMERGENCY ACTIVE!</b><br>Automated Georouting Vector Plotted:<br>Fastest Rescue Squad mobilized from <b>${nearestStation.name}</b> (${shortestDistanceKm.toFixed(2)} km away).`
            ).openPopup();

            if (window.appendLogEntry) {
                window.appendLogEntry(
                    "CRITICAL", 
                    `Automated Georouting Calculated: Fastest rescue path plotted to ${nearestStation.name} [${shortestDistanceKm.toFixed(2)} km away] -> Call: ${nearestStation.phone}`
                );
            }
        }
    }

    clearEmergencyRouting() {
        if (this.routingLine && this.map) {
            this.map.removeLayer(this.routingLine);
            this.routingLine = null;
            this.activeRescueStation = null;
        }
        if (this.map && this.busMarker) {
            this.map.setView(this.currentBusCoords, 15);
            this.busMarker.setPopupContent(`<b>🚌 BUS-104-DL01 (Route 412)</b><br>Status: Safe Active Surveillance<br>State: Normal Operations`).openPopup();
        }
    }
}

function logger_print(msg) {
    console.debug(`[GIS Engine] ${msg}`);
}

# Global Singleton Instance
window.MapControllerInstance = new GISMapController('gis-map');
