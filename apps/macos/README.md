# CopSight macOS Desktop Application

A standalone, dedicated forensic acquisition desktop client for macOS (Apple Silicon & Intel).

## Architecture & Security Workflow

1. **Stage 1: Mandatory Officer Authentication Gate (`AuthGate.tsx`)**
   - On application launch, only the Officer Login Gate is accessible.
   - Enforces authentication against CopSight central backend (`/api/auth/login`) or secure local hardware key.
   - Automatically establishes an End-to-End Session Encryption key.

2. **Stage 2: Assigned Case Selection Portal (`CaseGate.tsx`)**
   - Fetches officer's assigned cases (`/api/cases`).
   - Investigating officer selects an active assigned case (e.g. `UFDR-2026-0891`).
   - Binds the forensic custody chain to the selected case before advancing.

3. **Stage 3: Real Forensic Investigation Workspace (`Workspace.tsx`)**
   - **Context Bar**: Officer Badge, Rank, Name, Active Case #.
   - **Device Radar**: Real-time USB hardware polling for iOS, Android, and Mass Storage targets.
   - **Acquisition Wizard**: Deep extraction level selector (Logical, File System, Physical) & targeted profile filters (Textual, Media, Deleted, All).
   - **Live Streaming Console**: Real-time WebSocket terminal output, dual progress bars, throughput speed meters (MB/s), and SHA-256 cryptographic hash verification.
   - **Evidence & Report Center**: UFDR container export (.ufdr), DFXML export, and court-admissible PDF forensic reports.

## Local Development

```bash
# 1. Start Local Daemon Engine
PYTHONPATH=. python3 -m apps.macos.daemon.server --port 54322

# 2. Start Frontend Dev Server
cd apps/macos
npm install
npm run dev
```

## Production macOS Packaging (.app & .dmg)

```bash
python3 apps/macos/scripts/build_macos_app.py v2.0.27
```
Output bundle: `dist/CopSight.app` and `dist/CopSight-macOS-v2.0.27.dmg`.
