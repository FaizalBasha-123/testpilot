import requests
import json

key = "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"
models = [
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-r1-distill-llama-70b:free",
    "google/gemini-2.0-flash-thinking-exp:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "sophosympatheia/midnight-rose-70b-v2.0.3:free",
    "nousresearch/hermes-3-llama-3.1-405b:free"
]

print(f"Testing Key: {key[:10]}...")
headers = {
    "Authorization": f"Bearer {key}",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "BlackboxTester"
}

for model in models:
    print(f"Testing {model}...")
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": "hi"}]
            },
            timeout=15
        )
        if resp.status_code == 200:
            print(f"SUCCESS: {model} WORKS!")
            break
        else:
            print(f"FAILED {model}: {resp.status_code}")
            try:
                print(f"Error: {resp.json().get('error', {}).get('message')}")
            except:
                print(f"Body: {resp.text[:100]}")
    except Exception as e:
        print(f"ERROR {model}: {e}")
