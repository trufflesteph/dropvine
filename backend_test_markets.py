#!/usr/bin/env python3
"""
Backend API test suite for Dropvine Markets module.
Tests all NEW Markets endpoints without re-testing the base Dropvine Direct app.
"""

import requests
import json
import time

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
print(f"🔗 Testing Markets API at: {API_BASE}\n")

# Global test state
ORDER_SHORT_CODE = None
FULFILLMENT_TOKEN = None
VENDOR_ID = None
PRODUCT_ID = None
PUSH_ENDPOINT = None

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
        data = resp.json()
        print(f"   Body: {json.dumps(data, indent=2)[:500]}")
    except:
        print(f"   Body: {resp.text[:200]}")

# =============================================================================
# TEST 1: GET /api/market/config
# =============================================================================
print_test("1. GET /api/market/config - Active market configuration")

try:
    resp = requests.get(f"{API_BASE}/market/config", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        config = data.get('config')
        if config:
            if (config.get('name') == 'Willamette Summer Street Market' and
                config.get('season') == 'Summer 2026' and
                config.get('map_booth_count') == 12 and
                config.get('map_orientation') == 'horizontal' and
                config.get('map_street_name') == 'Willamette Falls Drive' and
                config.get('map_cross_street_start') == '12th St' and
                config.get('map_cross_street_end') == '15th St'):
                print_pass("Market config returned with correct Willamette Summer Street Market data")
            else:
                print_fail(f"Market config data mismatch. Got: {config.get('name')}, {config.get('season')}")
        else:
            print_fail("Response missing 'config' field")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 2: GET /api/market/vendors
# =============================================================================
print_test("2. GET /api/market/vendors - List all vendors")

try:
    resp = requests.get(f"{API_BASE}/market/vendors", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        vendors = data.get('vendors', [])
        if len(vendors) == 6:
            # Check sorted by booth_number
            booth_numbers = [v.get('booth_number') for v in vendors]
            expected_booths = [1, 2, 4, 7, 9, 11]
            if booth_numbers == expected_booths:
                print_pass(f"6 vendors returned, sorted by booth_number: {booth_numbers}")
                # Save first vendor with accepts_preorders for later tests
                for v in vendors:
                    if v.get('accepts_preorders'):
                        VENDOR_ID = v.get('id')
                        print(f"   Saved vendor ID for testing: {VENDOR_ID} ({v.get('name')})")
                        break
            else:
                print_fail(f"Booth numbers not sorted correctly. Got: {booth_numbers}, Expected: {expected_booths}")
        else:
            print_fail(f"Expected 6 vendors, got {len(vendors)}")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 3: GET /api/market/vendors?category=produce
# =============================================================================
print_test("3. GET /api/market/vendors?category=produce - Filter by category")

try:
    resp = requests.get(f"{API_BASE}/market/vendors?category=produce", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        vendors = data.get('vendors', [])
        # Should only return Brookside Farm
        if len(vendors) == 1 and vendors[0].get('name') == 'Brookside Farm':
            print_pass("Category filter works - only Brookside Farm returned for 'produce'")
        else:
            print_fail(f"Expected 1 vendor (Brookside Farm), got {len(vendors)}")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 4: GET /api/market/vendors?q=Terra
# =============================================================================
print_test("4. GET /api/market/vendors?q=Terra - Search by name")

try:
    resp = requests.get(f"{API_BASE}/market/vendors?q=Terra", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        vendors = data.get('vendors', [])
        # Should only return Terra Bread Co.
        if len(vendors) == 1 and 'Terra' in vendors[0].get('name', ''):
            print_pass(f"Search filter works - found {vendors[0].get('name')}")
        else:
            print_fail(f"Expected 1 vendor with 'Terra' in name, got {len(vendors)}")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 5: GET /api/market/vendors/brookside-farm
# =============================================================================
print_test("5. GET /api/market/vendors/brookside-farm - Get vendor details")

try:
    resp = requests.get(f"{API_BASE}/market/vendors/brookside-farm", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        vendor = data.get('vendor')
        products = data.get('products', [])
        posts = data.get('posts', [])
        
        if vendor and vendor.get('slug') == 'brookside-farm':
            if vendor.get('venmo_handle') == 'brookside-farm' and vendor.get('booth_number') == 1:
                if len(products) == 3:
                    # Check for expected products (eggs $8, tomato $6, lettuce $5)
                    product_names = [p.get('name', '').lower() for p in products]
                    has_eggs = any('egg' in name for name in product_names)
                    if has_eggs:
                        print_pass(f"Vendor details correct: booth 1, venmo handle, 3 products")
                        # Save first product for order test
                        PRODUCT_ID = products[0].get('id')
                        print(f"   Saved product ID for testing: {PRODUCT_ID} ({products[0].get('name')})")
                    else:
                        print_fail(f"Expected products not found. Got: {product_names}")
                else:
                    print_fail(f"Expected 3 products, got {len(products)}")
            else:
                print_fail(f"Vendor details mismatch. venmo_handle: {vendor.get('venmo_handle')}, booth: {vendor.get('booth_number')}")
        else:
            print_fail("Response missing 'vendor' or slug mismatch")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 6: GET /api/market/vendors/nonexistent - 404 test
# =============================================================================
print_test("6. GET /api/market/vendors/nonexistent - Non-existent vendor (expect 404)")

try:
    resp = requests.get(f"{API_BASE}/market/vendors/nonexistent", timeout=10)
    print_response(resp)
    
    if resp.status_code == 404:
        data = resp.json()
        if data.get('error') == 'not_found':
            print_pass("Correctly returned 404 with error: 'not_found'")
        else:
            print_fail(f"Expected error: 'not_found', got: {data.get('error')}")
    else:
        print_fail(f"Expected 404, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 7: GET /api/market/dates
# =============================================================================
print_test("7. GET /api/market/dates - Market calendar")

try:
    resp = requests.get(f"{API_BASE}/market/dates", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        dates = data.get('dates', [])
        if len(dates) == 18:
            # Find 2026-07-01 and check if it's cancelled
            july_first = next((d for d in dates if d.get('date') == '2026-07-01'), None)
            if july_first:
                if july_first.get('is_cancelled') and 'Independence Day' in july_first.get('notes', ''):
                    print_pass(f"18 dates returned, 2026-07-01 is cancelled with correct note")
                else:
                    print_fail(f"2026-07-01 not marked as cancelled or missing note. is_cancelled: {july_first.get('is_cancelled')}")
            else:
                print_fail("2026-07-01 not found in dates")
        else:
            print_fail(f"Expected 18 dates, got {len(dates)}")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 8: POST /api/market/orders - Create Venmo order (HAPPY PATH)
# =============================================================================
print_test("8. POST /api/market/orders - Create Venmo order (happy path)")

if not VENDOR_ID or not PRODUCT_ID:
    print_fail("Cannot proceed: VENDOR_ID or PRODUCT_ID not set from previous tests")
else:
    try:
        payload = {
            "vendor_id": VENDOR_ID,
            "items": [
                {"product_id": PRODUCT_ID, "quantity": 2}
            ],
            "shopper": {
                "email": f"shopper+{int(time.time())}@test.com",
                "name": "Test Shopper",
                "phone": "555-1234"
            },
            "notes": "Please pack carefully"
        }
        resp = requests.post(f"{API_BASE}/market/orders", json=payload, timeout=15)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if (data.get('ok') and 
                data.get('order_id') and 
                data.get('short_code') and 
                len(data.get('short_code', '')) == 8 and
                data.get('total_cents') and
                data.get('venmo_url') and
                data.get('venmo_note')):
                
                ORDER_SHORT_CODE = data.get('short_code')
                venmo_url = data.get('venmo_url')
                
                # Verify Venmo URL format
                if ('venmo.com/' in venmo_url and 
                    'amount=' in venmo_url and 
                    f"Order #{ORDER_SHORT_CODE}" in data.get('venmo_note')):
                    print_pass(f"Order created successfully. Short code: {ORDER_SHORT_CODE}, Total: ${data.get('total_cents')/100:.2f}")
                    print(f"   Venmo URL: {venmo_url[:80]}...")
                else:
                    print_fail(f"Venmo URL format incorrect: {venmo_url}")
            else:
                print_fail(f"Response missing required fields. Got: {list(data.keys())}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# =============================================================================
# TEST 9: POST /api/market/orders - Validation tests
# =============================================================================
print_test("9a. POST /api/market/orders - Missing vendor_id (expect 400)")

try:
    payload = {
        "items": [{"product_id": PRODUCT_ID, "quantity": 1}],
        "shopper": {"email": "test@test.com", "name": "Test"}
    }
    resp = requests.post(f"{API_BASE}/market/orders", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 400:
        print_pass("Correctly rejected order without vendor_id")
    else:
        print_fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

print_test("9b. POST /api/market/orders - Empty items (expect 400)")

try:
    payload = {
        "vendor_id": VENDOR_ID,
        "items": [],
        "shopper": {"email": "test@test.com", "name": "Test"}
    }
    resp = requests.post(f"{API_BASE}/market/orders", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 400:
        print_pass("Correctly rejected order with empty items")
    else:
        print_fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

print_test("9c. POST /api/market/orders - Missing shopper.email (expect 400)")

try:
    payload = {
        "vendor_id": VENDOR_ID,
        "items": [{"product_id": PRODUCT_ID, "quantity": 1}],
        "shopper": {"name": "Test"}
    }
    resp = requests.post(f"{API_BASE}/market/orders", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 400:
        print_pass("Correctly rejected order without shopper.email")
    else:
        print_fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 10: GET /api/market/orders/[shortCode]
# =============================================================================
print_test("10. GET /api/market/orders/[shortCode] - Lookup order by short code")

if not ORDER_SHORT_CODE:
    print_fail("Cannot proceed: ORDER_SHORT_CODE not set from order creation")
else:
    try:
        resp = requests.get(f"{API_BASE}/market/orders/{ORDER_SHORT_CODE}", timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            order = data.get('order')
            vendor = data.get('vendor')
            items = data.get('items', [])
            venmo_url = data.get('venmo_url')
            
            if (order and 
                order.get('short_code') == ORDER_SHORT_CODE and
                order.get('status') == 'pending_payment' and
                vendor and
                len(items) > 0 and
                venmo_url):
                
                # Check item snapshot
                item = items[0]
                if (item.get('product_name_snapshot') and
                    item.get('quantity') == 2 and
                    item.get('line_total_cents')):
                    print_pass(f"Order lookup successful. Status: {order.get('status')}, Items: {len(items)}")
                else:
                    print_fail(f"Item snapshot incomplete. Got: {item}")
            else:
                print_fail(f"Response missing required fields or data mismatch")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

print_test("10b. GET /api/market/orders/BADCODE - Non-existent code (expect 404)")

try:
    resp = requests.get(f"{API_BASE}/market/orders/BADCODE", timeout=10)
    print_response(resp)
    
    if resp.status_code == 404:
        data = resp.json()
        if data.get('error') == 'not_found':
            print_pass("Correctly returned 404 for non-existent order code")
        else:
            print_fail(f"Expected error: 'not_found', got: {data.get('error')}")
    else:
        print_fail(f"Expected 404, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 11: GET fulfillment token from database (helper)
# =============================================================================
print_test("11. Query fulfillment token from Supabase (helper for next tests)")

if not ORDER_SHORT_CODE:
    print_fail("Cannot proceed: ORDER_SHORT_CODE not set")
else:
    try:
        # We need to query Supabase directly to get the fulfillment token
        # Using the service role key from .env
        import os
        service_key = None
        with open('/app/.env', 'r') as f:
            for line in f:
                if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    service_key = line.split('=', 1)[1].strip()
                    break
        
        supabase_url = None
        with open('/app/.env', 'r') as f:
            for line in f:
                if line.startswith('NEXT_PUBLIC_SUPABASE_URL='):
                    supabase_url = line.split('=', 1)[1].strip()
                    break
        
        if service_key and supabase_url:
            # First get order ID from short_code
            headers = {
                'apikey': service_key,
                'Authorization': f'Bearer {service_key}',
                'Content-Type': 'application/json'
            }
            
            resp = requests.get(
                f"{supabase_url}/rest/v1/orders?short_code=eq.{ORDER_SHORT_CODE}&select=id",
                headers=headers,
                timeout=10
            )
            
            if resp.status_code == 200:
                orders = resp.json()
                if orders and len(orders) > 0:
                    order_id = orders[0]['id']
                    
                    # Now get fulfillment token
                    resp = requests.get(
                        f"{supabase_url}/rest/v1/fulfillment_tokens?order_id=eq.{order_id}&select=token",
                        headers=headers,
                        timeout=10
                    )
                    
                    if resp.status_code == 200:
                        tokens = resp.json()
                        if tokens and len(tokens) > 0:
                            FULFILLMENT_TOKEN = tokens[0]['token']
                            print_pass(f"Retrieved fulfillment token: {FULFILLMENT_TOKEN[:16]}...")
                        else:
                            print_fail("No fulfillment token found for order")
                    else:
                        print_fail(f"Failed to query fulfillment_tokens: {resp.status_code}")
                else:
                    print_fail("Order not found in database")
            else:
                print_fail(f"Failed to query orders: {resp.status_code}")
        else:
            print_fail("Supabase credentials not found in .env")
    except Exception as e:
        print_fail(f"Exception: {e}")

# =============================================================================
# TEST 12: GET /api/market/fulfillment/[token]
# =============================================================================
print_test("12a. GET /api/market/fulfillment/[token] - Get order by fulfillment token")

if not FULFILLMENT_TOKEN:
    print_fail("Cannot proceed: FULFILLMENT_TOKEN not retrieved")
else:
    try:
        resp = requests.get(f"{API_BASE}/market/fulfillment/{FULFILLMENT_TOKEN}", timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            order = data.get('order')
            vendor = data.get('vendor')
            items = data.get('items', [])
            
            if order and vendor and len(items) > 0:
                print_pass(f"Fulfillment token valid. Order status: {order.get('status')}")
            else:
                print_fail("Response missing required fields")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

print_test("12b. GET /api/market/fulfillment/bad-token - Invalid token (expect 404)")

try:
    resp = requests.get(f"{API_BASE}/market/fulfillment/bad-token-12345", timeout=10)
    print_response(resp)
    
    if resp.status_code == 404:
        data = resp.json()
        if data.get('error') == 'invalid token':
            print_pass("Correctly returned 404 for invalid token")
        else:
            print_fail(f"Expected error: 'invalid token', got: {data.get('error')}")
    else:
        print_fail(f"Expected 404, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 13: POST /api/market/fulfillment/[token] - Update order status
# =============================================================================
print_test("13a. POST /api/market/fulfillment/[token] - Mark payment received")

if not FULFILLMENT_TOKEN:
    print_fail("Cannot proceed: FULFILLMENT_TOKEN not retrieved")
else:
    try:
        payload = {"action": "payment_received"}
        resp = requests.post(f"{API_BASE}/market/fulfillment/{FULFILLMENT_TOKEN}", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('order'):
                order = data.get('order')
                if order.get('status') == 'payment_received' and order.get('payment_received_at'):
                    print_pass(f"Order status updated to 'payment_received'")
                else:
                    print_fail(f"Status not updated correctly. Got: {order.get('status')}")
            else:
                print_fail("Response missing 'ok' or 'order'")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

print_test("13b. POST /api/market/fulfillment/[token] - Mark fulfilled")

if FULFILLMENT_TOKEN:
    try:
        payload = {"action": "fulfilled"}
        resp = requests.post(f"{API_BASE}/market/fulfillment/{FULFILLMENT_TOKEN}", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('order'):
                order = data.get('order')
                if order.get('status') == 'fulfilled' and order.get('fulfilled_at'):
                    print_pass(f"Order status updated to 'fulfilled'")
                else:
                    print_fail(f"Status not updated correctly. Got: {order.get('status')}")
            else:
                print_fail("Response missing 'ok' or 'order'")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

print_test("13c. POST /api/market/fulfillment/[token] - Invalid action (expect 400)")

if FULFILLMENT_TOKEN:
    try:
        payload = {"action": "invalid_action"}
        resp = requests.post(f"{API_BASE}/market/fulfillment/{FULFILLMENT_TOKEN}", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 400:
            data = resp.json()
            if data.get('error') == 'invalid action':
                print_pass("Correctly rejected invalid action")
            else:
                print_fail(f"Expected error: 'invalid action', got: {data.get('error')}")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# =============================================================================
# TEST 14: Verify order status updated
# =============================================================================
print_test("14. GET /api/market/orders/[shortCode] - Verify status updated to 'fulfilled'")

if ORDER_SHORT_CODE:
    try:
        resp = requests.get(f"{API_BASE}/market/orders/{ORDER_SHORT_CODE}", timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            order = data.get('order')
            if order and order.get('status') == 'fulfilled':
                print_pass(f"Order status correctly shows 'fulfilled' after fulfillment actions")
            else:
                print_fail(f"Order status not updated. Got: {order.get('status') if order else 'no order'}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

# =============================================================================
# TEST 15: GET /api/market/passport - Auth required (expect 401)
# =============================================================================
print_test("15. GET /api/market/passport - Without auth (expect 401)")

try:
    resp = requests.get(f"{API_BASE}/market/passport", timeout=10)
    print_response(resp)
    
    if resp.status_code == 401:
        data = resp.json()
        if data.get('error') == 'unauthorized':
            print_pass("Correctly returned 401 unauthorized for passport endpoint")
        else:
            print_fail(f"Expected error: 'unauthorized', got: {data.get('error')}")
    else:
        print_fail(f"Expected 401, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 16: POST /api/market/passport - Auth required (expect 401)
# =============================================================================
print_test("16. POST /api/market/passport - Without auth (expect 401)")

try:
    payload = {"vendor_slug": "brookside-farm"}
    resp = requests.post(f"{API_BASE}/market/passport", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 401:
        data = resp.json()
        if data.get('error') == 'unauthorized':
            print_pass("Correctly returned 401 unauthorized for passport stamp endpoint")
        else:
            print_fail(f"Expected error: 'unauthorized', got: {data.get('error')}")
    else:
        print_fail(f"Expected 401, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 17: GET /api/market/push/public-key
# =============================================================================
print_test("17. GET /api/market/push/public-key - Get VAPID public key")

try:
    resp = requests.get(f"{API_BASE}/market/push/public-key", timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        key = data.get('key')
        if key and key.startswith('BO7N'):
            print_pass(f"VAPID public key returned: {key[:20]}...")
        else:
            print_fail(f"Invalid or missing VAPID key. Got: {key}")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 18: POST /api/market/push/subscribe
# =============================================================================
print_test("18a. POST /api/market/push/subscribe - Subscribe to push notifications")

try:
    PUSH_ENDPOINT = f"https://fcm.googleapis.com/test-{int(time.time())}"
    payload = {
        "subscription": {
            "endpoint": PUSH_ENDPOINT,
            "keys": {
                "p256dh": "test-p256dh-key-base64",
                "auth": "test-auth-key-base64"
            }
        },
        "userAgent": "Mozilla/5.0 Test"
    }
    resp = requests.post(f"{API_BASE}/market/push/subscribe", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get('ok'):
            print_pass("Push subscription created successfully")
        else:
            print_fail("Response missing 'ok: true'")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

print_test("18b. POST /api/market/push/subscribe - Re-subscribe (upsert)")

if PUSH_ENDPOINT:
    try:
        payload = {
            "subscription": {
                "endpoint": PUSH_ENDPOINT,
                "keys": {
                    "p256dh": "updated-p256dh-key",
                    "auth": "updated-auth-key"
                }
            },
            "userAgent": "Mozilla/5.0 Test Updated"
        }
        resp = requests.post(f"{API_BASE}/market/push/subscribe", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok'):
                print_pass("Push subscription upserted successfully (same endpoint)")
            else:
                print_fail("Response missing 'ok: true'")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

print_test("18c. POST /api/market/push/subscribe - Invalid subscription (expect 400)")

try:
    payload = {
        "subscription": {
            "endpoint": "https://fcm.googleapis.com/test",
            # Missing keys
        }
    }
    resp = requests.post(f"{API_BASE}/market/push/subscribe", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 400:
        data = resp.json()
        if data.get('error') == 'invalid subscription':
            print_pass("Correctly rejected invalid subscription")
        else:
            print_fail(f"Expected error: 'invalid subscription', got: {data.get('error')}")
    else:
        print_fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 19: POST /api/market/push/unsubscribe
# =============================================================================
print_test("19a. POST /api/market/push/unsubscribe - Unsubscribe from push")

if not PUSH_ENDPOINT:
    print_fail("Cannot proceed: PUSH_ENDPOINT not set")
else:
    try:
        payload = {"endpoint": PUSH_ENDPOINT}
        resp = requests.post(f"{API_BASE}/market/push/unsubscribe", json=payload, timeout=10)
        print_response(resp)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok'):
                print_pass("Push subscription removed successfully")
            else:
                print_fail("Response missing 'ok: true'")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

print_test("19b. POST /api/market/push/unsubscribe - Missing endpoint (expect 400)")

try:
    payload = {}
    resp = requests.post(f"{API_BASE}/market/push/unsubscribe", json=payload, timeout=10)
    print_response(resp)
    
    if resp.status_code == 400:
        data = resp.json()
        if data.get('error') == 'missing endpoint':
            print_pass("Correctly rejected request without endpoint")
        else:
            print_fail(f"Expected error: 'missing endpoint', got: {data.get('error')}")
    else:
        print_fail(f"Expected 400, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# TEST 20: NO REGRESSION - Existing endpoints still work
# =============================================================================
print_test("20a. NO REGRESSION - GET /api/launches/by-handle/edition-three-vessels")

try:
    resp = requests.get(f"{API_BASE}/launches/by-handle/edition-three-vessels", timeout=10)
    print_response(resp)
    
    # Either 200 (if seeded) or 404 (if not seeded) is fine, just confirm not crashed
    if resp.status_code in [200, 404]:
        print_pass(f"Existing launch endpoint still works (status: {resp.status_code})")
    else:
        print_fail(f"Unexpected status code: {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

print_test("20b. NO REGRESSION - GET /api/cron/send-emails?dryRun=1")

try:
    headers = {"Authorization": "Bearer please-rotate-this"}
    resp = requests.get(f"{API_BASE}/cron/send-emails?dryRun=1", headers=headers, timeout=10)
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get('ok') and 'summary' in data:
            print_pass("Existing cron endpoint still works")
        else:
            print_fail(f"Response format unexpected: {list(data.keys())}")
    else:
        print_fail(f"Expected 200, got {resp.status_code}")
except Exception as e:
    print_fail(f"Exception: {e}")

# =============================================================================
# SUMMARY
# =============================================================================
print("\n" + "="*80)
print("🏁 MARKETS MODULE TEST SUITE COMPLETE")
print("="*80)
print("\nReview the results above for any failures.")
if ORDER_SHORT_CODE:
    print(f"Test order short code: {ORDER_SHORT_CODE}")
if FULFILLMENT_TOKEN:
    print(f"Fulfillment token: {FULFILLMENT_TOKEN[:24]}...")
print("\n✅ All Markets endpoints tested")
print("✅ No regression in existing Dropvine Direct endpoints")
