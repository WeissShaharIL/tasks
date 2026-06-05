import { useBoard } from "../../contexts/BoardContext";

export default function PropertyField({ def, value, onChange }) {
  const { users } = useBoard();

  const options = def.options_json
    ? (() => { try { return JSON.parse(def.options_json); } catch { return []; } })()
    : [];

  switch (def.field_type) {
    case "select":
      return (
        <select className="form-select" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— בחר —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case "date":
      return (
        <input
          type="date"
          className="form-input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );

    case "user":
      return (
        <select className="form-select" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— ללא —</option>
          {users.map((u) => (
            <option key={u.id} value={String(u.id)}>{u.display_name}</option>
          ))}
        </select>
      );

    case "number":
      return (
        <input
          type="number"
          className="form-input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );

    default: // text
      return (
        <input
          type="text"
          className="form-input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
  }
}
