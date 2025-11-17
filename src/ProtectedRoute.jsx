// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, fallback = "/login" }) {
  const [status, setStatus] = useState({ checking: true, user: null });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setStatus({ checking: false, user });
    });
    return () => unsub();
  }, []);

  if (status.checking) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">Checking authentication...</div>
      </div>
    );
  }

  if (!status.user) return <Navigate to={fallback} replace />;

  return children;
}
