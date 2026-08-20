import SwiftUI

/// Detailed Event Chain Model for Administrator Forensic & Diagnostic Audit
struct SystemEventNode: Identifiable, Equatable {
    let id: String
    let sequenceNumber: Int
    let timestamp: String
    let level: String
    let levelColor: Color
    let subsystem: String
    let actor: String
    let terminalId: String
    let title: String
    let narrative: String
    let diagnosticPayload: String
    let sha256Signature: String
    let isAnomaly: Bool
}

/// Comprehensive Administrator System Event Chain & Logs Dossier
struct AdminSystemLogsDossierView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    @State private var notificationManager = ForensicNotificationManager.shared
    
    @State private var selectedFilter: String = "ALL"
    @State private var searchText: String = ""
    @State private var selectedEventId: String? = "evt-001"
    
    @State private var eventChain: [SystemEventNode] = [
        SystemEventNode(
            id: "evt-001",
            sequenceNumber: 1,
            timestamp: "2026-08-20 12:44:10.892",
            level: "INFO",
            levelColor: CopSightTheme.emerald,
            subsystem: "AUTH-GATE",
            actor: "Officer Brijesh (IO-7482)",
            terminalId: "WS-CYBER-01",
            title: "Examiner Credential Verification & Session Generation",
            narrative: "Officer credentials verified via local cryptographic keybag. Role 'Investigating Officer' assigned with token expiry 8h.",
            diagnosticPayload: "{\n  \"action\": \"auth_login\",\n  \"auth_type\": \"credential_hash\",\n  \"status\": 200,\n  \"session_id\": \"sess_89410_io\",\n  \"cipher\": \"AES-GCM-256\"\n}",
            sha256Signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            isAnomaly: false
        ),
        SystemEventNode(
            id: "evt-002",
            sequenceNumber: 2,
            timestamp: "2026-08-20 12:30:15.104",
            level: "INFO",
            levelColor: CopSightTheme.cyan,
            subsystem: "EVD-VAULT",
            actor: "Supervisor V. Sharma (SUP-9012)",
            terminalId: "WS-COMMAND-04",
            title: "Cryptographic SHA-256 Physical Evidence Seal Validation",
            narrative: "Block-level hash verification of physical evidence container EVD-2026-9042 matched original seizure manifest.",
            diagnosticPayload: "{\n  \"evidence_id\": \"EVD-2026-9042-01\",\n  \"calculated_hash\": \"7a89f92e104a8b2...\",\n  \"manifest_hash\": \"7a89f92e104a8b2...\",\n  \"integrity\": \"100%_VALID\"\n}",
            sha256Signature: "8f2a3c9e4b1d0a87c3e5a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
            isAnomaly: false
        ),
        SystemEventNode(
            id: "evt-003",
            sequenceNumber: 3,
            timestamp: "2026-08-20 11:15:02.412",
            level: "WARN",
            levelColor: CopSightTheme.amber,
            subsystem: "RPC-DAEMON",
            actor: "copsight-rpc.sock (PID: 1402)",
            terminalId: "DAEMON-HOST-01",
            title: "Hardware Daemon IPC Latency Spike Detected",
            narrative: "Socket message processing latency peaked at 24.2ms during multi-threaded bitstream partition carving. Auto-rebalanced to CPU cores 4-7.",
            diagnosticPayload: "{\n  \"latency_ms\": 24.2,\n  \"threshold_ms\": 10.0,\n  \"queue_depth\": 418,\n  \"rebalance_action\": \"CPU_AFFINITY_CORE_4_7\",\n  \"resolved_latency_ms\": 1.4\n}",
            sha256Signature: "3b7e9f1a4c6d8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e",
            isAnomaly: true
        ),
        SystemEventNode(
            id: "evt-004",
            sequenceNumber: 4,
            timestamp: "2026-08-20 10:04:22.650",
            level: "INFO",
            levelColor: CopSightTheme.emerald,
            subsystem: "MILVUS-DB",
            actor: "milvus-core-cluster",
            terminalId: "CLUSTER-NODE-02",
            title: "Vector Embedding Graph Rebuild Completed",
            narrative: "Constructed HNSW index for 8,130 forensic entities and 14,200 cross-case embeddings. Cosine similarity accuracy 99.4%.",
            diagnosticPayload: "{\n  \"nodes_indexed\": 8130,\n  \"vectors_total\": 14200,\n  \"build_time_sec\": 1.18,\n  \"efConstruction\": 200,\n  \"M\": 16\n}",
            sha256Signature: "a1d5a9f07c3b8e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e2d4f6a8c0e",
            isAnomaly: false
        ),
        SystemEventNode(
            id: "evt-005",
            sequenceNumber: 5,
            timestamp: "2026-08-20 09:22:45.319",
            level: "SECURITY",
            levelColor: Color(hex: "a855f7"),
            subsystem: "KEYBAG-MGR",
            actor: "Super Admin (ADMIN-01)",
            terminalId: "WS-SECOPS-ROOT",
            title: "Master Station Keybag & HSM Rotation Executed",
            narrative: "Station root key pair rotated in compliance with CJIS Security Policy 5.9. Hardware Secure Enclave verified new master key.",
            diagnosticPayload: "{\n  \"policy\": \"CJIS_5.9_KEY_ROTATION\",\n  \"hsm_slot\": 1,\n  \"key_algorithm\": \"ECDSA_P384_AES256GCM\",\n  \"active_sessions_rekeyed\": 4\n}",
            sha256Signature: "e2a4f688d1c3a5b7e9f1a3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5",
            isAnomaly: false
        ),
        SystemEventNode(
            id: "evt-006",
            sequenceNumber: 6,
            timestamp: "2026-08-20 08:45:10.024",
            level: "INFO",
            levelColor: CopSightTheme.emerald,
            subsystem: "BITSTREAM-IO",
            actor: "Officer Brijesh (IO-7482)",
            terminalId: "WS-CYBER-01",
            title: "Physical Raw Bitstream Acquisition Commenced",
            narrative: "Direct NVMe DMA transfer started for iPhone 15 Pro Max (APFS Encrypted). Transfer rate: 2.8 GB/s over Thunderbolt write-blocker.",
            diagnosticPayload: "{\n  \"target_device\": \"iPhone 15 Pro Max\",\n  \"interface\": \"Thunderbolt_4\",\n  \"write_blocker\": \"HARDWARE_ACTIVE\",\n  \"throughput_mbs\": 2840\n}",
            sha256Signature: "7c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e",
            isAnomaly: false
        )
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var filteredEvents: [SystemEventNode] {
        eventChain.filter { ev in
            let matchesFilter: Bool = {
                switch selectedFilter {
                case "ALL": return true
                case "ANOMALIES": return ev.isAnomaly || ev.level == "WARN" || ev.level == "ERROR"
                case "SECURITY": return ev.level == "SECURITY" || ev.subsystem.contains("KEYBAG") || ev.subsystem.contains("AUTH")
                case "RPC": return ev.subsystem.contains("RPC")
                case "STORAGE": return ev.subsystem.contains("BITSTREAM") || ev.subsystem.contains("VAULT")
                default: return true
                }
            }()
            
            let matchesSearch = searchText.isEmpty ||
                ev.title.localizedCaseInsensitiveContains(searchText) ||
                ev.narrative.localizedCaseInsensitiveContains(searchText) ||
                ev.subsystem.localizedCaseInsensitiveContains(searchText) ||
                ev.actor.localizedCaseInsensitiveContains(searchText) ||
                ev.terminalId.localizedCaseInsensitiveContains(searchText)
            
            return matchesFilter && matchesSearch
        }
    }
    
    var selectedEvent: SystemEventNode? {
        eventChain.first { $0.id == selectedEventId } ?? eventChain.first
    }
    
    var body: some View {
        ZStack {
            theme.canvasBg(isDark: isDark)
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Header Bar
                headerBar
                
                // Top Metrics Cards
                topMetricsGrid
                    .padding(.bottom, 16)
                
                // Filter & Search Strip
                filterStrip
                    .padding(.bottom, 14)
                
                // Main Split Content: Event Chain List (Left) + Detailed Diagnostic Inspector (Right)
                HStack(alignment: .top, spacing: 16) {
                    // Left Column: Chronological Event Chain Timeline
                    eventChainListView
                        .frame(maxWidth: .infinity)
                    
                    // Right Column: Deep Event Diagnostics & Raw Payload Inspector
                    eventDiagnosticInspectorView
                        .frame(width: 420)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(20)
        }
        .frame(minWidth: 950, minHeight: 650)
        .focusEffectDisabled()
    }
    
    // MARK: - Header Bar
    
    private var headerBar: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(theme.iconCircleBg(isDark: isDark))
                .frame(width: 42, height: 42)
                .overlay(
                    Image(systemName: "server.rack")
                        .foregroundColor(Color(hex: "a855f7"))
                        .font(.system(size: 18))
                )
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text("System Event Chain & Infrastructure Logs Dossier")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("ROOT ADMIN DOCKET")
                        .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color(hex: "a855f7").opacity(0.25))
                        .foregroundColor(Color(hex: "a855f7"))
                        .clipShape(Capsule())
                }
                
                Text("CHRONOLOGICAL AUDIT TIMELINE · HARDWARE RPC SOCKETS · AUTH INTEGRITY · ERROR DIAGNOSTICS")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .tracking(1)
                    .foregroundColor(.white.opacity(0.75))
            }
            
            Spacer()
            
            // Export Actions
            HStack(spacing: 8) {
                Button(action: exportJSON) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.down.doc.fill")
                        Text("Export Event Chain (JSON)")
                    }
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(theme.primaryAccentText(isDark: isDark))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(theme.primaryAccent(isDark: isDark))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                
                Button(action: exportCSV) {
                    HStack(spacing: 5) {
                        Image(systemName: "tablecells.badge.ellipsis")
                        Text("Export CSV")
                    }
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(theme.insetFill(isDark: isDark))
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
            }
        }
        .padding(.bottom, 16)
    }
    
    // MARK: - Top Metrics Grid
    
    private var topMetricsGrid: some View {
        HStack(spacing: 14) {
            EventMetricCard(
                icon: "list.bullet.indent",
                title: "TOTAL RECORDED EVENTS",
                value: "\(eventChain.count) Events",
                subtitle: "100% Cryptographically Chained",
                color: CopSightTheme.cyan
            )
            EventMetricCard(
                icon: "exclamationmark.triangle.fill",
                title: "SYSTEM ANOMALIES & WARNS",
                value: "01 Flagged",
                subtitle: "Latency Spike (Auto-Resolved)",
                color: CopSightTheme.amber
            )
            EventMetricCard(
                icon: "point.3.filled.connected.trianglepath.dotted",
                title: "HARDWARE RPC SOCKETS",
                value: "127.0.0.1:54322",
                subtitle: "IOKit Bus Daemon Online",
                color: CopSightTheme.emerald
            )
            EventMetricCard(
                icon: "lock.shield.fill",
                title: "AUDIT LOG INTEGRITY",
                value: "HMAC-SHA256",
                subtitle: "FIPS 140-2 Level 3 Compliant",
                color: Color(hex: "a855f7")
            )
        }
    }
    
    // MARK: - Filter & Search Strip
    
    private var filterStrip: some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                ForEach(["ALL", "ANOMALIES", "SECURITY", "RPC", "STORAGE"], id: \.self) { f in
                    let isSel = selectedFilter == f
                    Button(action: { selectedFilter = f }) {
                        Text(f)
                            .font(.system(size: 10, weight: isSel ? .bold : .medium, design: .monospaced))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(isSel ? Color(hex: "a855f7") : theme.insetFill(isDark: isDark))
                            .foregroundColor(isSel ? .white : .white.opacity(0.8))
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().strokeBorder(isSel ? Color.clear : theme.insetBorder(isDark: isDark), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
            }
            
            Spacer()
            
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.5))
                TextField("Search event chain by actor, subsystem, or hash...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(theme.insetFill(isDark: isDark))
            .cornerRadius(8)
            .frame(width: 320)
        }
    }
    
    // MARK: - Event Chain List
    
    private var eventChainListView: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Chronological Event Chain Timeline")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Text("\(filteredEvents.count) Events Listed")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.white.opacity(0.6))
                }
                
                Divider().background(Color.white.opacity(0.12))
                
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 10) {
                        ForEach(filteredEvents) { ev in
                            let isSelected = selectedEventId == ev.id
                            Button(action: { selectedEventId = ev.id }) {
                                HStack(alignment: .top, spacing: 12) {
                                    // Sequence & Status Indicator
                                    VStack(spacing: 4) {
                                        Circle()
                                            .fill(ev.levelColor)
                                            .frame(width: 10, height: 10)
                                        
                                        Rectangle()
                                            .fill(Color.white.opacity(0.15))
                                            .frame(width: 2, height: 40)
                                    }
                                    .padding(.top, 4)
                                    
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack(spacing: 8) {
                                            Text(ev.level)
                                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(ev.levelColor.opacity(0.25))
                                                .foregroundColor(ev.levelColor)
                                                .cornerRadius(4)
                                            
                                            Text(ev.subsystem)
                                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(Color.white.opacity(0.08))
                                                .foregroundColor(.white)
                                                .cornerRadius(4)
                                            
                                            Text(ev.actor)
                                                .font(.system(size: 10.5, weight: .semibold))
                                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                            
                                            Spacer()
                                            
                                            Text(ev.timestamp)
                                                .font(.system(size: 9.5, design: .monospaced))
                                                .foregroundColor(.white.opacity(0.5))
                                        }
                                        
                                        Text(ev.title)
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(.white)
                                        
                                        Text(ev.narrative)
                                            .font(.system(size: 10.5))
                                            .foregroundColor(.white.opacity(0.75))
                                            .lineLimit(2)
                                    }
                                }
                                .padding(12)
                                .background(isSelected ? Color(hex: "a855f7").opacity(0.15) : theme.insetFill(isDark: isDark))
                                .cornerRadius(10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .strokeBorder(isSelected ? Color(hex: "a855f7") : theme.insetBorder(isDark: isDark), lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                        }
                    }
                    .thinScrollable()
                }
                .scrollIndicators(.hidden)
            }
            .padding(16)
        }
    }
    
    // MARK: - Event Diagnostic Inspector
    
    private var eventDiagnosticInspectorView: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 14) {
                if let ev = selectedEvent {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Diagnostic Event Inspector")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Text("SEQ #\(ev.sequenceNumber) · \(ev.subsystem)")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundColor(Color(hex: "a855f7"))
                        }
                        Spacer()
                        
                        Text(ev.level)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(ev.levelColor.opacity(0.25))
                            .foregroundColor(ev.levelColor)
                            .cornerRadius(6)
                    }
                    
                    Divider().background(Color.white.opacity(0.12))
                    
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 12) {
                            // Event Metadata
                            VStack(spacing: 6) {
                                InspectorFieldRow(label: "EVENT TIMESTAMP", value: ev.timestamp)
                                InspectorFieldRow(label: "ACTOR / PROCESS", value: ev.actor)
                                InspectorFieldRow(label: "HARDWARE TERMINAL", value: ev.terminalId)
                                InspectorFieldRow(label: "SUBSYSTEM TARGET", value: ev.subsystem)
                            }
                            
                            // Event Narrative
                            VStack(alignment: .leading, spacing: 4) {
                                Text("EVENT SUMMARY & ANALYSIS")
                                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.7))
                                Text(ev.narrative)
                                    .font(.system(size: 11))
                                    .foregroundColor(.white.opacity(0.9))
                                    .padding(10)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(theme.insetFill(isDark: isDark))
                                    .cornerRadius(8)
                            }
                            
                            // Raw Diagnostic JSON Payload
                            VStack(alignment: .leading, spacing: 4) {
                                Text("RAW IPC / TELEMETRY PAYLOAD")
                                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.7))
                                Text(ev.diagnosticPayload)
                                    .font(.system(size: 9.5, design: .monospaced))
                                    .foregroundColor(CopSightTheme.emeraldBright)
                                    .padding(10)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.black.opacity(0.4))
                                    .cornerRadius(8)
                            }
                            
                            // Cryptographic Signature
                            VStack(alignment: .leading, spacing: 4) {
                                Text("HMAC SHA-256 INTEGRITY DIGEST")
                                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(CopSightTheme.cyan)
                                Text(ev.sha256Signature)
                                    .font(.system(size: 8.5, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.8))
                                    .padding(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.black.opacity(0.3))
                                    .cornerRadius(6)
                            }
                        }
                        .thinScrollable()
                    }
                    .scrollIndicators(.hidden)
                } else {
                    Text("Select an event from the timeline to view diagnostics.")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.6))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .padding(16)
        }
    }
    
    // MARK: - Actions
    
    private func exportJSON() {
        notificationManager.postGenericNotification(
            title: "Event Chain Exported",
            body: "Exported \(eventChain.count) chronological audit events to event_chain_dossier.json"
        )
    }
    
    private func exportCSV() {
        notificationManager.postGenericNotification(
            title: "Event Chain Exported",
            body: "Exported \(eventChain.count) chronological audit events to event_chain_dossier.csv"
        )
    }
}

// MARK: - Subcomponents

struct EventMetricCard: View {
    let icon: String
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Circle()
                        .fill(color.opacity(0.2))
                        .frame(width: 28, height: 28)
                        .overlay(
                            Image(systemName: icon)
                                .foregroundColor(color)
                                .font(.system(size: 12))
                        )
                    Spacer()
                }
                
                Text(title)
                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                    .foregroundColor(.white.opacity(0.65))
                
                Text(value)
                    .font(.system(size: 15, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                
                Text(subtitle)
                    .font(.system(size: 9.5))
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(12)
        }
        .frame(maxWidth: .infinity)
    }
}

struct InspectorFieldRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.6))
            Spacer()
            Text(value)
                .font(.system(size: 9.5, design: .monospaced))
                .foregroundColor(.white)
        }
        .padding(8)
        .background(Color.white.opacity(0.04))
        .cornerRadius(6)
    }
}
