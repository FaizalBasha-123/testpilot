import requests
import json

key = "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"
model = "meta-llama/llama-3.2-3b-instruct:free"

print(f"Testing Model: {model}")

try:
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "BlackboxTester"
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": "hi"}]
        },
        timeout=20
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")
