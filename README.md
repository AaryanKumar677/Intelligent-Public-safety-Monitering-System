# 🚨 Intelligent Public Transport Safety Monitoring System
> **An AI-Powered IoT & Cloud Edge Network for Enhancing Transit Safety and Preventing Emergencies.**

![UN SDG 5: Gender Equality](https://img.shields.io/badge/UN%20SDG%205-Gender%20Equality%20%26%20Women%20Safety-FF3A2D?style=for-the-badge&logo=unitednations&logoColor=white)
![AI: YOLOv8 & Speech Recognition](https://img.shields.io/badge/Edge%20AI-YOLOv8%20%2B%20Vosk%2FWhisper-0080FF?style=for-the-badge&logo=python&logoColor=white)
![Cloud: Firebase RTDB](https://img.shields.io/badge/Cloud%20Pipeline-Firebase%20RTDB-FFAA00?style=for-the-badge&logo=firebase&logoColor=black)
![Frontend: Vanilla JS & Leaflet](https://img.shields.io/badge/Dashboard-Vanilla%20JS%20%2B%20Leaflet.js-00D97E?style=for-the-badge&logo=javascript&logoColor=black)
![Status: Active Prototyping](https://img.shields.io/badge/Status-Academic%20Minor%20Project-8A2BE2?style=for-the-badge)

---

## 🌐 Executive Overview & UN SDG Alignment

Public transportation systems often suffer from blind spots in real-time safety monitoring, particularly regarding harassment, overcrowding, and sudden medical or physical emergencies. 

The **Intelligent Public Transport Safety Monitoring System** addresses **United Nations Sustainable Development Goal 5 (Target 5.2: Eliminate all forms of violence against all women and girls in public and private spheres)** by deploying an autonomous edge-AI layer directly inside transit vehicles (buses and cabs). Using commodity hardware (microphones and optical lenses/webcams), the node continuously evaluates transit cabin safety in real time without human intervention. Upon identifying acoustic distress keywords (*"Bachao"*, *"Help"*) or exceeding visual overcrowding thresholds, the system pushes instantaneous, zero-latency emergency flags to a cloud real-time database, triggering automated high-priority dispatcher alarms, automated police routing, and external notification fallback workflows.

---

## 🏛️ System Architecture & Data Pipeline

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        VEHICLE EDGE NODE (Python / IoT Simulation)                      │
│                                                                                        │
│   ┌──────────────────────────┐         ┌──────────────────────────┐                    │
│   │   Audio Sensor Stream    │         │  Optical Sensor Stream   │                    │
│   │     (pyaudio / Mic)      │         │   (OpenCV / Webcam)      │                    │
│   └────────────┬─────────────┘         └────────────┬─────────────┘                    │
│                │                                    │                                  │
│                ▼                                    ▼                                  │
│   ┌──────────────────────────┐         ┌──────────────────────────┐                    │
│   │ Speech Recognition Engine│         │   YOLOv8 Object Detector │                    │
│   │   Keyword Match Detection│         │    Person Counter Engine │                    │
│   │   ["Bachao", "Help"]     │         │   [Threshold Anomaly]    │                    │
│   └────────────┬─────────────┘         └────────────┬─────────────┘                    │
│                │                                    │                                  │
│                └─────────────────┬──────────────────┘                                  │
│                                  ▼                                                     │
│                 ┌──────────────────────────────────┐                                   │
│                 │   Edge Orchestrator & Telemetry  │                                   │
│                 │      (GPS Simulation + Payload)  │                                   │
│                 └────────────────┬─────────────────┘                                   │
└──────────────────────────────────┼─────────────────────────────────────────────────────┘
                                   │
                                   │ Real-time WebSockets / JSON Payload (firebase-admin)
                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CLOUD REALTIME PIPELINE (Google Firebase)                       │
│                                                                                        │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│   │                        Firebase Realtime Database (RTDB)                         │ │
│   │          State Storage: { vehicle_id, gps, audio_sos, crowd_alert, time }        │ │
│   └────────────────────────────────┬──────────────┬──────────────────────────────────┘ │
└────────────────────────────────────┼──────────────┼────────────────────────────────────┘
                                     │              │
         WebSocket Event Push        │              │  REST Event Trigger
         (Firebase JS SDK)           │              │  (Notification Service)
                                     ▼              ▼
┌──────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│     ADMIN COMMAND CENTER (Frontend)       │   │    NOTIFICATION GATEWAY (Fallback)      │
│                                          │   │                                         │
│  • Visual Override: Screen Flash & Modal │   │  • SMS Broadcast (Twilio API / Telegram)│
│  • Acoustic Siren: High-Decibel Loop     │   │  • Emergency Voice Calls                │
│  • GIS Map Tracking: Leaflet.js + OSM    │   │  • Dispatch Logs & Webhook Integration    │
│  • Automated Nearest Police Station Route│   │                                         │
└──────────────────────────────────────────┘   └─────────────────────────────────────────┘
```

---

## ✨ Core Features

### 1. Acoustic SOS Detection Engine (`sos_audio_listener.py`)
- **Continuous Edge Stream**: Captures live microphone audio chunks at low latency using `pyaudio`.
- **Intelligent Keyword Matching**: Leverages Natural Language keyword extraction (`SpeechRecognition`, backed by offline Vosk or online engines) to instantly detect distress vocalizations such as **"Bachao"** (Hindi for *Help/Save me*) and **"Help"**.
- **False-Positive Mitigation**: Employs noise-floor normalization and threshold confidence scoring before committing emergency flags to the cloud.

### 2. Optical Crowd & Anomaly Detection (`crowd_monitor_yolo.py`)
- **Real-time Machine Vision**: Processing live camera feeds utilizing lightweight **YOLOv8 Nano (YOLOv8n)** optimized for edge processing.
- **Precision Bounding Boxes**: Automatically tracks and counts unique human silhouettes (`class=0`) within the cabin frame.
- **Dynamic Anomaly Thresholds**: Flags overcrowding anomalies in real-time when cabin capacity surpasses established geometric limits, preventing suffocation risks and enabling crowd control maneuvers.

### 3. Cloud Synchronization Pipeline (Firebase RTDB)
- **Zero-Latency State Sync**: Utilizes Google Firebase Realtime Database for sub-100ms state propagation between transit vehicles and central monitoring stations via WebSocket bindings.

### 4. Interactive Live Admin Dashboard (`dashboard/`)
- **Dynamic GIS Mapping**: Built on pure **Vanilla JavaScript**, utilizing **Leaflet.js** and OpenStreetMap for real-time bus and cab coordinate plotting.
- **Automated Dispatch Routing**: Integrates routing routing algorithms (OSRM) to immediately calculate and trace the fastest geographical path between a distressed vehicle and the **nearest police station or hospital**.
- **Visual & Acoustic Emergency Override**: When an emergency flag triggers:
  - The dashboard background enters a high-contrast **Flashing Red Alert State**.
  - A continuous high-decibel **Siren Loop** plays automatically until an assigned dispatcher manually clicks the *Acknowledge & Disconnect* protocol button.

### 5. Multi-Channel Notification Gateway (`notification_service.py`)
- **Redundancy & Fallback**: Integrates directly with the **Twilio REST API** and **Telegram Bot API**. If a dashboard dispatcher is inactive, automated SMS alerts and voice calls with clickable GPS map links are dispatched immediately to local reaction forces and authorities.

---

## 🛠️ Technology Stack

| Architecture Layer | Main Technology | Purpose / Implementation Details |
| :--- | :--- | :--- |
| **Backend / AI Core** | **Python 3.10+** | Core runtime for simulated IoT edge processing, orchestration, and thread management. |
| **Computer Vision** | **YOLOv8 (Ultralytics) & OpenCV** | Frame extraction, visual processing, and high-speed multi-object person counting. |
| **Speech Processing** | **SpeechRecognition & PyAudio** | Acoustic streaming, PCM acoustic capture, and natural language keyword identification. |
| **Cloud Database** | **Firebase Realtime Database** | Low-latency state sync using `firebase-admin` (Python) and Firebase JS SDK (Browser). |
| **Frontend Dashboard**| **HTML5, CSS3, Vanilla JS** | Lightweight, framework-free single page reactive command interface with dark-mode glassmorphism styling. |
| **GIS / Mapping** | **Leaflet.js & OpenStreetMap** | Real-time vehicle marker tracking and automated routing to emergency response units. |
| **Alerting Fallback** | **Twilio API / Telegram API** | Third-party REST communications gateway for automated SMS broadcasts and webhook calls. |

---


## 🚀 Setup & Local Simulation Guide

### Prerequisites
- **Python 3.10** or higher installed on your operating system.
- **Node.js** (Optional, recommended for serving the frontend cleanly via `live-server`).
- A built-in laptop webcam or externally attached USB camera.
- A functional laptop microphone or headset audio input.
- A Google Firebase Account (Free Spark Plan is completely sufficient).

---

### Step 1: Clone & Repository Configuration
```bash
git clone https://github.com/YourUsername/Transport_Safety_AI.git
cd Transport_Safety_AI
```

### Step 2: Set Up Backend Virtual Environment
```bash
# Navigate to backend directory and initialize a virtual environment
cd backend
python -m venv venv

# Activate Virtual Environment (Windows PowerShell)
.\venv\Scripts\activate

# Activate Virtual Environment (macOS/Linux)
# source venv/bin/activate

# Install essential AI and Cloud packages
pip install -r requirements.txt
```

*(Sample `requirements.txt` preview):*
```text
opencv-python>=4.8.0
ultralytics>=8.0.0
SpeechRecognition>=3.10.0
pyaudio>=0.2.13
firebase-admin>=6.2.0
python-dotenv>=1.0.0
requests>=2.31.0
twilio>=8.5.0
```

### Step 3: Cloud Credentials & API Configurations
1. Navigate to the [Firebase Console](https://console.firebase.google.com/), create a new project named **Transport-Safety-AI**, and enable the **Realtime Database** in Test Mode.
2. Go to `Project Settings > Service Accounts` and generate a new private key block.
3. Save the downloaded `.json` file inside the `credentials/` folder as `firebase_service_account.json`.
4. Create your environment variables file at the project root by copying the template:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to include your Twilio/Telegram API credentials and Firebase Realtime Database URL.*

---

### Step 4: Execution & Simulation Testing

#### 1. Launch the Frontend Command Dashboard
Open a new terminal window at the project root and spin up the frontend interface:
```bash
cd dashboard
npx live-server .
```
> *Your browser will launch automatically at `http://localhost:8080` displaying the live Leaflet tracking map.*

#### 2. Launch the AI IoT Vehicle Simulation Node
In your activated backend terminal, execute the main edge node orchestrator:
```bash
cd backend
python main_node.py
```

---

## 🎯 How to Conduct a Live Project Demonstration

1. **Normal Transit Operation**: With both dashboard and backend running, the dashboard shows a green vehicle marker calmly traversing a simulated municipal bus route on the Leaflet map.
2. **Simulating an Overcrowding Event**: Aim the webcam towards multiple people (or display a high-density photo of a crowd on your smartphone to the webcam lens). Once detected persons exceed the configured threshold (e.g., > 5 persons), an **Amber Crowd Warning** propagates to the dashboard.
3. **Simulating a Critical SOS Emergency**: Speak clearly into the microphone: **"Bachao! Help!"** 
4. **Observing the Automated Reaction**:
   - Within milliseconds, the dashboard overrides into a **Flashing Red Critical State**.
   - The high-decibel **Siren Alarm** activates across the monitoring speakers.
   - An automated **Emergency Route** renders on the map, mapping the bus's present coordinate directly to the nearest mapped Police Station.
   - Simultaneously, check your registered phone/Telegram account for an incoming **automated emergency SMS/Call alert**.
5. **Dispatcher Acknowledgment**: Click the **[ACKNOWLEDGE ALERT & DISPATCH]** button on the dashboard modal to mute the acoustic siren and transition the incident to active management status.

---

## 📜 Academic Attribution & License

This system architecture and simulated prototype are designed as a 5th-Semester Engineering Minor Project illustrating the practical implementation of **Artificial Intelligence, Edge IoT Simulation, and Cloud Computing** toward achieving **United Nations SDG Goal 5**.

Distributed under the **MIT License**. See `LICENSE` for more information.
