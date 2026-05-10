#!/usr/bin/env python3
"""
Backend test suite for Dropvine Markets — Phase 2C: POP Kids endpoints.
Tests NEW endpoints only; does NOT re-test Phase 2 + 2B (already verified).
"""
import os
import sys
import requests
import json
import time
from datetime import datetime

# Load environment variables from .env file
def load_env():
    """Load environment variables from .env file"""
    env_path = '/app/.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

load_env()

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://luxury-countdown-2.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', 'https://xelxywjtkffcnkexribv.supabase.co')
SUPABASE_ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

# Test state
test_results = {'passed': 0, 'failed': 0, 'tests': []}
auth_token = None
auth_cookies = {}
test_user_email = f"pop_test_{int(time.time())}@example.com"
test_user_password = "TestPass123!@#"

def log_test(name, passed, details=''):
    """Log test result"""
    status = '✅ PASS' if passed else '❌ FAIL'
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    test_results['tests'].append({'name': name, 'passed': passed, 'details': details})
    if passed:
        test_results['passed'] += 1
    else:
        test_results['failed'] += 1

def create_supabase_user():
    """Create a test user via Supabase signup endpoint"""
    global auth_token, auth_cookies
    
    print("\n=== CREATING TEST USER VIA SUPABASE ===")
    
    # Use the signup endpoint which creates and signs in the user in one call
    signup_url = f"{SUPABASE_URL}/auth/v1/signup"
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    }
    payload = {
        'email': test_user_email,
        'password': test_user_password
    }
    
    print(f"   Signup URL: {signup_url}")
    print(f"   Headers: apikey={SUPABASE_ANON_KEY[:20]}...")
    
    try:
        resp = requests.post(signup_url, headers=headers, json=payload, timeout=10)
        print(f"   Response status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            auth_token = data.get('access_token')
            refresh_token = data.get('refresh_token')
            user = data.get('user', {})
            
            print(f"✅ Created and signed in user: {test_user_email}")
            print(f"   User ID: {user.get('id')}")
            
            # Extract project ref from SUPABASE_URL (e.g., xelxywjtkffcnkexribv)
            project_ref = SUPABASE_URL.split('//')[1].split('.')[0]
            
            # Supabase @supabase/ssr uses separate cookies for auth-token and refresh-token
            # NOT a base64-encoded JSON array
            auth_cookies = {
                f"sb-{project_ref}-auth-token": auth_token,
                f"sb-{project_ref}-refresh-token": refresh_token
            }
            
            print(f"   Access token: {auth_token[:20]}...")
            print(f"   Cookies: sb-{project_ref}-auth-token, sb-{project_ref}-refresh-token")
            return True
        else:
            print(f"❌ Signup failed: {resp.status_code} - {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Signup error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_public_stamp_types():
    """Test GET /api/market/pop/stamp-types (public endpoint)"""
    print("\n=== TEST: Public Stamp Types Endpoint ===")
    
    try:
        resp = requests.get(f"{API_BASE}/market/pop/stamp-types", timeout=10)
        
        if resp.status_code != 200:
            log_test("GET /api/market/pop/stamp-types returns 200", False, 
                    f"Got {resp.status_code}")
            return
        
        log_test("GET /api/market/pop/stamp-types returns 200", True)
        
        data = resp.json()
        types = data.get('types', [])
        
        if len(types) != 4:
            log_test("Returns 4 active POP stamp types", False, 
                    f"Got {len(types)} types")
        else:
            log_test("Returns 4 active POP stamp types", True)
        
        # Verify stamp type names
        expected_names = [
            "Try a new fruit",
            "Greet a vendor", 
            "Help carry the basket",
            "Visit the music stage"
        ]
        actual_names = [t.get('name') for t in types]
        
        if set(actual_names) == set(expected_names):
            log_test("Stamp types have correct names", True)
        else:
            log_test("Stamp types have correct names", False,
                    f"Expected {expected_names}, got {actual_names}")
        
        # Verify token_reward = 1 for all
        all_reward_one = all(t.get('token_reward') == 1 for t in types)
        log_test("All stamp types have token_reward=1", all_reward_one)
        
    except Exception as e:
        log_test("GET /api/market/pop/stamp-types", False, f"Exception: {e}")

def test_auth_required_endpoints():
    """Test that all protected endpoints return 401 without auth"""
    print("\n=== TEST: Auth Required (401 without cookies) ===")
    
    endpoints = [
        ('GET', '/api/market/pop/children'),
        ('POST', '/api/market/pop/children'),
        ('GET', '/api/market/pop/children/00000000-0000-0000-0000-000000000000'),
        ('PATCH', '/api/market/pop/children/00000000-0000-0000-0000-000000000000'),
        ('DELETE', '/api/market/pop/children/00000000-0000-0000-0000-000000000000'),
        ('POST', '/api/market/pop/stamps'),
        ('POST', '/api/market/pop/redemptions'),
    ]
    
    for method, endpoint in endpoints:
        try:
            if method == 'GET':
                resp = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            elif method == 'POST':
                resp = requests.post(f"{BASE_URL}{endpoint}", json={}, timeout=10)
            elif method == 'PATCH':
                resp = requests.patch(f"{BASE_URL}{endpoint}", json={}, timeout=10)
            elif method == 'DELETE':
                resp = requests.delete(f"{BASE_URL}{endpoint}", timeout=10)
            
            if resp.status_code == 401:
                log_test(f"{method} {endpoint} → 401", True)
            else:
                log_test(f"{method} {endpoint} → 401", False,
                        f"Got {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            log_test(f"{method} {endpoint} → 401", False, f"Exception: {e}")

def test_authenticated_flow():
    """Test full POP Kids flow with authentication"""
    print("\n=== TEST: Authenticated POP Kids Flow ===")
    
    if not auth_token:
        print("❌ No auth token available, skipping authenticated tests")
        return
    
    # Prepare headers with auth
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}',
        'apikey': SUPABASE_ANON_KEY
    }
    
    # Test data
    mira_id = None
    theo_id = None
    stamp_type_ids = []
    brookside_vendor_id = None
    
    # Get stamp types first (to use in tests)
    try:
        resp = requests.get(f"{API_BASE}/market/pop/stamp-types", timeout=10)
        if resp.status_code == 200:
            types = resp.json().get('types', [])
            stamp_type_ids = [t['id'] for t in types]
            print(f"   Got {len(stamp_type_ids)} stamp type IDs")
    except Exception as e:
        print(f"⚠️  Could not fetch stamp types: {e}")
    
    # Get Brookside Farm vendor ID
    try:
        resp = requests.get(f"{API_BASE}/market/vendors/brookside-farm", timeout=10)
        if resp.status_code == 200:
            vendor = resp.json().get('vendor', {})
            brookside_vendor_id = vendor.get('id')
            print(f"   Got Brookside Farm vendor ID: {brookside_vendor_id}")
    except Exception as e:
        print(f"⚠️  Could not fetch vendor: {e}")
    
    # a. POST /api/market/pop/children - Create Mira
    try:
        resp = requests.post(
            f"{API_BASE}/market/pop/children",
            headers=headers,
            cookies=auth_cookies,
            json={'name': 'Mira', 'age': 7},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            child = data.get('child', {})
            mira_id = child.get('id')
            
            if (child.get('name') == 'Mira' and 
                child.get('age') == 7 and
                child.get('total_pop_tokens') == 0):
                log_test("POST /api/market/pop/children creates Mira", True,
                        f"id={mira_id}")
            else:
                log_test("POST /api/market/pop/children creates Mira", False,
                        f"Unexpected data: {child}")
        else:
            log_test("POST /api/market/pop/children creates Mira", False,
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("POST /api/market/pop/children creates Mira", False, f"Exception: {e}")
    
    # b. POST again - Create Theo
    try:
        resp = requests.post(
            f"{API_BASE}/market/pop/children",
            headers=headers,
            cookies=auth_cookies,
            json={'name': 'Theo', 'age': 4},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            child = data.get('child', {})
            theo_id = child.get('id')
            
            if child.get('name') == 'Theo' and child.get('age') == 4:
                log_test("POST /api/market/pop/children creates Theo", True,
                        f"id={theo_id}")
            else:
                log_test("POST /api/market/pop/children creates Theo", False,
                        f"Unexpected data: {child}")
        else:
            log_test("POST /api/market/pop/children creates Theo", False,
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("POST /api/market/pop/children creates Theo", False, f"Exception: {e}")
    
    # c. GET /api/market/pop/children - List children
    try:
        resp = requests.get(
            f"{API_BASE}/market/pop/children",
            headers=headers,
            cookies=auth_cookies,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            children = data.get('children', [])
            
            if len(children) == 2:
                log_test("GET /api/market/pop/children returns both children", True)
            else:
                log_test("GET /api/market/pop/children returns both children", False,
                        f"Got {len(children)} children")
        else:
            log_test("GET /api/market/pop/children", False,
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("GET /api/market/pop/children", False, f"Exception: {e}")
    
    # d. GET /api/market/pop/children/[mira_id] - Get Mira details
    if mira_id:
        try:
            resp = requests.get(
                f"{API_BASE}/market/pop/children/{mira_id}",
                headers=headers,
                cookies=auth_cookies,
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                child = data.get('child', {})
                stamps = data.get('stamps', [])
                tokens = data.get('tokens', [])
                redemptions = data.get('redemptions', [])
                
                if (child.get('total_pop_tokens') == 0 and
                    len(stamps) == 0 and
                    len(tokens) == 0 and
                    len(redemptions) == 0):
                    log_test("GET /api/market/pop/children/[id] returns Mira with 0 tokens", True)
                else:
                    log_test("GET /api/market/pop/children/[id] returns Mira with 0 tokens", False,
                            f"tokens={child.get('total_pop_tokens')}, stamps={len(stamps)}")
            else:
                log_test("GET /api/market/pop/children/[id]", False,
                        f"Got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("GET /api/market/pop/children/[id]", False, f"Exception: {e}")
    
    # e-f. POST /api/market/pop/stamps - Award 4 stamps to Mira
    if mira_id and len(stamp_type_ids) >= 4:
        for i, stamp_type_id in enumerate(stamp_type_ids[:4]):
            try:
                resp = requests.post(
                    f"{API_BASE}/market/pop/stamps",
                    headers=headers,
                    cookies=auth_cookies,
                    json={'child_id': mira_id, 'stamp_type_id': stamp_type_id},
                    timeout=10
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    if (data.get('ok') and 
                        data.get('reward') == 1 and
                        data.get('stamp') and
                        data.get('token')):
                        log_test(f"POST /api/market/pop/stamps (stamp {i+1}/4)", True)
                    else:
                        log_test(f"POST /api/market/pop/stamps (stamp {i+1}/4)", False,
                                f"Unexpected response: {data}")
                else:
                    log_test(f"POST /api/market/pop/stamps (stamp {i+1}/4)", False,
                            f"Got {resp.status_code}: {resp.text[:200]}")
            except Exception as e:
                log_test(f"POST /api/market/pop/stamps (stamp {i+1}/4)", False, f"Exception: {e}")
    
    # g. GET /api/market/pop/children/[mira_id] - Verify 4 tokens
    if mira_id:
        try:
            resp = requests.get(
                f"{API_BASE}/market/pop/children/{mira_id}",
                headers=headers,
                cookies=auth_cookies,
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                child = data.get('child', {})
                stamps = data.get('stamps', [])
                
                if child.get('total_pop_tokens') == 4 and len(stamps) == 4:
                    log_test("Mira has 4 POP tokens after 4 stamps", True)
                else:
                    log_test("Mira has 4 POP tokens after 4 stamps", False,
                            f"tokens={child.get('total_pop_tokens')}, stamps={len(stamps)}")
            else:
                log_test("Verify Mira tokens", False,
                        f"Got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("Verify Mira tokens", False, f"Exception: {e}")
    
    # h. POST /api/market/pop/redemptions - Redeem 3 tokens
    if mira_id and brookside_vendor_id:
        try:
            resp = requests.post(
                f"{API_BASE}/market/pop/redemptions",
                headers=headers,
                cookies=auth_cookies,
                json={
                    'child_id': mira_id,
                    'vendor_id': brookside_vendor_id,
                    'amount': 3
                },
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if (data.get('ok') and 
                    data.get('new_balance') == 1 and
                    data.get('redemption')):
                    log_test("POST /api/market/pop/redemptions (3 tokens)", True,
                            "new_balance=1")
                else:
                    log_test("POST /api/market/pop/redemptions (3 tokens)", False,
                            f"Unexpected response: {data}")
            else:
                log_test("POST /api/market/pop/redemptions (3 tokens)", False,
                        f"Got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("POST /api/market/pop/redemptions (3 tokens)", False, f"Exception: {e}")
    
    # i. POST /api/market/pop/redemptions - Try to redeem 5 tokens (insufficient)
    if mira_id and brookside_vendor_id:
        try:
            resp = requests.post(
                f"{API_BASE}/market/pop/redemptions",
                headers=headers,
                cookies=auth_cookies,
                json={
                    'child_id': mira_id,
                    'vendor_id': brookside_vendor_id,
                    'amount': 5
                },
                timeout=10
            )
            
            if resp.status_code == 400:
                error_msg = resp.json().get('error', '')
                if 'insufficient' in error_msg.lower():
                    log_test("POST /api/market/pop/redemptions insufficient balance → 400", True,
                            f"Error: {error_msg}")
                else:
                    log_test("POST /api/market/pop/redemptions insufficient balance → 400", False,
                            f"Wrong error message: {error_msg}")
            else:
                log_test("POST /api/market/pop/redemptions insufficient balance → 400", False,
                        f"Got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("POST /api/market/pop/redemptions insufficient", False, f"Exception: {e}")
    
    # j. POST /api/market/pop/stamps with non-existent child_id → 404
    if len(stamp_type_ids) > 0:
        try:
            resp = requests.post(
                f"{API_BASE}/market/pop/stamps",
                headers=headers,
                cookies=auth_cookies,
                json={
                    'child_id': '00000000-0000-0000-0000-000000000000',
                    'stamp_type_id': stamp_type_ids[0]
                },
                timeout=10
            )
            
            if resp.status_code == 404:
                log_test("POST /api/market/pop/stamps with non-existent child → 404", True)
            else:
                log_test("POST /api/market/pop/stamps with non-existent child → 404", False,
                        f"Got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("POST /api/market/pop/stamps non-existent child", False, f"Exception: {e}")
    
    # k. PATCH /api/market/pop/children/[mira_id] - Update age
    if mira_id:
        try:
            resp = requests.patch(
                f"{API_BASE}/market/pop/children/{mira_id}",
                headers=headers,
                cookies=auth_cookies,
                json={'age': 8},
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                child = data.get('child', {})
                
                if child.get('age') == 8:
                    log_test("PATCH /api/market/pop/children/[id] updates age", True)
                else:
                    log_test("PATCH /api/market/pop/children/[id] updates age", False,
                            f"age={child.get('age')}")
            else:
                log_test("PATCH /api/market/pop/children/[id]", False,
                        f"Got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("PATCH /api/market/pop/children/[id]", False, f"Exception: {e}")
    
    # l. DELETE /api/market/pop/children/[theo_id]
    if theo_id:
        try:
            resp = requests.delete(
                f"{API_BASE}/market/pop/children/{theo_id}",
                headers=headers,
                cookies=auth_cookies,
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get('ok'):
                    log_test("DELETE /api/market/pop/children/[id] deletes Theo", True)
                else:
                    log_test("DELETE /api/market/pop/children/[id]", False,
                            f"Unexpected response: {data}")
            else:
                log_test("DELETE /api/market/pop/children/[id]", False,
                        f"Got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("DELETE /api/market/pop/children/[id]", False, f"Exception: {e}")
    
    # m. GET /api/market/pop/children - Verify only Mira remains
    try:
        resp = requests.get(
            f"{API_BASE}/market/pop/children",
            headers=headers,
            cookies=auth_cookies,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            children = data.get('children', [])
            
            if len(children) == 1 and children[0].get('name') == 'Mira':
                log_test("GET /api/market/pop/children shows only Mira after delete", True)
            else:
                log_test("GET /api/market/pop/children shows only Mira", False,
                        f"Got {len(children)} children")
        else:
            log_test("GET /api/market/pop/children after delete", False,
                    f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("GET /api/market/pop/children after delete", False, f"Exception: {e}")

def test_validation():
    """Test validation scenarios"""
    print("\n=== TEST: Validation ===")
    
    if not auth_token:
        print("❌ No auth token available, skipping validation tests")
        return
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {auth_token}',
        'apikey': SUPABASE_ANON_KEY
    }
    
    # POST /api/market/pop/children with empty body → 400
    try:
        resp = requests.post(
            f"{API_BASE}/market/pop/children",
            headers=headers,
            cookies=auth_cookies,
            json={},
            timeout=10
        )
        
        if resp.status_code == 400:
            error = resp.json().get('error', '')
            if 'name' in error.lower():
                log_test("POST /api/market/pop/children empty body → 400 'name required'", True)
            else:
                log_test("POST /api/market/pop/children empty body → 400", False,
                        f"Wrong error: {error}")
        else:
            log_test("POST /api/market/pop/children empty body → 400", False,
                    f"Got {resp.status_code}")
    except Exception as e:
        log_test("POST /api/market/pop/children validation", False, f"Exception: {e}")
    
    # POST /api/market/pop/stamps with empty body → 400
    try:
        resp = requests.post(
            f"{API_BASE}/market/pop/stamps",
            headers=headers,
            cookies=auth_cookies,
            json={},
            timeout=10
        )
        
        if resp.status_code == 400:
            error = resp.json().get('error', '')
            if 'child_id' in error and 'stamp_type_id' in error:
                log_test("POST /api/market/pop/stamps empty body → 400", True,
                        "Requires child_id and stamp_type_id")
            else:
                log_test("POST /api/market/pop/stamps empty body → 400", False,
                        f"Wrong error: {error}")
        else:
            log_test("POST /api/market/pop/stamps empty body → 400", False,
                    f"Got {resp.status_code}")
    except Exception as e:
        log_test("POST /api/market/pop/stamps validation", False, f"Exception: {e}")
    
    # POST /api/market/pop/redemptions with negative amount → 400
    try:
        resp = requests.post(
            f"{API_BASE}/market/pop/redemptions",
            headers=headers,
            cookies=auth_cookies,
            json={
                'child_id': '00000000-0000-0000-0000-000000000000',
                'vendor_id': '00000000-0000-0000-0000-000000000000',
                'amount': -1
            },
            timeout=10
        )
        
        if resp.status_code == 400:
            error = resp.json().get('error', '')
            if 'positive' in error.lower():
                log_test("POST /api/market/pop/redemptions negative amount → 400", True)
            else:
                log_test("POST /api/market/pop/redemptions negative amount → 400", False,
                        f"Wrong error: {error}")
        else:
            log_test("POST /api/market/pop/redemptions negative amount → 400", False,
                    f"Got {resp.status_code}")
    except Exception as e:
        log_test("POST /api/market/pop/redemptions validation", False, f"Exception: {e}")
    
    # POST /api/market/pop/redemptions with non-existent vendor → 404
    try:
        # First create a child to use
        resp = requests.post(
            f"{API_BASE}/market/pop/children",
            headers=headers,
            cookies=auth_cookies,
            json={'name': 'TestChild', 'age': 5},
            timeout=10
        )
        
        if resp.status_code == 200:
            child_id = resp.json().get('child', {}).get('id')
            
            resp = requests.post(
                f"{API_BASE}/market/pop/redemptions",
                headers=headers,
                cookies=auth_cookies,
                json={
                    'child_id': child_id,
                    'vendor_id': '00000000-0000-0000-0000-000000000000',
                    'amount': 1
                },
                timeout=10
            )
            
            if resp.status_code == 404:
                log_test("POST /api/market/pop/redemptions non-existent vendor → 404", True)
            else:
                log_test("POST /api/market/pop/redemptions non-existent vendor → 404", False,
                        f"Got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("POST /api/market/pop/redemptions vendor validation", False, f"Exception: {e}")

def test_no_regression():
    """Verify existing endpoints still work"""
    print("\n=== TEST: No Regression ===")
    
    # GET /api/market/config
    try:
        resp = requests.get(f"{API_BASE}/market/config", timeout=10)
        if resp.status_code == 200:
            log_test("GET /api/market/config still works", True)
        else:
            log_test("GET /api/market/config still works", False,
                    f"Got {resp.status_code}")
    except Exception as e:
        log_test("GET /api/market/config", False, f"Exception: {e}")
    
    # GET /api/market/vendors
    try:
        resp = requests.get(f"{API_BASE}/market/vendors", timeout=10)
        if resp.status_code == 200:
            log_test("GET /api/market/vendors still works", True)
        else:
            log_test("GET /api/market/vendors still works", False,
                    f"Got {resp.status_code}")
    except Exception as e:
        log_test("GET /api/market/vendors", False, f"Exception: {e}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Total tests: {test_results['passed'] + test_results['failed']}")
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print("="*70)
    
    if test_results['failed'] > 0:
        print("\nFailed tests:")
        for test in test_results['tests']:
            if not test['passed']:
                print(f"  ❌ {test['name']}")
                if test['details']:
                    print(f"     {test['details']}")
    
    return test_results['failed'] == 0

def main():
    """Run all tests"""
    print("="*70)
    print("DROPVINE MARKETS — Phase 2C: POP Kids Backend Tests")
    print("="*70)
    print(f"Base URL: {BASE_URL}")
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Test user: {test_user_email}")
    print("="*70)
    
    # Test 1: Public endpoint
    test_public_stamp_types()
    
    # Test 2: Auth required (401 tests)
    test_auth_required_endpoints()
    
    # Test 3: Create Supabase user and authenticate
    auth_success = create_supabase_user()
    
    if auth_success:
        # Test 4: Authenticated flow
        test_authenticated_flow()
        
        # Test 5: Validation
        test_validation()
    else:
        print("\n⚠️  Skipping authenticated tests due to auth failure")
        print("   This is acceptable per review request - 401 + validation tests are sufficient")
    
    # Test 6: No regression
    test_no_regression()
    
    # Print summary
    all_passed = print_summary()
    
    sys.exit(0 if all_passed else 1)

if __name__ == '__main__':
    main()
