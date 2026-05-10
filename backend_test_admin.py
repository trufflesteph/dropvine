#!/usr/bin/env python3
"""
Backend test for Dropvine Markets Admin Panel (Phase 3)
Tests all /api/market/admin/* endpoints with HMAC token auth (NOT Supabase Auth)
"""
import requests
import json
import time
from datetime import datetime

# Base URL from .env
BASE_URL = "https://luxury-countdown-2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/market/admin"

# Test credentials from /app/.env
PLATFORM_PASSWORD = "changeme-platform"
ORGANISER_PASSWORD = "changeme-organiser"

# Global tokens
platform_token = None
organiser_token = None

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_401_without_token():
    """Test that all endpoints return 401 without admin token"""
    log("TEST: 401 paths without token")
    endpoints = [
        ("GET", "/me"),
        ("GET", "/dashboard"),
        ("GET", "/vendors"),
        ("POST", "/vendors"),
        ("GET", "/dates"),
        ("GET", "/orders"),
        ("GET", "/submissions"),
        ("GET", "/config"),
    ]
    
    for method, path in endpoints:
        try:
            url = f"{API_BASE}{path}"
            if method == "GET":
                r = requests.get(url, timeout=10)
            else:
                r = requests.post(url, json={}, timeout=10)
            
            if r.status_code == 401:
                log(f"  ✅ {method} {path} → 401 (as expected)")
            else:
                log(f"  ❌ {method} {path} → {r.status_code} (expected 401)")
                return False
        except Exception as e:
            log(f"  ❌ {method} {path} failed: {e}")
            return False
    
    return True

def test_login_negative():
    """Test login with wrong password"""
    log("TEST: Login with wrong password")
    try:
        r = requests.post(f"{API_BASE}/login", json={"password": "wrong-password"}, timeout=10)
        if r.status_code == 401:
            data = r.json()
            if "error" in data:
                log(f"  ✅ Login with wrong password → 401 {data}")
                return True
            else:
                log(f"  ❌ Expected error field in response")
                return False
        else:
            log(f"  ❌ Expected 401, got {r.status_code}")
            return False
    except Exception as e:
        log(f"  ❌ Login negative test failed: {e}")
        return False

def test_login_platform():
    """Test login with platform password"""
    global platform_token
    log("TEST: Login with platform password")
    try:
        r = requests.post(f"{API_BASE}/login", json={"password": PLATFORM_PASSWORD}, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok") and data.get("token") and data.get("role") == "platform":
                platform_token = data["token"]
                log(f"  ✅ Platform login successful, role={data['role']}, token={platform_token[:20]}...")
                return True
            else:
                log(f"  ❌ Unexpected response: {data}")
                return False
        else:
            log(f"  ❌ Expected 200, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ Platform login failed: {e}")
        return False

def test_login_organiser():
    """Test login with organiser password"""
    global organiser_token
    log("TEST: Login with organiser password")
    try:
        r = requests.post(f"{API_BASE}/login", json={"password": ORGANISER_PASSWORD}, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok") and data.get("token") and data.get("role") == "organiser":
                organiser_token = data["token"]
                log(f"  ✅ Organiser login successful, role={data['role']}, token={organiser_token[:20]}...")
                return True
            else:
                log(f"  ❌ Unexpected response: {data}")
                return False
        else:
            log(f"  ❌ Expected 200, got {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ Organiser login failed: {e}")
        return False

def test_me_endpoint():
    """Test /me endpoint with both tokens"""
    log("TEST: /me endpoint with tokens")
    
    # Test with platform token
    try:
        headers = {"Authorization": f"Bearer {platform_token}"}
        r = requests.get(f"{API_BASE}/me", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("role") == "platform":
                log(f"  ✅ /me with platform token → role=platform")
            else:
                log(f"  ❌ Expected role=platform, got {data}")
                return False
        else:
            log(f"  ❌ /me with platform token → {r.status_code}")
            return False
    except Exception as e:
        log(f"  ❌ /me platform test failed: {e}")
        return False
    
    # Test with organiser token
    try:
        headers = {"X-Admin-Token": organiser_token}  # Test alternate header
        r = requests.get(f"{API_BASE}/me", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("role") == "organiser":
                log(f"  ✅ /me with organiser token (X-Admin-Token header) → role=organiser")
            else:
                log(f"  ❌ Expected role=organiser, got {data}")
                return False
        else:
            log(f"  ❌ /me with organiser token → {r.status_code}")
            return False
    except Exception as e:
        log(f"  ❌ /me organiser test failed: {e}")
        return False
    
    return True

def test_dashboard():
    """Test /dashboard endpoint"""
    log("TEST: /dashboard endpoint")
    try:
        headers = {"Authorization": f"Bearer {platform_token}"}
        r = requests.get(f"{API_BASE}/dashboard", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            required_keys = ["counts", "recent_orders", "market"]
            if all(k in data for k in required_keys):
                counts = data["counts"]
                log(f"  ✅ Dashboard returned: vendors_total={counts.get('vendors_total')}, orders_total={counts.get('orders_total')}")
                log(f"     Market: {data.get('market', {}).get('name', 'None')}")
                return True
            else:
                log(f"  ❌ Missing required keys. Got: {list(data.keys())}")
                return False
        else:
            log(f"  ❌ Dashboard → {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ Dashboard test failed: {e}")
        return False

def test_vendors_lifecycle():
    """Test vendor CRUD operations"""
    log("TEST: Vendors lifecycle (POST → GET → PATCH → DELETE)")
    headers = {"Authorization": f"Bearer {platform_token}"}
    vendor_id = None
    
    # 1. POST - Create vendor
    try:
        unique_slug = f"agent-test-{int(time.time())}"
        vendor_data = {
            "name": "Agent Test Vendor",
            "slug": unique_slug,
            "tagline": "Test tagline",
            "accepts_preorders": False
        }
        r = requests.post(f"{API_BASE}/vendors", json=vendor_data, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            vendor_id = data.get("vendor", {}).get("id")
            if vendor_id:
                log(f"  ✅ POST /vendors created vendor id={vendor_id}, slug={unique_slug}")
            else:
                log(f"  ❌ No vendor id in response: {data}")
                return False
        else:
            log(f"  ❌ POST /vendors → {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ POST /vendors failed: {e}")
        return False
    
    # 2. GET - Retrieve vendor
    try:
        r = requests.get(f"{API_BASE}/vendors/{vendor_id}", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("vendor", {}).get("id") == vendor_id:
                log(f"  ✅ GET /vendors/{vendor_id} returned vendor with products={len(data.get('products', []))}, posts={len(data.get('posts', []))}")
            else:
                log(f"  ❌ Vendor id mismatch")
                return False
        else:
            log(f"  ❌ GET /vendors/{vendor_id} → {r.status_code}")
            return False
    except Exception as e:
        log(f"  ❌ GET /vendors/{vendor_id} failed: {e}")
        return False
    
    # 3. PATCH - Update vendor
    try:
        update_data = {"tagline": "Updated tagline"}
        r = requests.patch(f"{API_BASE}/vendors/{vendor_id}", json=update_data, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("vendor", {}).get("tagline") == "Updated tagline":
                log(f"  ✅ PATCH /vendors/{vendor_id} updated tagline")
            else:
                log(f"  ❌ Tagline not updated: {data.get('vendor', {}).get('tagline')}")
                return False
        else:
            log(f"  ❌ PATCH /vendors/{vendor_id} → {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ PATCH /vendors/{vendor_id} failed: {e}")
        return False
    
    # 4. DELETE - Soft delete vendor
    try:
        r = requests.delete(f"{API_BASE}/vendors/{vendor_id}", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("vendor", {}).get("is_active") == False:
                log(f"  ✅ DELETE /vendors/{vendor_id} soft-deleted (is_active=false)")
            else:
                log(f"  ❌ Vendor not soft-deleted: is_active={data.get('vendor', {}).get('is_active')}")
                return False
        else:
            log(f"  ❌ DELETE /vendors/{vendor_id} → {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ DELETE /vendors/{vendor_id} failed: {e}")
        return False
    
    return True

def test_dates():
    """Test market dates endpoints"""
    log("TEST: Market dates (GET → PATCH → revert)")
    headers = {"Authorization": f"Bearer {platform_token}"}
    
    # GET dates
    try:
        r = requests.get(f"{API_BASE}/dates", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            dates = data.get("dates", [])
            log(f"  ✅ GET /dates returned {len(dates)} dates")
            
            if len(dates) > 0:
                first_date = dates[0]
                date_id = first_date.get("id")
                original_notes = first_date.get("notes")
                
                # PATCH - Update notes
                try:
                    update_data = {"notes": "agent-test"}
                    r = requests.patch(f"{API_BASE}/dates/{date_id}", json=update_data, headers=headers, timeout=10)
                    if r.status_code == 200:
                        log(f"  ✅ PATCH /dates/{date_id} updated notes to 'agent-test'")
                        
                        # Revert
                        revert_data = {"notes": original_notes}
                        r = requests.patch(f"{API_BASE}/dates/{date_id}", json=revert_data, headers=headers, timeout=10)
                        if r.status_code == 200:
                            log(f"  ✅ Reverted notes back to original")
                        else:
                            log(f"  ⚠️  Failed to revert notes: {r.status_code}")
                    else:
                        log(f"  ❌ PATCH /dates/{date_id} → {r.status_code}: {r.text}")
                        return False
                except Exception as e:
                    log(f"  ❌ PATCH /dates failed: {e}")
                    return False
            else:
                log(f"  ⚠️  No dates to test PATCH on (empty list is OK)")
            
            return True
        else:
            log(f"  ❌ GET /dates → {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ GET /dates failed: {e}")
        return False

def test_orders():
    """Test orders endpoints"""
    log("TEST: Orders (GET list → GET detail → PATCH status → revert → invalid status)")
    headers = {"Authorization": f"Bearer {platform_token}"}
    
    # GET orders list
    try:
        r = requests.get(f"{API_BASE}/orders", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            orders = data.get("orders", [])
            log(f"  ✅ GET /orders returned {len(orders)} orders")
            
            if len(orders) > 0:
                first_order = orders[0]
                order_id = first_order.get("id")
                original_status = first_order.get("status")
                
                # GET order detail
                try:
                    r = requests.get(f"{API_BASE}/orders/{order_id}", headers=headers, timeout=10)
                    if r.status_code == 200:
                        detail = r.json()
                        if "order" in detail:
                            log(f"  ✅ GET /orders/{order_id} returned order with {len(detail['order'].get('order_items', []))} items")
                        else:
                            log(f"  ❌ No order in response")
                            return False
                    else:
                        log(f"  ❌ GET /orders/{order_id} → {r.status_code}")
                        return False
                except Exception as e:
                    log(f"  ❌ GET /orders/{order_id} failed: {e}")
                    return False
                
                # PATCH - Update status to payment_received
                try:
                    update_data = {"status": "payment_received"}
                    r = requests.patch(f"{API_BASE}/orders/{order_id}", json=update_data, headers=headers, timeout=10)
                    if r.status_code == 200:
                        log(f"  ✅ PATCH /orders/{order_id} updated status to 'payment_received'")
                        
                        # Revert to original status
                        revert_data = {"status": original_status}
                        r = requests.patch(f"{API_BASE}/orders/{order_id}", json=revert_data, headers=headers, timeout=10)
                        if r.status_code == 200:
                            log(f"  ✅ Reverted status back to '{original_status}'")
                        else:
                            log(f"  ⚠️  Failed to revert status: {r.status_code}")
                    else:
                        log(f"  ❌ PATCH /orders/{order_id} → {r.status_code}: {r.text}")
                        return False
                except Exception as e:
                    log(f"  ❌ PATCH /orders/{order_id} failed: {e}")
                    return False
                
                # Test invalid status
                try:
                    invalid_data = {"status": "bogus"}
                    r = requests.patch(f"{API_BASE}/orders/{order_id}", json=invalid_data, headers=headers, timeout=10)
                    if r.status_code == 400:
                        log(f"  ✅ PATCH /orders/{order_id} with invalid status → 400 (as expected)")
                    else:
                        log(f"  ❌ Expected 400 for invalid status, got {r.status_code}")
                        return False
                except Exception as e:
                    log(f"  ❌ Invalid status test failed: {e}")
                    return False
            else:
                log(f"  ⚠️  No orders to test PATCH on (empty list is OK)")
            
            return True
        else:
            log(f"  ❌ GET /orders → {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ GET /orders failed: {e}")
        return False

def test_submissions():
    """Test submissions endpoints"""
    log("TEST: Submissions (GET list → invalid type test)")
    headers = {"Authorization": f"Bearer {platform_token}"}
    
    # GET submissions
    try:
        r = requests.get(f"{API_BASE}/submissions", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if "posts" in data and "products" in data:
                log(f"  ✅ GET /submissions returned posts={len(data['posts'])}, products={len(data['products'])}")
            else:
                log(f"  ❌ Missing posts or products in response")
                return False
        else:
            log(f"  ❌ GET /submissions → {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ GET /submissions failed: {e}")
        return False
    
    # Test invalid type
    try:
        r = requests.post(f"{API_BASE}/submissions/foo/bar/approve", headers=headers, timeout=10)
        if r.status_code == 400:
            log(f"  ✅ POST /submissions/foo/bar/approve → 400 (invalid type, as expected)")
        else:
            log(f"  ❌ Expected 400 for invalid type, got {r.status_code}")
            return False
    except Exception as e:
        log(f"  ❌ Invalid type test failed: {e}")
        return False
    
    return True

def test_config_role_gating():
    """Test config endpoint with role-based access control"""
    log("TEST: Config role-gating (GET with organiser → PATCH with organiser → 401/403, PATCH with platform → 200)")
    
    # GET with organiser token (should work)
    try:
        headers = {"Authorization": f"Bearer {organiser_token}"}
        r = requests.get(f"{API_BASE}/config", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            original_subtitle = data.get("config", {}).get("subtitle")
            log(f"  ✅ GET /config with organiser token → 200 (read allowed)")
        else:
            log(f"  ❌ GET /config with organiser → {r.status_code}")
            return False
    except Exception as e:
        log(f"  ❌ GET /config with organiser failed: {e}")
        return False
    
    # PATCH with organiser token (should fail)
    try:
        headers = {"Authorization": f"Bearer {organiser_token}"}
        update_data = {"subtitle": "organiser-attempt"}
        r = requests.patch(f"{API_BASE}/config", json=update_data, headers=headers, timeout=10)
        if r.status_code in [401, 403]:
            log(f"  ✅ PATCH /config with organiser token → {r.status_code} (rejected, as expected)")
        else:
            log(f"  ❌ Expected 401/403 for organiser PATCH, got {r.status_code}")
            return False
    except Exception as e:
        log(f"  ❌ PATCH /config with organiser failed: {e}")
        return False
    
    # PATCH with platform token (should work)
    try:
        headers = {"Authorization": f"Bearer {platform_token}"}
        update_data = {"subtitle": "agent-test-marker"}
        r = requests.patch(f"{API_BASE}/config", json=update_data, headers=headers, timeout=10)
        if r.status_code == 200:
            log(f"  ✅ PATCH /config with platform token → 200 (allowed)")
            
            # Revert
            revert_data = {"subtitle": original_subtitle}
            r = requests.patch(f"{API_BASE}/config", json=revert_data, headers=headers, timeout=10)
            if r.status_code == 200:
                log(f"  ✅ Reverted subtitle back to original")
            else:
                log(f"  ⚠️  Failed to revert subtitle: {r.status_code}")
        else:
            log(f"  ❌ PATCH /config with platform → {r.status_code}: {r.text}")
            return False
    except Exception as e:
        log(f"  ❌ PATCH /config with platform failed: {e}")
        return False
    
    return True

def main():
    log("=" * 80)
    log("DROPVINE MARKETS ADMIN PANEL BACKEND TESTS")
    log("=" * 80)
    
    tests = [
        ("401 paths without token", test_401_without_token),
        ("Login negative (wrong password)", test_login_negative),
        ("Login platform", test_login_platform),
        ("Login organiser", test_login_organiser),
        ("/me endpoint", test_me_endpoint),
        ("/dashboard", test_dashboard),
        ("Vendors lifecycle", test_vendors_lifecycle),
        ("Market dates", test_dates),
        ("Orders", test_orders),
        ("Submissions", test_submissions),
        ("Config role-gating", test_config_role_gating),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        log("")
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
                log(f"❌ TEST FAILED: {name}")
        except Exception as e:
            failed += 1
            log(f"❌ TEST EXCEPTION: {name} - {e}")
    
    log("")
    log("=" * 80)
    log(f"RESULTS: {passed} passed, {failed} failed out of {passed + failed} tests")
    log("=" * 80)
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
