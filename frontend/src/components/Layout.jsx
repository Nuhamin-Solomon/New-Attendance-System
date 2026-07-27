import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";
import Icon from "./Icon";

export default function Layout({ children, currentPage, onNavigate, onLogout }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
          <Icon name="menu" size={20} />
        </button>
        <div className="mobile-brand">
          <div className="brand-mark brand-mark-sm"><Icon name="building" size={14} /></div>
          <span>Kifiya</span>
        </div>
      </div>

      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <div className={`sidebar-wrapper ${mobileOpen ? "sidebar-open" : ""}`}>
        <Sidebar currentPage={currentPage} onNavigate={(p) => { onNavigate(p); setMobileOpen(false); }} onLogout={onLogout} />
      </div>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
