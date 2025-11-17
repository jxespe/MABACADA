// src/pages/Account.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Account() {
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  const user = auth.currentUser;

  useEffect(() => {
    async function loadUser() {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setUserData(snap.data());
      }
    }
    loadUser();
  }, [user]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  if (!user) {
    return <div className="p-6">No user logged in.</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 border">

        <h2 className="text-xl font-semibold mb-4">My Account</h2>

        <div className="mb-4">
          <label className="text-xs text-gray-500">Full Name</label>
          <div className="text-base font-medium">
            {userData?.name ?? "Loading..."}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-500">Email</label>
          <div className="text-base font-medium">
            {userData?.email ?? user.email}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white py-2 rounded-lg mt-3"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
