import SwiftUI

struct EvidenceViewerView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var activeTab = "overview" // overview, messages, entities
    @State private var caseNumber = "OP-TANGO-24"
    @State private var rootHash = "A9F8B2C4E3D59012"
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 20) {
                GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                    VStack(alignment: .leading, spacing: 20) {
                        
                        // Header
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Forensic Evidence Center")
                                    .font(.system(size: 24, weight: .light))
                                    .foregroundColor(.white)
                                Text("ANALYSIS & CUSTODY DOSSIERS")
                                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                    .tracking(1)
                                    .foregroundColor(.white.opacity(0.8))
                            }
                            Spacer()
                            
                            HStack(spacing: 12) {
                                HStack(spacing: 6) {
                                    Image(systemName: "lock.fill")
                                        .foregroundColor(CopSightTheme.emerald)
                                        .font(.system(size: 12))
                                    Text("Local Storage Only")
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(.white)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(theme.insetFill(isDark: isDark))
                                .cornerRadius(100)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 100)
                                        .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                )
                                
                                Button(action: {}) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "icloud.and.arrow.up")
                                        Text("Sync to Cloud")
                                    }
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundColor(theme.primaryAccentText(isDark: isDark))
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 7)
                                    .background(theme.primaryAccent(isDark: isDark))
                                    .cornerRadius(100)
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                        
                        Divider().background(Color.white.opacity(0.12))
                        
                        // Tabs & Idempotent tag
                        HStack {
                            HStack(spacing: 4) {
                                EvidenceTabButton(title: "Reports & UFDR", isActive: activeTab == "overview") { activeTab = "overview" }
                                EvidenceTabButton(title: "Chats (2)", isActive: activeTab == "messages") { activeTab = "messages" }
                                EvidenceTabButton(title: "Entities (4)", isActive: activeTab == "entities") { activeTab = "entities" }
                            }
                            .padding(4)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(100)
                            .overlay(
                                RoundedRectangle(cornerRadius: 100)
                                    .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                            )
                            
                            Spacer()
                            
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.shield.fill")
                                    .foregroundColor(CopSightTheme.emerald)
                                    .font(.system(size: 13))
                                Text("Idempotent Sync: Cryptographically Deduplicated (SHA-256)")
                                    .font(.system(size: 9.5, design: .monospaced))
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
                        
                        // Tab Content
                        if activeTab == "overview" {
                            overviewTab
                        } else if activeTab == "messages" {
                            messagesTab
                        } else if activeTab == "entities" {
                            entitiesTab
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
    
    private var overviewTab: some View {
        VStack(spacing: 20) {
            HStack(spacing: 16) {
                DeliverableCard(icon: "doc.zipper", tag: "Standard", title: "UFDR Archive (.ufdr)", desc: "Universal Forensic Data Repository container with embedded integrity hashes.", status: "Generated")
                DeliverableCard(icon: "doc.text.fill", tag: "Court Grade", title: "Forensic Report (PDF)", desc: "Formal law enforcement forensic summary with examiner authorization sign-off.", status: "Compiled")
                DeliverableCard(icon: "doc.badge.gearshape", tag: "NIST XML", title: "Digital Forensics XML", desc: "Standardized DFXML 1.2 manifest containing all file metadata and SHA-256 hashes.", status: "Exported")
            }
            
            // Custody Card
            HStack {
                HStack(spacing: 14) {
                    Circle()
                        .fill(theme.iconCircleBg(isDark: isDark))
                        .frame(width: 44, height: 44)
                        .overlay(
                            Image(systemName: "checkmark.shield.fill")
                                .foregroundColor(CopSightTheme.emerald)
                                .font(.system(size: 18))
                        )
                    
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Cryptographic Chain-of-Custody Verification")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundColor(.white)
                        
                        HStack(spacing: 4) {
                            Text("Case:")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                            Text(caseNumber)
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                            Text("| Root Hash:")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                            Text(rootHash)
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                        }
                    }
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button(action: {}) {
                        HStack(spacing: 6) {
                            Image(systemName: "folder")
                            Text("Reveal in Finder")
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
                    
                    Text("SEALED & VERIFIED")
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(CopSightTheme.emerald.opacity(0.2))
                        .foregroundColor(CopSightTheme.emerald)
                        .cornerRadius(100)
                        .overlay(
                            RoundedRectangle(cornerRadius: 100)
                                .strokeBorder(CopSightTheme.emerald.opacity(0.3), lineWidth: 1)
                        )
                }
            }
            .padding(18)
            .background(theme.insetFill(isDark: isDark))
            .cornerRadius(CopSightTheme.innerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                    .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
            )
        }
    }
    
    private var messagesTab: some View {
        VStack(spacing: 12) {
            EvidenceMessageBubble(sender: "Target", recipient: "Unknown", message: "Meet me at the location in 10 mins.", isOutgoing: true, appName: "WhatsApp", timestamp: "2026-08-19 11:42")
            EvidenceMessageBubble(sender: "Unknown", recipient: "Target", message: "Copy that. I have the package.", isOutgoing: false, appName: "WhatsApp", timestamp: "2026-08-19 11:43")
        }
    }
    
    private var entitiesTab: some View {
        VStack(spacing: 10) {
            EntityRow(value: "+1 (555) 019-2831", type: "PHONE_NUMBER", confidence: "98% Confidence")
            EntityRow(value: "meet_location_drop", type: "LOCATION_PIN", confidence: "100% Confidence")
            EntityRow(value: "Operation Tango", type: "NAMED_ENTITY", confidence: "85% Confidence")
            EntityRow(value: "0x71C...392B", type: "CRYPTO_WALLET", confidence: "Indexed")
        }
    }
}

struct EvidenceTabButton: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let title: String
    let isActive: Bool
    let action: () -> Void
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11.5, weight: isActive ? .bold : .medium, design: .monospaced))
                .foregroundColor(isActive ? theme.primaryAccentText(isDark: isDark) : .white.opacity(0.8))
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(isActive ? theme.primaryAccent(isDark: isDark) : Color.clear)
                .cornerRadius(100)
        }
        .buttonStyle(.plain)
        .focusable(false)
        .focusEffectDisabled()
    }
}

struct DeliverableCard: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let icon: String
    let tag: String
    let title: String
    let desc: String
    let status: String
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Circle()
                    .fill(theme.iconCircleBg(isDark: isDark))
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: icon)
                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                            .font(.system(size: 16))
                    )
                Spacer()
                Text(tag)
                    .font(.system(size: 9.5, design: .monospaced))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.white.opacity(0.08))
                    .foregroundColor(.white.opacity(0.9))
                    .cornerRadius(6)
            }
            
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                
                Text(desc)
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.75))
                    .lineLimit(2)
            }
            
            Divider().background(Color.white.opacity(0.12))
            
            HStack {
                Text(status)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(.white.opacity(0.85))
                Spacer()
                Image(systemName: "arrow.down.circle.fill")
                    .foregroundColor(theme.primaryAccent(isDark: isDark))
                    .font(.system(size: 16))
            }
        }
        .padding(18)
        .background(theme.insetFill(isDark: isDark))
        .cornerRadius(CopSightTheme.innerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
        )
    }
}

struct EvidenceMessageBubble: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let sender: String
    let recipient: String
    let message: String
    let isOutgoing: Bool
    let appName: String
    let timestamp: String
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        HStack {
            if isOutgoing { Spacer() }
            
            VStack(alignment: isOutgoing ? .trailing : .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(sender)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                    Text("via \(appName)")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.white.opacity(0.6))
                    Text(timestamp)
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))
                }
                
                Text(message)
                    .font(.system(size: 12))
                    .foregroundColor(.white)
                    .padding(12)
                    .background(isOutgoing
                        ? (isDark ? Color.white.opacity(0.18) : CopSightTheme.coral.opacity(0.3))
                        : theme.insetFill(isDark: isDark)
                    )
                    .cornerRadius(14)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                    )
            }
            
            if !isOutgoing { Spacer() }
        }
    }
}

struct EntityRow: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let value: String
    let type: String
    let confidence: String
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        HStack {
            Text(value)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
            Spacer()
            Text(type)
                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(theme.primaryAccent(isDark: isDark).opacity(0.2))
                .foregroundColor(theme.primaryAccent(isDark: isDark))
                .cornerRadius(6)
            Text(confidence)
                .font(.system(size: 9.5, design: .monospaced))
                .foregroundColor(.white.opacity(0.7))
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
