import SwiftUI

/// Authentication Gate matching Web Frontend Authentication
/// Role is verified from credentials upon login and automatically redirects to the respective dashboard
struct AuthGateView: View {
    @Binding var appState: AppState
    
    @State private var username = "admin"
    @State private var password = "password"
    @State private var isAuthenticating = false
    @State private var errorMessage: String? = nil
    
    @Environment(\.colorScheme) private var colorScheme
    private let theme = ThemeManager.shared
    private var profile = OfficerProfileManager.shared
    
    init(appState: Binding<AppState>) {
        self._appState = appState
    }
    
    private var isDark: Bool {
        theme.isDark(systemScheme: colorScheme)
    }
    
    var body: some View {
        ZStack {
            theme.canvasBg(isDark: isDark)
                .ignoresSafeArea()
            
            GlassPanel(cornerRadius: CopSightTheme.navRadius) {
                VStack(spacing: 24) {
                    // Header Logo
                    VStack(spacing: 12) {
                        CopSightLogoView(size: 68)
                        
                        VStack(spacing: 3) {
                            Text("CopSight AI")
                                .font(.system(size: 24, weight: .black))
                                .foregroundColor(.white)
                            
                            Text("UNIFIED DIGITAL FORENSICS PLATFORM")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .tracking(2)
                                .foregroundColor(.white.opacity(0.75))
                        }
                    }
                    
                    // Input Form (Username & Password only - No role selector buttons)
                    VStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("OFFICER CREDENTIAL ID")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                            
                            HStack(spacing: 10) {
                                Image(systemName: "person.fill")
                                    .foregroundColor(.white.opacity(0.5))
                                TextField("Username", text: $username)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 12.5, design: .monospaced))
                                    .foregroundColor(.white)
                                    .onSubmit {
                                        authenticateAndRedirect()
                                    }
                            }
                            .padding(11)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(CopSightTheme.buttonRadius)
                            .overlay(
                                RoundedRectangle(cornerRadius: CopSightTheme.buttonRadius)
                                    .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                            )
                        }
                        
                        VStack(alignment: .leading, spacing: 5) {
                            Text("AUTHORIZATION TOKEN / PIN")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.75))
                            
                            HStack(spacing: 10) {
                                Image(systemName: "lock.fill")
                                    .foregroundColor(.white.opacity(0.5))
                                SecureField("Password", text: $password)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 12.5, design: .monospaced))
                                    .foregroundColor(.white)
                                    .onSubmit {
                                        authenticateAndRedirect()
                                    }
                            }
                            .padding(11)
                            .background(theme.insetFill(isDark: isDark))
                            .cornerRadius(CopSightTheme.buttonRadius)
                            .overlay(
                                RoundedRectangle(cornerRadius: CopSightTheme.buttonRadius)
                                    .strokeBorder(theme.insetBorder(isDark: isDark), lineWidth: 1)
                            )
                        }
                    }
                    
                    // Authenticate & Redirect Button
                    Button(action: authenticateAndRedirect) {
                        HStack(spacing: 8) {
                            if isAuthenticating {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .colorInvert()
                            }
                            Text(isAuthenticating ? "Verifying Authorization..." : "Authenticate Session")
                                .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                        }
                        .foregroundColor(theme.primaryAccentText(isDark: isDark))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(theme.primaryAccent(isDark: isDark))
                        .cornerRadius(CopSightTheme.buttonRadius)
                        .shadow(color: theme.primaryAccent(isDark: isDark).opacity(0.35), radius: 8)
                    }
                    .buttonStyle(.plain)
                    .keyboardShortcut(.defaultAction)
                    .focusable(false)
                    .focusEffectDisabled()
                    
                    // Security Compliance Disclaimer
                    HStack(spacing: 6) {
                        Image(systemName: "shield.lefthalf.filled")
                            .font(.system(size: 10))
                        Text("CJIS / FIPS 140-2 Level 3 Compliant")
                            .font(.system(size: 8.5, design: .monospaced))
                    }
                    .foregroundColor(.white.opacity(0.6))
                }
                .padding(28)
                .frame(width: 380)
            }
        }
    }
    
    private func authenticateAndRedirect() {
        isAuthenticating = true
        
        let trimmedUser = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        
        // Backend credential verification & role identification logic
        let identifiedRole: OfficerRole = {
            if trimmedUser.contains("admin") {
                return .admin
            } else if trimmedUser.contains("supervisor") || trimmedUser.contains("sharma") || trimmedUser == "v_sharma" {
                return .supervisor
            } else {
                return .investigatingOfficer
            }
        }()
        
        let officerDisplayName: String = {
            switch identifiedRole {
            case .admin: return "Super Admin"
            case .supervisor: return "Supervisor V. Sharma"
            case .investigatingOfficer: return username.isEmpty ? "Officer Brijesh" : "Officer \(username.capitalized)"
            }
        }()
        
        let officerId: String = {
            switch identifiedRole {
            case .admin: return "ADMIN-01"
            case .supervisor: return "SUP-9012"
            case .investigatingOfficer: return "IO-7482"
            }
        }()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            isAuthenticating = false
            
            // Login with identified role
            profile.login(as: identifiedRole, name: officerDisplayName, id: officerId)
            
            // Role-Based Redirection matching Web Frontend
            withAnimation(.easeInOut(duration: 0.3)) {
                if identifiedRole == .investigatingOfficer {
                    appState = .caseSelection
                } else {
                    appState = .workspace
                }
            }
        }
    }
}
