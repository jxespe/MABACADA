// src/BamacadaDashboard.jsx
// ------------------------------------------------------
// GLOBAL CONSTANTS OUTSIDE COMPONENT
// ------------------------------------------------------
const WAYPOINTS = [
  { location: { lat: 15.9206, lng: 120.4157 } }, // Malasiqui
  { location: { lat: 16.0117, lng: 120.3570 } }, // Calasiao
];

const BAYAMBANG = { lat: 15.8127, lng: 120.4540 };
const DAGUPAN = { lat: 16.0431, lng: 120.3333 };

const OFFLINE_MS = 2 * 60 * 1000; // 2 mins

const ROUTE_COLORS = {
  "Bayambang→Dagupan": "#16a34a",
  "Dagupan→Calasiao": "#0ea5e9",
  "Calasiao→Malasiqui": "#f97316",
  "Malasiqui→Bayambang": "#facc15",
  default: "#16a34a",
};

// Simple marker SVG used for map markers (unchanged)
function createMarkerSVG(color, online = true, heading = 0) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <g transform="translate(22,22) rotate(${heading})">
        <circle cx="0" cy="0" r="18" fill="${color}" opacity="${online ? 1 : 0.4}" />
        <rect x="-9" y="-6" width="18" height="10" rx="3" fill="white"/>
        <rect x="-6" y="-2" width="4" height="4" fill="${color}" />
        <rect x="2" y="-2" width="4" height="4" fill="${color}" />
      </g>
      <circle cx="34" cy="10" r="5" fill="${online ? "#16a34a" : "#9ca3af"}" stroke="white" stroke-width="1"/>
    </svg>
  `;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  updateDoc,
  deleteField,
  runTransaction,
} from "firebase/firestore";

// ---------- TEST USER (per your selection) ----------
const USER_ID = "testUser1";

// ------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------
export default function BamacadaDashboard() {
  const [units, setUnits] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [screen, setScreen] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSeat, setConfirmSeat] = useState(null);
  const [confirmUnitId, setConfirmUnitId] = useState(null);

  
  const navigate = useNavigate();
  const auth = getAuth();
  const map = useRef(null);
  const markers = useRef({});
  const dirService = useRef(null);
  const dirRenderer = useRef(null);
  const routePoints = useRef([]);

  // ----------------------------
  // Listen to all units
  // ----------------------------
  useEffect(() => {
    return onSnapshot(collection(db, "units"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUnits(list);
      if (selectedId && !list.find((u) => u.id === selectedId)) setSelectedId(null);
    });
  }, [selectedId]);

  // ----------------------------
  // Listen to selected unit (realtime)
  // ----------------------------
  useEffect(() => {
    if (!selectedId) return setSelectedUnit(null);

    return onSnapshot(doc(db, "units", selectedId), (snap) => {
      if (!snap.exists()) return setSelectedUnit(null);
      setSelectedUnit({ id: snap.id, ...snap.data() });
    });
  }, [selectedId]);

  // ----------------------------
  // Init Google Map + Route
  // ----------------------------
  useEffect(() => {
    let timer = setInterval(() => {
      const el = document.getElementById("map-container-map");

      if (window.google && el && !map.current) {
        map.current = new window.google.maps.Map(el, {
          center: { lat: 16.02, lng: 120.36 },
          zoom: 12,
          disableDefaultUI: true,
        });

        dirService.current = new window.google.maps.DirectionsService();
        dirRenderer.current = new window.google.maps.DirectionsRenderer({
          map: map.current,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#22c55e", strokeWeight: 5 },
        });

        // ---------- LOCATION PINS ----------
        [
          { pos: BAYAMBANG, title: "Bayambang Terminal", color: "red" },
          { pos: WAYPOINTS[0].location, title: "Malasiqui", color: "blue" },
          { pos: WAYPOINTS[1].location, title: "Calasiao", color: "orange" },
          { pos: DAGUPAN, title: "Dagupan City", color: "green" },
        ].forEach((t) => {
          // keep simple marker + label
          const m = new window.google.maps.Marker({
            map: map.current,
            position: t.pos,
            title: t.title,
            icon: { url: `http://maps.google.com/mapfiles/ms/icons/${t.color}-dot.png` },
          });
          const iw = new window.google.maps.InfoWindow({ content: `<div style="font-size:12px">${t.title}</div>` });
          // show label initially
          iw.open({ map: map.current, anchor: m });
          m.addListener("click", () => iw.open({ map: map.current, anchor: m }));
        });

        // Route
        dirService.current.route(
          {
            origin: BAYAMBANG,
            destination: DAGUPAN,
            waypoints: WAYPOINTS,
            travelMode: "DRIVING",
          },
          (res, status) => {
            if (status === "OK") {
              dirRenderer.current.setDirections(res);
              const path = res.routes[0].overview_path;
              routePoints.current = path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
            }
          }
        );

        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, []);


   // ----------------------------
  // Math helpers for snapping to route
  // ----------------------------
  function projectToSegment(A, B, P) {
    const ax = A.lng,
      ay = A.lat;
    const bx = B.lng,
      by = B.lat;
    const px = P.lng,
      py = P.lat;
    const abx = bx - ax,
      aby = by - ay;
    const apx = px - ax,
      apy = py - ay;
    const denom = abx * abx + aby * aby;
    if (!denom) return A;
    let t = (abx * apx + aby * apy) / denom;
    t = Math.max(0, Math.min(1, t));
    return { lat: ay + aby * t, lng: ax + abx * t };
  }
  function nearestPointOnRoute(point) {
    const pts = routePoints.current;
    if (!pts.length) return point;
    let best = point;
    let minD = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i],
        B = pts[i + 1];
      const proj = projectToSegment(A, B, point);
      const d = (proj.lat - point.lat) ** 2 + (proj.lng - point.lng) ** 2;
      if (d < minD) {
        minD = d;
        best = proj;
      }
    }
    return best;
  }

  // ----------------------------
  // Update markers on map (snap + show plate via InfoWindow on hover)
  // ----------------------------
  useEffect(() => {
  if (!map.current || !window.google) return;

  const now = Date.now();
  const activeIds = new Set(units.map((u) => u.id));

  // remove missing markers
  Object.keys(markers.current).forEach((id) => {
    if (!activeIds.has(id)) {
      try { markers.current[id].setMap(null); } catch (_) {}
      delete markers.current[id];
    }
  });

  units.forEach((u) => {
    if (!u.lat || !u.lng) return;
    const snapped = nearestPointOnRoute({ lat: u.lat, lng: u.lng });
    const last = u.lastUpdated?.toMillis?.() ?? u.lastUpdated ?? 0;
    const online = now - last < OFFLINE_MS;

    // ⭐ HIGHLIGHT IF SELECTED
    const isSelected = selectedId === u.id;

    // make selected marker bigger + glow
    const scale = isSelected ? 60 : 44;

    const color = ROUTE_COLORS[u.route] || ROUTE_COLORS.default;
    const icon = {
      url: createMarkerSVG(color, online, u.heading ?? 0),
      scaledSize: new window.google.maps.Size(scale, scale),
    };

    if (!markers.current[u.id]) {
      const m = new window.google.maps.Marker({
        position: snapped,
        map: map.current,
        icon,
        optimized: false,
      });

      m.addListener("click", () => {
        setSelectedId(u.id);
        setLeftOpen(true);
        map.current.panTo(snapped);
        map.current.setZoom(15);
      });

      markers.current[u.id] = m;
    } else {
      markers.current[u.id].setPosition(snapped);
      markers.current[u.id].setIcon(icon); // ⭐ UPDATE ICON (highlight)
    }
  });
}, [units, selectedId]);   // ⭐ ADD selectedId


  const active = selectedUnit ?? units.find((u) => u.id === selectedId) ?? units[0] ?? null;

  // ----------------------------
  // Helper: seat state & click handling
  // ----------------------------
  function seatState(unit, seatNumber) {
    // unit.seats expected shape:
    // { total: 25, taken: [1,2], reserved: { userId: seatNumber } }
    const seats = unit?.seats || {};
    const taken = Array.isArray(seats.taken) ? seats.taken : [];
    const reserved = seats.reserved || {};
    if (reserved && reserved[USER_ID] === seatNumber) return "reservedByMe";
    if (taken.includes(seatNumber)) return "taken";
    // reserved by other user (map contains value equal to seatNumber)
    const reservedByOther = Object.entries(reserved).some(([uid, num]) => uid !== USER_ID && num === seatNumber);
    if (reservedByOther) return "taken";
    return "available";
  }

  async function reserveSeat(targetUnitId, seatNumber) {
    try {
      // 1) remove previous reservation by USER_ID across all units (if any)
      const qSnap = await getDocs(collection(db, "units"));
      const updates = [];
      qSnap.docs.forEach((d) => {
        const data = d.data();
        const seats = data?.seats || {};
        const reserved = seats.reserved || {};
        const prevSeat = reserved?.[USER_ID];
        if (prevSeat != null) {
          // attempt cleanup (non-blocking)
          updates.push(
            updateDoc(doc(db, "units", d.id), {
              [`seats.reserved.${USER_ID}`]: deleteField(),
              "seats.taken": Array.isArray(seats.taken) ? seats.taken.filter((s) => s !== prevSeat) : [],
            }).catch(() => {})
          );
        }
      });
      await Promise.all(updates);

      // 2) Try to reserve seat in target unit using transaction (to avoid race)
      await runTransaction(db, async (t) => {
        const uRef = doc(db, "units", targetUnitId);
        const uSnap = await t.get(uRef);
        if (!uSnap.exists()) throw new Error("Unit disappeared");

        const data = uSnap.data();
        const seats = data?.seats || {};
        const taken = Array.isArray(seats.taken) ? [...seats.taken] : [];
        const reserved = seats.reserved ? { ...seats.reserved } : {};

        // If seat is taken by others (different from our previous reservation), fail
        if (taken.includes(seatNumber) && reserved[USER_ID] !== seatNumber) {
          throw new Error("Seat already taken");
        }

        // clear any previous reservation by this user in this unit (if any)
        const prevSeatThisUnit = reserved?.[USER_ID];
        if (prevSeatThisUnit && prevSeatThisUnit !== seatNumber) {
          // remove old seat entry from taken
          const newTaken = taken.filter((s) => s !== prevSeatThisUnit);
          t.update(uRef, { "seats.taken": newTaken, [`seats.reserved.${USER_ID}`]: seatNumber });
        } else {
          // normal case: add seatNumber to taken if not present and set reserved map
          const newTaken = taken.includes(seatNumber) ? taken : [...taken, seatNumber];
          t.update(uRef, { "seats.taken": newTaken, [`seats.reserved.${USER_ID}`]: seatNumber });
        }
      });

      // 3) Now ensure previous reservations on other units are removed (cleanup)
      const all = await getDocs(collection(db, "units"));
      for (const docSnap of all.docs) {
        const d = docSnap.data();
        const seats = d?.seats || {};
        const reserved = seats.reserved || {};
        const prev = reserved?.[USER_ID];
        if (prev != null && docSnap.id !== targetUnitId) {
          // remove reservation from that doc
          try {
            await updateDoc(doc(db, "units", docSnap.id), {
              [`seats.reserved.${USER_ID}`]: deleteField(),
              "seats.taken": (Array.isArray(seats.taken) ? seats.taken.filter((s) => s !== prev) : []),
            });
          } catch (e) {
            // ignore non-critical update errors
          }
        }
      }

      // success (UI updates via onSnapshot)
    } catch (err) {
      alert(err.message ?? "Reserve failed");
      console.error("reserveSeat error:", err);
    }
  }

  async function cancelReservation(unitId) {
    try {
      await runTransaction(db, async (t) => {
        const uRef = doc(db, "units", unitId);
        const uSnap = await t.get(uRef);
        if (!uSnap.exists()) return;
        const data = uSnap.data();
        const seats = data?.seats || {};
        const reserved = seats.reserved || {};
        const mySeat = reserved?.[USER_ID];
        if (!mySeat) return; // nothing to cancel
        const newTaken = Array.isArray(seats.taken) ? seats.taken.filter((s) => s !== mySeat) : [];
        t.update(uRef, { [`seats.reserved.${USER_ID}`]: deleteField(), "seats.taken": newTaken });
      });
    } catch (err) {
      console.error("cancelReservation error:", err);
      alert("Cancel failed");
    }
  }

  // Seat click handler used in seat grid
  function onSeatClick(unit, seatNum) {
  const state = seatState(unit, seatNum);

  if (state === "available") {
    // step 1: temporary hold (reservedByMe)
    reserveSeat(unit.id, seatNum);

    // step 2: open confirmation popup
    setConfirmUnitId(unit.id);
    setConfirmSeat(seatNum);
  } 
  else if (state === "reservedByMe") {
    // cancel reservation
    cancelReservation(unit.id);
  } 
  else {
    alert("Seat is already taken.");
  }
}

async function confirmReservation(unitId, seatNumber) {
  try {
    await runTransaction(db, async (t) => {
      const ref = doc(db, "units", unitId);
      const snap = await t.get(ref);
      if (!snap.exists()) return;

      const data = snap.data();
      const seats = data.seats || {};
      const reserved = seats.reserved || {};

      // Only allow confirm if this seat is reserved by ME
      if (reserved[USER_ID] !== seatNumber) return;

      // Make sure the seat is inside taken[]
      const taken = Array.isArray(seats.taken) ? seats.taken : [];
      const newTaken = taken.includes(seatNumber) ? taken : [...taken, seatNumber];

      t.update(ref, {
        [`seats.reserved.${USER_ID}`]: deleteField(), // remove temporary hold
        "seats.taken": newTaken, // finalize as taken
      });
    });

  } catch (err) {
    console.error("Confirm reservation failed:", err);
    alert("Could not confirm reservation.");
  }
}



  // ----------------------------
  // UI LAYOUT (left panel + centered map + bottom floating nav/card)
  // ----------------------------
  return (
    
    <div className="min-h-screen h-screen bg-[#eef2ff] flex">
      {/* ------------------------------------------------------ */}
      {/* TOP-RIGHT MENU (OVER MAP, ALWAYS FRONT) */}
      {/* ------------------------------------------------------ */}
      <div className="fixed top-4 right-6 z-[999999] pointer-events-auto">
        <div className="relative">
          {/* Avatar Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-full border shadow bg-white flex items-center justify-center hover:scale-105 transition"
          >
            <img
              src="https://i.pravatar.cc/100?u=userMenu"
              className="w-full h-full rounded-full"
            />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white shadow-xl border rounded-lg py-1 z-[999999]">
              <button
                onClick={() => { setMenuOpen(false); navigate("/account"); }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                Account
              </button>

              <button
                onClick={() => { setMenuOpen(false); navigate("/settings"); }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                Settings
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut(auth).then(() => navigate("/login"));
                }}
                className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      {/* LEFT PROFILE PANEL */}
      <aside
        className={`transition-all bg-[#e8ffe8] border-r p-4 ${leftOpen ? "w-[380px]" : "w-0 overflow-hidden"}`}
      >
        {active ? (
          <>
            {/* Driver header */}
            <div className="flex gap-3 mb-5">
              <img src={active.photo ?? `https://i.pravatar.cc/150?u=${active.id}`} className="w-16 h-16 rounded-full border" />
              <div>
                <div className="font-bold text-lg">{active.driver}</div>
                <div className="text-sm">{active.plate ?? active.id}</div>
                <div className="text-xs text-gray-500">{active.route}</div>
              </div>
            </div>

            {/* Passenger + ETA */}
            <div className="flex gap-4 mb-6">
              <div className="w-24 h-24 rounded-full bg-green-600 text-white flex items-center justify-center text-3xl font-bold">
                {/* seats.taken length is current occupancy */}
                { (active.seats && Array.isArray(active.seats.taken)) ? active.seats.taken.length : (active.seats?.occupied ?? 0) }
              </div>
              <div>
                <div className="text-xs">Passengers</div>
                <div className="text-sm mt-2 font-bold">ETA</div>
                <div className="text-2xl font-bold">{active.eta ?? "—"}</div>
              </div>
            </div>

            {/* Seat map */}
            <div>
              <div className="font-semibold text-sm">Seat Map</div>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {Array.from({ length: active.seats?.total ?? 25 }).map((_, i) => {
                  const num = i + 1;
                  const s = seatState(active, num);
                  // choose classes
                  const base = "w-10 h-10 flex items-center justify-center text-xs rounded cursor-pointer select-none";
                  let cls = "bg-white border";
                  if (s === "taken") cls = "bg-blue-600 text-white";
                  if (s === "reservedByMe") cls = "bg-green-500 text-white";
                  // available: white with border
                  return (
                    <div
                      key={num}
                      className={`${base} ${cls}`}
                      onClick={() => onSeatClick(active, num)}
                      title={s === "available" ? "Click to reserve" : s === "reservedByMe" ? "Click to cancel" : "Taken"}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-4 space-y-2">
              <button onClick={() => (active.phone ? window.open(`tel:${active.phone}`) : null)} className="mt-2 py-2 bg-blue-600 text-white w-full rounded">
                Call Driver
              </button>
              <button
                onClick={() => {
                  if (active?.lat && map.current) {
                    try { map.current.panTo({ lat: active.lat, lng: active.lng }); map.current.setZoom(15); } catch (e) {}
                    setLeftOpen(false);
                  }
                }}
                className="mt-1 py-2 border rounded w-full"
              >
                Focus on Map
              </button>
            </div>
          </>
        ) : (
          <div>No data</div>
        )}
      </aside>

      {/* RIGHT MAIN CONTENT */}
      <div className="flex-1 relative flex flex-col">
        {/* MAP CONTAINER (Centered, Card Style) */}
        <div className="flex justify-center items-center p-4 h-full">
          <div className="w-full max-w-5xl h-full bg-white shadow-xl rounded-xl overflow-hidden">
            <div id="map-container-map" className="w-full h-full" />
          </div>
        </div>
        
        {/* FLOATING NAVIGATION BUTTONS centered above bottom card */}
        <div className="fixed bottom-[140px] left-1/2 -translate-x-1/2 z-[9999]">
          <div className="flex bg-white/70 backdrop-blur-md shadow-xl rounded-full px-3 py-1 border border-white/40 gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setScreen(n)}
                className={`px-3 py-1 text-xs rounded-full ${screen === n ? "bg-green-600 text-white shadow" : "text-gray-700"}`}
              >
                {["Fare", "Transit", "Schedule"][n - 1]}
              </button>
            ))}
          </div>
        </div>

        {/* FLOATING BOTTOM CARD */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[420px] z-[9998]">
          <div className="bg-white/90 backdrop-blur-xl shadow-xl rounded-2xl p-4 border border-white/40">
            {/* FARE */}
            {screen === 1 && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Bayambang → Malasiqui</span><b>₱20</b></div>
                <div className="flex justify-between"><span>Malasiqui → Calasiao</span><b>₱25</b></div>
                <div className="flex justify-between"><span>Calasiao → Dagupan</span><b>₱30</b></div>
              </div>
            )}
            {/* TRANSIT */}
            {screen === 2 && (
              <div className="space-y-1 text-sm max-h-[150px] overflow-y-auto">
                {units.map((u) => (
                  <div key={u.id} className="flex justify-between border-b py-1">
                    <span>{u.plate ?? u.id}</span>
                    <span className="px-2 py-0.5 text-xs bg-green-100 rounded-full">{u.status ?? "Active"}</span>
                  </div>
                ))}
              </div>
            )}
            {/* SCHEDULE */}
            {screen === 3 && (
              <div className="space-y-1 text-sm">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex justify-between py-1 border-b">
                    <span>{6 + i}:00</span>
                    <span className="font-mono">J-{100 + i}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* CONFIRMATION POPUP */}
          {confirmSeat && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999999]">
              <div className="bg-white p-6 rounded-xl shadow-xl w-80 text-center">
                <h2 className="text-lg font-semibold">Confirm Seat</h2>
                <p className="mt-2 text-gray-600">
                  Confirm reservation for seat <b>{confirmSeat}</b>?
                </p>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => {
                      confirmReservation(confirmUnitId, confirmSeat);
                      setConfirmSeat(null);
                      setConfirmUnitId(null);
                    }}
                    className="flex-1 bg-green-600 text-white py-2 rounded"
                  >
                    Confirm
                  </button>

                  <button
                    onClick={() => {
                      cancelReservation(confirmUnitId);
                      setConfirmSeat(null);
                      setConfirmUnitId(null);
                    }}
                    className="flex-1 bg-gray-300 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
