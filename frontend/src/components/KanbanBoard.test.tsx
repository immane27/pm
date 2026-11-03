import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { BoardData } from "@/lib/kanban";
import { boardFixture } from "@/test/boardFixture";

const onChangeSpy = vi.fn();

const Harness = () => {
  const [board, setBoard] = useState<BoardData>(boardFixture);
  return (
    <KanbanBoard
      board={board}
      onChange={(next) => {
        onChangeSpy(next);
        setBoard(next);
      }}
      onLogout={() => {}}
    />
  );
};

beforeEach(() => onChangeSpy.mockClear());

const lastBoard = (): BoardData => onChangeSpy.mock.lastCall![0];

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<Harness />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<Harness />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<Harness />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    await userEvent.click(within(column).getByRole("button", { name: /delete new card/i }));
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("adds a card with default details when details are empty", async () => {
    render(<Harness />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Bare card");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getByText("No details yet.")).toBeInTheDocument();
  });

  it("does not add a card with a blank title", async () => {
    render(<Harness />);
    const column = getFirstColumn();
    const before = within(column).getAllByTestId(/^card-/).length;
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "   ");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getAllByTestId(/^card-/)).toHaveLength(before);
  });

  it("cancels adding a card", async () => {
    render(<Harness />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Draft");
    await userEvent.click(within(column).getByRole("button", { name: /cancel/i }));
    expect(within(column).queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    expect(within(column).getByPlaceholderText(/card title/i)).toHaveValue("");
  });

  it("edits a card title and details", async () => {
    render(<Harness />);
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));

    const title = within(card).getByLabelText("Edit card title");
    const details = within(card).getByLabelText("Edit card details");
    expect(title).toHaveValue("Align roadmap themes");
    await userEvent.clear(title);
    await userEvent.type(title, "Updated title");
    await userEvent.clear(details);
    await userEvent.type(details, "Updated details");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));

    expect(within(card).getByText("Updated title")).toBeInTheDocument();
    expect(within(card).getByText("Updated details")).toBeInTheDocument();
    expect(within(card).queryByLabelText("Edit card title")).not.toBeInTheDocument();
  });

  it("cancels editing a card without changes", async () => {
    render(<Harness />);
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));
    const title = within(card).getByLabelText("Edit card title");
    await userEvent.clear(title);
    await userEvent.type(title, "Discarded");
    await userEvent.click(within(card).getByRole("button", { name: /cancel/i }));

    expect(within(card).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(card).queryByText("Discarded")).not.toBeInTheDocument();
  });

  it("does not save a card with a blank title", async () => {
    render(<Harness />);
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));
    const title = within(card).getByLabelText("Edit card title");
    await userEvent.clear(title);
    await userEvent.type(title, "   ");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));
    expect(within(card).getByLabelText("Edit card title")).toBeInTheDocument();
  });

  it("does not mark the card as disabled while editing", async () => {
    render(<Harness />);
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));
    expect(card).not.toHaveAttribute("aria-disabled", "true");
    expect(card).not.toHaveAttribute("role", "button");
  });

  it("reports column renames through onChange", async () => {
    render(<Harness />);
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Ideas");
    expect(lastBoard().columns[0].title).toBe("Ideas");
    expect(lastBoard().columns.slice(1)).toEqual(boardFixture.columns.slice(1));
  });

  it("reports added cards through onChange", async () => {
    render(<Harness />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Saved card");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    const board = lastBoard();
    const newId = board.columns[0].cardIds.at(-1)!;
    expect(board.cards[newId]).toEqual({ id: newId, title: "Saved card", details: "No details yet." });
  });

  it("reports edited cards through onChange", async () => {
    render(<Harness />);
    const card = screen.getByTestId("card-card-2");
    await userEvent.click(within(card).getByRole("button", { name: /edit gather customer signals/i }));
    await userEvent.clear(within(card).getByLabelText("Edit card title"));
    await userEvent.type(within(card).getByLabelText("Edit card title"), "Signals");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));
    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(lastBoard().cards["card-2"].title).toBe("Signals");
  });

  it("reports deleted cards through onChange", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Align roadmap themes" }));
    expect(lastBoard().cards["card-1"]).toBeUndefined();
    expect(lastBoard().columns[0].cardIds).not.toContain("card-1");
  });

  it("does not call onChange when only opening and cancelling forms", async () => {
    render(<Harness />);
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));
    await userEvent.click(within(card).getByRole("button", { name: /cancel/i }));
    expect(onChangeSpy).not.toHaveBeenCalled();
  });
});
