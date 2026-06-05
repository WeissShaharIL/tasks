import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { useBoard } from "../../contexts/BoardContext";
import ConfirmDialog from "../ConfirmDialog";
import AssigneeSelect from "./AssigneeSelect";
import PropertyField from "./PropertyField";

export default function TaskModal({ task, onClose }) {
  const { columns, tasks, property_defs, dispatch } = useBoard();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task.assigned_to);
  const [propValues, setPropValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    const values = {};
    (task.properties || []).forEach((p) => {
      values[p.prop_def_id] = p.value_text;
    });
    setPropValues(values);
  }, [task.id]);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateTask(task.id, {
        title,
        description: description || null,
        assigned_to: assignedTo,
      });
      const propsPayload = property_defs.map((def) => ({
        prop_def_id: def.id,
        value_text: propValues[def.id] ?? null,
      }));
      if (propsPayload.length > 0) {
        await api.upsertProperties(task.id, propsPayload);
      }
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveToColumn(columnId) {
    const tasksInCol = tasks.filter((t) => t.column_id === columnId);
    const lastPos =
      tasksInCol.length > 0
        ? Math.max(...tasksInCol.map((t) => t.position)) + 1.0
        : 1.0;
    setSaving(true);
    try {
      await api.moveTask(task.id, columnId, lastPos);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    setShowConfirm(false);
    setDeleting(true);
    try {
      await api.deleteTask(task.id);
      dispatch({ type: "TASK_DELETED", id: task.id });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const column = columns.find((c) => c.id === task.column_id);
  const otherColumns = [...columns]
    .sort((a, b) => a.position - b.position)
    .filter((c) => c.id !== task.column_id);

  return (
    <>
      <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
        <div className="modal">
          <div className="modal__header">
            <span className="modal__column-badge" style={{ background: column?.color }}>
              {column?.name}
            </span>
            <button className="modal__close" onClick={onClose}>✕</button>
          </div>

          <div className="modal__body">
            <div className="form-group">
              <label className="form-label">כותרת</label>
              <input
                className="form-input form-input--title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">תיאור</label>
              <textarea
                className="form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="תיאור אופציונלי..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">שיוך</label>
              <AssigneeSelect value={assignedTo} onChange={setAssignedTo} />
            </div>

            {otherColumns.length > 0 && (
              <div className="form-group">
                <label className="form-label">העבר לעמודה</label>
                <div className="column-picker">
                  {otherColumns.map((col) => (
                    <button
                      key={col.id}
                      className="column-picker__btn"
                      style={{ "--col-color": col.color }}
                      onClick={() => handleMoveToColumn(col.id)}
                      disabled={saving}
                    >
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {property_defs.map((def) => (
              <div key={def.id} className="form-group">
                <label className="form-label">
                  {def.name}
                  {def.is_required && <span className="required-mark">*</span>}
                </label>
                <PropertyField
                  def={def}
                  value={propValues[def.id] ?? null}
                  onChange={(val) => setPropValues((p) => ({ ...p, [def.id]: val }))}
                />
              </div>
            ))}
          </div>

          <div className="modal__footer">
            <button
              className="btn-danger"
              onClick={() => setShowConfirm(true)}
              disabled={deleting || saving}
            >
              {deleting ? "מוחק..." : "מחק"}
            </button>
            <div className="modal__footer-actions">
              <button className="btn-ghost" onClick={onClose}>ביטול</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !title.trim()}
              >
                {saving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="מחיקת משימה"
          message={`למחוק את "${title}"? לא ניתן לשחזר.`}
          confirmLabel="מחק"
          danger
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
