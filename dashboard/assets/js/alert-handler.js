/**
 * Alert Handler & Web Audio API Government EBS Siren Synthesizer
 * Generates an authentic dual-tone Government Emergency Broadcast System (EBS / EAS) attention signal
 * combining simultaneous 853 Hz and 960 Hz acoustic chords with alternating transit alarm modulation.
 * Enforces continuous red background strobe UI overrides until manual dispatcher acknowledgment.
 */

class EmergencyAlertController {
    constructor() {
        this.isAlarmActive = false;
        this.isMuted = false; // Prevents alarm from re-triggering constantly after dispatch acknowledges it
        this.audioCtx = null;
        
        // EBS Dual-oscillator synth nodes
        this.oscillatorEBS1 = null; // 853 Hz EAS Chord
        this.oscillatorEBS2 = null; // 960 Hz EAS Chord
        this.gainNode = null;
        this.sirenModulationInterval = null;
        
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
            
            // Bypass Browser Autoplay Policy: Resume audio context on first user interaction
            document.addEventListener('click', () => {
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
            }, { once: false });
        }
        
        if (this.audioCtx.state === 'suspended') {
            // Attempt to resume it now, though it might be blocked if not triggered by user interaction
            this.audioCtx.resume().catch(e => console.warn("Autoplay blocked. User needs to click on the page."));
        }
    }

    /**
     * Synthesizes official Government Emergency Broadcast System (EBS) dual-frequency harmonic
     * ATTENTION SIGNAL (853 Hz + 960 Hz simultaneous dissonant chord) via Web Audio API.
     * Operates without external .mp3 file dependencies or network downloads.
     */
    startEBSSirenLoop() {
        try {
            this._initAudioContext();
            
            // Create master gain controller (volume throttled to 0.22 to prevent hardware clipping)
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.setValueAtTime(0.22, this.audioCtx.currentTime);
            this.gainNode.connect(this.audioCtx.destination);

            // Oscillator 1: Official EAS low harmonic tone (853 Hz)
            this.oscillatorEBS1 = this.audioCtx.createOscillator();
            this.oscillatorEBS1.type = 'sawtooth';
            this.oscillatorEBS1.frequency.setValueAtTime(853, this.audioCtx.currentTime);
            this.oscillatorEBS1.connect(this.gainNode);

            // Oscillator 2: Official EAS high harmonic tone (960 Hz)
            this.oscillatorEBS2 = this.audioCtx.createOscillator();
            this.oscillatorEBS2.type = 'sawtooth';
            this.oscillatorEBS2.frequency.setValueAtTime(960, this.audioCtx.currentTime);
            this.oscillatorEBS2.connect(this.gainNode);

            this.oscillatorEBS1.start();
            this.oscillatorEBS2.start();

            // Periodic pitch modulation to alternate between Government EBS harmonic and emergency transit reaction wail
            let isEBSTone = true;
            this.sirenModulationInterval = setInterval(() => {
                if (!this.oscillatorEBS1 || !this.oscillatorEBS2 || !this.audioCtx) return;
                
                if (isEBSTone) {
                    // Alternate to European/Transit Emergency Wail (680 Hz & 920 Hz split)
                    this.oscillatorEBS1.frequency.setTargetAtTime(680, this.audioCtx.currentTime, 0.04);
                    this.oscillatorEBS2.frequency.setTargetAtTime(920, this.audioCtx.currentTime, 0.04);
                } else {
                    // Revert to Government EBS Attention Signal (853 Hz & 960 Hz chord)
                    this.oscillatorEBS1.frequency.setTargetAtTime(853, this.audioCtx.currentTime, 0.04);
                    this.oscillatorEBS2.frequency.setTargetAtTime(960, this.audioCtx.currentTime, 0.04);
                }
                isEBSTone = !isEBSTone;
            }, 450);

            console.log("🔊 Government EBS Acoustic Attention Synth activated (853 Hz + 960 Hz dual-chord loop).");

            // Aggressive continuous hardware vibration for mobile devices (Simulating WEA Cell Broadcast)
            if ("vibrate" in navigator) {
                navigator.vibrate([800, 200, 800, 200, 800, 200, 800]); // Initial pattern
                this.vibrationInterval = setInterval(() => {
                    navigator.vibrate([800, 200, 800, 200, 800, 200, 800]);
                }, 4000);
            }

        } catch (err) {
            console.warn("Browser audio autoplay policy blocked automatic audio synth initiation:", err);
        }
    }

    stopEBSSirenLoop() {
        if (this.sirenModulationInterval) {
            clearInterval(this.sirenModulationInterval);
            this.sirenModulationInterval = null;
        }
        if (this.vibrationInterval) {
            clearInterval(this.vibrationInterval);
            this.vibrationInterval = null;
        }
        if ("vibrate" in navigator) {
            navigator.vibrate(0); // Instantly kill active vibration engine
        }
        [this.oscillatorEBS1, this.oscillatorEBS2].forEach(osc => {
            if (osc) {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {}
            }
        });
        this.oscillatorEBS1 = null;
        this.oscillatorEBS2 = null;
        console.log("🔇 Government EBS acoustic alarm loop silenced by dispatcher mitigation.");
    }

    /**
     * Triggers Level-1 Critical Emergency override sequence across UI and audio speakers.
     * Enforces strict UI locking until dispatcher acknowledgment.
     */
    triggerEmergencyOverride(triggerReason = "Acoustic Keyword ('Bachao') Vocalized", locationText = "Connaught Place Hub") {
        if (this.isAlarmActive || this.isMuted) return;
        this.isAlarmActive = true;

        console.warn(`🚨 GOVERNMENT EBS EMERGENCY OVERRIDE ENGAGED: ${triggerReason} around ${locationText}`);

        // 1. Unhide flashing red background strobe overlay
        if (this.strobeOverlay) {
            this.strobeOverlay.classList.remove('strobe-hidden');
        }

        // 2. Start continuous synthesized EBS acoustic siren loop
        this.startEBSSirenLoop();

        // 3. Populate and display Critical Override Modal Dialog
        if (this.modal) {
            if (this.incidentSpan) this.incidentSpan.textContent = triggerReason;
            if (this.locationSpan) this.locationSpan.textContent = locationText;
            try {
                this.modal.showModal();
            } catch (err) {
                this.modal.setAttribute('open', 'true');
            }
        }

        // 4. Instruct GIS mapping engine to execute dynamic nearest-station Euclidean calculation & plotting
        if (window.MapControllerInstance && typeof window.MapControllerInstance.drawDynamicEmergencyRouting === 'function') {
            window.MapControllerInstance.drawDynamicEmergencyRouting();
        }

        // 5. Append critical log bulletin to real-time feed
        if (window.appendLogEntry) {
            window.appendLogEntry("CRITICAL", `EMERGENCY OVERRIDE ENGAGED: ${triggerReason}. Automated rescue georouting active.`);
        }
    }

    /**
     * Executed when Dispatcher manually clicks [ACKNOWLEDGE & DISPATCH RESCUE] button.
     */
    acknowledgeAlarm() {
        console.log("🛡️ Dispatcher acknowledged alarm. Committing containment & reaction protocol.");
        this.isAlarmActive = false;
        this.isMuted = true; // Mute further popups until backend explicitly resets SOS status

        // Silence EBS acoustic synthesizer & cancel visual strobe animation
        this.stopEBSSirenLoop();
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
            window.appendLogEntry("INFO", "Dispatcher acknowledged Level-1 distress alert. Quick Reaction Squad deployed to calculated target coordinates.");
        }

        // Clear emergency routing line from GIS map viewport
        if (window.MapControllerInstance && typeof window.MapControllerInstance.clearEmergencyRouting === 'function') {
            window.MapControllerInstance.clearEmergencyRouting();
        }
    }

    /**
     * Called when the backend stops sending the SOS flag, freeing the system for future alarms.
     */
    resetAlarmState() {
        this.isMuted = false;
        this.isAlarmActive = false;
    }
}

// Global Singleton Instance initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.AlertHandlerInstance = new EmergencyAlertController();
});
