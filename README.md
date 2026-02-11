# TestPilot - Advanced AI Coding Agent

TestPilot is an intelligent coding assistant that integrates deeply with your development workflow. It catches bugs, generates fixes, and automates pull requests using advanced AI models.

## 🚀 Key Features
- **AI-Powered Code Review:** Automated PR reviews finding bugs, security issues, and performance bottlenecks.
- **Auto-Fix Generation:** One-click fixes for identified issues.
- **Semantic Code Search:** Understands your codebase context using vector embeddings.
- **SonarQube Integration:** Combines static analysis with LLM reasoning.
- **VS Code Extension:** Real-time feedback and assistance directly in your editor.

## 🛠️ Architecture
- **Gateway (Go):** Central API gateway, authentication, and GitHub webhook handling.
- **AI Core (Python):** Intelligent engine using LangChain, LiteLLM, and Qdrant.
- **Sonar Scanner (Rust):** High-performance static analysis runner.
- **Dashboard (Next.js):** Web interface for monitoring active reviews and repo stats.

## 📦 Deployment

For detailed deployment instructions, please see [DEPLOYMENT.md](DEPLOYMENT.md).
For laptop shipping with local Docker backends and Render gateway, see [RUNBOOK_LOCAL_WITH_RENDER_GATEWAY.md](RUNBOOK_LOCAL_WITH_RENDER_GATEWAY.md).

### Quick Start (Render + Vercel)
1. **Fork** this repository.
2. **Deploy Gateway & AI Core** to [Render](https://render.com).
3. **Deploy Dashboard** to [Vercel](https://vercel.com).
4. **Configure Secrets** using `.env.example` as a template.

## 🔒 Security
This project uses GitHub Secret Scanning to prevent credential leaks.
- API keys and secrets are managed via environment variables.
- Git history is sanitized to remove accidental commits of `.env` files.

## 📄 License
MIT License
