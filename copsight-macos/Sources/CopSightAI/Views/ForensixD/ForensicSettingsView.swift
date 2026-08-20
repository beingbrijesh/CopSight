import SwiftUI

struct ForensicSettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    var onSwitchCase: (() -> Void)?
    
    @State private var officerName = "Officer Brijesh"
    @State private var officerId = "IO-7482"
    @State private var stationId = "CYBER-CRIME-UNIT-HQ"
    @State private var activeCaseNumber = "OP-TANGO-24"
    @State private var isDaemonRunning = true
    @State private var rpcPort = "54322"
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 4) {
                    Text("Forensic Station Configuration")
                        .font(.system(size: 28, weight: .light))
                        .foregroundColor(.white)
                    Text("MANAGE EXAMINER CREDENTIALS, HARDWARE INTERFACES & WORKSTATION AESTHETICS")
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .tracking(2)
                        .foregroundColor(.white.opacity(0.8))
                }
                
                // Theme Customization Card
                GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack {
                            Circle()
                                .fill(theme.iconCircleBg(isDark: isDark))
                                .frame(width: 38, height: 38)
                                .overlay(
                                    Image(systemName: "paintpalette.fill")
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                        .font(.system(size: 16))
                                )
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Workstation Visual Aesthetics & Theme")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                                Text("DUAL-THEME ENGINE (SOLID OCEAN BLUE LIGHT / ONYX DARK)")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .tracking(1)
                                    .foregroundColor(.white.opacity(0.75))
                            }
                            
                            Spacer()
                        }
                        
                        // 3 Theme Switcher Cards
                        HStack(spacing: 16) {
                            ForEach(ThemeMode.allCases) { m in
                                let isSelected = theme.mode == m
                                Button(action: {
                                    theme.setMode(m)
                                }) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        HStack {
                                            Circle()
                                                .fill(isSelected ? theme.primaryAccent(isDark: isDark) : theme.iconCircleBg(isDark: isDark))
                                                .frame(width: 34, height: 34)
                                                .overlay(
                                                    Image(systemName: m.icon)
                                                        .foregroundColor(isSelected ? theme.primaryAccentText(isDark: isDark) : .white)
                                                        .font(.system(size: 15))
                                                )
                                            
                                            Spacer()
                                            
                                            if isSelected {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundColor(theme.primaryAccent(isDark: isDark))
                                                    .font(.system(size: 16))
                                            }
                                        }
                                        
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(m.title)
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(.white)
                                            Text(m.subtitle)
                                                .font(.system(size: 10, design: .monospaced))
                                                .foregroundColor(.white.opacity(0.75))
                                        }
                                    }
                                    .padding(16)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(isSelected
                                        ? (isDark ? Color.white.opacity(0.16) : CopSightTheme.coral.opacity(0.20))
                                        : theme.insetFill(isDark: isDark)
                                    )
                                    .cornerRadius(CopSightTheme.innerRadius)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CopSightTheme.innerRadius, style: .continuous)
                                            .strokeBorder(isSelected ? theme.primaryAccent(isDark: isDark) : theme.insetBorder(isDark: isDark), lineWidth: isSelected ? 2 : 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                    .padding(20)
                }
                
                // Case & Examiner Configuration
                GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack {
                            Circle()
                                .fill(theme.iconCircleBg(isDark: isDark))
                                .frame(width: 38, height: 38)
                                .overlay(
                                    Image(systemName: "person.text.rectangle.fill")
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                        .font(.system(size: 16))
                                )
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Investigating Officer & Active Case Dossier")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                                Text("ACTIVE CASE SESSION AND CUSTODY SIGN-OFF CREDENTIALS")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .tracking(1)
                                    .foregroundColor(.white.opacity(0.75))
                            }
                            
                            Spacer()
                            
                            Button(action: { onSwitchCase?() }) {
                                HStack(spacing: 6) {
                                    Image(systemName: "arrow.triangle.swap")
                                    Text("Switch Active Case")
                                }
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundColor(theme.primaryAccentText(isDark: isDark))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(theme.primaryAccent(isDark: isDark))
                                .cornerRadius(100)
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                        }
                        
                        VStack(spacing: 10) {
                            ProfileSettingRow(label: "CURRENT ACTIVE CASE", value: activeCaseNumber, isMonospaced: true, isHighlight: true)
                            ProfileSettingRow(label: "INVESTIGATOR NAME", value: officerName, isMonospaced: false, isHighlight: false)
                            ProfileSettingRow(label: "CREDENTIAL OFFICER ID", value: officerId, isMonospaced: true, isHighlight: false)
                            ProfileSettingRow(label: "STATION UNIT IDENTIFIER", value: stationId, isMonospaced: true, isHighlight: false)
                        }
                    }
                    .padding(20)
                }
                
                // Low-level Daemon RPC Diagnostics
                GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack {
                            Circle()
                                .fill(theme.iconCircleBg(isDark: isDark))
                                .frame(width: 38, height: 38)
                                .overlay(
                                    Image(systemName: "terminal.fill")
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                        .font(.system(size: 16))
                                )
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Forensic Engine Background Daemon (RPC)")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                                Text("LOW-LEVEL HARDWARE & CRYPTO ENGINE SUBSYSTEMS")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .tracking(1)
                                    .foregroundColor(.white.opacity(0.75))
                            }
                            
                            Spacer()
                            
                            HStack(spacing: 6) {
                                Circle().fill(isDaemonRunning ? CopSightTheme.emerald : CopSightTheme.red).frame(width: 8, height: 8)
                                Text(isDaemonRunning ? "DAEMON ACTIVE" : "STOPPED")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(isDaemonRunning ? CopSightTheme.emerald : CopSightTheme.red)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background((isDaemonRunning ? CopSightTheme.emerald : CopSightTheme.red).opacity(0.2))
                            .cornerRadius(100)
                        }
                        
                        VStack(spacing: 10) {
                            ProfileSettingRow(label: "LOCAL RPC RPC PORT", value: "127.0.0.1:\(rpcPort)", isMonospaced: true, isHighlight: false)
                            ProfileSettingRow(label: "IOKIT USB BUS DRIVER", value: "AppleUSBLib v1.0", isMonospaced: true, isHighlight: false)
                            ProfileSettingRow(label: "CRYPTO ENGINE DIGEST", value: "SHA-256 / AES-GCM (Hardware Accelerated)", isMonospaced: true, isHighlight: false)
                        }
                    }
                    .padding(20)
                }
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 60)
            .thinScrollable()
        }
        .scrollIndicators(.hidden)
    }
}

struct ProfileSettingRow: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let label: String
    let value: String
    let isMonospaced: Bool
    let isHighlight: Bool
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.8))
            
            Spacer()
            
            Text(value)
                .font(.system(size: 12, weight: isHighlight ? .bold : .medium, design: isMonospaced ? .monospaced : .default))
                .foregroundColor(isHighlight ? theme.primaryAccent(isDark: isDark) : .white)
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
