import SwiftUI
import AppKit

/// Central Window Management Service for Multi-Window Support in CopSight AI
/// Enables opening any forensic tool, intelligence tab, or administrative dossier in an independent macOS window
final class WindowManager {
    static let shared = WindowManager()
    
    private var windowControllers: [String: NSWindowController] = [:]
    
    private init() {}
    
    // MARK: - Generic Window Opener
    
    func openWindow<Content: View>(
        id: String,
        title: String,
        minWidth: CGFloat = 850,
        minHeight: CGFloat = 600,
        defaultWidth: CGFloat = 1100,
        defaultHeight: CGFloat = 750,
        @ViewBuilder content: () -> Content
    ) {
        // If window is already open, bring to front and focus
        if let existing = windowControllers[id], let window = existing.window, window.isVisible {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }
        
        let themedContent = ZStack {
            ThemeManager.shared.canvasBg(isDark: ThemeManager.shared.isDark(systemScheme: .dark))
                .ignoresSafeArea()
            content()
                .environment(ThemeManager.shared)
        }
        
        let hostingController = NSHostingController(rootView: themedContent)
        
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: defaultWidth, height: defaultHeight),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        window.title = title
        window.titleVisibility = .visible
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: minWidth, height: minHeight)
        window.contentViewController = hostingController
        window.center()
        
        let controller = NSWindowController(window: window)
        windowControllers[id] = controller
        
        controller.showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    
    // MARK: - Specialized Window Launchers
    
    func openForensixDStudio() {
        openWindow(id: "forensixd-studio", title: "ForensixD — Acquisition Studio") {
            ForensixDAcquisitionStudioView()
                .padding(20)
        }
    }
    
    func openForensixDDevices() {
        openWindow(id: "forensixd-devices", title: "ForensixD — USB Hardware & Devices") {
            ForensixDDevicesView()
                .padding(20)
        }
    }
    
    func openForensixDEvidence() {
        openWindow(id: "forensixd-evidence", title: "ForensixD — Evidence Center") {
            EvidenceViewerView()
                .padding(20)
        }
    }
    
    func openForensixDDecryption() {
        openWindow(id: "forensixd-decryption", title: "ForensixD — Decryption & Exploitation Suite") {
            DecryptionToolkitView()
                .padding(20)
        }
    }
    
    func openNetworkGraph() {
        openWindow(id: "copsight-graph", title: "CopSight AI — Forensic Entity Network Graph", minWidth: 950, minHeight: 650) {
            NetworkGraphView()
                .padding(20)
        }
    }
    
    func openAIAnalyst() {
        openWindow(id: "copsight-analyst", title: "CopSight AI — Forensic Analyst Assistant", minWidth: 800, minHeight: 600) {
            QueryInterfaceView()
                .padding(20)
        }
    }
    
    func openAnomalyDetection() {
        openWindow(id: "copsight-anomaly", title: "CopSight AI — Multi-Model Anomaly Detection") {
            AnomalyDetectionView()
                .padding(20)
        }
    }
    
    func openCrossCase() {
        openWindow(id: "copsight-crosscase", title: "CopSight AI — Cross-Case Correlations") {
            CrossCaseConnectionsView()
                .padding(20)
        }
    }
    
    func openCaseDossiers() {
        openWindow(id: "copsight-cases", title: "CopSight AI — Case Dossiers") {
            CopSightCasesView()
                .padding(20)
        }
    }
    
    func openSupervisorHub() {
        openWindow(id: "copsight-supervisor", title: "CopSight — Supervisor Command & Audit Hub", minWidth: 950, minHeight: 650) {
            SupervisorAuditView()
                .padding(20)
        }
    }
    
    func openAdminLogsDossier() {
        openWindow(id: "copsight-admin-logs", title: "CopSight — System Event Chain & Logs Dossier", minWidth: 1000, minHeight: 700) {
            AdminSystemLogsDossierView()
                .padding(20)
        }
    }
    
    func openUserAccounts() {
        openWindow(id: "copsight-users", title: "CopSight — User Accounts & Clearance Management") {
            AdminUserListView()
                .padding(20)
        }
    }
    
    func openStationSettings(onSwitchCase: (() -> Void)? = nil) {
        openWindow(id: "copsight-settings", title: "CopSight — Station Configuration & Keybags") {
            ForensicSettingsView(onSwitchCase: onSwitchCase)
                .padding(20)
        }
    }
}
