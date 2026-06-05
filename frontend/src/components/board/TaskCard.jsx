import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBoard } from "../../contexts/BoardContext";

function GripIcon() {
  return (
    <svg
      width="10"
      height="16"
      viewBox="0 0 10 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3" cy="3"  r="1.5" />
      <circle cx="7" cy="3"  r="1.5" />
      <circle cx="3" cy="8"  r="1.5" />
      <circle cx="7" cy="8"  r="1.5" />
      <circle cx="3" cy="13" r="1.5" />
      <circle cx="7" cy="13" r="1.5" />
    </svg>
  );
}

export default function TaskCard({ task, onClick, isDragging }) {
  const { users, columns } = useBoard();
  const assignee = task.assigned_to
    ? users.find((u) => u.id === task.assigned_to)
    : null;
  const column = columns.find((c) => c.id === task.column_id);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  // The card accent is the assigned user's color when set, else the column color.
  const accentColor = assignee?.color || column?.color || "#e1e5f0";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
    "--col-color": accentColor,
    "--user-color": assignee?.color || "var(--color-primary)",
  };

  if (isDragging) {
    return (
      <div
        className="task-card task-card--overlay"
        style={{ "--col-color": accentColor }}
      >
        <span className="task-card__drag-handle" aria-hidden="true">
          <GripIcon />
        </span>
        <span className="task-card__title">{task.title}</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="task-card"
      onClick={onClick}
    >
      {/* Drag handle — touch-action:none in CSS prevents scroll conflict */}
      <span
        ref={setActivatorNodeRef}
        {...listeners}
        className="task-card__drag-handle"
        onClick={(e) => e.stopPropagation()}
        aria-label="גרור משימה"
      >
        <GripIcon />
      </span>

      <span className="task-card__title">{task.title}</span>

      {assignee && (
        <span className="task-card__assignee" title={assignee.display_name}>
          {assignee.display_name.charAt(0)}
        </span>
      )}
    </div>
  );
}
