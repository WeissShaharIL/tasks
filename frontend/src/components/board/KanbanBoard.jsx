import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { api } from "../../api";
import { useBoard } from "../../contexts/BoardContext";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";

export default function KanbanBoard({ onTaskClick }) {
  const { columns, tasks, dispatch } = useBoard();
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  function getTasksForColumn(colId) {
    return tasks
      .filter((t) => t.column_id === colId)
      .sort((a, b) => a.position - b.position);
  }

  function computeNewPosition(columnId, overId, activeId) {
    const colTasks = getTasksForColumn(columnId).filter((t) => t.id !== activeId);
    if (colTasks.length === 0) return 1.0;

    const overIndex = colTasks.findIndex((t) => t.id === overId);
    if (overIndex === -1) {
      // Dropped on empty column area → append
      return colTasks[colTasks.length - 1].position + 1.0;
    }

    const prev = colTasks[overIndex - 1];
    const next = colTasks[overIndex];
    if (!prev) return next.position - 1.0;
    return (prev.position + next.position) / 2;
  }

  function handleDragStart(event) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  }

  function handleDragEnd(event) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    // Determine target column
    let targetColId = null;
    // over.id could be a column id (string "col-X") or a task id (number)
    if (typeof overId === "string" && overId.startsWith("col-")) {
      targetColId = parseInt(overId.replace("col-", ""), 10);
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      targetColId = overTask ? overTask.column_id : task.column_id;
    }

    const newPosition = computeNewPosition(
      targetColId,
      typeof overId === "number" ? overId : null,
      activeId
    );

    // Optimistic update
    dispatch({
      type: "TASK_MOVED",
      data: { id: activeId, column_id: targetColId, position: newPosition },
    });

    api.moveTask(activeId, targetColId, newPosition).catch(() => {
      // On error, reload board to restore correct state
      api.board().then((data) => dispatch({ type: "LOAD", payload: data }));
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {sortedColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={getTasksForColumn(col.id)}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
