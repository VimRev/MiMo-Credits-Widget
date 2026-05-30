# Hermes Fix Instructions: MiMo Credits WSL Auth

## Problem

Do not try to open Chrome inside WSL.

The widget runs on Windows, while the data service runs in WSL. After reboot, `start-mimo-widget.bat` starts the WSL service, but `/api/credits` returns MiMo upstream auth errors such as:

```json
{
  "detail": { "code": -1, "error": "HTTP Error 401: " },
  "usage": { "code": -1, "error": "HTTP Error 401: " },
  "balance": { "code": -1, "error": "HTTP Error 401: " }
}
```

This means the local service is reachable, but the MiMo upstream login/cookie/token is expired or unavailable.

## Required Direction

Chrome login must stay on Windows.

WSL service must not depend on opening Chrome in WSL. Implement one of these auth bridges:

1. Preferred: read Windows Chrome cookies from the Windows Chrome profile from WSL.
2. Fallback: support a manual cookie/token file in WSL, for example:

```bash
~/.config/mimo-credits/auth.env
```

with content like:

```bash
MIMO_COOKIE='...'
MIMO_AUTHORIZATION='...'
```

The Python service should load this file at startup if present.

## Service Behavior

The Python service should distinguish:

- local service startup failure
- MiMo authentication failure
- MiMo API schema/parse failure

For auth failure, return HTTP 200 from the local service with structured JSON:

```json
{
  "error": "AUTH_EXPIRED",
  "message": "MiMo login expired. Re-login in Windows Chrome and refresh cookie/token.",
  "detail": { "code": -1, "error": "HTTP Error 401: " },
  "usage": { "code": -1, "error": "HTTP Error 401: " },
  "balance": { "code": -1, "error": "HTTP Error 401: " }
}
```

Do not let the batch launcher mistake auth failure for service startup failure.

## Windows Launcher Context

The launcher is:

```bat
C:\Users\17866\Desktop\MiMo-Credits-Widget\start-mimo-widget.bat
```

It starts:

```bash
source ~/.hermes/hermes-agent/venv/bin/activate
exec python3 ~/mimo-credits-service.py
```

It checks:

```text
http://127.0.0.1:19220/api/credits
```

The launcher now writes WSL service logs to:

```text
%TEMP%\mimo-service.log
```

## Implementation Notes

- Do not use localhost if binding from Python; bind to `127.0.0.1`.
- Do not use IPv6-only binding.
- Keep the service port as `19220`.
- Keep CORS enabled for Electron.
- Avoid requiring GUI apps in WSL.
- If reading Windows Chrome cookies is implemented, handle Windows profile paths robustly:

```text
/mnt/c/Users/17866/AppData/Local/Google/Chrome/User Data/Default
/mnt/c/Users/17866/AppData/Local/Google/Chrome/User Data/Profile *
```

- If Chrome cookie decryption from WSL is not reliable, fall back to manual cookie/token export.

## Acceptance Criteria

1. User logs in to `platform.xiaomimimo.com` in Windows Chrome.
2. Running `start-mimo-widget.bat` starts the WSL service.
3. `curl http://127.0.0.1:19220/api/credits` returns valid `detail`, `usage`, and `balance` data without `code:-1`.
4. If auth expires, the widget displays an auth-expired message instead of fake zero values.
5. No step requires opening Chrome inside WSL.
