import SwiftUI
import AppKit

/// Central Window Management Service for Native macOS Multi-Window Support in CopSight AI
/// Enables opening any forensic tool, intelligence tab, or administrative dossier in an independent native NSWindow
final class WindowManager: NSObject, NSWindowDelegate {
    static let shared = WindowManager()
    
    private var windowControllers: [String: NSWindowController] = [:]
    private var windowIdsByWindow: [NSWindow: String] = [:]
    
    private override init() {
        super.init()
    }
    
    // MARK: - Generic Native Window Opener
    
    func openWindow<Content: View>(
        id: String,
        title: String,
        minWidth: CGFloat = 900,
        minHeight: CGFloat = 620,
        defaultWidth: CGFloat = 1150,
        defaultHeight: CGFloat = 780,
        @ViewBuilder content: () -> Content
    ) {
        // If window is already open, bring to front, un-minimize if needed, and focus
        if let existing = windowControllers[id], let window = existing.window {
            if window.isMiniaturized {
                window.deminiaturize(nil)
            }
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }
        
        let themedContent = ZStack {
            ThemeManager.shared.canvasBg(isDark: ThemeManager.shared.isDark(systemScheme: .dark))
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Native Window Top Padding to accommodate traffic lights cleanly
                Color.clear
                    .frame(height: 28)
                
                content()
                    .environment(ThemeManager.shared)
            }
        }
        .focusEffectDisabled()
        
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
        window.delegate = self
        window.collectionBehavior = [.fullScreenPrimary, .participatesInCycle]
        window.center()
        
        let controller = NSWindowController(window: window)
        windowControllers[id] = controller
        windowIdsByWindow[window] = id
        
        controller.showWindow(nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    
    // MARK: - NSWindowDelegate
    
    func windowWillClose(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        if let id = windowIdsByWindow[window] {
            windowControllers.removeValue(forKey: id)
            windowIdsByWindow.removeValue(forKey: window)
        }
    }
    
    // MARK: - Specialized Window Launchers
    
    func openForensixDStudio() {
        openWindow(id: "forensixd-studio", title: "ForensixD — Acquisition Studio") {
            ForensixDAcquisitionStudioView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openForensixDDevices() {
        openWindow(id: "forensixd-devices", title: "ForensixD — USB Hardware & Devices") {
            ForensixDDevicesView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openForensixDEvidence() {
        openWindow(id: "forensixd-evidence", title: "ForensixD — Evidence Center") {
            EvidenceViewerView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openForensixDDecryption() {
        openWindow(id: "forensixd-decryption", title: "ForensixD — Decryption & Exploitation Suite") {
            DecryptionToolkitView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openNetworkGraph() {
        openWindow(id: "copsight-graph", title: "CopSight AI — Forensic Entity Network Graph", minWidth: 980, minHeight: 680) {
            NetworkGraphView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openAIAnalyst() {
        openWindow(id: "copsight-analyst", title: "CopSight AI — Forensic Analyst Assistant", minWidth: 850, minHeight: 620) {
            QueryInterfaceView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openAnomalyDetection() {
        openWindow(id: "copsight-anomaly", title: "CopSight AI — Multi-Model Anomaly Detection") {
            AnomalyDetectionView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openCrossCase() {
        openWindow(id: "copsight-crosscase", title: "CopSight AI — Cross-Case Correlations") {
            CrossCaseConnectionsView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openCaseDossiers() {
        openWindow(id: "copsight-cases", title: "CopSight AI — Case Dossiers") {
            CopSightCasesView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openSupervisorHub() {
        guard OfficerProfileManager.shared.isSupervisor || OfficerProfileManager.shared.isAdmin else {
            return
        }
        openWindow(id: "copsight-supervisor", title: "CopSight — Supervisor Command & Audit Hub", minWidth: 980, minHeight: 680) {
            SupervisorAuditView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openAdminLogsDossier() {
        guard OfficerProfileManager.shared.isAdmin else {
            return
        }
        openWindow(id: "copsight-admin-logs", title: "CopSight — System Event Chain & Logs Dossier", minWidth: 1050, minHeight: 720) {
            AdminSystemLogsDossierView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openUserAccounts() {
        guard OfficerProfileManager.shared.isAdmin else {
            return
        }
        openWindow(id: "copsight-users", title: "CopSight — User Accounts & Clearance Management") {
            AdminUserListView()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
    
    func openStationSettings(onSwitchCase: (() -> Void)? = nil) {
        openWindow(id: "copsight-settings", title: "CopSight — Station Configuration & Keybags") {
            ForensicSettingsView(onSwitchCase: onSwitchCase)
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
        }
    }
}
