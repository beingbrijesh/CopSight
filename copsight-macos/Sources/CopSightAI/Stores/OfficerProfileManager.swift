import SwiftUI

/// Forensic Security Role Definitions for Role-Based Access Control (RBAC)
/// Exactly mirroring the CopSight Web Frontend roles (`admin`, `investigating_officer`, `supervisor`)
enum OfficerRole: String, CaseIterable, Identifiable, Codable {
    case admin = "admin"
    case investigatingOfficer = "investigating_officer"
    case supervisor = "supervisor"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .admin: return "Administrator"
        case .investigatingOfficer: return "Investigating Officer"
        case .supervisor: return "Supervisor"
        }
    }
    
    var clearanceLevel: String {
        switch self {
        case .admin: return "LEVEL 5: ROOT ADMINISTRATOR"
        case .investigatingOfficer: return "LEVEL 3: LEAD INVESTIGATING OFFICER"
        case .supervisor: return "LEVEL 4: FORENSIC SUPERVISOR"
        }
    }
    
    var badgeColor: Color {
        switch self {
        case .admin: return Color(hex: "a855f7")
        case .investigatingOfficer: return CopSightTheme.skyBlue
        case .supervisor: return CopSightTheme.emerald
        }
    }
    
    var icon: String {
        switch self {
        case .admin: return "lock.shield.fill"
        case .investigatingOfficer: return "crosshair"
        case .supervisor: return "eye.fill"
        }
    }
    
    var description: String {
        switch self {
        case .admin: return "User accounts & role assignment, case allocation, system-wide telemetry, and live forensic audit stream."
        case .investigatingOfficer: return "Direct device acquisition, AI query analyst, entity network graph, cross-case intelligence, and case dossiers."
        case .supervisor: return "Case oversight, chain-of-custody verification, examiner activity logs, workload allocation, and compliance exports."
        }
    }
    
    var permissions: Set<ForensicPermission> {
        switch self {
        case .admin:
            return Set(ForensicPermission.allCases)
        case .investigatingOfficer:
            return [.deviceExtraction, .decryptionToolkit, .queryAnalyst, .viewAssignedCases, .crossCaseCorrelation, .anomalyAI, .exportUFDR, .networkGraph]
        case .supervisor:
            return [.deviceExtraction, .decryptionToolkit, .queryAnalyst, .viewAssignedCases, .crossCaseCorrelation, .anomalyAI, .exportUFDR, .networkGraph, .supervisorAudit, .caseReallocation, .sealVerification, .cjisExport]
        }
    }
}

/// Granular Forensic Capabilities for RBAC
enum ForensicPermission: String, CaseIterable, Codable {
    case deviceExtraction
    case decryptionToolkit
    case queryAnalyst
    case viewAssignedCases
    case crossCaseCorrelation
    case anomalyAI
    case networkGraph
    case exportUFDR
    case supervisorAudit
    case caseReallocation
    case sealVerification
    case cjisExport
    case userManagement
    case systemSettings
}

/// Profile Manager for Managing Local Officer Credentials, RBAC, and Authentication State
@Observable
final class OfficerProfileManager {
    static let shared = OfficerProfileManager()
    
    // Authenticated Officer Credentials (Identified at Login)
    var officerName: String {
        didSet {
            UserDefaults.standard.set(officerName, forKey: "copsight_officer_name")
        }
    }
    
    var avatarSymbol: String {
        didSet {
            UserDefaults.standard.set(avatarSymbol, forKey: "copsight_officer_avatar")
        }
    }
    
    var role: OfficerRole {
        didSet {
            UserDefaults.standard.set(role.rawValue, forKey: "copsight_officer_role")
        }
    }
    
    var officerId: String {
        didSet {
            UserDefaults.standard.set(officerId, forKey: "copsight_officer_id")
        }
    }
    
    let stationUnit: String = "CYBER-CRIME-UNIT-HQ"
    let activeCaseNumber: String = "OP-TANGO-24"
    
    var clearanceLevel: String {
        role.clearanceLevel
    }
    
    init() {
        let savedRole = UserDefaults.standard.string(forKey: "copsight_officer_role") ?? "investigating_officer"
        self.role = OfficerRole(rawValue: savedRole) ?? .investigatingOfficer
        self.officerName = UserDefaults.standard.string(forKey: "copsight_officer_name") ?? "Officer Brijesh"
        self.officerId = UserDefaults.standard.string(forKey: "copsight_officer_id") ?? "IO-7482"
        self.avatarSymbol = UserDefaults.standard.string(forKey: "copsight_officer_avatar") ?? "person.fill"
    }
    
    func login(as newRole: OfficerRole, name: String? = nil, id: String? = nil) {
        self.role = newRole
        if let name = name, !name.isEmpty {
            self.officerName = name
        } else {
            switch newRole {
            case .admin:
                self.officerName = "Super Admin"
            case .supervisor:
                self.officerName = "Supervisor Sharma"
            case .investigatingOfficer:
                self.officerName = "Officer Brijesh"
            }
        }
        
        if let id = id, !id.isEmpty {
            self.officerId = id
        } else {
            switch newRole {
            case .admin:
                self.officerId = "ADMIN-01"
            case .supervisor:
                self.officerId = "SUP-9012"
            case .investigatingOfficer:
                self.officerId = "IO-7482"
            }
        }
    }
    
    func updateName(_ newName: String) {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            self.officerName = trimmed
        }
    }
    
    func updateAvatar(_ newSymbol: String) {
        self.avatarSymbol = newSymbol
    }
    
    // MARK: - RBAC Permission Helpers
    
    func hasPermission(_ permission: ForensicPermission) -> Bool {
        role.permissions.contains(permission)
    }
    
    var isAdmin: Bool {
        role == .admin
    }
    
    var isSupervisor: Bool {
        role == .supervisor
    }
    
    var isIO: Bool {
        role == .investigatingOfficer
    }
    
    var canAccessSupervisorHub: Bool {
        hasPermission(.supervisorAudit)
    }
    
    var canManageWorkloads: Bool {
        hasPermission(.caseReallocation)
    }
    
    var canVerifySeals: Bool {
        hasPermission(.sealVerification)
    }
    
    var canExportAuditLogs: Bool {
        hasPermission(.cjisExport)
    }
    
    var canManageUsers: Bool {
        hasPermission(.userManagement)
    }
}
