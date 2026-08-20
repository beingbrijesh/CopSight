# CopSight AI - Detailed Phase Plan

### Phase 1: Foundation
- [x] Scaffold `CopSightAI` Swift Package (macOS 14/15.0+).
- [x] Set Bundle ID `com.copsight.unified.macos`.
- [x] Setup Design System (Ocean Blue, Onyx Black, Coral, JetBrains Mono, Custom GlassPanel overlay).

### Phase 2: App Shell, Theming & Onboarding
- [x] Build Splash/Onboarding Screen with smooth timed transition.
- [x] Build AuthGate with KeyChain integration, brand logo, and responsive inputs.
- [x] Build CaseGate with multi-column glassmorphism layout, search, and profile menu.

### Phase 3: IOKit Forensic Engine & Stores
- [x] Create `IOKitEngine` Swift wrapper for USB scanning.
- [x] Implement `AsyncStream` based event publisher for USB connections/disconnections.
- [x] Implement Keychain secret storage for session tokens.
- [x] Implement `OfficerProfileManager` with local `UserDefaults` persistence.

### Phase 4: ForensixD Mode UI
- [x] Build Workspace Shell & Mode Switcher (`[FORENSIXD | COPSIGHT]`).
- [x] Dashboard with dynamic Step 1/2/3 banners, stat counters, and deliverable summaries.
- [x] Device Radar (`TimelineView`/`Canvas` sweep animation) & Hardware Diagnostic parameters.
- [x] Acquisition Studio (`AcquisitionWizardView` & `LiveConsoleView` with 500pt non-scrollable layout).
- [x] Evidence & Forensic Triage Center (`EvidenceViewerView` with UFDR, Chats, and Entities).
- [x] Decryption Toolkit (`DecryptionToolkitView` with all 6 attack vectors).
- [x] Forensic Settings (`ForensicSettingsView` with editable profile and daemon health diagnostics).

### Phase 5: CopSight Mode — IO Features & Responsiveness Polish
- [x] Query Interface (`QueryInterfaceView` with visible blinking caret, tap-to-focus, and continuous 32pt corner radius).
- [x] Network Graph (`NetworkGraphView` 2D interactive canvas with draggable nodes, relationship edges, zoom/pan gestures, HUD toolbar, node auto-centering traversal, and 32pt corner clipping).
- [x] Cross-Case Intelligence (`CrossCaseConnectionsView` with inter-FIR correlation engine, AI dossiers, and citations).
- [x] AI Anomaly Detection (`AnomalyDetectionView` with XGBoost, Universal DNN, LSTM Autoencoder, Isolation Forest, Donut chart, and evidence record drawer).
- [x] CopSight Dashboard (`CopSightDashboardView` with 4-KPI & 6-Action cards evenly spanning 100% width on full screen and responsive 2-col/1-col reflow).
- [x] Floating Navbar (`WorkspaceView` with clean `Capsule` mode switcher and 6 subtabs).
- [x] Brand Logo Badge (`CopSightLogoView` scaled to 86% with pure white circular background, no hexagon frame).
- [x] Case Management (`CopSightCasesView` with search, filters, and forensic dossiers).
- [x] Toast Notification System (`ToastNotificationView`).
- [x] Dynamic responsive card stacking on narrow window sizes across all views.
- [x] Pure white squircle Dock Icon (`AppIcon.icns`) and runtime `NSApplication` binding.

### Phase 6: CopSight Mode — Admin & Supervisor Features
- [x] Admin User/Case management grids (`SupervisorAuditView.swift` with interactive re-assignment).
- [x] Supervisor dashboards and audit dossiers (Chain of Custody SHA-256 seal verification, examiner telemetry logs, CJIS compliance).
- [x] Push & Local Notifications integration (`ForensicNotificationManager.swift` with native macOS `UserNotifications`).
- [x] Role-Based Access Control (RBAC) with 4 security clearance tiers (`OfficerRole`, `ForensicPermission`).

### Phase 7: Optimization & Polish
- [ ] Profiling and memory validation.
- [ ] App packaging / DMG creation.

