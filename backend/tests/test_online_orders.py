"""Backend tests for Aggregator (Swiggy/Zomato) POS demo."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hybrid-dine-pay.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@pos.com", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["email"] == "admin@pos.com"
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Auth ---
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@pos.com", "password": "admin123"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "admin"
        assert isinstance(data["token"], str) and len(data["token"]) > 0
        # httpOnly cookie should be set
        assert "access_token" in r.cookies

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@pos.com", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_cashier_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "cashier@pos.com", "password": "cashier123"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "cashier"

    def test_me_endpoint(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@pos.com"

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# --- Online Orders listing & demo seed ---
class TestOnlineOrdersList:
    def test_list_returns_orders(self, auth_headers):
        r = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list)
        assert len(orders) >= 8, f"Expected at least 8 demo orders, got {len(orders)}"

    def test_demo_seed_customers_present(self, auth_headers):
        r = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15)
        names = {o["customer_name"] for o in r.json()}
        expected = {"Aarav Khanna", "Ishita Mehra", "Rohit Sharma", "Priya Raghavan",
                    "Vikram Joshi", "Neha Patel", "Karan Verma", "Sneha Iyer"}
        missing = expected - names
        assert not missing, f"Missing demo customers: {missing}"

    def test_demo_seed_status_coverage(self, auth_headers):
        r = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15)
        statuses = {o["status"] for o in r.json()}
        for s in ["incoming", "accepted", "dispatched", "rejected"]:
            assert s in statuses, f"Status '{s}' missing from demo data"

    def test_demo_seed_platforms(self, auth_headers):
        r = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15)
        platforms = {o["platform"] for o in r.json()}
        assert "swiggy" in platforms and "zomato" in platforms

    def test_no_mongo_id_leak(self, auth_headers):
        r = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15)
        for o in r.json():
            assert "_id" not in o


# --- Simulate / Accept / Reject / Dispatch ---
class TestOnlineOrderActions:
    def test_simulate_swiggy(self, auth_headers):
        r = requests.post(f"{API}/online-orders/simulate", json={"platform": "swiggy"}, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        o = r.json()
        assert o["platform"] == "swiggy"
        assert o["status"] == "incoming"
        assert o["external_id"].startswith("SWI-")
        assert o["total"] > 0
        assert isinstance(o["items"], list) and len(o["items"]) >= 1

    def test_simulate_zomato(self, auth_headers):
        r = requests.post(f"{API}/online-orders/simulate", json={"platform": "zomato"}, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        o = r.json()
        assert o["platform"] == "zomato"
        assert o["external_id"].startswith("ZOM-")

    def test_accept_creates_pos_order(self, auth_headers):
        sim = requests.post(f"{API}/online-orders/simulate", json={"platform": "swiggy"}, headers=auth_headers, timeout=15).json()
        oid = sim["id"]
        r = requests.post(f"{API}/online-orders/{oid}/accept", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "order_id" in body
        # Verify status changed
        listed = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15).json()
        target = next((o for o in listed if o["id"] == oid), None)
        assert target and target["status"] == "accepted"
        # Verify POS order created
        order_resp = requests.get(f"{API}/orders/{body['order_id']}", headers=auth_headers, timeout=15)
        assert order_resp.status_code == 200
        assert order_resp.json()["type"] == "swiggy"

    def test_reject(self, auth_headers):
        sim = requests.post(f"{API}/online-orders/simulate", json={"platform": "zomato"}, headers=auth_headers, timeout=15).json()
        oid = sim["id"]
        r = requests.post(f"{API}/online-orders/{oid}/reject", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        listed = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15).json()
        target = next((o for o in listed if o["id"] == oid), None)
        assert target["status"] == "rejected"

    def test_dispatch(self, auth_headers):
        sim = requests.post(f"{API}/online-orders/simulate", json={"platform": "swiggy"}, headers=auth_headers, timeout=15).json()
        oid = sim["id"]
        requests.post(f"{API}/online-orders/{oid}/accept", headers=auth_headers, timeout=15)
        r = requests.post(f"{API}/online-orders/{oid}/dispatch", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        listed = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15).json()
        target = next((o for o in listed if o["id"] == oid), None)
        assert target["status"] == "dispatched"

    def test_accept_sets_accepted_at(self, auth_headers):
        """Verify the accept endpoint stamps accepted_at on the online_orders document (SLA timer source)."""
        sim = requests.post(f"{API}/online-orders/simulate", json={"platform": "swiggy"}, headers=auth_headers, timeout=15).json()
        oid = sim["id"]
        # Before accept: accepted_at should not exist (or be None)
        assert not sim.get("accepted_at")
        r = requests.post(f"{API}/online-orders/{oid}/accept", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        listed = requests.get(f"{API}/online-orders", headers=auth_headers, timeout=15).json()
        target = next((o for o in listed if o["id"] == oid), None)
        assert target is not None, "Accepted order not found in listing"
        assert target["status"] == "accepted"
        assert target.get("accepted_at"), "accepted_at field not set after accept"
        # Should be ISO string
        assert isinstance(target["accepted_at"], str) and "T" in target["accepted_at"]

    def test_accept_nonexistent(self, auth_headers):
        r = requests.post(f"{API}/online-orders/non-existent-id/accept", headers=auth_headers, timeout=15)
        assert r.status_code == 404

    def test_simulate_requires_auth(self):
        r = requests.post(f"{API}/online-orders/simulate", json={"platform": "swiggy"}, timeout=15)
        assert r.status_code == 401
