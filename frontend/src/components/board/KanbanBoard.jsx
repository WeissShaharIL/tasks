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

export default function KanbanBoard({ onTaskClick, myTasksOnly, currentUserId }) {
  const { columns, tasks, dispatch } = useBoard();
  const [activeTask, setActiveTask] = useState(null);

  // touch-action:none on the drag handle (TaskCard) prevents scroll conflicts,
  // so distance:5 works correctly on both mouse and touch.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  function getTasksForColumn(colId) {
    let col = tasks.filter((t) => t.column_id === colId);
    if (myTasksOnly && currentUserId) {
      col = col.filter(
        (t) => t.assigned_to === currentUserId || t.created_by === currentUserId
      );
    }
    return col.sort((a, b) => a.position - b.position);
  }

  function computeNewPosition(columnId, overId, activeId) {
    const colTasks = getTasksForColumn(columnId).filter((t) => t.id !== activeId);
    if (colTasks.length === 0) return 1.0;
    const overIndex = colTasks.findIndex((t) => t.id === overId);
    if (overIndex === -1) return colTasks[colTasks.length - 1].position + 1.0;
    const prev = colTasks[overIndex - 1];
    const next = colTasks[overIndex];
    if (!prev) return next.position - 1.0;
    return (prev.position + next.position) / 2;
  }

  function handleDragStart(event) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) || null);
  }

  function handleDragEnd(event) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    let targetColId;
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

    dispatch({ type: "TASK_MOVED", data: { id: activeId, column_id: targetColId, position: newPosition } });
    api.moveTask(activeId, targetColId, newPosition).catch(() => {
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
