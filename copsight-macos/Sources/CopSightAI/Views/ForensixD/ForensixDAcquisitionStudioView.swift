import SwiftUI

struct ForensixDAcquisitionStudioView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    struct AcquisitionCategory: Identifiable {
        let id: String
        let name: String
        let targetFile: String
        let countText: String
        let progress: Double
        let status: String
        let statusColor: Color
        let icon: String
    }
    
    let categories: [AcquisitionCategory] = [
        AcquisitionCategory(id: "whatsapp", name: "WhatsApp Encrypted Storage", targetFile: "msgstore.db.crypt15", countText: "4,280 Messages", progress: 1.0, status: "Acquired & Hashed", statusColor: CopSightTheme.emerald, icon: "message.fill"),
        AcquisitionCategory(id: "keychain", name: "Hardware Keybag & Keychain", targetFile: "keychain-2.db", countText: "38 Credentials", progress: 0.85, status: "Decrypting Vector", statusColor: CopSightTheme.amber, icon: "key.fill"),
        AcquisitionCategory(id: "calls", name: "Call Logs & SMS Records", targetFile: "sms.db / CallHistory.db", countText: "2,140 Records", progress: 1.0, status: "Verified Digest", statusColor: CopSightTheme.emerald, icon: "phone.fill"),
        AcquisitionCategory(id: "media", name: "Photos & Audio Attachments", targetFile: "/sdcard/WhatsApp/Media", countText: "640 Items (320 MB)", progress: 0.65, status: "Streaming Sectors", statusColor: CopSightTheme.cyan, icon: "photo.stack.fill"),
        AcquisitionCategory(id: "deleted", name: "Unallocated Space Carving", targetFile: "Physical Raw Sectors", countText: "68 Carved Fragments", progress: 0.40, status: "Carving Extents", statusColor: CopSightTheme.coral, icon: "trash.fill")
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GeometryReader { geo in
            let isStacked = geo.size.width < 1050
            
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    HStack(alignment: .center) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Acquisition Studio")
                                .font(.system(size: 28, weight: .light))
                                .foregroundColor(.white)
                            Text("Configure extraction depth, filter scope, and monitor real-time bitstream telemetry & artifact carving")
                                .font(.system(size: 11.5))
                                .foregroundColor(.white.opacity(0.85))
                        }
                        
                        Spacer()
                        
                        HStack(spacing: 8) {
                            HStack(spacing: 6) {
                                Circle().fill(CopSightTheme.emerald).frame(width: 7, height: 7)
                                Text("Write-Blocker Active")
                                    .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(CopSightTheme.emerald)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(CopSightTheme.emerald.opacity(0.2))
                            .cornerRadius(100)
                        }
                    }
                    
                    // Split View: Wizard + Console (Responsive stack)
                    if isStacked {
                        VStack(spacing: 20) {
                            AcquisitionWizardView()
                                .frame(maxWidth: .infinity)
                            
                            LiveConsoleView()
                                .frame(maxWidth: .infinity)
                        }
                    } else {
                        HStack(alignment: .top, spacing: 18) {
                            AcquisitionWizardView()
                                .frame(maxWidth: .infinity)
                            
                            LiveConsoleView()
                                .frame(maxWidth: .infinity)
                        }
                    }
                    
                    // Bottom Row: Live Artifact Carving & Data Category Acquisition Queue
                    GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Circle()
                                    .fill(theme.iconCircleBg(isDark: isDark))
                                    .frame(width: 38, height: 38)
                                    .overlay(
                                        Image(systemName: "square.stack.3d.down.right.fill")
                                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                                            .font(.system(size: 16))
                                    )
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Real-Time Artifact Extraction Queue & Carving Breakdown")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("ITEMIZED FORENSIC DATA RECOVERY STREAMS & SHA-256 HASH PIPELINES")
                                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                        .tracking(1)
                                        .foregroundColor(.white.opacity(0.75))
                                }
                                
                                Spacer()
                                
                                HStack(spacing: 6) {
                                    Image(systemName: "checkmark.shield.fill")
                                        .foregroundColor(CopSightTheme.emerald)
                                        .font(.system(size: 13))
                                    Text("DFXML 1.2 Compliant")
                                        .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.85))
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(theme.insetFill(isDark: isDark))
                                .cornerRadius(100)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 100)
                                        .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                )
                            }
                            
                            // Category Rows Table
                            VStack(spacing: 8) {
                                ForEach(categories) { cat in
                                    HStack(spacing: 14) {
                                        Circle()
                                            .fill(theme.iconCircleBg(isDark: isDark))
                                            .frame(width: 32, height: 32)
                                            .overlay(
                                                Image(systemName: cat.icon)
                                                    .font(.system(size: 14))
                                                    .foregroundColor(cat.statusColor)
                                            )
                                        
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(cat.name)
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(.white)
                                            Text(cat.targetFile)
                                                .font(.system(size: 10, design: .monospaced))
                                                .foregroundColor(.white.opacity(0.7))
                                        }
                                        .frame(width: 240, alignment: .leading)
                                        
                                        Text(cat.countText)
                                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                                            .foregroundColor(.white.opacity(0.9))
                                        
                                        Spacer()
                                        
                                        // Progress Bar
                                        VStack(alignment: .trailing, spacing: 3) {
                                            Text(String(format: "%.0f%%", cat.progress * 100))
                                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                                .foregroundColor(.white.opacity(0.8))
                                            
                                            GeometryReader { barGeo in
                                                ZStack(alignment: .leading) {
                                                    RoundedRectangle(cornerRadius: 3)
                                                        .fill(Color.white.opacity(0.12))
                                                        .frame(height: 5)
                                                    RoundedRectangle(cornerRadius: 3)
                                                        .fill(cat.statusColor)
                                                        .frame(width: barGeo.size.width * cat.progress, height: 5)
                                                }
                                            }
                                            .frame(width: 120, height: 5)
                                        }
                                        
                                        Text(cat.status)
                                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 4)
                                            .background(cat.statusColor.opacity(0.2))
                                            .foregroundColor(cat.statusColor)
                                            .cornerRadius(100)
                                    }
                                    .padding(12)
                                    .background(theme.insetFill(isDark: isDark))
                                    .cornerRadius(CopSightTheme.innerRadius)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                                            .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                    )
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
}
