# Local Runbook (Render Gateway Canonical)

This setup keeps **Render gateway** as the single public gateway and runs heavy services locally in Docker.

## One command

```powershell
powershell -ExecutionPolicy Bypass -File .\start_local_stack.ps1
```

This starts:
- `postgres`
- `redis`
- `qdrant`
- `sonarqube`
- `sonar-scanner`
- `ai-core`

It intentionally does **not** start local gateway and does **not** start tunnels.

## Hardcoded Tunnel Mode (friend laptop)

If your tunnels are already running and Render gateway already points to them:

```powershell
powershell -ExecutionPolicy Bypass -File .\lock_existing_tunnels.ps1
```

This generates:
- `tunnel.lock.env` (hardcoded tunnel + render gateway values)
- `TUNNEL_MODE_STATUS.md` (reachability report)
- `.vscode/settings.json` with `testpilot.backendUrl` pinned to `https://testpilot-64v5.onrender.com`

## Required assumptions

1. Render gateway remains `https://testpilot-64v5.onrender.com`.
2. Render gateway envs for tunneled services are already set and valid.
3. VS Code extension backend is Render gateway (`testpilot.backendUrl`).

## Frontend hostable env

Use this in frontend hosting/local frontend runtime:

```env
NEXT_PUBLIC_BACKEND_URL=https://testpilot-64v5.onrender.com
```

## Output file

Startup writes `runtime.md` with resolved runtime targets and health state.

## If you need local-only tunnel refresh

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\start_tunnels.ps1
```

Then update Render envs and redeploy gateway.
