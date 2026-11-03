import pytest


def login(client, username="user", password="password"):
    return client.post("/api/login", json={"username": username, "password": password})


def test_me_requires_login(client):
    assert client.get("/api/me").status_code == 401


def test_login_success_sets_httponly_cookie(client):
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    set_cookie = response.headers["set-cookie"].lower()
    assert set_cookie.startswith("session=")
    assert "httponly" in set_cookie
    assert client.get("/api/me").json() == {"username": "user"}


@pytest.mark.parametrize(
    "username,password", [("user", "wrong"), ("other", "password"), ("", "")]
)
def test_login_rejects_bad_credentials(client, username, password):
    response = login(client, username, password)
    assert response.status_code == 401
    assert "set-cookie" not in response.headers
    assert client.get("/api/me").status_code == 401


def test_login_requires_body(client):
    assert client.post("/api/login", json={}).status_code == 422


def test_logout_clears_session(client):
    login(client)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401


def test_tampered_cookie_rejected(client):
    login(client)
    value = client.cookies["session"]
    client.cookies.clear()
    client.cookies.set("session", value[:-4] + "AAAA")
    assert client.get("/api/me").status_code == 401


def test_forged_cookie_rejected(client):
    client.cookies.set("session", "eyJ1c2VybmFtZSI6ICJ1c2VyIn0=.forged.sig")
    assert client.get("/api/me").status_code == 401
