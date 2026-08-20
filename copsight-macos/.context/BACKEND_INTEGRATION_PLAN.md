# Backend Integration Plan: CopSight AI macOS (Render Free Tier)

**Date**: 2026-08-20  
**Target**: `copsight-macos` (`CopSight AI.app`)  
**Backend**: Node.js API Gateway (`http://localhost:8080/api` or `https://<render-subdomain>.onrender.com/api`) & Python FastAPI AI Service (`http://localhost:8005`)

---

## 1. Executive Summary & Design Principles

This plan outlines the minimal-footprint, resilient backend integration for the native macOS CopSight AI application.

### Key Architectural Pillars:
1. **Single-File API Layer (`APIService.swift`)**: Mirroring the web frontend's `frontend/src/lib/api.ts`, all networking, generic async/await requests, JWT Bearer injection, and namespaced endpoints reside in a single file `copsight-macos/Sources/CopSightAI/Services/APIService.swift`.
2. **100% UI Element & Feature Preservation**: Zero visual elements, cards, or dossiers will be removed. If an endpoint is not present on the backend, the UI seamlessly falls back to high-fidelity built-in data.
3. **Render Free-Tier Cold-Start Handling**: 60-second request timeout and background health ping on app launch to accommodate 30–50s spin-up times when the Render instance wakes from sleep.
4. **Keychain-Secured JWT Storage**: Authenticated JWT tokens stored securely via `KeychainManager`.
5. **Agent-Switchable Modularity**: Self-contained integration steps that can be implemented sequentially by any AI agent.

---

## 2. Available Endpoints & Mapping

| Backend Route Domain | Available Endpoints | Mapped macOS View | Fallback Behavior |
| :--- | :--- | :--- | :--- |
| **Authentication** | `POST /api/auth/login`<br>`GET /api/auth/me`<br>`POST /api/auth/logout` | `AuthGateView`<br>`OfficerProfileMenuButton` | Local credential matching |
| **Cases & Dockets** | `GET /api/cases`<br>`POST /api/cases`<br>`GET /api/cases/statistics` | `CaseGateView`<br>`CopSightCasesView` | Local case list |
| **Users & Directory** | `GET /api/users`<br>`GET /api/users/officers`<br>`GET /api/users/supervisors` | `AdminUserListView`<br>Searchable Officer Dropdown | Built-in officer list |
| **AI Analyst & Query** | `POST /api/query/case/:caseId`<br>`GET /api/query/case/:caseId/history` | `QueryInterfaceView` | Local semantic response |
| **Forensic Graph** | `GET /api/graph/case/:caseId/network`<br>`GET /api/graph/entity/:id/neighbors` | `NetworkGraphView` | Local entity topology |
| **Anomaly AI & ML** | `POST /api/analysis/anomalies`<br>`POST /api/analysis/pattern-recognition` | `AnomalyDetectionView` | Local anomaly models |
| **Cross-Case Intelligence**| `GET /api/cross-case/connections/:caseId`<br>`GET /api/cross-case/statistics` | `CrossCaseConnectionsView` | Local correlation matrix |
| **Server Health & Stats** | `GET /api/performance/health`<br>`GET /api/performance/metrics` | `AdminDashboardView` | Local CPU/RAM metrics |

*Features without dedicated backend endpoints (e.g. USB hardware radar, local bitstream acquisition) use local forensic daemons.*

---

## 3. Modular Implementation Steps

### Step 1: Consolidated `APIService.swift`
- Create `copsight-macos/Sources/CopSightAI/Services/APIService.swift` with:
  - Base URL configuration (Render URL or localhost).
  - Generic `request<T>()` with async/await, Bearer JWT header, and 60s timeout.
  - Namespaced API functions: `APIService.Auth`, `APIService.Cases`, `APIService.Users`, `APIService.Query`, `APIService.Graph`, `APIService.Analysis`, `APIService.CrossCase`, `APIService.Performance`.

### Step 2: Live Authentication Integration
- Wire `AuthGateView` to `APIService.Auth.login(username, password)`.
- Store JWT token in `KeychainManager`.
- Update `OfficerProfileManager.shared` with authenticated user profile.
- Maintain local credential fallback if server is unreachable.

### Step 3: Live Cases & Searchable Officer Directory
- Wire `CaseGateView` and `CopSightCasesView` to `APIService.Cases.getCases()`.
- Populate searchable officer dropdown in new case creation from `APIService.Users.getOfficers()`.

### Step 4: AI Analyst, Network Graph & Anomaly Intelligence
- Wire `QueryInterfaceView` to `APIService.Query.ask()`.
- Wire `NetworkGraphView` to `APIService.Graph.getNetwork()`.
- Wire `AnomalyDetectionView` to `APIService.Analysis.getAnomalies()`.
- Wire `CrossCaseConnectionsView` to `APIService.CrossCase.getConnections()`.

### Step 5: Admin Server Telemetry & Health Monitoring
- Wire `AdminDashboardView` to `APIService.Performance.getMetrics()`.
- Send non-blocking background health check on app startup.

---

## 4. Verification Checklist
- [ ] Swift package builds cleanly (`./build_app.sh`).
- [ ] Offline launch works with full fallback and 0 errors.
- [ ] Render URL connection authenticates and hydrates live cases.
