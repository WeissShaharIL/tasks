import { useState } from "react";
import AppHeader from "../components/AppHeader";
import InstallPrompt, { InstallButton } from "../components/InstallPrompt";
import KanbanBoard from "../components/board/KanbanBoard";
import TaskModal from "../components/task/TaskModal";
import { useAuth } from "../contexts/AuthContext";
import { useBoard } from "../contexts/BoardContext";

export default function BoardPage() {
  const { loaded } = useBoard();
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState(null);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [search, setSearch] = useState("");

  if (!loaded) {
    return (
      <div className="page-layout">
        <AppHeader />
        <div className="loading-screen">טוען לוח...</div>
      </div>
    );
  }

  return (
    <div className="page-layout">
      <AppHeader />

      <div className="board-toolbar">
        <div className="board-search">
          <input
            type="search"
            className="board-search__input"
            placeholder="חיפוש משימות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="board-search__clear"
              onClick={() => setSearch("")}
              aria-label="נקה חיפוש"
            >
              ✕
            </button>
          )}
        </div>
        <button
          className={`board-toolbar__filter ${myTasksOnly ? "board-toolbar__filter--active" : ""}`}
          onClick={() => setMyTasksOnly((v) => !v)}
        >
          {myTasksOnly ? "כל המשימות" : "המשימות שלי"}
        </button>
        <InstallButton />
      </div>

      <main className="board-container">
        <KanbanBoard
          onTaskClick={setSelectedTask}
          myTasksOnly={myTasksOnly}
          currentUserId={user?.id}
          search={search}
        />
      </main>

      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
      <InstallPrompt />
    </div>
  );
}
