import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import OnlineOrders from "./pages/OnlineOrders";
import POS from "./pages/POS";
import Kitchen from "./pages/Kitchen";
import Tables from "./pages/Tables";
import MenuPage from "./pages/MenuPage";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Discounts from "./pages/Discounts";
import Staff from "./pages/Staff";
import Reports from "./pages/Reports";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<OnlineOrders />} />
            <Route path="pos" element={<POS />} />
            <Route path="kitchen" element={<Kitchen />} />
            <Route path="tables" element={<Tables />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="menu" element={<ProtectedRoute roles={["admin", "manager"]}><MenuPage /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute roles={["admin", "manager"]}><Inventory /></ProtectedRoute>} />
            <Route path="customers" element={<Customers />} />
            <Route path="discounts" element={<ProtectedRoute roles={["admin", "manager"]}><Discounts /></ProtectedRoute>} />
            <Route path="staff" element={<ProtectedRoute roles={["admin"]}><Staff /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute roles={["admin", "manager"]}><Reports /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
