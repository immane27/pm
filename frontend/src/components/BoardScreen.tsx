import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { getBoard, saveBoard } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type BoardScreenProps = {
  onLogout: () => void;
};

export const BoardScreen = ({ onLogout }: BoardScreenProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);

  useEffect(() => {
    getBoard().then(setBoard);
  }, []);

  const handleChange = (next: BoardData) => {
    setBoard(next);
    saveBoard(next);
  };

  if (!board) {
    return (
      <p className="p-12 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
        Loading board...
      </p>
    );
  }
  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <KanbanBoard board={board} onChange={handleChange} onLogout={onLogout} />
      </div>
      <ChatSidebar onBoardUpdate={setBoard} />
    </div>
  );
};
