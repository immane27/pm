import json
import os
from unittest.mock import MagicMock, patch

import pytest

from app.ai import CHAT_RESPONSE_SCHEMA, MODEL, ChatResult, ask, chat
from app.board import DEFAULT_BOARD


def _fake_response(content):
    message = MagicMock(content=content)
    return MagicMock(choices=[MagicMock(message=message)])


def _fake_chat_response(payload):
    return _fake_response(json.dumps(payload))


@patch("app.ai.OpenAI")
def test_ask_sends_correct_model_and_messages(mock_openai_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _fake_response("4")
    mock_openai_class.return_value = mock_client

    reply = ask("What is 2+2?")

    assert reply == "4"
    mock_client.chat.completions.create.assert_called_once_with(
        model=MODEL,
        messages=[{"role": "user", "content": "What is 2+2?"}],
    )


@patch("app.main.ask")
def test_ai_test_route_returns_reply(mock_ask, signed_in):
    mock_ask.return_value = "4"
    response = signed_in.post("/api/ai/test")
    assert response.status_code == 200
    assert response.json() == {"reply": "4"}
    mock_ask.assert_called_once_with("What is 2+2?")


def test_ai_test_requires_login(client):
    assert client.post("/api/ai/test").status_code == 401


@pytest.mark.live
@pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")
def test_ask_live():
    reply = ask("What is 2+2? Answer with just the number, nothing else.")
    assert "4" in reply


@patch("app.ai.OpenAI")
def test_chat_sends_board_and_history_with_schema(mock_openai_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _fake_chat_response({"reply": "ok", "board": None})
    mock_openai_class.return_value = mock_client

    history = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
    result = chat("add a card", history, DEFAULT_BOARD)

    assert result == ChatResult(reply="ok", board=None)
    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert call_kwargs["model"] == MODEL
    assert call_kwargs["response_format"]["json_schema"]["schema"] == CHAT_RESPONSE_SCHEMA
    messages = call_kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert "card-1" in messages[0]["content"]
    assert messages[1:-1] == history
    assert messages[-1] == {"role": "user", "content": "add a card"}


@patch("app.ai.OpenAI")
def test_chat_parses_returned_board(mock_openai_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    wire_board = {
        "columns": [column.model_dump() for column in DEFAULT_BOARD.columns],
        "cards": [card.model_dump() for card in DEFAULT_BOARD.cards.values()],
    }
    mock_client.chat.completions.create.return_value = _fake_chat_response(
        {"reply": "done", "board": wire_board}
    )
    mock_openai_class.return_value = mock_client

    result = chat("no-op", [], DEFAULT_BOARD)

    assert result.reply == "done"
    assert result.board == DEFAULT_BOARD


@pytest.mark.parametrize(
    "content",
    [
        "not json at all",
        json.dumps({"board": None}),
        json.dumps({"reply": "hi", "board": {"columns": [], "cards": [{"id": "card-1", "title": "", "details": ""}]}}),
        json.dumps(
            {
                "reply": "Moved it.",
                "board": {
                    "columns": [
                        {"id": "col-backlog", "title": "Backlog", "cardIds": []},
                        {"id": "col-discovery", "title": "Discovery", "cardIds": []},
                    ],
                    "cards": [],
                },
            }
        ),
    ],
    ids=["invalid-json", "missing-reply-key", "board-fails-model-validation", "board-drops-columns"],
)
@patch("app.ai.OpenAI")
def test_chat_handles_malformed_ai_response(mock_openai_class, monkeypatch, content):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _fake_response(content)
    mock_openai_class.return_value = mock_client

    result = chat("add a card", [], DEFAULT_BOARD)

    assert result.board is None
    assert result.reply
    # retried once before giving up
    assert mock_client.chat.completions.create.call_count == 2


@patch("app.ai.OpenAI")
def test_chat_retries_once_after_a_malformed_response(mock_openai_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _fake_response("not json at all"),
        _fake_chat_response({"reply": "Added it.", "board": None}),
    ]
    mock_openai_class.return_value = mock_client

    result = chat("add a card", [], DEFAULT_BOARD)

    assert result == ChatResult(reply="Added it.", board=None)
    assert mock_client.chat.completions.create.call_count == 2


@patch("app.ai.OpenAI")
def test_chat_retries_once_after_a_board_that_drops_columns(mock_openai_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    dropped_columns = {
        "reply": "Moved it.",
        "board": {
            "columns": [
                {"id": "col-backlog", "title": "Backlog", "cardIds": []},
                {"id": "col-discovery", "title": "Discovery", "cardIds": []},
            ],
            "cards": [],
        },
    }
    wire_board = {
        "columns": [column.model_dump() for column in DEFAULT_BOARD.columns],
        "cards": [card.model_dump() for card in DEFAULT_BOARD.cards.values()],
    }
    mock_client.chat.completions.create.side_effect = [
        _fake_chat_response(dropped_columns),
        _fake_chat_response({"reply": "Moved it.", "board": wire_board}),
    ]
    mock_openai_class.return_value = mock_client

    result = chat("move all cards to discovery", [], DEFAULT_BOARD)

    assert result.reply == "Moved it."
    assert result.board == DEFAULT_BOARD
    assert mock_client.chat.completions.create.call_count == 2
