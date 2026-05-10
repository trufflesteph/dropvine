#!/usr/bin/env python3
"""
Phase 4 Backend Testing — Tally Webhooks + Vercel Cron + Admin Submissions Fix
Tests all additive Markets module routes. Does NOT touch base Dropvine Direct routes.
"""

import requests
import json
import os
import sys

# Read from .env
BASE_URL = "https://luxury-countdown-2.preview.emergentagent.com"
CRON_SECRET = "please-rotate-this"
PLATFORM_PASSWORD = "changeme-platform"

def log(msg):
    print(f"✓ {msg}")

def fail(msg):
    print(f"✗ {msg}")
    
def test_tally_webhooks():
    """Test Tally webhook endpoints (placeholder mode)"""
    print("\n=== TESTING TALLY WEBHOOKS (Placeholder Mode) ===")
    
    # 1. GET healthcheck for tally-post
    try:
        r = requests.get(f"{BASE_URL}/api/webhooks/tally-post", timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get("ok") == True, f"Expected ok:true, got {data}"
        assert data.get("endpoint") == "tally-post", f"Expected endpoint:tally-post, got {data}"
        assert data.get("secret_configured") == False, f"Expected secret_configured:false (placeholder mode), got {data}"
        log("GET /api/webhooks/tally-post → 200 with correct healthcheck")
    except Exception as e:
        fail(f"GET /api/webhooks/tally-post failed: {e}")
        return False
    
    # 2. GET healthcheck for tally-product
    try:
        r = requests.get(f"{BASE_URL}/api/webhooks/tally-product", timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get("ok") == True, f"Expected ok:true, got {data}"
        assert data.get("endpoint") == "tally-product", f"Expected endpoint:tally-product, got {data}"
        assert data.get("secret_configured") == False, f"Expected secret_configured:false, got {data}"
        log("GET /api/webhooks/tally-product → 200 with correct healthcheck")
    except Exception as e:
        fail(f"GET /api/webhooks/tally-product failed: {e}")
        return False
    
    # 3. POST to tally-post with sample data (no signature, placeholder mode)
    try:
        post_body = {
            "eventId": "agent-test-post-12345",
            "eventType": "FORM_RESPONSE",
            "data": {
                "responseId": "r-post-test",
                "fields": [
                    {"label": "Email", "value": "qa-bot@test.com"},
                    {"label": "What is new?", "value": "Phase 4 backend testing in progress"}
                ]
            }
        }
        r = requests.post(f"{BASE_URL}/api/webhooks/tally-post", 
                         json=post_body, 
                         timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("ok") == True, f"Expected ok:true, got {data}"
        assert "submission_id" in data, f"Expected submission_id in response, got {data}"
        assert data.get("vendor_id") == None, f"Expected vendor_id:null (no match), got {data}"
        assert data.get("placeholder") == True, f"Expected placeholder:true, got {data}"
        post_submission_id = data["submission_id"]
        log(f"POST /api/webhooks/tally-post → 200 with submission_id={post_submission_id}, vendor_id=null, placeholder=true")
    except Exception as e:
        fail(f"POST /api/webhooks/tally-post failed: {e}")
        return False
    
    # 4. POST to tally-product with sample data (no signature, placeholder mode)
    try:
        product_body = {
            "eventId": "agent-test-product-67890",
            "eventType": "FORM_RESPONSE",
            "data": {
                "responseId": "r-prod-test",
                "fields": [
                    {"label": "Email", "value": "qa-bot@test.com"},
                    {"label": "Product name", "value": "Test Heirloom Tomato"},
                    {"label": "Price USD", "value": "5"}
                ]
            }
        }
        r = requests.post(f"{BASE_URL}/api/webhooks/tally-product", 
                         json=product_body, 
                         timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("ok") == True, f"Expected ok:true, got {data}"
        assert "submission_id" in data, f"Expected submission_id in response, got {data}"
        assert data.get("vendor_id") == None, f"Expected vendor_id:null, got {data}"
        assert data.get("placeholder") == True, f"Expected placeholder:true, got {data}"
        product_submission_id = data["submission_id"]
        log(f"POST /api/webhooks/tally-product → 200 with submission_id={product_submission_id}, vendor_id=null, placeholder=true")
    except Exception as e:
        fail(f"POST /api/webhooks/tally-product failed: {e}")
        return False
    
    return True

def test_cron_auth_gating():
    """Test cron endpoints require Bearer token"""
    print("\n=== TESTING CRON AUTH GATING ===")
    
    # 1. GET market-fulfillment-links without auth → 401
    try:
        r = requests.get(f"{BASE_URL}/api/cron/market-fulfillment-links", timeout=10)
        assert r.status_code == 401, f"Expected 401 without auth, got {r.status_code}"
        data = r.json()
        assert "error" in data, f"Expected error in response, got {data}"
        log("GET /api/cron/market-fulfillment-links (no auth) → 401")
    except Exception as e:
        fail(f"Cron auth test failed: {e}")
        return False
    
    # 2. GET market-day-push without auth → 401
    try:
        r = requests.get(f"{BASE_URL}/api/cron/market-day-push", timeout=10)
        assert r.status_code == 401, f"Expected 401 without auth, got {r.status_code}"
        data = r.json()
        assert "error" in data, f"Expected error in response, got {data}"
        log("GET /api/cron/market-day-push (no auth) → 401")
    except Exception as e:
        fail(f"Cron auth test failed: {e}")
        return False
    
    return True

def test_cron_with_auth():
    """Test cron endpoints with proper Bearer token"""
    print("\n=== TESTING CRON ENDPOINTS WITH AUTH ===")
    
    headers = {"Authorization": f"Bearer {CRON_SECRET}"}
    
    # 1. GET market-fulfillment-links with dryRun
    try:
        r = requests.get(f"{BASE_URL}/api/cron/market-fulfillment-links?dryRun=1", 
                        headers=headers, 
                        timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("ok") == True, f"Expected ok:true, got {data}"
        assert data.get("dryRun") == True, f"Expected dryRun:true, got {data}"
        assert "summary" in data, f"Expected summary in response, got {data}"
        summary = data["summary"]
        assert "scanned" in summary, f"Expected scanned in summary, got {summary}"
        assert "links_minted" in summary, f"Expected links_minted in summary, got {summary}"
        assert "emails_sent" in summary, f"Expected emails_sent in summary, got {summary}"
        assert "errors" in summary, f"Expected errors in summary, got {summary}"
        log(f"GET /api/cron/market-fulfillment-links?dryRun=1 → 200 with summary (scanned={summary['scanned']}, links_minted={summary['links_minted']}, emails_sent={summary['emails_sent']})")
    except Exception as e:
        fail(f"Cron fulfillment-links test failed: {e}")
        return False
    
    # 2. GET market-day-push with dryRun and force
    try:
        r = requests.get(f"{BASE_URL}/api/cron/market-day-push?dryRun=1&force=1", 
                        headers=headers, 
                        timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("ok") == True, f"Expected ok:true, got {data}"
        assert data.get("dryRun") == True, f"Expected dryRun:true, got {data}"
        assert data.get("force") == True, f"Expected force:true, got {data}"
        assert "summary" in data, f"Expected summary in response, got {data}"
        summary = data["summary"]
        assert "date" in summary, f"Expected date in summary, got {summary}"
        assert "total" in summary, f"Expected total in summary, got {summary}"
        assert "sent" in summary, f"Expected sent in summary, got {summary}"
        assert "gone" in summary, f"Expected gone in summary, got {summary}"
        assert "failed" in summary, f"Expected failed in summary, got {summary}"
        assert "payload" in data, f"Expected payload in response, got {data}"
        payload = data["payload"]
        assert "title" in payload, f"Expected title in payload, got {payload}"
        assert "body" in payload, f"Expected body in payload, got {payload}"
        assert "url" in payload, f"Expected url in payload, got {payload}"
        log(f"GET /api/cron/market-day-push?dryRun=1&force=1 → 200 with summary (date={summary['date']}, total={summary['total']}) and payload (title={payload['title']})")
    except Exception as e:
        fail(f"Cron market-day-push test failed: {e}")
        return False
    
    return True

def test_admin_submissions_fix():
    """Test admin submissions list includes vendor_id NULL rows (bug fix)"""
    print("\n=== TESTING ADMIN SUBMISSIONS (vendor_id NULL fix) ===")
    
    # 1. Login as platform admin
    try:
        r = requests.post(f"{BASE_URL}/api/market/admin/login", 
                         json={"password": PLATFORM_PASSWORD}, 
                         timeout=10)
        assert r.status_code == 200, f"Login failed: {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("ok") == True, f"Expected ok:true, got {data}"
        assert "token" in data, f"Expected token in response, got {data}"
        admin_token = data["token"]
        log(f"POST /api/market/admin/login → 200 with token")
    except Exception as e:
        fail(f"Admin login failed: {e}")
        return False
    
    # 2. GET submissions list (should include the Tally rows we just created)
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/market/admin/submissions", 
                        headers=headers, 
                        timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "posts" in data, f"Expected posts array in response, got {data}"
        assert "products" in data, f"Expected products array in response, got {data}"
        assert "errors" in data, f"Expected errors object in response, got {data}"
        assert data["errors"]["posts"] == None, f"Expected no posts error, got {data['errors']}"
        assert data["errors"]["products"] == None, f"Expected no products error, got {data['errors']}"
        
        posts = data["posts"]
        products = data["products"]
        
        # Verify the freshly-inserted Tally rows appear
        qa_bot_posts = [p for p in posts if p.get("vendor_email") == "qa-bot@test.com"]
        qa_bot_products = [p for p in products if p.get("vendor_email") == "qa-bot@test.com"]
        
        assert len(qa_bot_posts) > 0, f"Expected at least 1 post submission with vendor_email=qa-bot@test.com, got {len(qa_bot_posts)}"
        assert len(qa_bot_products) > 0, f"Expected at least 1 product submission with vendor_email=qa-bot@test.com, got {len(qa_bot_products)}"
        
        # Verify vendor_id is null for unmatched submissions
        for p in qa_bot_posts:
            assert p.get("vendor_id") == None, f"Expected vendor_id=null for unmatched submission, got {p}"
        for p in qa_bot_products:
            assert p.get("vendor_id") == None, f"Expected vendor_id=null for unmatched submission, got {p}"
        
        log(f"GET /api/market/admin/submissions → 200 with {len(posts)} posts, {len(products)} products")
        log(f"  Found {len(qa_bot_posts)} post submissions with vendor_email=qa-bot@test.com and vendor_id=null")
        log(f"  Found {len(qa_bot_products)} product submissions with vendor_email=qa-bot@test.com and vendor_id=null")
        log("✓ BUG FIX VERIFIED: vendor_id NULL submissions now surface correctly")
        
        # Store IDs for approve/reject tests
        test_post_id = qa_bot_posts[0]["id"] if qa_bot_posts else None
        test_product_id = qa_bot_products[0]["id"] if qa_bot_products else None
        
    except Exception as e:
        fail(f"Admin submissions list test failed: {e}")
        return False
    
    # 3. Approve one post submission
    if test_post_id:
        try:
            r = requests.post(f"{BASE_URL}/api/market/admin/submissions/post/{test_post_id}/approve", 
                            headers=headers, 
                            timeout=10)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
            data = r.json()
            assert "submission" in data, f"Expected submission in response, got {data}"
            submission = data["submission"]
            assert submission.get("status") == "approved", f"Expected status=approved, got {submission}"
            log(f"POST /api/market/admin/submissions/post/{test_post_id}/approve → 200 with status=approved")
        except Exception as e:
            fail(f"Approve post submission failed: {e}")
            return False
    
    # 4. Reject one product submission
    if test_product_id:
        try:
            r = requests.post(f"{BASE_URL}/api/market/admin/submissions/product/{test_product_id}/reject", 
                            headers=headers, 
                            timeout=10)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
            data = r.json()
            assert "submission" in data, f"Expected submission in response, got {data}"
            submission = data["submission"]
            assert submission.get("status") == "rejected", f"Expected status=rejected, got {submission}"
            log(f"POST /api/market/admin/submissions/product/{test_product_id}/reject → 200 with status=rejected")
        except Exception as e:
            fail(f"Reject product submission failed: {e}")
            return False
    
    # 5. Verify GET with status=pending no longer returns those rows
    try:
        r = requests.get(f"{BASE_URL}/api/market/admin/submissions?status=pending", 
                        headers=headers, 
                        timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        pending_posts = data["posts"]
        pending_products = data["products"]
        
        # The approved/rejected submissions should not be in pending list
        if test_post_id:
            assert not any(p["id"] == test_post_id for p in pending_posts), f"Approved post still in pending list"
        if test_product_id:
            assert not any(p["id"] == test_product_id for p in pending_products), f"Rejected product still in pending list"
        
        log(f"GET /api/market/admin/submissions?status=pending → approved/rejected submissions correctly excluded")
    except Exception as e:
        fail(f"Pending submissions filter test failed: {e}")
        return False
    
    # 6. Verify GET with status=approved includes the approved one
    if test_post_id:
        try:
            r = requests.get(f"{BASE_URL}/api/market/admin/submissions?status=approved", 
                            headers=headers, 
                            timeout=10)
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
            data = r.json()
            approved_posts = data["posts"]
            assert any(p["id"] == test_post_id for p in approved_posts), f"Approved post not in approved list"
            log(f"GET /api/market/admin/submissions?status=approved → includes approved post")
        except Exception as e:
            fail(f"Approved submissions filter test failed: {e}")
            return False
    
    return True

def main():
    print("=" * 80)
    print("PHASE 4 BACKEND TESTING — Tally Webhooks + Vercel Cron + Admin Submissions Fix")
    print("=" * 80)
    
    all_passed = True
    
    # Test 1: Tally Webhooks
    if not test_tally_webhooks():
        all_passed = False
    
    # Test 2: Cron Auth Gating
    if not test_cron_auth_gating():
        all_passed = False
    
    # Test 3: Cron with Auth
    if not test_cron_with_auth():
        all_passed = False
    
    # Test 4: Admin Submissions Fix
    if not test_admin_submissions_fix():
        all_passed = False
    
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ ALL PHASE 4 TESTS PASSED")
        print("=" * 80)
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("=" * 80)
        return 1

if __name__ == "__main__":
    sys.exit(main())
