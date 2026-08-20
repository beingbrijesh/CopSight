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
