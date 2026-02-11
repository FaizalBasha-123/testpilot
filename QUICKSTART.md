# TestPilot - Quickstart Guide

Get the entire TestPilot backend running on your laptop with **a single command**.

## Prerequisites
1. **Docker Desktop** installed and running.
2. A free **Groq API Key** from [console.groq.com](https://console.groq.com).

## Setup in 1 Minute

### 1. Clone & Start
Open a terminal in the project root:

**Windows (PowerShell)**
```powershell
.\start.ps1
```

**Mac / Linux**
```bash
chmod +x start.sh && ./start.sh
```

**What happens?**
- Checks Docker status
- Creates `.env` and asks for your Groq API Key
- Starts **7 Docker containers** (AI Core, SonarQube, Postgres, Redis, etc.)
- Waits for SonarQube to be ready
- **Auto-generates** a SonarQube token for you

### 2. Configure VS Code
1. Open this folder in VS Code.
2. Install the **TestPilot** extension (if not already installed).
3. Go to **Settings** (`Cmd+,` or `Ctrl+,`) → Search for `TestPilot`.
4. Ensure **Backend URL** is set to:
   ```
   http://localhost:3001
   ```

### 3. Review a Commit
1. Go to the **Source Control** tab.
2. Click on a recent commit.
3. Click the **"Review Commit"** button in the sidebar.
4. Watch the AI analyze your code using your **local Docker stack**!

---

## Services Overview

| Service | URL | Usage |
|---------|-----|-------|
| **Gateway** | `http://localhost:3001` | Entry point for VS Code |
| **AI Core** | `http://localhost:3000` | The brain (LLM logic) |
| **SonarQube** | `http://localhost:9000` | Dashboard (admin/admin) |
| **Sonar Scanner** | `http://localhost:8001` | Internal scan service |

## Troubleshooting

- **"No Git Log received"**: Restart VS Code to ensure extension loaded the localhost URL.
- **SonarQube "Unhealthy"**: It takes ~2-3 mins to start. Wait a bit.
- **Stop everything**: Run `docker compose down`.
