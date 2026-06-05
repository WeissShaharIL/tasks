import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { api } from "../../api";
import { useBoard } from "../../contexts/BoardContext";
import AddTaskButton from "./AddTaskButton";
import TaskCard from "./TaskCard";

export default function KanbanColumn({ column, tasks, onTaskClick }) {
  const { dispatch } = useBoard();
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });

  async function handleAddTask(title) {
    const task = await api.createTask({ title, column_id: column.id });
    dispatch({ type: "TASK_CREATED", task });
  }

  return (
    <div className={`kanban-column ${isOver ? "kanban-column--over" : ""}`}>
      <div className="kanban-column__header" style={{ borderTopColor: column.color }}>
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
