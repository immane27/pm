import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from app.board import Board, validate_board

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

MODEL = "openai/gpt-oss-120b"

CARD_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "details": {"type": "string"},
    },
    "required": ["id", "title", "details"],
    "additionalProperties": False,
}

COLUMN_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "cardIds": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["id", "title", "cardIds"],
    "additionalProperties": False,
}

# cards as a list (not the stored id-keyed dict) so the schema can stay strict
# (additionalProperties: False) without a dynamic set of property names.
BOARD_SCHEMA = {
    "type": ["object", "null"],
    "properties": {
        "columns": {"type": "array", "items": COLUMN_SCHEMA},
        "cards": {"type": "array", "items": CARD_SCHEMA},
    },
    "required": ["columns", "cards"],
    "additionalProperties": False,
}

CHAT_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "board": BOARD_SCHEMA,
    },
    "required": ["reply", "board"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = (
    "You are an assistant that manages a kanban board. You can create cards, edit "
    "card titles and details, and move cards between columns. Columns are fixed: "
    "never add, remove, reorder, or rename columns. Whenever your reply describes "
    "making a change, you must include the full updated board (every column and "
    "every card, including ones you did not change) in `board` in that same "
    "response - never say a change was made without also including it. If no "
    "change is needed, set `board` to null."
)

MAX_ATTEMPTS = 2


class ChatResult(BaseModel):
    reply: str
    board: Board | None = None


def ask(message: str) -> str:
    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": message}],
    )
    return response.choices[0].message.content


def _board_to_wire(board: Board) -> dict:
    return {
        "columns": [column.model_dump() for column in board.columns],
        "cards": [card.model_dump() for card in board.cards.values()],
    }


def _wire_to_board(data: dict) -> Board:
    cards = {card["id"]: card for card in data["cards"]}
    return Board.model_validate({"columns": data["columns"], "cards": cards})


def chat(message: str, history: list[dict], board: Board) -> ChatResult:
    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])
    system = SYSTEM_PROMPT + "\n\nCurrent board:\n" + json.dumps(_board_to_wire(board))
    messages = [{"role": "system", "content": system}, *history, {"role": "user", "content": message}]

    for attempt in range(MAX_ATTEMPTS):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "chat_response", "schema": CHAT_RESPONSE_SCHEMA, "strict": True},
            },
        )
        try:
            data = json.loads(response.choices[0].message.content)
            board_result = _wire_to_board(data["board"]) if data["board"] is not None else None
            if board_result is not None:
                validate_board(board_result, board)
            return ChatResult(reply=data["reply"], board=board_result)
        except (json.JSONDecodeError, KeyError, ValidationError, ValueError):
            if attempt + 1 == MAX_ATTEMPTS:
                return ChatResult(reply="Sorry, I couldn't process that request. Please try again.")
