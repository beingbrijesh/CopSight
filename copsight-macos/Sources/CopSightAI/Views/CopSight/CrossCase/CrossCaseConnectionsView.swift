import SwiftUI

/// Forensic Cross-Case Connection Data Model
/// Represents verified actor/entity links across independent criminal cases and FIRs
struct CrossCaseConnectionModel: Identifiable, Equatable {
    let id: String
    let caseId: String
    let caseNumber: String
    let title: String
    let linkType: String
    let entityType: String
    let entityValue: String
    let strength: ConnectionStrength
    let confidence: Double
    let riskLevel: String
    let lastSeen: String
    let frequency: Int
    let matchType: String
    let aiAnalysis: String
    let citations: [String]
    
    enum ConnectionStrength: String, CaseIterable {
        case critical = "CRITICAL"
        case strong = "STRONG"
        case medium = "MEDIUM"
        case weak = "WEAK"
        
        var color: Color {
            switch self {
            case .critical: return CopSightTheme.red
            case .strong: return CopSightTheme.amber
            case .medium: return CopSightTheme.cyan
            case .weak: return CopSightTheme.skyBlue
            }
        }
        
        var icon: String {
            switch self {
            case .critical: return "exclamationmark.triangle.fill"
            case .strong: return "link.badge.plus"
            case .medium: return "point.3.connected.trianglepath.dotted"
            case .weak: return "person.2.fill"
            }
        }
    }
}

/// Cross-Case Intelligence & Repository Correlation View
/// Discovers latent links, overlapping suspects, shared crypto wallets, and communication corridors across cases.
struct CrossCaseConnectionsView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    var onNavigateTab: ((CopSightTab) -> Void)?
    
    @State private var isAnalyzing = false
    @State private var showDetails = false
    @State private var expandedConnectionId: String? = "cc-1"
    @State private var selectedFilter: String = "All"
    @State private var searchText = ""
    
    // Sample repository-wide forensic cross-case linkages
    @State private var connections: [CrossCaseConnectionModel] = [
        CrossCaseConnectionModel(
            id: "cc-1",
            caseId: "104",
            caseNumber: "2026-CR-089",
            title: "Operation Phantom Syndicate (Narcotics & Hawala)",
            linkType: "Shared Crypto Wallet & SIM Cluster",
            entityType: "Crypto TRC-20",
            entityValue: "0x71C8392B...84A2",
            strength: .critical,
            confidence: 0.94,
            riskLevel: "CRITICAL",
            lastSeen: "2026-08-18 22:14:00",
            frequency: 142,
            matchType: "Exact Cryptographic Hash Match",
            aiAnalysis: "The primary wallet identified in this investigation (0x71C8392B) received 3 direct layering tranches totaling $42,000 USDT from the escrow pool seized in Operation Phantom Syndicate. Communication metadata indicates synchronized transactions coinciding with target pings.",
            citations: [
                "TRC-20 Transaction Hash: 0x9f1a8c4b2e... (Block #8192041)",
                "WhatsApp encrypted backup artifact: msgstore.db (Row #1402)",
                "Cellular handover EXIF timestamp: 2026-08-18 22:14 UTC"
            ]
        ),
        CrossCaseConnectionModel(
            id: "cc-2",
            caseId: "108",
            caseNumber: "2026-CR-112",
            title: "Cyber Extortion Ring: DarkGate Fleet",
            linkType: "Correlated Burner Phone",
            entityType: "Phone Number",
            entityValue: "+44 7700 900142",
            strength: .strong,
            confidence: 0.88,
            riskLevel: "HIGH",
            lastSeen: "2026-08-17 14:05:12",
            frequency: 48,
            matchType: "Direct Call Detail Record (CDR)",
            aiAnalysis: "Marcus Kane's phone number appeared as the key escrow broker in Case 2026-CR-112. Both cases share identical VoIP proxy gateways located in the United Kingdom, establishing a strong operational nexus.",
            citations: [
                "CDR Bitstream Log: Telecom Tower LAC-4819 (14 Handshakes)",
                "VoIP Gateway Header: SIP/2.0 TLS 185.220.101.5",
                "Contact Name Alias in Telegram cache: 'Escrow_Marcus_UK'"
            ]
        ),
        CrossCaseConnectionModel(
            id: "cc-3",
            caseId: "102",
            caseNumber: "2026-CR-044",
            title: "Illicit SIM Box & Toll Fraud Cluster",
            linkType: "Hardware IMEI Series Match",
            entityType: "IMEI Prefix",
            entityValue: "3589412004928XX",
            strength: .medium,
            confidence: 0.74,
            riskLevel: "HIGH",
            lastSeen: "2026-08-15 09:30:00",
            frequency: 19,
            matchType: "Hardware Batch Allocation",
            aiAnalysis: "The seized device belongs to the same hardware TAC production batch (iPhone 15 Pro Max A3106) imported through the fraudulent shell company identified in Case 2026-CR-044.",
            citations: [
                "APFS Device Manifest: HardwareModel D84AP",
                "Customs Seizure Inventory: Manifest #IND-2026-901"
            ]
        ),
        CrossCaseConnectionModel(
            id: "cc-4",
            caseId: "115",
            caseNumber: "2026-CR-140",
            title: "Airport Locker Dead-Drop Ring",
            linkType: "Geo-Exif Cluster Proximity",
            entityType: "Geolocation Pin",
            entityValue: "51.4700° N, 0.4543° W",
            strength: .strong,
            confidence: 0.91,
            riskLevel: "CRITICAL",
            lastSeen: "2026-08-18 19:24:00",
            frequency: 6,
            matchType: "Spatiotemporal Coordinate Cluster",
            aiAnalysis: "Locker #41 at Terminal 2 was identified as a dead-drop point in Case 2026-CR-140. EXIF photos recovered from the current device place the suspect at the exact coordinates 12 minutes prior to package collection.",
            citations: [
                "JPEG EXIF GPS Coordinates: 51.470081, -0.454329 (Altitude 24m)",
                "CCTV Correlation Timestamp: 2026-08-18 19:24:18"
            ]
        )
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var filteredConnections: [CrossCaseConnectionModel] {
        connections.filter { conn in
            let matchesSearch = searchText.isEmpty ||
                conn.caseNumber.localizedCaseInsensitiveContains(searchText) ||
                conn.title.localizedCaseInsensitiveContains(searchText) ||
                conn.entityValue.localizedCaseInsensitiveContains(searchText)
            
            let matchesFilter: Bool = {
                switch selectedFilter {
                case "All": return true
                case "Critical": return conn.strength == .critical
                case "Strong": return conn.strength == .strong
                case "Crypto": return conn.entityType.contains("Crypto")
                case "Phone": return conn.entityType.contains("Phone")
                case "Location": return conn.entityType.contains("Geo")
                default: return true
                }
            }()
            
            return matchesSearch && matchesFilter
        }
    }
    
    // MARK: - Actions
    
    private func triggerSync() {
        isAnalyzing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            isAnalyzing = false
        }
    }
    
    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let metricColumns: [GridItem] = {
                if width >= 1100 {
                    return Array(repeating: GridItem(.flexible(), spacing: 16), count: 4)
                } else if width >= 680 {
                    return Array(repeating: GridItem(.flexible(), spacing: 16), count: 2)
                } else {
                    return [GridItem(.flexible(), spacing: 16)]
                }
            }()
            
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 20) {
                    // Header & Toolstrip
                    headerBar
                    
                    // 4 Metric Summary Cards
                    LazyVGrid(columns: metricColumns, spacing: 16) {
                        CrossCaseMetricCard(
                            title: "LATENT CORRELATIONS",
                            value: "\(connections.count)",
                            subtitle: "Active Across 4 FIR Cases",
                            icon: "link.badge.plus",
                            color: theme.primaryAccent(isDark: isDark)
                        )
                        
                        CrossCaseMetricCard(
                            title: "CRITICAL THREAT LINKS",
                            value: "02",
                            subtitle: "Direct Financial & Geo Overlaps",
                            icon: "exclamationmark.triangle.fill",
                            color: CopSightTheme.red
                        )
                        
                        CrossCaseMetricCard(
                            title: "SHARED CRYPTO WALLETS",
                            value: "$42,000",
                            subtitle: "USDT Escrow Layering Identified",
                            icon: "bitcoinsign.circle.fill",
                            color: CopSightTheme.amber
                        )
                        
                        CrossCaseMetricCard(
                            title: "AI CONFIDENCE SCORE",
                            value: "86.8%",
                            subtitle: "High Confidence Evidence Match",
                            icon: "sparkles",
                            color: CopSightTheme.emerald
                        )
                    }
                    
                    // Filter & Search Strip
                    filterAndSearchStrip
                    
                    // Cross-Case Connection Cards List
                    VStack(spacing: 14) {
                        ForEach(filteredConnections) { item in
                            let isExpanded = expandedConnectionId == item.id || showDetails
                            connectionCard(item: item, isExpanded: isExpanded)
                        }
                    }
                }
                .padding(.horizontal, 2)
                .padding(.bottom, 60)
                .thinScrollable()
            }
            .scrollIndicators(.hidden)
        }
    }
    
    // MARK: - Header Bar
    
    private var headerBar: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            HStack(spacing: 16) {
                HStack(spacing: 12) {
                    Circle()
                        .fill(theme.iconCircleBg(isDark: isDark))
                        .frame(width: 40, height: 40)
                        .overlay(
                            Image(systemName: "link.badge.plus")
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .font(.system(size: 17))
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text("Cross-Case Forensic Intelligence")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            
                            Text("ACTIVE REPOSITORY SCAN")
                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                .tracking(1)
                                .foregroundColor(CopSightTheme.cyan)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(CopSightTheme.cyan.opacity(0.18))
                                .clipShape(Capsule())
                        }
                        
                        Text("AUTOMATIC CORRELATION OF SUSPECTS, HARDWARE, WALLETS & COMMS")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .tracking(1)
                            .foregroundColor(.white.opacity(0.75))
                    }
                }
                
                Spacer()
                
                // Action Buttons
                HStack(spacing: 10) {
                    // Sync Button
                    Button(action: triggerSync) {
                        HStack(spacing: 6) {
                            if isAnalyzing {
                                ProgressView()
                                    .scaleEffect(0.7)
                                    .colorInvert()
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .font(.system(size: 11, weight: .bold))
                            }
                            Text(isAnalyzing ? "Scanning Repository..." : "Sync Intelligence")
                                .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                        }
                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(theme.primaryAccent(isDark: isDark))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                    
                    // Condensed / Full Toggle
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            showDetails.toggle()
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: showDetails ? "list.bullet.rectangle" : "doc.text.magnifyingglass")
                                .font(.system(size: 11))
                            Text(showDetails ? "Condensed View" : "Full AI Dossiers")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(theme.insetFill(isDark: isDark))
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
            }
            .padding(18)
        }
    }
    
    // MARK: - Filter & Search Strip
    
    private var filterAndSearchStrip: some View {
        HStack(spacing: 12) {
            // Search Input
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.white.opacity(0.5))
                    .font(.system(size: 11))
                TextField("Search case, entity or wallet hash...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11.5, design: .monospaced))
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(theme.insetFill(isDark: isDark))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
            )
            .frame(maxWidth: 340)
            
            Spacer()
            
            // Filter Pills
            HStack(spacing: 6) {
                ForEach(["All", "Critical", "Strong", "Crypto", "Phone", "Location"], id: \.self) { filter in
                    let isSel = selectedFilter == filter
                    Button(action: { selectedFilter = filter }) {
                        Text(filter)
                            .font(.system(size: 10.5, weight: isSel ? .bold : .medium, design: .monospaced))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(isSel ? theme.primaryAccent(isDark: isDark) : theme.insetFill(isDark: isDark))
                            .foregroundColor(isSel ? theme.primaryAccentText(isDark: isDark) : .white.opacity(0.85))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
            }
        }
        .padding(.horizontal, 4)
    }
    
    // MARK: - Connection Card
    
    private func connectionCard(item: CrossCaseConnectionModel, isExpanded: Bool) -> some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius, isHighlighted: isExpanded) {
            VStack(alignment: .leading, spacing: 0) {
                // Main Header Row
                Button(action: {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        expandedConnectionId = (expandedConnectionId == item.id) ? nil : item.id
                    }
                }) {
                    HStack(alignment: .top, spacing: 14) {
                        // Strength Icon Badge
                        Circle()
                            .fill(item.strength.color.opacity(0.2))
                            .frame(width: 42, height: 42)
                            .overlay(
                                Image(systemName: item.strength.icon)
                                    .foregroundColor(item.strength.color)
                                    .font(.system(size: 16, weight: .bold))
                            )
                        
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 8) {
                                Text("CASE #\(item.caseNumber)")
                                    .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(item.strength.color)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(item.strength.color.opacity(0.18))
                                    .clipShape(Capsule())
                                
                                Text(item.strength.rawValue)
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .foregroundColor(item.strength.color)
                                
                                Spacer()
                                
                                // Match Confidence
                                HStack(spacing: 6) {
                                    Text("\(Int(item.confidence * 100))% MATCH")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .foregroundColor(CopSightTheme.emerald)
                                    
                                    // Mini Bar
                                    GeometryReader { barGeo in
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(Color.white.opacity(0.12))
                                            Capsule().fill(CopSightTheme.emerald).frame(width: barGeo.size.width * item.confidence)
                                        }
                                    }
                                    .frame(width: 60, height: 6)
                                }
                            }
                            
                            Text(item.title)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.white)
                            
                            // Attribute Pills
                            HStack(spacing: 12) {
                                HStack(spacing: 5) {
                                    Image(systemName: "link")
                                        .font(.system(size: 10))
                                    Text(item.linkType)
                                        .font(.system(size: 11, weight: .medium))
                                }
                                .foregroundColor(.white.opacity(0.75))
                                
                                Text("•").foregroundColor(.white.opacity(0.3))
                                
                                HStack(spacing: 5) {
                                    Text("Shared:")
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.5))
                                    Text(item.entityValue)
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                                }
                            }
                        }
                        
                        Spacer()
                        
                        Image(systemName: isExpanded ? "chevron.up.circle.fill" : "chevron.down.circle")
                            .font(.system(size: 18))
                            .foregroundColor(.white.opacity(isExpanded ? 0.9 : 0.4))
                    }
                    .padding(18)
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                
                // Expandable Forensic Details Drawer
                if isExpanded {
                    Divider().background(Color.white.opacity(0.12))
                    
                    VStack(alignment: .leading, spacing: 16) {
                        // AI Analysis & Ground of Evidences Grid
                        HStack(alignment: .top, spacing: 16) {
                            // AI Narrative Box
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(spacing: 6) {
                                    Image(systemName: "sparkles")
                                        .foregroundColor(CopSightTheme.cyan)
                                        .font(.system(size: 12))
                                    Text("AI CORRELATION ANALYSIS")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .foregroundColor(CopSightTheme.cyan)
                                }
                                
                                Text(item.aiAnalysis)
                                    .font(.system(size: 12))
                                    .lineSpacing(4)
                                    .foregroundColor(.white.opacity(0.9))
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(14)
                            
                            // Evidence Citations & Metadata Box
                            VStack(alignment: .leading, spacing: 10) {
                                Text("GROUND OF EVIDENCES (\(item.citations.count))")
                                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.75))
                                
                                ForEach(Array(item.citations.enumerated()), id: \.offset) { idx, cite in
                                    HStack(alignment: .top, spacing: 6) {
                                        Text("[\(idx + 1)]")
                                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                                        Text(cite)
                                            .font(.system(size: 11, design: .monospaced))
                                            .foregroundColor(.white.opacity(0.8))
                                    }
                                }
                                
                                Divider().background(Color.white.opacity(0.08))
                                
                                // Quick Metadata Table
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Match Type")
                                            .font(.system(size: 9, design: .monospaced))
                                            .foregroundColor(.white.opacity(0.5))
                                        Text(item.matchType)
                                            .font(.system(size: 10.5, weight: .bold))
                                            .foregroundColor(.white)
                                    }
                                    
                                    Spacer()
                                    
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text("Interaction Frequency")
                                            .font(.system(size: 9, design: .monospaced))
                                            .foregroundColor(.white.opacity(0.5))
                                        Text("\(item.frequency) Event Overlaps")
                                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                            .foregroundColor(CopSightTheme.emerald)
                                    }
                                }
                            }
                            .padding(14)
                            .frame(maxWidth: 380, alignment: .leading)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(14)
                        }
                        
                        // Bottom Actions Bar
                        HStack {
                            Text("Last Inter-Case Ping: \(item.lastSeen)")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.5))
                            
                            Spacer()
                            
                            Button(action: {
                                onNavigateTab?(.graph)
                            }) {
                                HStack(spacing: 6) {
                                    Image(systemName: "point.3.connected.trianglepath.dotted")
                                        .font(.system(size: 11))
                                    Text("Investigate In Network Graph")
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                }
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.white.opacity(0.08))
                                .cornerRadius(8)
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                        }
                    }
                    .padding(18)
                }
            }
        }
    }
}

/// Subcomponent: Metric Card for Cross-Case Dashboard
struct CrossCaseMetricCard: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let color: Color
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Circle()
                        .fill(theme.iconCircleBg(isDark: isDark))
                        .frame(width: 36, height: 36)
                        .overlay(
                            Image(systemName: icon)
                                .foregroundColor(color)
                                .font(.system(size: 15))
                        )
                    
                    Spacer()
                    
                    Text(title)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.8))
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(value)
                        .font(.system(size: 26, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                    
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.75))
                        .lineLimit(1)
                }
            }
            .padding(16)
        }
        .frame(height: 125)
    }
}
