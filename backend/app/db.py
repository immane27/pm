import os
import sqlite3
from contextlib import closing
from pathlib import Path

from app.board import DEFAULT_BOARD, Board

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def connect() -> sqlite3.Connection:
    path = Path(os.environ.get("DB_PATH", Path(__file__).parent.parent / "data" / "kanban.db"))
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with closing(connect()) as conn:
        conn.executescript(SCHEMA)


def get_or_create_user(username: str) -> int:
    with closing(connect()) as conn, conn:
        conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))
        return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()[0]


def get_board(user_id: int) -> Board:
    with closing(connect()) as conn, conn:
        row = conn.execute("SELECT data FROM boards WHERE user_id = ?", (user_id,)).fetchone()
        if row:
            return Board.model_validate_json(row[0])
        board = DEFAULT_BOARD.model_copy(deep=True)
        conn.execute(
            "INSERT INTO boards (user_id, data) VALUES (?, ?)",
            (user_id, board.model_dump_json()),
        )
        return board


def save_board(user_id: int, board: Board) -> None:
    with closing(connect()) as conn, conn:
        conn.execute(
            "UPDATE boards SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            (board.model_dump_json(), user_id),
        )
