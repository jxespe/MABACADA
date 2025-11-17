import React, { useState } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function logoutUser() {
    signOut(auth);
    navigate("/login");
  }

  return (
    <div className="relative">
      {/* Avatar Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold hover:bg-green-700"
      >
        {auth.currentUser?.displayName?.charAt(0)?.toUpperCase() || "U"}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-lg w-40 border p-2 animate-fadeIn z-[9999]">
          
          <button
            onClick={() => { setOpen(false); navigate("/account"); }}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100"
          >
            Account
          </button>

          <button
            onClick={() => { setOpen(false); navigate("/settings"); }}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100"
          >
            Settings
          </button>

          <div className="border-t my-2"></div>

          <button
            onClick={logoutUser}
            className="w-full text-left px-3 py-2 rounded text-red-600 hover:bg-red-50"
          >
            Logout
          </button>

        </div>
      )}
    </div>
  );
}
