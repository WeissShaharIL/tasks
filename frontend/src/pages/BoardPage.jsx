import { useState } from "react";
import AppHeader from "../components/AppHeader";
import KanbanBoard from "../components/board/KanbanBoard";
import TaskModal from "../components/task/TaskModal";
import { useBoard } from "../contexts/BoardContext";

export default function BoardPage() {
  const { loaded } = useBoard();
  const [selectedTask, setSelectedTask] = useState(null);

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
      <main className="board-container">
        <KanbanBoard onTaskClick={setSelectedTask} />
      </main>
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
