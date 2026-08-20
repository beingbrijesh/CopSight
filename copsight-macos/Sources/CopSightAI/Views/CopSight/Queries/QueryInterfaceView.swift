import SwiftUI

struct QueryInterfaceView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var queryText = ""
    @State private var isProcessing = false
    @FocusState private var isFieldFocused: Bool
    
    struct ChatMessage: Identifiable {
        let id = UUID()
        let isAI: Bool
        let content: String
        let timestamp: String
        let confidenceScore: Double?
        let sources: [String]?
    }
    
    @State private var messages: [ChatMessage] = [
        ChatMessage(
            isAI: true,
            content: "Hello Officer Brijesh. CopSight AI Natural Language Assistant is ready. You can query extracted evidence across chat databases, call records, financial transactions, and cryptographic manifests for OP-TANGO-24.",
            timestamp: "09:40 AM",
            confidenceScore: nil,
            sources: nil
        ),
        ChatMessage(
            isAI: false,
            content: "Summarize all communications between suspect 'Target' and unknown contact discussing transaction deposits.",
            timestamp: "09:41 AM",
            confidenceScore: nil,
            sources: nil
        ),
        ChatMessage(
            isAI: true,
            content: "Identified 3 encrypted WhatsApp exchanges in `msgstore.db` between Target (+1-555-019-2831) and +44-7700-900142. They explicitly mention escrow deposit tranches totaling $42,000 USD to a Tron (TRC-20) address.",
            timestamp: "09:41 AM",
            confidenceScore: 0.98,
            sources: ["msgstore.db.crypt15:table/messages", "contacts.vcf", "DFXML_manifest_v1.2"]
        )
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
            VStack(spacing: 0) {
                // Header Bar (Full Width Integrated)
                HStack(spacing: 12) {
                    Circle()
                        .fill(theme.iconCircleBg(isDark: isDark))
                        .frame(width: 38, height: 38)
                        .overlay(
                            Image(systemName: "sparkles")
                                .foregroundColor(theme.primaryAccent(isDark: isDark))
                                .font(.system(size: 16))
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("AI Natural Language Forensic Analyst")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                        Text("SEMANTIC EVIDENCE INTERROGATION (LOCAL LLM RAG PIPELINE)")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .tracking(1)
                            .foregroundColor(.white.opacity(0.75))
                    }
                    
                    Spacer()
                    
                    HStack(spacing: 6) {
                        Circle().fill(CopSightTheme.emerald).frame(width: 7, height: 7)
                        Text("Vector DB Indexed (8,130 Nodes)")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(CopSightTheme.emerald)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(CopSightTheme.emerald.opacity(0.2))
                    .cornerRadius(100)
                    .overlay(
                        RoundedRectangle(cornerRadius: 100)
                            .strokeBorder(CopSightTheme.emerald.opacity(0.35), lineWidth: 1)
                    )
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                
                Divider().background(Color.white.opacity(0.12))
                
                // Chat Message Stream (Expands to fill 100% available canvas)
                ScrollViewReader { proxy in
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(spacing: 16) {
                            ForEach(messages) { msg in
                                ChatMessageRow(message: msg)
                                    .id(msg.id)
                            }
                            
                            if isProcessing {
                                HStack(spacing: 10) {
                                    Circle()
                                        .fill(theme.iconCircleBg(isDark: isDark))
                                        .frame(width: 34, height: 34)
                                        .overlay(
                                            ProgressView()
                                                .scaleEffect(0.7)
                                                .colorInvert()
                                        )
                                    
                                    Text("CopSight AI is querying vector indexes and extracting timeline matches...")
                                        .font(.system(size: 12, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.75))
                                    
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(theme.insetFill(isDark: isDark))
                                .cornerRadius(10)
                            }
                        }
                        .padding(20)
                        .thinScrollable()
                    }
                    .scrollIndicators(.hidden)
                    .onChange(of: messages.count) {
                        if let lastId = messages.last?.id {
                            withAnimation {
                                proxy.scrollTo(lastId, anchor: .bottom)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                
                Divider().background(Color.white.opacity(0.12))
                
                // Input Bar with Blinking Caret & Focus
                HStack(spacing: 12) {
                    Image(systemName: "sparkle.magnifyingglass")
                        .foregroundColor(theme.primaryAccent(isDark: isDark))
                        .font(.system(size: 16))
                    
                    TextField("Ask CopSight AI anything regarding the current case evidence...", text: $queryText)
                        .textFieldStyle(.plain)
                        .font(.system(size: 13))
                        .foregroundColor(.white)
                        .tint(isDark ? Color.white : CopSightTheme.coral)
                        .focused($isFieldFocused)
                        .onSubmit {
                            sendQuery()
                        }
                    
                    Button(action: sendQuery) {
                        HStack(spacing: 6) {
                            Text("Analyze")
                            Image(systemName: "arrow.up.circle.fill")
                        }
                        .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(queryText.trimmingCharacters(in: .whitespaces).isEmpty ? Color.white.opacity(0.2) : theme.primaryAccent(isDark: isDark))
                        .cornerRadius(100)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                    .disabled(queryText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(16)
                .background(theme.insetFill(isDark: isDark))
                .contentShape(Rectangle())
                .onTapGesture {
                    isFieldFocused = true
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: CopSightTheme.panelRadius, style: .continuous))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 2)
        .padding(.bottom, 20)
    }
    
    private func sendQuery() {
        guard !queryText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let userPrompt = queryText
        messages.append(ChatMessage(
            isAI: false,
            content: userPrompt,
            timestamp: "Just now",
            confidenceScore: nil,
            sources: nil
        ))
        queryText = ""
        
        isProcessing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            messages.append(ChatMessage(
                isAI: true,
                content: "Indexed forensic correlation complete for: '\(userPrompt)'. Analysis reveals 4 correlated timeline anomalies across Bluetooth pairing cache and WhatsApp metadata.",
                timestamp: "Just now",
                confidenceScore: 0.96,
                sources: ["bluetooth_cache.db", "msgstore.db.crypt15", "DFXML_manifest_v1.2"]
            ))
            isProcessing = false
        }
    }
}

struct ChatMessageRow: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let message: QueryInterfaceView.ChatMessage
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            if message.isAI {
                Circle()
                    .fill(theme.iconCircleBg(isDark: isDark))
                    .frame(width: 36, height: 36)
                    .overlay(
                        Image(systemName: "sparkles")
                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                            .font(.system(size: 15))
                    )
            } else {
                Circle()
                    .fill(Color.white.opacity(0.12))
                    .frame(width: 36, height: 36)
                    .overlay(
                        Image(systemName: "person.fill")
                            .foregroundColor(.white)
                            .font(.system(size: 15))
                    )
            }
            
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(message.isAI ? "CopSight Intelligence Assistant" : "Officer Brijesh")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text(message.timestamp)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.white.opacity(0.6))
                    
                    if let score = message.confidenceScore {
                        HStack(spacing: 4) {
                            Circle().fill(CopSightTheme.emerald).frame(width: 5, height: 5)
                            Text("\(Int(score * 100))% AI Confidence")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundColor(CopSightTheme.emerald)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(CopSightTheme.emerald.opacity(0.15))
                        .cornerRadius(4)
                    }
                }
                
                Text(message.content)
                    .font(.system(size: 12.5))
                    .foregroundColor(.white.opacity(0.9))
                    .lineSpacing(4)
                
                if let sources = message.sources {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("EVIDENCE SOURCES CITATIONS:")
                            .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                            .foregroundColor(theme.primaryAccent(isDark: isDark))
                        
                        HStack(spacing: 6) {
                            ForEach(sources, id: \.self) { src in
                                HStack(spacing: 4) {
                                    Image(systemName: "doc.text.fill")
                                        .font(.system(size: 8.5))
                                    Text(src)
                                        .font(.system(size: 9, design: .monospaced))
                                }
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(Color.black.opacity(0.35))
                                .foregroundColor(.white.opacity(0.85))
                                .cornerRadius(4)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 4)
                                        .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
                                )
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            }
            .padding(14)
            .background(message.isAI ? theme.insetFill(isDark: isDark) : Color.white.opacity(0.06))
            .cornerRadius(CopSightTheme.panelRadius)
            .overlay(
                RoundedRectangle(cornerRadius: CopSightTheme.panelRadius)
                    .strokeBorder(message.isAI ? theme.insetBorder(isDark: isDark) : Color.white.opacity(0.12), lineWidth: 1)
            )
            
            Spacer(minLength: 40)
        }
    }
}
