import { describe, expect, it } from 'vitest';
import { devOriginWarning, privateDevOrigins, type NetworkInterfaces } from './dev-origins';

const iface = (address: string, family: string | number = 'IPv4', internal = false) => ({
  address,
  family,
  internal,
});

describe('privateDevOrigins', () => {
  it('lists the machine private IPv4 addresses a phone would use', () => {
    const interfaces: NetworkInterfaces = {
      lo: [iface('127.0.0.1', 'IPv4', true)],
      eth0: [iface('192.168.1.24')],
      wlan0: [iface('10.0.0.7'), iface('fe80::1', 'IPv6')],
      tailscale0: [iface('172.20.4.9', 4)],
      usb: [iface('169.254.77.2')],
    };
    expect(privateDevOrigins(interfaces)).toEqual([
      '10.0.0.7',
      '169.254.77.2',
      '172.20.4.9',
      '192.168.1.24',
    ]);
  });

  it('ignores loopback, public addresses, IPv6 and empty interfaces', () => {
    const interfaces: NetworkInterfaces = {
      lo: [iface('127.0.0.1', 'IPv4', true)],
      eth0: [iface('8.8.8.8'), iface('172.32.0.1'), iface('192.169.0.1')],
      eth1: [iface('2001:db8::1', 'IPv6'), iface('fe80::1', 6)],
      down: undefined,
    };
    expect(privateDevOrigins(interfaces)).toEqual([]);
  });

  it('de-duplicates an address shared by two interfaces', () => {
    const interfaces: NetworkInterfaces = {
      a: [iface('192.168.0.5')],
      b: [iface('192.168.0.5')],
    };
    expect(privateDevOrigins(interfaces)).toEqual(['192.168.0.5']);
  });
});

describe('devOriginWarning', () => {
  it('names the symptom and the fix when dev has no allow-list', () => {
    const warning = devOriginWarning({ dev: true, allowlist: undefined }) ?? '';
    expect(warning).toContain('NEXT_DEV_ALLOWED_ORIGINS');
    expect(warning).toContain('/_next/hmr');
    expect(warning).toContain('never hydrates');
    expect(warning).toContain('assistant orb');
    expect(warning).toContain('private network addresses');
    expect(warning).toContain('tunnel');
  });

  it('treats a blank allow-list as unset', () => {
    expect(devOriginWarning({ dev: true, allowlist: '' })).not.toBeNull();
    expect(devOriginWarning({ dev: true, allowlist: '   ' })).not.toBeNull();
  });

  it('stays quiet once an allow-list is configured', () => {
    expect(devOriginWarning({ dev: true, allowlist: 'preview.example.com' })).toBeNull();
    expect(devOriginWarning({ dev: true, allowlist: 'a.example.com, b.example.com' })).toBeNull();
  });

  it('only speaks in development', () => {
    expect(devOriginWarning({ dev: false, allowlist: undefined })).toBeNull();
  });
});
