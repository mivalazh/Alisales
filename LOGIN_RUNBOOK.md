# Login runbook

How an account signs in at launch, what each environment variable does, and the
one list you must not leave too wide. Written for whoever runs the site after
handover.

## The login paths

| Path | Needs | Who can use it |
| --- | --- | --- |
| **SMS code** (primary) | `SMS_IR_API_KEY` + `SMS_IR_TEMPLATE_ID`, or the generic `SMS_API_KEY` / `SMS_SENDER` / `SMS_API_URL` trio | Anyone with a phone that receives the message |
| **Instant OTP** (no gateway) | `INSTANT_OTP_ALLOWLIST` | Only the listed numbers, and only while no SMS provider is configured |
| **On-screen fallback** (automatic) | `INSTANT_OTP_ALLOWLIST` — no flag | Listed numbers, whenever a provider is configured but the code cannot be delivered: sandbox/unverified SMS.ir account, unapproved template, provider error or timeout. `POST /api/auth/otp` answers **200** with `fallbackCode`, and the OTP screen opens its six boxes on that code |

The on-screen fallback needs no switch. A number in `INSTANT_OTP_ALLOWLIST` gets
it whenever delivery fails; a number outside the list never does.

`/api/health` reports which paths are ready (`checks.login`, `checks.sms`,
`checks.instantOtp`, `checks.sandboxFallback`) and answers 503 when the login or
data path is not ready. In `checks.sandboxFallback`, `enabled` is only the legacy
flag (see below); `automatic` is the behaviour that ships — true when a provider
is configured and `allowlistCount` (also `checks.instantOtp.allowlistCount`) is
above zero. That state adds a warning: those numbers can sign in with an
on-screen code as soon as delivery fails.

## The recommendation: real SMS first

Configure the real template and verify one delivery end to end before launch:

1. In the SMS.ir panel, create/verify a Fast Verification template whose
   parameter is `CODE` (the app sends both `CODE` and `code`).
2. Set `SMS_IR_API_KEY` and `SMS_IR_TEMPLATE_ID`; remove any generic
   `SMS_API_*` values so the provider cannot resolve to the wrong adapter.
3. Deploy, then run `npm run auth:e2e -- --url=https://<host>` with a real
   Iranian number and enter the code that arrives.
4. Confirm `/api/health` shows `checks.sms.configured: true`, and that the
   fallback warning is gone because `INSTANT_OTP_ALLOWLIST` is empty.

With working delivery the fallback never triggers — keep the allowlist empty.

## Launch numbers and the account-takeover boundary

If the gateway cannot be verified before launch, list the launch numbers. They
get the on-screen code automatically when SMS.ir rejects the account as
sandbox/unverified, rejects the template, errors, or times out:

```bash
# .env / deployment secrets
INSTANT_OTP_ALLOWLIST=09121234567,09351234567
```

Nothing else is required, and no `ALLOW_SANDBOX_OTP_FALLBACK` value changes who
this covers.

**Warning — read before listing a number.** An on-screen code proves nothing
about who is holding the phone. Anyone who knows or claims a listed number can
sign in as that account — including an operator number with moderation rights.
Rules that keep this survivable:

- The allowlist is the only thing standing between the fallback and account
  takeover. Keep it to the smallest set of launch numbers, never a wildcard
  (there is no wildcard), and never an admin/moderation number if it can be
  avoided.
- The fallback does not help arbitrary users: an unlisted number is still
  refused (`403 INSTANT_OTP_NOT_ALLOWED` when no provider is configured, and no
  on-screen code when one is) and never receives a code it did not prove
  control of by SMS.
- Do not "temporarily" add numbers to unblock support tickets. Remove a number
  as soon as the person can receive real SMS.

## What `ALLOW_SANDBOX_OTP_FALLBACK` does now (legacy)

The variable is kept so older deployments still boot, but it no longer gates the
allowlisted on-screen fallback and should stay unset:

- In production it is redundant: it can only permit numbers that are already on
  `INSTANT_OTP_ALLOWLIST`, and unlisted numbers stay refused either way.
- Outside production it still lets any number use the on-screen code when a
  provider is configured — useful only for local debugging against a real
  gateway.
- `/api/health` still reports it as `checks.sandboxFallback.enabled` and adds a
  warning while it is on.

## Turning the fallback off

1. Empty `INSTANT_OTP_ALLOWLIST` (or remove the launch numbers) and redeploy.
   Ensure the legacy `ALLOW_SANDBOX_OTP_FALLBACK` is unset or `false`.
2. Confirm `/api/health` reports `sandboxFallback.allowlistCount: 0`, no
   fallback warning and no `warnings` entry.
3. Nothing is migrated: sessions already issued remain valid until they expire,
   so rotate `AUTH_SECRET` if those sessions must end immediately — that signs
   everyone out.

## Related switches

- `ALLOW_SANDBOX_OTP_FALLBACK` — legacy, described above; leave empty.
- `REQUIRE_HOSTED_SERVICES=true` forces strict hosted data in a non-production
  environment; production is already strict.
- `AUTH_SECRET` (≥16 characters) signs session cookies. A missing value disables
  sign-in rather than falling back to a known demo key.
- Development without credentials logs the code and shows it on the OTP step;
  that behaviour never applies to a production build.
