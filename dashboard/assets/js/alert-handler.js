/**
 * Alert Handler & Web Audio API Siren Generator
 * Controls high-decibel acoustic siren generation without needing static asset downloads,
 * handles red background strobe overrides, and manages dispatcher acknowledgment modals.
 */

class EmergencyAlertController {
    constructor() {
        this.isAlarmActive = false;
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.sirenInterval = null;
        
        // DOM Elements
        this.strobeOverlay = document.getElementById('strobe-overlay');
        this.modal = document.getElementById('emergency-modal');
        this.incidentSpan = document.getElementById('modal-incident-type');
        this.locationSpan = document.getElementById('modal-location');
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
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /**
     * Generates an authentic alternating dual-tone emergency police siren using Web Audio API.
     */
    startAcousticSiren() {
        try {
            this._initAudioContext();
            
            this.oscillator = this.audioCtx.createOscillator();
            this.gainNode = this.audioCtx.createGain();
            
            this.oscillator.type = 'sawtooth';
            this.oscillator.frequency.setValueAtTime(680, this.audioCtx.currentTime); // Start at 680 Hz
            
            // Set moderate high decibel volume (0.25 gain to prevent speaker clipping)
            this.gainNode.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
            
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);
            
            this.oscillator.start();

            // Alternate tone frequency every 400ms (French police / transit siren modulation)
            let highTone = true;
            this.sirenInterval = setInterval(() => {
                if (!this.oscillator || !this.audioCtx) return;
                const targetFreq = highTone ? 920 : 680;
                this.oscillator.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.05);
                highTone = !highTone;
            }, 420);

            console.log("🔉 High-decibel Web Audio siren activated.");
        } catch (err) {
            console.warn("Browser autoplay audio restriction bypassed or audio error:", err);
        }
    }

    stopAcousticSiren() {
        if (this.sirenInterval) {
            clearInterval(this.sirenInterval);
            this.sirenInterval = null;
        }
        if (this.oscillator) {
            try {
                this.oscillator.stop();
                this.oscillator.disconnect();
            } catch (e) {}
            this.oscillator = null;
        }
        console.log("🔇 Acoustic siren silenced.");
    }

    /**
     * Triggers Level-1 Critical Emergency override sequence across UI and speakers.
     * @param {string} triggerReason - Description of event (e.g. Acoustic Keyword Match)
     * @param {string} locationText - Landmark location description
     */
    triggerEmergencyOverride(triggerReason = "Acoustic Keyword ('Bachao') Vocalized", locationText = "Connaught Place Terminal") {
        if (this.isAlarmActive) return;
        this.isAlarmActive = true;

        console.warn(`🚨 EMERGENCY OVERRIDE ENGAGED: ${triggerReason} around ${locationText}`);

        // 1. Unhide flashing red background strobe overlay
        if (this.strobeOverlay) {
            this.strobeOverlay.classList.remove('strobe-hidden');
        }

        // 2. Start audible looping acoustic siren
        this.startAcousticSiren();

        // 3. Populate and show Critical Modal Dialog
        if (this.modal) {
            if (this.incidentSpan) this.incidentSpan.textContent = triggerReason;
            if (this.locationSpan) this.locationSpan.textContent = locationText;
            try {
                this.modal.showModal();
            } catch (err) {
                this.modal.setAttribute('open', 'true');
            }
        }

        // 4. Notify map controller to calculate and draw emergency police georouting
        if (window.MapControllerInstance && typeof window.MapControllerInstance.drawEmergencyRouting === 'function') {
            window.MapControllerInstance.drawEmergencyRouting();
        }

        // 5. Append critical log bulletin
        if (window.appendLogEntry) {
            window.appendLogEntry("CRITICAL", `EMERGENCY SOS FIRED: ${triggerReason}. Automated rescue routing active.`);
        }
    }

    /**
     * Executed when Dispatcher manually clicks [ACKNOWLEDGE & DISPATCH RESCUE] button.
     */
    acknowledgeAlarm() {
        console.log("🛡️ Dispatcher acknowledged alarm. Committing containment protocols.");
        this.isAlarmActive = false;

        // Silence siren & stop strobe animation
        this.stopAcousticSiren();
        if (this.strobeOverlay) {
            this.strobeOverlay.classList.add('strobe-hidden');
        }
        
        if (this.modal) {
            try {
                this.modal.close();
            } catch (e) {
                this.modal.removeAttribute('open');
            }
        }

        if (window.appendLogEntry) {
            window.appendLogEntry("INFO", "Dispatcher acknowledged SOS alert. Reaction squad mobilized to calculated coordinates.");
        }

        // Clear routing line from map after acknowledgment
        if (window.MapControllerInstance && typeof window.MapControllerInstance.clearEmergencyRouting === 'function') {
            window.MapControllerInstance.clearEmergencyRouting();
        }
    }
}

// Global Singleton Instance
window.AlertHandlerInstance = new EmergencyAlertController();
