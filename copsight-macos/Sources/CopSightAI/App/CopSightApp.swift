import SwiftUI
import AppKit

enum AppState {
    case splash
    case auth
    case caseSelection
    case workspace
}

@main
struct CopSightApp: App {
    @State private var themeManager = ThemeManager.shared
    
    init() {
        // Enforce overlay scrollbar style across all connected mouse configurations
        UserDefaults.standard.set("WhenScrolling", forKey: "AppleShowScrollBars")
        UserDefaults.standard.synchronize()
        
        let whiteIconPath = "/Users/beingbrijesh/Desktop/Projects/UFDR/copsight-macos/Sources/CopSightAI/Resources/copsight_logo.png"
        if FileManager.default.fileExists(atPath: whiteIconPath),
           let img = NSImage(contentsOfFile: whiteIconPath) {
            NSApplication.shared.applicationIconImage = img
        } else if let bundleURL = Bundle.main.url(forResource: "copsight_logo", withExtension: "png"),
                  let img = NSImage(contentsOf: bundleURL) {
            NSApplication.shared.applicationIconImage = img
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(themeManager)
                .preferredColorScheme(themeManager.preferredColorScheme)
                .focusEffectDisabled()
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            SidebarCommands()
            
            CommandMenu("Forensic Tools") {
                Button("AI Forensic Analyst") {
                    WindowManager.shared.openAIAnalyst()
                }
                .keyboardShortcut("2", modifiers: .command)
                
                Button("Forensic Entity Network Graph") {
                    WindowManager.shared.openNetworkGraph()
                }
                .keyboardShortcut("3", modifiers: .command)
                
                Divider()
                
                Button("ForensixD Acquisition Studio") {
                    WindowManager.shared.openForensixDStudio()
                }
                .keyboardShortcut("4", modifiers: .command)
                
                Button("ForensixD USB Devices & Radar") {
                    WindowManager.shared.openForensixDDevices()
                }
                .keyboardShortcut("5", modifiers: .command)
                
                Button("ForensixD Evidence Center") {
                    WindowManager.shared.openForensixDEvidence()
                }
                
                Button("ForensixD Decryption Suite") {
                    WindowManager.shared.openForensixDDecryption()
                }
                
                Divider()
                
                Button("Cross-Case Correlations") {
                    WindowManager.shared.openCrossCase()
                }
                .keyboardShortcut("6", modifiers: .command)
                
                Button("Anomaly Detection AI") {
                    WindowManager.shared.openAnomalyDetection()
                }
                .keyboardShortcut("7", modifiers: .command)
                
                Button("Case Dossiers") {
                    WindowManager.shared.openCaseDossiers()
                }
                .keyboardShortcut("9", modifiers: .command)
                
                Divider()
                
                Button("Supervisor Intelligence Hub") {
                    WindowManager.shared.openSupervisorHub()
                }
                .keyboardShortcut("8", modifiers: [.command, .shift])
                
                Button("System Event Chain & Logs Dossier") {
                    WindowManager.shared.openAdminLogsDossier()
                }
                .keyboardShortcut("L", modifiers: [.command, .shift])
                
                Button("User Accounts & Clearance") {
                    WindowManager.shared.openUserAccounts()
                }
                .keyboardShortcut("U", modifiers: [.command, .shift])
            }
        }
    }
}

struct ContentView: View {
    @State private var appState: AppState = .splash
    @Environment(\.colorScheme) private var colorScheme
    @Environment(ThemeManager.self) private var themeManager
    
    private var isDark: Bool {
        themeManager.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        ZStack {
            themeManager.canvasBg(isDark: isDark)
                .ignoresSafeArea()
            
            switch appState {
            case .splash:
                SplashView(appState: $appState)
            case .auth:
                AuthGateView(appState: $appState)
            case .caseSelection:
                CaseGateView(appState: $appState)
            case .workspace:
                WorkspaceView(appState: $appState)
            }
        }
        .frame(minWidth: 720, minHeight: 500)
        .focusEffectDisabled()
    }
}
