import { useState } from "react";

export default function ColumnForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6b7280");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSave({ name: name.trim(), color });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <input
        autoFocus
        className="form-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="שם עמודה..."
        required
      />
      <input
        type="color"
        className="form-color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        title="צבע עמודה"
      />
      <div className="inline-form__actions">
        <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
          {initial ? "עדכן" : "הוסף"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </form>
  );
}
