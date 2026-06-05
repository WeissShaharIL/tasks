import { useState } from "react";

const FIELD_TYPES = [
  { value: "text", label: "טקסט חופשי" },
  { value: "select", label: "בחירה מרשימה" },
  { value: "date", label: "תאריך" },
  { value: "user", label: "משתמש" },
  { value: "number", label: "מספר" },
];

export default function PropertyDefForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [fieldType, setFieldType] = useState(initial?.field_type ?? "text");
  const [optionsText, setOptionsText] = useState(() => {
    if (!initial?.options_json) return "";
    try { return JSON.parse(initial.options_json).join("\n"); } catch { return ""; }
  });
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    let options_json = null;
    if (fieldType === "select") {
      const opts = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
      if (opts.length === 0) return alert("יש להגדיר לפחות אפשרות אחת");
      options_json = JSON.stringify(opts);
    }

    setLoading(true);
    try {
      await onSave({ name: name.trim(), field_type: fieldType, options_json, is_required: isRequired });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="inline-form inline-form--wide" onSubmit={handleSubmit}>
      <input
        autoFocus
        className="form-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="שם שדה..."
        required
      />
      <select
        className="form-select"
        value={fieldType}
        onChange={(e) => setFieldType(e.target.value)}
      >
        {FIELD_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      {fieldType === "select" && (
        <textarea
          className="form-textarea"
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          placeholder="אפשרות אחת בכל שורה..."
          rows={4}
        />
      )}
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
        />
        חובה
      </label>
      <div className="inline-form__actions">
        <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
          {initial ? "עדכן" : "הוסף"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>ביטול</button>
      </div>
    </form>
  );
}
