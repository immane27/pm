import type { BoardData } from "@/lib/kanban";

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const getMe = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  if (!response.ok) {
    return null;
  }
  const data: { username: string } = await response.json();
  return data.username;
};

export const login = async (username: string, password: string): Promise<boolean> => {
  const response = await post("/api/login", { username, password });
  return response.ok;
};

export const logout = async (): Promise<void> => {
  await post("/api/logout");
};

export const getBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  return response.json();
};

// Saves run one at a time, in order, so a slower earlier save can never overwrite a later one.
let saveQueue: Promise<unknown> = Promise.resolve();

export const saveBoard = (board: BoardData): Promise<Response> => {
  const save = saveQueue.then(() =>
    fetch("/api/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(board),
    })
  );
  saveQueue = save.catch(() => undefined);
  return save;
};
