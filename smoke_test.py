#!/usr/bin/env python3
"""
Post-deploy smoke test — verifies the live app is healthy.

Usage:
    python smoke_test.py https://tasks.works-on-my-machine.net
"""
import sys
import urllib.request
import urllib.error
import json

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:3083"
OK = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"

errors = 0


def check(label, url, *, expected_status=200, contains=None):
    global errors
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "smoke-test/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode()
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode()
    except Exception as e:
        print(f"  {FAIL} {label}: {e}")
        errors += 1
        return

    ok = status == expected_status
    if contains and ok:
        ok = contains in body

    if ok:
        print(f"  {OK} {label} ({status})")
    else:
        snippet = body[:120].replace("\n", " ")
        print(f"  {FAIL} {label}: got {status}, body: {snippet}")
        errors += 1


print(f"\nSmoke test → {BASE}\n")

# Health check
check("GET /api/health", f"{BASE}/api/health", contains='"ok":true')

# Auth — wrong password returns 401
try:
    import urllib.parse
    login_data = json.dumps({"username": "admin", "password": "wrong"}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json", "User-Agent": "smoke-test/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        status = resp.status
except urllib.error.HTTPError as e:
    status = e.code
except Exception as e:
    print(f"  {FAIL} POST /api/auth/login (bad pass): {e}")
    errors += 1
    status = -1

if status == 401:
    print(f"  {OK} POST /api/auth/login (bad pass) (401)")
elif status != -1:
    print(f"  {FAIL} POST /api/auth/login (bad pass): expected 401, got {status}")
    errors += 1

# Frontend served
check("GET /  (React app)", f"{BASE}/", contains="<html")

# Protected endpoint redirects to 401 without cookie
check("GET /api/board (unauthed)", f"{BASE}/api/board", expected_status=401)
check("GET /api/columns (unauthed)", f"{BASE}/api/columns", expected_status=401)

# Manifest
check("GET /manifest.webmanifest", f"{BASE}/manifest.webmanifest", contains="משימות")

print(f"\n{'All checks passed.' if errors == 0 else f'{errors} check(s) FAILED.'}\n")
sys.exit(0 if errors == 0 else 1)
