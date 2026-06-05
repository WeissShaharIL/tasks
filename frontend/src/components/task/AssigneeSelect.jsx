import { useBoard } from "../../contexts/BoardContext";

export default function AssigneeSelect({ value, onChange }) {
  const { users } = useBoard();

  return (
    <select
      className="form-select"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
    >
      <option value="">— ללא שיוך —</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.display_name}
        </option>
      ))}
    </select>
  );
}
