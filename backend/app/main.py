import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from app import db
from app.board import Board, validate_board

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "static"))
SESSION_SECRET = os.environ.get("SESSION_SECRET", secrets.token_hex(32))

USERNAME = "user"
PASSWORD = "password"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)


class Credentials(BaseModel):
    username: str
    password: str


def current_user(request: Request) -> str:
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    if credentials.username != USERNAME or credentials.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    db.get_or_create_user(credentials.username)
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(username: str = Depends(current_user)):
    return {"username": username}


@app.get("/api/board")
def read_board(username: str = Depends(current_user)) -> Board:
    return db.get_board(db.get_or_create_user(username))


@app.put("/api/board")
def update_board(board: Board, username: str = Depends(current_user)) -> Board:
    user_id = db.get_or_create_user(username)
    try:
        validate_board(board, db.get_board(user_id))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    db.save_board(user_id, board)
    return board


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
