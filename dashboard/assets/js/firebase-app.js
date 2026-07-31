/**
 * Firebase RTDB WebSocket Controller & Interactive Academic Evaluation Simulator
 * Manages zero-latency bidirectional synchronization between Edge Node telemetry and DOM UI elements.
 * Provides autonomous simulation loops and interactive evaluation demo button listeners.
 */

# Firebase Realtime Database Client Configuration (Optional - replace with project URI when ready)
const FIREBASE_CONFIG = {
    databaseURL: "https://transport-safety-ai-default-rtdb.firebaseio.com/"
};

class CommandCenterApp {
    constructor() {
        this.db = null;
        this.isConnected = false;
        this.simulatedPax = 2;
        this.simulatedSpeed = 35.0;
        this.simulatedHeading = 124;
        this.currentLandmarkIndex = 0;
        
        # Central Delhi Metro Transit Landmarks
        this.transitStops = [
            "Connaught Place Central Hub", "Janpath Road Corridor", 
            "Parliament Street Police Precinct", "Central Secretariat Metro Gateway", 
            "India Gate Roundabout", "Tilak Marg Supreme Court Station"
        ];

        # DOM UI Component Binding
        this.clockEl = document.getElementById('live-system-clock');
        this.cloudStatusBadge = document.getElementById('cloud-connection-status');
        this.paxCountEl = document.getElementById('telemetry-pax');
        this.paxRingEl = document.getElementById('pax-indicator-ring');
        this.paxProgressBar = document.getElementById('pax-progress-bar');
        this.paxStatusTitle = document.getElementById('pax-status-title');
        this.paxStatusDesc = document.getElementById('pax-status-desc');
        
        this.speedEl = document.getElementById('telemetry-speed');
        this.headingEl = document.getElementById('telemetry-heading');
        this.stopEl = document.getElementById('telemetry-stop');
        this.coordsEl = document.getElementById('telemetry-coords');
        this.logsViewport = document.getElementById('dispatch-logs-container');

        this._initSystem();
        this._bindDemoControls();
    }

    _initSystem() {
        # 1. Start live system precision clock ticker
        setInterval(() => {
            if (this.clockEl) {
                const now = new Date();
                this.clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false }) + " UTC/IST";
            }
        }, 1000);

        # 2. Attempt Firebase RTDB WebSocket connection via CDN SDK
        try {
            if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                firebase.initializeApp(FIREBASE_CONFIG);
                this.db = firebase.database();
                this._subscribeToTelemetry();
                this.isConnected = true;
                if (this.cloudStatusBadge) {
                    this.cloudStatusBadge.className = "badge status-connected";
                    this.cloudStatusBadge.innerHTML = `<span class="pulse-dot"></span> Cloud WebSocket: CONNECTED`;
                }
                appendLogEntry("INFO", "WebSocket synchronization established with Google Cloud Firebase RTDB.");
            } else {
                throw new Error("Firebase SDK script untracked.");
            }
        } catch (err) {
            console.warn("Firebase credentials fallback active. Launching autonomous demo simulator for presentation evaluation.");
            if (this.cloudStatusBadge) {
                this.cloudStatusBadge.className = "badge status-connected";
                this.cloudStatusBadge.innerHTML = `<span class="pulse-dot"></span> Evaluation Mode: LIVE SIMULATOR`;
            }
            this._startAutonomousSimulator();
            appendLogEntry("WARN", "Running in local Academic Evaluation Simulation Mode. Interactive GUI triggers fully enabled.");
        }
    }

    _subscribeToTelemetry() {
        if (!this.db) return;
        const busRef = this.db.ref("vehicles/BUS-104-DL01");
        
        busRef.on("value", (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this._renderTelemetry(data);
            }
        }, (errorObject) => {
            console.error("Firebase read failure:", errorObject.code);
            this._startAutonomousSimulator();
        });
    }

    _renderTelemetry(data) {
        # Render machine vision passenger density metrics
        if (data.metrics && typeof data.metrics.passenger_count === 'number') {
            this.updatePassengerDensityUI(data.metrics.passenger_count, data.status ? data.status.crowd_alert : false);
        }

        # Render GPS coordinates and speed telematics
        if (data.location) {
            const loc = data.location;
            if (this.speedEl) this.speedEl.textContent = Number(loc.speed_kmh || 0).toFixed(1);
            if (this.headingEl) this.headingEl.textContent = `${loc.heading || 0}°`;
            if (this.stopEl) this.stopEl.textContent = loc.current_stop || "In Transit";
            if (this.coordsEl) this.coordsEl.textContent = `Lat: ${Number(loc.latitude).toFixed(6)} | Lng: ${Number(loc.longitude).toFixed(6)}`;
            
            if (window.MapControllerInstance && typeof window.MapControllerInstance.updateVehicleLocation === 'function') {
                window.MapControllerInstance.updateVehicleLocation(
                    loc.latitude, loc.longitude, loc.heading, loc.current_stop, loc.speed_kmh, data.status ? data.status.sos_triggered : false
                );
            }
        }

        # Intercept emergency level overrides
        if (data.status && data.status.sos_triggered) {
            if (window.AlertHandlerInstance && typeof window.AlertHandlerInstance.triggerEmergencyOverride === 'function') {
                window.AlertHandlerInstance.triggerEmergencyOverride(
                    `Acoustic Keyword ("${data.status.sos_keyword_matched || 'Bachao'}") Recognized`,
                    data.location ? data.location.current_stop : "Unknown Landmark"
                );
            }
        }
    }

    /**
     * Updates YOLOv8 optical vision HUD statistics cards on dashboard UI.
     */
    updatePassengerDensityUI(count, isOvercrowded = false) {
        this.simulatedPax = count;
        if (this.paxCountEl) this.paxCountEl.textContent = count;
        
        # Calculate visual fill percentage (Capacity limit default: 5 passengers -> 100% warning)
        const pct = Math.min(100, Math.max(10, (count / 5) * 60));

        if (count > 5 || isOvercrowded) {
            if (this.paxRingEl) this.paxRingEl.className = "pax-circle ring-warning";
            if (this.paxProgressBar) {
                this.paxProgressBar.className = "progress-fill progress-warning";
                this.paxProgressBar.style.width = "95%";
            }
            if (this.paxStatusTitle) {
                this.paxStatusTitle.textContent = "OVERCROWDED - LEVEL 2 WARNING";
                this.paxStatusTitle.className = "text-warning";
            }
            if (this.paxStatusDesc) {
                this.paxStatusDesc.textContent = `Cabin occupancy density (${count} persons) exceeded safe threshold limit (5). Suffocation & security hazard alert broadcasted.`;
            }
        } else {
            if (this.paxRingEl) this.paxRingEl.className = "pax-circle";
            if (this.paxProgressBar) {
                this.paxProgressBar.className = "progress-fill progress-safe";
                this.paxProgressBar.style.width = `${pct}%`;
            }
            if (this.paxStatusTitle) {
                this.paxStatusTitle.textContent = "SAFE OPERATING LOAD";
                this.paxStatusTitle.className = "text-safe";
            }
            if (this.paxStatusDesc) {
                this.paxStatusDesc.textContent = `Cabin occupancy within normal geometric ventilation and security margins (< 5 passengers).`;
            }
        }
    }

    _startAutonomousSimulator() {
        # Periodically simulates smooth transit navigation along Central Delhi loop
        setInterval(() => {
            if (window.AlertHandlerInstance && window.AlertHandlerInstance.isAlarmActive) {
                # During Level-1 emergency, freeze vehicle speed completely to 0.0 km/h
                if (this.speedEl) this.speedEl.textContent = "0.0";
                return;
            }

            this.simulatedSpeed = roundNumber(32.0 + Math.random() * 8.0, 1);
            if (this.speedEl) this.speedEl.textContent = this.simulatedSpeed.toFixed(1);
        }, 3000);
    }

    _bindDemoControls() {
        const btnSOS = document.getElementById('btn-simulate-sos');
        const btnCrowd = document.getElementById('btn-simulate-crowd');
        const btnReset = document.getElementById('btn-reset-normal');

        if (btnSOS) {
            btnSOS.addEventListener('click', () => {
                appendLogEntry("CRITICAL", "Demo Override: Simulated passenger screaming distress keyword ('Bachao!') in cabin.");
                if (this.speedEl) this.speedEl.textContent = "0.0";
                if (window.AlertHandlerInstance) {
                    window.AlertHandlerInstance.triggerEmergencyOverride("Acoustic Keyword ('Bachao!') Spoken", this.transitStops[this.currentLandmarkIndex]);
                }
            });
        }

        if (btnCrowd) {
            btnCrowd.addEventListener('click', () => {
                const testPax = 9;
                appendLogEntry("WARN", `Demo Override: Overcrowding anomaly simulated (${testPax} passengers > 5 safe limit).`);
                this.updatePassengerDensityUI(testPax, true);
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => {
                appendLogEntry("INFO", "Demo Override: Resetting system to normal safe surveillance mode.");
                this.updatePassengerDensityUI(2, false);
                if (this.speedEl) this.speedEl.textContent = "35.0";
                if (window.AlertHandlerInstance) {
                    window.AlertHandlerInstance.acknowledgeAlarm();
                }
            });
        }
    }
}

/**
 * Global helper function to dynamically render chronological audit log bulletins on dashboard.
 * @param {string} level - Log priority rating (INFO, WARN, CRITICAL)
 * @param {string} message - Description of security event or state transition
 */
window.appendLogEntry = function(level = "INFO", message = "") {
    const container = document.getElementById('dispatch-logs-container');
    if (!container) return;

    const entry = document.createElement('div');
    const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    let levelClass = "log-info";
    if (level.toUpperCase() === "WARN") levelClass = "log-warn";
    if (level.toUpperCase() === "CRITICAL") levelClass = "log-critical";

    entry.className = `log-entry ${levelClass}`;
    entry.innerHTML = `<span class="log-time">[${nowStr}]</span> <span class="log-msg">${message}</span>`;
    
    # Prepend newest entry directly to top of feed viewport
    container.insertBefore(entry, container.firstChild);

    # Maintain sliding window of latest 25 logs to prevent memory bloat
    if (container.children.length > 25) {
        container.removeChild(container.lastChild);
    }
};

function roundNumber(num, dec) {
    return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}

# Instantiate application controller on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    window.AppInstance = new CommandCenterApp();
    console.log("🚀 Intelligent Transit Safety Command Center operational and bound to UI controls.");
});
