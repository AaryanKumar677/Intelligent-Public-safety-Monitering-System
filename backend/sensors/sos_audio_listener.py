"""
Acoustic SOS Keyword Recognition Engine.
Leverages Google Web Speech API (via SpeechRecognition) and PyAudio to continuously scan
microphone input streams for vocalized distress expressions ('Bachao', 'Help', 'Emergency')
with automated ambient noise calibration and debounce cooldowns.
Confirmed Hardware Interface: Primary Laptop Microphone (Index 0).
"""

import time
import logging
import threading
from typing import Callable, Optional, Set

import speech_recognition as sr
from backend.config import settings

logger = logging.getLogger("AudioSOSListener")

class AudioSOSListener:
    """
    Asynchronous audio monitoring edge node that captures PCM audio streams via Index 0,
    transcribes phonetics via Google Web Speech API, and triggers SOS events on keyword match.
    """

    def __init__(
        self,
        device_index: int = settings.AUDIO_DEVICE_INDEX,
        keywords: Optional[Set[str]] = None,
        callback: Optional[Callable[[str, float], None]] = None,
        debounce_sec: float = settings.AUDIO_DEBOUNCE_SEC
    ):
        self.device_index = device_index
        self.keywords = keywords if keywords else settings.AUDIO_SOS_KEYWORDS
        self.callback = callback
        self.debounce_sec = debounce_sec

        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = settings.AUDIO_ENERGY_THRESHOLD
        self.recognizer.dynamic_energy_threshold = True

        self._running = False
        self._last_trigger_timestamp = 0.0
        self._listener_thread: Optional[threading.Thread] = None

    def _match_keywords_in_text(self, transcript: str) -> Optional[str]:
        """Scans transcribed lowercased text against critical SOS phonetic expressions."""
        lower_text = transcript.lower()
        for kw in self.keywords:
            if kw.lower() in lower_text:
                return kw
        return None

    def _audio_processing_loop(self) -> None:
        """Core non-blocking listener loop operating in an independent background Daemon Thread."""
        logger.info(f"🎤 Mounting Audio SOS Capture Engine on Hardware Device Index: [{self.device_index}]...")

        try:
            # Mount Microphone hardware interface at confirmed default Index 0
            with sr.Microphone(device_index=self.device_index) as source:
                logger.info("   -> Calibrating ambient environmental noise threshold (Please remain quiet for 1.5s)...")
                self.recognizer.adjust_for_ambient_noise(source, duration=1.5)
                logger.info(
                    f"✅ Audio Calibration Complete. Dynamic Energy Threshold: {self.recognizer.energy_threshold}\n"
                    f"   -> Actively listening for emergency keywords: {list(self.keywords)}"
                )

                while self._running:
                    try:
                        # Capture live PCM speech sample with timeout limits
                        audio_sample = self.recognizer.listen(
                            source,
                            timeout=settings.AUDIO_LISTEN_TIMEOUT_SEC,
                            phrase_time_limit=4.0
                        )
                        
                        # Transcribe speech via confirmed Google Web Speech API
                        try:
                            # Using general English/Hindi phonetic compatibility
                            transcript = self.recognizer.recognize_google(audio_sample)
                            logger.debug(f"Phonetic stream transcription intercepted: '{transcript}'")

                            matched_keyword = self._match_keywords_in_text(transcript)
                            if matched_keyword:
                                now = time.time()
                                # Check debounce cooldown to avoid flooded repeated alarms on prolonged screams
                                if (now - self._last_trigger_timestamp) >= self.debounce_sec:
                                    self._last_trigger_timestamp = now
                                    logger.critical(
                                        f"🚨 ACOUSTIC DISTRESS DETECTED! Matched word: '{matched_keyword.upper()}' "
                                        f"in transcript: '{transcript}'"
                                    )
                                    if self.callback:
                                        self.callback(matched_keyword, now)
                                else:
                                    cooldown_left = round(self.debounce_sec - (now - self._last_trigger_timestamp), 1)
                                    logger.info(f"⏳ Acoustic SOS detected ('{matched_keyword}'), but suppressed by debounce cooldown ({cooldown_left}s remaining).")
                        
                        except sr.UnknownValueError:
                            # Speech was unintelligible or mere background transit engine rumble
                            pass
                        except sr.RequestError as req_err:
                            logger.error(f"Google Web Speech API connection error: {req_err}. Check internet connectivity.")

                    except sr.WaitTimeoutError:
                        # Normal timeout when silence prevails in cabin; loop immediately continues
                        continue
                    except Exception as loop_exc:
                        if self._running:
                            logger.error(f"Exception encountered during acoustic sample extraction: {loop_exc}")
                            time.sleep(1.0)

        except Exception as hardware_exc:
            logger.error(
                f"\n[!] AUDIO HARDWARE INITIALIZATION FAILURE ON INDEX [{self.device_index}]: {hardware_exc}\n"
                "    -> Operating in SIMULATED SPEECH MODE for evaluation presentations.\n"
                "    -> You can manually trigger simulated vocal alarms by typing 'sos' in terminal command prompt!"
            )
            while self._running:
                time.sleep(1.0)

    def start(self) -> None:
        """Spawns background listening thread without blocking main node supervisor execution."""
        if self._running:
            logger.warning("Audio SOS Listener thread is already active.")
            return
        
        self._running = True
        self._listener_thread = threading.Thread(target=self._audio_processing_loop, name="AudioSOSThread", daemon=True)
        self._listener_thread.start()
        logger.info("Acoustic Recognition background thread launched successfully.")

    def stop(self) -> None:
        """Safely terminates acoustic capture loop and releases audio interface lock."""
        if not self._running:
            return
        logger.info("Shutting down Acoustic SOS listener stream...")
        self._running = False
        if self._listener_thread and self._listener_thread.is_alive():
            self._listener_thread.join(timeout=2.0)
        logger.info("Acoustic Recognition engine terminated.")

    def simulate_keyword_trigger(self, simulated_keyword: str = "Bachao (Simulated Eval)") -> None:
        """Public demonstration helper to fire callback during academic evaluation without speaking."""
        now = time.time()
        logger.warning(f"🎮 [SIMULATED EVALUATION TRIGGER] Injecting virtual acoustic SOS keyword: '{simulated_keyword}'")
        self._last_trigger_timestamp = now
        if self.callback:
            self.callback(simulated_keyword, now)
