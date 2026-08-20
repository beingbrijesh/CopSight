# CopSight AI — Native macOS Digital Forensic Workstation

CopSight AI is a native macOS digital forensics and intelligence analysis desktop application built with Swift and SwiftUI for police departments, law enforcement agencies, and cyber intelligence units.

---

## 🛡️ Key Features

- **Pure Credential-Based RBAC**: Direct login automatically routes Investigating Officers, Supervisors, and Root Administrators to their respective clearance dashboards.
- **Supervisor Intelligence Hub**: 4 audit modules for Chain of Custody SHA-256 seal verification, Examiner Activity telemetry stream, Case Allocation grid, and CJIS / ISO 27037 compliance.
- **Administrator System Operations**: Real-time infrastructure performance monitors (CPU cluster load, unified RAM, Milvus vector QPS, NVMe I/O) and master system activity logs with JSON/CSV export.
- **Searchable Case Docket Officer Assignment**: Search and assign lead officers with role badges when registering new case files.
- **AI Forensic Analyst**: Semantic evidence interrogation chat utilizing full-canvas layout with timeline correlation and source citations.
- **Interactive Forensic Network Graph**: Drag-and-drop entity topology canvas (Suspects, Crypto Wallets, Seized Devices, Geo-Pins, Databases) with encrypted relationship edges.
- **ForensixD Hardware Studio**: Live USB bus radar, 3-depth extraction wizard, live bitstream console, and decryption toolkit.
- **Global Ultra-Thin Scrollbars**: Floating 4px slim overlay scroll indicators styled cleanly inside the right margin across all pages.

---

## 📦 Software Tier Differentiation

| Application / Package | Target System | Primary Purpose | Release Asset |
|:---|:---|:---|:---|
| **CopSight AI macOS Workstation** | macOS 14+ (Apple Silicon) | Unified Native Digital Forensics Workstation & AI Intelligence Suite | `CopSight-AI-macOS-v*.dmg` / `.zip` |
| **ForensixD macOS Extractor** | macOS 10.15+ (Universal) | Standalone Hardware Data Extraction & Bitstream Acquisition Tool | `ForensixD-Extractor-macOS-v*.dmg` |
| **ForensixD CLI Engine** | Linux, macOS, Windows | Command-line scriptable forensic ingestion binary | `forensixd-linux/windows/macos` |

---

## 🛠️ Building & Packaging Locally

### Prerequisites
- macOS 14.0 or later
- Xcode 15.0+ or Swift 5.9+ toolchain

### Build Commands
```bash
# Clone and enter the macos project directory
cd copsight-macos

# Build debug app bundle
./build_app.sh

# Build production release DMG and ZIP
./build_app.sh --release 1.0.0
```

The output application bundle and DMG installer will be created in `copsight-macos/dist/`.
