import SwiftUI

/// Forensic Evidence Custody Item
struct CustodyEvidenceItem: Identifiable, Equatable {
    let id: String
    let evidenceTag: String
    let caseNumber: String
    let deviceModel: String
    let seizingOfficer: String
    let custodyVault: String
    let timestamp: String
    var sha256Hash: String
    var isVerified: Bool
    let status: String
}

/// Examiner Activity Audit Log Entry
struct ExaminerAuditLogEntry: Identifiable, Equatable {
    let id: String
    let timestamp: String
    let examinerName: String
    let examinerId: String
    let actionType: String
    let caseNumber: String
    let terminalId: String
    let isCompliant: Bool
    let details: String
}

/// Case Allocation & Workload Model
struct CaseAllocationModel: Identifiable, Equatable {
    let id: String
    let firNumber: String
    let title: String
    var assignedExaminer: String
    var examinerId: String
    let evidenceCount: Int
    var status: String
    let priority: String
    let daysActive: Int
}

/// Supervisor & Admin Audit Dossier View with Strict Role-Based Access Control (RBAC)
struct SupervisorAuditView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    private let theme = ThemeManager.shared
    @State private var profile = OfficerProfileManager.shared
    @State private var notificationManager = ForensicNotificationManager.shared
    
    @State private var activeTab: AuditTab = .custody
    @State private var searchText: String = ""
    @State private var selectedEvidence: CustodyEvidenceItem? = nil
    @State private var isVerifyingHash: Bool = false
    @State private var toastMessage: String? = nil
    
    // Case Allocation Reassignment State
    @State private var editingCase: CaseAllocationModel? = nil
    @State private var newAssignedExaminer: String = "Officer Brijesh (IO-7482)"
    
    enum AuditTab: String, CaseIterable, Identifiable {
        case custody = "Chain of Custody"
        case activity = "Examiner Logs"
        case workload = "Case Allocation"
        case compliance = "Compliance & Export"
        
        var id: String { rawValue }
        
        var icon: String {
            switch self {
            case .custody: return "lock.shield.fill"
            case .activity: return "list.bullet.rectangle"
            case .workload: return "person.3.sequence.fill"
            case .compliance: return "checkmark.seal.fill"
            }
        }
    }
    
    // Sample Data Sets
    @State private var custodyItems: [CustodyEvidenceItem] = [
        CustodyEvidenceItem(
            id: "evd-1",
            evidenceTag: "EVD-2026-9042-01",
            caseNumber: "OP-TANGO-24",
            deviceModel: "Apple iPhone 15 Pro Max",
            seizingOfficer: "Inspector V. Sharma (ID: 4410)",
            custodyVault: "Sealed Vault #4 (Locker 12)",
            timestamp: "2026-08-19 09:30:14 UTC",
            sha256Hash: "8F2A3C9E4B1D7091A4F6B2C8E1D5A9F07C3B2E1A4D6F8B9C0E2A4F6B8D1C3E5A",
            isVerified: true,
            status: "SEALED & INTACT"
        ),
        CustodyEvidenceItem(
            id: "evd-2",
            evidenceTag: "EVD-2026-9042-02",
            caseNumber: "OP-TANGO-24",
            deviceModel: "Samsung Galaxy S24 Ultra",
            seizingOfficer: "Inspector V. Sharma (ID: 4410)",
            custodyVault: "Sealed Vault #4 (Locker 14)",
            timestamp: "2026-08-19 10:15:22 UTC",
            sha256Hash: "3B7E9F1A4C6D8025E2A4F6B8D1C3E5A8F2A3C9E4B1D7091A4F6B2C8E1D5A9F07",
            isVerified: true,
            status: "IN TRIAGE"
        ),
        CustodyEvidenceItem(
            id: "evd-3",
            evidenceTag: "EVD-2026-8819-01",
            caseNumber: "FIR-2026-8819",
            deviceModel: "Trezor Model T Hardware Wallet",
            seizingOfficer: "Officer Brijesh (IO-7482)",
            custodyVault: "Cold Storage Safe B-2",
            timestamp: "2026-08-18 14:02:11 UTC",
            sha256Hash: "A1D5A9F07C3B2E1A4D6F8B9C0E2A4F6B8D1C3E5A8F2A3C9E4B1D7091A4F6B2C8",
            isVerified: true,
            status: "SEALED & INTACT"
        ),
        CustodyEvidenceItem(
            id: "evd-4",
            evidenceTag: "EVD-2026-7731-01",
            caseNumber: "FIR-2026-7731",
            deviceModel: "Google Pixel 8 Pro",
            seizingOfficer: "Officer M. Khan (ID: 3912)",
            custodyVault: "Sealed Vault #2 (Locker 08)",
            timestamp: "2026-08-17 18:44:50 UTC",
            sha256Hash: "E2A4F6B8D1C3E5A8F2A3C9E4B1D7091A4F6B2C8E1D5A9F07C3B2E1A4D6F8B9C0",
            isVerified: true,
            status: "ACQUIRED"
        )
    ]
    
    @State private var activityLogs: [ExaminerAuditLogEntry] = [
        ExaminerAuditLogEntry(
            id: "log-1",
            timestamp: "2026-08-20 11:42:08",
            examinerName: "Officer Brijesh",
            examinerId: "IO-7482",
            actionType: "BITSTREAM ACQUISITION",
            caseNumber: "OP-TANGO-24",
            terminalId: "WS-FORENSIXD-01",
            isCompliant: true,
            details: "Full physical bitstream dump completed. 1,024 artifacts carved and hashed."
        ),
        ExaminerAuditLogEntry(
            id: "log-2",
            timestamp: "2026-08-20 10:15:30",
            examinerName: "Officer Brijesh",
            examinerId: "IO-7482",
            actionType: "SQLITE DECRYPTION",
            caseNumber: "OP-TANGO-24",
            terminalId: "WS-FORENSIXD-01",
            isCompliant: true,
            details: "WhatsApp msgstore.db decrypted using Keybag vector #24. 4,280 chats parsed."
        ),
        ExaminerAuditLogEntry(
            id: "log-3",
            timestamp: "2026-08-20 09:04:12",
            examinerName: "Officer M. Khan",
            examinerId: "IO-3912",
            actionType: "CROSS-CASE QUERY",
            caseNumber: "FIR-2026-8819",
            terminalId: "WS-COPSIGHT-04",
            isCompliant: true,
            details: "Executed correlation query against TRC-20 wallet 0x71C...392B across 14 FIR dossiers."
        ),
        ExaminerAuditLogEntry(
            id: "log-4",
            timestamp: "2026-08-19 16:22:45",
            examinerName: "Inspector V. Sharma",
            examinerId: "IO-4410",
            actionType: "CUSTODY TRANSFER",
            caseNumber: "OP-TANGO-24",
            terminalId: "WS-VAULT-02",
            isCompliant: true,
            details: "Sealed iPhone 15 Pro Max transferred into Vault #4. Digital signature stamped."
        )
    ]
    
    @State private var caseAllocations: [CaseAllocationModel] = [
        CaseAllocationModel(
            id: "case-1",
            firNumber: "OP-TANGO-24",
            title: "Operation Tango: Crypto Laundering Ring",
            assignedExaminer: "Officer Brijesh",
            examinerId: "IO-7482",
            evidenceCount: 2,
            status: "IN ACTIVE TRIAGE",
            priority: "CRITICAL",
            daysActive: 4
        ),
        CaseAllocationModel(
            id: "case-2",
            firNumber: "FIR-2026-8819",
            title: "Hawala Syndicate & OTC Escrow",
            assignedExaminer: "Officer M. Khan",
            examinerId: "IO-3912",
            evidenceCount: 4,
            status: "IN PROGRESS",
            priority: "HIGH",
            daysActive: 8
        ),
        CaseAllocationModel(
            id: "case-3",
            firNumber: "FIR-2026-7731",
            title: "Encrypted Comms Exfiltration",
            assignedExaminer: "Inspector V. Sharma",
            examinerId: "IO-4410",
            evidenceCount: 1,
            status: "SEALED & ARCHIVED",
            priority: "MEDIUM",
            daysActive: 14
        )
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        ZStack {
            theme.canvasBg(isDark: isDark)
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Top Header Bar
                headerBar
                
                // RBAC Clearance Check
                if profile.canAccessSupervisorHub {
                    authorizedSupervisorContent
                } else {
                    unauthorizedAccessGate
                }
            }
            .padding(20)
        }
        .frame(minWidth: 900, minHeight: 650)
        .focusEffectDisabled()
    }
    
    // MARK: - Header Bar
    
    private var headerBar: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(theme.iconCircleBg(isDark: isDark))
                .frame(width: 42, height: 42)
                .overlay(
                    Image(systemName: "shield.checkered")
                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                        .font(.system(size: 18))
                )
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text("Supervisor Intelligence & Audit Hub")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    
                    // Role Badge
                    Text(profile.role.title.uppercased())
                        .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(profile.role.badgeColor.opacity(0.25))
                        .foregroundColor(profile.role.badgeColor)
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(profile.role.badgeColor.opacity(0.4), lineWidth: 1))
                }
                
                Text("CHAIN OF CUSTODY · EXAMINER ACTIVITY LOGS · WORKLOAD ALLOCATION · CJIS COMPLIANCE")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .tracking(1)
                    .foregroundColor(.white.opacity(0.75))
            }
            
            Spacer()
        }
        .padding(.bottom, 16)
    }
    
    // MARK: - Authorized Content (Fully Scrollable)
    
    private var authorizedSupervisorContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 18) {
                // 4 Top Metrics Cards
                topMetricsGrid
                
                // Sub-Navigation Tabs
                navigationTabStrip
                
                // Active Tab Body
                VStack(spacing: 0) {
                    switch activeTab {
                    case .custody:
                        chainOfCustodyTabView
                    case .activity:
                        examinerActivityTabView
                    case .workload:
                        caseWorkloadTabView
                    case .compliance:
                        complianceAndExportTabView
                    }
                }
            }
            .padding(.bottom, 60)
            .thinScrollable()
        }
        .scrollIndicators(.hidden)
    }
    
    // MARK: - Top Metrics Grid
    
    private var topMetricsGrid: some View {
        HStack(spacing: 14) {
            MetricCard(
                icon: "checkmark.seal.fill",
                title: "EVIDENCE INTEGRITY",
                value: "100.0%",
                subtitle: "All SHA-256 Hashes Validated",
                color: CopSightTheme.emerald
            )
            MetricCard(
                icon: "lock.shield.fill",
                title: "CHAIN OF CUSTODY SEALS",
                value: "\(custodyItems.count) Sealed",
                subtitle: "Vault #4 & Cold Storage",
                color: CopSightTheme.cyan
            )
            MetricCard(
                icon: "person.3.sequence.fill",
                title: "ACTIVE EXAMINERS",
                value: "03 Online",
                subtitle: "Station Bus Handshakes",
                color: theme.primaryAccent(isDark: isDark)
            )
            MetricCard(
                icon: "shield.lefthalf.filled",
                title: "COMPLIANCE LEVEL",
                value: "FIPS 140-2",
                subtitle: "ISO/IEC 27037 Certified",
                color: Color(hex: "a855f7")
            )
        }
    }
    
    // MARK: - Navigation Tab Strip
    
    private var navigationTabStrip: some View {
        HStack(spacing: 8) {
            ForEach(AuditTab.allCases) { tab in
                let isSel = activeTab == tab
                Button(action: { activeTab = tab }) {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 11))
                        Text(tab.rawValue)
                            .font(.system(size: 11, weight: isSel ? .bold : .medium, design: .monospaced))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(isSel ? theme.primaryAccent(isDark: isDark) : theme.insetFill(isDark: isDark))
                    .foregroundColor(isSel ? theme.primaryAccentText(isDark: isDark) : .white.opacity(0.85))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .strokeBorder(isSel ? Color.clear : theme.insetBorder(isDark: isDark), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
            }
            
            Spacer()
        }
    }
    
    // MARK: - Tab 1: Chain of Custody & Evidence Seal Matrix
    
    private var chainOfCustodyTabView: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Seized Digital Evidence & Cryptographic Hashes")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                        Text("CRYPTOGRAPHIC SEALS VALIDATED AGAINST ORIGINAL SEIZURE MANIFEST")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Spacer()
                    
                    Button(action: verifyAllHashes) {
                        HStack(spacing: 6) {
                            Image(systemName: isVerifyingHash ? "arrow.triangle.2.circlepath" : "checkmark.circle.badge.questionmark")
                                .rotationEffect(.degrees(isVerifyingHash ? 360 : 0))
                                .animation(isVerifyingHash ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default, value: isVerifyingHash)
                            Text(isVerifyingHash ? "Verifying Seals..." : "Re-Verify All SHA-256 Seals")
                        }
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(theme.primaryAccent(isDark: isDark))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
                
                Divider().background(Color.white.opacity(0.12))
                
                // Custody Items Table
                VStack(spacing: 8) {
                    ForEach(custodyItems) { item in
                        HStack(spacing: 14) {
                            Circle()
                                .fill(item.isVerified ? CopSightTheme.emerald.opacity(0.2) : CopSightTheme.amber.opacity(0.2))
                                .frame(width: 34, height: 34)
                                .overlay(
                                    Image(systemName: item.isVerified ? "lock.fill" : "lock.open.fill")
                                        .foregroundColor(item.isVerified ? CopSightTheme.emerald : CopSightTheme.amber)
                                        .font(.system(size: 14))
                                )
                            
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 8) {
                                    Text(item.evidenceTag)
                                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                                        .foregroundColor(.white)
                                    
                                    Text(item.caseNumber)
                                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(theme.primaryAccent(isDark: isDark).opacity(0.2))
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                        .cornerRadius(4)
                                }
                                
                                Text("\(item.deviceModel) • Seized by \(item.seizingOfficer)")
                                    .font(.system(size: 10))
                                    .foregroundColor(.white.opacity(0.75))
                            }
                            
                            Spacer()
                            
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(item.custodyVault)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white)
                                Text("SHA-256: \(item.sha256Hash.prefix(12))...\(item.sha256Hash.suffix(6))")
                                    .font(.system(size: 9, design: .monospaced))
                                    .foregroundColor(CopSightTheme.emerald)
                            }
                            
                            Text(item.status)
                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(CopSightTheme.emerald.opacity(0.2))
                                .foregroundColor(CopSightTheme.emerald)
                                .cornerRadius(6)
                        }
                        .padding(12)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                        )
                    }
                }
            }
            .padding(18)
        }
    }
    
    // MARK: - Tab 2: Examiner Activity & Station Access Log
    
    private var examinerActivityTabView: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Live Examiner Telemetry & Audit Stream")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                        Text("TAMPER-PROOF AUDIT LOG RECORDING ALL FORENSIC ACTIONS")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Spacer()
                    
                    // Search Filter
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.5))
                        TextField("Search by examiner or action...", text: $searchText)
                            .textFieldStyle(.plain)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(theme.insetFill(isDark: isDark))
                    .cornerRadius(8)
                    .frame(width: 240)
                }
                
                Divider().background(Color.white.opacity(0.12))
                
                // Activity Log Stream
                VStack(spacing: 8) {
                    ForEach(filteredLogs) { log in
                        HStack(spacing: 12) {
                            Circle()
                                .fill(CopSightTheme.emerald)
                                .frame(width: 6, height: 6)
                            
                            Text(log.timestamp)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.6))
                                .frame(width: 130, alignment: .leading)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 6) {
                                    Text(log.examinerName)
                                        .font(.system(size: 11.5, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("(\(log.examinerId))")
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.6))
                                    
                                    Text("•")
                                        .foregroundColor(.white.opacity(0.4))
                                    
                                    Text(log.actionType)
                                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(theme.primaryAccent(isDark: isDark).opacity(0.2))
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                        .cornerRadius(4)
                                }
                                
                                Text(log.details)
                                    .font(.system(size: 10.5))
                                    .foregroundColor(.white.opacity(0.85))
                            }
                            
                            Spacer()
                            
                            Text(log.terminalId)
                                .font(.system(size: 9.5, design: .monospaced))
                                .foregroundColor(.white.opacity(0.5))
                        }
                        .padding(10)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(8)
                    }
                }
            }
            .padding(18)
        }
    }
    
    // MARK: - Tab 3: Case Allocation & Workload Manager
    
    private var caseWorkloadTabView: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Investigator Workload & Case Allocation Grid")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                        Text("RE-ASSIGN DOSSIERS AND MONITOR INVESTIGATIVE LATENCY")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Spacer()
                    
                    Text("Role: \(profile.role.title)")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(profile.role.badgeColor)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(profile.role.badgeColor.opacity(0.15))
                        .cornerRadius(6)
                }
                
                Divider().background(Color.white.opacity(0.12))
                
                // Case Allocation Table
                VStack(spacing: 8) {
                    ForEach(caseAllocations) { c in
                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 8) {
                                    Text(c.firNumber)
                                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                                        .foregroundColor(.white)
                                    
                                    Text(c.priority)
                                        .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(c.priority == "CRITICAL" ? CopSightTheme.red.opacity(0.25) : CopSightTheme.amber.opacity(0.25))
                                        .foregroundColor(c.priority == "CRITICAL" ? CopSightTheme.red : CopSightTheme.amber)
                                        .cornerRadius(4)
                                }
                                
                                Text(c.title)
                                    .font(.system(size: 11))
                                    .foregroundColor(.white.opacity(0.8))
                            }
                            
                            Spacer()
                            
                            VStack(alignment: .trailing, spacing: 2) {
                                HStack(spacing: 4) {
                                    Image(systemName: "person.fill")
                                        .font(.system(size: 9))
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                    Text(c.assignedExaminer)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundColor(.white)
                                }
                                
                                Text("\(c.evidenceCount) Seized Artifacts • \(c.daysActive)d Active")
                                    .font(.system(size: 9.5, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.6))
                            }
                            
                            // Reassign Button (Only enabled for Supervisor/Admin)
                            Button(action: {
                                reassignCase(c)
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "arrow.triangle.swap")
                                        .font(.system(size: 9))
                                    Text("Reassign")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(profile.canManageWorkloads ? theme.primaryAccent(isDark: isDark) : Color.white.opacity(0.1))
                                .foregroundColor(profile.canManageWorkloads ? theme.primaryAccentText(isDark: isDark) : .white.opacity(0.4))
                                .cornerRadius(6)
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                            .disabled(!profile.canManageWorkloads)
                        }
                        .padding(12)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(10)
                    }
                }
            }
            .padding(18)
        }
    }
    
    // MARK: - Tab 4: Compliance & Export
    
    private var complianceAndExportTabView: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Forensic Standards Compliance & Court Dossier Export")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                        Text("ISO/IEC 27037 · FIPS 140-2 LEVEL 3 · CJIS AUDIT CERTIFICATION")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    Spacer()
                }
                
                Divider().background(Color.white.opacity(0.12))
                
                // Checklist
                VStack(alignment: .leading, spacing: 10) {
                    ComplianceCheckRow(standard: "ISO/IEC 27037:2012", desc: "Guidelines for identification, collection, acquisition, and preservation of digital evidence.", isPassed: true)
                    ComplianceCheckRow(standard: "FIPS 140-2 Level 3", desc: "Cryptographic module security with tamper-evident SHA-256 and AES-GCM 256.", isPassed: true)
                    ComplianceCheckRow(standard: "CJIS Security Policy 5.9", desc: "Role-Based Access Control (RBAC) with full audit trail logging and encryption.", isPassed: true)
                    ComplianceCheckRow(standard: "NIST SP 800-86", desc: "Integrating forensic techniques into incident response and court-admissible chain of custody.", isPassed: true)
                }
                
                Spacer()
                
                // Export Buttons
                HStack(spacing: 12) {
                    Button(action: exportAuditManifestJSON) {
                        HStack(spacing: 6) {
                            Image(systemName: "doc.text.fill")
                            Text("Export Audit Manifest (JSON)")
                        }
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(theme.primaryAccent(isDark: isDark))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                    
                    Button(action: generateCourtCertificate) {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.seal.fill")
                            Text("Generate Court Certificate (PDF)")
                        }
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(theme.insetFill(isDark: isDark))
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
            }
            .padding(18)
        }
    }
    
    // MARK: - Unauthorized Access Gate
    
    private var unauthorizedAccessGate: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(spacing: 20) {
                Circle()
                    .fill(CopSightTheme.red.opacity(0.2))
                    .frame(width: 64, height: 64)
                    .overlay(
                        Image(systemName: "lock.shield.fill")
                            .foregroundColor(CopSightTheme.red)
                            .font(.system(size: 28))
                    )
                
                VStack(spacing: 6) {
                    Text("Supervisor Clearance Required")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Your current role is \(profile.role.title) (\(profile.clearanceLevel)).\nAccess to the Chain of Custody Master Matrix and Examiner Audit Logs requires Level 4 (Unit Supervisor) or Level 5 (System Administrator) clearance.")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 480)
                }
                
                VStack(spacing: 8) {
                    Text("AUTHENTICATE AS SUPERVISOR")
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                    
                    Text("To access the supervisor command matrix, please lock this session and sign in with supervisor credentials at the AuthGate.")
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.75))
                        .multilineTextAlignment(.center)
                }
                .padding(16)
                .background(theme.insetFill(isDark: isDark))
                .cornerRadius(14)
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
    
    // MARK: - Actions
    
    private var filteredLogs: [ExaminerAuditLogEntry] {
        if searchText.isEmpty { return activityLogs }
        return activityLogs.filter {
            $0.examinerName.localizedCaseInsensitiveContains(searchText) ||
            $0.actionType.localizedCaseInsensitiveContains(searchText) ||
            $0.details.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    private func verifyAllHashes() {
        isVerifyingHash = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            isVerifyingHash = false
            notificationManager.sendChainOfCustodyAlert(
                evidenceTag: "ALL SEIZED ARTIFACTS",
                action: "Batch SHA-256 Verification",
                officerName: profile.officerName
            )
        }
    }
    
    private func reassignCase(_ item: CaseAllocationModel) {
        if let idx = caseAllocations.firstIndex(where: { $0.id == item.id }) {
            let nextExaminer = (caseAllocations[idx].assignedExaminer == "Officer Brijesh") ? "Officer M. Khan" : "Officer Brijesh"
            caseAllocations[idx].assignedExaminer = nextExaminer
            caseAllocations[idx].examinerId = (nextExaminer == "Officer Brijesh") ? "IO-7482" : "IO-3912"
            
            // Add activity log
            activityLogs.insert(
                ExaminerAuditLogEntry(
                    id: UUID().uuidString,
                    timestamp: "2026-08-20 12:54:00",
                    examinerName: profile.officerName,
                    examinerId: profile.officerId,
                    actionType: "CASE REALLOCATION",
                    caseNumber: item.firNumber,
                    terminalId: "WS-SUPERVISOR-01",
                    isCompliant: true,
                    details: "Reassigned case \(item.firNumber) to \(nextExaminer) by Supervisor."
                ),
                at: 0
            )
        }
    }
    
    private func exportAuditManifestJSON() {
        notificationManager.sendChainOfCustodyAlert(
            evidenceTag: "AUDIT-MANIFEST-2026",
            action: "JSON Manifest Exported",
            officerName: profile.officerName
        )
    }
    
    private func generateCourtCertificate() {
        notificationManager.sendChainOfCustodyAlert(
            evidenceTag: "COURT-CERT-2026-9042",
            action: "Section 65B Digital Certificate Generated",
            officerName: profile.officerName
        )
    }
}

// MARK: - Subcomponents

struct MetricCard: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let icon: String
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Circle()
                        .fill(color.opacity(0.2))
                        .frame(width: 32, height: 32)
                        .overlay(
                            Image(systemName: icon)
                                .foregroundColor(color)
                                .font(.system(size: 14))
                        )
                    Spacer()
                }
                
                Text(value)
                    .font(.system(size: 20, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.7))
                    Text(subtitle)
                        .font(.system(size: 9.5))
                        .foregroundColor(.white.opacity(0.55))
                        .lineLimit(1)
                }
            }
            .padding(14)
        }
    }
}

struct ComplianceCheckRow: View {
    let standard: String
    let desc: String
    let isPassed: Bool
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: isPassed ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(isPassed ? CopSightTheme.emerald : CopSightTheme.red)
                .font(.system(size: 16))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(standard)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                Text(desc)
                    .font(.system(size: 10.5))
                    .foregroundColor(.white.opacity(0.75))
            }
        }
        .padding(10)
        .background(Color.white.opacity(0.04))
        .cornerRadius(8)
    }
}
