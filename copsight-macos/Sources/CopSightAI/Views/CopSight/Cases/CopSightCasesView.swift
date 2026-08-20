import SwiftUI

struct CopSightCasesView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    @State private var profile = OfficerProfileManager.shared
    
    @State private var searchText = ""
    @State private var filterStatus = "All"
    @State private var isShowingCreateCaseModal = false
    @State private var selectedCaseForDetail: CaseDetail? = nil
    
    struct CaseDetail: Identifiable, Equatable {
        let id = UUID()
        var firNumber: String
        var title: String
        var investigator: String
        var status: String
        var statusColor: Color
        var devicesCount: Int
        var artifactsCount: Int
        var createdDate: String
        var priority: String
    }
    
    @State private var caseList: [CaseDetail] = [
        CaseDetail(
            firNumber: "OP-TANGO-24",
            title: "Cross-Border Cyber Fraud & Laundering",
            investigator: "Insp. Brijesh",
            status: "Active",
            statusColor: CopSightTheme.emerald,
            devicesCount: 2,
            artifactsCount: 1420,
            createdDate: "2026-08-18",
            priority: "Critical"
        ),
        CaseDetail(
            firNumber: "FIR-2026-08-1847",
            title: "Encrypted Messaging Extortion Network",
            investigator: "Insp. Brijesh",
            status: "In Triage",
            statusColor: CopSightTheme.amber,
            devicesCount: 1,
            artifactsCount: 680,
            createdDate: "2026-08-15",
            priority: "High"
        ),
        CaseDetail(
            firNumber: "OP-DELTA-19",
            title: "Digital Device Bitstream Acquisition",
            investigator: "Sub-Insp. Sharma",
            status: "Sealed",
            statusColor: CopSightTheme.cyan,
            devicesCount: 4,
            artifactsCount: 3840,
            createdDate: "2026-08-10",
            priority: "Standard"
        ),
        CaseDetail(
            firNumber: "CR-992-MUMBAI",
            title: "Financial Malware & Remote Access Forensic Dossier",
            investigator: "Insp. Brijesh",
            status: "Active",
            statusColor: CopSightTheme.emerald,
            devicesCount: 3,
            artifactsCount: 2190,
            createdDate: "2026-08-01",
            priority: "Critical"
        )
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var filteredCases: [CaseDetail] {
        caseList.filter { c in
            let matchesSearch = searchText.isEmpty ||
                c.firNumber.localizedCaseInsensitiveContains(searchText) ||
                c.title.localizedCaseInsensitiveContains(searchText) ||
                c.investigator.localizedCaseInsensitiveContains(searchText)
            let matchesFilter = filterStatus == "All" || c.status == filterStatus
            return matchesSearch && matchesFilter
        }
    }
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                // Header & Action Bar
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Case Management & Evidence Dossiers")
                            .font(.system(size: 28, weight: .light))
                            .foregroundColor(.white)
                        Text("LEGAL JURISDICTIONS, EVIDENCE CHAINS & DIGITAL ARCHIVES")
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .tracking(2)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    
                    Spacer()
                    
                    // New Case Button: Visible ONLY to Administrator (RBAC Gated)
                    if profile.isAdmin {
                        Button(action: { isShowingCreateCaseModal = true }) {
                            HStack(spacing: 8) {
                                Image(systemName: "plus.circle.fill")
                                Text("New Case File")
                            }
                            .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                            .foregroundColor(theme.primaryAccentText(isDark: isDark))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 10)
                            .background(theme.primaryAccent(isDark: isDark))
                            .cornerRadius(100)
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                    }
                }
                
                // Filter & Search Controls
                GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                    HStack(spacing: 16) {
                        // Search bar
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.white.opacity(0.6))
                            TextField("Search cases by FIR, title, examiner...", text: $searchText)
                                .textFieldStyle(.plain)
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                        )
                        
                        // Status Filter Pills
                        HStack(spacing: 8) {
                            ForEach(["All", "Active", "In Triage", "Sealed"], id: \.self) { status in
                                let isSelected = filterStatus == status
                                Button(action: { filterStatus = status }) {
                                    Text(status)
                                        .font(.system(size: 10.5, weight: isSelected ? .bold : .medium, design: .monospaced))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 7)
                                        .background(isSelected
                                            ? theme.primaryAccent(isDark: isDark)
                                            : theme.insetFill(isDark: isDark)
                                        )
                                        .foregroundColor(isSelected
                                            ? theme.primaryAccentText(isDark: isDark)
                                            : .white.opacity(0.8)
                                        )
                                        .cornerRadius(100)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 100)
                                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                    .padding(16)
                }
                
                // Cases Grid
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 18), GridItem(.flexible(), spacing: 18)], spacing: 18) {
                    ForEach(filteredCases) { c in
                        CaseDetailCard(caseItem: c) {
                            selectedCaseForDetail = c
                        }
                    }
                }
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 60)
            .thinScrollable()
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $isShowingCreateCaseModal) {
            CreateCaseModalView(onAdd: { newCase in
                caseList.insert(newCase, at: 0)
                isShowingCreateCaseModal = false
            })
        }
    }
}

struct CaseDetailCard: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let caseItem: CopSightCasesView.CaseDetail
    var onSelect: (() -> Void)? = nil
    @State private var isHovering = false
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        Button(action: { onSelect?() }) {
            GlassPanel(cornerRadius: CopSightTheme.panelRadius, isHighlighted: isHovering) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top) {
                        HStack(spacing: 12) {
                            Circle()
                                .fill(theme.iconCircleBg(isDark: isDark))
                                .frame(width: 40, height: 40)
                                .overlay(
                                    Image(systemName: "folder.fill")
                                        .foregroundColor(caseItem.statusColor)
                                        .font(.system(size: 18))
                                )
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(caseItem.firNumber)
                                    .font(.system(size: 15, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                                Text(caseItem.investigator)
                                    .font(.system(size: 10.5, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.75))
                            }
                        }
                        
                        Spacer()
                        
                        HStack(spacing: 6) {
                            Circle().fill(caseItem.statusColor).frame(width: 6, height: 6)
                            Text(caseItem.status.uppercased())
                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                .foregroundColor(caseItem.statusColor)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(caseItem.statusColor.opacity(0.2))
                        .cornerRadius(100)
                        .overlay(
                            RoundedRectangle(cornerRadius: 100)
                                .strokeBorder(caseItem.statusColor.opacity(0.35), lineWidth: 1)
                        )
                    }
                    
                    Text(caseItem.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white.opacity(0.9))
                        .lineLimit(2)
                    
                    Divider().background(Color.white.opacity(0.12))
                    
                    // Metrics
                    HStack {
                        HStack(spacing: 6) {
                            Image(systemName: "iphone")
                                .font(.system(size: 11))
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                            Text("\(caseItem.devicesCount) Devices")
                                .font(.system(size: 10.5, design: .monospaced))
                                .foregroundColor(.white.opacity(0.85))
                        }
                        
                        Spacer()
                        
                        HStack(spacing: 6) {
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.system(size: 11))
                                .foregroundColor(CopSightTheme.cyan)
                            Text("\(caseItem.artifactsCount) Artifacts")
                                .font(.system(size: 10.5, design: .monospaced))
                                .foregroundColor(.white.opacity(0.85))
                        }
                        
                        Spacer()
                        
                        HStack(spacing: 6) {
                            Image(systemName: "calendar")
                                .font(.system(size: 11))
                                .foregroundColor(.white.opacity(0.6))
                            Text(caseItem.createdDate)
                                .font(.system(size: 10.5, design: .monospaced))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                }
                .padding(20)
            }
        }
        .buttonStyle(.plain)
        .focusable(false)
        .focusEffectDisabled()
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovering = hovering
            }
        }
    }
}

// MARK: - Officer Assignee Model

struct OfficerAssignee: Identifiable, Hashable {
    let id: String
    let name: String
    let badgeNumber: String
    let unit: String
    let roleTitle: String
    let roleColor: Color
}

// MARK: - Create Case Modal (Admin Only)

struct CreateCaseModalView: View {
    let onAdd: (CopSightCasesView.CaseDetail) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var firNumber = ""
    @State private var title = ""
    @State private var priority = "Critical"
    @State private var status = "Active"
    
    // Officer Dropdown & Search State
    @State private var isOfficerDropdownOpen = false
    @State private var officerSearchText = ""
    @State private var selectedOfficer: OfficerAssignee = OfficerAssignee(
        id: "1",
        name: "Insp. Brijesh Sharma",
        badgeNumber: "IO-7482",
        unit: "Cyber Crime Unit",
        roleTitle: "Investigating Officer",
        roleColor: CopSightTheme.skyBlue
    )
    
    let availableOfficers: [OfficerAssignee] = [
        OfficerAssignee(id: "1", name: "Insp. Brijesh Sharma", badgeNumber: "IO-7482", unit: "Cyber Crime Unit", roleTitle: "Investigating Officer", roleColor: CopSightTheme.skyBlue),
        OfficerAssignee(id: "2", name: "Supervisor V. Sharma", badgeNumber: "SUP-9012", unit: "Forensic Command", roleTitle: "Supervisor", roleColor: CopSightTheme.emerald),
        OfficerAssignee(id: "3", name: "Officer M. Khan", badgeNumber: "IO-3912", unit: "Anti-Terror Squad", roleTitle: "Investigating Officer", roleColor: CopSightTheme.skyBlue),
        OfficerAssignee(id: "4", name: "Officer Ananya Roy", badgeNumber: "SUP-4410", unit: "Financial Intelligence", roleTitle: "Supervisor", roleColor: CopSightTheme.emerald),
        OfficerAssignee(id: "5", name: "Officer R. Deshmukh", badgeNumber: "IO-5120", unit: "Special Cell Cyber", roleTitle: "Investigating Officer", roleColor: CopSightTheme.skyBlue),
        OfficerAssignee(id: "6", name: "Officer K. Patel", badgeNumber: "IO-8831", unit: "Narcotics Digital Taskforce", roleTitle: "Investigating Officer", roleColor: CopSightTheme.skyBlue)
    ]
    
    var filteredOfficers: [OfficerAssignee] {
        if officerSearchText.isEmpty { return availableOfficers }
        return availableOfficers.filter {
            $0.name.localizedCaseInsensitiveContains(officerSearchText) ||
            $0.badgeNumber.localizedCaseInsensitiveContains(officerSearchText) ||
            $0.unit.localizedCaseInsensitiveContains(officerSearchText) ||
            $0.roleTitle.localizedCaseInsensitiveContains(officerSearchText)
        }
    }
    
    private var isDark: Bool { theme.isDark(systemScheme: colorScheme) }
    
    var body: some View {
        ZStack {
            theme.canvasBg(isDark: isDark).ignoresSafeArea()
            
            VStack(spacing: 18) {
                HStack {
                    Text("Register New Case Docket")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
                
                VStack(spacing: 12) {
                    ModalFormField(label: "CASE NUMBER / FIR IDENTIFIER", placeholder: "e.g. FIR-2026-08-9901", text: $firNumber)
                    ModalFormField(label: "CASE TITLE / INVESTIGATION SCOPE", placeholder: "e.g. Ransomware Extortion & Asset Tracking", text: $title)
                    
                    // Searchable Lead Investigator Dropdown
                    VStack(alignment: .leading, spacing: 5) {
                        Text("LEAD INVESTIGATING OFFICER (SELECT & SEARCH)")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.75))
                        
                        // Dropdown Anchor Button
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                isOfficerDropdownOpen.toggle()
                            }
                        }) {
                            HStack(spacing: 10) {
                                Circle()
                                    .fill(selectedOfficer.roleColor.opacity(0.25))
                                    .frame(width: 28, height: 28)
                                    .overlay(
                                        Image(systemName: "person.badge.shield.checkmark.fill")
                                            .foregroundColor(selectedOfficer.roleColor)
                                            .font(.system(size: 12))
                                    )
                                
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(selectedOfficer.name)
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("\(selectedOfficer.badgeNumber) • \(selectedOfficer.unit)")
                                        .font(.system(size: 9.5, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.7))
                                }
                                
                                Spacer()
                                
                                Image(systemName: isOfficerDropdownOpen ? "chevron.up" : "chevron.down")
                                    .font(.system(size: 10))
                                    .foregroundColor(.white.opacity(0.6))
                            }
                            .padding(9)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .strokeBorder(isOfficerDropdownOpen ? theme.primaryAccent(isDark: isDark) : theme.insetBorder(isDark: isDark), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                        
                        // Expanded Searchable List
                        if isOfficerDropdownOpen {
                            VStack(spacing: 8) {
                                HStack(spacing: 6) {
                                    Image(systemName: "magnifyingglass")
                                        .font(.system(size: 10))
                                        .foregroundColor(.white.opacity(0.5))
                                    TextField("Search officer by name, badge, unit...", text: $officerSearchText)
                                        .textFieldStyle(.plain)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(.white)
                                }
                                .padding(8)
                                .background(Color.black.opacity(0.3))
                                .cornerRadius(6)
                                
                                ScrollView(.vertical, showsIndicators: false) {
                                    VStack(spacing: 4) {
                                        ForEach(filteredOfficers) { off in
                                            let isSel = selectedOfficer.id == off.id
                                            Button(action: {
                                                selectedOfficer = off
                                                withAnimation(.easeInOut(duration: 0.15)) {
                                                    isOfficerDropdownOpen = false
                                                }
                                            }) {
                                                HStack(spacing: 8) {
                                                    Circle()
                                                        .fill(off.roleColor.opacity(0.2))
                                                        .frame(width: 22, height: 22)
                                                        .overlay(
                                                            Image(systemName: "person.fill")
                                                                .foregroundColor(off.roleColor)
                                                                .font(.system(size: 10))
                                                        )
                                                    
                                                    VStack(alignment: .leading, spacing: 1) {
                                                        Text(off.name)
                                                            .font(.system(size: 11, weight: isSel ? .bold : .medium))
                                                            .foregroundColor(isSel ? theme.primaryAccent(isDark: isDark) : .white)
                                                        Text("\(off.badgeNumber) • \(off.unit)")
                                                            .font(.system(size: 8.5, design: .monospaced))
                                                            .foregroundColor(.white.opacity(0.6))
                                                    }
                                                    
                                                    Spacer()
                                                    
                                                    if isSel {
                                                        Image(systemName: "checkmark")
                                                            .font(.system(size: 10, weight: .bold))
                                                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                                                    }
                                                }
                                                .padding(6)
                                                .background(isSel ? Color.white.opacity(0.08) : Color.clear)
                                                .cornerRadius(6)
                                            }
                                            .buttonStyle(.plain)
                                            .focusable(false)
                                            .focusEffectDisabled()
                                        }
                                    }
                                }
                                .frame(maxHeight: 140)
                                .thinScrollable()
                            }
                            .padding(8)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1))
                        }
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("CASE PRIORITY & THREAT LEVEL")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.75))
                        
                        HStack(spacing: 8) {
                            ForEach(["Critical", "High", "Standard"], id: \.self) { p in
                                let isSel = priority == p
                                Button(action: { priority = p }) {
                                    Text(p.uppercased())
                                        .font(.system(size: 10, weight: isSel ? .bold : .medium, design: .monospaced))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(isSel ? (p == "Critical" ? CopSightTheme.red.opacity(0.3) : CopSightTheme.amber.opacity(0.3)) : Color.white.opacity(0.06))
                                        .foregroundColor(isSel ? Color.white : .white.opacity(0.7))
                                        .cornerRadius(8)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .strokeBorder(isSel ? (p == "Critical" ? CopSightTheme.red : CopSightTheme.amber) : Color.clear, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                }
                
                HStack(spacing: 12) {
                    Button(action: { dismiss() }) {
                        Text("Cancel")
                            .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.8))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 9)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                    
                    Spacer()
                    
                    Button(action: {
                        let newCase = CopSightCasesView.CaseDetail(
                            firNumber: firNumber.isEmpty ? "FIR-2026-\(Int.random(in: 1000...9999))" : firNumber,
                            title: title.isEmpty ? "Untitled Forensic Investigation" : title,
                            investigator: selectedOfficer.name,
                            status: "Active",
                            statusColor: CopSightTheme.emerald,
                            devicesCount: 0,
                            artifactsCount: 0,
                            createdDate: "2026-08-20",
                            priority: priority
                        )
                        onAdd(newCase)
                    }) {
                        Text("Register Case")
                            .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                            .foregroundColor(theme.primaryAccentText(isDark: isDark))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 9)
                            .background(theme.primaryAccent(isDark: isDark))
                            .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
            }
            .padding(24)
            .frame(width: 460)
        }
    }
}

