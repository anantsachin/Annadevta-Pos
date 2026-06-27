import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Billing from "./pages/Billing";
import DailyMenu from "./pages/DailyMenu";
import MenuPage from "./pages/MenuPage";
import OrderHistory from "./pages/OrderHistory";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

// Inventory Pages
import StaffAccounts from "./pages/StaffAccounts";
import InventoryDashboard from "./pages/inventory/InventoryDashboard";
import StockManagement from "./pages/inventory/StockManagement";
import Suppliers from "./pages/inventory/Suppliers";
import PurchaseOrders from "./pages/inventory/PurchaseOrders";
import InventoryReports from "./pages/inventory/InventoryReports";
import TransactionLedger from "./pages/inventory/TransactionLedger";

// Payroll Pages
import PayrollDashboard from "./pages/payroll/PayrollDashboard";

import SalaryStructures from "./pages/payroll/SalaryStructures";
import AttendanceTracker from "./pages/payroll/AttendanceTracker";
import PayrollProcessing from "./pages/payroll/PayrollProcessing";
import LoanManagement from "./pages/payroll/LoanManagement";
import PayrollReports from "./pages/payroll/PayrollReports";
import DirectPayments from "./pages/payroll/DirectPayments";
import LeaveManagement from "./pages/payroll/LeaveManagement";
function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Billing />} />
              <Route path="orders" element={<OrderHistory />} />
              <Route path="dashboard" element={<ProtectedRoute roles={["admin"]}><Dashboard /></ProtectedRoute>} />
              <Route path="daily-menu" element={<ProtectedRoute roles={["admin"]}><DailyMenu /></ProtectedRoute>} />
              <Route path="menu" element={<ProtectedRoute roles={["admin"]}><MenuPage /></ProtectedRoute>} />
              <Route path="reports" element={<ProtectedRoute roles={["admin"]}><Reports /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute roles={["admin"]}><Settings /></ProtectedRoute>} />
              <Route path="staff" element={<ProtectedRoute roles={["admin"]}><StaffAccounts /></ProtectedRoute>} />
              
              {/* Inventory Routes */}
              <Route path="inventory" element={<ProtectedRoute roles={["admin"]}><InventoryDashboard /></ProtectedRoute>} />
              <Route path="inventory/stock" element={<ProtectedRoute roles={["admin"]}><StockManagement /></ProtectedRoute>} />
              <Route path="inventory/suppliers" element={<ProtectedRoute roles={["admin"]}><Suppliers /></ProtectedRoute>} />
              <Route path="inventory/purchase-orders" element={<ProtectedRoute roles={["admin"]}><PurchaseOrders /></ProtectedRoute>} />
              <Route path="inventory/reports" element={<ProtectedRoute roles={["admin"]}><InventoryReports /></ProtectedRoute>} />
              <Route path="inventory/transactions" element={<ProtectedRoute roles={["admin"]}><TransactionLedger /></ProtectedRoute>} />

              {/* Payroll Routes */}
              <Route path="payroll" element={<ProtectedRoute roles={["admin"]}><PayrollDashboard /></ProtectedRoute>} />

              <Route path="payroll/structures" element={<ProtectedRoute roles={["admin"]}><SalaryStructures /></ProtectedRoute>} />
              <Route path="payroll/attendance" element={<ProtectedRoute roles={["admin"]}><AttendanceTracker /></ProtectedRoute>} />
              <Route path="payroll/process" element={<ProtectedRoute roles={["admin"]}><PayrollProcessing /></ProtectedRoute>} />
              <Route path="payroll/advances" element={<ProtectedRoute roles={["admin"]}><LoanManagement /></ProtectedRoute>} />
              <Route path="payroll/direct-payments" element={<ProtectedRoute roles={["admin"]}><DirectPayments /></ProtectedRoute>} />
              <Route path="payroll/reports" element={<ProtectedRoute roles={["admin"]}><PayrollReports /></ProtectedRoute>} />
              <Route path="payroll/leaves" element={<ProtectedRoute roles={["admin"]}><LeaveManagement /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
