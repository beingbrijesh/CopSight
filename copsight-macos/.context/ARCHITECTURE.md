# CopSight AI - Architecture & Performance Guidelines

**Target:** macOS 14.0+ / 15.0+  
**Framework:** Native SwiftUI 6.0 + SwiftPM  
**Package:** `copsight-macos` (`com.copsight.unified.macos`)

---

## 1. Core Principles
1. **Fully Native App:** 100% native macOS SwiftUI client avoiding WebViews/Electron to ensure minimal RAM and lightning-fast responsiveness.
2. **Minimal Footprint:**
   - Use `structs` over `classes` (value semantics) to minimize heap allocations and ARC overhead.
   - Use `LazyVGrid` and `ScrollView` for efficient list rendering.
   - Utilize Swift `@Observable` / `@State` for targeted UI invalidation rather than full view re-renders.
3. **High Performance Components:**
   - **Network Graph:** Interactive SwiftUI Canvas with draggable nodes, spring animations, and risk inspector.
   - **Device Radar:** `TimelineView` + `Canvas` rendering 85% high-contrast sweep beam with glowing phosphor leading edge.
   - **Daemon/USB:** Native macOS `IOKit` wrapped in Swift (`IOKitEngine.swift`) for hardware detection.

---

## 2. Directory & File Map

```
copsight-macos/
├── Package.swift                                      # Swift Package Manager manifest
├── build_app.sh                                       # Bundle creation & packaging script
├── Sources/
│   └── CopSightAI/
│       ├── App/
│       │   └── CopSightApp.swift                      # Application entry point & Dock icon binding
│       ├── Resources/
│       │   ├── AppIcon.icns                           # Multi-resolution macOS AppIcon bundle
│       │   └── copsight_logo.png                      # High-resolution brand logo asset
│       ├── Theme/
│       │   └── CopSightTheme.swift                    # Design tokens, ThemeManager & Color Palette
│       ├── Stores/
│       │   ├── KeychainManager.swift                  # Secure enclave credential storage
│       │   └── OfficerProfileManager.swift            # Observable officer profile, local storage & RBAC
│       ├── Services/
│       │   └── ForensicNotificationManager.swift      # macOS UserNotifications & forensic alert engine
│       ├── Views/
│       │   ├── Splash/
│       │   │   └── SplashView.swift                   # Animated brand splash screen
│       │   ├── Auth/
│       │   │   └── AuthGateView.swift                 # FIPS authorization credential gate
│       │   ├── CaseGate/
│       │   │   └── CaseGateView.swift                 # Case dossier selector & search
│       │   ├── Workspace/
│       │   │   └── WorkspaceView.swift                # Master workspace & floating 72pt navbar
│       │   ├── Components/
│       │   │   ├── CopSightLogoView.swift             # Universal brand logo badge component
│       │   │   ├── GlassPanelView.swift               # NSVisualEffectView glassmorphic container
│       │   │   ├── OfficerProfileMenuButton.swift     # Interactive profile & RBAC popover menu
│       │   │   └── ToastNotificationView.swift        # Forensic system toast notification banners
│       │   ├── CopSight/
│       │   │   ├── Dashboard/
│       │   │   │   └── CopSightDashboardView.swift    # Intelligence KPIs, action cards & supervisor launcher
│       │   │   ├── IO/
│       │   │   │   └── NetworkGraphView.swift         # Interactive forensic entity network graph (Zoom/Pan/Traversal)
│       │   │   ├── CrossCase/
│       │   │   │   └── CrossCaseConnectionsView.swift # Multi-case correlation & AI dossiers
│       │   │   ├── Anomaly/
│       │   │   │   └── AnomalyDetectionView.swift     # Multi-model AI anomaly detection (XGBoost/DNN/LSTM/IF)
│       │   │   ├── Cases/
│       │   │   │   └── CopSightCasesView.swift        # Case dossiers & evidence lockers
│       │   │   ├── Queries/
│       │   │   │   └── QueryInterfaceView.swift       # AI Natural Language Analyst RAG chatbox
│       │   │   └── Supervisor/
│       │   │       └── SupervisorAuditView.swift      # Chain of Custody, examiner telemetry & case allocation
│       │   └── ForensixD/
│       │       ├── ForensixDDashboardView.swift       # Extraction overview, radar & console
│       │       ├── DeviceRadarView.swift              # Hardware sweep beam & hover inspector
│       │       ├── AcquisitionWizardView.swift        # Extraction depth & filter parameters
│       │       ├── LiveConsoleView.swift              # Real-time bitstream forensic log stream
│       │       ├── ForensixDDevicesView.swift         # APFS partition map & USB bus topology
│       │       ├── ForensixDAcquisitionStudioView.swift # Real-time artifact carving queue
│       │       ├── EvidenceViewerView.swift           # UFDR container evidence explorer
│       │       ├── DecryptionToolkitView.swift        # Keybag brute-force & crypto toolkit
│       │       └── ForensicSettingsView.swift         # RPC daemon & station configuration
```

---

## 3. Role-Based Access Control (RBAC) Architecture
The system enforces 4 clearance tiers:
1. **Level 2: Forensic Examiner (`.examiner`)**: Device extraction, bitstream carving, SQLite decryption, local AI queries.
2. **Level 3: Lead Investigator (`.leadInvestigator`)**: Cross-case intelligence correlation, anomaly triage, entity synthesis.
3. **Level 4: Unit Supervisor (`.supervisor`)**: Chain of custody verification, examiner activity logs, investigator workload re-allocation, CJIS audit export.
4. **Level 5: Root Administrator (`.systemAdmin`)**: Full station administration, hardware daemon configuration, unrestricted access.

---

## 4. Design System & Dimensions

- **Themes**:
  - `Oceanic Blue (Light)`: Background `#0B2F4C`, Panels `#174A72`, Accent Coral `#FF7A59`, Icon BG `rgba(0,0,0,0.35)`.
  - `Minimal Dark (Dark)`: Background `#0A0A0C`, Panels `#1A1A22`, Accent White/Emerald, Icon BG `rgba(255,255,255,0.12)`.
- **Corner Radii & Geometry**:
  - Navbar Height: `72pt`
  - Floating Nav Corner Radius: `24pt` (`CopSightTheme.navRadius`)
  - Glass Card Corner Radius: `32pt` (`CopSightTheme.panelRadius`)
  - Inner Buttons / Inputs: `12pt` - `16pt` (`CopSightTheme.buttonRadius` / `innerRadius`)

---

## 4. Build & App Packaging Pipeline (`build_app.sh`)
- Compiles executable via `swift build`.
- Generates `CopSight AI.app` bundle directory structure.
- Copies executable and resources (`AppIcon.icns`, `copsight_logo.png`).
- Generates `Info.plist` with `CFBundleIconFile` pointing to `AppIcon`.
- Binds runtime dock icon in `CopSightApp.swift` via `NSApplication.shared.applicationIconImage`.
