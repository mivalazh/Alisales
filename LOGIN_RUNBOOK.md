# Login runbook

How an account signs in at launch, what each environment variable does, and the
one switch you must not leave on. Written for whoever runs the site after
handover.

## The three login paths

| Path | Needs | Who can use it |
| --- | --- | --- |
| **SMS code** (primary) | `SMS_IR_API_KEY` + `SMS_IR_TEMPLATE_ID`, or the generic `SMS_API_KEY` / `SMS_SENDER` / `SMS_API_URL` trio | Anyone with a phone that receives the message |
| **Instant OTP** (no gateway) | `INSTANT_OTP_ALLOWLIST` | Only the listed numbers, and only while no SMS provider is configured |
| **Sandbox fallback** (opt-in) | `ALLOW_SANDBOX_OTP_FALLBACK=true` **and** `INSTANT_OTP_ALLOWLIST` | Listed numbers, only when the gateway is configured but rejects the account as sandbox/unverified |

`/api/health` reports which paths are ready (`checks.login`, `checks.sms`,
`checks.instantOtp`, `checks.sandboxFallback`) and answers 503 when no login path
exists at all. A healthy launch shows `login.ok: true` and
`sandboxFallback.enabled: false`.

## The recommendation: real SMS first

Configure the real template and verify one delivery end to end before launch:

1. In the SMS.ir panel, create/verify a Fast Verification template whose
   parameter is `CODE` (the app sends both `CODE` and `code`).
2. Set `SMS_IR_API_KEY` and `SMS_IR_TEMPLATE_ID`; remove any generic
   `SMS_API_*` values so the provider cannot resolve to the wrong adapter.
3. Deploy, then run `npm run auth:e2e -- --url=https://<host>` with a real
   Iranian number and enter the code that arrives.
4. Confirm `/api/health` shows `checks.sms.configured: true` and
   `checks.sandboxFallback.enabled: false`.

With a working template the fallback is unnecessary — leave it off.

## If the gateway cannot be verified before launch

`ALLOW_SANDBOX_OTP_FALLBACK=true` is the only way to let a listed number finish
sign-in when SMS.ir answers with a sandbox/unverified-account rejection. It is a
deliberate, named switch, never a default:

```bash
# .env / deployment secrets
ALLOW_SANDBOX_OTP_FALLBACK=true
INSTANT_OTP_ALLOWLIST=09121234567,09351234567
```

**Warning — read before enabling.** An on-screen code proves nothing about who
is holding the phone. Anyone who knows or claims a listed number can sign in as
that account, including an operator number with moderation rights. Rules that
keep this survivable:

- The allowlist is the only thing standing between this flag and account
  takeover. Keep it to the smallest set of launch numbers, never a wildcard
  (there is no wildcard), and never an admin/moderation number if it can be
  avoided.
- The flag does not help arbitrary users: an unlisted number still gets 403.
  Do not "temporarily" add numbers to unblock support tickets.
- Treat the flag as a launch-day bandage with an expiry date, not a login path.

## Turning it off

1. Remove `ALLOW_SANDBOX_OTP_FALLBACK` (or set it to `false`) and redeploy.
2. Confirm `/api/health` reports `sandboxFallback.enabled: false` and no
   `warnings` entry.
3. Nothing is migrated: sessions already issued remain valid until they expire,
   so rotate `AUTH_SECRET` if those sessions must end immediately — that signs
   everyone out.

## Related switches

- `REQUIRE_HOSTED_SERVICES=true` forces strict hosted data in a non-production
  environment; production is already strict.
- `AUTH_SECRET` (≥16 characters) signs session cookies. A missing value disables
  sign-in rather than falling back to a known demo key.
- Development without credentials logs the code and shows it on the OTP step;
  that behaviour never applies to a production build.
