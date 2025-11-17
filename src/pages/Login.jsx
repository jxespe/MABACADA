// src/pages/Login.jsx
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    if (!form.email || !form.password) {
      setErr("Please fill both fields.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      navigate("/dashboard");
    } catch (error) {
      console.error("login:", error);
      setErr(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Sign in</h2>

        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Email</label>
            <input
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </div>

          <button type="submit" disabled={loading} className="w-full py-2 bg-green-600 text-white rounded mt-2">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="text-sm text-center mt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-green-600 font-medium">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
