import { useRef, useState } from "react";
import { api } from "../api";

export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const overlayRef = useRef(null);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    if (next.length < 4) {
      setError("הסיסמה החדשה קצרה מדי");
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal modal--narrow">
        <div className="modal__header">
          <span className="modal__title">שינוי סיסמה</span>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        {done ? (
          <div className="modal__body">
            <p className="change-pw-success">הסיסמה שונתה בהצלחה</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal__body">
              <div className="form-group">
                <label className="form-label">סיסמה נוכחית</label>
                <input
                  type="password"
                  className="form-input"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">סיסמה חדשה</label>
                <input
                  type="password"
                  className="form-input"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">אימות סיסמה חדשה</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {error && <p className="form-error">{error}</p>}
            </div>
            <div className="modal__footer">
              <button type="button" className="btn-ghost" onClick={onClose}>ביטול</button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving || !current || !next || !confirm}
              >
                {saving ? "שומר..." : "שמור"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
