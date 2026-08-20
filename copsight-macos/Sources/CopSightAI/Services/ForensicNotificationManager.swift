import SwiftUI
import UserNotifications

/// Forensic System Notification Event
struct ForensicNotificationEvent: Identifiable, Equatable {
    let id: String
    let timestamp: Date
    let title: String
    let subtitle: String
    let body: String
    let category: NotificationCategory
    let isRead: Bool
    
    enum NotificationCategory: String, CaseIterable {
        case acquisition = "Acquisition"
        case crossCase = "Cross-Case Match"
        case anomaly = "AI Anomaly"
        case custody = "Chain of Custody"
        case security = "Security / RBAC"
        
        var icon: String {
            switch self {
            case .acquisition: return "waveform.path.ecg"
            case .crossCase: return "link.badge.plus"
            case .anomaly: return "brain.head.profile"
            case .custody: return "lock.shield.fill"
            case .security: return "exclamationmark.shield.fill"
            }
        }
        
        var color: Color {
            switch self {
            case .acquisition: return CopSightTheme.emerald
            case .crossCase: return CopSightTheme.amber
            case .anomaly: return Color(hex: "a855f7")
            case .custody: return CopSightTheme.cyan
            case .security: return CopSightTheme.red
            }
        }
    }
}

/// Central Forensic Notification Manager wrapping macOS UserNotifications framework
@Observable
final class ForensicNotificationManager {
    static let shared = ForensicNotificationManager()
    
    var isAuthorized: Bool = false
    var notificationHistory: [ForensicNotificationEvent] = []
    
    init() {
        requestAuthorization()
        seedInitialNotifications()
    }
    
    // MARK: - Notification Permissions
    
    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                self.isAuthorized = granted
            }
        }
    }
    
    // MARK: - Dispatch Methods
    
    func sendAcquisitionCompleteNotification(deviceModel: String, caseNumber: String, sha256: String, artifactCount: Int) {
        let title = "Forensic Bitstream Acquired"
        let subtitle = "\(deviceModel) • \(caseNumber)"
        let body = "\(artifactCount) artifacts carved. SHA-256 Seal: \(sha256.prefix(16))... Verified."
        
        dispatchSystemNotification(title: title, subtitle: subtitle, body: body, category: .acquisition)
    }
    
    func sendCrossCaseMatchNotification(entityType: String, entityValue: String, matchingFIRs: [String]) {
        let title = "Critical Cross-Case Correlation"
        let subtitle = "Shared \(entityType): \(entityValue)"
        let body = "Spotted across FIRs: \(matchingFIRs.joined(separator: ", ")). Level 3+ clearance notified."
        
        dispatchSystemNotification(title: title, subtitle: subtitle, body: body, category: .crossCase)
    }
    
    func sendAnomalyAlertNotification(modelName: String, riskScore: Double, anomalySummary: String) {
        let title = "AI Anomaly Detected (\(Int(riskScore * 100))% Risk)"
        let subtitle = "\(modelName) Multi-Model Pipeline"
        let body = anomalySummary
        
        dispatchSystemNotification(title: title, subtitle: subtitle, body: body, category: .anomaly)
    }
    
    func sendChainOfCustodyAlert(evidenceTag: String, action: String, officerName: String) {
        let title = "Chain of Custody Event Logged"
        let subtitle = "Evidence: \(evidenceTag)"
        let body = "\(action) executed by \(officerName). Cryptographic signature validated."
        
        dispatchSystemNotification(title: title, subtitle: subtitle, body: body, category: .custody)
    }
    
    func postGenericNotification(title: String, subtitle: String = "", body: String) {
        dispatchSystemNotification(title: title, subtitle: subtitle, body: body, category: .custody)
    }
    
    // MARK: - Internal System Dispatch
    
    private func dispatchSystemNotification(title: String, subtitle: String, body: String, category: ForensicNotificationEvent.NotificationCategory) {
        // Record in internal audit history
        let event = ForensicNotificationEvent(
            id: UUID().uuidString,
            timestamp: Date(),
            title: title,
            subtitle: subtitle,
            body: body,
            category: category,
            isRead: false
        )
        
        DispatchQueue.main.async {
            self.notificationHistory.insert(event, at: 0)
        }
        
        // Post macOS native UserNotification
        let content = UNMutableNotificationContent()
        content.title = title
        content.subtitle = subtitle
        content.body = body
        content.sound = UNNotificationSound.default
        
        let request = UNNotificationRequest(
            identifier: event.id,
            content: content,
            trigger: nil // Deliver immediately
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Notification dispatch error: \(error.localizedDescription)")
            }
        }
    }
    
    private func seedInitialNotifications() {
        self.notificationHistory = [
            ForensicNotificationEvent(
                id: "notif-1",
                timestamp: Date().addingTimeInterval(-180),
                title: "Forensic Bitstream Acquired",
                subtitle: "Apple iPhone 15 Pro Max • OP-TANGO-24",
                body: "1,024 artifacts carved. SHA-256 Seal: 8F2A3C9E4B1D7091... Verified.",
                category: .acquisition,
                isRead: false
            ),
            ForensicNotificationEvent(
                id: "notif-2",
                timestamp: Date().addingTimeInterval(-1200),
                title: "Critical Cross-Case Correlation",
                subtitle: "Shared Crypto Wallet: 0x71C...392B",
                body: "Spotted across FIR-2026-8819 and FIR-2026-9042 with 3 overlapping escrow hops.",
                category: .crossCase,
                isRead: true
            ),
            ForensicNotificationEvent(
                id: "notif-3",
                timestamp: Date().addingTimeInterval(-3600),
                title: "Chain of Custody Transfer Verified",
                subtitle: "Evidence: EVD-2026-9042-01",
                body: "Physical transfer to Sealed Vault #4 authorized by Officer Brijesh.",
                category: .custody,
                isRead: true
            )
        ]
    }
}
