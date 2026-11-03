import sqlite3
from contextlib import closing

from app import db
from app.board import DEFAULT_BOARD


def test_init_db_creates_file_and_tables(db_path, tmp_path, monkeypatch):
    nested = tmp_path / "nested" / "dir" / "kanban.db"
    monkeypatch.setenv("DB_PATH", str(nested))
    db.init_db()
    assert nested.exists()
    with closing(sqlite3.connect(nested)) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"users", "boards"} <= tables


def test_init_db_is_idempotent():
    db.init_db()
    db.init_db()


def test_get_or_create_user_is_stable():
    db.init_db()
    first = db.get_or_create_user("alice")
    assert db.get_or_create_user("alice") == first
    assert db.get_or_create_user("bob") != first


def test_new_user_gets_default_board():
    db.init_db()
    assert db.get_board(db.get_or_create_user("alice")) == DEFAULT_BOARD


def test_boards_are_isolated_between_users():
    db.init_db()
    alice = db.get_or_create_user("alice")
    bob = db.get_or_create_user("bob")
    board = db.get_board(alice)
    board.columns[0].title = "Alice backlog"
    db.save_board(alice, board)

    assert db.get_board(alice).columns[0].title == "Alice backlog"
    assert db.get_board(bob).columns[0].title == "Backlog"
