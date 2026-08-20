import SwiftUI

/// User Account Model for Administrator RBAC Management
struct AdminUserModel: Identifiable, Equatable {
    let id: String
    var fullName: String
    var username: String
    var email: String
    var role: OfficerRole
    var badgeNumber: String
    var unit: String
    var isActive: Bool
}

/// System Activity & Telemetry Log Entry Model
struct SystemLogEntry: Identifiable, Equatable {
    let id: String
    let timestamp: String
    let level: String
    let levelColor: Color
    let subsystem: String
    let userOrProcess: String
    let terminalId: String
    let message: String
    let details: String
}

/// Administrator System Dashboard matching Web Frontend `/admin`
struct AdminDashboardView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    @State private var profile = OfficerProfileManager.shared
    @State private var notificationManager = ForensicNotificationManager.shared
    
    @State private var totalUsersCount: Int = 8
    @State private var totalCasesCount: Int = 14
    @State private var activeCasesCount: Int = 6
    @State private var isSyncing: Bool = false
    @State private var isShowingAuditModal: Bool = false
    
    // Log Filters & Search
    @State private var logSearchText: String = ""
    @State private var selectedLogLevel: String = "ALL"
    @State private var selectedSubsystem: String = "ALL"
    @State private var exportToastMessage: String? = nil
    
    // Search & Filter for Users
    @State private var userSearchText: String = ""
    
    @State private var userList: [AdminUserModel] = [
        AdminUserModel(id: "usr-1", fullName: "Brijesh Sharma", username: "brijesh", email: "brijesh@copsight.local", role: .investigatingOfficer, badgeNumber: "IO-7482", unit: "Cyber Crime Unit", isActive: true),
        AdminUserModel(id: "usr-2", fullName: "V. Sharma", username: "v_sharma", email: "vsharma@copsight.local", role: .supervisor, badgeNumber: "SUP-9012", unit: "Forensic Command", isActive: true),
        AdminUserModel(id: "usr-3", fullName: "Super Admin", username: "admin", email: "admin@copsight.local", role: .admin, badgeNumber: "ADMIN-01", unit: "Station IT & SecOps", isActive: true),
        AdminUserModel(id: "usr-4", fullName: "M. Khan", username: "mkhan", email: "mkhan@copsight.local", role: .investigatingOfficer, badgeNumber: "IO-3912", unit: "Anti-Terror Squad", isActive: true),
        AdminUserModel(id: "usr-5", fullName: "Ananya Roy", username: "aroy", email: "aroy@copsight.local", role: .supervisor, badgeNumber: "SUP-4410", unit: "Financial Intelligence", isActive: true)
    ]
    
    @State private var systemLogs: [SystemLogEntry] = [
        SystemLogEntry(
            id: "log-101",
            timestamp: "2026-08-20 12:44:10",
            level: "INFO",
            levelColor: CopSightTheme.emerald,
            subsystem: "AUTH-GATE",
            userOrProcess: "@brijesh (IO-7482)",
            terminalId: "WS-CYBER-01",
            message: "Officer Brijesh authenticated via AuthGate with Role 'Investigating Officer'",
            details: "Session token generated: e2ee_sess_89410 • Handshake verified"
        ),
        SystemLogEntry(
            id: "log-102",
            timestamp: "2026-08-20 12:30:15",
            level: "INFO",
            levelColor: CopSightTheme.cyan,
            subsystem: "EVD-VAULT",
            userOrProcess: "@v_sharma (SUP-9012)",
            terminalId: "WS-COMMAND-04",
            message: "Cryptographic SHA-256 seal validated on physical evidence container EVD-2026-9042",
            details: "Hash match: 7a89f92...b3c9 • Integrity 100% verified"
        ),
        SystemLogEntry(
            id: "log-103",
            timestamp: "2026-08-20 11:15:02",
            level: "WARN",
            levelColor: CopSightTheme.amber,
            subsystem: "RPC-DAEMON",
            userOrProcess: "copsight-rpc.sock",
            terminalId: "DAEMON-HOST-01",
            message: "RPC Daemon latency momentary spike: 24ms during multi-partition Bitstream index",
            details: "Auto-rebalanced worker queue to cores 4-7 • Latency normalized to 1.4ms"
        ),
        SystemLogEntry(
            id: "log-104",
            timestamp: "2026-08-20 10:04:22",
            level: "INFO",
            levelColor: CopSightTheme.emerald,
            subsystem: "MILVUS-DB",
            userOrProcess: "milvus-core-cluster",
            terminalId: "CLUSTER-NODE-02",
            message: "Vector embedding index rebuilt for OP-TANGO-24 (8,130 Nodes, 14,200 Embeddings)",
            details: "HNSW index build time: 1.18s • Cosine similarity accuracy 99.4%"
        ),
        SystemLogEntry(
            id: "log-105",
            timestamp: "2026-08-20 09:22:45",
            level: "SECURITY",
            levelColor: Color(hex: "a855f7"),
            subsystem: "KEYBAG-MGR",
            userOrProcess: "@admin (ADMIN-01)",
            terminalId: "WS-SECOPS-ROOT",
            message: "Master Station Keybag rotated in compliance with CJIS Policy 5.9",
            details: "Hardware Secure Enclave key pair updated • All active sessions re-keyed"
        ),
        SystemLogEntry(
            id: "log-106",
            timestamp: "2026-08-20 08:45:10",
            level: "INFO",
            levelColor: CopSightTheme.emerald,
            subsystem: "BITSTREAM",
            userOrProcess: "@brijesh (IO-7482)",
            terminalId: "WS-CYBER-01",
            message: "Physical bitstream raw acquisition started on iPhone 15 Pro Max (APFS Encrypted)",
            details: "Transfer rate: 2.8 GB/s over USB4/Thunderbolt • Block-level SHA-256 verification"
        )
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 22) {
                // Header & High-Level Stats
                adminHeaderBar
                
                // Infrastructure & Performance Gauges
                systemPerformanceGrid
                
                // Top Bento Grid: Profile & Telemetry
                bentoTopRow
                
                // Comprehensive System Activity & Audit Logs Suite
                systemLogsSuiteSection
                
                // User Accounts & Roles Management Section
                userManagementSection
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 60)
            .thinScrollable()
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $isShowingAuditModal) {
            SupervisorAuditView()
        }
    }
    
    // MARK: - Header Bar
    
    private var adminHeaderBar: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 0) {
                    Text("Station Administration — ")
                        .font(.system(size: 28, weight: .light))
                        .foregroundColor(.white)
                    Text(profile.officerName)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)
                }
                
                HStack(spacing: 12) {
                    HStack(spacing: 6) {
                        Circle().fill(Color(hex: "a855f7")).frame(width: 6, height: 6)
                        Text("ROOT ADMINISTRATOR DOCKET")
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(hex: "a855f7"))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color(hex: "a855f7").opacity(0.15))
                    .cornerRadius(100)
                    
                    Text("Global User Governance, Forensic Infrastructure & System Logs")
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.85))
                }
            }
            
            Spacer()
            
            // High-Level Stat Counters
            HStack(spacing: 16) {
                StatPill(value: "\(userList.count)", label: "Users", color: Color(hex: "a855f7"))
                StatPill(value: "\(totalCasesCount)", label: "Cases", color: CopSightTheme.skyBlue)
                StatPill(value: "\(activeCasesCount)", label: "Active", color: CopSightTheme.emerald)
                
                Button(action: syncTelemetry) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .rotationEffect(.degrees(isSyncing ? 360 : 0))
                            .animation(isSyncing ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default, value: isSyncing)
                        Text("Sync")
                    }
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(theme.insetFill(isDark: isDark))
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
            }
        }
    }
    
    // MARK: - System Performance & Resource Grid
    
    private var systemPerformanceGrid: some View {
        HStack(spacing: 14) {
            ResourceMetricCard(
                icon: "cpu.fill",
                title: "CPU CLUSTER LOAD",
                value: "18.4%",
                subtitle: "8 Cores Balanced • Low Temp",
                color: CopSightTheme.emerald,
                progress: 0.184
            )
            ResourceMetricCard(
                icon: "memorychip.fill",
                title: "UNIFIED MEMORY",
                value: "4.2 / 32 GB",
                subtitle: "Buffer Cache • Zero Pressure",
                color: CopSightTheme.cyan,
                progress: 0.131
            )
            ResourceMetricCard(
                icon: "point.3.connected.trianglepath.dotted",
                title: "VECTOR DB (MILVUS)",
                value: "1,240 QPS",
                subtitle: "Latency 3.4ms • 8,130 Nodes",
                color: Color(hex: "a855f7"),
                progress: 0.82
            )
            ResourceMetricCard(
                icon: "externaldrive.badge.wifi",
                title: "NVMe BITSTREAM I/O",
                value: "2.8 GB/s",
                subtitle: "Direct Storage DMA Active",
                color: CopSightTheme.skyBlue,
                progress: 0.70
            )
        }
    }
    
    // MARK: - Bento Top Row
    
    private var bentoTopRow: some View {
        HStack(alignment: .top, spacing: 16) {
            // Card 1: Administrator Security Profile
            GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("SECURITY PROFILE")
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                        Spacer()
                        HStack(spacing: 4) {
                            Circle().fill(CopSightTheme.emerald).frame(width: 6, height: 6)
                            Text("Authorized")
                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                .foregroundColor(CopSightTheme.emerald)
                        }
                    }
                    
                    HStack(spacing: 14) {
                        Circle()
                            .fill(Color(hex: "a855f7").opacity(0.2))
                            .frame(width: 50, height: 50)
                            .overlay(
                                Image(systemName: "shield.lefthalf.filled")
                                    .font(.system(size: 22))
                                    .foregroundColor(Color(hex: "a855f7"))
                            )
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(profile.officerName)
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            Text("Role: \(profile.role.title)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.white.opacity(0.8))
                            Text("ID: \(profile.officerId) • \(profile.stationUnit)")
                                .font(.system(size: 9.5))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                    
                    VStack(spacing: 6) {
                        ProfileInfoRow(label: "Access Boundary", value: "Global / Multi-Tenant", color: CopSightTheme.cyan)
                        ProfileInfoRow(label: "Active Sessions", value: "E2EE Protected", color: CopSightTheme.emerald)
                    }
                    
                    Button(action: { isShowingAuditModal = true }) {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.shield.fill")
                            Text("Launch Master Forensic Audit Dossier")
                        }
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(CopSightTheme.red.opacity(0.3))
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(CopSightTheme.red.opacity(0.5), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
                .padding(18)
            }
            .frame(maxWidth: .infinity)
            
            // Card 2: System Health & Uptime Telemetry
            GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                VStack(spacing: 12) {
                    HStack {
                        Text("ENGINE TELEMETRY")
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                        Spacer()
                        HStack(spacing: 4) {
                            Circle().fill(CopSightTheme.cyan).frame(width: 6, height: 6)
                            Text("Live RPC")
                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                .foregroundColor(CopSightTheme.cyan)
                        }
                    }
                    
                    // Uptime Gauge
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.1), lineWidth: 6)
                            .frame(width: 90, height: 90)
                        
                        Circle()
                            .trim(from: 0, to: 0.999)
                            .stroke(
                                LinearGradient(colors: [theme.primaryAccent(isDark: isDark), CopSightTheme.emerald], startPoint: .topLeading, endPoint: .bottomTrailing),
                                style: StrokeStyle(lineWidth: 6, lineCap: .round)
                            )
                            .frame(width: 90, height: 90)
                            .rotationEffect(.degrees(-90))
                        
                        VStack(spacing: 1) {
                            Text("99.9%")
                                .font(.system(size: 16, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                            Text("UPTIME")
                                .font(.system(size: 7.5, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                    .padding(.vertical, 4)
                    
                    HStack(spacing: 8) {
                        ServerBadge(title: "API Gateway", status: "Online", color: CopSightTheme.emerald)
                        ServerBadge(title: "Database Cluster", status: "Synced", color: CopSightTheme.emerald)
                    }
                }
                .padding(18)
            }
            .frame(maxWidth: .infinity)
        }
    }
    
    // MARK: - Master System Activity & Audit Logs Suite
    
    private var systemLogsSuiteSection: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 16) {
                // Header & Controls
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Image(systemName: "terminal.fill")
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .font(.system(size: 14))
                            Text("System Activity, Infrastructure & Security Logs")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                        }
                        Text("REAL-TIME FORENSIC TELEMETRY, HARDWARE BUS EVENTS & AUTHENTICATION AUDIT TRAIL")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Spacer()
                    
                    // Export Actions
                    HStack(spacing: 8) {
                        Button(action: exportLogsJSON) {
                            HStack(spacing: 5) {
                                Image(systemName: "arrow.down.doc.fill")
                                Text("Export JSON")
                            }
                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                            .foregroundColor(theme.primaryAccentText(isDark: isDark))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(theme.primaryAccent(isDark: isDark))
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                        
                        Button(action: exportLogsCSV) {
                            HStack(spacing: 5) {
                                Image(systemName: "tablecells.badge.ellipsis")
                                Text("Export CSV")
                            }
                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(theme.insetFill(isDark: isDark))
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                    }
                }
                
                // Filter & Search Strip
                HStack(spacing: 12) {
                    // Log Level Pills
                    HStack(spacing: 6) {
                        ForEach(["ALL", "INFO", "WARN", "SECURITY"], id: \.self) { lvl in
                            let isSel = selectedLogLevel == lvl
                            Button(action: { selectedLogLevel = lvl }) {
                                Text(lvl)
                                    .font(.system(size: 9.5, weight: isSel ? .bold : .medium, design: .monospaced))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(isSel ? theme.primaryAccent(isDark: isDark) : theme.insetFill(isDark: isDark))
                                    .foregroundColor(isSel ? theme.primaryAccentText(isDark: isDark) : .white.opacity(0.8))
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                        }
                    }
                    
                    Spacer()
                    
                    // Search Bar
                    HStack(spacing: 6) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.5))
                        TextField("Filter system events, processes, or terminals...", text: $logSearchText)
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
                
                Divider().background(Color.white.opacity(0.12))
                
                // Logs Stream Table
                VStack(spacing: 8) {
                    ForEach(filteredLogs) { log in
                        HStack(alignment: .top, spacing: 14) {
                            // Severity Pill
                            Text(log.level)
                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(log.levelColor.opacity(0.25))
                                .foregroundColor(log.levelColor)
                                .cornerRadius(4)
                                .frame(width: 70, alignment: .center)
                            
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 8) {
                                    Text(log.subsystem)
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.white.opacity(0.08))
                                        .foregroundColor(.white)
                                        .cornerRadius(4)
                                    
                                    Text(log.userOrProcess)
                                        .font(.system(size: 10.5, weight: .semibold))
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                    
                                    Text("•")
                                        .foregroundColor(.white.opacity(0.3))
                                    
                                    Text(log.terminalId)
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.6))
                                    
                                    Spacer()
                                    
                                    Text(log.timestamp)
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.5))
                                }
                                
                                Text(log.message)
                                    .font(.system(size: 11.5))
                                    .foregroundColor(.white.opacity(0.95))
                                
                                Text(log.details)
                                    .font(.system(size: 9.5, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.6))
                            }
                        }
                        .padding(12)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(10)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                        )
                    }
                }
            }
            .padding(20)
        }
    }
    
    // MARK: - User Accounts & Roles Section
    
    private var userManagementSection: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("User Accounts & Role-Based Access Control")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                        Text("MANAGE EXAMINER CLEARANCE TIERS AND ACTIVE SESSIONS")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Spacer()
                    
                    // Search Bar
                    HStack(spacing: 6) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.5))
                        TextField("Search users...", text: $userSearchText)
                            .textFieldStyle(.plain)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(theme.insetFill(isDark: isDark))
                    .cornerRadius(8)
                    .frame(width: 200)
                }
                
                Divider().background(Color.white.opacity(0.12))
                
                // Users Table
                VStack(spacing: 8) {
                    ForEach(filteredUsers) { u in
                        HStack(spacing: 14) {
                            Circle()
                                .fill(u.role.badgeColor.opacity(0.2))
                                .frame(width: 36, height: 36)
                                .overlay(
                                    Image(systemName: u.role.icon)
                                        .foregroundColor(u.role.badgeColor)
                                        .font(.system(size: 14))
                                )
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(u.fullName)
                                    .font(.system(size: 12.5, weight: .bold))
                                    .foregroundColor(.white)
                                Text("@\(u.username) • \(u.email)")
                                    .font(.system(size: 10))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            
                            Spacer()
                            
                            Text("ID: \(u.badgeNumber)")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.6))
                            
                            Text(u.unit)
                                .font(.system(size: 10.5))
                                .foregroundColor(.white.opacity(0.8))
                                .frame(width: 140, alignment: .leading)
                            
                            // Role Badge
                            Text(u.role.title.uppercased())
                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(u.role.badgeColor.opacity(0.2))
                                .foregroundColor(u.role.badgeColor)
                                .cornerRadius(6)
                        }
                        .padding(12)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(10)
                    }
                }
            }
            .padding(20)
        }
    }
    
    // MARK: - Actions & Filtering
    
    private var filteredLogs: [SystemLogEntry] {
        systemLogs.filter { entry in
            let matchesLevel = selectedLogLevel == "ALL" || entry.level == selectedLogLevel
            let matchesSearch = logSearchText.isEmpty ||
                entry.message.localizedCaseInsensitiveContains(logSearchText) ||
                entry.subsystem.localizedCaseInsensitiveContains(logSearchText) ||
                entry.userOrProcess.localizedCaseInsensitiveContains(logSearchText) ||
                entry.terminalId.localizedCaseInsensitiveContains(logSearchText)
            return matchesLevel && matchesSearch
        }
    }
    
    private var filteredUsers: [AdminUserModel] {
        if userSearchText.isEmpty { return userList }
        return userList.filter {
            $0.fullName.localizedCaseInsensitiveContains(userSearchText) ||
            $0.username.localizedCaseInsensitiveContains(userSearchText) ||
            $0.badgeNumber.localizedCaseInsensitiveContains(userSearchText)
        }
    }
    
    private func syncTelemetry() {
        isSyncing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            isSyncing = false
        }
    }
    
    private func exportLogsJSON() {
        notificationManager.postGenericNotification(
            title: "System Logs Exported",
            body: "Exported \(systemLogs.count) audit events to system_audit_2026.json"
        )
    }
    
    private func exportLogsCSV() {
        notificationManager.postGenericNotification(
            title: "System Logs Exported",
            body: "Exported \(systemLogs.count) audit events to system_audit_2026.csv"
        )
    }
}

// MARK: - Subcomponents

struct ResourceMetricCard: View {
    let icon: String
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    let progress: Double
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 10) {
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
                    
                    Text(title)
                        .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.65))
                }
                
                Text(value)
                    .font(.system(size: 17, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.1))
                            .frame(height: 4)
                        
                        Capsule()
                            .fill(color)
                            .frame(width: geo.size.width * CGFloat(min(1.0, max(0.0, progress))), height: 4)
                    }
                }
                .frame(height: 4)
                
                Text(subtitle)
                    .font(.system(size: 9.5))
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(14)
        }
        .frame(maxWidth: .infinity)
    }
}

struct StatPill: View {
    let value: String
    let label: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
            Text(label.uppercased())
                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.7))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.06))
        .cornerRadius(100)
    }
}

struct ProfileInfoRow: View {
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.white.opacity(0.7))
            Spacer()
            Text(value)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundColor(color)
        }
        .padding(8)
        .background(Color.black.opacity(0.2))
        .cornerRadius(6)
    }
}

struct ServerBadge: View {
    let title: String
    let status: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.system(size: 8.5, design: .monospaced))
                .foregroundColor(.white.opacity(0.7))
            Text(status)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color.black.opacity(0.2))
        .cornerRadius(8)
    }
}
