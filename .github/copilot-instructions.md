# TestPilot - AI-Native QA & Security Orchestration 🚀
**Copilot Context & Instructions**

## 1. Project Philosophy & Architecture
**TestPilot** is an enterprise-grade, AI-powered static analysis platform that orchestrates SonarQube with LLMs (Groq/OpenAI) to provide auto-fixes for code issues.

### Core Principles
- **No Mocks:** All logic must be real. We implement actual file processing, AST parsing, and AI calls.
- **Microservices:** Decoupled architecture for scalability and free-tier optimization.
- **Hybrid Cloud:** `Gateway` runs on Cloud (Render), while heavy services (`AI Core`, `SonarQube`) run Locally/On-Prem via **Cloudflare Tunnels**.
- **Forever Free Strategy:** Leveraging free tiers (Groq, HuggingFace, Neon, Upstash) and local compute.

### System Components
| Service | Tech Stack | Role | Port |
|---------|------------|------|------|
| **Gateway** | Go (StdLib) | Public Entrypoint, Auth, Webhooks, Rate Limiting | 3001 |
| **AI Core** | Python (FastAPI) | Logic Engine, Context Builder, LLM Orchestration | 3000 |
| **Sonar Scanner** | Rust / Java | Worker for running SonarQube Scans (Heavy RAM) | 8001 |
| **SonarQube** | Java (Docker) | Static Analysis Server (Rules & Quality Gates) | 9000 |
| **Qdrant** | Rust (Docker) | Vector Database for Code Embeddings | 6333 |
| **Postgres** | SQL (Neon) | User Data, Credits, Chat History | 5432 |
| **Redis** | Redis (Upstash) | Job Queue, Caching | 6379 |

---

## 2. Codebase Structure & Key Logic

### A. AI Core (`services/ai-core`)
The "Brain" of the operation.
- **Context Engine (`context/code_graph.py`):**
    - Implements **CodeGraph v2** using `tree-sitter`.
    - Parses multi-language ASTs (Python, JS, TS, Go, Rust) to find dependencies (3 levels deep).
    - **Crucial:** Always check `CodeGraphBuilder` before inventing new parsing logic.
- **Orchestration (`engines/orchestrator.py`):**
    - Manages the flow: `Receive Repo -> Context Build -> Sonar Scan -> AI Review -> Fix Generation`.
- **Adapters (`adapters/`):**
    - `litellm_ai_handler.py`: Unified interface for Groq, OpenAI, Anthropic.
- **API (`api/ide_router.py`):**
    - `POST /review_repo_async`: Triggers background analysis job.
    - `GET /job_status/{id}`: Polling endpoint for VS Code.

### B. Gateway (`services/gateway`)
The "Shield".
- **Router (`main.go`):** Handles routing. Uses strictly standard library features where possible.
- **Scan API (`scan_api.go`):**
    - Receives ZIP uploads from VS Code.
    - **Proxies** to `AI Core`. It does NOT process files itself.
    - **Polling:** Checks `AI Core` status loop until completion.
    - **No Sleep:** Uses efficient polling with timeouts.

### C. VS Code Client (`clients/vscode`)
The "Face".
- **Frontend:** WebView-based UI (React/Vanilla JS via `webview-ui-toolkit`).
- **Adapter (`adapters/vscode`):** TypeScript logic that interfaces with VS Code APIs (Git, Editor, FileSystem).

---

## 3. Deployment & Environment Rules

### Hybrid Networking
- **Render:** Hosts `Gateway` and `AI Core` (optional).
- **Tunnels:** Used to connect Render Gateway to Local Services if running in Hybrid mode.
- **Environment Variables:**
    - `AI_CORE_URL`: Points to the Tunneled URL (e.g., `https://ai.testpilot.com`) or Internal Docker URL.
    - `SONAR_SERVICE_URL`: Points to the Scanner service.
    - `QDRANT_URL`: Points to Qdrant (http://qdrant:6333).

### Current Codebase State (Must Follow)
- **Gateway is canonical on Render:** `https://testpilot-64v5.onrender.com`
- **Do not reintroduce localhost gateway fallbacks** in frontend or env examples.
- **Baseline Verification:** If Local Gateway cannot talk to Local AI Core (404/hang), treat local wiring as broken.
- **Previous Hybrid Shortcut:** `AI_CORE_URL` swap to a tunnel was enough after local wiring worked.
- **Current blocker history:** 404/hang was observed inside local Docker network.
- **Agent rule now:** keep gateway-facing URLs Render-first; use env overrides only when explicitly requested.
- **VS Code extension default backend URL is Render gateway** (`testpilot.backendUrl` default points to Render).
- **Commit review must use real backend jobs** (`/api/v1/ide/review_repo_async` + `/api/v1/ide/job_status/{id}`), not mock heuristics.
- **Background context prep starts on extension activation** and surfaces live progress in sidebar header text.

### Vector Database
- We use **Qdrant** (Docker) for embeddings.
- **Do not use** SQLite or in-memory vector stores unless strictly for unit tests.

---

## 4. Coding Guidelines for Copilot
1.  **Honesty First:** Do not generate mock data or "fake" implementations. If logic is missing, implement it using standard libraries or existing patterns.
2.  **Context Aware:** When modifying `ai-core`, always consider the `CodeGraph` impact.
3.  **Type Safety:** Use strict typing in Python (`typing.List`, `pydantic`) and Go (`structs`).
4.  **Docker Compatibility:** All new services must have a `Dockerfile` and entry in `docker-compose.yml`.
5.  **Aesthetics:** UI code (VS Code WebView) must use modern, "Premium" aesthetics (Dark Mode, Glassmorphism, Tailwind-like utility classes).

---

## 5. Common Commands
- **Start Stack:** `docker-compose up --build -d`
- **Setup Tunnels:** `./setup-tunnels.sh`
- **Rebuild AI Core:** `docker-compose build ai-core && docker-compose up -d ai-core`
