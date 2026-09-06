import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import ContractsPage from './pages/ContractsPage';
import AttendancePage from './pages/AttendancePage';
import TimeOffPage from './pages/TimeOffPage';
import PayrollPage from './pages/PayrollPage';
import PayrunDetailPage from './pages/PayrunDetailPage';
import PayslipsPage from './pages/PayslipsPage';
import SalaryStructuresPage from './pages/SalaryStructuresPage';
import DashboardPage from './pages/DashboardPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import UserManagementPage from './pages/UserManagementPage';

import { ToastProvider } from './contexts/ToastContext';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes — All Authenticated Users */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <HomePage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <Layout>
                  <AttendancePage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/time-off"
            element={
              <ProtectedRoute>
                <Layout>
                  <TimeOffPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/payslips"
            element={
              <ProtectedRoute roles={['Employee', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin']}>
                <Layout>
                  <PayslipsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* HR Manager+ Routes */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute roles={['HR_Manager', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin']}>
                <Layout>
                  <EmployeesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute roles={['HR_Manager', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin']}>
                <Layout>
                  <EmployeeDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/contracts"
            element={
              <ProtectedRoute roles={['HR_Manager', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin']}>
                <Layout>
                  <ContractsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Payroll User+ Routes */}
          <Route
            path="/payroll"
            element={
              <ProtectedRoute roles={['HR_Payroll_User', 'HR_Payroll_Manager', 'Admin']}>
                <Layout>
                  <PayrollPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll/:id"
            element={
              <ProtectedRoute roles={['HR_Payroll_User', 'HR_Payroll_Manager', 'Admin']}>
                <Layout>
                  <PayrunDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/salary-structures"
            element={
              <ProtectedRoute roles={['HR_Payroll_User', 'HR_Payroll_Manager', 'Admin']}>
                <Layout>
                  <SalaryStructuresPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['HR_Payroll_User', 'HR_Payroll_Manager', 'Admin']}>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <Layout>
                  <ChangePasswordPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['Admin']}>
                <Layout>
                  <UserManagementPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
  );
}
