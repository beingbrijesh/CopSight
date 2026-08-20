import SwiftUI

/// Available Station Theme Modes
enum ThemeMode: String, CaseIterable, Identifiable {
    case system = "system"
    case light = "light"
    case dark = "dark"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .system: return "macOS Default"
        case .light: return "Oceanic Blue"
        case .dark: return "Minimal Dark"
        }
    }
    
    var subtitle: String {
        switch self {
        case .system: return "System Sync"
        case .light: return "Light Mode"
        case .dark: return "Dark Mode"
        }
    }
    
    var icon: String {
        switch self {
        case .system: return "laptopcomputer"
        case .light: return "sun.max.fill"
        case .dark: return "moon.fill"
        }
    }
}

/// Global Reactive Theme Manager driving ForensixD & CopSight dual-theme system
@Observable
final class ThemeManager {
    static let shared = ThemeManager()
    
    var mode: ThemeMode {
        didSet {
            UserDefaults.standard.set(mode.rawValue, forKey: "copsight_theme")
        }
    }
    
    init() {
        let saved = UserDefaults.standard.string(forKey: "copsight_theme") ?? "dark"
        self.mode = ThemeMode(rawValue: saved) ?? .dark
    }
    
    func setMode(_ newMode: ThemeMode) {
        withAnimation(.easeInOut(duration: 0.25)) {
            self.mode = newMode
        }
    }
    
    // Resolve current color scheme
    var preferredColorScheme: ColorScheme? {
        switch mode {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
    
    func isDark(systemScheme: ColorScheme) -> Bool {
        switch mode {
        case .system: return systemScheme == .dark
        case .light: return false
        case .dark: return true
        }
    }
    
    // MARK: - Dynamic Semantic Tokens
    
    func canvasBg(isDark: Bool) -> Color {
        isDark ? CopSightTheme.onyxBlack : CopSightTheme.oceanBlue
    }
    
    func primaryAccent(isDark: Bool) -> Color {
        isDark ? Color.white : CopSightTheme.coral
    }
    
    func primaryAccentText(isDark: Bool) -> Color {
        isDark ? Color.black : Color.white
    }
    
    func glassFill(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.06) : Color.white.opacity(0.16)
    }
    
    func glassBorder(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.18) : Color.white.opacity(0.24)
    }
    
    func insetFill(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.06) : Color.black.opacity(0.20)
    }
    
    func insetBorder(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.12) : Color.white.opacity(0.14)
    }
    
    func cardShadow(isDark: Bool) -> Color {
        isDark ? Color.black.opacity(0.55) : Color.black.opacity(0.12)
    }
    
    /// Dedicated Icon Circle Background — Darker black/translucent in light mode matching navigation mode pill
    func iconCircleBg(isDark: Bool) -> Color {
        isDark ? Color.white.opacity(0.12) : Color.black.opacity(0.35)
    }
}

/// Static Design Tokens & Constants
enum CopSightTheme {
    // Core Brand Colors
    static let oceanBlue = Color(hex: "2475B5")
    static let onyxBlack = Color(hex: "111111")
    static let coral = Color(hex: "FF7A59")
    
    // Semantic / Status Colors (Vibrant, high contrast)
    static let emerald = Color(hex: "10b981")
    static let emeraldBright = Color(hex: "34d399")
    static let amber = Color(hex: "f59e0b")
    static let red = Color(hex: "ef4444")
    static let rose = Color(hex: "f43e5e")
    static let cyan = Color(hex: "22d3ee")
    static let skyBlue = Color(hex: "38bdf8")
    
    // Radii
    static let panelRadius: CGFloat = 32
    static let navRadius: CGFloat = 40
    static let buttonRadius: CGFloat = 12
    static let innerRadius: CGFloat = 16
}

// Ensure Hex extension exists
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
