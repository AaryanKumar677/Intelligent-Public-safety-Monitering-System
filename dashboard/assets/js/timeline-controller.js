/**
 * Incident Timeline Controller
 * Manages the live 4-step Incident Response Timeline below the GIS map:
 * Step 1: Voice Matched (or Manual Trigger)
 * Step 2: Python Event Received
 * Step 3: Route Ready (Nearest Police Post)
 * Step 4: Notification Status (Truthful: Sent / Demo Only / Pending / Failed)
 */

class IncidentTimelineController {
    constructor() {
        this.step1 = document.getElementById('timeline-step-1');
        this.step2 = document.getElementById('timeline-step-2');
        this.step3 = document.getElementById('timeline-step-3');
        this.step4 = document.getElementById('timeline-step-4');

        this.connector1 = document.getElementById('connector-1');
        this.connector2 = document.getElementById('connector-2');
        this.connector3 = document.getElementById('connector-3');

        this.badge1 = document.getElementById('step-1-badge');
        this.badge2 = document.getElementById('step-2-badge');
        this.badge3 = document.getElementById('step-3-badge');
        this.badge4 = document.getElementById('step-4-badge');

        this.desc1 = document.getElementById('step-1-desc');
        this.desc2 = document.getElementById('step-2-desc');
        this.desc3 = document.getElementById('step-3-desc');
        this.desc4 = document.getElementById('step-4-desc');

        this.time1 = document.getElementById('step-1-time');
        this.time2 = document.getElementById('step-2-time');
        this.time3 = document.getElementById('step-3-time');
        this.time4 = document.getElementById('step-4-time');

        this.overallBadge = document.getElementById('timeline-overall-badge');
        this.triggerSourceEl = document.getElementById('timeline-trigger-source');
        this.nearestPostEl = document.getElementById('timeline-nearest-post');
        this.dispatchVerifiedEl = document.getElementById('timeline-dispatch-verified');

        this.isIncidentActive = false;
        this.activeTimeouts = [];
    }

    /**
     * Triggered when an emergency happens (either Voice SOS matched or Manual SOS clicked)
     */
    triggerIncident({ source = "VOICE", keyword = "Bachao", location = "Lucknow Transit Corridor", notificationStatus = null } = {}) {
        this.isIncidentActive = true;
        this._clearTimeouts();

        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

        if (this.overallBadge) {
            this.overallBadge.className = "badge-mini status-critical";
            this.overallBadge.innerHTML = `<span class="pulse-dot"></span> INCIDENT ESCALATING`;
        }

        // ================= STEP 1: TRIGGER IDENTIFIED =================
        if (this.step1) this.step1.className = "timeline-step step-critical";
        if (this.time1) this.time1.textContent = timeStr;

        if (source === "VOICE") {
            if (this.badge1) {
                this.badge1.className = "step-badge badge-critical";
                this.badge1.textContent = `MATCHED: "${keyword.toUpperCase()}"`;
            }
            if (this.desc1) {
                this.desc1.textContent = `Acoustic distress keyword identified by cabin microphone.`;
            }
            if (this.triggerSourceEl) {
                this.triggerSourceEl.innerHTML = `<span style="color:#FF3A2D; font-weight:700;">🎙️ Autonomous Voice SOS ("${keyword}")</span>`;
            }
        } else {
            if (this.badge1) {
                this.badge1.className = "step-badge badge-warning";
                this.badge1.textContent = `MANUAL FALLBACK`;
            }
            if (this.desc1) {
                this.desc1.textContent = `Physical passenger panic button pressed in vehicle cabin.`;
            }
            if (this.triggerSourceEl) {
                this.triggerSourceEl.innerHTML = `<span style="color:#FFB800; font-weight:700;">🔘 Manual SOS Test (Button Fallback)</span>`;
            }
        }

        // ================= STEP 2: PYTHON EVENT RECEIVED =================
        const t1 = setTimeout(() => {
            if (this.connector1) this.connector1.className = "step-connector connector-active";
            if (this.step2) this.step2.className = "timeline-step step-active";
            if (this.time2) this.time2.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
            if (this.badge2) {
                this.badge2.className = "step-badge badge-cyan";
                this.badge2.textContent = "EVENT RECEIVED";
            }
            if (this.desc2) {
                this.desc2.textContent = `Edge IoT telemetry state locked; vehicle motion halted (0.0 km/h).`;
            }
        }, 250);
        this.activeTimeouts.push(t1);

        // ================= STEP 3: ROUTE READY =================
        const t2 = setTimeout(() => {
            if (this.connector2) this.connector2.className = "step-connector connector-active";
            if (this.step3) this.step3.className = "timeline-step step-success";
            if (this.time3) this.time3.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
            if (this.badge3) {
                this.badge3.className = "step-badge badge-safe";
                this.badge3.textContent = "ROUTE READY";
            }
            if (this.desc3) {
                this.desc3.textContent = `Nearest police station intercepted; dynamic GIS emergency vector drawn.`;
            }
            if (this.nearestPostEl) {
                this.nearestPostEl.textContent = `${location} Police Post (Route Active)`;
            }
        }, 500);
        this.activeTimeouts.push(t2);

        // ================= STEP 4: NOTIFICATION STATUS =================
        // Show PENDING first, then resolve to truthful status
        if (this.connector3) this.connector3.className = "step-connector connector-active";
        if (this.step4) this.step4.className = "timeline-step step-warning";
        if (this.time4) this.time4.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
        if (this.badge4) {
            this.badge4.className = "step-badge badge-warning";
            this.badge4.textContent = "PENDING...";
        }
        if (this.desc4) {
            this.desc4.textContent = `Transmitting alert to emergency authority gateway...`;
        }
        if (this.dispatchVerifiedEl) {
            this.dispatchVerifiedEl.className = "badge-mini status-warning";
            this.dispatchVerifiedEl.textContent = "PENDING...";
        }

        const t3 = setTimeout(() => {
            this.updateNotificationStatus(notificationStatus);
        }, 850);
        this.activeTimeouts.push(t3);
    }

    /**
     * Resolves Step 4 with truthful verification status:
     * - "SENT" -> if actual Twilio SMS / Telegram API succeeded
     * - "DEMO ONLY" -> if mock console or default credentials
     * - "PENDING" -> in-flight
     * - "FAILED" -> network or authentication error
     */
    updateNotificationStatus(status) {
        if (!this.step4) return;
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        if (this.time4) this.time4.textContent = timeStr;

        const s = (status || "").toUpperCase();

        if (s.includes("SENT") || s === "DELIVERED") {
            this.step4.className = "timeline-step step-success";
            if (this.badge4) {
                this.badge4.className = "step-badge badge-safe";
                this.badge4.textContent = "SENT";
            }
            if (this.desc4) {
                this.desc4.textContent = "Twilio SMS alert broadcasted to configured contact (+91 8318326641).";
            }
            if (this.dispatchVerifiedEl) {
                this.dispatchVerifiedEl.className = "badge-mini status-online";
                this.dispatchVerifiedEl.textContent = "SENT (Twilio SMS Verified)";
            }
            if (this.overallBadge) {
                this.overallBadge.className = "badge-mini status-critical";
                this.overallBadge.innerHTML = `<span class="pulse-dot"></span> RESCUE DISPATCHED`;
            }
        } else if (s.includes("FAIL") || s.includes("ERROR")) {
            this.step4.className = "timeline-step step-critical";
            if (this.badge4) {
                this.badge4.className = "step-badge badge-critical";
                this.badge4.textContent = "FAILED";
            }
            if (this.desc4) {
                this.desc4.textContent = "External API transmission failed. Preserved in offline cellular fallback buffer.";
            }
            if (this.dispatchVerifiedEl) {
                this.dispatchVerifiedEl.className = "badge-mini status-critical";
                this.dispatchVerifiedEl.textContent = "FAILED (Network / Key Error)";
            }
        } else if (s.includes("PENDING")) {
            this.step4.className = "timeline-step step-warning";
            if (this.badge4) {
                this.badge4.className = "step-badge badge-warning";
                this.badge4.textContent = "PENDING";
            }
            if (this.desc4) {
                this.desc4.textContent = "Transmitting alert to authority gateway...";
            }
            if (this.dispatchVerifiedEl) {
                this.dispatchVerifiedEl.className = "badge-mini status-warning";
                this.dispatchVerifiedEl.textContent = "PENDING...";
            }
        } else {
            // Default: Demo Only (Mock Console Logged)
            this.step4.className = "timeline-step step-warning";
            if (this.badge4) {
                this.badge4.className = "step-badge badge-warning";
                this.badge4.textContent = "DEMO ONLY";
            }
            if (this.desc4) {
                this.desc4.textContent = "Mock console dispatch logged (External Twilio keys unconfigured in .env).";
            }
            if (this.dispatchVerifiedEl) {
                this.dispatchVerifiedEl.className = "badge-mini status-warning";
                this.dispatchVerifiedEl.textContent = "DEMO ONLY (Console Mock Logged)";
            }
            if (this.overallBadge) {
                this.overallBadge.className = "badge-mini status-warning";
                this.overallBadge.innerHTML = `<span class="pulse-dot"></span> EVALUATION DISPATCH LOGGED`;
            }
        }
    }

    /**
     * Resets timeline to standby when operator resets state or acknowledges alarm
     */
    resetTimeline() {
        this.isIncidentActive = false;
        this._clearTimeouts();

        if (this.overallBadge) {
            this.overallBadge.className = "badge-mini status-online";
            this.overallBadge.textContent = "SYSTEM STANDBY";
        }

        // Reset Step 1
        if (this.step1) this.step1.className = "timeline-step";
        if (this.badge1) {
            this.badge1.className = "step-badge badge-idle";
            this.badge1.textContent = "AUTO-LISTENING";
        }
        if (this.desc1) this.desc1.textContent = 'Continuous mic scan for "Bachao"/"Help" (Manual fallback ready).';
        if (this.time1) this.time1.textContent = "--:--:--";

        // Reset Step 2
        if (this.step2) this.step2.className = "timeline-step";
        if (this.badge2) {
            this.badge2.className = "step-badge badge-idle";
            this.badge2.textContent = "STANDBY";
        }
        if (this.desc2) this.desc2.textContent = "IoT Gateway sync on standby; vehicle telemetry running.";
        if (this.time2) this.time2.textContent = "--:--:--";

        // Reset Step 3
        if (this.step3) this.step3.className = "timeline-step";
        if (this.badge3) {
            this.badge3.className = "step-badge badge-idle";
            this.badge3.textContent = "STANDBY";
        }
        if (this.desc3) this.desc3.textContent = "GIS vectoring on standby.";
        if (this.time3) this.time3.textContent = "--:--:--";

        // Reset Step 4
        if (this.step4) this.step4.className = "timeline-step";
        if (this.badge4) {
            this.badge4.className = "step-badge badge-idle";
            this.badge4.textContent = "STANDBY";
        }
        if (this.desc4) this.desc4.textContent = "External notification dispatch (Twilio SMS / Console Broadcast).";
        if (this.time4) this.time4.textContent = "--:--:--";

        // Reset connectors
        if (this.connector1) this.connector1.className = "step-connector";
        if (this.connector2) this.connector2.className = "step-connector";
        if (this.connector3) this.connector3.className = "step-connector";

        // Reset summary strip
        if (this.triggerSourceEl) this.triggerSourceEl.textContent = "None (Normal Transit)";
        if (this.nearestPostEl) this.nearestPostEl.textContent = "Connaught Place Police Station (1.2 km)";
        if (this.dispatchVerifiedEl) {
            this.dispatchVerifiedEl.className = "badge-mini badge-demo";
            this.dispatchVerifiedEl.textContent = "STANDBY";
        }
    }

    _clearTimeouts() {
        this.activeTimeouts.forEach(t => clearTimeout(t));
        this.activeTimeouts = [];
    }
}

// Global Singleton initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.TimelineControllerInstance = new IncidentTimelineController();
});
