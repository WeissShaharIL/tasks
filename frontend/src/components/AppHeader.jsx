import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import ChangePasswordModal from "./ChangePasswordModal";

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showChangePw, setShowChangePw] = useState(false);
  const push = usePushNotifications();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="app-header">
      <div className="app-header__logo">
        <Link to="/">משימות</Link>
      </div>
      <div className="app-header__actions">
        {user?.is_admin && (
          <Link to="/admin" className="btn-link">
            הגדרות
          </Link>
        )}
        <span className="app-header__user">{user?.display_name}</span>
        {push.supported && (
          <button
            className={`btn-ghost ${push.subscribed ? "btn-ghost--on" : ""}`}
            onClick={push.toggle}
            disabled={push.busy}
            title={push.subscribed ? "התראות פעילות — לחץ לביטול" : "הפעל התראות"}
          >
            {push.subscribed ? "התראות פעילות" : "הפעל התראות"}
          </button>
        )}
        <button className="btn-ghost" onClick={() => setShowChangePw(true)}>
          סיסמה
        </button>
        <button className="btn-ghost" onClick={handleLogout}>
          התנתק
        </button>
      </div>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </header>
  );
}
