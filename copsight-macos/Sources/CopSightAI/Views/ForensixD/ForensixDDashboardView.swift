import SwiftUI

struct ForensixDDashboardView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var officerName = "Officer Brijesh"
    @State private var caseNumber = "OP-TANGO-24"
    @State private var connectedDevices = 1
    @State private var isAcquiring = false
    @State private var liveEvidenceCount = 1024
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GeometryReader { geo in
            let isStacked = geo.size.width < 1150
            
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 22) {
                    
                    // Header Greeting & High-Level Stats
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack(spacing: 0) {
                                Text("Welcome in, ")
                                    .font(.system(size: 30, weight: .light))
                                    .foregroundColor(.white)
                                Text(officerName)
                                    .font(.system(size: 30, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            
                            HStack(spacing: 12) {
                                HStack(spacing: 8) {
                                    Text("ACTIVE CASE")
                                        .font(.system(size: 9.5, weight: .bold))
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                    
                                    Text(caseNumber)
                                        .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                        .foregroundColor(.white)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 4)
                                .background(theme.insetFill(isDark: isDark))
                                .cornerRadius(100)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 100)
                                        .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                )
                                
                                Text("CopSight AI Digital Forensics Station")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(.white.opacity(0.85))
                            }
                        }
                        
                        Spacer()
                        
                        // Stats Counters
                        HStack(spacing: 28) {
                            StatCounter(
                                value: String(format: "%02d", connectedDevices),
                                label: "DEVICES",
                                color: theme.primaryAccent(isDark: isDark)
                            )
                            StatCounter(
                                value: isAcquiring ? "01" : "00",
                                label: "RUNNING TASKS",
                                color: CopSightTheme.emerald
                            )
                            StatCounter(
                                value: "\(liveEvidenceCount)",
                                label: "INDEXED EVIDENCE",
                                color: CopSightTheme.cyan
                            )
                        }
                    }
                    
                    // Dynamic Step Guidance Banner
                    if !isAcquiring && connectedDevices == 0 {
                        stepBanner(step: "STEP 1: CONNECT EVIDENCE TARGET", title: "Connect Target Mobile Device via USB", desc: "Ensure device is unlocked. Tap \"Trust This Computer\" (iOS) or enable \"USB Debugging\" (Android).", btnText: "Open Device Radar", icon: "iphone", color: theme.primaryAccent(isDark: isDark))
                    } else if !isAcquiring && connectedDevices > 0 {
                        stepBanner(step: "STEP 2: DEVICE READY FOR EXTRACTION", title: "iPhone 15 Pro Max Linked & Ready", desc: "Hardware handshake successful. Configure extraction parameters to initiate forensic bitstream acquisition.", btnText: "Configure & Extract", icon: "checkmark.circle.fill", color: CopSightTheme.emerald)
                    } else if isAcquiring {
                        stepBanner(step: "STEP 3: LIVE EXECUTION IN PROGRESS", title: "Streaming Bitstream Telemetry (42.50 MB/s)", desc: "1,024 artifacts acquired and hashed in real-time. Do not disconnect USB cable.", btnText: "View Live Stream", icon: "waveform.path.ecg", color: theme.primaryAccent(isDark: isDark))
                    }
                    
                    // 3-Card Core Section (Responsive: HStack on wide, Vertical Stack on narrow window)
                    if isStacked {
                        VStack(spacing: 20) {
                            DeviceRadarView()
                                .frame(maxWidth: .infinity)
                            
                            LiveConsoleView()
                                .frame(maxWidth: .infinity)
                            
                            AcquisitionWizardView()
                                .frame(maxWidth: .infinity)
                        }
                    } else {
                        HStack(alignment: .top, spacing: 18) {
                            DeviceRadarView()
                                .frame(maxWidth: .infinity)
                            
                            LiveConsoleView()
                                .frame(maxWidth: .infinity)
                            
                            AcquisitionWizardView()
                                .frame(maxWidth: .infinity)
                        }
                    }
                    
                    // Deliverables Summary Card
                    GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                HStack(spacing: 12) {
                                    Circle()
                                        .fill(theme.iconCircleBg(isDark: isDark))
                                        .frame(width: 38, height: 38)
                                        .overlay(
                                            Image(systemName: "doc.zipper")
                                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                                .font(.system(size: 16))
                                        )
                                    
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Forensic Evidence & Deliverables")
                                            .font(.system(size: 16, weight: .bold))
                                            .foregroundColor(.white)
                                        
                                        Text("UFDR ARCHIVES, DFXML MANIFESTS & DECRYPTION")
                                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                            .tracking(1)
                                            .foregroundColor(.white.opacity(0.75))
                                    }
                                }
                                
                                Spacer()
                                
                                HStack(spacing: 6) {
                                    Text("Open Full Evidence Center")
                                    Image(systemName: "arrow.right")
                                }
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundColor(theme.primaryAccentText(isDark: isDark))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(theme.primaryAccent(isDark: isDark))
                                .cornerRadius(100)
                            }
                            
                            if isStacked {
                                VStack(spacing: 10) {
                                    DeliverablePill(title: "UFDR Container (.ufdr)", subtitle: "Universal Evidence Package", status: "Generated", isActive: true)
                                    DeliverablePill(title: "Forensic PDF Report", subtitle: "Court-Admissible Dossier", status: "Compiled", isActive: true)
                                    DeliverablePill(title: "DFXML Manifest v1.2", subtitle: "SHA-256 Hash Digest", status: "Verified", isActive: true)
                                }
                            } else {
                                HStack(spacing: 14) {
                                    DeliverablePill(title: "UFDR Container (.ufdr)", subtitle: "Universal Evidence Package", status: "Generated", isActive: true)
                                    DeliverablePill(title: "Forensic PDF Report", subtitle: "Court-Admissible Dossier", status: "Compiled", isActive: true)
                                    DeliverablePill(title: "DFXML Manifest v1.2", subtitle: "SHA-256 Hash Digest", status: "Verified", isActive: true)
                                }
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
    
    private func stepBanner(step: String, title: String, desc: String, btnText: String, icon: String, color: Color) -> some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            HStack(spacing: 16) {
                Circle()
                    .fill(theme.iconCircleBg(isDark: isDark))
                    .frame(width: 44, height: 44)
                    .overlay(
                        Image(systemName: icon)
                            .foregroundColor(color)
                            .font(.system(size: 20))
                    )
                
                VStack(alignment: .leading, spacing: 3) {
                    Text(step)
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .tracking(1.5)
                        .foregroundColor(color)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 2)
                        .background(color.opacity(0.2))
                        .cornerRadius(100)
                    
                    Text(title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text(desc)
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.85))
                }
                
                Spacer()
                
                HStack {
                    Text(btnText)
                    Image(systemName: "arrow.right")
                }
                .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                .foregroundColor(theme.primaryAccentText(isDark: isDark))
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(theme.primaryAccent(isDark: isDark))
                .cornerRadius(100)
            }
            .padding(18)
        }
    }
}

struct StatCounter: View {
    let value: String
    let label: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                    .shadow(color: color.opacity(0.8), radius: 4)
                
                Text(value)
                    .font(.system(size: 28, weight: .light, design: .monospaced))
                    .foregroundColor(.white)
            }
            
            Text(label)
                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                .tracking(1)
                .foregroundColor(.white.opacity(0.85))
        }
    }
}

struct DeliverablePill: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let title: String
    let subtitle: String
    let status: String
    let isActive: Bool
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundColor(.white)
                Text(subtitle)
                    .font(.system(size: 9.5))
                    .foregroundColor(.white.opacity(0.75))
            }
            Spacer()
            Text(status)
                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(isActive ? CopSightTheme.emerald.opacity(0.2) : Color.white.opacity(0.08))
                .foregroundColor(isActive ? CopSightTheme.emerald : .white.opacity(0.85))
                .cornerRadius(100)
                .overlay(
                    RoundedRectangle(cornerRadius: 100)
                        .strokeBorder(isActive ? CopSightTheme.emerald.opacity(0.35) : Color.clear, lineWidth: 1)
                )
        }
        .padding(14)
        .background(theme.insetFill(isDark: isDark))
        .cornerRadius(CopSightTheme.innerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
        )
    }
}
