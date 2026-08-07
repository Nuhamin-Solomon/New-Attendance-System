import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ChangePassword from "./pages/ChangePassword";
import DashboardPage from "./pages/Dashboard";
import EmployeeDashboardPage from "./pages/EmployeeDashboard";
import EmployeesPage from "./pages/Employees";
import EmployeeProfilePage from "./pages/EmployeeProfile";
import AttendanceTransactionsPage from "./pages/AttendanceTransactions";
import AttendanceSummaryPage from "./pages/AttendanceSummary";
import MyAttendancePage from "./pages/MyAttendance";
import MyTeamPage from "./pages/MyTeam";
import LeavePage from "./pages/Leave";
import RequestsPage from "./pages/Requests";
import MyRequestsPage from "./pages/MyRequests";
import ApprovalQueuePage from "./pages/ApprovalQueue";
import NotificationsPage from "./pages/Notifications";
import WeeklyReportPage from "./pages/WeeklyReport";
import MonthlyReportPage from "./pages/MonthlyReport";
import MonthlySummaryPage from "./pages/MonthlySummary";
import DailyReportPage from "./pages/DailyReport";
import DepartmentReportPage from "./pages/Reports/DepartmentReport";
import UsersPage from "./pages/admin/Users";
import DepartmentManagementPage from "./pages/admin/DepartmentManagement";
import RolesPage from "./pages/admin/Roles";
import SettingsPage from "./pages/admin/Settings";
import AuditLogPage from "./pages/admin/AuditLog";
import DataImportExportPage from "./pages/admin/DataImportExport";

function AppRoutes() {
  const { user, loading, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading Kifiya Attendance...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (mustChangePassword) {
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/dashboard" replace />} />
      <Route path="/change-password" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  {user.role === "employee" ? <EmployeeDashboardPage /> : <DashboardPage />}
                </ProtectedRoute>
              } />
              <Route path="/employees" element={<ProtectedRoute roles={["admin", "hr"]}><EmployeesPage /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute roles={["admin", "hr"]}><EmployeeProfilePage /></ProtectedRoute>} />
              <Route path="/my-attendance" element={<ProtectedRoute><MyAttendancePage /></ProtectedRoute>} />
              <Route path="/attendance-summary" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><AttendanceSummaryPage /></ProtectedRoute>} />
              <Route path="/attendance-transactions" element={<ProtectedRoute roles={["admin", "hr"]}><AttendanceTransactionsPage /></ProtectedRoute>} />
              <Route path="/my-team" element={<ProtectedRoute roles={["manager", "hr"]}><MyTeamPage /></ProtectedRoute>} />
              <Route path="/leave" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
              <Route path="/my-requests" element={<ProtectedRoute><MyRequestsPage /></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute roles={["manager", "hr", "admin"]}><ApprovalQueuePage /></ProtectedRoute>} />
              <Route path="/daily-report" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><DailyReportPage /></ProtectedRoute>} />
              <Route path="/weekly-report" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><WeeklyReportPage /></ProtectedRoute>} />
              <Route path="/monthly-report" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><MonthlyReportPage /></ProtectedRoute>} />
              <Route path="/monthly-summary" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><MonthlySummaryPage /></ProtectedRoute>} />
              <Route path="/department-report" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><DepartmentReportPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><UsersPage /></ProtectedRoute>} />
              <Route path="/admin/departments" element={<ProtectedRoute roles={["admin"]}><DepartmentManagementPage /></ProtectedRoute>} />
              <Route path="/admin/roles" element={<ProtectedRoute roles={["admin"]}><RolesPage /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute roles={["admin"]}><SettingsPage /></ProtectedRoute>} />
              <Route path="/admin/audit" element={<ProtectedRoute roles={["admin"]}><AuditLogPage /></ProtectedRoute>} />
              <Route path="/admin/data" element={<ProtectedRoute roles={["admin", "hr"]}><DataImportExportPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
