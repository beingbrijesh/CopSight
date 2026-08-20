import SwiftUI

/// Glass Panel — Signature ForensixD / CopSight frosted glass card.
/// Features a multi-stop glossy specular gradient, chamfered top-edge highlight strokeBorder,
/// and atmospheric dual-depth shadows while guaranteeing 100% text legibility.
struct GlassPanel<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    let cornerRadius: CGFloat
    let isHighlighted: Bool
    let content: Content
    
    init(
        cornerRadius: CGFloat = CopSightTheme.panelRadius,
        isHighlighted: Bool = false,
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.isHighlighted = isHighlighted
        self.content = content()
    }
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        content
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            stops: isDark ? [
                                .init(color: Color.white.opacity(isHighlighted ? 0.16 : 0.12), location: 0.0),
                                .init(color: Color.white.opacity(isHighlighted ? 0.08 : 0.04), location: 0.45),
                                .init(color: Color.white.opacity(isHighlighted ? 0.04 : 0.02), location: 1.0)
                            ] : [
                                .init(color: Color.white.opacity(isHighlighted ? 0.32 : 0.24), location: 0.0),
                                .init(color: Color.white.opacity(isHighlighted ? 0.18 : 0.12), location: 1.0)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(
                        isHighlighted
                            ? AnyShapeStyle(theme.primaryAccent(isDark: isDark).opacity(isDark ? 0.95 : 1.0))
                            : AnyShapeStyle(
                                LinearGradient(
                                    stops: isDark ? [
                                        .init(color: Color.white.opacity(0.36), location: 0.0),
                                        .init(color: Color.white.opacity(0.16), location: 0.35),
                                        .init(color: Color.white.opacity(0.07), location: 1.0)
                                    ] : [
                                        .init(color: Color.white.opacity(0.45), location: 0.0),
                                        .init(color: Color.white.opacity(0.18), location: 1.0)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            ),
                        lineWidth: isHighlighted ? 1.5 : 1.0
                    )
            )
            .shadow(
                color: isDark ? Color.black.opacity(isHighlighted ? 0.65 : 0.50) : Color.black.opacity(0.12),
                radius: isDark ? (isHighlighted ? 32 : 28) : 18,
                y: isDark ? 10 : 5
            )
            .shadow(
                color: isDark ? (isHighlighted ? Color.white.opacity(0.12) : Color.black.opacity(0.25)) : Color.clear,
                radius: isHighlighted ? 8 : 4,
                y: 2
            )
    }
}
