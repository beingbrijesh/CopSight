import SwiftUI

struct DecryptionToolkitView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var activeVector = "whatsapp"
    @State private var hexKey = ""
    @State private var targetDevice = "iPhone 15 Pro Max (00008120-001234567890)"
    
    struct VectorItem: Identifiable {
        let id: String
        let title: String
        let desc: String
        let icon: String
        let badge: String
    }
    
    let vectors: [VectorItem] = [
        VectorItem(id: "whatsapp", title: "Crypt14 / Crypt15 Key Decryption", desc: "Decrypt raw SQLite databases using 64-char key hex or keyfile", icon: "key.fill", badge: "SQLite Engine"),
        VectorItem(id: "ram", title: "Volatile RAM Heap Dump Analyzer", desc: "6-method memory acquisition chain to extract live WhatsApp key vectors", icon: "cpu", badge: "Volatile Memory"),
        VectorItem(id: "hardware", title: "MediaTek BROM / Hardware Exploit", desc: "Physical partition extraction via hardware bootrom exploit vectors", icon: "bolt.fill", badge: "Physical BROM"),
        VectorItem(id: "notifications", title: "Notification Stream Scraper", desc: "Intercept live encrypted message payloads from notification buffers", icon: "bell.fill", badge: "Live Listener"),
        VectorItem(id: "ui", title: "Accessibility Screen Harvester", desc: "Extract visible chat messages directly from foreground UI nodes", icon: "eye.fill", badge: "UI Hierarchy"),
        VectorItem(id: "media", title: "Encrypted Media Partition Harvester", desc: "Extract unencrypted voice notes, videos, and media metadata", icon: "internaldrive.fill", badge: "Media Storage")
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Forensic Decryption & Exploitation Suite")
                            .font(.system(size: 28, weight: .light))
                            .foregroundColor(.white)
                        Text("Execute advanced decryption chains against protected WhatsApp SQLite databases, extract volatile RAM keys, and bypass locked chipsets using low-level hardware exploits.")
                            .font(.system(size: 11.5))
                            .foregroundColor(.white.opacity(0.85))
                    }
                    
                    Spacer()
                    
                    HStack(spacing: 8) {
                        Image(systemName: "iphone")
                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                            .font(.system(size: 12))
                        Text(targetDevice)
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(theme.insetFill(isDark: isDark))
                    .cornerRadius(100)
                    .overlay(
                        RoundedRectangle(cornerRadius: 100)
                            .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                    )
                }
                
                // Vector Grid (2 Rows of 3 Columns)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    ForEach(vectors) { vec in
                        let isSelected = activeVector == vec.id
                        Button(action: { activeVector = vec.id }) {
                            GlassPanel(cornerRadius: CopSightTheme.panelRadius, isHighlighted: isSelected) {
                                VStack(alignment: .leading, spacing: 14) {
                                    HStack {
                                        Circle()
                                            .fill(isSelected ? theme.primaryAccent(isDark: isDark) : theme.iconCircleBg(isDark: isDark))
                                            .frame(width: 38, height: 38)
                                            .overlay(
                                                Image(systemName: vec.icon)
                                                    .foregroundColor(isSelected ? theme.primaryAccentText(isDark: isDark) : .white)
                                                    .font(.system(size: 16))
                                            )
                                        Spacer()
                                        Text(vec.badge)
                                            .font(.system(size: 9.5, design: .monospaced))
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 3)
                                            .background(Color.white.opacity(0.08))
                                            .foregroundColor(.white.opacity(0.9))
                                            .cornerRadius(6)
                                    }
                                    
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(vec.title)
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundColor(.white)
                                            .lineLimit(1)
                                        
                                        Text(vec.desc)
                                            .font(.system(size: 10.5))
                                            .foregroundColor(.white.opacity(0.75))
                                            .lineLimit(2)
                                    }
                                }
                                .padding(18)
                            }
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                    }
                }
                
                // Active Vector Workspace
                GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                    VStack(alignment: .leading, spacing: 20) {
                        if activeVector == "whatsapp" {
                            whatsappDecryptor
                        } else if activeVector == "ram" {
                            vectorPanel(icon: "cpu", title: "Volatile RAM Heap Dump Analyzer",
                                       desc: "Executes 6 parallel volatile memory dump methods to extract AES keys directly from runtime RAM",
                                       chainInfo: "1. `am dumpheap` (Activity Manager) → 2. Root `/proc/[pid]/mem` mapping → 3. Debugger attach → 4. Art runtime heap snapshot → 5. Key entropy analyzer → 6. Automated AES test decryption.",
                                       buttonLabel: "Trigger Volatile RAM Dump & Scan")
                        } else if activeVector == "hardware" {
                            vectorPanel(icon: "bolt.fill", title: "MediaTek BROM / Chipset Hardware Exploitation",
                                       desc: "Bypass bootloader and secure boot on MediaTek devices via low-level BROM / Preloader handshake",
                                       chainInfo: "Inspect the connected device bootloader, chipset family (MT6765, MT6768, MT6833, etc.), and hardware test points. Initialize mtkclient exploit framework, then execute BROM dump.",
                                       buttonLabel: "Inspect Chipset & Bootloader")
                        } else if activeVector == "notifications" {
                            vectorPanel(icon: "bell.fill", title: "Notification Stream Scraper",
                                       desc: "Harvests live and pending encrypted notifications from Android NotificationListenerService",
                                       chainInfo: "Access decrypted chat messages, sender identities, and previews that have surfaced in the device notification bar even when SQLite storage is protected.",
                                       buttonLabel: "Scrape Active Notifications")
                        } else if activeVector == "ui" {
                            vectorPanel(icon: "eye.fill", title: "Accessibility UI Screen Harvester",
                                       desc: "Directly parses visible chat text from foreground Android UI nodes",
                                       chainInfo: "Extracts the active screen DOM hierarchy via `uiautomator dump` to capture visible messages without needing SQLite keys or root privilege.",
                                       buttonLabel: "Capture Active Screen Messages")
                        } else if activeVector == "media" {
                            vectorPanel(icon: "internaldrive.fill", title: "Encrypted Media Partition Harvester",
                                       desc: "Extract voice notes (.opus), photos, and documents from external media storage",
                                       chainInfo: "Pulls all unencrypted voice recordings, received documents, and thumbnails stored in `/sdcard/WhatsApp/Media` and `/sdcard/Android/media/com.whatsapp`.",
                                       buttonLabel: "Harvest WhatsApp Media Files")
                        }
                    }
                    .padding(24)
                }
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 60)
            .thinScrollable()
        }
        .scrollIndicators(.hidden)
    }
    
    private var whatsappDecryptor: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 12) {
                Circle()
                    .fill(theme.iconCircleBg(isDark: isDark))
                    .frame(width: 44, height: 44)
                    .overlay(
                        Image(systemName: "key.fill")
                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                            .font(.system(size: 20))
                    )
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Crypt14 / Crypt15 WhatsApp Decryption Engine")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                    Text("Decrypt msgstore.db.crypt14 / crypt15 databases into queryable SQLite records")
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.85))
                }
            }
            
            Divider().background(Color.white.opacity(0.12))
            
            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("64-CHARACTER HEXADECIMAL KEY VECTOR")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                        
                        TextField("e.g. 4a2f8b91...", text: $hexKey)
                            .font(.system(size: 12, design: .monospaced))
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                            )
                    }
                    
                    Button(action: {}) {
                        HStack(spacing: 6) {
                            Image(systemName: "lock.open.fill")
                            Text("Execute SQLite Decryption")
                        }
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(theme.primaryAccent(isDark: isDark))
                        .cornerRadius(100)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
                .frame(maxWidth: .infinity)
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("ENGINE SPECIFICATIONS")
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("• Supports AES-GCM 256-bit encryption")
                        Text("• Auto-strips 122-byte crypt14/15 IV header")
                        Text("• Validates SQLite header signature")
                        Text("• Emits decrypted msgstore.db & contacts")
                    }
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.white.opacity(0.85))
                }
                .padding(16)
                .background(theme.insetFill(isDark: isDark))
                .cornerRadius(14)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                )
                .frame(width: 300)
            }
        }
    }
    
    private func vectorPanel(icon: String, title: String, desc: String, chainInfo: String, buttonLabel: String) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 12) {
                Circle()
                    .fill(theme.iconCircleBg(isDark: isDark))
                    .frame(width: 44, height: 44)
                    .overlay(
                        Image(systemName: icon)
                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                            .font(.system(size: 20))
                    )
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                    Text(desc)
                        .font(.system(size: 11.5))
                        .foregroundColor(.white.opacity(0.85))
                }
            }
            
            Divider().background(Color.white.opacity(0.12))
            
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(CopSightTheme.amber)
                        .font(.system(size: 13))
                    Text("Extraction Chain:")
                        .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                        .foregroundColor(CopSightTheme.amber)
                }
                Text(chainInfo)
                    .font(.system(size: 10.5))
                    .foregroundColor(.white.opacity(0.85))
                    .lineSpacing(3)
            }
            .padding(16)
            .background(theme.insetFill(isDark: isDark))
            .cornerRadius(14)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
            )
            
            Button(action: {}) {
                HStack(spacing: 6) {
                    Image(systemName: icon)
                    Text(buttonLabel)
                }
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundColor(theme.primaryAccentText(isDark: isDark))
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(theme.primaryAccent(isDark: isDark))
                .cornerRadius(100)
            }
            .buttonStyle(.plain)
            .focusable(false)
            .focusEffectDisabled()
        }
    }
}
