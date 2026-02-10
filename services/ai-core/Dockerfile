# ===================================================================
# AI Core Service - Dockerfile (API-Only, No PyTorch/TensorFlow)
# ===================================================================
FROM python:3.11-slim

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
# Note: sentence-transformers and lancedb have been REMOVED
# This service now uses ONLY cloud LLM APIs (Groq, OpenAI, Anthropic, etc.)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run the application
CMD ["uvicorn", "pr_agent.servers.github_app:app", "--host", "0.0.0.0", "--port", "3000"]
