import { useState } from "react";
import { api } from "../../api";
import { useBoard } from "../../contexts/BoardContext";
import PropertyDefForm from "./PropertyDefForm";

const TYPE_LABELS = {
  text: "טקסט",
  select: "בחירה",
  date: "תאריך",
  user: "משתמש",
  number: "מספר",
};

export default function PropertyDefsManager() {
  const { property_defs, dispatch } = useBoard();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);

  const sorted = [...property_defs].sort((a, b) => a.position - b.position);

  async function reloadDefs() {
    const defs = await api.listPropertyDefs();
    dispatch({ type: "PROPERTY_DEFS_RELOAD", defs });
  }

  async function handleCreate(data) {
    await api.createPropertyDef(data);
    await reloadDefs();
    setAdding(false);
  }

  async function handleUpdate(id, data) {
    await api.updatePropertyDef(id, data);
    await reloadDefs();
    setEditId(null);
  }

  async function handleDelete(id) {
    if (!confirm("למחוק שדה זה? הערכים בכל המשימות יימחקו.")) return;
    try {
      await api.deletePropertyDef(id);
      await reloadDefs();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleMoveUp(index) {
    if (index === 0) return;
    const newOrder = [...sorted];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await api.reorderPropertyDefs(newOrder.map((d) => d.id));
    await reloadDefs();
  }

  async function handleMoveDown(index) {
    if (index === sorted.length - 1) return;
    const newOrder = [...sorted];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await api.reorderPropertyDefs(newOrder.map((d) => d.id));
    await reloadDefs();
  }

  return (
    <div className="admin-section">
      <h2 className="admin-section__title">שדות מותאמים אישית</h2>
      <div className="admin-list">
        {sorted.map((def, index) => (
          <div key={def.id} className="admin-list__item">
            {editId === def.id ? (
              <PropertyDefForm
                initial={def}
                onSave={(data) => handleUpdate(def.id, data)}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <>
                <span className="admin-list__name">{def.name}</span>
                <span className="admin-list__badge">{TYPE_LABELS[def.field_type] ?? def.field_type}</span>
                {def.is_required && <span className="admin-list__badge admin-list__badge--required">חובה</span>}
                <div className="admin-list__actions">
                  <button className="btn-icon" onClick={() => handleMoveUp(index)} disabled={index === 0}>↑</button>
                  <button className="btn-icon" onClick={() => handleMoveDown(index)} disabled={index === sorted.length - 1}>↓</button>
                  <button className="btn-icon" onClick={() => setEditId(def.id)}>✏️</button>
                  <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(def.id)}>🗑</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {adding ? (
        <PropertyDefForm onSave={handleCreate} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + הוסף שדה
        </button>
      )}
    </div>
  );
}
