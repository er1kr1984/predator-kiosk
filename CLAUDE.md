# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Predator Kiosk** — a self-service store room kiosk for checking out and returning IT assets. It integrates with:
- **Snipe-IT** (asset management — source of truth for all assets and users)
- **AXIS Camera Station Pro (ACS)** (pushes checkout/return events to DataSearch so they appear alongside camera footage)

## Commands

```bash
# Development (runs both backend on :3001 and frontend on :5173 with hot reload)
npm run dev

# Individual processes
npm run dev:backend    # nodemon backend/server.js
npm run dev:frontend   # vite dev server (proxies /api → localhost:3001)

# Production build (outputs to frontend/dist, served by Express in production)
npm run build

# Start production server
npm start              # node backend/server.js (serves built frontend + API)

# Deploy to any server via SSH (prompts for password)
python deploy.py <host> <user>
# Example:
python deploy.py 172.25.192.27 erikr
```

There are no tests.

## Architecture

### Request flow
```
Browser → Vite dev proxy (:5173) → Express backend (:3001) → Snipe-IT API
                                                            → ACS Pro API
```
In production, Express serves `frontend/dist` as static files and handles all `/api/*` routes.

### Backend (`backend/server.js`)
Single-file Express server. All configuration lives in `backend/config.json` (runtime-editable via the admin UI — never requires a restart). Key patterns:

- `loadConfig()` / `saveConfig()` — read/write `config.json` on every request (no in-memory config cache)
- `requireAdmin(req, res)` — checks `req.body.adminUsername` or `req.query.adminUsername` against `config.adminUsers[]`; used to gate all admin endpoints
- `sendToAcs(config, {...})` — fire-and-forget POST to ACS `ExternalDataFacade/AddExternalData`; skipped silently if `acsEnabled` is false or credentials are missing
- ACS uses self-signed certs — all ACS axios calls use `httpsAgent: acsAgent` (`rejectUnauthorized: false`)
- Snipe-IT auth: the `/api/auth/login` endpoint scrapes the Snipe-IT web login to validate user credentials (the API token doesn't expose a login endpoint), then looks up the user record via the admin API token

### Frontend (`frontend/src/`)
React 18 + React Router + Tailwind CSS, built with Vite.

**Pages:**
- `LoginPage` — validates against Snipe-IT via `/api/auth/login`; stores `kioskUser` and `kioskIsAdmin` in `sessionStorage`
- `KioskPage` — the main kiosk interface; manages a scan→basket→duration→process→success flow using a local `STATES` enum
- `AdminPage` — settings UI for Snipe-IT credentials, camera, ACS, duration presets, admin users

**Key frontend patterns:**
- `sessionStorage` holds the logged-in user (`kioskUser` as JSON, `kioskIsAdmin` as string `'true'/'false'`)
- `localStorage` holds `kioskTourDone` (suppresses the onboarding tour after first use)
- All API calls go through `frontend/src/api.js` (axios instance with `baseURL: '/api'`)
- `useQRScanner` hook (`frontend/src/hooks/useQRScanner.js`) handles both webcam (via `getUserMedia`) and AXIS camera (via snapshot polling). Uses the native `BarcodeDetector` API (Chrome/Edge) for multi-format support with `jsqr` as QR-only fallback. Scans the centre 50% crop of each frame for speed.
- `ThemeContext` / `ThemeToggle` provide dark mode; preference persisted in `localStorage`
- `KioskTour` component (`frontend/src/components/KioskTour.jsx`) — SVG spotlight overlay tour, shown on first use, re-triggerable via `?` button

### Camera support
Two modes, set in admin config:
- `webcam` — `getUserMedia` in browser, QR scanning done client-side
- `axis` — backend proxies MJPEG stream and JPEG snapshots from the AXIS camera URL (credentials in config); frontend polls `/api/camera/snapshot` for scanning

### ACS integration
ACS `AddExternalData` payload uses `DataType: 'Text'` for all fields (Asset, Tag, Serial, User, Action, Due). The source key must be pre-registered in ACS Pro client under Configuration → External Data Sources before events will be accepted. The `acsSourceKey` in config must match exactly.

## Config fields (`backend/config.json`)
| Field | Purpose |
|---|---|
| `snipeItUrl` | Base URL of Snipe-IT instance |
| `snipeItToken` | Admin API token (used for all asset/user lookups) |
| `cameraType` | `'webcam'` or `'axis'` |
| `cameraStreamUrl` / `cameraSnapshotUrl` | AXIS camera URLs |
| `acsEnabled` | Toggle ACS event sending |
| `acsUrl` / `acsUsername` / `acsPassword` | ACS Pro server credentials |
| `acsSourceKey` | External data source key registered in ACS |
| `adminUsers` | Array of Snipe-IT usernames with admin access |
| `durationPresets` | Checkout duration options shown in kiosk UI |

## Production
- Express runs on `localhost:3001` via PM2; nginx reverse-proxies HTTPS 443 → 3001
- Port 3001 is blocked externally; only 80 (redirect) and 443 (HTTPS) are open
- Self-signed cert lives at `/etc/ssl/predator-kiosk/cert.pem` — install into trusted roots to remove browser warning

### First deploy on a new server
```bash
git clone https://github.com/er1kr1984/predator-kiosk /opt/predator-kiosk
cd /opt/predator-kiosk
bash setup.sh
nano backend/config.json   # fill in Snipe-IT URL/token and other settings
```
`setup.sh` installs Node.js, PM2, nginx, generates the SSL cert, configures the firewall, and starts the app.

### Updating an existing server
```bash
cd /opt/predator-kiosk
git pull
cd frontend && npm run build && cd ..
pm2 restart predator-kiosk
```

### deploy.py (alternative)
`python deploy.py <host> <user>` does the same as above but driven from your local machine over SSH — useful if you can't SSH in interactively. Requires `pip install paramiko`.

## Branding / version
- App is branded **E2E Storeroom Kiosk**; the `E2E` badge and version number appear on both the login page and the kiosk header
- Version is read at build time from `frontend/package.json` via `import { version } from '../../package.json'` — bump it there for releases
