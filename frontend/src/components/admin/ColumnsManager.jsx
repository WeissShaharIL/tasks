import { useState } from "react";
import { api } from "../../api";
import { useBoard } from "../../contexts/BoardContext";
import ConfirmDialog from "../ConfirmDialog";
import ColumnForm from "./ColumnForm";

export default function ColumnsManager() {
  const { columns, dispatch } = useBoard();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
  const confirmTarget = sortedColumns.find((c) => c.id === confirmDeleteId);

  async function handleCreate(data) {
    const col = await api.createColumn(data);
    dispatch({ type: "COLUMN_CREATED", column: col });
    setAdding(false);
  }

  async function handleUpdate(id, data) {
    const col = await api.updateColumn(id, data);
    dispatch({ type: "COLUMN_UPDATED", column: col });
    setEditId(null);
  }

  async function handleDeleteConfirmed() {
    try {
      await api.deleteColumn(confirmDeleteId);
      dispatch({ type: "COLUMN_DELETED", id: confirmDeleteId });
    } catch (err) {
      alert(err.message);
    } finally {
      setConfirmDeleteId(null);
    }
  }

  async function handleMoveUp(index) {
    if (index === 0) return;
    const newOrder = [...sortedColumns];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await api.reorderColumns(newOrder.map((c) => c.id));
    dispatch({ type: "COLUMNS_REORDERED", data: { ordered_ids: newOrder.map((c) => c.id) } });
  }

  async function handleMoveDown(index) {
    if (index === sortedColumns.length - 1) return;
    const newOrder = [...sortedColumns];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await api.reorderColumns(newOrder.map((c) => c.id));
    dispatch({ type: "COLUMNS_REORDERED", data: { ordered_ids: newOrder.map((c) => c.id) } });
  }

  return (
    <>
      <div className="admin-section">
        <h2 className="admin-section__title">עמודות</h2>
        <div className="admin-list">
          {sortedColumns.map((col, index) => (
            <div key={col.id} className="admin-list__item">
              {editId === col.id ? (
                <ColumnForm
                  initial={col}
                  onSave={(data) => handleUpdate(col.id, data)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <>
                  <span className="admin-list__color-dot" style={{ background: col.color }} />
                  <span className="admin-list__name">{col.name}</span>
                  <div className="admin-list__actions">
                    <button className="btn-icon" onClick={() => handleMoveUp(index)} disabled={index === 0}>↑</button>
                    <button className="btn-icon" onClick={() => handleMoveDown(index)} disabled={index === sortedColumns.length - 1}>↓</button>
                    <button className="btn-icon" onClick={() => setEditId(col.id)}>ערוך</button>
                    <button className="btn-icon btn-icon--danger" onClick={() => setConfirmDeleteId(col.id)}>מחק</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {adding ? (
          <ColumnForm onSave={handleCreate} onCancel={() => setAdding(false)} />
        ) : (
          <button className="btn-primary" onClick={() => setAdding(true)}>+ הוסף עמודה</button>
        )}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="מחיקת עמודה"
          message={`למחוק את העמודה "${confirmTarget?.name}"?`}
          confirmLabel="מחק"
          danger
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </>
  );
}
