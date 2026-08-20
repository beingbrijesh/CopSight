import SwiftUI

/// Role-Specific Forensic Station Settings & Configuration
struct ForensicSettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    @State private var profile = OfficerProfileManager.shared
    
    var onSwitchCase: (() -> Void)?
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                // Header Bar
                headerSection
                
                // Card 1: Theme Customization (Available across all roles)
                themeCustomizationCard
                
                // Card 2: Role-Specific Identity & Clearance Profile
                roleIdentityCard
                
                // Card 3: Role-Specific Operational Subsystems & Diagnostics
                roleSubsystemsCard
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 60)
            .thinScrollable()
        }
        .scrollIndicators(.hidden)
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(pageTitle)
                .font(.system(size: 28, weight: .light))
                .foregroundColor(.white)
            
            Text(pageSubtitle)
                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                .tracking(2)
                .foregroundColor(.white.opacity(0.8))
        }
    }
    
    private var pageTitle: String {
        if profile.isAdmin {
            return "Station Governance & System Configuration"
        } else if profile.isSupervisor {
            return "Supervisor Intelligence & Audit Configuration"
        } else {
            return "Investigator Station Configuration"
        }
    }
    
    private var pageSubtitle: String {
        if profile.isAdmin {
            return "ROOT CLEARANCE · INFRASTRUCTURE · HARDWARE RPC · MASTER KEYBAGS"
        } else if profile.isSupervisor {
            return "COMMAND OVERSIGHT · CHAIN OF CUSTODY INTEGRITY · COMPLIANCE RULES"
        } else {
            return "EXAMINER CREDENTIALS · DEVICE INTERFACES · LOCAL CACHE & THEME"
        }
    }
    
    // MARK: - Theme Customization Card
    
    private var themeCustomizationCard: some View {
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
    }
    
    // MARK: - Role Identity & Clearance Card
    
    private var roleIdentityCard: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Circle()
                        .fill(profile.role.badgeColor.opacity(0.2))
                        .frame(width: 38, height: 38)
                        .overlay(
                            Image(systemName: profile.isAdmin ? "crown.fill" : (profile.isSupervisor ? "shield.checkered" : "person.text.rectangle.fill"))
                                .foregroundColor(profile.role.badgeColor)
                                .font(.system(size: 16))
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(identityCardTitle)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                        Text(identityCardSubtitle)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .tracking(1)
                            .foregroundColor(.white.opacity(0.75))
                    }
                    
                    Spacer()
                    
                    if !profile.isAdmin {
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
                }
                
                VStack(spacing: 10) {
                    if profile.isAdmin {
                        ProfileSettingRow(label: "ROOT ADMINISTRATOR", value: profile.officerName, isMonospaced: false, isHighlight: false)
                        ProfileSettingRow(label: "ADMIN IDENTIFIER", value: profile.officerId, isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "CLEARANCE LEVEL", value: "ROOT LEVEL 4 (Global Multi-Tenant / SecOps)", isMonospaced: true, isHighlight: true)
                        ProfileSettingRow(label: "STATION UNIT", value: profile.stationUnit, isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "ACCESS BOUNDARY", value: "Full System Infrastructure & Cryptographic Keybags", isMonospaced: false, isHighlight: false)
                    } else if profile.isSupervisor {
                        ProfileSettingRow(label: "CURRENT ACTIVE CASE", value: profile.activeCaseNumber, isMonospaced: true, isHighlight: true)
                        ProfileSettingRow(label: "SUPERVISOR NAME", value: profile.officerName, isMonospaced: false, isHighlight: false)
                        ProfileSettingRow(label: "SUPERVISOR IDENTIFIER", value: profile.officerId, isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "CLEARANCE LEVEL", value: "SUPERVISOR LEVEL 3 (Chain of Custody & Audit)", isMonospaced: true, isHighlight: true)
                        ProfileSettingRow(label: "COMPLIANCE MANDATE", value: "ISO 27037 / CJIS Standard Evidence Verification", isMonospaced: false, isHighlight: false)
                    } else {
                        ProfileSettingRow(label: "CURRENT ACTIVE CASE", value: profile.activeCaseNumber, isMonospaced: true, isHighlight: true)
                        ProfileSettingRow(label: "INVESTIGATOR NAME", value: profile.officerName, isMonospaced: false, isHighlight: false)
                        ProfileSettingRow(label: "CREDENTIAL OFFICER ID", value: profile.officerId, isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "CLEARANCE LEVEL", value: "INVESTIGATING OFFICER (LEVEL 2)", isMonospaced: true, isHighlight: true)
                        ProfileSettingRow(label: "STATION UNIT IDENTIFIER", value: profile.stationUnit, isMonospaced: true, isHighlight: false)
                    }
                }
            }
            .padding(20)
        }
    }
    
    private var identityCardTitle: String {
        if profile.isAdmin {
            return "Root Administrator Governance Profile"
        } else if profile.isSupervisor {
            return "Supervisor Intelligence & Oversight Profile"
        } else {
            return "Investigating Officer & Active Case Dossier"
        }
    }
    
    private var identityCardSubtitle: String {
        if profile.isAdmin {
            return "MASTER IAM CLEARANCE & MULTI-TENANT BOUNDARY"
        } else if profile.isSupervisor {
            return "COMMAND OVERSIGHT & CHAIN OF CUSTODY VERIFICATION"
        } else {
            return "ACTIVE CASE SESSION AND CUSTODY SIGN-OFF CREDENTIALS"
        }
    }
    
    // MARK: - Role Subsystems & Diagnostics Card
    
    private var roleSubsystemsCard: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Circle()
                        .fill(theme.iconCircleBg(isDark: isDark))
                        .frame(width: 38, height: 38)
                        .overlay(
                            Image(systemName: profile.isAdmin ? "server.rack" : (profile.isSupervisor ? "lock.shield.fill" : "terminal.fill"))
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .font(.system(size: 16))
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(subsystemCardTitle)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                        Text(subsystemCardSubtitle)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .tracking(1)
                            .foregroundColor(.white.opacity(0.75))
                    }
                    
                    Spacer()
                    
                    HStack(spacing: 6) {
                        Circle().fill(CopSightTheme.emerald).frame(width: 8, height: 8)
                        Text("ONLINE / SECURED")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(CopSightTheme.emerald)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(CopSightTheme.emerald.opacity(0.2))
                    .cornerRadius(100)
                }
                
                VStack(spacing: 10) {
                    if profile.isAdmin {
                        ProfileSettingRow(label: "MILVUS VECTOR DB CLUSTER", value: "127.0.0.1:19530 (HNSW / Cosine 99.4%)", isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "LOCAL HARDWARE RPC PORT", value: "127.0.0.1:54322 (Daemon Online)", isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "NVME BITSTREAM DMA BUS", value: "Direct Storage I/O Active (2.8 GB/s)", isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "HARDWARE KEYBAG HSM", value: "Hardware Enclave Sealed (FIPS 140-2 Level 3)", isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "SYSTEM EVENT CHAIN INTEGRITY", value: "HMAC-SHA256 Cryptographically Chained", isMonospaced: true, isHighlight: true)
                    } else if profile.isSupervisor {
                        ProfileSettingRow(label: "EVIDENCE HASH VALIDATION", value: "SHA-256 Block-Level Hash Enforcement (Strict)", isMonospaced: true, isHighlight: true)
                        ProfileSettingRow(label: "EXAMINER AUDIT STREAM", value: "Real-time Telemetry IPC Sync Active", isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "AUDIT RETENTION POLICY", value: "7-Year Cryptographic Evidence Vault", isMonospaced: false, isHighlight: false)
                        ProfileSettingRow(label: "ANOMALY FLAG THRESHOLD", value: "Z-Score > 2.5 (High Sensitivity)", isMonospaced: true, isHighlight: false)
                    } else {
                        ProfileSettingRow(label: "IOKIT USB BUS DRIVER", value: "AppleUSBLib v1.0 (Bitstream Ready)", isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "LOCAL EVIDENCE CACHE", value: "~/ForensicVault/EvidenceCache (AES-256)", isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "CRYPTO HARDWARE ENGINE", value: "Apple Silicon SHA-256 / AES-GCM Accelerated", isMonospaced: true, isHighlight: false)
                        ProfileSettingRow(label: "AUTO-EXTRACTION INTEGRITY", value: "Enforce SHA-256 Digest on Seizure", isMonospaced: true, isHighlight: true)
                    }
                }
            }
            .padding(20)
        }
    }
    
    private var subsystemCardTitle: String {
        if profile.isAdmin {
            return "System Infrastructure & Master Cryptographic Keybags"
        } else if profile.isSupervisor {
            return "Audit Governance & Chain of Custody Policies"
        } else {
            return "Forensic Acquisition Drivers & Workspace Cache"
        }
    }
    
    private var subsystemCardSubtitle: String {
        if profile.isAdmin {
            return "CORE HARDWARE RPC, MILVUS VECTOR DB & NVME BUS"
        } else if profile.isSupervisor {
            return "EVIDENCE INTEGRITY POLICIES & EXAMINER AUDIT STREAMS"
        } else {
            return "DEVICE BUS INTERFACES & LOCAL EVIDENCE CACHE"
        }
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
