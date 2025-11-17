// src/pages/Register.jsx
import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setErr("");
    if (!form.name || !form.email || !form.password) {
      setErr("Please fill all required fields.");
      return;
    }
    if (form.password !== form.confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      // update displayName
      await updateProfile(userCred.user, { displayName: form.name });

      // Create Firestore user document
      await setDoc(doc(db, "users", userCred.user.uid), {
        uid: userCred.user.uid,
        name: form.name,
        email: form.email,
        role: "passenger", // default role — change if you want to let user choose
        createdAt: serverTimestamp(),
        reservedSeat: null, // seat reservation will be managed here
      });

      // redirect to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("register:", error);
      setErr(error.message || "Registration error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Create an account</h2>

        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Full name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="you@example.com"
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

          <div>
            <label className="text-xs text-gray-600">Confirm Password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm((s) => ({ ...s, confirm: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-green-600 text-white rounded mt-2"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <div className="text-sm text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-green-600 font-medium">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
