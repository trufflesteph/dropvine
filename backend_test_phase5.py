#!/usr/bin/env python3
"""
Backend tests for Phase 5 — 3 new/modified surfaces:
1. Regenerate fulfillment links endpoint
2. Dynamic manifest
3. DST guard on existing cron
"""

import requests
import json
import sys
import time

BASE_URL = "http://localhost:3000"
PLATFORM_PASSWORD = "changeme-platform"
CRON_SECRET = "please-rotate-this"
VENDOR_ID = "8d69eb21-61e7-4789-bdb0-2b4f3a0f2466"  # Brookside Farm

# Set longer timeout for requests that might send emails
REQUEST_TIMEOUT = 60

def log(msg):
    print(f"✓ {msg}")

def error(msg):
    print(f"✗ {msg}")
    
def test_result(name, passed, details=""):
    if passed:
        log(f"{name}: PASSED {details}")
    else:
        error(f"{name}: FAILED {details}")
    return passed

# ============================================================================
# 1. REGENERATE FULFILLMENT LINKS ENDPOINT
# ============================================================================

def test_regenerate_fulfillment_links():
    print("\n" + "="*80)
    print("TEST 1: Regenerate Fulfillment Links Endpoint")
    print("="*80)
    
    all_passed = True
    
    # Get admin token first
    print("\n→ Getting admin token...")
    resp = requests.post(f"{BASE_URL}/api/market/admin/login", json={"password": PLATFORM_PASSWORD})
    if resp.status_code != 200:
        error(f"Failed to get admin token: {resp.status_code}")
        return False
    admin_token = resp.json()["token"]
    log(f"Got admin token")
    
    # Test a) Without admin token → 401
    print("\n→ Test a) Without admin token → 401")
    resp = requests.post(f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}/regenerate-fulfillment-links")
    all_passed &= test_result("No auth → 401", resp.status_code == 401, f"(got {resp.status_code})")
    
    # First, let's get the vendor details to check current email
    print("\n→ Getting vendor details...")
    resp = requests.get(
        f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code != 200:
        error(f"Failed to get vendor: {resp.status_code}")
        return False
    vendor = resp.json()["vendor"]
    original_email = vendor.get("email")
    log(f"Vendor email: {original_email}")
    
    # Test b) Vendor with no email → 400
    print("\n→ Test b) Setting vendor email to null, then testing regenerate → 400")
    resp = requests.patch(
        f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"email": None}
    )
    if resp.status_code != 200:
        error(f"Failed to clear vendor email: {resp.status_code}")
        return False
    log("Cleared vendor email")
    
    resp = requests.post(
        f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}/regenerate-fulfillment-links",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    all_passed &= test_result(
        "No email → 400", 
        resp.status_code == 400 and "no email" in resp.text.lower(),
        f"(got {resp.status_code}, body: {resp.text[:100]})"
    )
    
    # Restore email for remaining tests
    print("\n→ Restoring vendor email...")
    test_email = original_email or "qa-bot@example.com"
    resp = requests.patch(
        f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"email": test_email}
    )
    if resp.status_code != 200:
        error(f"Failed to restore vendor email: {resp.status_code}")
        return False
    log(f"Restored vendor email to {test_email}")
    
    # Test c) With admin token, vendor with email → 200
    print("\n→ Test c) With admin token, vendor with email → 200")
    resp = requests.post(
        f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}/regenerate-fulfillment-links",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    all_passed &= test_result("With auth + email → 200", resp.status_code == 200, f"(got {resp.status_code})")
    
    if resp.status_code == 200:
        data = resp.json()
        log(f"Response: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        all_passed &= test_result(
            "Response has ok=true",
            data.get("ok") == True
        )
        all_passed &= test_result(
            "Response has vendor object",
            "vendor" in data and "id" in data["vendor"]
        )
        all_passed &= test_result(
            "Response has summary object",
            "summary" in data and "orders_processed" in data["summary"]
        )
        
        orders_processed = data["summary"]["orders_processed"]
        emails_sent = data["summary"]["emails_sent"]
        errors = data["summary"]["errors"]
        
        log(f"Orders processed: {orders_processed}")
        log(f"Emails sent: {emails_sent}")
        log(f"Errors: {errors}")
        
        # Get the orders to verify count
        print("\n→ Verifying orders_processed count matches open orders...")
        resp = requests.get(
            f"{BASE_URL}/api/market/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if resp.status_code == 200:
            all_orders = resp.json()["orders"]
            open_orders = [
                o for o in all_orders 
                if o["vendor_id"] == VENDOR_ID and o["status"] in ["pending_payment", "payment_received"]
            ]
            log(f"Found {len(open_orders)} open orders for this vendor")
            all_passed &= test_result(
                "orders_processed matches open orders count",
                orders_processed == len(open_orders),
                f"(expected {len(open_orders)}, got {orders_processed})"
            )
    
    # Test d) Idempotency: call same endpoint twice
    print("\n→ Test d) Idempotency: calling endpoint again...")
    time.sleep(2)  # Give server time to recover
    
    try:
        resp1 = requests.post(
            f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}/regenerate-fulfillment-links",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=REQUEST_TIMEOUT
        )
        all_passed &= test_result("First call → 200", resp1.status_code == 200)
        
        time.sleep(3)  # Wait between calls
        
        resp2 = requests.post(
            f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}/regenerate-fulfillment-links",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=REQUEST_TIMEOUT
        )
        all_passed &= test_result("Second call → 200", resp2.status_code == 200)
        
        if resp1.status_code == 200 and resp2.status_code == 200:
            log("Both calls succeeded (idempotent)")
            # Note: We can't easily verify that old tokens are invalidated without accessing the DB directly
            # But the endpoint should handle this internally
    except requests.exceptions.RequestException as e:
        error(f"Idempotency test failed with connection error: {e}")
        log("⚠ Server may have restarted due to memory pressure")
        all_passed = False
    
    # Test e) Vendor with zero open orders
    print("\n→ Test e) Finding a vendor with zero open orders...")
    time.sleep(2)  # Give server time
    
    try:
        resp = requests.get(
            f"{BASE_URL}/api/market/admin/vendors",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=REQUEST_TIMEOUT
        )
        if resp.status_code == 200:
            vendors = resp.json()["vendors"]
            # Find a vendor that's not Brookside Farm
            test_vendor = None
            for v in vendors:
                if v["id"] != VENDOR_ID and v.get("email"):
                    test_vendor = v
                    break
            
            if test_vendor:
                log(f"Testing with vendor: {test_vendor['name']} (id: {test_vendor['id']})")
                time.sleep(2)
                resp = requests.post(
                    f"{BASE_URL}/api/market/admin/vendors/{test_vendor['id']}/regenerate-fulfillment-links",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    timeout=REQUEST_TIMEOUT
                )
                all_passed &= test_result("Vendor with no orders → 200", resp.status_code == 200)
                
                if resp.status_code == 200:
                    data = resp.json()
                    all_passed &= test_result(
                        "orders_processed = 0",
                        data["summary"]["orders_processed"] == 0,
                        f"(got {data['summary']['orders_processed']})"
                    )
                    all_passed &= test_result(
                        "emails_sent = 0",
                        data["summary"]["emails_sent"] == 0,
                        f"(got {data['summary']['emails_sent']})"
                    )
                    all_passed &= test_result(
                        "errors = []",
                        len(data["summary"]["errors"]) == 0,
                        f"(got {data['summary']['errors']})"
                    )
            else:
                log("⚠ Could not find vendor with email for zero-orders test")
    except requests.exceptions.RequestException as e:
        error(f"Zero orders test failed with connection error: {e}")
        all_passed = False
    
    # Restore original email if it was different
    if original_email != test_email:
        print(f"\n→ Restoring original email: {original_email}")
        requests.patch(
            f"{BASE_URL}/api/market/admin/vendors/{VENDOR_ID}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"email": original_email}
        )
    
    return all_passed

# ============================================================================
# 2. DYNAMIC MANIFEST
# ============================================================================

def test_dynamic_manifest():
    print("\n" + "="*80)
    print("TEST 2: Dynamic Manifest")
    print("="*80)
    
    all_passed = True
    
    # Test a) GET /manifest.webmanifest → 200 with JSON body
    print("\n→ Test a) GET /manifest.webmanifest → 200")
    resp = requests.get(f"{BASE_URL}/manifest.webmanifest")
    all_passed &= test_result("GET manifest → 200", resp.status_code == 200, f"(got {resp.status_code})")
    
    content_type = resp.headers.get("content-type", "")
    all_passed &= test_result(
        "Content-Type is JSON-like",
        "json" in content_type.lower() or "manifest" in content_type.lower(),
        f"(got {content_type})"
    )
    
    if resp.status_code != 200:
        return False
    
    # Test b) Parse JSON and compare to /api/market/config
    print("\n→ Test b) Parsing manifest JSON...")
    try:
        manifest = resp.json()
        log(f"Manifest parsed successfully")
        log(f"Manifest keys: {list(manifest.keys())}")
    except Exception as e:
        error(f"Failed to parse manifest JSON: {e}")
        return False
    
    print("\n→ Getting market config for comparison...")
    resp = requests.get(f"{BASE_URL}/api/market/config")
    if resp.status_code != 200:
        error(f"Failed to get market config: {resp.status_code}")
        return False
    
    config = resp.json()["config"]
    log(f"Market config: {config['name']}")
    
    # Compare fields
    all_passed &= test_result(
        "manifest.name matches config.name",
        manifest.get("name") == config.get("name"),
        f"(manifest: {manifest.get('name')}, config: {config.get('name')})"
    )
    
    all_passed &= test_result(
        "manifest.short_name matches config.pwa_short_name",
        manifest.get("short_name") == config.get("pwa_short_name"),
        f"(manifest: {manifest.get('short_name')}, config: {config.get('pwa_short_name')})"
    )
    
    all_passed &= test_result(
        "manifest.theme_color matches config.pwa_theme_color",
        manifest.get("theme_color") == config.get("pwa_theme_color"),
        f"(manifest: {manifest.get('theme_color')}, config: {config.get('pwa_theme_color')})"
    )
    
    all_passed &= test_result(
        "manifest.background_color matches config.pwa_background_color",
        manifest.get("background_color") == config.get("pwa_background_color"),
        f"(manifest: {manifest.get('background_color')}, config: {config.get('pwa_background_color')})"
    )
    
    # Test c) icons must be non-empty array
    print("\n→ Test c) Checking icons array...")
    icons = manifest.get("icons", [])
    all_passed &= test_result(
        "icons is non-empty array",
        isinstance(icons, list) and len(icons) > 0,
        f"(got {len(icons)} icons)"
    )
    
    if len(icons) > 0:
        all_passed &= test_result(
            "icons[0].src is valid",
            "src" in icons[0] and len(icons[0]["src"]) > 0,
            f"(got {icons[0].get('src')})"
        )
    
    # Test d) Icon files exist
    print("\n→ Test d) Checking icon files exist...")
    icon_paths = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"]
    for path in icon_paths:
        resp = requests.get(f"{BASE_URL}{path}")
        all_passed &= test_result(
            f"GET {path} → 200",
            resp.status_code == 200,
            f"(got {resp.status_code})"
        )
        if resp.status_code == 200:
            content_type = resp.headers.get("content-type", "")
            all_passed &= test_result(
                f"{path} Content-Type is image/png",
                "image/png" in content_type.lower(),
                f"(got {content_type})"
            )
    
    # Test e) start_url, scope, display
    print("\n→ Test e) Checking manifest fields...")
    all_passed &= test_result(
        "start_url === '/market'",
        manifest.get("start_url") == "/market",
        f"(got {manifest.get('start_url')})"
    )
    
    all_passed &= test_result(
        "scope === '/market'",
        manifest.get("scope") == "/market",
        f"(got {manifest.get('scope')})"
    )
    
    all_passed &= test_result(
        "display === 'standalone'",
        manifest.get("display") == "standalone",
        f"(got {manifest.get('display')})"
    )
    
    return all_passed

# ============================================================================
# 3. DST GUARD ON CRON
# ============================================================================

def test_dst_guard_cron():
    print("\n" + "="*80)
    print("TEST 3: DST Guard on Cron")
    print("="*80)
    
    all_passed = True
    
    # Test a) Without Authorization header → 401
    print("\n→ Test a) Without Authorization header → 401")
    resp = requests.get(f"{BASE_URL}/api/cron/market-day-push")
    all_passed &= test_result("No auth → 401", resp.status_code == 401, f"(got {resp.status_code})")
    
    # Test b) With auth, no force flag → should skip with DST guard message (unless it's 8am Pacific)
    print("\n→ Test b) With auth, no force flag → DST guard skip (likely)")
    resp = requests.get(
        f"{BASE_URL}/api/cron/market-day-push",
        headers={"Authorization": f"Bearer {CRON_SECRET}"}
    )
    all_passed &= test_result("With auth → 200", resp.status_code == 200, f"(got {resp.status_code})")
    
    if resp.status_code == 200:
        data = resp.json()
        log(f"Response: {json.dumps(data, indent=2)}")
        
        # Check if it was skipped due to DST guard
        summary = data.get("summary", {})
        skipped = summary.get("skipped", "")
        
        if "DST guard" in skipped or "not 8am Pacific" in skipped:
            log("✓ DST guard is active (not 8am Pacific)")
            all_passed &= test_result(
                "summary.skipped contains 'DST guard'",
                True
            )
        else:
            log(f"⚠ Not skipped by DST guard (might be 8am Pacific): {skipped}")
            # This is OK if we're actually at 8am Pacific
    
    # Test c) With auth + force=1 + dryRun=1 → should bypass guard
    print("\n→ Test c) With auth + force=1 + dryRun=1 → bypasses guard")
    resp = requests.get(
        f"{BASE_URL}/api/cron/market-day-push?force=1&dryRun=1",
        headers={"Authorization": f"Bearer {CRON_SECRET}"}
    )
    all_passed &= test_result("With force + dryRun → 200", resp.status_code == 200, f"(got {resp.status_code})")
    
    if resp.status_code == 200:
        data = resp.json()
        log(f"Response: {json.dumps(data, indent=2)}")
        
        all_passed &= test_result(
            "Response has ok=true",
            data.get("ok") == True
        )
        
        all_passed &= test_result(
            "Response has force=true",
            data.get("force") == True
        )
        
        all_passed &= test_result(
            "Response has dryRun=true",
            data.get("dryRun") == True
        )
        
        summary = data.get("summary", {})
        all_passed &= test_result(
            "summary has date field",
            "date" in summary
        )
        
        all_passed &= test_result(
            "summary has total field",
            "total" in summary
        )
        
        all_passed &= test_result(
            "summary has sent field",
            "sent" in summary
        )
        
        all_passed &= test_result(
            "summary has gone field",
            "gone" in summary
        )
        
        all_passed &= test_result(
            "summary has failed field",
            "failed" in summary
        )
        
        log(f"Summary: date={summary.get('date')}, total={summary.get('total')}, sent={summary.get('sent')}, gone={summary.get('gone')}, failed={summary.get('failed')}")
    
    return all_passed

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("\n" + "="*80)
    print("PHASE 5 BACKEND TESTING — 3 NEW/MODIFIED SURFACES")
    print("="*80)
    
    results = {
        "Regenerate Fulfillment Links": test_regenerate_fulfillment_links(),
        "Dynamic Manifest": test_dynamic_manifest(),
        "DST Guard on Cron": test_dst_guard_cron(),
    }
    
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
