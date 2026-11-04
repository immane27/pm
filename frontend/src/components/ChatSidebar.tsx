"use client";

import { useState, type FormEvent } from "react";
import { sendChatMessage, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
};

export const ChatSidebar = ({ onBoardUpdate }: ChatSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) {
      return;
    }

    const history = messages;
    setMessages([...history, { role: "user", content: message }]);
    setInput("");
    setLoading(true);
    setError(false);

    try {
      const response = await sendChatMessage(message, history);
      setMessages((current) => [...current, { role: "assistant", content: response.reply }]);
      if (response.board) {
        onBoardUpdate(response.board);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (collapsed) {
    return (
      <div className="flex min-h-screen items-start pt-12">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Open AI chat"
          className="rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-[var(--shadow)] transition hover:brightness-110"
        >
          AI chat
        </button>
      </div>
    );
  }

  return (
    <aside className="flex min-h-screen w-[340px] flex-shrink-0 flex-col gap-4 py-12 pr-6 pl-2">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[28px] border border-[var(--stroke)] bg-white/90 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
            AI Assistant
          </h2>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse AI chat"
            className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Collapse
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <p className="text-sm text-[var(--gray-text)]">
              Ask me to create, edit, or move cards on your board.
            </p>
          )}
          {messages.map((entry, index) => (
            <p
              key={index}
              className={
                entry.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-[var(--primary-blue)] px-4 py-2 text-sm text-white"
                  : "mr-auto max-w-[85%] rounded-2xl bg-[var(--surface)] px-4 py-2 text-sm text-[var(--navy-dark)]"
              }
            >
              {entry.content}
            </p>
          ))}
          {loading && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Thinking...
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-[var(--secondary-purple)]">
              Something went wrong. Please try again.
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[var(--stroke)] p-4">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask the AI..."
            aria-label="Chat message"
            disabled={loading}
            className="min-w-0 flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </aside>
  );
};
