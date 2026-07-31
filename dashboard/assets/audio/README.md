# Acoustic Alert Engine & Web Audio API Synthesis

> **Architectural Note on Emergency Siren Generation**

In standard web prototypes, emergency alarms rely on static audio files (e.g., `siren.mp3`), which frequently suffer from network loading delays, broken Relative paths, or CORS audio file restrictions during local file execution.

To guarantee zero-latency, unbreakable acoustic siren alarms during engineering defense evaluations, our Command Center utilizes an advanced **Web Audio API Real-time Synthesizer** integrated directly within `dashboard/assets/js/alert-handler.js`.

### Acoustic Synthesis Profile:
- **Government EBS Attention Signal**: Simultaneously modulates dual-frequency sawtooth harmonic oscillators at **853 Hz and 960 Hz**, replicating the dissonant chord standard of official Emergency Alert Systems (EAS / EBS).
- **Transit Alarm Modulation**: Automatically oscillates tone frequencies every 450ms between the EBS harmonic chord and alternating police intervention wail (680 Hz / 920 Hz split).
- **Zero Static File Dependencies**: Because the audio waveforms are calculated mathematically in realtime by the Javascript AudioContext engine, no physical `.mp3` audio files are stored or required within this directory!
