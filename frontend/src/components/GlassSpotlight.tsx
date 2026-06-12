import { useThemeStore } from '../store/themeStore';

/**
 * iOS-style Glassmorphism Background
 * 
 * Instead of a spotlight that follows the cursor, iOS uses static, softly 
 * blurred ambient color blobs positioned across the viewport. The glass 
 * panels (with backdrop-blur) then naturally distort these colors, creating 
 * the signature frosted glass look.
 */
export const GlassSpotlight = () => {
  const { isDarkMode } = useThemeStore();

  if (!isDarkMode) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Top-left: deep indigo blob */}
      <div className="absolute -top-[200px] -left-[200px] w-[600px] h-[600px] rounded-full bg-indigo-600/[0.07] blur-[120px]" />
      
      {/* Top-right: subtle violet blob */}
      <div className="absolute -top-[100px] -right-[150px] w-[500px] h-[500px] rounded-full bg-violet-500/[0.06] blur-[120px]" />
      
      {/* Center: very faint blue blob */}
      <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full bg-blue-500/[0.04] blur-[120px]" />
      
      {/* Bottom-right: subtle cyan blob */}
      <div className="absolute -bottom-[150px] -right-[100px] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
      
      {/* Bottom-left: faint purple blob */}
      <div className="absolute -bottom-[200px] -left-[100px] w-[450px] h-[450px] rounded-full bg-purple-600/[0.05] blur-[120px]" />
    </div>
  );
};
