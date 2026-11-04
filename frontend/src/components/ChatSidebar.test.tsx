import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import { boardFixture } from "@/test/boardFixture";
import * as api from "@/lib/api";

afterEach(() => vi.restoreAllMocks());

describe("ChatSidebar", () => {
  it("sends the message with history and renders the reply", async () => {
    const sendSpy = vi
      .spyOn(api, "sendChatMessage")
      .mockResolvedValueOnce({ reply: "Hi there!", board: null })
      .mockResolvedValueOnce({ reply: "Done.", board: null });
    render(<ChatSidebar onBoardUpdate={() => {}} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Hi there!")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(sendSpy).toHaveBeenCalledWith("hello", []);

    await userEvent.type(screen.getByLabelText("Chat message"), "and again");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Done.")).toBeInTheDocument();
    expect(sendSpy).toHaveBeenLastCalledWith("and again", [
      { role: "user", content: "hello" },
      { role: "assistant", content: "Hi there!" },
    ]);
  });

  it("shows a loading indicator while waiting for a reply", async () => {
    let resolveReply: (value: { reply: string; board: null }) => void = () => {};
    vi.spyOn(api, "sendChatMessage").mockReturnValue(
      new Promise((resolve) => {
        resolveReply = resolve;
      })
    );
    render(<ChatSidebar onBoardUpdate={() => {}} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    resolveReply({ reply: "ok", board: null });
    expect(await screen.findByText("ok")).toBeInTheDocument();
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
  });

  it("shows an error when the request fails", async () => {
    vi.spyOn(api, "sendChatMessage").mockRejectedValue(new Error("network error"));
    render(<ChatSidebar onBoardUpdate={() => {}} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("replaces the board when the response includes one", async () => {
    vi.spyOn(api, "sendChatMessage").mockResolvedValue({ reply: "Added it.", board: boardFixture });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "add a card");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Added it.");
    expect(onBoardUpdate).toHaveBeenCalledWith(boardFixture);
  });

  it("does not update the board when the response has none", async () => {
    vi.spyOn(api, "sendChatMessage").mockResolvedValue({ reply: "No change needed.", board: null });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "how many cards?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("No change needed.");
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("ignores submitting an empty message", async () => {
    const sendSpy = vi.spyOn(api, "sendChatMessage");
    render(<ChatSidebar onBoardUpdate={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("collapses and expands", async () => {
    render(<ChatSidebar onBoardUpdate={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Collapse AI chat" }));
    expect(screen.queryByLabelText("Chat message")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open AI chat" }));
    expect(screen.getByLabelText("Chat message")).toBeInTheDocument();
  });
});
