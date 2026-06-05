import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBoard } from "../../contexts/BoardContext";

export default function TaskCard({ task, onClick, isDragging }) {
  const { users } = useBoard();
  const assignee = task.assigned_to
    ? users.find((u) => u.id === task.assigned_to)
    : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  };

  if (isDragging) {
    return (
      <div className="task-card task-card--overlay">
        <span className="task-card__title">{task.title}</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="task-card"
      onClick={onClick}
    >
      <span className="task-card__title">{task.title}</span>
      {assignee && (
        <span className="task-card__assignee" title={assignee.display_name}>
          {assignee.display_name.charAt(0)}
        </span>
      )}
    </div>
  );
}
