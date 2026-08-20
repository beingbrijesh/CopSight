import SwiftUI
import AppKit

/// CopSight AI & ForensixD Official Brand Logo View
/// Matches the exact circular white element, padding, inner logo, subtle translucent white ring,
/// and soft shadow from the ForensixD macOS extractor app in native SwiftUI.
struct CopSightLogoView: View {
    let size: CGFloat
    
    init(size: CGFloat = 34) {
        self.size = size
    }
    
    private var logoImage: NSImage? {
        // 1. Check App Bundle resources
        if let bundleURL = Bundle.main.url(forResource: "logo", withExtension: "jpeg"),
           let img = NSImage(contentsOf: bundleURL) {
            return img
        }
        if let bundleURL = Bundle.main.url(forResource: "logo", withExtension: "png"),
           let img = NSImage(contentsOf: bundleURL) {
            return img
        }
        if let bundleURL = Bundle.main.url(forResource: "copsight_logo", withExtension: "png"),
           let img = NSImage(contentsOf: bundleURL) {
            return img
        }
        
        // 2. Direct fallback for local development & preview
        let sourceJpeg = "/Users/beingbrijesh/Desktop/Projects/UFDR/logo.jpeg"
        if FileManager.default.fileExists(atPath: sourceJpeg),
           let img = NSImage(contentsOfFile: sourceJpeg) {
            return img
        }
        
        let sourcePng = "/Users/beingbrijesh/Desktop/Projects/UFDR/copsight-macos/Sources/CopSightAI/Resources/logo.png"
        if FileManager.default.fileExists(atPath: sourcePng),
           let img = NSImage(contentsOfFile: sourcePng) {
            return img
        }
        
        return nil
    }
    
    var body: some View {
        ZStack {
            // 1. Pure White Circular Base with soft shadow
            Circle()
                .fill(Color.white)
                .shadow(color: Color.black.opacity(0.22), radius: max(2, size * 0.08), x: 0, y: max(1, size * 0.03))
            
            // 2. Official Circular Logo Image with matching proportional padding
            if let image = logoImage {
                Image(nsImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .clipShape(Circle())
                    .padding(max(1.5, size * 0.07))
            } else {
                Image(systemName: "shield.checkerboard")
                    .font(.system(size: size * 0.45, weight: .bold))
                    .foregroundColor(CopSightTheme.oceanBlue)
            }
        }
        .frame(width: size, height: size)
        .overlay(
            // 3. Subtle Translucent White Outer Ring (matching ring-4 ring-white/30)
            Circle()
                .strokeBorder(Color.white.opacity(0.35), lineWidth: max(1.5, size * 0.05))
        )
        .clipShape(Circle())
    }
}
