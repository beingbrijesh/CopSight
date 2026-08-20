import SwiftUI

struct LiveConsoleView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var isAcquiring = false
    @State private var currentSpeed: Double = 42.5
    @State private var totalArtifacts: Int = 1024
    
    struct LogEntry: Identifiable {
        let id = UUID()
        let timestamp: String
        let level: String
        let message: String
    }
    
    @State private var logs: [LogEntry] = [
        LogEntry(timestamp: "09:41:22", level: "INFO", message: "Forensic telemetry stream initialized."),
        LogEntry(timestamp: "09:41:25", level: "INFO", message: "Connected to device: iPhone 15 Pro Max."),
        LogEntry(timestamp: "09:41:28", level: "WARN", message: "Attempting handshake with AppleUSBLib..."),
        LogEntry(timestamp: "09:41:30", level: "SUCCESS", message: "Device paired. Bypassing lockdown daemon."),
        LogEntry(timestamp: "09:41:34", level: "SUCCESS", message: "DFXML digest verification initialized (SHA-256)."),
        LogEntry(timestamp: "09:41:38", level: "INFO", message: "Extracting encrypted APFS volume /private/var..."),
        LogEntry(timestamp: "09:41:42", level: "SUCCESS", message: "Keybag payload dumped. 38 key vectors recovered.")
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(spacing: 0) {
                // Header
                HStack(alignment: .center) {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(theme.iconCircleBg(isDark: isDark))
                            .frame(width: 38, height: 38)
                            .overlay(
                                Image(systemName: "waveform.path.ecg")
                                    .font(.system(size: 16))
                                    .foregroundColor(theme.primaryAccent(isDark: isDark))
                            )
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Forensic Stream")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            Text("LIVE TELEMETRY & LOGS")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .tracking(1)
                                .foregroundColor(.white.opacity(0.75))
                        }
                    }
                    
                    Spacer()
                    
                    HStack(spacing: 8) {
                        Button(action: { logs.removeAll() }) {
                            Image(systemName: "trash")
                                .font(.system(size: 11))
                                .foregroundColor(.white.opacity(0.8))
                                .frame(width: 28, height: 28)
                                .background(theme.insetFill(isDark: isDark))
                                .clipShape(Circle())
                                .overlay(
                                    Circle().strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)
                .padding(.bottom, 12)
                
                Divider().background(Color.white.opacity(0.12))
                
                // Body
                VStack(spacing: 12) {
                    // Speed Gauge & Status Summary
                    HStack(spacing: 12) {
                        // Circular Speed Gauge
                        ZStack {
                            Circle()
                                .strokeBorder(Color.white.opacity(0.14), lineWidth: 5)
                                .frame(width: 52, height: 52)
                            
                            Circle()
                                .trim(from: 0, to: isAcquiring ? 0.75 : 0.45)
                                .stroke(theme.primaryAccent(isDark: isDark), style: StrokeStyle(lineWidth: 5, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                                .frame(width: 52, height: 52)
                            
                            VStack(spacing: 0) {
                                Text(String(format: "%.1f", currentSpeed))
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                                Text("MB/s")
                                    .font(.system(size: 7, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(isAcquiring ? CopSightTheme.emerald : theme.primaryAccent(isDark: isDark))
                                    .frame(width: 6, height: 6)
                                Text(isAcquiring ? "STREAMING DATA" : "ENGINE READY")
                                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                            }
                            Text(isAcquiring ? "Extracting WhatsApp SQLite storage..." : "Awaiting bitstream instruction...")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                                .lineLimit(1)
                        }
                        
                        Spacer()
                        
                        Text(isAcquiring ? "Active" : "Standby")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 4)
                            .background(isAcquiring ? CopSightTheme.emerald.opacity(0.25) : Color.white.opacity(0.12))
                            .foregroundColor(isAcquiring ? CopSightTheme.emerald : .white)
                            .cornerRadius(100)
                    }
                    .padding(12)
                    .background(theme.insetFill(isDark: isDark))
                    .cornerRadius(CopSightTheme.innerRadius)
                    .overlay(
                        RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                            .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                    )
                    
                    // Metrics Row
                    HStack(spacing: 8) {
                        HStack {
                            Text("ARTIFACTS:")
                                .font(.system(size: 9.5, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                            Spacer()
                            Text("\(totalArtifacts)")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        .padding(10)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(10)
                        
                        HStack {
                            Text("BITSTREAM:")
                                .font(.system(size: 9.5, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                            Spacer()
                            Text(isAcquiring ? "Active" : "Idle")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundColor(isAcquiring ? CopSightTheme.emerald : .white)
                        }
                        .padding(10)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(10)
                    }
                    
                    // Terminal Log Feed (Generous expanded area inside 500pt card)
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(logs) { log in
                                HStack(alignment: .top, spacing: 6) {
                                    Text(log.timestamp)
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.5))
                                    
                                    Text("[\(log.level)]")
                                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                        .foregroundColor(
                                            log.level == "SUCCESS" ? CopSightTheme.emerald :
                                            log.level == "WARN" ? CopSightTheme.amber :
                                            log.level == "ERROR" ? CopSightTheme.red : .white.opacity(0.7)
                                        )
                                    
                                    Text(log.message)
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(log.level == "SUCCESS" ? CopSightTheme.emeraldBright : .white)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(4)
                        .thinScrollable()
                    }
                    .padding(12)
                    .frame(maxHeight: .infinity)
                    .background(Color.black.opacity(isDark ? 0.5 : 0.35))
                    .cornerRadius(14)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
                    )
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                
                Spacer(minLength: 0)
            }
        }
        .frame(height: 500)
    }
}
