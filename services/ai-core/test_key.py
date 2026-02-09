import requests
import json
import os

key = "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"

print(f"Testing Key: {key[:10]}...")

try:
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "BlackboxTester"
        },
        json={
            "model": "google/gemma-2-9b-it:free",
            "messages": [{"role": "user", "content": "Hello world"}]
        },
        timeout=10
    )
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
