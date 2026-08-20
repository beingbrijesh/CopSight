import SwiftUI
import AppKit

/// Ultra-Thin Overlay Scroller for Native macOS ScrollViews
/// Replaces the default 16px thick macOS scrollbar with a sleek 4px thin floating bar
/// positioned cleanly inside the right margin without taking layout width.
final class ThinOverlayScroller: NSScroller {
    override class var isCompatibleWithOverlayScrollers: Bool {
        return true
    }
    
    override class func scrollerWidth(for controlSize: NSControl.ControlSize, scrollerStyle: NSScroller.Style) -> CGFloat {
        return 6.0
    }
    
    override func drawKnobSlot(in rect: NSRect, highlight: Bool) {
        // Purely transparent slot - does not occlude or consume space
    }
    
    override func drawKnob() {
        let knobRect = self.rect(for: .knob)
        guard knobRect.height > 0 else { return }
        
        // 4px thin rounded capsule floating in the right margin
        let thinWidth: CGFloat = 4.0
        let thinRect = NSRect(
            x: knobRect.origin.x + max(0, knobRect.width - thinWidth),
            y: knobRect.origin.y,
            width: thinWidth,
            height: max(16.0, knobRect.height)
        )
        
        let path = NSBezierPath(roundedRect: thinRect, xRadius: 2.0, yRadius: 2.0)
        NSColor.white.withAlphaComponent(0.35).setFill()
        path.fill()
    }
}

/// NSViewRepresentable that attaches the ThinOverlayScroller to any enclosing NSScrollView
struct ThinScrollConfigurator: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            configureScrollView(for: view)
        }
        return view
    }
    
    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            configureScrollView(for: nsView)
        }
    }
    
    private func configureScrollView(for view: NSView) {
        if let scrollView = view.enclosingScrollView {
            scrollView.scrollerStyle = .overlay
            if !(scrollView.verticalScroller is ThinOverlayScroller) {
                scrollView.verticalScroller = ThinOverlayScroller()
            }
            scrollView.autohidesScrollers = true
        }
    }
}

extension View {
    /// Applies an ultra-thin 4px floating scrollbar inside the right margin
    func thinScrollable() -> some View {
        self.background(ThinScrollConfigurator())
    }
}
