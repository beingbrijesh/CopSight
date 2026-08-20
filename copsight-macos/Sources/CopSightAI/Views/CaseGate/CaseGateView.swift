import SwiftUI

struct CaseGateView: View {
    @State private var searchText = ""
    @State private var cases: [ForensicCase] = [
        ForensicCase(
            id: UUID().uuidString,
            title: "Cross-Border Cyber Fraud & Money Laundering",
            caseNumber: "OP-TANGO-24"
        ),
        ForensicCase(
            id: UUID().uuidString,
            title: "Encrypted Messaging Extortion Network",
            caseNumber: "FIR-2026-08-1847"
        ),
        ForensicCase(
            id: UUID().uuidString,
            title: "Digital Device Bitstream Acquisition",
            caseNumber: "OP-DELTA-19"
        )
    ]
    
    @Binding var appState: AppState
    
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var filteredCases: [ForensicCase] {
        cases.filter { c in
            searchText.isEmpty ||
            c.title.localizedCaseInsensitiveContains(searchText) ||
            c.caseNumber.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    var body: some View {
        ZStack {
            theme.canvasBg(isDark: isDark)
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Top Floating Navbar
                headerBar
                    .padding(.top, 24)
                    .padding(.horizontal, 20)
                
                // Content Area
                VStack(spacing: 20) {
                    HStack(alignment: .center) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Active Case Selection")
                                .font(.system(size: 26, weight: .light))
                                .foregroundColor(.white)
                            
                            Text("STAGE 2: AUTHORIZED INVESTIGATOR")
                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                .tracking(2)
                                .foregroundColor(CopSightTheme.emerald)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 3)
                                .background(CopSightTheme.emerald.opacity(0.2))
                                .cornerRadius(100)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 100)
                                        .strokeBorder(CopSightTheme.emerald.opacity(0.35), lineWidth: 1)
                                )
                        }
                        
                        Spacer()
                        
                        // Search Bar
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.white.opacity(0.5))
                            TextField("Search cases by FIR, title...", text: $searchText)
                                .textFieldStyle(.plain)
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(CopSightTheme.buttonRadius)
                        .overlay(
                            RoundedRectangle(cornerRadius: CopSightTheme.buttonRadius)
                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                        )
                        .frame(width: 280)
                    }
                    
                    // Case Grid (Scrollbar completely hidden)
                    ScrollView(.vertical, showsIndicators: false) {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 300, maximum: 460), spacing: 20)], spacing: 20) {
                            ForEach(filteredCases) { c in
                                Button(action: {
                                    withAnimation(.easeInOut(duration: 0.3)) {
                                        appState = .workspace
                                    }
                                }) {
                                    CaseCard(caseItem: c)
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                        .padding(.horizontal, 2)
                        .padding(.vertical, 8)
                        .thinScrollable()
                    }
                    .scrollIndicators(.hidden)
                }
                .padding(.top, 16)
                .padding(.horizontal, 20)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    private var headerBar: some View {
        GlassPanel(cornerRadius: CopSightTheme.navRadius) {
            HStack {
                // Official Product Brand Logo
                HStack(spacing: 12) {
                    CopSightLogoView(size: 36)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CopSight AI")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)
                        Text("Forensic OS")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .tracking(1)
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
                
                Spacer()
                
                // Integrated Profile & Settings Menu Button
                OfficerProfileMenuButton(
                    onOpenSettings: {
                        WindowManager.shared.openStationSettings()
                    },
                    onSwitchCase: { },
                    onLockSession: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            appState = .auth
                        }
                    }
                )
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .frame(height: 68)
    }
}

struct ForensicCase: Identifiable {
    let id: String
    let title: String
    let caseNumber: String
}

struct CaseCard: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let caseItem: ForensicCase
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
                            Image(systemName: "folder.fill")
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .font(.system(size: 16))
                        )
                    
                    Spacer()
                    
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundColor(isHovering ? theme.primaryAccent(isDark: isDark) : .white.opacity(0.4))
                        .font(.system(size: 18))
                }
                
                VStack(alignment: .leading, spacing: 3) {
                    Text(caseItem.caseNumber)
                        .font(.system(size: 13.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                    
                    Text(caseItem.title)
                        .font(.system(size: 12.5))
                        .foregroundColor(.white.opacity(0.85))
                        .lineLimit(2)
                }
            }
            .padding(20)
        }
        .frame(height: 140)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovering = hovering
            }
        }
    }
}
