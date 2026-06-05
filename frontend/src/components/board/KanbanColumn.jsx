import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { api } from "../../api";
import AddTaskButton from "./AddTaskButton";
import TaskCard from "./TaskCard";

export default function KanbanColumn({ column, tasks, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });

  async function handleAddTask(title) {
    // Don't dispatch locally — the WS broadcast from the server handles the update
    await api.createTask({ title, column_id: column.id });
  }

  return (
    <div
      className={`kanban-column ${isOver ? "kanban-column--over" : ""}`}
      style={{ "--col-color": column.color }}
    >
      <div className="kanban-column__header">
        <span className="kanban-column__name">{column.name}</span>
        <span className="kanban-column__count">{tasks.length}</span>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="kanban-column__cards" ref={setNodeRef}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </div>
      </SortableContext>
      <AddTaskButton onAdd={handleAddTask} />
    </div>
  );
}
