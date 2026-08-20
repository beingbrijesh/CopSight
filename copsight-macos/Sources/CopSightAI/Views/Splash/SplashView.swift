import SwiftUI

struct SplashView: View {
    @Binding var appState: AppState
    @Environment(\.colorScheme) var colorScheme
    @State private var opacity: Double = 0.0
    @State private var scale: CGFloat = 0.95
    
    var body: some View {
        ZStack {
            (colorScheme == .dark ? CopSightTheme.onyxBlack : CopSightTheme.oceanBlue)
                .ignoresSafeArea()
            
            VStack(spacing: 24) {
                // Official Product Logo
                CopSightLogoView(size: 100)
                    .shadow(color: .black.opacity(0.4), radius: 24, y: 12)
                
                VStack(spacing: 8) {
                    Text("CopSight AI")
                        .font(.system(size: 42, weight: .light, design: .default))
                        .tracking(-0.5)
                        .foregroundColor(.white)
                    
                    Text("UNIFIED FORENSIC PLATFORM")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .tracking(2)
                        .foregroundColor(.white.opacity(0.8))
                }
            }
            .opacity(opacity)
            .scaleEffect(scale)
            .onAppear {
                withAnimation(.easeOut(duration: 1.0)) {
                    opacity = 1.0
                    scale = 1.0
                }
                
                // Transition to AuthGate after 2.5 seconds
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                    withAnimation(.easeInOut(duration: 0.5)) {
                        appState = .auth
                    }
                }
            }
        }
    }
}
