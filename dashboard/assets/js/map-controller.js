/**
 * GIS Tracking Map & Emergency Georouting Controller using Leaflet.js
 * Renders dark-mode basemap, live transit vehicle marker tracking, pre-mapped emergency response HQ,
 * and automated shortest-distance polyline routing upon Level-1 Critical SOS alerts.
 */

class GISMapController {
    constructor(containerId = 'gis-map') {
        this.map = null;
        this.busMarker = null;
        this.policeMarkers = [];
        this.routingLine = null;
        this.currentBusCoords = [28.6152, 77.2110]; // Default start position
        
        // Mapped Metropolitan Emergency Reaction Stations
        this.emergencyStations = [
            { id: 'police-1', name: "Parliament Street Central Police HQ", coords: [28.6210, 77.2100], phone: "+91-11-2336-1234" },
            { id: 'police-2', name: "Tilak Marg Quick Reaction Squad Hub", coords: [28.6185, 77.2255], phone: "+91-11-2338-5678" },
            { id: 'hospital-1', name: "Lady Hardinge Emergency Medical Center", coords: [28.6325, 77.2115], phone: "+91-11-2336-9999" }
        ];

        this._initMap(containerId);
    }

    _initMap(containerId) {
        if (!document.getElementById(containerId)) return;

        // Initialize Leaflet map instance
        this.map = L.map(containerId, {
            center: this.currentBusCoords,
            zoom: 15,
            zoomControl: true,
            attributionControl: false
        });

        // CartoDB Dark Matter Tile Layer for harmonious dark mode aesthetics
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(this.map);

        // Custom styling icons using CSS classes
        const busIcon = L.divIcon({
            className: 'custom-bus-marker',
            html: `<div style="width:38px; height:38px; background:#00D2FF; border:2px solid #FFF; border-radius:50%; display:flex; justify-content:center; align-items:center; color:#0A101C; font-size:18px; box-shadow:0 0 16px #00D2FF; transform:rotate(0deg);"><i class="fa-solid fa-bus"></i></div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });

        const policeIcon = L.divIcon({
            className: 'custom-police-marker',
            html: `<div style="width:34px; height:34px; background:#6A32FF; border:2px solid #FFF; border-radius:8px; display:flex; justify-content:center; align-items:center; color:#FFF; font-size:16px; box-shadow:0 0 12px #6A32FF;"><i class="fa-solid fa-building-shield"></i></div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        // Add vehicle marker to map
        this.busMarker = L.marker(this.currentBusCoords, { icon: busIcon, zIndexOffset: 100 }).addTo(this.map);
        this.busMarker.bindPopup(`<b>🚌 BUS-104-DL01</b><br>Status: Active Surveillance<br>Speed: Normal`).openPopup();

        // Add pre-mapped emergency response units to map
        this.emergencyStations.forEach(station => {
            const marker = L.marker(station.coords, { icon: policeIcon }).addTo(this.map);
            marker.bindPopup(`<b>🚓 ${station.name}</b><br>Contact: ${station.phone}<br>Status: Standby Reaction Unit`);
            this.policeMarkers.push({ station, marker });
        });

        console.log("🗺️ Leaflet GIS Telemetry Engine mounted successfully with Dark Matter basemap.");
    }

    /**
     * Updates simulated bus location coordinates dynamically.
     */
    updateVehicleLocation(lat, lng, heading = 0, stopName = "Unknown Landmark", speedKmh = 35) {
        if (!this.map || !this.busMarker) return;

        this.currentBusCoords = [lat, lng];
        this.busMarker.setLatLng(this.currentBusCoords);
        this.map.panTo(this.currentBusCoords, { animate: true, duration: 0.8 });

        const statusHtml = `<b>🚌 BUS-104-DL01</b><br>Stop: Near ${stopName}<br>Speed: ${speedKmh} km/h<br>Heading: ${heading}°`;
        this.busMarker.setPopupContent(statusHtml);
    }

    /**
     * Finds nearest mapped emergency station using Euclidean geometric metric and draws automated rescue path.
     */
    drawEmergencyRouting() {
        if (!this.map) return;
        this.clearEmergencyRouting();

        const [busLat, busLng] = this.currentBusCoords;
        let nearestStation = null;
        let shortestDist = Infinity;

        // Calculate minimum geometric vector distance to available stations
        this.emergencyStations.forEach(station => {
            const [stLat, stLng] = station.coords;
            const dist = Math.sqrt(Math.pow(stLat - busLat, 2) + Math.pow(stLng - busLng, 2));
            if (dist < shortestDist) {
                shortestDist = dist;
                nearestStation = station;
            }
        });

        if (nearestStation) {
            console.log(`🧭 Nearest Rescue Headquarters computed: ${nearestStation.name}`);
            
            // Draw high-contrast red emergency polyline directly between transit unit and reaction station
            const routeCoords = [this.currentBusCoords, nearestStation.coords];
            this.routingLine = L.polyline(routeCoords, {
                color: '#FF3A2D',
                weight: 5,
                opacity: 0.9,
                dashArray: '12, 12',
                lineJoin: 'round'
            }).addTo(this.map);

            // Fit viewport boundaries to encompass both the bus and the rescue center
            const bounds = L.latLngBounds(routeCoords);
            this.map.fitBounds(bounds, { padding: [80, 80] });

            this.busMarker.setPopupContent(
                `<b>🚨 SOS CRITICAL STATE ACTIVE!</b><br>Automated Route Vector: Rescue unit dispatched from <b>${nearestStation.name}</b>.`
            ).openPopup();

            if (window.appendLogEntry) {
                window.appendLogEntry("INFO", `Automated Georouting: Path plotted from Bus to ${nearestStation.name} (${nearestStation.phone}).`);
            }
        }
    }

    clearEmergencyRouting() {
        if (this.routingLine && this.map) {
            this.map.removeLayer(this.routingLine);
            this.routingLine = null;
        }
        if (this.map) {
            this.map.setView(this.currentBusCoords, 15);
        }
    }
}

// Global Singleton Instance
window.MapControllerInstance = new GISMapController('gis-map');
