import SwiftUI

/// Forensic Node Model representing extracted entities across cases and seized devices
struct ForensicNode: Identifiable, Equatable {
    let id: String
    let name: String
    let type: NodeType
    let subtitle: String
    let riskLevel: String
    let riskColor: Color
    let icon: String
    var position: CGPoint
    let details: [String: String]
    let connectedIds: [String]
    
    enum NodeType: String, CaseIterable {
        case device = "Device"
        case suspect = "Suspect"
        case crypto = "Crypto Wallet"
        case location = "Location"
        case database = "Evidence DB"
        case comms = "Encrypted Comms"
        
        var color: Color {
            switch self {
            case .device: return CopSightTheme.skyBlue
            case .suspect: return CopSightTheme.coral
            case .crypto: return CopSightTheme.amber
            case .location: return CopSightTheme.emerald
            case .database: return CopSightTheme.cyan
            case .comms: return Color(hex: "a855f7")
            }
        }
    }
}

/// Forensic Edge Model representing verified cryptographic or communication links
struct ForensicEdge: Identifiable {
    let id: String
    let sourceId: String
    let targetId: String
    let label: String
    let weight: CGFloat
    let isEncrypted: Bool
}

/// Filter category item with SF Symbol icon for responsive icon/text switching
struct GraphFilterCategory: Identifiable {
    let id: String
    let name: String
    let icon: String
}

/// Interactive 2D Forensic Entity Network Graph View
/// Features: Pan, Zoom (HUD & Gestures), Drag & Drop Nodes, Camera Auto-Focus,
/// Strict Canvas Clipping (zero overflow over sidebar), and Adaptive Icon/Text Filter Bar.
struct NetworkGraphView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var searchText = ""
    @State private var selectedFilter: String = "All"
    @State private var selectedNodeId: String? = "node-target"
    
    // Interactive Zoom & Pan State
    @State private var zoomScale: CGFloat = 1.0
    @State private var panOffset: CGSize = .zero
    @State private var dragStartOffset: CGSize = .zero
    @State private var canvasSize: CGSize = CGSize(width: 800, height: 600)
    
    let filterCategories: [GraphFilterCategory] = [
        GraphFilterCategory(id: "All", name: "All", icon: "square.grid.2x2"),
        GraphFilterCategory(id: "Device", name: "Device", icon: "iphone"),
        GraphFilterCategory(id: "Suspect", name: "Suspect", icon: "person.fill"),
        GraphFilterCategory(id: "Crypto Wallet", name: "Crypto", icon: "bitcoinsign.circle.fill"),
        GraphFilterCategory(id: "Location", name: "Location", icon: "mappin.and.ellipse"),
        GraphFilterCategory(id: "Evidence DB", name: "Evidence DB", icon: "externaldrive.fill")
    ]
    
    // Comprehensive Forensic Network Topology (Centered coordinates to prevent edge collisions)
    @State private var nodes: [ForensicNode] = [
        ForensicNode(
            id: "node-target",
            name: "Apple iPhone 15 Pro Max",
            type: .device,
            subtitle: "Primary Seized Evidence",
            riskLevel: "HIGH",
            riskColor: CopSightTheme.red,
            icon: "iphone",
            position: CGPoint(x: 380, y: 260),
            details: ["IMEI": "358941200492810", "OS": "iOS 17.5.1", "Carrier": "Vodafone UK", "Custody": "Sealed Vault #4"],
            connectedIds: ["node-suspect-1", "node-suspect-2", "node-wallet-1", "node-db-1", "node-tg"]
        ),
        ForensicNode(
            id: "node-suspect-1",
            name: "Viktor Vance (Target)",
            type: .suspect,
            subtitle: "+1 (555) 019-2831",
            riskLevel: "CRITICAL",
            riskColor: CopSightTheme.red,
            icon: "person.fill",
            position: CGPoint(x: 200, y: 140),
            details: ["FIR Status": "Named Suspect", "Alias": "Spectre", "Total Calls": "142 Records", "Last Ping": "2026-08-19 11:42"],
            connectedIds: ["node-target", "node-suspect-2", "node-location-1", "node-tower"]
        ),
        ForensicNode(
            id: "node-suspect-2",
            name: "Marcus Kane",
            type: .suspect,
            subtitle: "+44 7700 900142",
            riskLevel: "HIGH",
            riskColor: CopSightTheme.amber,
            icon: "person.crop.circle.badge.exclamationmark",
            position: CGPoint(x: 550, y: 140),
            details: ["Role": "Escrow Broker", "Encrypted Chats": "48 WhatsApp Exchanges", "Country": "United Kingdom"],
            connectedIds: ["node-target", "node-suspect-1", "node-wallet-1", "node-wallet-2"]
        ),
        ForensicNode(
            id: "node-wallet-1",
            name: "0x71C...392B (TRC-20)",
            type: .crypto,
            subtitle: "$42,000 USDT Escrow",
            riskLevel: "CRITICAL",
            riskColor: CopSightTheme.red,
            icon: "bitcoinsign.circle.fill",
            position: CGPoint(x: 560, y: 350),
            details: ["Blockchain": "TRON (TRC-20)", "Tranches": "3 Deposits", "Contract": "Tether USDT", "Flag": "Sanctioned Mixer"],
            connectedIds: ["node-target", "node-suspect-2", "node-wallet-2"]
        ),
        ForensicNode(
            id: "node-wallet-2",
            name: "1A1zP...e79B (BTC)",
            type: .crypto,
            subtitle: "3.42 BTC Layering",
            riskLevel: "HIGH",
            riskColor: CopSightTheme.amber,
            icon: "bitcoinsign.circle",
            position: CGPoint(x: 670, y: 240),
            details: ["Blockchain": "Bitcoin Core", "Cluster": "Wasabi CoinJoin", "Inputs": "14 UTXOs", "Status": "Flagged"],
            connectedIds: ["node-suspect-2", "node-wallet-1"]
        ),
        ForensicNode(
            id: "node-location-1",
            name: "Terminal 2 Locker #41",
            type: .location,
            subtitle: "Geo-Exif Drop Pin",
            riskLevel: "VERIFIED",
            riskColor: CopSightTheme.emerald,
            icon: "mappin.and.ellipse",
            position: CGPoint(x: 140, y: 360),
            details: ["Coordinates": "51.4700° N, 0.4543° W", "Exif Photos": "14 Images", "Timestamp": "2026-08-18 19:24"],
            connectedIds: ["node-suspect-1", "node-target", "node-tower"]
        ),
        ForensicNode(
            id: "node-tower",
            name: "Cell Tower LAC-4819",
            type: .location,
            subtitle: "Heathrow Sector B",
            riskLevel: "LOGGED",
            riskColor: CopSightTheme.emerald,
            icon: "antenna.radiowaves.left.and.right",
            position: CGPoint(x: 90, y: 220),
            details: ["Cell ID": "48192-3", "Azimuth": "120°", "Signal Timing": "14 Handoffs", "Carrier": "Vodafone"],
            connectedIds: ["node-suspect-1", "node-location-1"]
        ),
        ForensicNode(
            id: "node-db-1",
            name: "msgstore.db.crypt15",
            type: .database,
            subtitle: "4,280 Encrypted Records",
            riskLevel: "DECRYPTED",
            riskColor: CopSightTheme.cyan,
            icon: "externaldrive.fill",
            position: CGPoint(x: 400, y: 420),
            details: ["Format": "SQLite 3", "Decryption Vector": "Crypt15 AES-GCM", "Extracted Keys": "Keybag #24", "SHA-256": "A9F8B2C4E3D59012"],
            connectedIds: ["node-target"]
        ),
        ForensicNode(
            id: "node-tg",
            name: "Telegram Secret Channel",
            type: .comms,
            subtitle: "@dark_courier_bot",
            riskLevel: "CRITICAL",
            riskColor: Color(hex: "a855f7"),
            icon: "paperplane.fill",
            position: CGPoint(x: 270, y: 400),
            details: ["Protocol": "MTProto 2.0", "Auto-Delete": "24 Hours", "Participants": "4 Identities", "Status": "Archived"],
            connectedIds: ["node-target", "node-suspect-1"]
        )
    ]
    
    let edges: [ForensicEdge] = [
        ForensicEdge(id: "e1", sourceId: "node-target", targetId: "node-suspect-1", label: "Owner / Handshake", weight: 3, isEncrypted: false),
        ForensicEdge(id: "e2", sourceId: "node-target", targetId: "node-suspect-2", label: "48 Encrypted Exchanges", weight: 2.5, isEncrypted: true),
        ForensicEdge(id: "e3", sourceId: "node-target", targetId: "node-wallet-1", label: "$42,000 USDT Escrow", weight: 3, isEncrypted: true),
        ForensicEdge(id: "e4", sourceId: "node-target", targetId: "node-db-1", label: "SQLite Bitstream", weight: 2, isEncrypted: false),
        ForensicEdge(id: "e5", sourceId: "node-suspect-1", targetId: "node-location-1", label: "GPS Exif Correlation", weight: 2, isEncrypted: false),
        ForensicEdge(id: "e6", sourceId: "node-suspect-1", targetId: "node-suspect-2", label: "Direct Phone Link", weight: 1.5, isEncrypted: false),
        ForensicEdge(id: "e7", sourceId: "node-suspect-1", targetId: "node-tower", label: "Tower Handshake (14x)", weight: 1.8, isEncrypted: false),
        ForensicEdge(id: "e8", sourceId: "node-wallet-1", targetId: "node-wallet-2", label: "Cross-Chain Hop", weight: 2.2, isEncrypted: true),
        ForensicEdge(id: "e9", sourceId: "node-target", targetId: "node-tg", label: "MTProto Tunnel", weight: 2.5, isEncrypted: true),
        ForensicEdge(id: "e10", sourceId: "node-tg", targetId: "node-suspect-1", label: "Admin Channel Bot", weight: 2.0, isEncrypted: true)
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var filteredNodes: [ForensicNode] {
        nodes.filter { n in
            let matchesSearch = searchText.isEmpty ||
                n.name.localizedCaseInsensitiveContains(searchText) ||
                n.subtitle.localizedCaseInsensitiveContains(searchText)
            let matchesFilter = selectedFilter == "All" || n.type.rawValue == selectedFilter
            return matchesSearch && matchesFilter
        }
    }
    
    var selectedNode: ForensicNode? {
        nodes.first { $0.id == selectedNodeId }
    }
    
    // MARK: - Camera & Traversal Actions
    
    private func focusOnNode(id: String) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        selectedNodeId = id
        
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            let targetX = (canvasSize.width / 2) - (node.position.x * zoomScale)
            let targetY = (canvasSize.height / 2) - (node.position.y * zoomScale)
            panOffset = CGSize(width: targetX, height: targetY)
        }
    }
    
    private func traverseToNextNode() {
        guard let currentId = selectedNodeId,
              let currentIndex = nodes.firstIndex(where: { $0.id == currentId }) else { return }
        let nextIndex = (currentIndex + 1) % nodes.count
        focusOnNode(id: nodes[nextIndex].id)
    }
    
    private func traverseToPreviousNode() {
        guard let currentId = selectedNodeId,
              let currentIndex = nodes.firstIndex(where: { $0.id == currentId }) else { return }
        let prevIndex = (currentIndex - 1 + nodes.count) % nodes.count
        focusOnNode(id: nodes[prevIndex].id)
    }
    
    private func resetView() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            zoomScale = 1.0
            panOffset = .zero
            dragStartOffset = .zero
        }
    }
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(spacing: 0) {
                // Top Header & Responsive Filter Bar
                headerAndFilterBar
                
                Divider().background(Color.white.opacity(0.12))
                
                // Graph Canvas & Inspector Split View
                HStack(spacing: 0) {
                    // Interactive Canvas with Zoom, Pan, and Draggable Nodes (Strictly Clipped)
                    interactiveCanvasView
                        .clipped()
                        .zIndex(1)
                    
                    Divider()
                        .background(Color.white.opacity(0.12))
                        .zIndex(2)
                    
                    // Entity Inspector Sidebar (Clipped with smooth rounded bottom corner)
                    inspectorSidebarView
                        .zIndex(2)
                }
            }
            // Clip entire container to continuous 32pt panel curvature
            .clipShape(RoundedRectangle(cornerRadius: CopSightTheme.panelRadius, style: .continuous))
        }
        .frame(minHeight: 580)
        .padding(.horizontal, 2)
        .padding(.bottom, 60)
    }
    
    // MARK: - Header & Filter Bar
    
    private var headerAndFilterBar: some View {
        GeometryReader { headerGeo in
            let isCompact = headerGeo.size.width < 960
            
            HStack(alignment: .center, spacing: 12) {
                // Title & Icon Badge
                HStack(spacing: 10) {
                    Circle()
                        .fill(theme.iconCircleBg(isDark: isDark))
                        .frame(width: 36, height: 36)
                        .overlay(
                            Image(systemName: "point.3.connected.trianglepath.dotted")
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .font(.system(size: 15))
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Forensic Entity Network Graph")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Text("INTERACTIVE 2D CANVAS · ZOOM, PAN & TRAVERSAL")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .tracking(1)
                            .foregroundColor(.white.opacity(0.75))
                            .lineLimit(1)
                    }
                }
                .fixedSize(horizontal: true, vertical: false)
                
                Spacer(minLength: 8)
                
                // Search Bar with auto-focus traversal
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.white.opacity(0.5))
                        .font(.system(size: 11))
                    TextField("Search & traverse...", text: $searchText)
                        .textFieldStyle(.plain)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.white)
                        .onSubmit {
                            if let match = filteredNodes.first {
                                focusOnNode(id: match.id)
                            }
                        }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(theme.insetFill(isDark: isDark))
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                )
                .frame(minWidth: 110, maxWidth: 180)
                .layoutPriority(0)
                
                // Adaptive Filter Pills (Icons on compact, Text on wide; never vertical)
                HStack(spacing: 5) {
                    ForEach(filterCategories) { cat in
                        let isSel = selectedFilter == cat.id
                        Button(action: { selectedFilter = cat.id }) {
                            HStack(spacing: 5) {
                                Image(systemName: cat.icon)
                                    .font(.system(size: isCompact ? 12 : 10))
                                
                                if !isCompact {
                                    Text(cat.name)
                                        .font(.system(size: 10, weight: isSel ? .bold : .medium, design: .monospaced))
                                        .lineLimit(1)
                                        .fixedSize(horizontal: true, vertical: false)
                                }
                            }
                            .padding(.horizontal, isCompact ? 8 : 10)
                            .padding(.vertical, 6)
                            .background(isSel ? theme.primaryAccent(isDark: isDark) : theme.insetFill(isDark: isDark))
                            .foregroundColor(isSel ? theme.primaryAccentText(isDark: isDark) : .white.opacity(0.85))
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                        .help(cat.name)
                    }
                }
                .layoutPriority(1)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .frame(height: 60)
    }
    
    // MARK: - Interactive Canvas
    
    private var interactiveCanvasView: some View {
        GeometryReader { canvasGeo in
            ZStack {
                // Background Grid
                Canvas { ctx, size in
                    let step: CGFloat = 30 * max(0.5, zoomScale)
                    for x in stride(from: 0, to: size.width, by: step) {
                        var p = Path()
                        p.move(to: CGPoint(x: x, y: 0))
                        p.addLine(to: CGPoint(x: x, y: size.height))
                        ctx.stroke(p, with: .color(Color.white.opacity(0.04)), lineWidth: 1)
                    }
                    for y in stride(from: 0, to: size.height, by: step) {
                        var p = Path()
                        p.move(to: CGPoint(x: 0, y: y))
                        p.addLine(to: CGPoint(x: size.width, y: y))
                        ctx.stroke(p, with: .color(Color.white.opacity(0.04)), lineWidth: 1)
                    }
                }
                
                // Transformed Network Layer (Zoomed & Panned)
                ZStack {
                    // Edges
                    ForEach(edges) { edge in
                        if let start = nodes.first(where: { $0.id == edge.sourceId })?.position,
                           let end = nodes.first(where: { $0.id == edge.targetId })?.position {
                            
                            let isHighlighted = selectedNodeId == edge.sourceId || selectedNodeId == edge.targetId
                            
                            Path { p in
                                p.move(to: start)
                                p.addLine(to: end)
                            }
                            .stroke(
                                isHighlighted ? (isDark ? Color.white : CopSightTheme.coral) : Color.white.opacity(0.20),
                                style: StrokeStyle(lineWidth: isHighlighted ? 2.5 : 1.2, dash: edge.isEncrypted ? [6, 4] : [])
                            )
                            .shadow(color: isHighlighted ? (isDark ? Color.white.opacity(0.6) : CopSightTheme.coral.opacity(0.6)) : .clear, radius: 4)
                            
                            // Midpoint Edge Label
                            let midPoint = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
                            Text(edge.label)
                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.black.opacity(0.85))
                                .foregroundColor(isHighlighted ? .white : .white.opacity(0.65))
                                .cornerRadius(4)
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.white.opacity(0.18), lineWidth: 0.5))
                                .position(midPoint)
                        }
                    }
                    
                    // Draggable Forensic Nodes
                    ForEach(filteredNodes) { node in
                        let isSelected = selectedNodeId == node.id
                        
                        NodeCircleView(node: node, isSelected: isSelected)
                            .position(node.position)
                            .gesture(
                                DragGesture()
                                    .onChanged { value in
                                        if let idx = nodes.firstIndex(where: { $0.id == node.id }) {
                                            nodes[idx].position = CGPoint(
                                                x: max(40, min(canvasGeo.size.width - 40, value.location.x)),
                                                y: max(40, min(canvasGeo.size.height - 40, value.location.y))
                                            )
                                        }
                                        selectedNodeId = node.id
                                    }
                            )
                            .onTapGesture {
                                focusOnNode(id: node.id)
                            }
                    }
                }
                .scaleEffect(zoomScale)
                .offset(panOffset)
                .contentShape(Rectangle())
                .gesture(
                    // Pan Gesture on Canvas Background
                    DragGesture()
                        .onChanged { val in
                            panOffset = CGSize(
                                width: dragStartOffset.width + val.translation.width,
                                height: dragStartOffset.height + val.translation.height
                            )
                        }
                        .onEnded { _ in
                            dragStartOffset = panOffset
                        }
                )
                .gesture(
                    // Pinch to Zoom Gesture
                    MagnificationGesture()
                        .onChanged { val in
                            let newScale = max(0.4, min(3.0, val))
                            zoomScale = newScale
                        }
                )
                
                // Floating On-Canvas HUD Controls (Zoom In/Out, Fit, Traversal)
                VStack {
                    HStack {
                        Spacer()
                        canvasHUDControls
                    }
                    Spacer()
                }
                .padding(14)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
            .onAppear {
                canvasSize = canvasGeo.size
                dragStartOffset = panOffset
            }
            .onChange(of: canvasGeo.size) { _, newSize in
                canvasSize = newSize
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
    }
    
    // MARK: - Canvas HUD Controls
    
    private var canvasHUDControls: some View {
        HStack(spacing: 6) {
            // Zoom Out
            Button(action: {
                withAnimation(.easeInOut(duration: 0.2)) {
                    zoomScale = max(0.4, zoomScale - 0.2)
                }
            }) {
                Image(systemName: "minus")
                    .font(.system(size: 11, weight: .bold))
                    .frame(width: 28, height: 28)
                    .background(Color.black.opacity(0.75))
                    .foregroundColor(.white)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .focusable(false)
            .focusEffectDisabled()
            .help("Zoom Out")
            
            // Zoom Scale Indicator
            Text("\(Int(zoomScale * 100))%")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.85))
                .padding(.horizontal, 6)
            
            // Zoom In
            Button(action: {
                withAnimation(.easeInOut(duration: 0.2)) {
                    zoomScale = min(3.0, zoomScale + 0.2)
                }
            }) {
                Image(systemName: "plus")
                    .font(.system(size: 11, weight: .bold))
                    .frame(width: 28, height: 28)
                    .background(Color.black.opacity(0.75))
                    .foregroundColor(.white)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .focusable(false)
            .focusEffectDisabled()
            .help("Zoom In")
            
            // Reset View
            Button(action: resetView) {
                Image(systemName: "arrow.counterclockwise")
                    .font(.system(size: 10, weight: .bold))
                    .frame(width: 28, height: 28)
                    .background(Color.black.opacity(0.75))
                    .foregroundColor(.white)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .focusable(false)
            .focusEffectDisabled()
            .help("Reset Canvas View")
            
            // Focus Selected Node
            if let selId = selectedNodeId {
                Button(action: { focusOnNode(id: selId) }) {
                    Image(systemName: "location.fill")
                        .font(.system(size: 10, weight: .bold))
                        .frame(width: 28, height: 28)
                        .background(theme.primaryAccent(isDark: isDark))
                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .help("Center on Selected Node")
            }
        }
        .padding(6)
        .background(Color.black.opacity(0.6))
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.2), lineWidth: 1))
    }
    
    // MARK: - Inspector Sidebar
    
    private var inspectorSidebarView: some View {
        Group {
            if let sel = selectedNode {
                VStack(alignment: .leading, spacing: 14) {
                    // Header with Traversal Controls
                    HStack {
                        Circle()
                            .fill(sel.type.color.opacity(0.25))
                            .frame(width: 38, height: 38)
                            .overlay(
                                Image(systemName: sel.icon)
                                    .foregroundColor(sel.type.color)
                                    .font(.system(size: 16))
                            )
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(sel.name)
                                .font(.system(size: 13.5, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Text(sel.subtitle)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                        }
                        
                        Spacer()
                        
                        // Node Traversal Arrows
                        HStack(spacing: 4) {
                            Button(action: traverseToPreviousNode) {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 10, weight: .bold))
                                    .frame(width: 22, height: 22)
                                    .background(Color.white.opacity(0.1))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                            .help("Previous Node")
                            
                            Button(action: traverseToNextNode) {
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 10, weight: .bold))
                                    .frame(width: 22, height: 22)
                                    .background(Color.white.opacity(0.1))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .focusable(false)
                            .focusEffectDisabled()
                            .help("Next Node")
                        }
                    }
                    
                    // Risk Pill & Focus Action
                    HStack {
                        Text(sel.riskLevel)
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(sel.riskColor.opacity(0.25))
                            .foregroundColor(sel.riskColor)
                            .clipShape(Capsule())
                        
                        Spacer()
                        
                        Button(action: { focusOnNode(id: sel.id) }) {
                            HStack(spacing: 4) {
                                Image(systemName: "scope")
                                    .font(.system(size: 10))
                                Text("Center Camera")
                                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            }
                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.white.opacity(0.06))
                            .cornerRadius(6)
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                    }
                    
                    Divider().background(Color.white.opacity(0.12))
                    
                    // Key-Value Attribute Table
                    VStack(alignment: .leading, spacing: 8) {
                        Text("FORENSIC ATTRIBUTES")
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.75))
                        
                        ForEach(Array(sel.details.sorted(by: { $0.key < $1.key })), id: \.key) { k, v in
                            HStack {
                                Text(k)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.65))
                                Spacer()
                                Text(v)
                                    .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                            }
                            .padding(8)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(8)
                        }
                    }
                    
                    Spacer()
                    
                    // Connected Nodes Traversal Links
                    VStack(alignment: .leading, spacing: 6) {
                        Text("CORRELATED NODES (\(sel.connectedIds.count))")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                        
                        ForEach(sel.connectedIds, id: \.self) { cId in
                            if let cNode = nodes.first(where: { $0.id == cId }) {
                                Button(action: { focusOnNode(id: cId) }) {
                                    HStack(spacing: 8) {
                                        Image(systemName: cNode.icon)
                                            .font(.system(size: 11))
                                            .foregroundColor(cNode.type.color)
                                        Text(cNode.name)
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(.white)
                                            .lineLimit(1)
                                        Spacer()
                                        Image(systemName: "arrow.right")
                                            .font(.system(size: 9))
                                            .foregroundColor(.white.opacity(0.4))
                                    }
                                    .padding(7)
                                    .background(Color.white.opacity(0.06))
                                    .cornerRadius(6)
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                }
                .padding(18)
                .frame(width: 280)
                .background(Color.black.opacity(isDark ? 0.65 : 0.45))
                .background(.ultraThinMaterial)
            }
        }
    }
}

/// Subcomponent rendering individual forensic node badges
struct NodeCircleView: View {
    let node: ForensicNode
    let isSelected: Bool
    
    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                // Outer Pulse Ring when Selected
                if isSelected {
                    Circle()
                        .stroke(node.type.color.opacity(0.8), lineWidth: 2)
                        .frame(width: 52, height: 52)
                        .shadow(color: node.type.color.opacity(0.8), radius: 8)
                }
                
                // Node Body
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [node.type.color.opacity(0.95), node.type.color.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: node.icon)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                    )
                    .overlay(
                        Circle().strokeBorder(Color.white.opacity(0.7), lineWidth: 1.5)
                    )
                    .shadow(color: Color.black.opacity(0.5), radius: 4, y: 2)
            }
            
            // Text Label
            Text(node.name)
                .font(.system(size: 10, weight: isSelected ? .bold : .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.black.opacity(0.75))
                .cornerRadius(4)
                .lineLimit(1)
        }
    }
}
