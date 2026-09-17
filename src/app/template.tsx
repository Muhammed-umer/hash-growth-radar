/**
 * Re-mounted on every navigation, so each page fades in gently instead of
 * snapping into place. No animation for people who ask for less motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in motion-reduce:animate-none">{children}</div>;
}
