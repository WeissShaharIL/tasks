import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ColumnsManager from "../components/admin/ColumnsManager";
import PropertyDefsManager from "../components/admin/PropertyDefsManager";
import { useBoard } from "../contexts/BoardContext";
import UsersManager from "../components/admin/UsersManager";

export default function AdminPage() {
  const { loaded } = useBoard();

  if (!loaded) {
    return (
      <div className="page-layout">
        <AppHeader />
        <div className="loading-screen">טוען...</div>
      </div>
    );
  }

  return (
    <div className="page-layout">
      <AppHeader />
      <main className="admin-page">
        <div className="admin-page__header">
          <h1>הגדרות לוח</h1>
          <Link to="/" className="btn-ghost">← חזור ללוח</Link>
        </div>
        <div className="admin-page__sections">
          <ColumnsManager />
          <PropertyDefsManager />
          <UsersManager />
        </div>
      </main>
    </div>
  );
}
