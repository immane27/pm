import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardScreen } from "@/components/BoardScreen";
import { boardFixture } from "@/test/boardFixture";

afterEach(() => vi.restoreAllMocks());

const mockBoardApi = () =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input) === "/api/board" && init?.method === "PUT") {
      return new Response(init.body as string, { status: 200 });
    }
    if (String(input) === "/api/chat") {
      const changedBoard = {
        ...boardFixture,
        cards: { ...boardFixture.cards },
        columns: boardFixture.columns.map((column) => ({
          ...column,
          cardIds: column.cardIds.filter((id) => id !== "card-1"),
        })),
      };
      delete changedBoard.cards["card-1"];
      return new Response(
        JSON.stringify({ reply: "Removed it.", board: changedBoard }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify(boardFixture), { status: 200 });
  });

describe("BoardScreen", () => {
  it("shows a loading state, then the board from the API", async () => {
    mockBoardApi();
    render(<BoardScreen onLogout={() => {}} />);
    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
    expect(await screen.findAllByTestId(/^column-/)).toHaveLength(5);
    expect(screen.getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("saves the board after a change", async () => {
    const fetchSpy = mockBoardApi();
    render(<BoardScreen onLogout={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Align roadmap themes" }));

    expect(screen.queryByText("Align roadmap themes")).not.toBeInTheDocument();
    const put = fetchSpy.mock.calls.find(([, init]) => init?.method === "PUT");
    const saved = JSON.parse(put![1]!.body as string);
    expect(saved.cards["card-1"]).toBeUndefined();
    expect(saved.columns[0].cardIds).toEqual(["card-2"]);
  });

  it("refreshes the board from an AI chat response without saving again", async () => {
    const fetchSpy = mockBoardApi();
    render(<BoardScreen onLogout={() => {}} />);
    await screen.findByText("Align roadmap themes");

    await userEvent.type(screen.getByLabelText("Chat message"), "remove it");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Removed it.")).toBeInTheDocument();
    expect(screen.queryByText("Align roadmap themes")).not.toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });
});
