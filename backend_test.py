#!/usr/bin/env python3
"""
Backend API test suite for Dropvine in MOCK MODE.
Tests all endpoints with the in-memory mock store.
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Read base URL from .env
BASE_URL = None
with open('/app/.env', 'r') as f:
    for line in f:
        if line.startswith('NEXT_PUBLIC_BASE_URL='):
            BASE_URL = line.split('=', 1)[1].strip()
            break

if not BASE_URL:
    print("❌ NEXT_PUBLIC_BASE_URL not found in .env")
    exit(1)

API_BASE = f"{BASE_URL}/api"
print(f"🔗 Testing API at: {API_BASE}\n")

# Global test state
USER_ID = None
LAUNCH_ID = None
TEST_EMAIL = f"test+{int(time.time())}@dropvine.test"
TEST_HANDLE = f"test-drop-{int(time.time())}"

def print_test(name):
    print(f"\n{'='*80}")
    print(f"🧪 TEST: {name}")
    print('='*80)

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")

def print_response(resp):
    print(f"   Status: {resp.status_code}")
    try:
        print(f"   Body: {json.dumps(resp.json(), indent=2)}")
    except:
        print(f"   Body: {resp.text[:200]}")

# =============================================================================
# TEST 1: POST /api/auth/mock-signup
# =============================================================================
print_test("1. POST /api/auth/mock-signup - Create new user")

try:
    payload = {
        "email": TEST_EMAIL,
        "password": "secret123",
        "display_name": "Test User"
    }
    resp = requests.post(f"{API_BASE}/auth/mock-signup", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        if 'id' in data and 'email' in data and 'display_name' in data:
            USER_ID = data['id']
            print_pass(f"User created successfully. ID: {USER_ID}")
        else:
            print_fail("Response missing required fields (id, email, display_name)")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# Test negative case: duplicate email
print_test("1b. POST /api/auth/mock-signup - Duplicate email (expect 409)")

try:
    resp = requests.post(f"{API_BASE}/auth/mock-signup", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 409:
        print_pass("Correctly rejected duplicate email with 409")
    else:
        print_fail(f"Expected 409, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 2: POST /api/auth/mock-signin
# =============================================================================
print_test("2. POST /api/auth/mock-signin - Sign in with correct credentials")

try:
    payload = {
        "email": TEST_EMAIL,
        "password": "secret123"
    }
    resp = requests.post(f"{API_BASE}/auth/mock-signin", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        if 'id' in data and data['id'] == USER_ID:
            print_pass("Sign in successful, user ID matches")
        else:
            print_fail("User ID mismatch or missing")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# Test negative case: wrong password
print_test("2b. POST /api/auth/mock-signin - Wrong password (expect 401)")

try:
    payload = {
        "email": TEST_EMAIL,
        "password": "wrongpassword"
    }
    resp = requests.post(f"{API_BASE}/auth/mock-signin", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 401:
        print_pass("Correctly rejected wrong password with 401")
    else:
        print_fail(f"Expected 401, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 3: GET /api/launches/by-handle/maison-noir-fw26 (seeded demo)
# =============================================================================
print_test("3. GET /api/launches/by-handle/maison-noir-fw26 - Seeded demo launch")

try:
    resp = requests.get(f"{API_BASE}/launches/by-handle/maison-noir-fw26", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        if 'launch' in data and data['launch']['handle'] == 'maison-noir-fw26':
            print_pass("Demo launch found successfully")
        else:
            print_fail("Response missing 'launch' or handle mismatch")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# Test negative case: non-existent handle
print_test("3b. GET /api/launches/by-handle/does-not-exist - Non-existent handle (expect 404)")

try:
    resp = requests.get(f"{API_BASE}/launches/by-handle/does-not-exist", timeout=10)
    print_response(resp)
    
    if resp.status_code == 404:
        print_pass("Correctly returned 404 for non-existent handle")
    else:
        print_fail(f"Expected 404, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 4: POST /api/launches - Create new launch
# =============================================================================
print_test("4. POST /api/launches - Create new launch with auth")

if not USER_ID:
    print_fail("Cannot proceed: USER_ID not set from signup")
else:
    try:
        launch_at = (datetime.utcnow() + timedelta(hours=24)).isoformat() + 'Z'
        payload = {
            "title": "Test Drop",
            "handle": TEST_HANDLE,
            "launch_at": launch_at,
            "tagline": "hello",
            "description": "world",
            "price_cents": 9900,
            "reservation_enabled": True,
            "reservation_hold_cents": 1000,
            "status": "published"
        }
        headers = {"x-user-id": USER_ID}
        resp = requests.post(f"{API_BASE}/launches", json=payload, headers=headers, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if 'launch' in data and 'id' in data['launch']:
                launch = data['launch']
                LAUNCH_ID = launch['id']
                if launch['creator_id'] == USER_ID and launch['handle'] == TEST_HANDLE:
                    print_pass(f"Launch created successfully. ID: {LAUNCH_ID}")
                else:
                    print_fail("Launch data mismatch (creator_id or handle)")
            else:
                print_fail("Response missing 'launch' or 'id'")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# Test negative case: no auth header
print_test("4b. POST /api/launches - Without auth header (expect 401)")

try:
    payload = {
        "title": "Test Drop 2",
        "handle": "test-drop-2",
        "launch_at": (datetime.utcnow() + timedelta(hours=24)).isoformat() + 'Z',
    }
    resp = requests.post(f"{API_BASE}/launches", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 401:
        print_pass("Correctly rejected request without auth header")
    else:
        print_fail(f"Expected 401, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# Test negative case: missing required field
print_test("4c. POST /api/launches - Missing required field (expect 400)")

try:
    payload = {
        "handle": "test-drop-3",
        "launch_at": (datetime.utcnow() + timedelta(hours=24)).isoformat() + 'Z',
        # Missing 'title'
    }
    headers = {"x-user-id": USER_ID}
    resp = requests.post(f"{API_BASE}/launches", json=payload, headers=headers, timeout=10)
    print_response(resp)
    
    if resp.status_code == 400:
        print_pass("Correctly rejected request with missing required field")
    else:
        print_fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# Test negative case: duplicate handle
print_test("4d. POST /api/launches - Duplicate handle (expect 409)")

try:
    payload = {
        "title": "Test Drop Duplicate",
        "handle": TEST_HANDLE,  # Same handle as before
        "launch_at": (datetime.utcnow() + timedelta(hours=24)).isoformat() + 'Z',
    }
    headers = {"x-user-id": USER_ID}
    resp = requests.post(f"{API_BASE}/launches", json=payload, headers=headers, timeout=10)
    print_response(resp)
    
    if resp.status_code == 409:
        print_pass("Correctly rejected duplicate handle with 409")
    else:
        print_fail(f"Expected 409, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 5: GET /api/launches?creator=me
# =============================================================================
print_test("5. GET /api/launches?creator=me - List user's launches")

if not USER_ID:
    print_fail("Cannot proceed: USER_ID not set")
else:
    try:
        headers = {"x-user-id": USER_ID}
        resp = requests.get(f"{API_BASE}/launches?creator=me", headers=headers, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if 'launches' in data and isinstance(data['launches'], list):
                found = any(l['id'] == LAUNCH_ID for l in data['launches'])
                if found:
                    print_pass(f"User's launches retrieved, includes created launch")
                else:
                    print_fail("Created launch not found in user's launches")
            else:
                print_fail("Response missing 'launches' array")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# =============================================================================
# TEST 6: GET /api/launches - List all launches
# =============================================================================
print_test("6. GET /api/launches - List all launches (no filter)")

try:
    resp = requests.get(f"{API_BASE}/launches", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        if 'launches' in data and isinstance(data['launches'], list):
            has_demo = any(l['handle'] == 'maison-noir-fw26' for l in data['launches'])
            has_test = any(l['id'] == LAUNCH_ID for l in data['launches']) if LAUNCH_ID else False
            if has_demo and (has_test or not LAUNCH_ID):
                print_pass(f"All launches retrieved (count: {len(data['launches'])})")
            else:
                print_fail("Missing expected launches (demo or test)")
        else:
            print_fail("Response missing 'launches' array")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 7: POST /api/launches/[id]/waitlist - Join waitlist
# =============================================================================
print_test("7. POST /api/launches/[id]/waitlist - Join waitlist")

if not LAUNCH_ID:
    print_fail("Cannot proceed: LAUNCH_ID not set")
else:
    try:
        payload = {
            "email": "fan@example.com",
            "name": "Fan"
        }
        resp = requests.post(f"{API_BASE}/launches/{LAUNCH_ID}/waitlist", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if 'entry' in data:
                print_pass("Waitlist entry created successfully")
            else:
                print_fail("Response missing 'entry'")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# Test deduplication
print_test("7b. POST /api/launches/[id]/waitlist - Duplicate email (expect dedup)")

if LAUNCH_ID:
    try:
        payload = {
            "email": "fan@example.com",  # Same email
            "name": "Fan Again"
        }
        resp = requests.post(f"{API_BASE}/launches/{LAUNCH_ID}/waitlist", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('dedup'):
                print_pass("Correctly handled duplicate email with dedup flag")
            else:
                print_fail("Expected {ok: true, dedup: true}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# Test missing email
print_test("7c. POST /api/launches/[id]/waitlist - Missing email (expect 400)")

if LAUNCH_ID:
    try:
        payload = {"name": "No Email"}
        resp = requests.post(f"{API_BASE}/launches/{LAUNCH_ID}/waitlist", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 400:
            print_pass("Correctly rejected request without email")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# =============================================================================
# TEST 8: GET /api/launches/[id]/waitlist - List waitlist entries
# =============================================================================
print_test("8. GET /api/launches/[id]/waitlist - List waitlist entries")

if not LAUNCH_ID:
    print_fail("Cannot proceed: LAUNCH_ID not set")
else:
    try:
        resp = requests.get(f"{API_BASE}/launches/{LAUNCH_ID}/waitlist", timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if 'entries' in data and 'count' in data:
                if data['count'] >= 1:
                    print_pass(f"Waitlist entries retrieved (count: {data['count']})")
                else:
                    print_fail("Expected at least 1 waitlist entry")
            else:
                print_fail("Response missing 'entries' or 'count'")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# =============================================================================
# TEST 9: POST /api/launches/[id]/reserve - Create reservation
# =============================================================================
print_test("9. POST /api/launches/[id]/reserve - Create reservation")

if not LAUNCH_ID:
    print_fail("Cannot proceed: LAUNCH_ID not set")
else:
    try:
        payload = {
            "email": "buyer@example.com",
            "amount_cents": 1000
        }
        resp = requests.post(f"{API_BASE}/launches/{LAUNCH_ID}/reserve", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if 'reservation' in data and 'checkout_url' in data:
                reservation = data['reservation']
                if (reservation.get('status') == 'held' and 
                    reservation.get('stripe_session_id', '').startswith('placeholder_') and
                    data['checkout_url'] == '#stripe-placeholder'):
                    print_pass("Reservation created with placeholder Stripe data")
                else:
                    print_fail("Reservation data doesn't match expected format")
            else:
                print_fail("Response missing 'reservation' or 'checkout_url'")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# Test missing email
print_test("9b. POST /api/launches/[id]/reserve - Missing email (expect 400)")

if LAUNCH_ID:
    try:
        payload = {"amount_cents": 1000}
        resp = requests.post(f"{API_BASE}/launches/{LAUNCH_ID}/reserve", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 400:
            print_pass("Correctly rejected request without email")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# =============================================================================
# SUMMARY
# =============================================================================
print("\n" + "="*80)
print("🏁 TEST SUITE COMPLETE")
print("="*80)
print("\nReview the results above for any failures.")
print(f"Test user: {TEST_EMAIL}")
print(f"User ID: {USER_ID}")
print(f"Launch ID: {LAUNCH_ID}")
print(f"Test handle: {TEST_HANDLE}")
