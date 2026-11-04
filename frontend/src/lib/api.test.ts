import { getBoard, getMe, login, logout, saveBoard, sendChatMessage } from "@/lib/api";
import { boardFixture } from "@/test/boardFixture";

const mockFetch = (status: number, body: unknown = {}) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status })
  );

afterEach(() => vi.restoreAllMocks());

describe("api", () => {
  it("getMe returns the username when signed in", async () => {
    const fetchSpy = mockFetch(200, { username: "user" });
    expect(await getMe()).toBe("user");
    expect(fetchSpy).toHaveBeenCalledWith("/api/me");
  });

  it("getMe returns null when not signed in", async () => {
    mockFetch(401);
    expect(await getMe()).toBeNull();
  });

  it("login posts credentials and reports success", async () => {
    const fetchSpy = mockFetch(200, { username: "user" });
    expect(await login("user", "password")).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/login");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ username: "user", password: "password" });
  });

  it("login reports failure", async () => {
    mockFetch(401);
    expect(await login("user", "wrong")).toBe(false);
  });

  it("logout posts to the logout route", async () => {
    const fetchSpy = mockFetch(200);
    await logout();
    expect(fetchSpy).toHaveBeenCalledWith("/api/logout", expect.objectContaining({ method: "POST" }));
  });
});

describe("board api", () => {
  it("getBoard returns the board", async () => {
    const fetchSpy = mockFetch(200, boardFixture);
    expect(await getBoard()).toEqual(boardFixture);
    expect(fetchSpy).toHaveBeenCalledWith("/api/board");
  });

  it("saveBoard puts the whole board", async () => {
    const fetchSpy = mockFetch(200, boardFixture);
    await saveBoard(boardFixture);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/board");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual(boardFixture);
  });

  it("saveBoard sends saves one at a time, in order", async () => {
    const releases: (() => void)[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => releases.push(() => resolve(new Response("{}")))),
    );
    const first = { ...boardFixture, columns: boardFixture.columns.map((c) => ({ ...c, title: "1" })) };
    const second = { ...boardFixture, columns: boardFixture.columns.map((c) => ({ ...c, title: "2" })) };

    const done = Promise.all([saveBoard(first), saveBoard(second)]);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toEqual(first);

    releases[0]();
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)).toEqual(second);
    releases[1]();
    await done;
  });

  it("saveBoard keeps working after a failed save", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(new Response("{}"));
    await expect(saveBoard(boardFixture)).rejects.toThrow("offline");
    await saveBoard(boardFixture);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("chat api", () => {
  it("sendChatMessage posts the message and history, returns the response", async () => {
    const history = [{ role: "user" as const, content: "hi" }];
    const fetchSpy = mockFetch(200, { reply: "hello", board: null });

    const result = await sendChatMessage("add a card", history);

    expect(result).toEqual({ reply: "hello", board: null });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ message: "add a card", history });
  });

  it("sendChatMessage throws when the request fails", async () => {
    mockFetch(401);
    await expect(sendChatMessage("hi", [])).rejects.toThrow();
  });
});
