import os
from unittest.mock import patch

import pytest

from app.ai import ChatResult
from app.board import DEFAULT_BOARD, Board


def board_json():
    return DEFAULT_BOARD.model_dump(mode="json")


def test_chat_requires_login(client):
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401


@patch("app.main.chat")
def test_reply_only_leaves_board_unchanged(mock_chat, signed_in):
    mock_chat.return_value = ChatResult(reply="There are 8 cards.", board=None)

    response = signed_in.post("/api/chat", json={"message": "How many cards?"})

    assert response.status_code == 200
    assert response.json() == {"reply": "There are 8 cards.", "board": None}
    assert signed_in.get("/api/board").json() == board_json()


@patch("app.main.chat")
def test_create_edit_and_move_in_one_response_is_saved(mock_chat, signed_in):
    board = board_json()
    board["cards"]["card-1"]["title"] = "Edited title"
    board["columns"][0]["cardIds"].remove("card-2")
    board["columns"][4]["cardIds"].append("card-2")
    board["cards"]["card-9"] = {"id": "card-9", "title": "New card", "details": "from AI"}
    board["columns"][0]["cardIds"].append("card-9")
    mock_chat.return_value = ChatResult(reply="Done.", board=Board.model_validate(board))

    response = signed_in.post("/api/chat", json={"message": "make those changes"})

    assert response.status_code == 200
    assert response.json() == {"reply": "Done.", "board": board}
    assert signed_in.get("/api/board").json() == board


@patch("app.main.chat")
def test_invalid_board_rejected_and_not_saved(mock_chat, signed_in):
    board = board_json()
    board["columns"].pop()
    mock_chat.return_value = ChatResult(reply="Removed a column.", board=Board.model_validate(board))

    response = signed_in.post("/api/chat", json={"message": "remove a column"})

    assert response.status_code == 200
    data = response.json()
    assert data["board"] is None
    assert data["reply"].startswith("Removed a column.")
    assert signed_in.get("/api/board").json() == board_json()


@patch("app.main.chat")
def test_history_passed_to_model(mock_chat, signed_in):
    mock_chat.return_value = ChatResult(reply="ok", board=None)
    history = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]

    signed_in.post("/api/chat", json={"message": "add a card", "history": history})

    args = mock_chat.call_args.args
    assert args[0] == "add a card"
    assert args[1] == history
    assert args[2] == DEFAULT_BOARD


@pytest.mark.live
@pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")
def test_chat_live_adds_card(signed_in):
    response = signed_in.post(
        "/api/chat",
        json={
            "message": "Add a new card titled 'Write release notes' with details "
            "'Summarize this week' to the Backlog column."
        },
    )

    assert response.status_code == 200
    before_count = len(board_json()["cards"])
    board = signed_in.get("/api/board").json()
    assert len(board["cards"]) == before_count + 1
    titles = " ".join(card["title"].lower() for card in board["cards"].values())
    assert "release notes" in titles
