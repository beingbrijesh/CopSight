import SwiftUI

/// Profile Button & Interactive Settings Dropdown Popover matching Web Frontend RBAC
struct OfficerProfileMenuButton: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    @State private var profile = OfficerProfileManager.shared
    
    let onOpenSettings: (() -> Void)?
    let onOpenSupervisorHub: (() -> Void)?
    let onSwitchCase: (() -> Void)?
    let onLockSession: (() -> Void)?
    
    @State private var isShowingMenu = false
    @State private var isEditingName = false
    @State private var tempName = ""
    
    init(
        onOpenSettings: (() -> Void)? = nil,
        onOpenSupervisorHub: (() -> Void)? = nil,
        onSwitchCase: (() -> Void)? = nil,
        onLockSession: (() -> Void)? = nil
    ) {
        self.onOpenSettings = onOpenSettings
        self.onOpenSupervisorHub = onOpenSupervisorHub
        self.onSwitchCase = onSwitchCase
        self.onLockSession = onLockSession
    }
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    let avatarPresets = ["person.fill", "shield.fill", "star.fill", "person.crop.circle.badge.checkmark", "bolt.shield.fill", "sparkles"]
    
    var body: some View {
        Button(action: {
            tempName = profile.officerName
            isShowingMenu.toggle()
        }) {
            HStack(spacing: 12) {
                VStack(alignment: .trailing, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(profile.officerName)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white)
                    }
                    
                    HStack(spacing: 4) {
                        Text("ID: \(profile.officerId)")
                            .font(.system(size: 9.5, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                        
                        Circle()
                            .fill(profile.role.badgeColor)
                            .frame(width: 5, height: 5)
                    }
                }
                
                Circle()
                    .fill(theme.iconCircleBg(isDark: isDark))
                    .frame(width: 36, height: 36)
                    .overlay(
                        Image(systemName: profile.avatarSymbol)
                            .foregroundColor(.white)
                            .font(.system(size: 14))
                    )
                    .overlay(
                        Circle().strokeBorder(profile.role.badgeColor.opacity(0.6), lineWidth: 1.5)
                    )
            }
        }
        .buttonStyle(.plain)
        .focusable(false)
        .focusEffectDisabled()
        .popover(isPresented: $isShowingMenu, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 14) {
                // Profile Header Card
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(profile.role.badgeColor.opacity(0.25))
                            .frame(width: 44, height: 44)
                            .overlay(
                                Image(systemName: profile.avatarSymbol)
                                    .foregroundColor(profile.role.badgeColor)
                                    .font(.system(size: 18))
                            )
                        
                        VStack(alignment: .leading, spacing: 2) {
                            if isEditingName {
                                HStack(spacing: 6) {
                                    TextField("Officer Name", text: $tempName)
                                        .textFieldStyle(.plain)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color.white.opacity(0.12))
                                        .cornerRadius(6)
                                        .frame(width: 140)
                                    
                                    Button(action: {
                                        profile.updateName(tempName)
                                        isEditingName = false
                                    }) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(CopSightTheme.emerald)
                                            .font(.system(size: 16))
                                    }
                                    .buttonStyle(.plain)
                                    .focusable(false)
                                    .focusEffectDisabled()
                                }
                            } else {
                                HStack(spacing: 6) {
                                    Text(profile.officerName)
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                    
                                    Button(action: { isEditingName = true }) {
                                        Image(systemName: "pencil")
                                            .font(.system(size: 11))
                                            .foregroundColor(.white.opacity(0.7))
                                    }
                                    .buttonStyle(.plain)
                                    .focusable(false)
                                    .focusEffectDisabled()
                                }
                            }
                            
                            Text("ID: \(profile.officerId) • \(profile.stationUnit)")
                                .font(.system(size: 9.5, design: .monospaced))
                                .foregroundColor(.white.opacity(0.7))
                        }
                    }
                    
                    // Authenticated Role & Clearance Display
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Circle().fill(profile.role.badgeColor).frame(width: 6, height: 6)
                            Text(profile.role.title.uppercased())
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundColor(profile.role.badgeColor)
                            Spacer()
                            Text(profile.clearanceLevel)
                                .font(.system(size: 8, design: .monospaced))
                                .foregroundColor(.white.opacity(0.6))
                        }
                        
                        Text(profile.role.description)
                            .font(.system(size: 9.5))
                            .foregroundColor(.white.opacity(0.75))
                            .lineLimit(2)
                    }
                    .padding(8)
                    .background(Color.black.opacity(0.25))
                    .cornerRadius(8)
                    
                    // Avatar Selection Bar
                    HStack(spacing: 8) {
                        Text("Avatar:")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                        
                        ForEach(avatarPresets, id: \.self) { sym in
                            let isSel = profile.avatarSymbol == sym
                            Button(action: { profile.updateAvatar(sym) }) {
                                Circle()
                                    .fill(isSel ? theme.primaryAccent(isDark: isDark) : Color.white.opacity(0.1))
                                    .frame(width: 24, height: 24)
                                    .overlay(
                                        Image(systemName: sym)
                                            .font(.system(size: 10))
                                            .foregroundColor(isSel ? theme.primaryAccentText(isDark: isDark) : .white)
                                    )
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                        }
                    }
                    .padding(.top, 2)
                }
                .padding(14)
                .background(theme.insetFill(isDark: isDark))
                .cornerRadius(CopSightTheme.innerRadius)
                .overlay(
                    RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                        .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                )
                
                Divider().background(Color.white.opacity(0.12))
                
                // Quick Theme Picker
                VStack(alignment: .leading, spacing: 6) {
                    Text("APPEARANCE")
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.7))
                    
                    HStack(spacing: 6) {
                        ForEach(ThemeMode.allCases) { m in
                            let isSel = theme.mode == m
                            Button(action: { theme.setMode(m) }) {
                                HStack(spacing: 4) {
                                    Image(systemName: m.icon)
                                        .font(.system(size: 10))
                                    Text(m.rawValue.capitalized)
                                        .font(.system(size: 10, weight: isSel ? .bold : .medium, design: .monospaced))
                                }
                                .foregroundColor(isSel ? theme.primaryAccentText(isDark: isDark) : .white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(isSel ? theme.primaryAccent(isDark: isDark) : Color.white.opacity(0.08))
                                .cornerRadius(8)
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                        }
                    }
                }
                
                Divider().background(Color.white.opacity(0.12))
                
                // Action Links
                VStack(spacing: 6) {
                    if profile.isAdmin {
                        MenuActionButton(icon: "server.rack", title: "Station Governance & System Settings", subtitle: "Infrastructure, keybags & daemon config") {
                            isShowingMenu = false
                            onOpenSettings?()
                        }
                    } else if profile.isSupervisor {
                        MenuActionButton(
                            icon: "shield.checkered",
                            title: "Supervisor Intelligence & Audit Hub",
                            subtitle: "Chain of custody & examiner telemetry"
                        ) {
                            isShowingMenu = false
                            onOpenSupervisorHub?()
                        }
                        
                        MenuActionButton(icon: "gearshape.fill", title: "Supervisor Compliance Settings", subtitle: "Audit rules & evidence hash policy") {
                            isShowingMenu = false
                            onOpenSettings?()
                        }
                        
                        MenuActionButton(icon: "arrow.triangle.swap", title: "Switch Active Case", subtitle: "Active: \(profile.activeCaseNumber)") {
                            isShowingMenu = false
                            onSwitchCase?()
                        }
                    } else {
                        MenuActionButton(icon: "gearshape.fill", title: "Investigator Station Settings", subtitle: "Device drivers & workspace cache") {
                            isShowingMenu = false
                            onOpenSettings?()
                        }
                        
                        MenuActionButton(icon: "arrow.triangle.swap", title: "Switch Active Case", subtitle: "Active: \(profile.activeCaseNumber)") {
                            isShowingMenu = false
                            onSwitchCase?()
                        }
                    }
                    
                    MenuActionButton(icon: "lock.shield.fill", title: "Lock Station Session", subtitle: "Sign out & switch officer role", isDestructive: true) {
                        isShowingMenu = false
                        onLockSession?()
                    }
                }
            }
            .padding(16)
            .frame(width: 340)
            .background(theme.canvasBg(isDark: isDark))
        }
    }
}

struct MenuActionButton: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let icon: String
    let title: String
    let subtitle: String
    var isDestructive: Bool = false
    let action: () -> Void
    
    @State private var isHovering = false
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Circle()
                    .fill(isDestructive ? CopSightTheme.red.opacity(0.2) : theme.iconCircleBg(isDark: isDark))
                    .frame(width: 30, height: 30)
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 13))
                            .foregroundColor(isDestructive ? CopSightTheme.red : theme.primaryAccent(isDark: isDark))
                    )
                
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundColor(isDestructive ? CopSightTheme.red : .white)
                    Text(subtitle)
                        .font(.system(size: 9.5))
                        .foregroundColor(.white.opacity(0.7))
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.4))
            }
            .padding(10)
            .background(isHovering ? (isDark ? Color.white.opacity(0.12) : CopSightTheme.coral.opacity(0.2)) : Color.clear)
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
        .focusable(false)
        .focusEffectDisabled()
        .onHover { hovering in
            isHovering = hovering
        }
    }
}

