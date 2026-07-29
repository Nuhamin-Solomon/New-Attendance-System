# Kifiya Attendance Management System

A comprehensive web-based attendance management system integrated with BioTime 8.5 biometric devices, built for Kifiya Financial Technology plc.

## Features

- **BioTime Integration**: Automatic employee and attendance data sync every 60 seconds
- **Hours-Based Attendance**: Tracks 9-hour workday with Present/Partial/Incomplete/Absent statuses
- **Two-Stage Approval**: Manager → HR approval workflow for leave and duty requests
- **Role-Based Access Control**: Admin, HR, Manager, Employee with department-level scoping
- **Reporting**: Daily, Weekly, Monthly, and Department reports with Excel export
- **Employee Self-Service**: View attendance, submit requests, cancel/recall
- **Notifications**: Real-time in-app notification system
- **Audit Logging**: Complete trail of all critical operations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, Recharts |
| Backend | Node.js 18+, Express 4 |
| Database | PostgreSQL 14+ |
| External | BioTime 8.5 (biometric device) |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- BioTime 8.5 accessible at configured URL

### Installation

```powershell
# Clone repository
git clone <repository-url>
cd New-Attendance-System

# Backend setup
cd backend
npm install
Copy-Item .env.example .env  # Configure .env
node src/config/run_migration.js  # Run database migrations

# Start backend
node server.js

# Frontend setup (new terminal)
cd ../frontend
npm install
npm run dev
```

### Default Accounts

| Username | Password | Role |
|----------|----------|------|
| Admin | admin123 | Admin |

### Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **BioTime**: http://172.16.11.241:5000

## Database

- **Database**: PostgreSQL (attendance_db)
- **14 Tables**: employees, users, departments, department_assignments, attendance_logs, attendance_summary, attendance_requests, leave_requests, leave_types, leave_balances, notifications, settings, audit_log, roles
- **313 Employees**: Synced from BioTime across 32 departments
- **4 Migrations**: Run `node src/config/run_migration.js` to initialize

## License

Proprietary - Kifiya Financial Technology plc
