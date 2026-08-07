import { useEffect, useState } from "react";
import API from "../../services/api";

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    API.get("/settings").then((r) => {
      const flat = {};
      for (const [cat, items] of Object.entries(r.data)) {
        for (const item of items) flat[item.key] = item.value;
      }
      setSettings(flat);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const workingDaySet = new Set(String(settings.working_days || "1,2,3,4,5").split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n)));

  const toggleWorkingDay = (dow) => {
    const next = new Set(workingDaySet);
    if (next.has(dow)) next.delete(dow); else next.add(dow);
    update("working_days", [...next].sort((a, b) => a - b).join(","));
  };

  const DAY_LABELS = [
    { dow: 0, label: "Sun" },
    { dow: 1, label: "Mon" },
    { dow: 2, label: "Tue" },
    { dow: 3, label: "Wed" },
    { dow: 4, label: "Thu" },
    { dow: 5, label: "Fri" },
    { dow: 6, label: "Sat" },
  ];

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const payload = Object.entries(settings).map(([key, value]) => ({
        key, value,
        category: key.includes("api") || key.includes("biotime") ? "integration" : key.includes("color") || key.includes("logo") || key.includes("company") ? "company" : "attendance",
      }));
      await API.put("/settings", { settings: payload });
      setMsg("Settings saved successfully.");
    } catch { setMsg("Failed to save settings."); }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) return <div className="page-container"><div className="loading-spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Administration</p><h1>System Settings</h1><p>Configure company info, attendance rules, and integrations.</p></div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button>
      </div>

      {msg && <div className={`alert ${msg.includes("success") ? "alert-success" : "alert-error"}`}>{msg}</div>}

      <div className="settings-grid">
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Company Information</div></div>
          <div className="panel-body">
            <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" value={settings.company_name || ""} onChange={(e) => update("company_name", e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Logo URL</label><input className="form-input" value={settings.company_logo || ""} onChange={(e) => update("company_logo", e.target.value)} /></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div className="panel-title">Theme Colors</div></div>
          <div className="panel-body">
            <div className="color-grid">
              <div className="form-group"><label className="form-label">Primary</label><div className="color-input"><input type="color" value={settings.primary_color || "#02404F"} onChange={(e) => update("primary_color", e.target.value)} /><input className="form-input" value={settings.primary_color || ""} onChange={(e) => update("primary_color", e.target.value)} /></div></div>
              <div className="form-group"><label className="form-label">Secondary</label><div className="color-input"><input type="color" value={settings.secondary_color || "#EB7D23"} onChange={(e) => update("secondary_color", e.target.value)} /><input className="form-input" value={settings.secondary_color || ""} onChange={(e) => update("secondary_color", e.target.value)} /></div></div>
              <div className="form-group"><label className="form-label">Teal</label><div className="color-input"><input type="color" value={settings.teal_color || "#0F5565"} onChange={(e) => update("teal_color", e.target.value)} /><input className="form-input" value={settings.teal_color || ""} onChange={(e) => update("teal_color", e.target.value)} /></div></div>
              <div className="form-group"><label className="form-label">Light</label><div className="color-input"><input type="color" value={settings.light_color || "#F3F5F6"} onChange={(e) => update("light_color", e.target.value)} /><input className="form-input" value={settings.light_color || ""} onChange={(e) => update("light_color", e.target.value)} /></div></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div className="panel-title">Attendance Rules</div></div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group"><label className="form-label">Working Hours Start</label><input className="form-input" type="time" value={settings.working_hours_start || ""} onChange={(e) => update("working_hours_start", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Working Hours End</label><input className="form-input" type="time" value={settings.working_hours_end || ""} onChange={(e) => update("working_hours_end", e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Standard Working Hours / Day</label><input className="form-input" type="number" min="1" max="24" step="0.5" value={settings.standard_working_hours || ""} onChange={(e) => update("standard_working_hours", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Overtime Threshold (hours)</label><input className="form-input" type="number" value={settings.overtime_threshold_hours || ""} onChange={(e) => update("overtime_threshold_hours", e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Late Threshold (minutes)</label><input className="form-input" type="number" value={settings.late_threshold_minutes || ""} onChange={(e) => update("late_threshold_minutes", e.target.value)} /></div>
              <div className="form-group" />
            </div>
            <div className="form-group">
              <label className="form-label">Working Days</label>
              <div className="working-days-grid">
                {DAY_LABELS.map((d) => (
                  <label key={d.dow} className={`wd-day-chip${workingDaySet.has(d.dow) ? " selected" : ""}`}>
                    <input type="checkbox" checked={workingDaySet.has(d.dow)} onChange={() => toggleWorkingDay(d.dow)} />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
              <p className="form-hint">Days selected here are counted as working days in attendance summaries, late/absence reports, and leave day calculations. Official days are Mon–Fri.</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div className="panel-title">BioTime Integration</div></div>
          <div className="panel-body">
            <div className="form-group"><label className="form-label">BioTime API URL</label><input className="form-input" value={settings.biotime_api_url || ""} onChange={(e) => update("biotime_api_url", e.target.value)} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
