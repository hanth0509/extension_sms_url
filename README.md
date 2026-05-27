# ShieldScan — Chrome Extension

Real-time SMS Spam & URL Phishing Detector powered by your local FastAPI backend.

---

## Project Structure

```
chrome-spam-detector/
├── manifest.json            # MV3 manifest
├── popup/
│   ├── popup.html           # Main popup UI (3 tabs)
│   ├── popup.css            # Dark cybersecurity theme
│   └── popup.js             # Tab + scanner controllers
├── background/
│   └── background.js        # Service worker
├── options/
│   ├── options.html         # Full-tab settings page
│   └── options.js           # Settings controller
├── services/
│   └── api.js               # API layer (retry, timeout, validation)
├── utils/
│   └── helpers.js           # Severity mapping, formatting, clipboard
└── assets/icons/            # Extension icons (16/32/48/128px)
```

---

## Features

- **SMS Scanner** — Paste any SMS, get spam probability + severity + recommendation
- **URL Scanner** — Analyze any URL for phishing with domain/SSL/risk details
- **Settings** — Configure backend & dashboard URLs, check server status
- **Open Dashboard** button — Quick link to your web dashboard
- Loading spinners, toast notifications, offline detection
- Retry on network failure (1 automatic retry)
- Copy Result to clipboard
- Input validation before every request
- `Ctrl+Enter` shortcut in SMS tab

---

## How to Load into Chrome

1. Open **chrome://extensions** in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `chrome-spam-detector/` folder
5. The extension icon appears in the toolbar — click to open

---

## Backend Requirements

Your FastAPI backend must be running at `http://127.0.0.1:8000` (default).

### Required CORS Configuration

Add this to your FastAPI `main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",   # Allow all Chrome extensions
        "http://localhost:3000",   # Dashboard (adjust if different)
    ],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)
```

> **Note:** `chrome-extension://*` is required. Chrome extensions have a unique origin
> (`chrome-extension://<extension-id>`), and your FastAPI server must explicitly allow it.

---

## API Endpoints Used

| Tab | Method | Endpoint |
|-----|--------|----------|
| SMS Scanner | POST | `/api/v1/predict-sms` |
| URL Scanner | POST | `/api/v1/predict-url` |

---

## Severity Levels (SMS)

| Spam Probability | Severity | Color |
|-----------------|----------|-------|
| ≥ 0.80 | Critical | Red |
| ≥ 0.60 | High | Orange |
| ≥ 0.40 | Medium | Yellow |
| < 0.40 | Safe | Green |

---

## Changing Backend URL

Either:
- Click the gear icon in the popup → Settings tab
- Or open Options page (right-click extension icon → Options)

---

## Keyboard Shortcuts

- `Ctrl+Enter` (or `Cmd+Enter`) in SMS textarea → runs analysis

---

## Troubleshooting

**Backend Unreachable:**
- Confirm FastAPI is running: `uvicorn main:app --reload`
- Check CORS is configured (see above)
- Verify URL in Settings (no trailing slash)

**Extension not showing:**
- Reload the extension at `chrome://extensions` after any code change
- Check for errors in the service worker at `chrome://extensions` → Details → Service Worker

**Icons not showing:**
- Ensure `assets/icons/` contains `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
