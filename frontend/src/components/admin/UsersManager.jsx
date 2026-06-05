import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../contexts/AuthContext";
import ConfirmDialog from "../ConfirmDialog";

const DEFAULT_NEW_COLOR = "#6366f1";

export default function UsersManager() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: "", display_name: "", password: "", is_admin: false, color: DEFAULT_NEW_COLOR });
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function load() {
    const data = await api.listUsers();
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) return;
    setLoading(true);
    try {
      await api.createUser(form);
      await load();
      setAdding(false);
      setForm({ username: "", display_name: "", password: "", is_admin: false, color: DEFAULT_NEW_COLOR });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleColorChange(userId, color) {
    // optimistic
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, color } : u)));
    try {
      await api.updateUser(userId, { color });
    } catch (err) {
      alert(err.message);
      await load();
    }
  }

  async function handleClearColor(userId) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, color: null } : u)));
    try {
      await api.updateUser(userId, { color: "" });
    } catch (err) {
      alert(err.message);
      await load();
    }
  }

  async function handleDeleteConfirmed() {
    try {
      await api.deleteUser(confirmDeleteId);
      setUsers((prev) => prev.filter((u) => u.id !== confirmDeleteId));
    } catch (err) {
      alert(err.message);
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const confirmTarget = users.find((u) => u.id === confirmDeleteId);

  return (
    <>
      <div className="admin-section">
        <h2 className="admin-section__title">משתמשים</h2>
        <div className="admin-list">
          {users.map((u) => (
            <div key={u.id} className="admin-list__item">
              <label className="user-color" title="צבע המשתמש">
                <input
                  type="color"
                  className="user-color__input"
                  value={u.color || "#cccccc"}
                  onChange={(e) => handleColorChange(u.id, e.target.value)}
                />
                <span
                  className="user-color__dot"
                  style={{ background: u.color || "transparent", borderColor: u.color || "var(--color-border)" }}
                />
              </label>
              <span className="admin-list__name">{u.display_name}</span>
              <span className="admin-list__sub">@{u.username}</span>
              {u.is_admin && <span className="admin-list__badge">מנהל</span>}
              <div className="admin-list__actions">
                {u.color && (
                  <button className="btn-icon" onClick={() => handleClearColor(u.id)} title="הסר צבע">ללא צבע</button>
                )}
                {u.id !== currentUser?.id && (
                  <button className="btn-icon btn-icon--danger" onClick={() => setConfirmDeleteId(u.id)}>מחק</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {adding ? (
          <form className="inline-form inline-form--wide" onSubmit={handleCreate}>
            <input
              autoFocus
              className="form-input"
              placeholder="שם משתמש"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
            <input
              className="form-input"
              placeholder="שם תצוגה"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
            <input
              type="password"
              className="form-input"
              placeholder="סיסמה"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
            <label className="form-checkbox">
              צבע
              <input
                type="color"
                className="form-color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
            </label>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.is_admin}
                onChange={(e) => setForm((f) => ({ ...f, is_admin: e.target.checked }))}
              />
              מנהל
            </label>
            <div className="inline-form__actions">
              <button type="submit" className="btn-primary" disabled={loading}>צור</button>
              <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>ביטול</button>
            </div>
          </form>
        ) : (
          <button className="btn-primary" onClick={() => setAdding(true)}>+ הוסף משתמש</button>
        )}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="מחיקת משתמש"
          message={`למחוק את "${confirmTarget?.display_name}"?`}
          confirmLabel="מחק"
          danger
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </>
  );
}
