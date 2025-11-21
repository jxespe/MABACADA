// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./ProtectedRoute";

// Pages
import BamacadaDashboard from "./pages/BamacadaDashboard";
import Account from "./pages/Account";
import Settings from "./pages/Settings";

import DriverDetailsPage from "./pages/DriverDetailsPage";



export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/dashboard" element={<BamacadaDashboard />} />
        <Route path="/driver/:id" element={<DriverDetailsPage />} />

        {/* Default route */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* PROTECTED: Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <BamacadaDashboard />
            </ProtectedRoute>
          }
        />

        {/* PROTECTED: Account */}
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />

        {/* PROTECTED: Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Public pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

      </Routes>
    </BrowserRouter>
  );
}
