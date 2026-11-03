import pytest

from app.board import DEFAULT_BOARD, validate_board


def board_json():
    return DEFAULT_BOARD.model_dump(mode="json")


def test_board_requires_login(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json=board_json()).status_code == 401


def test_first_get_returns_default_board(signed_in):
    response = signed_in.get("/api/board")
    assert response.status_code == 200
    assert response.json() == board_json()


def test_put_then_get_round_trip(signed_in):
    board = board_json()
    board["columns"][0]["title"] = "Ideas"
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][4]["cardIds"].insert(0, "card-1")
    board["cards"]["card-9"] = {"id": "card-9", "title": "New", "details": ""}
    board["columns"][1]["cardIds"].append("card-9")
    board["cards"]["card-2"]["title"] = "Edited"
    del board["cards"]["card-3"]
    board["columns"][1]["cardIds"].remove("card-3")

    response = signed_in.put("/api/board", json=board)
    assert response.status_code == 200
    assert response.json() == board
    assert signed_in.get("/api/board").json() == board


def test_board_persists_across_app_restart(client, db_path):
    from fastapi.testclient import TestClient

    from app.main import app

    client.post("/api/login", json={"username": "user", "password": "password"})
    board = board_json()
    board["columns"][2]["title"] = "Doing"
    client.put("/api/board", json=board)

    with TestClient(app) as fresh:
        fresh.post("/api/login", json={"username": "user", "password": "password"})
        assert fresh.get("/api/board").json()["columns"][2]["title"] == "Doing"
    assert db_path.exists()


def invalid(mutate):
    board = board_json()
    mutate(board)
    return board


@pytest.mark.parametrize(
    "board",
    [
        invalid(lambda b: b["columns"].pop()),
        invalid(lambda b: b["columns"].reverse()),
        invalid(lambda b: b["columns"][0].update(id="col-other")),
        invalid(lambda b: b["columns"][1]["cardIds"].append("card-1")),
        invalid(lambda b: b["columns"][0]["cardIds"].append("card-missing")),
        invalid(lambda b: b["columns"][0]["cardIds"].remove("card-1")),
        invalid(lambda b: b["cards"]["card-1"].update(id="card-x")),
        invalid(lambda b: b["cards"]["card-1"].update(title="")),
        invalid(lambda b: b["cards"]["card-1"].pop("details")),
        invalid(lambda b: b.pop("cards")),
    ],
    ids=[
        "too-few-columns",
        "reordered-columns",
        "renamed-column-id",
        "duplicate-card",
        "unknown-card",
        "orphan-card",
        "card-id-mismatch",
        "empty-title",
        "missing-details",
        "missing-cards",
    ],
)
def test_invalid_board_rejected_and_not_saved(signed_in, board):
    response = signed_in.put("/api/board", json=board)
    assert response.status_code == 422
    assert signed_in.get("/api/board").json() == board_json()


def test_default_board_is_valid():
    validate_board(DEFAULT_BOARD, DEFAULT_BOARD)
