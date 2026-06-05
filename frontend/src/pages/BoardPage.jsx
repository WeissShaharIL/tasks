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
        />
      </main>

      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
      <InstallPrompt />
    </div>
  );
}
