import SwiftUI

struct CopSightDashboardView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    @State private var profile = OfficerProfileManager.shared
    
    var onNavigateTab: ((CopSightTab) -> Void)?
    var onSwitchMode: ((AppMode, ForensixDTab?) -> Void)?
    var onOpenSupervisorHub: (() -> Void)?
    
    @State private var officerName = "Officer Brijesh"
    @State private var activeCasesCount = 4
    @State private var totalArtifacts = 8130
    @State private var extractedEntities = 142
    @State private var queriesRun = 28
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            
            // 4 KPI Cards: Exactly 4 columns on wide (stretching 100% width evenly), 2 on medium, 1 on compact
            let kpiColumns: [GridItem] = {
                if width >= 1100 {
                    return Array(repeating: GridItem(.flexible(), spacing: 16), count: 4)
                } else if width >= 680 {
                    return Array(repeating: GridItem(.flexible(), spacing: 16), count: 2)
                } else {
                    return [GridItem(.flexible(), spacing: 16)]
                }
            }()
            
            // 6 Quick Action Cards: Exactly 3 columns on wide (3x2 grid stretching 100% width evenly), 2 on medium (2x3), 1 on compact
            let actionColumns: [GridItem] = {
                if width >= 1100 {
                    return Array(repeating: GridItem(.flexible(), spacing: 16), count: 3)
                } else if width >= 680 {
                    return Array(repeating: GridItem(.flexible(), spacing: 16), count: 2)
                } else {
                    return [GridItem(.flexible(), spacing: 16)]
                }
            }()
            
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 22) {
                    // Header & Greeting
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack(spacing: 0) {
                                Text("Welcome in, ")
                                    .font(.system(size: 30, weight: .light))
                                    .foregroundColor(.white)
                                Text(profile.officerName)
                                    .font(.system(size: 30, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            
                            HStack(spacing: 12) {
                                HStack(spacing: 8) {
                                    Text("ACTIVE CASE")
                                        .font(.system(size: 9.5, weight: .bold))
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                    
                                    Text(profile.activeCaseNumber)
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
                    }
                    
                    // Forensic KPIs (Responsive Grid: 4x1 on full screen, 2x2 on medium, 1x4 on compact)
                    LazyVGrid(columns: kpiColumns, spacing: 16) {
                        KPICard(
                            title: "ACTIVE CASES",
                            value: String(format: "%02d", activeCasesCount),
                            subtitle: "2 In Triage, 2 Under Investigation",
                            icon: "folder.fill",
                            accentColor: theme.primaryAccent(isDark: isDark)
                        )
                        
                        KPICard(
                            title: "INGESTED ARTIFACTS",
                            value: "\(totalArtifacts)",
                            subtitle: "+1,024 Added Today",
                            icon: "internaldrive.fill",
                            accentColor: CopSightTheme.cyan
                        )
                        
                        KPICard(
                            title: "EXTRACTED ENTITIES",
                            value: "\(extractedEntities)",
                            subtitle: "Phone, Wallet, Locations",
                            icon: "person.3.fill",
                            accentColor: CopSightTheme.emerald
                        )
                        
                        KPICard(
                            title: "AI QUERIES EXECUTED",
                            value: "\(queriesRun)",
                            subtitle: "Natural Language Inquiries",
                            icon: "sparkles",
                            accentColor: CopSightTheme.amber
                        )
                    }
                    
                    // Quick Feature Navigation Launchers (Responsive Grid: 3x2 on full screen, 2x3 on medium)
                    VStack(alignment: .leading, spacing: 14) {
                        Text("QUICK INVESTIGATION ACTIONS")
                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                            .tracking(1.5)
                            .foregroundColor(.white.opacity(0.85))
                        
                        LazyVGrid(columns: actionColumns, spacing: 16) {
                            ActionCard(
                                icon: "point.3.connected.trianglepath.dotted",
                                title: "Entity Network Graph",
                                description: "Visual topology of suspects, phone calls, crypto wallets & geolocation links.",
                                tag: "INVESTIGATE",
                                tagColor: CopSightTheme.skyBlue
                            ) {
                                onNavigateTab?(.graph)
                            }
                            
                            ActionCard(
                                icon: "sparkles",
                                title: "AI Natural Language Analyst",
                                description: "Ask plain-English questions across all ingested UFDR evidence databases.",
                                tag: "QUERY AI",
                                tagColor: CopSightTheme.amber
                            ) {
                                onNavigateTab?(.queries)
                            }
                            
                            ActionCard(
                                icon: "link.badge.plus",
                                title: "Cross-Case Intelligence",
                                description: "Scan repository for latent actor overlaps, shared phone numbers & wallets.",
                                tag: "CORRELATION",
                                tagColor: CopSightTheme.cyan
                            ) {
                                onNavigateTab?(.crossCase)
                            }
                            
                            ActionCard(
                                icon: "brain.head.profile",
                                title: "AI Anomaly Detection",
                                description: "Run multi-model deep learning (XGBoost, DNN, LSTM) for attack & outlier triage.",
                                tag: "ML TRIAGE",
                                tagColor: CopSightTheme.coral
                            ) {
                                onNavigateTab?(.anomaly)
                            }
                            
                            ActionCard(
                                icon: "folder.badge.gearshape",
                                title: "Case Dossier Center",
                                description: "Open active investigation files, evidence lockers, and court-admissible manifests.",
                                tag: "DOSSIERS",
                                tagColor: CopSightTheme.emerald
                            ) {
                                onNavigateTab?(.cases)
                            }
                            
                            ActionCard(
                                icon: "waveform.path.ecg",
                                title: "ForensixD Acquisition",
                                description: "Switch to acquisition mode to stream bitstream images from connected devices.",
                                tag: "HARDWARE",
                                tagColor: theme.primaryAccent(isDark: isDark)
                            ) {
                                onSwitchMode?(.forensixd, .acquisition)
                            }
                        }
                    }
                    
                    // Active Investigation Pipeline Progress Card
                    GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Circle()
                                    .fill(theme.iconCircleBg(isDark: isDark))
                                    .frame(width: 38, height: 38)
                                    .overlay(
                                        Image(systemName: "chart.bar.doc.horizontal.fill")
                                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                                            .font(.system(size: 16))
                                    )
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Active Case Investigation Pipeline: OP-TANGO-24")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("Cross-Border Cyber Fraud & Money Laundering • Officer Brijesh Lead")
                                        .font(.system(size: 11.5))
                                        .foregroundColor(.white.opacity(0.85))
                                }
                                
                                Spacer()
                                
                                Text("STAGE 3: EVIDENCE ANALYSIS")
                                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                    .tracking(1)
                                    .foregroundColor(CopSightTheme.emerald)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(CopSightTheme.emerald.opacity(0.2))
                                    .clipShape(Capsule())
                                    .overlay(
                                        Capsule()
                                            .strokeBorder(CopSightTheme.emerald.opacity(0.35), lineWidth: 1)
                                    )
                            }
                            
                            Divider().background(Color.white.opacity(0.12))
                            
                            // Pipeline Stages Tracker
                            HStack(spacing: 12) {
                                PipelineStageItem(step: "1", name: "Physical Extraction", status: "Completed", isDone: true, color: CopSightTheme.emerald)
                                PipelineArrow()
                                PipelineStageItem(step: "2", name: "Decryption & Parsing", status: "Completed", isDone: true, color: CopSightTheme.emerald)
                                PipelineArrow()
                                PipelineStageItem(step: "3", name: "AI Entity Correlation", status: "Active (8,130 Nodes)", isDone: false, isCurrent: true, color: theme.primaryAccent(isDark: isDark))
                                PipelineArrow()
                                PipelineStageItem(step: "4", name: "Court Report Delivery", status: "Pending Final Review", isDone: false, color: Color.white.opacity(0.4))
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

// MARK: - Subcomponents

struct KPICard: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let accentColor: Color
    
    @State private var isHovering = false
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius, isHighlighted: isHovering) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Circle()
                        .fill(theme.iconCircleBg(isDark: isDark))
                        .frame(width: 38, height: 38)
                        .overlay(
                            Image(systemName: icon)
                                .foregroundColor(accentColor)
                                .font(.system(size: 16))
                        )
                    
                    Spacer()
                    
                    Text(title)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 3) {
                    Text(value)
                        .font(.system(size: 32, weight: .light, design: .monospaced))
                        .foregroundColor(.white)
                    
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.85))
                        .lineLimit(1)
                }
            }
            .padding(18)
        }
        .frame(height: 140)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovering = hovering
            }
        }
    }
}

struct ActionCard: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let icon: String
    let title: String
    let description: String
    let tag: String
    let tagColor: Color
    let action: () -> Void
    
    @State private var isHovering = false
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        Button(action: action) {
            GlassPanel(cornerRadius: CopSightTheme.panelRadius, isHighlighted: isHovering) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Circle()
                            .fill(theme.iconCircleBg(isDark: isDark))
                            .frame(width: 38, height: 38)
                            .overlay(
                                Image(systemName: icon)
                                    .foregroundColor(theme.primaryAccent(isDark: isDark))
                                    .font(.system(size: 16))
                            )
                        
                        Spacer()
                        
                        Text(tag)
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(tagColor.opacity(0.2))
                            .foregroundColor(tagColor)
                            .cornerRadius(100)
                            .overlay(
                                RoundedRectangle(cornerRadius: 100)
                                    .strokeBorder(tagColor.opacity(0.35), lineWidth: 1)
                            )
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)
                        
                        Text(description)
                            .font(.system(size: 11.5))
                            .foregroundColor(.white.opacity(0.85))
                            .lineLimit(2)
                    }
                }
                .padding(18)
            }
            .frame(height: 148)
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

struct PipelineStageItem: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let step: String
    let name: String
    let status: String
    var isDone: Bool = false
    var isCurrent: Bool = false
    let color: Color
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(isCurrent ? color : (isDone ? CopSightTheme.emerald : Color.white.opacity(0.12)))
                .frame(width: 28, height: 28)
                .overlay(
                    Group {
                        if isDone {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        } else {
                            Text(step)
                                .font(.system(size: 12, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                        }
                    }
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundColor(.white)
                Text(status)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(color)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isCurrent ? (isDark ? Color.white.opacity(0.12) : CopSightTheme.coral.opacity(0.2)) : theme.insetFill(isDark: isDark))
        .cornerRadius(CopSightTheme.innerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: CopSightTheme.innerRadius)
                .strokeBorder(isCurrent ? color : theme.insetBorder(isDark: isDark), lineWidth: 1)
        )
    }
}

struct PipelineArrow: View {
    var body: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(.white.opacity(0.35))
    }
}
