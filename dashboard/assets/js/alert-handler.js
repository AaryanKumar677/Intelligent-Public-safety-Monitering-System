/**
 * Alert Handler & Web Audio API Emergency Siren Synthesizer
 * Generates a clean, authentic vehicle emergency wail siren via Web Audio API.
 * Guarantees zero audio leakage, strict single-instance playback, and instant silence on acknowledgment.
 */

class EmergencyAlertController {
    constructor() {
        this.isAlarmActive = false;
        this.isMuted = false;
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.sirenSweepInterval = null;
        this.vibrationInterval = null;
        
        // DOM Elements
        this.strobeOverlay = document.getElementById('strobe-overlay');
        this.modal = document.getElementById('emergency-modal');
        this.incidentSpan = document.getElementById('modal-incident-type');
        this.locationSpan = document.getElementById('modal-location');
        this.notifStatusSpan = document.getElementById('modal-notif-status');
        this.ackButton = document.getElementById('btn-acknowledge-alert');

        this._bindEvents();
    }

    _bindEvents() {
        if (this.ackButton) {
            this.ackButton.addEventListener('click', () => this.acknowledgeAlarm());
        }
    }

    _initAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
            
            // Resume audio context on user interaction
            document.addEventListener('click', () => {
                if (this.audioCtx && this.audioCtx.state === 'suspended' && this.isAlarmActive) {
                    this.audioCtx.resume();
                }
            }, { once: false });
        }
        
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
    }

    /**
     * Starts a clean, single-channel vehicle emergency wail siren.
     * Sweeps smoothly between 650 Hz and 960 Hz without clashing dual tones.
     */
    startEBSSirenLoop() {
        try {
            // 1. Terminate any previous audio nodes first (prevents overlapping ghost sirens)
            this.stopEBSSirenLoop();

            this._initAudioContext();
            if (!this.audioCtx) return;
            
            // 2. Create master gain controller
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.setValueAtTime(0.20, this.audioCtx.currentTime);
            this.gainNode.connect(this.audioCtx.destination);

            // 3. Single smooth oscillator (triangle wave produces an authentic police/ambulance wail)
            this.oscillator = this.audioCtx.createOscillator();
            this.oscillator.type = 'triangle';
            this.oscillator.frequency.setValueAtTime(680, this.audioCtx.currentTime);
            this.oscillator.connect(this.gainNode);
            this.oscillator.start();

            // 4. Smooth frequency sweep (alternating high and low pitch)
            let pitchUp = true;
            this.sirenSweepInterval = setInterval(() => {
                if (!this.oscillator || !this.audioCtx || this.audioCtx.state !== 'running') return;
                
                const targetFreq = pitchUp ? 960 : 640;
                try {
                    this.oscillator.frequency.exponentialRampToValueAtTime(targetFreq, this.audioCtx.currentTime + 0.45);
                } catch (e) {
                    this.oscillator.frequency.setValueAtTime(targetFreq, this.audioCtx.currentTime);
                }
                pitchUp = !pitchUp;
            }, 500);

            console.log("🔊 Emergency Acoustic Siren Activated (Clean Single-Tone Sweep).");

            // Hardware vibration for mobile devices
            if ("vibrate" in navigator) {
                navigator.vibrate([600, 200, 600, 200, 600]);
                this.vibrationInterval = setInterval(() => {
                    if (this.isAlarmActive && "vibrate" in navigator) {
                        navigator.vibrate([600, 200, 600, 200, 600]);
                    }
                }, 3500);
            }

        } catch (err) {
            console.warn("Browser audio autoplay blocked automatic siren:", err);
        }
    }

    /**
     * Fully stops and completely silences all oscillators and audio context immediately.
     */
    stopEBSSirenLoop() {
        // Clear sweep timers
        if (this.sirenSweepInterval) {
            clearInterval(this.sirenSweepInterval);
            this.sirenSweepInterval = null;
        }
        if (this.vibrationInterval) {
            clearInterval(this.vibrationInterval);
            this.vibrationInterval = null;
        }
        if ("vibrate" in navigator) {
            navigator.vibrate(0);
        }

        // Instantly mute and disconnect gain node
        if (this.gainNode && this.audioCtx) {
            try {
                this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
                this.gainNode.disconnect();
            } catch (e) {}
            this.gainNode = null;
        }

        // Stop and disconnect oscillator
        if (this.oscillator) {
            try {
                this.oscillator.stop();
                this.oscillator.disconnect();
            } catch (e) {}
            this.oscillator = null;
        }

        // Suspend the AudioContext completely to ensure ZERO audio hardware leakage
        if (this.audioCtx && this.audioCtx.state === 'running') {
            try {
                this.audioCtx.suspend();
            } catch (e) {}
        }

        console.log("🔇 Emergency siren completely silenced.");
    }

    /**
     * Triggers Level-1 Critical Emergency override sequence across UI and audio speakers.
     */
    triggerEmergencyOverride(triggerReason = "Acoustic Keyword ('Bachao') Vocalized", locationText = "Connaught Place Hub", notificationStatus = null) {
        // Prevent duplicate trigger if already active
        if (this.isAlarmActive) return;
        this.isAlarmActive = true;
        this.isMuted = false;

        console.warn(`🚨 EMERGENCY OVERRIDE ENGAGED: ${triggerReason} around ${locationText}`);

        // 1. Unhide flashing red background strobe overlay
        if (this.strobeOverlay) {
            this.strobeOverlay.classList.remove('strobe-hidden');
        }

        // 2. Start single clean siren loop
        this.startEBSSirenLoop();

        // 3. Populate and display Critical Override Modal Dialog
        if (this.modal) {
            if (this.incidentSpan) this.incidentSpan.textContent = triggerReason;
            if (this.locationSpan) this.locationSpan.textContent = locationText;
            
            // Truthful Notification status on modal
            if (this.notifStatusSpan) {
                const notif = notificationStatus || window.lastKnownNotificationStatus || "DEMO ONLY";
                const s = notif.toUpperCase();
                if (s.includes("SENT") || s === "DELIVERED") {
                    this.notifStatusSpan.className = "badge-mini status-online";
                    this.notifStatusSpan.textContent = "SENT (+91 8318326641)";
                } else if (s.includes("FAIL")) {
                    this.notifStatusSpan.className = "badge-mini status-critical";
                    this.notifStatusSpan.textContent = "FAILED (Cellular Buffer)";
                } else {
                    this.notifStatusSpan.className = "badge-mini status-warning";
                    this.notifStatusSpan.textContent = "DEMO ONLY (Mock Console Logged)";
                }
            }

            try {
                this.modal.showModal();
            } catch (err) {
                this.modal.setAttribute('open', 'true');
            }
        }

        // 4. Instruct GIS mapping engine to plot dynamic nearest-station rescue line
        if (window.MapControllerInstance && typeof window.MapControllerInstance.drawDynamicEmergencyRouting === 'function') {
            window.MapControllerInstance.drawDynamicEmergencyRouting();
        }

        // 5. Append critical log bulletin
        if (window.appendLogEntry) {
            window.appendLogEntry("CRITICAL", `EMERGENCY OVERRIDE ENGAGED: ${triggerReason}. Automated rescue georouting active.`);
        }

        // 6. Trigger Live Incident Response Timeline Pipeline
        if (window.TimelineControllerInstance) {
            const lowerReason = triggerReason.toLowerCase();
            const isVoice = lowerReason.includes("voice") ||
                            lowerReason.includes("acoustic") ||
                            lowerReason.includes("bachao") ||
                            lowerReason.includes("help") ||
                            lowerReason.includes("madad");
            window.TimelineControllerInstance.triggerIncident({
                source: isVoice ? "VOICE" : "MANUAL",
                keyword: triggerReason,
                location: locationText,
                notificationStatus: notificationStatus || window.lastKnownNotificationStatus || null
            });
        }
    }

    /**
     * Executed when Dispatcher manually clicks [ACKNOWLEDGE & DISPATCH RESCUE] button.
     */
    acknowledgeAlarm() {
        console.log("🛡️ Dispatcher acknowledged alarm. Committing containment & reaction protocol.");
        this.isAlarmActive = false;
        this.isMuted = true;

        // Immediately kill and silence all audio
        this.stopEBSSirenLoop();

        // Hide strobe overlay
        if (this.strobeOverlay) {
            this.strobeOverlay.classList.add('strobe-hidden');
        }
        
        // Close modal
        if (this.modal) {
            try {
                this.modal.close();
            } catch (e) {
                this.modal.removeAttribute('open');
            }
        }

        if (window.appendLogEntry) {
            window.appendLogEntry("INFO", "Dispatcher acknowledged Level-1 distress alert. Quick Reaction Squad deployed.");
        }

        // Clear emergency routing line from GIS map
        if (window.MapControllerInstance && typeof window.MapControllerInstance.clearEmergencyRouting === 'function') {
            window.MapControllerInstance.clearEmergencyRouting();
        }

        // Reset Incident Response Timeline back to standby
        if (window.TimelineControllerInstance) {
            window.TimelineControllerInstance.resetTimeline();
        }
    }

    /**
     * Called when system state is normal.
     * MUST NOT deactivate alarm if it is actively sounding on screen.
     */
    resetAlarmState() {
        if (!this.isAlarmActive) {
            this.isMuted = false;
        }
    }
}

// Global Singleton Instance initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.AlertHandlerInstance = new EmergencyAlertController();
});
