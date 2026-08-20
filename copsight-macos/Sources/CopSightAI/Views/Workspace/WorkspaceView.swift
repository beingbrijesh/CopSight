import SwiftUI

enum AppMode: String, CaseIterable, Identifiable {
    case copsight = "CopSight"
    case forensixd = "ForensixD"
    
    var id: String { rawValue }
}

enum CopSightTab: String, CaseIterable, Identifiable {
    case dashboard = "dashboard"
    case graph = "graph"
    case cases = "cases"
    case crossCase = "crossCase"
    case anomaly = "anomaly"
    case queries = "queries"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .graph: return "Network Graph"
        case .cases: return "Case Dossiers"
        case .crossCase: return "Cross-Case"
        case .anomaly: return "Anomaly AI"
        case .queries: return "AI Analyst"
        }
    }
    
    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2.fill"
        case .graph: return "point.3.connected.trianglepath.dotted"
        case .cases: return "folder.badge.gearshape"
        case .crossCase: return "link.badge.plus"
        case .anomaly: return "brain.head.profile"
        case .queries: return "sparkles"
        }
    }
}

enum SupervisorTab: String, CaseIterable, Identifiable {
    case dashboard = "dashboard"
    case cases = "cases"
    case crossCase = "crossCase"
    case anomaly = "anomaly"
    case queries = "queries"
    case graph = "graph"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .dashboard: return "Supervisor Hub"
        case .cases: return "Case Dossiers"
        case .crossCase: return "Cross-Case"
        case .anomaly: return "Anomaly AI"
        case .queries: return "AI Analyst"
        case .graph: return "Network Graph"
        }
    }
    
    var icon: String {
        switch self {
        case .dashboard: return "shield.checkered"
        case .cases: return "folder.badge.gearshape"
        case .crossCase: return "link.badge.plus"
        case .anomaly: return "brain.head.profile"
        case .queries: return "sparkles"
        case .graph: return "point.3.connected.trianglepath.dotted"
        }
    }
}

enum AdminTab: String, CaseIterable, Identifiable {
    case dashboard = "dashboard"
    case users = "users"
    case cases = "cases"
    case settings = "settings"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .dashboard: return "Admin Hub"
        case .users: return "User Accounts"
        case .cases: return "Case Dossiers"
        case .settings: return "Station Settings"
        }
    }
    
    var icon: String {
        switch self {
        case .dashboard: return "server.rack"
        case .users: return "person.2.fill"
        case .cases: return "folder.badge.gearshape"
        case .settings: return "gearshape.fill"
        }
    }
}

enum ForensixDTab: String, CaseIterable, Identifiable {
    case dashboard = "dashboard"
    case devices = "devices"
    case acquisition = "acquisition"
    case evidence = "evidence"
    case decryption = "decryption"
    case settings = "settings"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .dashboard: return "Overview"
        case .devices: return "Devices"
        case .acquisition: return "Acquisition"
        case .evidence: return "Evidence"
        case .decryption: return "Decryption"
        case .settings: return "Settings"
        }
    }
    
    var icon: String {
        switch self {
        case .dashboard: return "gauge.with.needle.fill"
        case .devices: return "iphone"
        case .acquisition: return "waveform.path.ecg"
        case .evidence: return "doc.zipper"
        case .decryption: return "key.fill"
        case .settings: return "gearshape.fill"
        }
    }
}

struct WorkspaceView: View {
    @Binding var appState: AppState
    
    @State private var profile = OfficerProfileManager.shared
    
    @State private var currentMode: AppMode = .copsight
    @State private var copsightTab: CopSightTab = .dashboard
    @State private var supervisorTab: SupervisorTab = .dashboard
    @State private var adminTab: AdminTab = .dashboard
    @State private var forensixdTab: ForensixDTab = .dashboard
    
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    init(appState: Binding<AppState>) {
        self._appState = appState
    }
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GeometryReader { windowGeo in
            let isCompact = windowGeo.size.width < 1220
            
            ZStack {
                // Background Base
                theme.canvasBg(isDark: isDark)
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Top Unified Navigation Hub (Height: 72pt)
                    topFloatingHeader(isCompact: isCompact)
                        .padding(.top, 16)
                        .padding(.horizontal, 20)
                    
                    // Workspace Content Body
                    VStack(spacing: 0) {
                        if profile.isAdmin {
                            adminRoleContent(isCompact: isCompact)
                        } else if profile.isSupervisor {
                            supervisorRoleContent(isCompact: isCompact)
                        } else {
                            if currentMode == .copsight {
                                ioCopSightContent(isCompact: isCompact)
                            } else {
                                ioForensixDContent(isCompact: isCompact)
                            }
                        }
                    }
                    .padding(.top, 16)
                    .padding(.horizontal, 20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .animation(nil, value: currentMode)
                    .animation(nil, value: copsightTab)
                    .animation(nil, value: supervisorTab)
                    .animation(nil, value: adminTab)
                }
            }
        }
    }
    
    // MARK: - Header Bar (Height: 72pt)
    
    private func topFloatingHeader(isCompact: Bool) -> some View {
        GlassPanel(cornerRadius: CopSightTheme.navRadius) {
            HStack(spacing: 14) {
                // Brand Logo & Station Title
                HStack(spacing: 12) {
                    CopSightLogoView(size: 38)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stationTitle)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)
                        Text(stationSubtitle)
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .tracking(1)
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
                
                Spacer(minLength: 8)
                
                // Center: Role-Appropriate Navigation
                if profile.isAdmin {
                    adminNavTabs(isCompact: isCompact)
                } else if profile.isSupervisor {
                    supervisorNavTabs(isCompact: isCompact)
                } else {
                    // Investigating Officer: Mode Switcher + Tabs
                    modeSwitcherView
                    
                    Spacer(minLength: 8)
                    
                    if currentMode == .copsight {
                        ioCopSightNavTabs(isCompact: isCompact)
                    } else {
                        ioForensixDNavTabs(isCompact: isCompact)
                    }
                }
                
                Spacer(minLength: 8)
                
                // Integrated Profile & Settings Menu Button
                OfficerProfileMenuButton(
                    onOpenSettings: {
                        WindowManager.shared.openStationSettings(onSwitchCase: {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                appState = .caseSelection
                            }
                        })
                    },
                    onOpenSupervisorHub: {
                        WindowManager.shared.openSupervisorHub()
                    },
                    onSwitchCase: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            appState = .caseSelection
                        }
                    },
                    onLockSession: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            appState = .auth
                        }
                    }
                )
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .frame(height: 72)
    }
    
    private var stationTitle: String {
        if profile.isAdmin {
            return "CopSight Admin"
        } else if profile.isSupervisor {
            return "CopSight Supervisor"
        } else {
            return currentMode == .copsight ? "CopSight AI" : "ForensixD"
        }
    }
    
    private var stationSubtitle: String {
        if profile.isAdmin {
            return "Station Governance & SecOps"
        } else if profile.isSupervisor {
            return "Command & Audit Dossier"
        } else {
            return currentMode == .copsight ? "Intelligence Hub" : "Data Extraction Studio"
        }
    }
    
    // MARK: - Admin Navigation Tabs
    
    private func adminNavTabs(isCompact: Bool) -> some View {
        HStack(spacing: 6) {
            ForEach(AdminTab.allCases) { tab in
                let isSelected = adminTab == tab
                Button(action: { adminTab = tab }) {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: isCompact ? 13 : 11))
                        
                        if !isCompact {
                            Text(tab.title)
                                .font(.system(size: 11.5, weight: isSelected ? .bold : .medium))
                        }
                    }
                    .padding(.horizontal, isCompact ? 10 : 13)
                    .padding(.vertical, 7)
                    .background(isSelected ? Color(hex: "a855f7") : Color.white.opacity(0.06))
                    .foregroundColor(isSelected ? Color.white : .white.opacity(0.85))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .strokeBorder(isSelected ? Color.white.opacity(0.3) : Color.clear, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .help(tab.title)
            }
        }
    }
    
    // MARK: - Supervisor Navigation Tabs
    
    private func supervisorNavTabs(isCompact: Bool) -> some View {
        HStack(spacing: 6) {
            ForEach(SupervisorTab.allCases) { tab in
                let isSelected = supervisorTab == tab
                Button(action: { supervisorTab = tab }) {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: isCompact ? 13 : 11))
                        
                        if !isCompact {
                            Text(tab.title)
                                .font(.system(size: 11.5, weight: isSelected ? .bold : .medium))
                        }
                    }
                    .padding(.horizontal, isCompact ? 10 : 13)
                    .padding(.vertical, 7)
                    .background(isSelected ? CopSightTheme.emerald : Color.white.opacity(0.06))
                    .foregroundColor(isSelected ? Color.black : .white.opacity(0.85))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .strokeBorder(isSelected ? Color.white.opacity(0.3) : Color.clear, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .help(tab.title)
            }
        }
    }
    
    // MARK: - IO Mode Switcher
    
    private var modeSwitcherView: some View {
        HStack(spacing: 2) {
            ForEach(AppMode.allCases, id: \.self) { mode in
                let isSelected = currentMode == mode
                Button(action: {
                    currentMode = mode
                }) {
                    Text(mode.rawValue.uppercased())
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .foregroundColor(
                            isSelected
                                ? theme.primaryAccentText(isDark: isDark)
                                : .white.opacity(0.85)
                        )
                        .background(
                            Group {
                                if isSelected {
                                    Capsule()
                                        .fill(theme.primaryAccent(isDark: isDark))
                                } else {
                                    Color.clear
                                }
                            }
                        )
                        .clipShape(Capsule())
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
            }
        }
        .padding(3)
        .background(
            Capsule()
                .fill(Color.black.opacity(0.35))
        )
        .overlay(
            Capsule()
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
        )
        .clipShape(Capsule())
        .animation(.spring(response: 0.22, dampingFraction: 0.8), value: currentMode)
    }
    
    // MARK: - IO CopSight Nav Tabs
    
    private func ioCopSightNavTabs(isCompact: Bool) -> some View {
        HStack(spacing: 6) {
            ForEach(CopSightTab.allCases) { tab in
                let isSelected = copsightTab == tab
                Button(action: {
                    copsightTab = tab
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: isCompact ? 13 : 11))
                        
                        if !isCompact {
                            Text(tab.title)
                                .font(.system(size: 11.5, weight: isSelected ? .bold : .medium))
                        }
                    }
                    .padding(.horizontal, isCompact ? 10 : 13)
                    .padding(.vertical, 7)
                    .background(isSelected ? (isDark ? Color.white.opacity(0.18) : CopSightTheme.coral) : Color.white.opacity(0.06))
                    .foregroundColor(isSelected ? Color.white : .white.opacity(0.85))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .strokeBorder(isSelected ? Color.white.opacity(0.3) : Color.clear, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .help(tab.title)
            }
        }
    }
    
    private func ioForensixDNavTabs(isCompact: Bool) -> some View {
        HStack(spacing: 6) {
            ForEach(ForensixDTab.allCases.filter { $0 != .settings }) { tab in
                let isSelected = forensixdTab == tab
                Button(action: {
                    forensixdTab = tab
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: isCompact ? 13 : 11))
                        
                        if !isCompact {
                            Text(tab.title)
                                .font(.system(size: 11.5, weight: isSelected ? .bold : .medium))
                        }
                    }
                    .padding(.horizontal, isCompact ? 10 : 13)
                    .padding(.vertical, 7)
                    .background(isSelected ? (isDark ? Color.white.opacity(0.18) : CopSightTheme.coral) : Color.white.opacity(0.06))
                    .foregroundColor(isSelected ? Color.white : .white.opacity(0.85))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .strokeBorder(isSelected ? Color.white.opacity(0.3) : Color.clear, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .help(tab.title)
            }
        }
    }
    
    // MARK: - Role Content Switchers
    
    @ViewBuilder
    private func adminRoleContent(isCompact: Bool) -> some View {
        switch adminTab {
        case .dashboard:
            AdminDashboardView()
        case .users:
            AdminUserListView()
        case .cases:
            CopSightCasesView()
        case .settings:
            ForensicSettingsView(onSwitchCase: {
                withAnimation(.easeInOut(duration: 0.3)) {
                    appState = .caseSelection
                }
            })
        }
    }
    
    @ViewBuilder
    private func supervisorRoleContent(isCompact: Bool) -> some View {
        switch supervisorTab {
        case .dashboard:
            SupervisorAuditView()
        case .cases:
            CopSightCasesView()
        case .crossCase:
            CrossCaseConnectionsView(onNavigateTab: { tab in
                withAnimation(.easeInOut(duration: 0.2)) {
                    supervisorTab = .crossCase
                }
            })
        case .anomaly:
            AnomalyDetectionView()
        case .queries:
            QueryInterfaceView()
        case .graph:
            NetworkGraphView()
        }
    }
    
    @ViewBuilder
    private func ioCopSightContent(isCompact: Bool) -> some View {
        switch copsightTab {
        case .dashboard:
            CopSightDashboardView(
                onNavigateTab: { tab in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        copsightTab = tab
                    }
                },
                onSwitchMode: { mode, fTab in
                    withAnimation(.easeInOut(duration: 0.25)) {
                        currentMode = mode
                        if let t = fTab {
                            forensixdTab = t
                        }
                    }
                },
                onOpenSupervisorHub: {
                    WindowManager.shared.openSupervisorHub()
                }
            )
        case .graph:
            NetworkGraphView()
        case .cases:
            CopSightCasesView()
        case .crossCase:
            CrossCaseConnectionsView(onNavigateTab: { tab in
                withAnimation(.easeInOut(duration: 0.2)) {
                    copsightTab = tab
                }
            })
        case .anomaly:
            AnomalyDetectionView()
        case .queries:
            QueryInterfaceView()
        }
    }
    
    @ViewBuilder
    private func ioForensixDContent(isCompact: Bool) -> some View {
        switch forensixdTab {
        case .dashboard:
            ForensixDDashboardView()
        case .devices:
            ForensixDDevicesView()
        case .acquisition:
            ForensixDAcquisitionStudioView()
        case .evidence:
            EvidenceViewerView()
        case .decryption:
            DecryptionToolkitView()
        case .settings:
            ForensicSettingsView(onSwitchCase: {
                withAnimation(.easeInOut(duration: 0.3)) {
                    appState = .caseSelection
                }
            })
        }
    }
}
