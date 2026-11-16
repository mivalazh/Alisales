import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOtpSms, smsConfigured } from '../apps/web/lib/auth/sms';

const ENV_KEYS = [
  'SMS_IR_API_KEY',
  'SMS_IR_TEMPLATE_ID',
  'SMS_API_KEY',
  'SMS_SENDER',
  'SMS_API_URL',
] as const;

const saved = new Map<string, string | undefined>();
const fetchMock = vi.fn();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
  vi.unstubAllGlobals();
});

describe('SMS.ir fast verification', () => {
  it('posts the verification template with both code parameter names', async () => {
    process.env.SMS_IR_API_KEY = 'sms-ir-key';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 1, data: { messageId: 42 } }), {
        status: 200,
      }),
    );

    const result = await sendOtpSms('09120000001', '123456');

    expect(result).toEqual({ delivered: true });
    expect(smsConfigured()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.sms.ir/v1/send/verify');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Accept: 'text/plain',
      'x-api-key': 'sms-ir-key',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      mobile: '09120000001',
      templateId: 100000,
      parameters: [
        { name: 'CODE', value: '123456' },
        { name: 'code', value: '123456' },
      ],
    });
  });

  it('uses a configured template id', async () => {
    process.env.SMS_IR_API_KEY = 'sms-ir-key';
    process.env.SMS_IR_TEMPLATE_ID = '987654';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 1, data: { messageId: 7 } }), {
        status: 200,
      }),
    );

    await sendOtpSms('09120000001', '654321');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).templateId).toBe(987654);
  });

  it('reports an unverified/sandbox account so the route can fall back', async () => {
    process.env.SMS_IR_API_KEY = 'sms-ir-key';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 0, message: 'حساب کاربری شما تایید نشده است' }),
        { status: 400 },
      ),
    );

    const result = await sendOtpSms('09120000001', '123456');

    expect(result).toEqual({ delivered: false, reason: 'sandbox' });
  });

  it('treats a bare legacy SMS_API_KEY as an SMS.ir key', async () => {
    process.env.SMS_API_KEY = 'legacy-key';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 1, data: { messageId: 9 } }), {
        status: 200,
      }),
    );

    const result = await sendOtpSms('09120000001', '123456');

    expect(result).toEqual({ delivered: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.sms.ir/v1/send/verify');
  });

  it('keeps the generic Kavenegar-style adapter when a generic URL is set', async () => {
    process.env.SMS_API_KEY = 'generic-key';
    process.env.SMS_SENDER = '1000';
    process.env.SMS_API_URL = 'https://sms.example/send';
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

    const result = await sendOtpSms('09120000001', '123456');

    expect(result).toEqual({ delivered: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://sms.example/send');
  });
});
