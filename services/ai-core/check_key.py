import requests
import json

key = "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"

print(f"Checking Key Status: {key[:10]}...")

try:
    # 1. Check Auth Endpoint (No Cost)
    resp = requests.get(
        "https://openrouter.ai/api/v1/auth/key",
        headers={"Authorization": f"Bearer {key}"},
        timeout=10
    )
    
    print(f"Auth Status Code: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json().get('data', {})
        print("✅ Key is VALID")
        print(f"Label: {data.get('label')}")
        print(f"Limit: {data.get('limit')}")
        print(f"Usage: {data.get('usage')}")
        # Note: 'usage' might allow checking credit balance implies > 0?
        # OpenRouter usually returns 'is_free_tier' flag?
    else:
        print(f"❌ Key Check Failed: {resp.text}")

except Exception as e:
    print(f"Error checking key: {e}")
