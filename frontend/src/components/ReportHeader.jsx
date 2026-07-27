import { useAuth } from "../context/AuthContext";

export default function ReportHeader({ title, subtitle, dateRange, children }) {
  const { user } = useAuth();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="report-header">
      <div className="report-header-top">
        <div className="report-brand">
          <div className="brand-mark brand-mark-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z"/></svg>
          </div>
          <div>
            <h2 className="report-company">Kifiya Financial Technology</h2>
            <p className="report-subtitle-sm">Attendance Management System</p>
          </div>
        </div>
        <div className="report-meta">
          <span className="report-meta-item">Generated: {dateStr} {timeStr}</span>
          <span className="report-meta-item">By: {user?.full_name || user?.username || "System"}</span>
        </div>
      </div>
      <div className="report-header-bottom">
        <div>
          <h1 className="report-title">{title}</h1>
          {subtitle && <p className="report-period">{subtitle}</p>}
          {dateRange && <p className="report-period">{dateRange}</p>}
        </div>
        <div className="report-actions">{children}</div>
      </div>
    </div>
  );
}
