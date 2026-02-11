#!/usr/bin/env python3
"""
Generate a SonarQube user token and update .env for docker-compose.

- Uses SonarQube REST API: /api/user_tokens/generate
- Auth via basic auth (username/password)
- Writes SONARQUBE_TOKEN into .env

Usage:
  python sonarqube_auth_bootstrap.py --name local-dev
  SONARQUBE_URL=http://localhost:9000 SONARQUBE_USER=admin SONARQUBE_PASSWORD=admin python sonarqube_auth_bootstrap.py
"""

import argparse
import base64
import json
import os
import sys
import urllib.parse
import urllib.request


def _prompt(value: str, prompt: str) -> str:
    if value:
        return value
    try:
        return input(prompt).strip()
    except EOFError:
        return ""


def _generate_token(base_url: str, username: str, password: str, token_name: str) -> str:
    endpoint = f"{base_url.rstrip('/')}/api/user_tokens/generate"
    params = urllib.parse.urlencode({"name": token_name})
    url = f"{endpoint}?{params}"

    auth_raw = f"{username}:{password}".encode("utf-8")
    auth = base64.b64encode(auth_raw).decode("ascii")

    request = urllib.request.Request(url, method="POST")
    request.add_header("Authorization", f"Basic {auth}")
    request.add_header("Accept", "application/json")

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)
            token = data.get("token")
            if not token:
                raise RuntimeError(f"Token missing in response: {body}")
            return token
    except Exception as exc:
        raise RuntimeError(f"Token generation failed: {exc}")


def _update_env_file(env_path: str, token: str) -> None:
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()

    updated = False
    out_lines = []
    for line in lines:
        if line.strip().startswith("SONARQUBE_TOKEN="):
            out_lines.append(f"SONARQUBE_TOKEN={token}")
            updated = True
        else:
            out_lines.append(line)

    if not updated:
        out_lines.append(f"SONARQUBE_TOKEN={token}")

    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate SonarQube token and update .env")
    parser.add_argument("--name", default="local-dev", help="Token name")
    parser.add_argument("--env", default=".env", help="Path to .env")
    args = parser.parse_args()

    base_url = os.getenv("SONARQUBE_URL", "http://localhost:9000")
    username = _prompt(os.getenv("SONARQUBE_USER", "admin"), "SonarQube username: ")
    password = _prompt(os.getenv("SONARQUBE_PASSWORD", ""), "SonarQube password: ")

    if not username or not password:
        print("Missing username/password. Set SONARQUBE_USER and SONARQUBE_PASSWORD or enter them when prompted.")
        return 1

    try:
        token = _generate_token(base_url, username, password, args.name)
    except Exception as exc:
        print(str(exc))
        return 1

    _update_env_file(args.env, token)
    print(f"Token created and saved to {args.env} as SONARQUBE_TOKEN.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
