#!/usr/bin/env python3
"""
Stripe Checkout Integration Test Suite
Tests real Stripe API integration with test keys
"""
import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://luxury-countdown-2.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

print("=" * 80)
print("STRIPE CHECKOUT INTEGRATION TEST SUITE")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"API Base: {API_BASE}")
print("=" * 80)

# Test counters
total_tests = 0
passed_tests = 0
failed_tests = 0

def test_result(name, passed, details=""):
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f"✅ PASS: {name}")
    else:
        failed_tests += 1
        print(f"❌ FAIL: {name}")
    if details:
        print(f"   {details}")
    print()

# ============================================================================
# SETUP: Get the seeded launch
# ============================================================================
print("\n" + "=" * 80)
print("SETUP: Retrieving seeded launch 'maison-noir-fw26'")
print("=" * 80)

try:
    resp = requests.get(f"{API_BASE}/launches/by-handle/maison-noir-fw26", timeout=10)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    
    if resp.status_code == 200:
        launch_data = resp.json()
        launch = launch_data.get('launch')
        if launch:
            launch_id = launch['id']
            print(f"✅ Launch found: {launch['title']}")
            print(f"   ID: {launch_id}")
            print(f"   Handle: {launch['handle']}")
            print(f"   Reservation enabled: {launch.get('reservation_enabled')}")
            print(f"   Reservation hold: ${launch.get('reservation_hold_cents', 0) / 100}")
        else:
            print("❌ Launch not found in response")
            exit(1)
    else:
        print(f"❌ Failed to get launch: {resp.status_code}")
        exit(1)
except Exception as e:
    print(f"❌ Error getting launch: {e}")
    exit(1)

# ============================================================================
# TEST 1: POST /api/launches/[id]/reserve - POSITIVE CASE
# ============================================================================
print("\n" + "=" * 80)
print("TEST 1: POST /api/launches/[id]/reserve - Positive Case")
print("=" * 80)

try:
    payload = {
        "email": "buyer1@example.com",
        "origin_url": BASE_URL
    }
    print(f"Request: POST {API_BASE}/launches/{launch_id}/reserve")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    resp = requests.post(f"{API_BASE}/launches/{launch_id}/reserve", json=payload, timeout=15)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:1000]}")
    
    if resp.status_code == 200:
        data = resp.json()
        
        # Check required keys
        has_url = 'url' in data
        has_session_id = 'session_id' in data
        has_reservation = 'reservation' in data
        
        test_result(
            "Reserve endpoint returns 200",
            True,
            f"Keys present: url={has_url}, session_id={has_session_id}, reservation={has_reservation}"
        )
        
        # Validate URL format
        checkout_url = data.get('url', '')
        url_valid = checkout_url.startswith('https://checkout.stripe.com/c/pay/')
        test_result(
            "Checkout URL starts with 'https://checkout.stripe.com/c/pay/'",
            url_valid,
            f"URL: {checkout_url[:80]}..."
        )
        
        # Validate session_id format
        session_id = data.get('session_id', '')
        session_valid = session_id.startswith('cs_test_')
        test_result(
            "Session ID starts with 'cs_test_'",
            session_valid,
            f"Session ID: {session_id}"
        )
        
        # Validate reservation
        reservation = data.get('reservation', {})
        res_status = reservation.get('status')
        res_amount = reservation.get('amount_cents')
        res_session = reservation.get('stripe_session_id')
        
        test_result(
            "Reservation status is 'pending'",
            res_status == 'pending',
            f"Status: {res_status}"
        )
        
        test_result(
            "Reservation amount is 5000 cents (server-defined)",
            res_amount == 5000,
            f"Amount: {res_amount} cents"
        )
        
        test_result(
            "Reservation stripe_session_id matches session_id",
            res_session == session_id,
            f"Match: {res_session == session_id}"
        )
        
        # Save session_id for later tests
        global test_session_id
        test_session_id = session_id
        
    else:
        test_result(
            "Reserve endpoint returns 200",
            False,
            f"Got {resp.status_code}: {resp.text[:200]}"
        )
        test_session_id = None
        
except Exception as e:
    test_result("Reserve endpoint - positive case", False, f"Exception: {e}")
    test_session_id = None

# ============================================================================
# TEST 2: SECURITY - Client-supplied amount_cents must be ignored
# ============================================================================
print("\n" + "=" * 80)
print("TEST 2: SECURITY - Client-supplied amount_cents must be ignored")
print("=" * 80)

try:
    payload = {
        "email": "security-test@example.com",
        "origin_url": BASE_URL,
        "amount_cents": 1  # Try to override with 1 cent
    }
    print(f"Request: POST {API_BASE}/launches/{launch_id}/reserve")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("⚠️  Attempting to override amount_cents to 1 (should be ignored)")
    
    resp = requests.post(f"{API_BASE}/launches/{launch_id}/reserve", json=payload, timeout=15)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        reservation = data.get('reservation', {})
        res_amount = reservation.get('amount_cents')
        
        test_result(
            "SECURITY: Server ignores client amount_cents, uses server value (5000)",
            res_amount == 5000,
            f"Amount: {res_amount} cents (expected 5000, client sent 1)"
        )
    else:
        test_result(
            "SECURITY: Server ignores client amount_cents",
            False,
            f"Request failed with {resp.status_code}"
        )
        
except Exception as e:
    test_result("SECURITY test", False, f"Exception: {e}")

# ============================================================================
# TEST 3: POST /api/launches/[id]/reserve - NEGATIVE CASES
# ============================================================================
print("\n" + "=" * 80)
print("TEST 3: POST /api/launches/[id]/reserve - Negative Cases")
print("=" * 80)

# 3a. Missing email
try:
    payload = {"origin_url": BASE_URL}
    resp = requests.post(f"{API_BASE}/launches/{launch_id}/reserve", json=payload, timeout=10)
    test_result(
        "Missing email returns 400",
        resp.status_code == 400,
        f"Status: {resp.status_code}, Response: {resp.text[:200]}"
    )
except Exception as e:
    test_result("Missing email test", False, f"Exception: {e}")

# 3b. Missing origin_url
try:
    payload = {"email": "test@example.com"}
    resp = requests.post(f"{API_BASE}/launches/{launch_id}/reserve", json=payload, timeout=10)
    test_result(
        "Missing origin_url returns 400",
        resp.status_code == 400,
        f"Status: {resp.status_code}, Response: {resp.text[:200]}"
    )
except Exception as e:
    test_result("Missing origin_url test", False, f"Exception: {e}")

# 3c. Bad launch ID
try:
    payload = {"email": "test@example.com", "origin_url": BASE_URL}
    bad_id = "00000000-0000-0000-0000-000000000000"
    resp = requests.post(f"{API_BASE}/launches/{bad_id}/reserve", json=payload, timeout=10)
    test_result(
        "Bad launch ID returns 404",
        resp.status_code == 404,
        f"Status: {resp.status_code}, Response: {resp.text[:200]}"
    )
except Exception as e:
    test_result("Bad launch ID test", False, f"Exception: {e}")

# 3d. Launch with reservation_enabled=false
print("\n--- Creating launch with reservation_enabled=false ---")
try:
    # First, create a user for auth
    signup_resp = requests.post(f"{API_BASE}/auth/mock-signup", json={
        "email": "creator-test@example.com",
        "password": "password123",
        "display_name": "Test Creator"
    }, timeout=10)
    
    if signup_resp.status_code == 200:
        user = signup_resp.json()
        user_id = user['id']
        print(f"✅ Created test user: {user_id}")
        
        # Create launch with reservation_enabled=false
        launch_payload = {
            "handle": "test-no-reservation",
            "title": "Test Launch No Reservation",
            "launch_at": "2026-12-31T23:59:59Z",
            "reservation_enabled": False
        }
        
        create_resp = requests.post(
            f"{API_BASE}/launches",
            json=launch_payload,
            headers={"x-user-id": user_id},
            timeout=10
        )
        
        if create_resp.status_code == 200:
            no_res_launch = create_resp.json()['launch']
            no_res_launch_id = no_res_launch['id']
            print(f"✅ Created launch without reservations: {no_res_launch_id}")
            
            # Try to reserve on this launch
            reserve_payload = {"email": "test@example.com", "origin_url": BASE_URL}
            reserve_resp = requests.post(
                f"{API_BASE}/launches/{no_res_launch_id}/reserve",
                json=reserve_payload,
                timeout=10
            )
            
            test_result(
                "Launch with reservation_enabled=false returns 400",
                reserve_resp.status_code == 400,
                f"Status: {reserve_resp.status_code}, Response: {reserve_resp.text[:200]}"
            )
        else:
            test_result(
                "Launch with reservation_enabled=false returns 400",
                False,
                f"Failed to create test launch: {create_resp.status_code}"
            )
    else:
        test_result(
            "Launch with reservation_enabled=false returns 400",
            False,
            f"Failed to create test user: {signup_resp.status_code}"
        )
        
except Exception as e:
    test_result("reservation_enabled=false test", False, f"Exception: {e}")

# ============================================================================
# TEST 4: GET /api/payments/checkout/status/[session_id]
# ============================================================================
print("\n" + "=" * 80)
print("TEST 4: GET /api/payments/checkout/status/[session_id]")
print("=" * 80)

if test_session_id:
    try:
        print(f"Request: GET {API_BASE}/payments/checkout/status/{test_session_id}")
        resp = requests.get(f"{API_BASE}/payments/checkout/status/{test_session_id}", timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:1000]}")
        
        if resp.status_code == 200:
            data = resp.json()
            
            # Check required keys
            has_status = 'status' in data
            has_payment_status = 'payment_status' in data
            has_amount_total = 'amount_total' in data
            has_currency = 'currency' in data
            has_metadata = 'metadata' in data
            has_reservation = 'reservation' in data
            
            test_result(
                "Status endpoint returns all required keys",
                all([has_status, has_payment_status, has_amount_total, has_currency, has_metadata, has_reservation]),
                f"Keys: status={has_status}, payment_status={has_payment_status}, amount_total={has_amount_total}, currency={has_currency}, metadata={has_metadata}, reservation={has_reservation}"
            )
            
            # Validate values
            status = data.get('status')
            payment_status = data.get('payment_status')
            
            test_result(
                "Status is 'open' (no payment made yet)",
                status == 'open',
                f"Status: {status}"
            )
            
            test_result(
                "Payment status is 'unpaid'",
                payment_status == 'unpaid',
                f"Payment status: {payment_status}"
            )
            
            # Check metadata
            metadata = data.get('metadata', {})
            has_launch_id = 'launch_id' in metadata
            has_launch_handle = 'launch_handle' in metadata
            has_email = 'email' in metadata
            
            test_result(
                "Metadata includes launch_id, launch_handle, email",
                all([has_launch_id, has_launch_handle, has_email]),
                f"Metadata keys: {list(metadata.keys())}"
            )
            
            # Check reservation
            reservation = data.get('reservation', {})
            res_status = reservation.get('status')
            
            test_result(
                "Reservation status is still 'pending'",
                res_status == 'pending',
                f"Reservation status: {res_status}"
            )
            
        else:
            test_result(
                "Status endpoint returns 200",
                False,
                f"Got {resp.status_code}: {resp.text[:200]}"
            )
            
    except Exception as e:
        test_result("Status endpoint test", False, f"Exception: {e}")
else:
    print("⚠️  Skipping status endpoint test (no valid session_id from previous test)")

# Test with bad session_id
try:
    bad_session = "cs_test_invalid"
    print(f"\nRequest: GET {API_BASE}/payments/checkout/status/{bad_session}")
    resp = requests.get(f"{API_BASE}/payments/checkout/status/{bad_session}", timeout=10)
    print(f"Status: {resp.status_code}")
    
    test_result(
        "Bad session_id returns 500 with Stripe error",
        resp.status_code == 500,
        f"Status: {resp.status_code}, Response: {resp.text[:200]}"
    )
    
except Exception as e:
    test_result("Bad session_id test", False, f"Exception: {e}")

# ============================================================================
# TEST 5: POST /api/webhook/stripe - Webhook Handler
# ============================================================================
print("\n" + "=" * 80)
print("TEST 5: POST /api/webhook/stripe - Webhook Handler")
print("=" * 80)

print("⚠️  Checking if webhook endpoint exists...")

try:
    # Test if endpoint exists
    test_payload = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_dummy",
                "payment_status": "paid"
            }
        }
    }
    
    resp = requests.post(f"{API_BASE}/webhook/stripe", json=test_payload, timeout=10)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    
    if resp.status_code == 404:
        test_result(
            "Webhook endpoint /api/webhook/stripe",
            False,
            "❌ CRITICAL: Webhook endpoint does not exist (404). This endpoint is required for the Stripe integration to work properly."
        )
    else:
        print(f"Webhook endpoint exists (status: {resp.status_code})")
        
        # If we have a valid session_id, test the webhook flow
        if test_session_id:
            print("\n--- Testing webhook with real session_id ---")
            
            # Test checkout.session.completed
            webhook_payload = {
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "id": test_session_id,
                        "payment_status": "paid"
                    }
                }
            }
            
            resp = requests.post(f"{API_BASE}/webhook/stripe", json=webhook_payload, timeout=10)
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            
            test_result(
                "Webhook returns 200 with {received: true}",
                resp.status_code == 200 and resp.json().get('received') == True,
                f"Status: {resp.status_code}, Response: {resp.text[:200]}"
            )
            
            # Poll status to verify reservation was updated
            print("\n--- Polling status after webhook ---")
            status_resp = requests.get(f"{API_BASE}/payments/checkout/status/{test_session_id}", timeout=10)
            if status_resp.status_code == 200:
                data = status_resp.json()
                reservation = data.get('reservation', {})
                res_status = reservation.get('status')
                
                test_result(
                    "Webhook updated reservation status to 'held'",
                    res_status == 'held',
                    f"Reservation status: {res_status}"
                )
            
            # Test idempotency - send same webhook again
            print("\n--- Testing webhook idempotency ---")
            resp2 = requests.post(f"{API_BASE}/webhook/stripe", json=webhook_payload, timeout=10)
            
            test_result(
                "IDEMPOTENCY: Webhook can be called twice without error",
                resp2.status_code == 200,
                f"Status: {resp2.status_code}, Response: {resp2.text[:200]}"
            )
            
            # Verify reservation is still 'held' (not duplicated)
            status_resp2 = requests.get(f"{API_BASE}/payments/checkout/status/{test_session_id}", timeout=10)
            if status_resp2.status_code == 200:
                data2 = status_resp2.json()
                reservation2 = data2.get('reservation', {})
                res_status2 = reservation2.get('status')
                
                test_result(
                    "IDEMPOTENCY: Reservation remains 'held' (not duplicated)",
                    res_status2 == 'held',
                    f"Reservation status: {res_status2}"
                )
            
            # Test checkout.session.expired
            print("\n--- Testing checkout.session.expired webhook ---")
            
            # Create a new reservation for this test
            new_reserve_payload = {
                "email": "expire-test@example.com",
                "origin_url": BASE_URL
            }
            new_reserve_resp = requests.post(f"{API_BASE}/launches/{launch_id}/reserve", json=new_reserve_payload, timeout=15)
            
            if new_reserve_resp.status_code == 200:
                new_session_id = new_reserve_resp.json()['session_id']
                print(f"Created new session for expiry test: {new_session_id}")
                
                # Send expired webhook
                expired_payload = {
                    "type": "checkout.session.expired",
                    "data": {
                        "object": {
                            "id": new_session_id,
                            "status": "expired"
                        }
                    }
                }
                
                expired_resp = requests.post(f"{API_BASE}/webhook/stripe", json=expired_payload, timeout=10)
                print(f"Expired webhook status: {expired_resp.status_code}")
                
                # Check reservation status
                expired_status_resp = requests.get(f"{API_BASE}/payments/checkout/status/{new_session_id}", timeout=10)
                if expired_status_resp.status_code == 200:
                    expired_data = expired_status_resp.json()
                    expired_reservation = expired_data.get('reservation', {})
                    expired_res_status = expired_reservation.get('status')
                    
                    test_result(
                        "Expired webhook updates reservation to 'cancelled'",
                        expired_res_status == 'cancelled',
                        f"Reservation status: {expired_res_status}"
                    )
        
except Exception as e:
    test_result("Webhook endpoint test", False, f"Exception: {e}")

# ============================================================================
# TEST 6: End-to-end happy path
# ============================================================================
print("\n" + "=" * 80)
print("TEST 6: End-to-end Happy Path Verification")
print("=" * 80)

try:
    # 1. Reserve
    print("Step 1: Create reservation")
    e2e_payload = {
        "email": "e2e-test@example.com",
        "origin_url": BASE_URL
    }
    e2e_reserve_resp = requests.post(f"{API_BASE}/launches/{launch_id}/reserve", json=e2e_payload, timeout=15)
    
    if e2e_reserve_resp.status_code == 200:
        e2e_data = e2e_reserve_resp.json()
        e2e_session_id = e2e_data['session_id']
        print(f"✅ Reservation created: {e2e_session_id}")
        
        # 2. Check if webhook endpoint exists
        webhook_test = requests.post(f"{API_BASE}/webhook/stripe", json={"type": "test"}, timeout=5)
        
        if webhook_test.status_code != 404:
            # 3. Simulate webhook
            print("Step 2: Simulate webhook completed")
            e2e_webhook_payload = {
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "id": e2e_session_id,
                        "payment_status": "paid"
                    }
                }
            }
            e2e_webhook_resp = requests.post(f"{API_BASE}/webhook/stripe", json=e2e_webhook_payload, timeout=10)
            print(f"✅ Webhook sent: {e2e_webhook_resp.status_code}")
            
            # 4. Poll status
            print("Step 3: Poll status")
            e2e_status_resp = requests.get(f"{API_BASE}/payments/checkout/status/{e2e_session_id}", timeout=10)
            
            if e2e_status_resp.status_code == 200:
                e2e_status_data = e2e_status_resp.json()
                e2e_reservation = e2e_status_data.get('reservation', {})
                e2e_res_status = e2e_reservation.get('status')
                
                test_result(
                    "END-TO-END: Reserve → Webhook → Poll → Verify 'held'",
                    e2e_res_status == 'held',
                    f"Final reservation status: {e2e_res_status}"
                )
            else:
                test_result("END-TO-END test", False, f"Status poll failed: {e2e_status_resp.status_code}")
        else:
            test_result(
                "END-TO-END test",
                False,
                "Cannot complete end-to-end test: webhook endpoint does not exist"
            )
    else:
        test_result("END-TO-END test", False, f"Reservation failed: {e2e_reserve_resp.status_code}")
        
except Exception as e:
    test_result("END-TO-END test", False, f"Exception: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {total_tests}")
print(f"Passed: {passed_tests} ✅")
print(f"Failed: {failed_tests} ❌")
print(f"Success rate: {(passed_tests/total_tests*100) if total_tests > 0 else 0:.1f}%")
print("=" * 80)

if failed_tests > 0:
    print("\n⚠️  CRITICAL ISSUES FOUND - See failed tests above")
    exit(1)
else:
    print("\n✅ ALL TESTS PASSED")
    exit(0)
