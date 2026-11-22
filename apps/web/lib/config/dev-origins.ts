/**
 * Dev-start warning for an un-allow-listed remote origin.
 *
 * Next blocks `/_next/hmr` and the other dev-only resources when a request's
 * origin is not in `allowedDevOrigins`. The page still renders — it is server
 * HTML — so the failure is silent until nothing on it responds: no assistant
 * orb, no theme switch, dead filter chips. That looks like an app bug, and it is
 * easy to reach because `next dev` listens on every interface by default while
 * `NEXT_DEV_ALLOWED_ORIGINS` is opt-in.
 *
 * The bind address is deliberately not part of this check: `next dev
 * --hostname 127.0.0.1` reaches the config loader without its flag, so a
 * hostname probe would warn on a loopback-only server and stay quiet on a
 * remote one — exactly backwards. The warning therefore states the default
 * exposure and lets a localhost-only developer ignore it.
 */

interface NetworkAddress {
  address: string;
  family: string | number;
  internal: boolean;
}

export type NetworkInterfaces = Record<string, readonly NetworkAddress[] | undefined>;

/** RFC 1918 + link-local: addresses that only exist on the local network. */
const PRIVATE_IPV4 = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
];

/**
 * This machine's private-network addresses, as `allowedDevOrigins` entries.
 *
 * A phone testing over Wi-Fi sends `Origin: http://192.168.x.y:3000` and is
 * blocked unless that hostname is allow-listed — so dev would serve HTML that
 * never hydrates, which is indistinguishable from a broken app. These hosts
 * cannot be reached from the public internet, so allowing them in development
 * is the same trust level as localhost.
 *
 * IPv4 only: the dev client a phone talks to is reached by the LAN IPv4
 * address, and an interface can change while the server runs, so this is read
 * once at startup.
 */
export function privateDevOrigins(interfaces: NetworkInterfaces): string[] {
  const hosts = new Set<string>();
  for (const addresses of Object.values(interfaces)) {
    for (const entry of addresses ?? []) {
      if (entry.internal) continue;
      if (entry.family !== 'IPv4' && entry.family !== 4) continue;
      if (!PRIVATE_IPV4.some((range) => range.test(entry.address))) continue;
      hosts.add(entry.address);
    }
  }
  return [...hosts].sort();
}

/**
 * The warning to print at dev start, or null when there is nothing to say.
 */
export function devOriginWarning(input: {
  dev: boolean;
  allowlist: string | undefined;
}): string | null {
  if (!input.dev) return null;
  if ((input.allowlist ?? '').trim()) return null;

  return [
    '[alisales] next dev has no NEXT_DEV_ALLOWED_ORIGINS allow-list.',
    "Localhost and this machine's private network addresses (10/8, 172.16/12,",
    '192.168/16, 169.254/16) are allowed automatically, so a phone on the same',
    'Wi-Fi can hydrate the app. Any other host — a tunnel, a cloud preview, a',
    'custom domain — is not: Next blocks /_next/hmr and the other dev resources',
    'there, the HTML renders but the page never hydrates, and the assistant orb,',
    'theme switch, filter chips and every other client effect stay dead (the dev',
    'log says "Blocked cross-origin request to Next.js dev resource").',
    'Set NEXT_DEV_ALLOWED_ORIGINS=<that exact host> (comma-separated) and restart',
    'to allow it.',
  ].join(' ');
}
