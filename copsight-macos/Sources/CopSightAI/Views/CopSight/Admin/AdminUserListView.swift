import SwiftUI

/// Full-Page User Management & Access Control View matching Web Frontend `/admin/users`
struct AdminUserListView: View {
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    @State private var profile = OfficerProfileManager.shared
    
    @State private var searchText = ""
    @State private var selectedRoleFilter = "All"
    @State private var isShowingAddUserModal = false
    @State private var editingUser: AdminUserModel? = nil
    @State private var resettingPasswordUser: AdminUserModel? = nil
    
    @State private var userList: [AdminUserModel] = [
        AdminUserModel(id: "usr-1", fullName: "Brijesh Sharma", username: "brijesh", email: "brijesh@copsight.local", role: .investigatingOfficer, badgeNumber: "IO-7482", unit: "Cyber Crime Unit", isActive: true),
        AdminUserModel(id: "usr-2", fullName: "V. Sharma", username: "v_sharma", email: "vsharma@copsight.local", role: .supervisor, badgeNumber: "SUP-9012", unit: "Forensic Command", isActive: true),
        AdminUserModel(id: "usr-3", fullName: "Super Admin", username: "admin", email: "admin@copsight.local", role: .admin, badgeNumber: "ADMIN-01", unit: "Station IT & SecOps", isActive: true),
        AdminUserModel(id: "usr-4", fullName: "M. Khan", username: "mkhan", email: "mkhan@copsight.local", role: .investigatingOfficer, badgeNumber: "IO-3912", unit: "Anti-Terror Squad", isActive: true),
        AdminUserModel(id: "usr-5", fullName: "Ananya Roy", username: "aroy", email: "aroy@copsight.local", role: .supervisor, badgeNumber: "SUP-4410", unit: "Financial Intelligence", isActive: true),
        AdminUserModel(id: "usr-6", fullName: "R. Deshmukh", username: "rdeshmukh", email: "rdeshmukh@copsight.local", role: .investigatingOfficer, badgeNumber: "IO-5120", unit: "Special Cell Cyber", isActive: true),
        AdminUserModel(id: "usr-7", fullName: "K. Patel", username: "kpatel", email: "kpatel@copsight.local", role: .investigatingOfficer, badgeNumber: "IO-8831", unit: "Narcotics Digital Taskforce", isActive: false)
    ]
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var filteredUsers: [AdminUserModel] {
        userList.filter { u in
            let matchesSearch = searchText.isEmpty ||
                u.fullName.localizedCaseInsensitiveContains(searchText) ||
                u.username.localizedCaseInsensitiveContains(searchText) ||
                u.email.localizedCaseInsensitiveContains(searchText) ||
                u.badgeNumber.localizedCaseInsensitiveContains(searchText) ||
                u.unit.localizedCaseInsensitiveContains(searchText)
            
            let matchesRole: Bool = {
                switch selectedRoleFilter {
                case "All": return true
                case "Administrator": return u.role == .admin
                case "Supervisor": return u.role == .supervisor
                case "Investigating Officer": return u.role == .investigatingOfficer
                default: return true
                }
            }()
            
            return matchesSearch && matchesRole
        }
    }
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                // Header & Action Bar
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("System User Accounts & Clearances")
                            .font(.system(size: 28, weight: .light))
                            .foregroundColor(.white)
                        Text("MANAGE FORENSIC EXAMINERS, SUPERVISORS, AND ADMINISTRATIVE PERSONNEL")
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .tracking(2)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    
                    Spacer()
                    
                    Button(action: { isShowingAddUserModal = true }) {
                        HStack(spacing: 8) {
                            Image(systemName: "person.badge.plus")
                            Text("Add System User")
                        }
                        .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(theme.primaryAccent(isDark: isDark))
                        .cornerRadius(100)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
                
                // Filter & Search Controls
                GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                    HStack(spacing: 16) {
                        // Search bar
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.white.opacity(0.6))
                            TextField("Search users by name, username, email, badge...", text: $searchText)
                                .textFieldStyle(.plain)
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(theme.insetFill(isDark: isDark))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                        )
                        
                        // Role Filter Pills
                        HStack(spacing: 8) {
                            ForEach(["All", "Administrator", "Supervisor", "Investigating Officer"], id: \.self) { roleName in
                                let isSelected = selectedRoleFilter == roleName
                                Button(action: { selectedRoleFilter = roleName }) {
                                    Text(roleName)
                                        .font(.system(size: 10.5, weight: isSelected ? .bold : .medium, design: .monospaced))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 7)
                                        .background(isSelected
                                            ? theme.primaryAccent(isDark: isDark)
                                            : theme.insetFill(isDark: isDark)
                                        )
                                        .foregroundColor(isSelected
                                            ? theme.primaryAccentText(isDark: isDark)
                                            : .white.opacity(0.8)
                                        )
                                        .cornerRadius(100)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 100)
                                                .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                    .padding(16)
                }
                
                // Users Table View
                GlassPanel(cornerRadius: CopSightTheme.panelRadius) {
                    VStack(spacing: 0) {
                        // Table Header
                        HStack {
                            Text("USER")
                                .frame(width: 220, alignment: .leading)
                            Text("ROLE & CLEARANCE")
                                .frame(width: 180, alignment: .leading)
                            Text("BADGE ID")
                                .frame(width: 110, alignment: .leading)
                            Text("ASSIGNED UNIT")
                                .frame(minWidth: 160, alignment: .leading)
                            Text("STATUS")
                                .frame(width: 100, alignment: .leading)
                            Spacer()
                            Text("ACTIONS")
                                .frame(width: 110, alignment: .trailing)
                        }
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.6))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 14)
                        .background(Color.black.opacity(0.2))
                        
                        Divider().background(Color.white.opacity(0.1))
                        
                        // Table Rows
                        if filteredUsers.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "person.slash")
                                    .font(.system(size: 28))
                                    .foregroundColor(.white.opacity(0.4))
                                Text("No system users match the search criteria.")
                                    .font(.system(size: 13))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            .padding(40)
                            .frame(maxWidth: .infinity)
                        } else {
                            VStack(spacing: 0) {
                                ForEach(Array(filteredUsers.enumerated()), id: \.element.id) { index, user in
                                    UserTableRow(
                                        user: user,
                                        isDark: isDark,
                                        onEdit: { editingUser = user },
                                        onResetPassword: { resettingPasswordUser = user },
                                        onToggleStatus: { toggleUserStatus(userId: user.id) }
                                    )
                                    
                                    if index < filteredUsers.count - 1 {
                                        Divider().background(Color.white.opacity(0.06))
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 60)
            .thinScrollable()
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $isShowingAddUserModal) {
            AddUserModalView(onAdd: { newUser in
                userList.append(newUser)
                isShowingAddUserModal = false
            })
        }
        .sheet(item: $editingUser) { user in
            EditUserModalView(user: user, onSave: { updatedUser in
                if let idx = userList.firstIndex(where: { $0.id == updatedUser.id }) {
                    userList[idx] = updatedUser
                }
                editingUser = nil
            })
        }
        .sheet(item: $resettingPasswordUser) { user in
            ResetPasswordModalView(user: user, onComplete: {
                resettingPasswordUser = nil
            })
        }
    }
    
    private func toggleUserStatus(userId: String) {
        if let idx = userList.firstIndex(where: { $0.id == userId }) {
            userList[idx].isActive.toggle()
        }
    }
}

// MARK: - User Table Row

struct UserTableRow: View {
    let user: AdminUserModel
    let isDark: Bool
    let onEdit: () -> Void
    let onResetPassword: () -> Void
    let onToggleStatus: () -> Void
    
    @State private var isHovering = false
    
    var body: some View {
        HStack {
            // User Avatar & Name
            HStack(spacing: 12) {
                Circle()
                    .fill(user.role.badgeColor.opacity(0.2))
                    .frame(width: 34, height: 34)
                    .overlay(
                        Image(systemName: user.role.icon)
                            .foregroundColor(user.role.badgeColor)
                            .font(.system(size: 13))
                    )
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.fullName)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundColor(.white)
                    Text("@\(user.username) • \(user.email)")
                        .font(.system(size: 9.5))
                        .foregroundColor(.white.opacity(0.65))
                }
            }
            .frame(width: 220, alignment: .leading)
            
            // Role Badge
            HStack(spacing: 6) {
                Circle().fill(user.role.badgeColor).frame(width: 6, height: 6)
                Text(user.role.title.uppercased())
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(user.role.badgeColor)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(user.role.badgeColor.opacity(0.15))
            .cornerRadius(6)
            .frame(width: 180, alignment: .leading)
            
            // Badge ID
            Text(user.badgeNumber)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.white.opacity(0.8))
                .frame(width: 110, alignment: .leading)
            
            // Unit
            Text(user.unit)
                .font(.system(size: 11))
                .foregroundColor(.white.opacity(0.75))
                .frame(minWidth: 160, alignment: .leading)
            
            // Status Pill
            HStack(spacing: 4) {
                Circle()
                    .fill(user.isActive ? CopSightTheme.emerald : CopSightTheme.red)
                    .frame(width: 6, height: 6)
                Text(user.isActive ? "ACTIVE" : "DISABLED")
                    .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                    .foregroundColor(user.isActive ? CopSightTheme.emerald : CopSightTheme.red)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background((user.isActive ? CopSightTheme.emerald : CopSightTheme.red).opacity(0.12))
            .cornerRadius(4)
            .frame(width: 100, alignment: .leading)
            
            Spacer()
            
            // Action Buttons
            HStack(spacing: 6) {
                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.8))
                        .padding(6)
                        .background(Color.white.opacity(0.08))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .help("Edit User Profile")
                
                Button(action: onResetPassword) {
                    Image(systemName: "key.fill")
                        .font(.system(size: 11))
                        .foregroundColor(CopSightTheme.amber)
                        .padding(6)
                        .background(CopSightTheme.amber.opacity(0.15))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .help("Reset Password & Key")
                
                Button(action: onToggleStatus) {
                    Image(systemName: user.isActive ? "lock.fill" : "lock.open.fill")
                        .font(.system(size: 11))
                        .foregroundColor(user.isActive ? CopSightTheme.red : CopSightTheme.emerald)
                        .padding(6)
                        .background((user.isActive ? CopSightTheme.red : CopSightTheme.emerald).opacity(0.15))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .focusable(false)
                .focusEffectDisabled()
                .help(user.isActive ? "Disable User Account" : "Activate User Account")
            }
            .frame(width: 110, alignment: .trailing)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(isHovering ? Color.white.opacity(0.04) : Color.clear)
        .onHover { h in isHovering = h }
    }
}

// MARK: - Modals

struct AddUserModalView: View {
    let onAdd: (AdminUserModel) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var fullName = ""
    @State private var username = ""
    @State private var email = ""
    @State private var badgeNumber = ""
    @State private var unit = "Cyber Crime Unit"
    @State private var selectedRole: OfficerRole = .investigatingOfficer
    
    private var isDark: Bool { theme.isDark(systemScheme: colorScheme) }
    
    var body: some View {
        ZStack {
            theme.canvasBg(isDark: isDark).ignoresSafeArea()
            
            VStack(spacing: 20) {
                HStack {
                    Text("Add New System User")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
                
                VStack(spacing: 12) {
                    ModalFormField(label: "FULL NAME", placeholder: "e.g. Inspector Rajesh Kumar", text: $fullName)
                    ModalFormField(label: "USERNAME", placeholder: "e.g. rkumar", text: $username)
                    ModalFormField(label: "EMAIL ADDRESS", placeholder: "e.g. rkumar@copsight.local", text: $email)
                    ModalFormField(label: "BADGE NUMBER", placeholder: "e.g. IO-9921", text: $badgeNumber)
                    ModalFormField(label: "ASSIGNED UNIT / SQUAD", placeholder: "e.g. Special Cyber Cell", text: $unit)
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("SECURITY ROLE & CLEARANCE")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.75))
                        
                        HStack(spacing: 8) {
                            ForEach(OfficerRole.allCases) { r in
                                let isSel = selectedRole == r
                                Button(action: { selectedRole = r }) {
                                    Text(r.title)
                                        .font(.system(size: 10, weight: isSel ? .bold : .medium, design: .monospaced))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(isSel ? r.badgeColor.opacity(0.3) : Color.white.opacity(0.06))
                                        .foregroundColor(isSel ? Color.white : .white.opacity(0.7))
                                        .cornerRadius(8)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .strokeBorder(isSel ? r.badgeColor : Color.clear, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                }
                
                HStack(spacing: 12) {
                    Button(action: { dismiss() }) {
                        Text("Cancel")
                            .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.8))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 9)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                    
                    Spacer()
                    
                    Button(action: {
                        let newUser = AdminUserModel(
                            id: "usr-\(UUID().uuidString.prefix(6))",
                            fullName: fullName.isEmpty ? "New Officer" : fullName,
                            username: username.isEmpty ? "officer" : username,
                            email: email.isEmpty ? "officer@copsight.local" : email,
                            role: selectedRole,
                            badgeNumber: badgeNumber.isEmpty ? "IO-0000" : badgeNumber,
                            unit: unit.isEmpty ? "Cyber Crime Unit" : unit,
                            isActive: true
                        )
                        onAdd(newUser)
                    }) {
                        Text("Create User Account")
                            .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                            .foregroundColor(theme.primaryAccentText(isDark: isDark))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 9)
                            .background(theme.primaryAccent(isDark: isDark))
                            .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
            }
            .padding(24)
            .frame(width: 440)
        }
    }
}

struct EditUserModalView: View {
    let user: AdminUserModel
    let onSave: (AdminUserModel) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var fullName: String
    @State private var email: String
    @State private var badgeNumber: String
    @State private var unit: String
    @State private var selectedRole: OfficerRole
    @State private var isActive: Bool
    
    init(user: AdminUserModel, onSave: @escaping (AdminUserModel) -> Void) {
        self.user = user
        self.onSave = onSave
        _fullName = State(initialValue: user.fullName)
        _email = State(initialValue: user.email)
        _badgeNumber = State(initialValue: user.badgeNumber)
        _unit = State(initialValue: user.unit)
        _selectedRole = State(initialValue: user.role)
        _isActive = State(initialValue: user.isActive)
    }
    
    private var isDark: Bool { theme.isDark(systemScheme: colorScheme) }
    
    var body: some View {
        ZStack {
            theme.canvasBg(isDark: isDark).ignoresSafeArea()
            
            VStack(spacing: 20) {
                HStack {
                    Text("Edit User Profile: @\(user.username)")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
                
                VStack(spacing: 12) {
                    ModalFormField(label: "FULL NAME", placeholder: "Full Name", text: $fullName)
                    ModalFormField(label: "EMAIL ADDRESS", placeholder: "Email", text: $email)
                    ModalFormField(label: "BADGE NUMBER", placeholder: "Badge ID", text: $badgeNumber)
                    ModalFormField(label: "ASSIGNED UNIT", placeholder: "Unit", text: $unit)
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("SECURITY ROLE & CLEARANCE")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.75))
                        
                        HStack(spacing: 8) {
                            ForEach(OfficerRole.allCases) { r in
                                let isSel = selectedRole == r
                                Button(action: { selectedRole = r }) {
                                    Text(r.title)
                                        .font(.system(size: 10, weight: isSel ? .bold : .medium, design: .monospaced))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(isSel ? r.badgeColor.opacity(0.3) : Color.white.opacity(0.06))
                                        .foregroundColor(isSel ? Color.white : .white.opacity(0.7))
                                        .cornerRadius(8)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .strokeBorder(isSel ? r.badgeColor : Color.clear, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                                .focusable(false)
                                .focusEffectDisabled()
                            }
                        }
                    }
                }
                
                HStack(spacing: 12) {
                    Button(action: { dismiss() }) {
                        Text("Cancel")
                            .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.8))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 9)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                    
                    Spacer()
                    
                    Button(action: {
                        var updated = user
                        updated.fullName = fullName
                        updated.email = email
                        updated.badgeNumber = badgeNumber
                        updated.unit = unit
                        updated.role = selectedRole
                        updated.isActive = isActive
                        onSave(updated)
                    }) {
                        Text("Save Changes")
                            .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                            .foregroundColor(theme.primaryAccentText(isDark: isDark))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 9)
                            .background(theme.primaryAccent(isDark: isDark))
                            .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
            }
            .padding(24)
            .frame(width: 440)
        }
    }
}

struct ResetPasswordModalView: View {
    let user: AdminUserModel
    let onComplete: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isSuccess = false
    
    private var isDark: Bool { theme.isDark(systemScheme: colorScheme) }
    
    var body: some View {
        ZStack {
            theme.canvasBg(isDark: isDark).ignoresSafeArea()
            
            VStack(spacing: 20) {
                HStack {
                    Text("Reset Password: @\(user.username)")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                    .focusable(false)
                    .focusEffectDisabled()
                }
                
                if isSuccess {
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.shield.fill")
                            .font(.system(size: 32))
                            .foregroundColor(CopSightTheme.emerald)
                        Text("Password & Token Reset Successfully")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .padding(30)
                } else {
                    VStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("NEW PASSWORD")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                            SecureField("Enter new password...", text: $newPassword)
                                .textFieldStyle(.plain)
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(.white)
                                .padding(10)
                                .background(theme.insetFill(isDark: isDark))
                                .cornerRadius(8)
                                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1))
                        }
                        
                        VStack(alignment: .leading, spacing: 5) {
                            Text("CONFIRM PASSWORD")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                            SecureField("Confirm new password...", text: $confirmPassword)
                                .textFieldStyle(.plain)
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(.white)
                                .padding(10)
                                .background(theme.insetFill(isDark: isDark))
                                .cornerRadius(8)
                                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1))
                        }
                    }
                    
                    HStack(spacing: 12) {
                        Button(action: { dismiss() }) {
                            Text("Cancel")
                                .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.8))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 9)
                                .background(Color.white.opacity(0.1))
                                .cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                        
                        Spacer()
                        
                        Button(action: {
                            isSuccess = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                                onComplete()
                            }
                        }) {
                            Text("Update Token")
                                .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                .foregroundColor(theme.primaryAccentText(isDark: isDark))
                                .padding(.horizontal, 18)
                                .padding(.vertical, 9)
                                .background(theme.primaryAccent(isDark: isDark))
                                .cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .focusEffectDisabled()
                    }
                }
            }
            .padding(24)
            .frame(width: 400)
        }
    }
}

struct ModalFormField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    private var isDark: Bool { theme.isDark(systemScheme: colorScheme) }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.75))
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(.white)
                .padding(10)
                .background(theme.insetFill(isDark: isDark))
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1))
        }
    }
}
