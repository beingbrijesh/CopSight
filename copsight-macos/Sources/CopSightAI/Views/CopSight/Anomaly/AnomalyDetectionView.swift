import SwiftUI

/// Forensic Anomaly Model representing ML detections across forensic data streams
struct AnomalyItem: Identifiable, Equatable {
    let id: String
    let anomalyType: String
    let attackCategory: String?
    let modelBadge: String
    let confidence: Double
    let description: String
    let hour: Int?
    let zScore: Double?
    let reconstructionError: Double?
    let threshold: Double?
    let recordDetails: [String: String]
    
    var formattedType: String {
        anomalyType.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

/// AI Multi-Model Anomaly Detection View
/// Deep learning forensic analysis powered by XGBoost, Universal DNN, LSTM Autoencoders, and Isolation Forest.
struct AnomalyDetectionView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var isRunning = false
    @State private var selectedModelFilter = "All"
    @State private var expandedSection: String? = "xgb"
    
    // Sample multi-model forensic anomaly detections
    @State private var anomalies: [AnomalyItem] = [
        // XGBoost Attack Classification
        AnomalyItem(
            id: "anom-1",
            anomalyType: "data_exfiltration_tunnel",
            attackCategory: "R2L / Exfiltration",
            modelBadge: "XGBoost",
            confidence: 0.94,
            description: "High-entropy UDP datagram burst detected to foreign IP 185.220.101.5 on non-standard port 8443 during off-hours.",
            hour: 3,
            zScore: 3.82,
            reconstructionError: nil,
            threshold: nil,
            recordDetails: [
                "Protocol": "UDP / Encrypted",
                "Destination": "185.220.101.5:8443",
                "Payload Volume": "142.8 MB (3 bursts)",
                "Process": "com.apple.WebKit.Networking (Spoofed)"
            ]
        ),
        AnomalyItem(
            id: "anom-2",
            anomalyType: "port_scan_probe",
            attackCategory: "Probe",
            modelBadge: "XGBoost",
            confidence: 0.89,
            description: "Sequential SYN probe pattern across internal subnet range 192.168.1.0/24 from tethered virtual interface.",
            hour: 2,
            zScore: 2.94,
            reconstructionError: nil,
            threshold: nil,
            recordDetails: [
                "Probed Ports": "22, 80, 443, 8080, 27017",
                "Origin Interface": "bridge100",
                "Duration": "420ms"
            ]
        ),
        // Universal DNN Behavioural Anomalies
        AnomalyItem(
            id: "anom-3",
            anomalyType: "burner_phone_cascade",
            attackCategory: nil,
            modelBadge: "Universal DNN",
            confidence: 0.86,
            description: "Rapid single-use SIM activation cycle with 14 outgoing SMS dispatches followed by immediate radio silence.",
            hour: 1,
            zScore: 4.12,
            reconstructionError: nil,
            threshold: nil,
            recordDetails: [
                "Target Number": "+1 (555) 019-2831",
                "SIM ICCID": "8901410321111851023",
                "Cell Tower": "LAC-4819 Sector B",
                "SMS Count": "14 Messages (all encrypted)"
            ]
        ),
        AnomalyItem(
            id: "anom-4",
            anomalyType: "off_hour_contact_burst",
            attackCategory: nil,
            modelBadge: "Universal DNN",
            confidence: 0.78,
            description: "Sudden midnight spike in encrypted messaging exchanges with unregistered international contact (+44 7700 900142).",
            hour: 4,
            zScore: 2.75,
            reconstructionError: nil,
            threshold: nil,
            recordDetails: [
                "App Source": "WhatsApp Crypt15",
                "Contact Name": "Marcus Kane",
                "Timestamps": "03:42:10 - 04:15:00 UTC",
                "Exchange Count": "48 Records"
            ]
        ),
        // LSTM Autoencoder Sequence Anomalies
        AnomalyItem(
            id: "anom-5",
            anomalyType: "temporal_sequence_break",
            attackCategory: nil,
            modelBadge: "LSTM-AE",
            confidence: 0.91,
            description: "Unprecedented 72-hour complete communication blackout followed by rapid multi-channel resumption.",
            hour: 23,
            zScore: nil,
            reconstructionError: 4.82,
            threshold: 1.50,
            recordDetails: [
                "Preceding Ping": "2026-08-15 11:20:00",
                "Resumption Ping": "2026-08-18 11:20:00",
                "Model Loss": "4.82 (High Outlier)",
                "Historical Baseline": "Daily active 08:00 - 22:00"
            ]
        ),
        AnomalyItem(
            id: "anom-6",
            anomalyType: "cryptographic_keybag_spike",
            attackCategory: nil,
            modelBadge: "Isolation Forest",
            confidence: 0.82,
            description: "Statistically aberrant keybag derivation requests executed within a 3-minute forensic triage window.",
            hour: 16,
            zScore: 3.10,
            reconstructionError: nil,
            threshold: nil,
            recordDetails: [
                "Key Iterations": "250,000 rounds/sec",
                "Vector": "PBKDF2-HMAC-SHA256",
                "Derivations Attempted": "12 Keys"
            ]
        )
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var filteredAnomalies: [AnomalyItem] {
        anomalies.filter { anom in
            selectedModelFilter == "All" || anom.modelBadge.contains(selectedModelFilter)
        }
    }
    
    // Model distribution data for Donut Chart
    var modelDistribution: [(name: String, count: Int, color: Color)] {
        [
            ("XGBoost", anomalies.filter { $0.modelBadge == "XGBoost" }.count, CopSightTheme.red),
            ("DNN", anomalies.filter { $0.modelBadge == "Universal DNN" }.count, Color(hex: "8b5cf6")),
            ("LSTM-AE", anomalies.filter { $0.modelBadge == "LSTM-AE" }.count, CopSightTheme.cyan),
            ("Isolation Forest", anomalies.filter { $0.modelBadge == "Isolation Forest" }.count, CopSightTheme.amber)
        ].filter { $0.count > 0 }
    }
    
    private func triggerRunDetection() {
        isRunning = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            isRunning = false
        }
    }
    
    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let summaryColumns: [GridItem] = {
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
                    
                    // 4 KPI Summary Cards
                    LazyVGrid(columns: summaryColumns, spacing: 16) {
                        AnomalySummaryCard(
                            title: "TOTAL ANOMALIES",
                            value: "\(anomalies.count)",
                            subtitle: "2 Critical · 3 High · 1 Medium",
                            icon: "waveform.path.ecg",
                            color: CopSightTheme.coral
                        )
                        
                        AnomalySummaryCard(
                            title: "OVERALL THREAT RISK",
                            value: "CRITICAL",
                            subtitle: "Exfiltration & Burner Patterns",
                            icon: "exclamationmark.shield.fill",
                            color: CopSightTheme.red
                        )
                        
                        AnomalySummaryCard(
                            title: "HIGH CONFIDENCE (≥70%)",
                            value: "06",
                            subtitle: "Multi-Model Triangulated",
                            icon: "checkmark.seal.fill",
                            color: CopSightTheme.emerald
                        )
                        
                        AnomalySummaryCard(
                            title: "ACTIVE AI ENGINES",
                            value: "4 MODELS",
                            subtitle: "XGB · DNN · LSTM · IF",
                            icon: "brain.head.profile",
                            color: Color(hex: "a855f7")
                        )
                    }
                    
                    // Graphical Analytics Row (Donut Chart & Confidence Strip)
                    HStack(spacing: 16) {
                        // Donut Distribution Card
                        anomalyDonutCard
                        
                        // Confidence Breakdown Card
                        confidenceBreakdownCard
                    }
                    
                    // AI Forensic Narrative Report Box
                    forensicReportCard
                    
                    // Model Filter Pills
                    filterStrip
                    
                    // Categorized Anomaly Cards
                    VStack(spacing: 14) {
                        ForEach(filteredAnomalies) { item in
                            anomalyCardView(item: item)
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
                            Image(systemName: "brain.head.profile")
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .font(.system(size: 18))
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text("AI Multi-Model Anomaly Detection")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            
                            Text("ENSEMBLE INFERENCE ACTIVE")
                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                .tracking(1)
                                .foregroundColor(CopSightTheme.emerald)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(CopSightTheme.emerald.opacity(0.18))
                                .clipShape(Capsule())
                        }
                        
                        Text("XGBOOST CLASSIFIER · UNIVERSAL DNN · LSTM AUTOENCODER · ISOLATION FOREST")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .tracking(1)
                            .foregroundColor(.white.opacity(0.75))
                    }
                }
                
                Spacer()
                
                // Action Buttons
                HStack(spacing: 10) {
                    // Export JSON Report Button
                    Button(action: {}) {
                        HStack(spacing: 6) {
                            Image(systemName: "square.and.arrow.down")
                                .font(.system(size: 11))
                            Text("Export Report (JSON)")
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
                    
                    // Run Detection Button
                    Button(action: triggerRunDetection) {
                        HStack(spacing: 6) {
                            if isRunning {
                                ProgressView()
                                    .scaleEffect(0.7)
                                    .colorInvert()
                            } else {
                                Image(systemName: "bolt.fill")
                                    .font(.system(size: 11, weight: .bold))
                            }
                            Text(isRunning ? "Analyzing Bitstreams..." : "Run Detection")
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
                }
            }
            .padding(18)
        }
    }
    
    // MARK: - Graphical Donut Card
    
    private var anomalyDonutCard: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Image(systemName: "chart.pie.fill")
                        .foregroundColor(CopSightTheme.cyan)
                        .font(.system(size: 13))
                    Text("ANOMALY MODEL DISTRIBUTION")
                        .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.85))
                }
                
                HStack(spacing: 24) {
                    // Custom Donut Geometry
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.08), lineWidth: 16)
                            .frame(width: 85, height: 85)
                        
                        // Segments
                        Circle()
                            .trim(from: 0.0, to: 0.35)
                            .stroke(CopSightTheme.red, style: StrokeStyle(lineWidth: 16, lineCap: .butt))
                            .frame(width: 85, height: 85)
                            .rotationEffect(.degrees(-90))
                        
                        Circle()
                            .trim(from: 0.35, to: 0.70)
                            .stroke(Color(hex: "8b5cf6"), style: StrokeStyle(lineWidth: 16, lineCap: .butt))
                            .frame(width: 85, height: 85)
                            .rotationEffect(.degrees(-90))
                        
                        Circle()
                            .trim(from: 0.70, to: 0.85)
                            .stroke(CopSightTheme.cyan, style: StrokeStyle(lineWidth: 16, lineCap: .butt))
                            .frame(width: 85, height: 85)
                            .rotationEffect(.degrees(-90))
                        
                        Circle()
                            .trim(from: 0.85, to: 1.0)
                            .stroke(CopSightTheme.amber, style: StrokeStyle(lineWidth: 16, lineCap: .butt))
                            .frame(width: 85, height: 85)
                            .rotationEffect(.degrees(-90))
                        
                        Text("\(anomalies.count)")
                            .font(.system(size: 18, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                    }
                    .padding(.leading, 8)
                    
                    // Legend
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(modelDistribution, id: \.name) { item in
                            HStack(spacing: 8) {
                                Circle().fill(item.color).frame(width: 8, height: 8)
                                Text(item.name)
                                    .font(.system(size: 11.5, weight: .medium))
                                    .foregroundColor(.white.opacity(0.85))
                                Spacer()
                                Text("\(item.count)")
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                            }
                        }
                    }
                }
                .padding(6)
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - Confidence Breakdown Card
    
    private var confidenceBreakdownCard: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Image(systemName: "shield.lefthalf.filled")
                        .foregroundColor(CopSightTheme.emerald)
                        .font(.system(size: 13))
                    Text("CONFIDENCE BREAKDOWN RANKING")
                        .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.85))
                }
                
                VStack(spacing: 8) {
                    ForEach(anomalies.prefix(4)) { item in
                        HStack(spacing: 10) {
                            Text(item.formattedType)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.white.opacity(0.85))
                                .frame(width: 170, alignment: .leading)
                                .lineLimit(1)
                            
                            // Confidence Meter
                            GeometryReader { barGeo in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(Color.white.opacity(0.1))
                                    Capsule()
                                        .fill(
                                            item.confidence >= 0.9 ? CopSightTheme.red :
                                            item.confidence >= 0.8 ? CopSightTheme.amber : CopSightTheme.cyan
                                        )
                                        .frame(width: barGeo.size.width * item.confidence)
                                }
                            }
                            .frame(height: 6)
                            
                            Text("\(Int(item.confidence * 100))%")
                                .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                                .frame(width: 40, alignment: .trailing)
                        }
                    }
                }
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - Forensic Report Narrative Box
    
    private var forensicReportCard: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "doc.text.fill")
                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                        .font(.system(size: 13))
                    Text("AI FORENSIC EXECUTIVE SUMMARY (ENSEMBLE TRIAGE)")
                        .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.9))
                }
                
                Text("Multi-model forensic pipeline executed across all parsed UFDR database records. XGBoost classifier identified active R2L exfiltration packets directed at foreign IP 185.220.101.5. Universal DNN detected burner phone SIM rotation cascades coinciding with off-hour midnight encrypted chats. LSTM Autoencoder flagged a 72-hour sequence blackout. Recommended Action: Immediate evidentiary seizure of SIM hardware and cross-border IP preservation order.")
                    .font(.system(size: 12))
                    .lineSpacing(4)
                    .foregroundColor(.white.opacity(0.85))
            }
            .padding(18)
        }
    }
    
    // MARK: - Filter Strip
    
    private var filterStrip: some View {
        HStack(spacing: 8) {
            Text("FILTER BY MODEL:")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.6))
            
            ForEach(["All", "XGBoost", "DNN", "LSTM-AE", "Isolation Forest"], id: \.self) { model in
                let isSel = selectedModelFilter == model
                Button(action: { selectedModelFilter = model }) {
                    Text(model)
                        .font(.system(size: 10.5, weight: isSel ? .bold : .medium, design: .monospaced))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(isSel ? theme.primaryAccent(isDark: isDark) : theme.insetFill(isDark: isDark))
                        .foregroundColor(isSel ? theme.primaryAccentText(isDark: isDark) : .white.opacity(0.85))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
            }
            
            Spacer()
        }
        .padding(.horizontal, 4)
    }
    
    // MARK: - Anomaly Card View
    
    private func anomalyCardView(item: AnomalyItem) -> some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(alignment: .leading, spacing: 14) {
                // Header
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 8) {
                            Text(item.formattedType)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            
                            // Model Badge
                            Text(item.modelBadge)
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color(hex: "8b5cf6").opacity(0.2))
                                .foregroundColor(Color(hex: "c084fc"))
                                .clipShape(Capsule())
                            
                            if let cat = item.attackCategory {
                                Text(cat)
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(CopSightTheme.red.opacity(0.2))
                                    .foregroundColor(CopSightTheme.red)
                                    .clipShape(Capsule())
                            }
                        }
                        
                        Text(item.description)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.85))
                    }
                    
                    Spacer()
                    
                    // Confidence Pill
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("\(Int(item.confidence * 100))% CONFIDENCE")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(item.confidence >= 0.9 ? CopSightTheme.red : CopSightTheme.amber)
                        
                        // Mini Bar
                        GeometryReader { barGeo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.white.opacity(0.12))
                                Capsule()
                                    .fill(item.confidence >= 0.9 ? CopSightTheme.red : CopSightTheme.amber)
                                    .frame(width: barGeo.size.width * item.confidence)
                            }
                        }
                        .frame(width: 80, height: 6)
                    }
                }
                
                Divider().background(Color.white.opacity(0.12))
                
                // Forensic Metric Grid
                HStack(spacing: 16) {
                    if let hr = item.hour {
                        HStack(spacing: 4) {
                            Text("Time Window:")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.5))
                            Text(String(format: "%02d:00 UTC", hr))
                                .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                        }
                    }
                    
                    if let z = item.zScore {
                        HStack(spacing: 4) {
                            Text("Z-Score:")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.5))
                            Text(String(format: "%.2f σ", z))
                                .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                .foregroundColor(CopSightTheme.red)
                        }
                    }
                    
                    if let recon = item.reconstructionError, let th = item.threshold {
                        HStack(spacing: 4) {
                            Text("Recon Loss:")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.5))
                            Text(String(format: "%.2f (Th: %.2f)", recon, th))
                                .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                                .foregroundColor(CopSightTheme.cyan)
                        }
                    }
                    
                    Spacer()
                }
                
                // Detailed Attributes Table
                VStack(spacing: 6) {
                    ForEach(Array(item.recordDetails.sorted(by: { $0.key < $1.key })), id: \.key) { k, v in
                        HStack {
                            Text(k)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.white.opacity(0.6))
                            Spacer()
                            Text(v)
                                .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(8)
                    }
                }
            }
            .padding(18)
        }
    }
}

/// Subcomponent: Metric Card for Anomaly Summary
struct AnomalySummaryCard: View {
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
