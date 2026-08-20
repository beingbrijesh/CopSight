# CopSight AI - Error & Issues Log

*Comprehensive record of all compiler errors, runtime issues, UI bugs, and their permanent resolutions.*

---

## 1. Swift Compilation & Scope Errors

### Issue 1.1: Missing `AppMode`, `CopSightTab`, `ForensixDTab` Enums
- **Symptoms**: `swift build` failed with `cannot find type 'AppMode' in scope`.
- **Root Cause**: During a refactoring pass of `WorkspaceView.swift`, the top-level enum declarations were omitted from the file header.
- **Resolution**: Re-introduced `AppMode`, `CopSightTab`, and `ForensixDTab` enums directly in `WorkspaceView.swift` with `String, CaseIterable, Identifiable`.
- **Status**: ✅ Resolved.

### Issue 1.2: Inaccessible Memberwise Initializers in SwiftUI Views
- **Symptoms**: `error: 'WorkspaceView' initializer is inaccessible due to 'private' protection level`.
- **Root Cause**: Adding `private var profile = OfficerProfileManager.shared` inside `WorkspaceView` made Swift synthesize a `private` memberwise initializer.
- **Resolution**: Added explicit public `init(appState: Binding<AppState>) { self._appState = appState }` to `WorkspaceView.swift`, `CaseGateView.swift`, and `OfficerProfileMenuButton.swift`.
- **Status**: ✅ Resolved.

### Issue 1.3: Unhandled SwiftPM Resource Files
- **Symptoms**: `warning: 'copsight-macos': found 1 file(s) which are unhandled; explicitly declare them as resources or exclude from the target`.
- **Root Cause**: Adding `copsight_logo.png` to `Sources/CopSightAI/Resources/` without updating `Package.swift`.
- **Resolution**: Added `resources: [.process("Resources")]` to `Package.swift` target definition.
- **Status**: ✅ Resolved.

---

## 2. macOS System & Bundle Packaging Issues

### Issue 2.1: Missing / Blank Dock Icon on macOS Launch
- **Symptoms**: Dock icon was blank white or defaulted to standard macOS generic executable icon.
- **Root Cause**:
  1. `CopSight AI.app/Contents/Resources/` did not contain an Apple `.icns` bundle (`AppIcon.icns`).
  2. `Info.plist` lacked `CFBundleIconFile` and `CFBundleIconName` entries.
- **Resolution**:
  1. Built a python script utilizing Pillow to generate high-DPI 1024x1024 white squircle canvas.
  2. Created complete iconset (16x16 up to 1024x1024 @2x) and generated `AppIcon.icns` using `sips` and `iconutil`.
  3. Updated `build_app.sh` to copy `AppIcon.icns` to `Contents/Resources/` and add `CFBundleIconFile` in `Info.plist`.
  4. Added runtime binding in `CopSightApp.swift` via `NSApplication.shared.applicationIconImage`.
- **Status**: ✅ Resolved.

### Issue 2.2: Transparent Dock Icon Background
- **Symptoms**: Dock icon background appeared transparent instead of solid white.
- **Root Cause**: Raw JPEG conversion without a solid white background fill.
- **Resolution**: Composited a solid white macOS squircle (`radius=220` at 1024x1024) under the logo artwork before generating `AppIcon.icns`.
- **Status**: ✅ Resolved.

---

## 3. UI Responsiveness, Layout & Component Issues

### Issue 3.1: Card Horizontal Cropping on Window Resize
- **Symptoms**: When resizing the window narrower, 3-column `HStack` card rows overflowed and got clipped on the right.
- **Root Cause**: Fixed `HStack(spacing: 18)` layouts without responsive breakpoint detection.
- **Resolution**:
  1. Wrapped views in `GeometryReader`.
  2. Defined dynamic breakpoint (`let isStacked = geo.size.width < 1050-1150`).
  3. Switched layout to `VStack(spacing: 20)` on compact widths so cards take 100% width and can be scrolled vertically with zero cropping.
  4. Used `LazyVGrid(columns: [GridItem(.adaptive(minimum: ...))])` on KPI and action launcher grids.
- **Status**: ✅ Resolved.

### Issue 3.2: Navbar Sub-Tabs Wrapping into Second Line
- **Symptoms**: Sub-navigation tabs wrapped or overflowed when the window was resized below ~1050px.
- **Root Cause**: Long tab titles forced the navbar beyond available width.
- **Resolution**: Implemented adaptive navigation tabs in `WorkspaceView.swift` that automatically collapse to compact icon-only pills with `.help(tab.title)` tooltips when window width is under 1050px, expanding to full icon+text on wider screens.
- **Status**: ✅ Resolved.

### Issue 3.3: Acquisition Wizard Options Hidden Behind ScrollView
- **Symptoms**: User had to scroll inside the Acquisition Wizard card to see all extraction options.
- **Root Cause**: Card height was constrained to `370pt` with an internal `ScrollView`.
- **Resolution**: Expanded card height to `500pt`, removed the internal `ScrollView`, and displayed all 3 extraction depths and 4 filter profiles simultaneously.
- **Status**: ✅ Resolved.

### Issue 3.4: Low Contrast Device Radar Scanning Beam
- **Symptoms**: Sweep beam was barely visible across Light and Dark themes.
- **Root Cause**: Conic gradient opacity was set to `0.38` without a distinct leading edge stroke.
- **Resolution**: Elevated sweep cone opacity to `85%`, added a glowing white leading edge radial line (`lineWidth: 2.0`), and heightened concentric ring contrast (`0.35` opacity).
- **Status**: ✅ Resolved.

### Issue 3.5: AI Query Input Bar Rectangular Corner Overflow
- **Symptoms**: Bottom corners of the input bar inside `QueryInterfaceView` showed rectangular grey edges instead of matching the 32pt continuous panel curvature.
- **Root Cause**: Inner `VStack` was not clipped to the outer `GlassPanel` corner radius.
- **Resolution**: Applied `.clipShape(RoundedRectangle(cornerRadius: CopSightTheme.panelRadius, style: .continuous))` to the inner container.
- **Status**: ✅ Resolved.

### Issue 3.6: Invisible Caret / Blinking Cursor in AI Query Chatbox
- **Symptoms**: Clicking the chatbox input did not show a visible blinking text cursor.
- **Root Cause**: Plain textfield style without explicit caret tint or focus binding in dark theme.
- **Resolution**: Added `@FocusState private var isFieldFocused: Bool`, `.focused($isFieldFocused)`, `.tint(...)`, and container `.onTapGesture { isFieldFocused = true }`.
- **Status**: ✅ Resolved.

### Issue 3.7: Inadequate / Non-Interactive Network Graph View
- **Symptoms**: The initial Network Graph was a static SceneKit placeholder with 3 spheres and no forensic interactivity.
- **Root Cause**: Placeholder implementation from initial scaffolding.
- **Resolution**: Re-engineered `NetworkGraphView.swift` into an interactive 2D canvas forensic graph with draggable nodes, relationship edges, encryption dash styles, filter pills, search bar, and live entity inspector sidebar.
- **Status**: ✅ Resolved.

### Issue 3.8: Navbar Mode Switcher & Profile Button Focus Ring (Blue Rectangle)
- **Symptoms**: On window launch or after closing the profile menu popover, a macOS system blue focus rectangle appeared around the mode switcher or other interactive controls.
- **Root Cause**: On macOS SwiftUI, buttons belong to the system key-view loop by default. When the window gains focus or a popover dismisses, AppKit auto-assigns keyboard focus to the next interactive button and renders the system accent color focus frame.
- **Resolution**:
  1. Applied `.focusEffectDisabled()` at the window root in `CopSightApp.swift` and `ContentView.swift`.
  2. Added `.focusable(false)` and `.focusEffectDisabled()` across all interactive buttons, cards, filter pills, and navigation tabs.
- **Status**: ✅ Resolved.

### Issue 3.9: Network Graph Canvas Overflow & Text Wrapping in Filter Pills
- **Symptoms**: Node circles and edges overflowed the canvas into the inspector sidebar, and filter pills wrapped characters vertically (`A\n l\n l`, `D\n e\n v\n i\n c\n e`) on compact windows.
- **Root Cause**:
  1. SwiftUI `GeometryReader` with transforms lacks automatic clipping, causing scaled nodes to bleed past view boundaries.
  2. Fixed string widths in filter pills forced horizontal squeezing and vertical character wrapping.
- **Resolution**:
  1. Added `.clipped()` and `.zIndex()` separation to `NetworkGraphView.swift`.
  2. Implemented adaptive SF Symbol icons on compact screens ($<960\text{px}$) and full text on wider screens, with `.lineLimit(1)` and `.fixedSize(horizontal: true, vertical: false)`.
- **Status**: ✅ Resolved.

### Issue 3.10: Mode Switching Stutter & Performance Overhead
- **Symptoms**: Switching between `CopSight` and `ForensixD` felt laggy and dropped frames.
- **Root Cause**: Full-window `withAnimation(.easeInOut(duration: 0.25))` forced SwiftUI to interpolate layout calculations frame-by-frame across all `NSVisualEffectView` glass panels, radar `TimelineView`s, and `Canvas` layers simultaneously.
- **Resolution**: Removed heavy `withAnimation` from mode state changes, added `.animation(nil, value: currentMode)` to the workspace content container, and isolated the spring animation strictly to the small capsule indicator pill.
- **Status**: ✅ Resolved.

