"""
Acoustic SOS Detection Engine using SpeechRecognition & PyAudio.
Continuously captures live PCM audio streams from microphone hardware,
transcribes phonemes in real-time, and matches critical safety keywords ("Bachao", "Help").
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
    Continuous real-time acoustic distress keyword listener.
    Runs asynchronously in a background thread to prevent blocking edge vision processing.
    """

    def __init__(
        self,
        keywords: Optional[Set[str]] = None,
        device_index: Optional[int] = settings.AUDIO_DEVICE_INDEX,
        debounce_seconds: float = settings.AUDIO_DEBOUNCE_SEC,
        callback: Optional[Callable[[str, float], None]] = None,
    ):
        self.target_keywords = keywords or settings.AUDIO_SOS_KEYWORDS
        self.device_index = device_index
        self.debounce_sec = debounce_seconds
        self.on_sos_callback = callback
        
        self._recognizer = sr.Recognizer()
        self._recognizer.energy_threshold = settings.AUDIO_ENERGY_THRESHOLD
        self._recognizer.dynamic_energy_threshold = True
        self._microphone: Optional[sr.Microphone] = None
        
        self._running = False
        self._listener_thread: Optional[threading.Thread] = None
        self.last_trigger_timestamp = 0.0
        self.total_detections = 0

    def initialize_mic(self) -> bool:
        """Initializes and calibrates microphone hardware against ambient noise floor."""
        try:
            self._microphone = sr.Microphone(device_index=self.device_index)
            with self._microphone as source:
                logger.info("Calibrating microphone against ambient acoustic background... (please be quiet for 1s)")
                self._recognizer.adjust_for_ambient_noise(source, duration=1.0)
                logger.info(f"Calibration completed. Current dynamic energy threshold: {self._recognizer.energy_threshold}")
            return True
        except Exception as err:
            logger.error(f"Microphone hardware initialization failed: {err}")
            logger.warning(
                "[!] No compatible audio capture hardware found.\n"
                "    -> Audio SOS Listener will run in STANDBY/TEST mode.\n"
                "    -> You can programmatically call `.simulate_keyword_trigger('Bachao')` during live demonstrations."
            )
            return False

    def check_for_keyword(self, text: str) -> Optional[str]:
        """
        Scans transcribed input text for target safety keywords.
        Returns the matched keyword or None.
        """
        normalized_text = text.lower().strip()
        for kw in self.target_keywords:
            if kw in normalized_text:
                return kw
        return None

    def _process_audio_stream(self) -> None:
        """Internal asynchronous processing loop running inside background thread."""
        if not self._microphone:
            logger.warning("No microphone assigned; audio loop suspended.")
            return

        logger.info(f"🎙️ Acoustic SOS surveillance ACTIVE. Listening for keywords: {list(self.target_keywords)}...")
        
        while self._running:
            try:
                with self._microphone as source:
                    # Capture speech snippet
                    audio_data = self._recognizer.listen(
                        source, 
                        timeout=settings.AUDIO_LISTEN_TIMEOUT_SEC, 
                        phrase_time_limit=4.0
                    )
                
                # Transcribe using Google Web Speech API (Defaulting to bilingual en-IN/hi-IN compatibility)
                # Note: For strict offline deployment, switch to `self._recognizer.recognize_vosk(audio_data)`
                transcription = self._recognizer.recognize_google(audio_data, language="en-IN")
                logger.debug(f"Acoustic frame transcribed: '{transcription}'")

                matched_word = self.check_for_keyword(transcription)
                if matched_word:
                    self.trigger_alarm(matched_keyword=matched_word, source_text=transcription)

            except sr.WaitTimeoutError:
                # Normal operational loop timeout when no speech is uttered in the frame
                continue
            except sr.UnknownValueError:
                # Speech was detected but phonemes did not form recognizable dictionary words
                continue
            except sr.RequestError as api_err:
                logger.error(f"Speech Recognition cloud gateway error: {api_err}. Continuing loop...")
                time.sleep(1.5) # Throttle retry interval on network dropout
            except Exception as unk_err:
                logger.error(f"Unexpected error in audio capture loop: {unk_err}")
                time.sleep(1.0)

    def trigger_alarm(self, matched_keyword: str, source_text: str = "") -> bool:
        """
        Executes alert callback if debounce timer has expired.
        Can also be invoked directly to simulate an emergency during presentation defense.
        """
        current_time = time.time()
        if current_time - self.last_trigger_timestamp < self.debounce_sec:
            logger.warning(f"⚠️ Acoustic keyword '{matched_keyword}' matched, but DEBOUNCE timer active. Ignoring.")
            return False

        self.last_trigger_timestamp = current_time
        self.total_detections += 1

        logger.critical(
            f"\n🚨 [CRITICAL ALERT] ACOUSTIC SOS KEYWORD DETECTED!\n"
            f"    -> Keyword Match: '{matched_keyword.upper()}'\n"
            f"    -> Full Transcription: '{source_text}'\n"
            f"    -> Timestamp: {current_time:.2f}"
        )

        if self.on_sos_callback:
            try:
                self.on_sos_callback(matched_keyword, current_time)
            except Exception as cb_err:
                logger.error(f"Error executing emergency callback wrapper: {cb_err}")

        return True

    def simulate_keyword_trigger(self, simulated_keyword: str = "Bachao (Simulated Demo)") -> None:
        """
        Helper function for immediate academic demonstration without needing a physical microphone.
        """
        logger.info(f"🤖 Manual test simulation triggered for keyword: '{simulated_keyword}'")
        self.trigger_alarm(matched_keyword=simulated_keyword, source_text="Simulated acoustic input")

    def start(self, run_mic_init: bool = True) -> None:
        """Starts asynchronous audio surveillance background thread."""
        if self._running:
            logger.warning("Audio SOS Listener thread is already active.")
            return

        if run_mic_init:
            self.initialize_mic()

        self._running = True
        self._listener_thread = threading.Thread(target=self._process_audio_stream, name="AudioSOSThread", daemon=True)
        self._listener_thread.start()
        logger.info("Audio SOS background thread spawned successfully.")

    def stop(self) -> None:
        """Safely terminates audio monitoring background thread."""
        logger.info("Terminating audio SOS background thread...")
        self._running = False
        if self._listener_thread and self._listener_thread.is_alive():
            self._listener_thread.join(timeout=2.0)
        logger.info("Audio SOS Listener shutdown complete.")
