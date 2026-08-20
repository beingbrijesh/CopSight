import SwiftUI

struct AcquisitionWizardView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var selectedLevel = "logical"
    @State private var selectedProfile = "all"
    @State private var isAcquiring = false
    
    struct ExtractionLevel: Identifiable {
        let id: String
        let title: String
        let desc: String
        let tag: String
    }
    
    struct ScopeProfile: Identifiable {
        let id: String
        let label: String
        let desc: String
        let icon: String
    }
    
    let levels: [ExtractionLevel] = [
        ExtractionLevel(id: "logical", title: "Logical Acquisition", desc: "DBs, Chats, SMS, Contacts & System Logs", tag: "Fast & Standard"),
        ExtractionLevel(id: "filesystem", title: "File System Dump", desc: "App sandboxes, private DBs & keychain caches", tag: "Deep Inspect"),
        ExtractionLevel(id: "physical", title: "Physical Bitstream", desc: "Raw NVMe partitions & unallocated carving", tag: "Full Dump")
    ]
    
    let profiles: [ScopeProfile] = [
        ScopeProfile(id: "all", label: "All Evidence", desc: "Complete extraction", icon: "square.stack.3d.up.fill"),
        ScopeProfile(id: "textual", label: "Chats & SMS", desc: "WhatsApp & SMS", icon: "doc.text.fill"),
        ScopeProfile(id: "media", label: "Photos & Media", desc: "DCIM & voice notes", icon: "photo.stack.fill"),
        ScopeProfile(id: "deleted", label: "Carve Deleted", desc: "Unallocated extents", icon: "trash.fill")
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
                                Image(systemName: "slider.horizontal.3")
                                    .font(.system(size: 16))
                                    .foregroundColor(theme.primaryAccent(isDark: isDark))
                            )
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Acquisition Parameters")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            Text("DEPTH & TARGET SCOPE FILTERS")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .tracking(1)
                                .foregroundColor(.white.opacity(0.75))
                        }
                    }
                    
                    Spacer()
                    
                    Text("Ready")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(CopSightTheme.emerald.opacity(0.2))
                        .foregroundColor(CopSightTheme.emerald)
                        .cornerRadius(100)
                        .overlay(
                            RoundedRectangle(cornerRadius: 100)
                                .strokeBorder(CopSightTheme.emerald.opacity(0.35), lineWidth: 1)
                        )
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)
                .padding(.bottom, 12)
                
                Divider().background(Color.white.opacity(0.12))
                
                // Natural Content Body (No internal ScrollView - All 100% visible at once!)
                VStack(alignment: .leading, spacing: 14) {
                    // Section 1: Extraction Depth
                    VStack(alignment: .leading, spacing: 6) {
                        Text("1. SELECT EXTRACTION DEPTH:")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.85))
                        
                        VStack(spacing: 6) {
                            ForEach(levels) { level in
                                let isSelected = selectedLevel == level.id
                                Button(action: { selectedLevel = level.id }) {
                                    HStack(spacing: 10) {
                                        Circle()
                                            .fill(isSelected ? theme.primaryAccent(isDark: isDark) : theme.iconCircleBg(isDark: isDark))
                                            .frame(width: 22, height: 22)
                                            .overlay(
                                                Image(systemName: isSelected ? "checkmark" : "")
                                                    .font(.system(size: 10, weight: .black))
                                                    .foregroundColor(theme.primaryAccentText(isDark: isDark))
                                            )
                                        
                                        VStack(alignment: .leading, spacing: 2) {
                                            HStack {
                                                Text(level.title)
                                                    .font(.system(size: 12, weight: .bold))
                                                    .foregroundColor(.white)
                                                Spacer()
                                                Text(level.tag)
                                                    .font(.system(size: 8.5, design: .monospaced))
                                                    .padding(.horizontal, 6)
                                                    .padding(.vertical, 2)
                                                    .background(Color.white.opacity(0.12))
                                                    .foregroundColor(.white.opacity(0.9))
                                                    .cornerRadius(4)
                                            }
                                            Text(level.desc)
                                                .font(.system(size: 9.5))
                                                .foregroundColor(.white.opacity(0.75))
                                                .lineLimit(1)
                                        }
                                    }
                                    .padding(8)
                                    .background(isSelected
                                        ? (isDark ? Color.white.opacity(0.16) : CopSightTheme.coral.opacity(0.18))
                                        : theme.insetFill(isDark: isDark)
                                    )
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .strokeBorder(isSelected ? theme.primaryAccent(isDark: isDark) : theme.insetBorder(isDark: isDark), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                    
                    // Section 2: Target Scope Filters (2x2 Grid)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("2. TARGETED SCOPE FILTERS:")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.85))
                        
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            ForEach(profiles) { prof in
                                let isSelected = selectedProfile == prof.id
                                Button(action: { selectedProfile = prof.id }) {
                                    HStack(spacing: 8) {
                                        Circle()
                                            .fill(isSelected ? theme.primaryAccent(isDark: isDark) : theme.iconCircleBg(isDark: isDark))
                                            .frame(width: 24, height: 24)
                                            .overlay(
                                                Image(systemName: prof.icon)
                                                    .font(.system(size: 11))
                                                    .foregroundColor(isSelected ? theme.primaryAccentText(isDark: isDark) : .white)
                                            )
                                        
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(prof.label)
                                                .font(.system(size: 11, weight: .bold))
                                                .foregroundColor(.white)
                                                .lineLimit(1)
                                            Text(prof.desc)
                                                .font(.system(size: 8.5))
                                                .foregroundColor(.white.opacity(0.7))
                                                .lineLimit(1)
                                        }
                                    }
                                    .padding(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(isSelected
                                        ? (isDark ? Color.white.opacity(0.16) : CopSightTheme.coral.opacity(0.18))
                                        : theme.insetFill(isDark: isDark)
                                    )
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .strokeBorder(isSelected ? theme.primaryAccent(isDark: isDark) : theme.insetBorder(isDark: isDark), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                
                Spacer(minLength: 0)
                
                Divider().background(Color.white.opacity(0.12))
                
                // Footer Action
                Button(action: {
                    isAcquiring.toggle()
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: isAcquiring ? "stop.fill" : "play.fill")
                            .font(.system(size: 11))
                        Text(isAcquiring ? "ABORT ACQUISITION" : "INITIATE ACQUISITION (iPhone 15 Pro Max)")
                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                            .tracking(0.5)
                    }
                    .foregroundColor(isAcquiring ? .white : theme.primaryAccentText(isDark: isDark))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(isAcquiring ? CopSightTheme.red : theme.primaryAccent(isDark: isDark))
                    .cornerRadius(CopSightTheme.buttonRadius)
                    .shadow(color: isAcquiring ? CopSightTheme.red.opacity(0.5) : theme.primaryAccent(isDark: isDark).opacity(0.35), radius: 6)
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
        .frame(height: 500)
    }
}
