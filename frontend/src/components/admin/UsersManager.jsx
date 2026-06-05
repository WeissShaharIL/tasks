import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../contexts/AuthContext";

export default function UsersManager() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: "", display_name: "", password: "", is_admin: false });
  const [loading, setLoading] = useState(false);

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
      setForm({ username: "", display_name: "", password: "", is_admin: false });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("למחוק משתמש זה?")) return;
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="admin-section">
      <h2 className="admin-section__title">משתמשים</h2>
      <div className="admin-list">
        {users.map((u) => (
          <div key={u.id} className="admin-list__item">
            <span className="admin-list__name">{u.display_name}</span>
            <span className="admin-list__sub">@{u.username}</span>
            {u.is_admin && <span className="admin-list__badge">מנהל</span>}
            {u.id !== currentUser?.id && (
              <div className="admin-list__actions">
                <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(u.id)}>מחק</button>
              </div>
            )}
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
  );
}
