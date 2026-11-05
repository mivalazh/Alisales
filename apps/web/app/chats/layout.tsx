import type { ReactNode } from 'react';

/**
 * Chat screens sit on plain white in light mode.
 *
 * The cream page surface is right for a catalogue, but it tints the gaps
 * between message bubbles. The rule is shipped with this segment rather than
 * applied by a client effect, so the first paint is already white (no flash)
 * and the page stays correct even before hydration. Dark mode is untouched.
 */
export default function ChatsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`html:not([data-theme='dark']) body, :root:not([data-theme='dark']) body { background-color: #ffffff; }`}</style>
      {children}
    </>
  );
}
