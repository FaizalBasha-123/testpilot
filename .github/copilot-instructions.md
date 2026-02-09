# TestPilot - Copilot Instructions

## Architecture Overview (v2 - Enterprise)

```
services/
├── gateway/           # Go HTTP Gateway (auth, webhooks, routing)
├── sonar-scanner/     # Rust Static Analysis (SonarQube CLI)
└── ai-core/           # Python AI Engine
    ├── engines/       # Prompt pipelines, orchestration
    ├── context/       # Cross-file reasoning, code graph
    ├── adapters/      # Model adapters (OpenAI, Anthropic, Groq)
    ├── tools/         # Bug finder, fixer, reviewer
    ├── providers/     # GitHub, GitLab, Bitbucket integrations
    ├── api/           # FastAPI endpoints (IDE, PR)
    └── models/        # Data models (findings, fixes)
```

## Key Files (ai-core)

| File | Purpose | Lines |
|------|---------|-------|
| `engines/orchestrator.py` | Parallel AI + Sonar execution | 531 |
| `context/code_graph.py` | Tree-sitter dependency tracking | 704 |
| `tools/fix_generator.py` | One-click applicable fixes | 591 |
| `adapters/litellm_ai_handler.py` | Multi-LLM support | 464 |
| `api/ide_router.py` | VS Code/JetBrains API | 1175 |

## Development Setup

### Start All Services
```bash
docker-compose up -d
```

### Run VS Code Extension
```bash
cd clients/vscode && npm install && code --extensionDevelopmentPath=.
```
Press `F5` to launch Extension Development Host.

## Service Ports
- **SonarQube:** http://localhost:9000
- **AI Core:** http://localhost:3000
- **Gateway:** http://localhost:3001
- **Sonar Scanner:** http://localhost:8001

## CodeRabbit Pillars Mapping
| Pillar | Implementation |
|--------|----------------|
| AI Review Engine | `engines/orchestrator.py` |
| Context Handling | `context/code_graph.py` |
| Model Adapters | `adapters/litellm_ai_handler.py` |
