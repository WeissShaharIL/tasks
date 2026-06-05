import { useState } from "react";

export default function AddTaskButton({ onAdd }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onAdd(title.trim());
      setTitle("");
      setAdding(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!adding) {
    return (
      <button className="add-task-btn" onClick={() => setAdding(true)}>
        + הוסף משימה
      </button>
    );
  }

  return (
    <form className="add-task-form" onSubmit={handleSubmit}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="כותרת משימה..."
        className="add-task-form__input"
        disabled={loading}
      />
      <div className="add-task-form__actions">
        <button type="submit" className="btn-primary" disabled={loading || !title.trim()}>
          הוסף
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => { setAdding(false); setTitle(""); }}
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
