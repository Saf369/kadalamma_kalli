# 🌊 Kadalamma Kalli

> *"Write in the sand. Let the sea respond."*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-kadalammakalli.vercel.app-blue?style=for-the-badge&logo=vercel&logoColor=white)](https://kadalammakalli.vercel.app/)

An immersive, AI-powered interactive beach experience built with Next.js. Users write the phrase **"kadalamma kalli"** on a virtual sandy seashore, and Google Gemini's vision AI recognizes the handwriting — triggering real ocean wave animations as a living, breathing response.

---

## ✨ Features

- 🖐️ **Freehand Sand Drawing** — Draw directly on a video seashore using mouse or touch input, constrained to the sand region of the scene
- 🤖 **AI Handwriting Recognition** — Powered by Google Gemini's multimodal vision API, detecting the target phrase in real time
- 🌊 **Dynamic Wave Response** — Recognized text triggers choreographed wave milestones synced to a looping ocean video
- 🔊 **Ambient Audio Engine** — Toggleable ocean soundscape for full immersion
- 🎨 **Canvas Preprocessing Pipeline** — Smart image preprocessing before sending to Gemini, minimizing false positives on near-empty canvases
- 🐛 **Developer Debug Panel** — Lazy-loaded debug overlay showing recognition confidence, matched text, and pipeline state
- 📱 **Fullscreen Support** — Native fullscreen mode for a truly cinematic experience

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) with App Router |
| Language | TypeScript |
| UI | React 19 |
| Styling | Tailwind CSS v4 |
| 3D / WebGL | Three.js · React Three Fiber · Drei |
| AI Recognition | Google Gemini API (`@google/genai`) |
| Handwriting OCR | Tesseract.js (fallback preprocessing) |
| Icons | Lucide React |
| Animations | Canvas-Confetti |

---

## 🚀 Getting Started

### Prerequisites

- Node.js `>= 18`
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### Installation

```bash
# Clone the repository
git clone https://github.com/Saf369/kadalamma_kalli.git
cd kadalamma_kalli

# Install dependencies
npm install
```

### Environment Setup

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧠 How It Works

```
User draws on canvas
        │
        ▼
HandwritingPreprocessor
(noise filter · contrast boost · bounding crop)
        │
        ▼
/api/recognize-handwriting  ←──  Gemini Vision API
        │
        ▼
KadalammaKalliDetector
(confidence threshold · debounce · event emit)
        │
        ▼
VigorousSeaController
(video seek · wave milestone trigger · animation)
```

1. **Canvas Layer** — An HTML5 canvas overlaid on a looping ocean video lets the user draw freely in the sand region (below 45% of viewport height).
2. **Preprocessing** — `HandwritingPreprocessor` filters noise, boosts contrast, and crops to the bounding box before sending to the API to reduce token cost and improve accuracy.
3. **AI Detection** — `KadalammaKalliDetector` calls the `/api/recognize-handwriting` route, which submits the canvas image to Gemini and returns a structured `DetectionResult` with `recognizedText`, `confidence`, and `matched` flag.
4. **Wave Response** — On a successful match, `VigorousSeaController` advances the video through predefined wave milestones (`5.0s → 13.5s → 21.0s → 28.5s → 35.5s`), making the ocean "react" to the written phrase.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── recognize-handwriting/   # Gemini API route
│   ├── layout.tsx
│   └── page.tsx                     # Entry point
└── components/
    ├── VanillaBeachExperience.tsx   # Main experience orchestrator
    ├── BeachSeashoreExperience.tsx  # Alternative scene variant
    ├── SeashoreScene.tsx            # Three.js 3D scene
    ├── SandCanvasManager.ts         # Canvas drawing logic
    ├── AudioEngine.ts               # Web Audio API wrapper
    ├── vectorFont.ts                # Custom vector font rendering
    └── recognition/
        ├── KadalammaKalliDetector.ts    # AI detection pipeline
        ├── VigorousSeaController.ts     # Wave animation controller
        ├── HandwritingPreprocessor.ts   # Canvas image preprocessing
        └── DebugPanel.tsx               # Developer debug overlay
public/
└── we_want_to_loop_the_video_so_m.mp4  # Ocean background video
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production bundle |
| `npm run start` | Run the production server |
| `npm run lint` | Run ESLint |

---

## 📄 License

This project is private. All rights reserved.

---

<p align="center">Made with 🌊 and AI by <strong>Kadalamma Kalli</strong></p>
