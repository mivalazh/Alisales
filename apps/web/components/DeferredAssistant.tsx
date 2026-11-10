'use client';

import dynamic from 'next/dynamic';

/** Keep the chat widget out of the initial bundle and off the server render. */
const AIAssistantWidget = dynamic(
  () => import('./AIAssistantWidget').then((module) => module.AIAssistantWidget),
  { ssr: false },
);

export function DeferredAssistant() {
  return <AIAssistantWidget />;
}
