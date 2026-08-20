import SwiftUI

enum ToastType {
    case info
    case success
    case warning
    case error
    
    var icon: String {
        switch self {
        case .info: return "info.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.octagon.fill"
        }
    }
    
    var iconColor: Color {
        switch self {
        case .info: return Color(hex: "38bdf8")
        case .success: return CopSightTheme.emerald
        case .warning: return CopSightTheme.amber
        case .error: return CopSightTheme.red
        }
    }
    
    var borderColor: Color {
        switch self {
        case .info: return Color.white.opacity(0.2)
        case .success: return CopSightTheme.emerald.opacity(0.4)
        case .warning: return CopSightTheme.amber.opacity(0.4)
        case .error: return CopSightTheme.red.opacity(0.4)
        }
    }
    
    var backgroundColor: Color {
        switch self {
        case .info: return Color(hex: "0f172a").opacity(0.95)
        case .success: return Color(hex: "0a1e12").opacity(0.95)
        case .warning: return Color(hex: "1e150a").opacity(0.95)
        case .error: return Color(hex: "1e0a0a").opacity(0.95)
        }
    }
}

struct ToastMessage: Identifiable {
    let id = UUID()
    let type: ToastType
    let title: String
    let message: String
}

struct ToastNotificationView: View {
    let toast: ToastMessage
    let onDismiss: () -> Void
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: toast.type.icon)
                .font(.system(size: 18))
                .foregroundColor(toast.type.iconColor)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(toast.title)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                Text(toast.message)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.white.opacity(0.8))
                    .lineLimit(2)
            }
            
            Spacer()
            
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.6))
            }
            .buttonStyle(.plain)
            .focusable(false)
            .focusEffectDisabled()
        }
        .padding(16)
        .frame(width: 360)
        .background(toast.type.backgroundColor)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(toast.type.borderColor, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.4), radius: 16, y: 8)
    }
}
