import SwiftUI
import AppKit

/// CopSight AI & ForensixD Official Brand Logo View
/// Displays the official logo centered inside a pure white circular disc
/// surrounded by a dark grey circular boundary with proportional breathing space
/// matching the exact design specification.
struct CopSightLogoView: View {
    let size: CGFloat
    
    init(size: CGFloat = 34) {
        self.size = size
    }
    
    private var logoImage: NSImage? {
        // 1. Try bundle resource
        if let bundleURL = Bundle.main.url(forResource: "copsight_logo", withExtension: "png"),
           let img = NSImage(contentsOf: bundleURL) {
            return img
        }
        
        // 2. Try direct source path fallback
        let sourcePath = "/Users/beingbrijesh/Desktop/Projects/UFDR/copsight-macos/Sources/CopSightAI/Resources/copsight_logo.png"
        if FileManager.default.fileExists(atPath: sourcePath),
           let img = NSImage(contentsOfFile: sourcePath) {
            return img
        }
        
        // 3. Try Desktop Projects path fallback
        let desktopPath = "/Users/beingbrijesh/Desktop/Projects/copsight-logo.jpeg"
        if FileManager.default.fileExists(atPath: desktopPath),
           let img = NSImage(contentsOfFile: desktopPath) {
            return img
        }
        
        return nil
    }
    
    var body: some View {
        ZStack {
            // Pure White Circular Background
            Circle()
                .fill(Color.white)
                .frame(width: size, height: size)
            
            // Official Logo Artwork: Scaled to 73% of the badge diameter
            // providing clean breathing space around the shield nodes
            if let image = logoImage {
                Image(nsImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: size * 0.73, height: size * 0.73)
            } else {
                Image(systemName: "shield.checkerboard")
                    .font(.system(size: size * 0.45, weight: .bold))
                    .foregroundColor(CopSightTheme.oceanBlue)
            }
        }
        .frame(width: size, height: size)
        .overlay(
            // Dark grey circular boundary ring matching the reference screenshot
            Circle()
                .strokeBorder(Color(hex: "5C5C5C"), lineWidth: max(1.5, size * 0.055))
        )
    }
}
