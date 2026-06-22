import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Billing from "./pages/Billing";
import DailyMenu from "./pages/DailyMenu";
import MenuPage from "./pages/MenuPage";
import OrderHistory from "./pages/OrderHistory";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Billing />} />
              <Route path="orders" element={<OrderHistory />} />
              <Route path="dashboard" element={<ProtectedRoute roles={["admin"]}><Dashboard /></ProtectedRoute>} />
              <Route path="daily-menu" element={<ProtectedRoute roles={["admin"]}><DailyMenu /></ProtectedRoute>} />
              <Route path="menu" element={<ProtectedRoute roles={["admin"]}><MenuPage /></ProtectedRoute>} />
              <Route path="reports" element={<ProtectedRoute roles={["admin"]}><Reports /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute roles={["admin"]}><Settings /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
