"""
Multi-Channel Emergency Notification Gateway.
Dispatches critical safety alerts and live telemetry GPS links to external authorities
or reaction teams via Telegram Bot API, Twilio SMS/Voice, or simulated Terminal Broadcast.
"""

import logging
from typing import Dict, Any, Optional
import requests
import time

from backend.config import settings

logger = logging.getLogger("NotificationService")

# Try importing twilio if present
try:
    from twilio.rest import Client as TwilioClient
    _TWILIO_INSTALLED = True
except ImportError:
    _TWILIO_INSTALLED = False

class AlertDispatcher:
    """
    Handles routing emergency signals to configured telecommunication channels.
    Supports graceful fallbacks to simulated console broadcasts if third-party credentials aren't set.
    """

    def __init__(self, provider: str = settings.NOTIFICATION_PROVIDER):
        self.provider = provider.lower()

    def format_emergency_message(self, alert_type: str, details: str, telemetry: Dict[str, Any]) -> str:
        """Constructs standardized readable emergency dispatch bulletin."""
        lat = telemetry.get("latitude", 0.0)
        lng = telemetry.get("longitude", 0.0)
        stop = telemetry.get("current_stop_nearby", "Unknown Location")
        speed = telemetry.get("speed_kmh", 0.0)
        
        maps_link = f"https://www.google.com/maps?q={lat},{lng}"

        bulletin = (
            f"🚨 CRITICAL TRANSIT EMERGENCY DISPATCH 🚨\n\n"
            f"🚌 VEHICLE ID: {settings.VEHICLE_ID} ({settings.VEHICLE_ROUTE_NAME})\n"
            f"🔴 INCIDENT TYPE: {alert_type.upper()}\n"
            f"💬 DETAILS: {details}\n\n"
            f"📍 LOCATION: Near {stop}\n"
            f"🌐 TELEMETRY: {lat} N, {lng} E (Speed: {speed} km/h)\n"
            f"🗺️ MAP ROUTING: {maps_link}\n\n"
            f"⚠️ ACTION REQUIRED: Deploy Nearest Reaction Unit immediately!"
        )
        return bulletin

    def send_telegram_alert(self, message: str) -> bool:
        """Transmits automated emergency notification via Telegram Bot webhook."""
        token = settings.TELEGRAM_BOT_TOKEN
        chat_id = settings.TELEGRAM_CHAT_ID

        if not token or not chat_id:
            logger.warning("[!] Telegram credentials missing in .env. Rerouting to mock console output.")
            return self.send_mock_alert(message)

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "disable_web_page_preview": False
        }

        try:
            resp = requests.post(url, json=payload, timeout=5.0)
            if resp.status_code == 200:
                logger.info("✅ Telegram emergency dispatch delivered successfully.")
                return True
            else:
                logger.error(f"Telegram API responded with error {resp.status_code}: {resp.text}")
                return False
        except Exception as exc:
            logger.error(f"Failed connecting to Telegram gateway: {exc}")
            return False

    def send_twilio_alert(self, message: str) -> bool:
        """Transmits automated SMS dispatch using Twilio REST Client."""
        if not _TWILIO_INSTALLED:
            logger.error("Twilio Python SDK not installed. Run `pip install twilio`.")
            return self.send_mock_alert(message)

        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        sender = settings.TWILIO_SENDER_PHONE
        recipient = settings.TWILIO_RECIPIENT_PHONE

        if not all([sid, token, sender, recipient]):
            logger.warning("[!] Incomplete Twilio credentials in .env. Rerouting to mock console output.")
            return self.send_mock_alert(message)

        try:
            client = TwilioClient(sid, token)
            message_instance = client.messages.create(
                body=message,
                from_=sender,
                to=recipient
            )
            logger.info(f"✅ Twilio emergency SMS broadcasted successfully. SID: {message_instance.sid}")
            return True
        except Exception as exc:
            logger.error(f"Twilio API broadcast error: {exc}")
            return False

    def send_mock_alert(self, message: str) -> bool:
        """Simulates external communications gateway for local terminal demonstrations."""
        divider = "=" * 70
        print(f"\n{divider}\n📡 [MOCK NOTIFICATION GATEWAY] BROADCASTING TO REACTION TEAM:\n{divider}\n{message}\n{divider}\n")
        return True

    def trigger_emergency_voice_call(self, victim_contacts: list, police_contact: str, tracking_link: str) -> bool:
        """
        Initiates automated AI Voice Calls (TwiML) to contacts with a 3-time retry mechanism.
        """
        if not _TWILIO_INSTALLED:
            logger.error("Twilio Python SDK not installed. Rerouting voice call to mock console output.")
            return self.send_mock_voice_call(victim_contacts, police_contact, tracking_link)

        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        sender = settings.TWILIO_SENDER_PHONE

        if not all([sid, token, sender]):
            logger.warning("[!] Incomplete Twilio credentials in .env. Rerouting voice call to mock console output.")
            return self.send_mock_voice_call(victim_contacts, police_contact, tracking_link)

        client = TwilioClient(sid, token)
        
        twiml_script = f"""<Response>
            <Say voice="alice" language="en-US">
                🚨 Alert! This is an automated emergency call from the Transit Safety System. A passenger requires immediate police assistance. The live tracking link has been sent to your SMS. Repeating, passenger needs help. Disconnecting.
            </Say>
            <Hangup/>
        </Response>"""

        all_contacts = victim_contacts + [police_contact]
        success_overall = False

        for contact in all_contacts:
            if not contact:
                continue
            
            logger.info(f"Initiating TwiML voice call to {contact}...")
            call_answered = False
            
            for attempt in range(1, 4):  # 3 retries
                try:
                    call = client.calls.create(
                        twiml=twiml_script,
                        to=contact,
                        from_=sender
                    )
                    logger.info(f"Call {call.sid} dispatched to {contact} (Attempt {attempt}/3).")
                    
                    # Simulated polling for call status
                    for _ in range(5):
                        time.sleep(2)
                        call_status = client.calls(call.sid).fetch().status
                        if call_status in ['completed', 'in-progress']:
                            logger.info(f"✅ Call to {contact} answered (Status: {call_status}).")
                            call_answered = True
                            success_overall = True
                            break
                        elif call_status in ['failed', 'no-answer', 'busy', 'canceled']:
                            logger.warning(f"⚠️ Call to {contact} failed/unanswered (Status: {call_status}).")
                            break
                    
                    if call_answered:
                        break # Skip remaining retries for this contact
                        
                    logger.info(f"Retrying {contact} in 3 seconds...")
                    time.sleep(3)
                    
                except Exception as exc:
                    logger.error(f"Twilio API Voice Call error on attempt {attempt}: {exc}")
                    time.sleep(3)
                    
            if not call_answered:
                logger.error(f"❌ Failed to reach {contact} after 3 attempts. Moving to next contact.")

        return success_overall

    def send_mock_voice_call(self, victim_contacts: list, police_contact: str, tracking_link: str) -> bool:
        """Simulates the AI Voice call for local testing without Twilio."""
        divider = "=" * 70
        all_contacts = victim_contacts + [police_contact]
        print(f"\n{divider}\n🗣️ [MOCK TwiML VOICE GATEWAY] INITIATING AUTOMATED CALLS:\n{divider}")
        for contact in all_contacts:
            if not contact: continue
            print(f"📞 Calling {contact}... ")
            time.sleep(1)
            print(f"🤖 Playing TTS: '🚨 Alert! Automated emergency call. Passenger requires police. Tracking: {tracking_link}. <Hangup>'")
        print(f"{divider}\n")
        return True

    def dispatch(self, alert_type: str, details: str, telemetry: Dict[str, Any]) -> bool:
        """Primary routing method selecting appropriate external communication channels."""
        formatted_msg = self.format_emergency_message(alert_type, details, telemetry)
        logger.warning(f"Initiating emergency dispatch via provider: '{self.provider}'")

        if self.provider == "telegram":
            return self.send_telegram_alert(formatted_msg)
        elif self.provider == "twilio":
            return self.send_twilio_alert(formatted_msg)
        elif self.provider == "both":
            tg_res = self.send_telegram_alert(formatted_msg)
            tw_res = self.send_twilio_alert(formatted_msg)
            return tg_res or tw_res
        else:
            return self.send_mock_alert(formatted_msg)

# Global singleton dispatcher instance
_dispatcher = AlertDispatcher()

def dispatch_emergency_notification(alert_type: str, details: str, telemetry: Dict[str, Any]) -> bool:
    """Convenience functional wrapper for system orchestrator calls."""
    return _dispatcher.dispatch(alert_type=alert_type, details=details, telemetry=telemetry)
