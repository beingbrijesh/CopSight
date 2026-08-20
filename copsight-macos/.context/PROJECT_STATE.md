# CopSight AI - Project State & System Overview

**Last Updated:** August 20, 2026  
**Active Application:** `CopSight AI.app` (macOS 14/15 Native Universal Binary)  
**Location:** `/Users/beingbrijesh/Desktop/Projects/UFDR/copsight-macos`  
**Current Phase:** Phase 7 (Packaging, Release Automation & Production Readiness)

---

## 1. System Mission & Core Modules
The **CopSight AI / ForensixD** platform is a high-performance, native digital forensics and intelligence analysis ecosystem built for law enforcement and digital forensic examiners.

### Active App Modules:
1. **Administrator Station Mode (`AdminDashboardView`, `AdminSystemLogsDossierView` & `AdminUserListView`)**:
   - **Dashboard**: 4 live infrastructure performance gauges (CPU cluster load, unified RAM, Milvus vector QPS, NVMe I/O), security profile card, master system activity & security logs stream (with severity & subsystem filters, search, and JSON/CSV export), 99.9% uptime gauge, database and API status.
   - **System Event Chain & Logs Dossier (`AdminSystemLogsDossierView`)**: Comprehensive chronological audit timeline showing every system event, hardware socket connection, auth attempt, RPC latency spike, error diagnostic, and cryptographic HMAC SHA-256 seal.
   - **User Accounts & RBAC**: Full system user table with search, role filters (`Admin`, `Supervisor`, `Investigating Officer`), "Add System User" modal, "Edit Profile" modal, "Reset Password" modal, and account active/disabled toggle.
   - **Case Management**: Full case dossier list with exclusive authority to register and create new case dockets (`CreateCaseModalView`) with searchable lead officer dropdown.
   - **Station Settings**: Cryptographic keybags, hardware RPC daemon, and system configuration.
2. **Supervisor Intelligence & Command Mode (`SupervisorAuditView`)**:
   - **Supervisor Hub**: 4 audit tabs: Chain of Custody SHA-256 seal verification, Examiner Activity telemetry stream, Case Allocation grid with re-assignment, CJIS/ISO 27037 report export.
   - **Clean In-Page Dashboard**: Clean native header with "New Window" action and zero redundant modal close buttons.
   - **Case Dossiers**: Read-only investigation case access and dossier review (new case creation restricted to Admin).
   - **Cross-Case Intelligence**: Multi-FIR correlation engine detecting shared crypto wallets, burner phones, TAC IMEI series, and spatiotemporal dead-drop overlaps.
   - **Anomaly AI & Analyst**: Deep learning anomaly detection and full-canvas natural language forensic analyst chat.
3. **Investigating Officer Mode (`CopSightDashboardView` & `ForensixDDashboardView`)**:
   - **CopSight Intelligence**: 4 evenly-distributed forensic KPI cards (`LazyVGrid`), 6 quick action launchers (spanning 100% width in 3x2 on full screen), active investigation stage pipeline tracker.
   - **Entity Network Graph (`NetworkGraphView`)**: Interactive 2D canvas with draggable forensic entities (Suspects, Seized Device, Crypto Wallets, Geo-Pins, Databases, Comms), relationship edges with encryption styles, search/filter pills, zoom/pan gesture controls, on-canvas HUD toolbar, node auto-centering traversal, and live entity inspector sidebar.
   - **AI Analyst Chat (`QueryInterfaceView`)**: Full-canvas expansion (100% available workspace geometry), auto-scrolling timeline correlation, and evidence source citations.
   - **ForensixD Extraction Studio**: Overview dashboard, device radar with high-contrast 85% sweep beam, 3-depth extraction wizard, live bitstream console, APFS/NVMe USB hardware explorer, decryption suite, and evidence viewer.
4. **Multi-Window & Session Services**:
   - **Multi-Window Engine (`WindowManager`)**: Native macOS multi-window support allowing examiners and admins to open ForensixD, AI Analyst, Network Graph, System Event Logs Dossier, Supervisor Hub, and Case Dossiers in independent native `NSWindow` instances with standard macOS traffic light controls.
   - **Authentication Gate (`AuthGateView`)**: Clean credential login without manual role buttons. Verifies officer credentials and automatically redirects to the respective role's dashboard (`/admin`, `/supervisor`, `/io`).
   - **Push Notification Service (`ForensicNotificationManager`)**: Native macOS `UserNotifications` integration with instant notifications for acquisition completions, cross-case hits, and custody events.
   - **Role-Based Access Control (`OfficerProfileManager`)**: 3-tier security clearance model (`admin`, `supervisor`, `investigating_officer`) strictly gating sensitive evidence management and audit features.
   - **Global Thin Scrollbar (`ThinScrollerHelper`)**: 4px floating overlay scroll indicator styled inside the right margin across all pages and profiles, overriding thick 16px legacy mouse scrollbars.

---

## 2. Component Readiness Matrix

| Component / Screen | Status | Key Features Delivered |
|---|---|---|
| **Splash Screen (`SplashView`)** | ✅ Production | Brand logo integration, smooth 2.5s auto-transition to AuthGate |
| **Authentication (`AuthGateView`)** | ✅ Production | FIPS-compliant login card, credential-driven RBAC verification & automatic dashboard redirection |
| **Case Selection (`CaseGateView`)** | ✅ Production | Multi-case grid, real-time search, integrated Officer Profile menu, thin scrollbar |
| **Floating Navbar (`WorkspaceView`)** | ✅ Production | 72pt height, explicit `Capsule` mode switcher, role-specific nav tabs, 60fps instant switching |
| **Admin Dashboard (`AdminDashboardView`)** | ✅ Production | 4 infrastructure performance gauges, system activity & security logs stream (JSON/CSV export), security profile, master audit dossier launcher |
| **Admin User List (`AdminUserListView`)** | ✅ Production | Dedicated User Accounts tab, search/filter by role, Add User modal, Edit User modal, Reset Password modal |
| **CopSight Cases (`CopSightCasesView`)** | ✅ Production | Multi-case grid, FIR search, status pills, "New Case File" creation modal gated to Admin with searchable officer dropdown |
| **Supervisor Audit Hub (`SupervisorAuditView`)** | ✅ Production | 4 audit tabs (Custody, Activity, Allocation, Compliance), full vertical scrolling without clipping, styled "Close Dossier" button |
| **CopSight Dashboard (`CopSightDashboardView`)** | ✅ Production | 4-KPI & 6-Action cards evenly spanning 100% width on full screen (4x1 & 3x2), responsive reflow, zero focus artifacts |
| **Push Notification Service (`ForensicNotificationManager`)** | ✅ Production | Native macOS `UserNotifications` integration with instant notifications for acquisition completions, cross-case hits, and custody events |
| **Network Graph (`NetworkGraphView`)** | ✅ Production | Interactive 2D canvas, draggable nodes, edge glows, gesture zoom/pan, HUD toolbar, node auto-centering traversal, inspector corner clipping, responsive icon/text filter pills |
| **Cross-Case Intelligence (`CrossCaseConnectionsView`)** | ✅ Production | Inter-FIR correlation engine, 4 metric cards, strength badges, AI analysis dossiers, evidence citations, direct graph link |
| **AI Anomaly Detection (`AnomalyDetectionView`)** | ✅ Production | 4 AI engines (XGBoost, DNN, LSTM, Isolation Forest), Donut distribution chart, confidence ranking, evidence record drawer |
| **AI Analyst Chat (`QueryInterfaceView`)** | ✅ Production | Full-canvas 100% screen utilization, auto-scroll to latest response, blinking caret, source citations |
| **ForensixD Dashboard (`ForensixDDashboardView`)** | ✅ Production | 500pt aligned cards, high-contrast radar beam, responsive vertical stacking, zero focus bleed |
| **Acquisition Studio (`ForensixDAcquisitionStudioView`)** | ✅ Production | Non-scrollable wizard with full scope visibility, real-time carving queue |
| **Device Radar & Telemetry (`DeviceRadarView`)** | ✅ Production | 85% conic sweep gradient, compact badges, rich hover hardware inspector |
| **USB Device Manager (`ForensixDDevicesView`)** | ✅ Production | Responsive topology map, APFS/NVMe partition table, IOKit RPC status |
| **Profile & RBAC Manager (`OfficerProfileManager`)** | ✅ Production | 3 clearance tiers (`Admin`, `Supervisor`, `Investigating Officer`), editable preferences in `UserDefaults`, zero popover focus bleed |
| **Dock App Icon (`AppIcon.icns`)** | ✅ Production | Pure white squircle icon bound via `Info.plist` and `NSApplication` on startup |
| **Brand Logo Badge (`CopSightLogoView`)** | ✅ Production | Circular dark grey border (`#5C5C5C`), solid pure white disc, centered logo at 73% scale with clean breathing room |
| **Global Thin Scrollbar (`ThinScrollerHelper`)** | ✅ Production | 4px slim overlay scroll indicator inside margin across all profiles and scrollviews |
| **Release CI/CD Workflow (`copsight-macos.yml`)** | ✅ Production | Automated build, DMG installer generation, and GitHub Release deployment with artifact differentiation |

---

## 3. Software Tier & Package Differentiation

| Application / Package | Target System | Primary Purpose | Release Asset |
|:---|:---|:---|:---|
| **CopSight AI macOS Workstation** | macOS 14+ (Apple Silicon) | Unified Native Digital Forensics Workstation & AI Intelligence Suite | `CopSight-AI-macOS-v*.dmg` / `.zip` |
| **ForensixD macOS Extractor** | macOS 10.15+ (Universal) | Standalone Hardware Data Extraction & Bitstream Acquisition Tool | `ForensixD-Extractor-macOS-v*.dmg` |
| **ForensixD CLI Engine** | Linux, macOS, Windows | Command-line scriptable forensic ingestion binary | `forensixd-linux/windows/macos` |
