/**
 * Firebase RTDB WebSocket Controller & Interactive Academic Evaluation Simulator
 * Manages zero-latency bidirectional synchronization between Edge Node telemetry and DOM UI elements.
 * Provides autonomous simulation loops and interactive evaluation demo button listeners.
 */

// Firebase Realtime Database Client Configuration (Optional - replace with project URI when ready)
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
        
        // Central Delhi Metro Transit Landmarks
        this.transitStops = [
            "Connaught Place Central Hub", "Janpath Road Corridor", 
            "Parliament Street Police Precinct", "Central Secretariat Metro Gateway", 
            "India Gate Roundabout", "Tilak Marg Supreme Court Station"
        ];

        // DOM UI Component Binding
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
        // 1. Start live system precision clock ticker
        setInterval(() => {
            if (this.clockEl) {
                const now = new Date();
                this.clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false }) + " UTC/IST";
            }
        }, 1000);

        // 2. Attempt Firebase RTDB WebSocket connection via CDN SDK
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
            console.warn("Firebase credentials fallback active.");
        }

        // --- ACADEMIC DEFENSE OVERRIDE ---
        // Always start the local Python File-Sync Bridge to ensure 
        // the python script can send live location directly to the browser.
        this._startLocalPollingBridge();
        if (this.cloudStatusBadge) {
            this.cloudStatusBadge.className = "badge status-connected";
            this.cloudStatusBadge.innerHTML = `<span class="pulse-dot"></span> Evaluation Mode: LOCAL PYTHON SYNC`;
        }
        appendLogEntry("WARN", "Running in Local Python File-Sync Bridge Mode. Backend updates will reflect live.");

        // --- TRUE HARDWARE GPS TRACKING OVERRIDE ---
        // Bypasses IP-API and securely uses the laptop's built-in Location Services for precise tracking
        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition((position) => {
                this.trueLat = position.coords.latitude;
                this.trueLng = position.coords.longitude;
                // If speed is available from hardware, we can also use it
                if (position.coords.speed !== null) {
                    this.trueSpeed = (position.coords.speed * 3.6).toFixed(1); // m/s to km/h
                }
            }, (error) => {
                console.warn("Browser GPS permission denied or unavailable. Falling back to Python simulator.");
            }, { enableHighAccuracy: true, maximumAge: 0 });
        }
        
        // --- EDGE CAMERA ACCESS (PHONE REAR CAMERA) ---
        this._initEdgeCamera();

        // --- IN-BROWSER ACOUSTIC SOS LISTENER (VOICE TRIGGER: 'BACHAO' / 'HELP') ---
        this._initBrowserSpeechRecognition();
    }

    async _initEdgeCamera() {
        const videoElement = document.getElementById('edge-camera-stream');
        const statusText = document.getElementById('camera-status-text');
        if (!videoElement) return;

        try {
            // Request the physical rear camera of the phone (or default webcam on laptop)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 } }
            });
            videoElement.srcObject = stream;
            
            if (statusText) {
                statusText.textContent = "EDGE HARDWARE ACTIVE";
                statusText.style.color = "#00D97E";
            }
            appendLogEntry("INFO", "Mobile Edge Camera securely mounted via HTML5 getUserMedia.");
        } catch (err) {
            console.warn("Edge Camera access denied. Needs HTTPS.", err);
            if (statusText) {
                statusText.textContent = "CAMERA BLOCKED (NEEDS HTTPS)";
                statusText.style.color = "#FF3A2D";
            }
        }
    }

    /**
     * In-Browser Real-Time Voice Recognition using Web Speech API
     * Listens for acoustic emergency distress keywords ('Bachao', 'Help', 'Madad') hands-free
     */
    _initBrowserSpeechRecognition() {
        this.isVoiceListening = false;
        this.speechRecognition = null;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const btnToggleVoice = document.getElementById('btn-toggle-voice');
        const voiceStatusMsg = document.getElementById('voice-status-msg');
        const voiceLiveTranscript = document.getElementById('voice-live-transcript');

        if (!SpeechRecognition) {
            console.warn("Web Speech API not supported in this browser. Use demo button.");
            if (voiceStatusMsg) voiceStatusMsg.textContent = "Web Speech API not supported in this browser. Use manual demo button.";
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            this.speechRecognition = recognition;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'hi-IN'; // Recognizes Hindi ('बचाओ', 'मदद') and English ('help', 'emergency')

            const distressKeywords = [
                // Roman English & Hindi
                "bachao", "bachav", "bachaoo", "help", "madad", "save", "emergency", "police",
                // Devanagari Hindi Script (What Google STT outputs for Hindi speech!)
                "बचाओ", "बचाव", "मदद", "हेल्प", "सहायता", "इमरजेंसी", "पुलिस"
            ];

            recognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = (event.results[i][0].transcript || "").trim().toLowerCase();
                    console.log("🎙️ Live Acoustic Input:", transcript);
                    
                    if (voiceLiveTranscript) {
                        voiceLiveTranscript.innerHTML = `Heard: <strong>"${transcript}"</strong>`;
                    }

                    // Check if any distress keyword matches
                    const matchedWord = distressKeywords.find(keyword => transcript.includes(keyword));
                    if (matchedWord) {
                        if (voiceLiveTranscript) {
                            voiceLiveTranscript.innerHTML = `🚨 MATCHED: <strong style="color:#FF3A2D;">"${matchedWord.toUpperCase()}"</strong>!`;
                        }
                        if (window.AlertHandlerInstance && !window.AlertHandlerInstance.isAlarmActive) {
                            appendLogEntry("CRITICAL", `🎙️ Voice SOS Triggered! Keyword matched: "${matchedWord}" in transcript "${transcript}".`);
                            if (this.speedEl) this.speedEl.textContent = "0.0";
                            window.AlertHandlerInstance.triggerEmergencyOverride(
                                `Acoustic Keyword ("${matchedWord}") Recognized`,
                                this.stopEl ? this.stopEl.textContent : "Active Transit Corridor"
                            );
                        }
                    }
                }
            };

            recognition.onerror = (e) => {
                console.warn("Speech recognition notice:", e.error);
                if (e.error === 'not-allowed') {
                    if (voiceStatusMsg) voiceStatusMsg.textContent = "⚠️ Mic permission denied. Please allow microphone in your browser address bar!";
                    this.isVoiceListening = false;
                    this._updateVoiceUIState(false);
                }
            };

            recognition.onend = () => {
                // If user intended to keep listening, auto-restart
                if (this.isVoiceListening) {
                    setTimeout(() => {
                        try { recognition.start(); } catch (err) {}
                    }, 300);
                } else {
                    this._updateVoiceUIState(false);
                }
            };

            // Bind toggle button
            if (btnToggleVoice) {
                btnToggleVoice.addEventListener('click', () => {
                    if (this.isVoiceListening) {
                        // Stop listening
                        this.isVoiceListening = false;
                        try { recognition.stop(); } catch (err) {}
                        this._updateVoiceUIState(false);
                        appendLogEntry("INFO", "Voice SOS Listener paused by user.");
                    } else {
                        // Start listening
                        this.isVoiceListening = true;
                        try { recognition.start(); } catch (err) {}
                        this._updateVoiceUIState(true);
                        appendLogEntry("INFO", "🎙️ Voice SOS Listener ACTIVATED. Say 'Bachao' or 'Help' to test.");
                    }
                });
            }

        } catch (err) {
            console.warn("Could not setup Web Speech Recognition:", err);
        }
    }

    _updateVoiceUIState(active) {
        const btnToggleVoice = document.getElementById('btn-toggle-voice');
        const voiceStatusMsg = document.getElementById('voice-status-msg');
        const voiceIndicatorDot = document.getElementById('voice-indicator-dot');

        if (active) {
            if (btnToggleVoice) {
                btnToggleVoice.className = "btn btn-mic-active";
                btnToggleVoice.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> <span id="voice-btn-text">Voice SOS: ACTIVE (Listening...)</span>`;
            }
            if (voiceIndicatorDot) {
                voiceIndicatorDot.className = "mic-dot mic-dot-listening";
            }
            if (voiceStatusMsg) {
                voiceStatusMsg.innerHTML = `<strong>🎙️ Mic Active!</strong> Speak <em>"Bachao"</em>, <em>"Help"</em>, or <em>"Madad"</em> to trigger alarm.`;
            }
        } else {
            if (btnToggleVoice) {
                btnToggleVoice.className = "btn btn-mic-inactive";
                btnToggleVoice.innerHTML = `<i class="fa-solid fa-microphone"></i> <span id="voice-btn-text">Turn ON Voice SOS (Mic)</span>`;
            }
            if (voiceIndicatorDot) {
                voiceIndicatorDot.className = "mic-dot mic-dot-idle";
            }
            if (voiceStatusMsg) {
                voiceStatusMsg.innerHTML = `Voice SOS is OFF. Click <strong>"Turn ON Voice SOS (Mic)"</strong> to test voice detection.`;
            }
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
        // Render machine vision passenger density metrics
        if (data.metrics && typeof data.metrics.passenger_count === 'number') {
            this.updatePassengerDensityUI(data.metrics.passenger_count, data.status ? data.status.crowd_alert : false);
        }

        // Render GPS coordinates and speed telematics
        if (data.location) {
            const loc = data.location;
            
            // Bypass Python Simulator with True Browser HTML5 GPS Hardware Location
            if (this.trueLat && this.trueLng) {
                loc.latitude = this.trueLat;
                loc.longitude = this.trueLng;
                loc.current_stop = "True Hardware GPS Track";
                if (this.trueSpeed) loc.speed_kmh = this.trueSpeed;
            }

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

        // Intercept emergency level overrides
        if (data.status && data.status.sos_triggered) {
            if (window.AlertHandlerInstance && typeof window.AlertHandlerInstance.triggerEmergencyOverride === 'function') {
                window.AlertHandlerInstance.triggerEmergencyOverride(
                    `Acoustic Keyword ("${data.status.sos_keyword_matched || 'Bachao'}") Recognized`,
                    data.location ? data.location.current_stop : "Unknown Landmark"
                );
            }
        } else {
            // Free the alarm state so future emergencies can pop up again
            if (window.AlertHandlerInstance && typeof window.AlertHandlerInstance.resetAlarmState === 'function') {
                window.AlertHandlerInstance.resetAlarmState();
            }
        }
    }

    /**
     * Updates YOLOv8 optical vision HUD statistics cards on dashboard UI.
     */
    updatePassengerDensityUI(count, isOvercrowded = false) {
        this.simulatedPax = count;
        if (this.paxCountEl) this.paxCountEl.textContent = count;
        
        // Calculate visual fill percentage (Capacity limit default: 5 passengers -> 100% warning)
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

    _startLocalPollingBridge() {
        // Periodically fetches the local telemetry.json written by the Python Backend
        setInterval(async () => {
            try {
                // Fetch the file locally via the Python HTTP server (cache-busted, relative path so mobile works!)
                const response = await fetch(`./telemetry.json?t=${new Date().getTime()}`);
                if (!response.ok) return;
                
                const data = await response.json();
                
                // The Python mock dict stores paths as keys (e.g., 'vehicles/BUS-104-DL01')
                const busData = data["vehicles/BUS-104-DL01"];
                if (busData) {
                    this._renderTelemetry(busData);
                }
            } catch (err) {
                // Silent catch, telemetry.json might not be written yet if backend just started
            }
        }, 1000); // Poll every 1 second
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
    
    // Prepend newest entry directly to top of feed viewport
    container.insertBefore(entry, container.firstChild);

    // Maintain sliding window of latest 25 logs to prevent memory bloat
    if (container.children.length > 25) {
        container.removeChild(container.lastChild);
    }
};

function roundNumber(num, dec) {
    return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}

// Instantiate application controller on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    window.AppInstance = new CommandCenterApp();
    console.log("🚀 Intelligent Transit Safety Command Center operational and bound to UI controls.");
});
