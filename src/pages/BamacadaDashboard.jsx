// src/BamacadaDashboard.jsx
// Updated: migrate markers to AdvancedMarkerElement + https SVG icons + misc fixes
/* IMPORTANT: For best performance, update how you load the Maps API in your HTML:
   <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=geometry&loading=async" defer></script>
*/

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

// ---------- CONSTANTS ----------
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

// ---------- Test user ----------
const USER_ID = "testUser1";

// ---------- Helper: create marker SVG (data URL) ----------
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

// Create a DOM element to be used as AdvancedMarker content
function createMarkerElement(svgDataUrl, size = 44, isSelected = false) {
  const container = document.createElement("div");
  container.className = "bam-marker";
  container.style.width = `${size}px`;
  container.style.height = `${size}px`;
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.cursor = "pointer";
  container.style.transform = isSelected ? "scale(1.35)" : "none";
  // add a subtle shadow/glow for selected
  container.style.filter = isSelected ? "drop-shadow(0 6px 10px rgba(0,0,0,0.2))" : "none";

  const img = document.createElement("img");
  img.src = svgDataUrl;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.display = "block";
  container.appendChild(img);

  return container;
}

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
  const markers = useRef({}); // stores marker instances keyed by unit id
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

        // ---------- LOCATION PINS (use https icons) ----------
        [
          { pos: BAYAMBANG, title: "Bayambang Terminal", color: "red" },
          { pos: WAYPOINTS[0].location, title: "Malasiqui", color: "blue" },
          { pos: WAYPOINTS[1].location, title: "Calasiao", color: "orange" },
          { pos: DAGUPAN, title: "Dagupan City", color: "green" },
        ].forEach((t) => {
          const m = new window.google.maps.Marker({
            map: map.current,
            position: t.pos,
            title: t.title,
            // use https icons
            icon: { url: `https://maps.google.com/mapfiles/ms/icons/${t.color}-dot.png` },
          });
          const iw = new window.google.maps.InfoWindow({ content: `<div style="font-size:12px">${t.title}</div>` });
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
  // Geometry helpers (unchanged)
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
  function computeETAFromRoute(unitPosition) {
    const pts = routePoints.current;
    if (!pts.length) return null;

    // 1) Find nearest index
    let idx = 0;
    let min = Infinity;

    pts.forEach((p, i) => {
      const d = (p.lat - unitPosition.lat) ** 2 + (p.lng - unitPosition.lng) ** 2;
      if (d < min) {
        min = d;
        idx = i;
      }
    });

    // 2) Compute remaining path distance
    let dist = 0;
    for (let i = idx; i < pts.length - 1; i++) {
      const A = pts[i];
      const B = pts[i + 1];
      dist += window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(A.lat, A.lng),
        new window.google.maps.LatLng(B.lat, B.lng)
      );
    }

    // 3) Convert to minutes (speed ~30km/h → 8.33 m/s)
    const seconds = dist / 8.33;
    return Math.round(seconds / 60) + " min";
  }

  // -----------------------------------------------------
  // Write ETA into Firestore for each unit
  // -----------------------------------------------------
  useEffect(() => {
    if (!units.length || !routePoints.current.length || !window.google) return;

    units.forEach(async (u) => {
      if (!u.lat || !u.lng) return;

      const eta = computeETAFromRoute({ lat: u.lat, lng: u.lng });
      if (!eta) return;

      try {
        await updateDoc(doc(db, "units", u.id), { eta });
      } catch (err) {
        console.warn("ETA update failed:", err);
      }
    });
  }, [units]);

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
        try {
          const existing = markers.current[id];
          // remove from map
          if (existing?.setMap) {
            existing.setMap(null);
          } else {
            // AdvancedMarkerElement may not have setMap; try setting map property to null
            try { existing.map = null; } catch (_) {}
          }
        } catch (_) {}
        delete markers.current[id];
      }
    });

    units.forEach((u) => {
      if (!u.lat || !u.lng) return;
      const snapped = nearestPointOnRoute({ lat: u.lat, lng: u.lng });
      const last = u.lastUpdated?.toMillis?.() ?? u.lastUpdated ?? 0;
      const online = now - last < OFFLINE_MS;

      // HIGHLIGHT IF SELECTED
      const isSelected = selectedId === u.id;

      // scale when selected
      const scale = isSelected ? 60 : 44;

      const color = ROUTE_COLORS[u.route] || ROUTE_COLORS.default;
      const svgUrl = createMarkerSVG(color, online, u.heading ?? 0);

      // If marker exists, remove it and re-create so we can update styling easily
      if (markers.current[u.id]) {
        try {
          const existing = markers.current[u.id];
          if (existing?.setMap) existing.setMap(null);
          else existing.map = null;
        } catch (err) {
          // ignore
        }
        delete markers.current[u.id];
      }

      // create element content
      const element = createMarkerElement(svgUrl, scale, isSelected);

      // attach click handler to the DOM element
      element.addEventListener("click", () => {
        // navigate to driver details page (separate page)
        navigate(`/driver/${u.id}`);
      });

      // create AdvancedMarkerElement if available, else fallback to Marker
      try {
        if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
          const advMarker = new window.google.maps.marker.AdvancedMarkerElement({
            map: map.current,
            position: snapped,
            title: u.plate ?? u.id,
            // AdvancedMarkerElement uses 'content' option for DOM element
            content: element,
          });
          markers.current[u.id] = advMarker;
        } else {
          // fallback using classic Marker with icon data URL
          const markerIcon = {
            url: svgUrl,
            scaledSize: new window.google.maps.Size(scale, scale),
          };

          const marker = new window.google.maps.Marker({
            map: map.current,
            position: snapped,
            icon: markerIcon,
            title: u.plate ?? u.id,
            optimized: false,
          });

          marker.addListener("click", () => {
            navigate(`/driver/${u.id}`);
          });

          markers.current[u.id] = marker;
        }
      } catch (err) {
        // defensive fallback: classic Marker
        console.warn("Marker creation error, falling back to Marker:", err);
        const markerIcon = {
          url: svgUrl,
          scaledSize: new window.google.maps.Size(scale, scale),
        };

        const marker = new window.google.maps.Marker({
          map: map.current,
          position: snapped,
          icon: markerIcon,
          title: u.plate ?? u.id,
          optimized: false,
        });

        marker.addListener("click", () => {
          navigate(`/driver/${u.id}`);
        });

        markers.current[u.id] = marker;
      }
    });
  }, [units, selectedId, navigate]);

  const active = selectedUnit ?? units.find((u) => u.id === selectedId) ?? units[0] ?? null;

  // ----------------------------
  // Seat state & click handling
  // ----------------------------
  function seatState(unit, seatNumber) {
    if (!unit?.seats) return "available";

    const taken = (unit.seats.taken || []).map(Number);
    const reserved = unit.seats.reserved || {};

    const mySeat = Number(reserved[USER_ID]);

    if (mySeat === Number(seatNumber)) return "reservedByMe";

    const reservedByOthers = Object.entries(reserved).some(
      ([uid, num]) => uid !== USER_ID && Number(num) === Number(seatNumber)
    );

    if (taken.includes(Number(seatNumber)) || reservedByOthers) {
      return "taken";
    }

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
          updates.push(
            updateDoc(doc(db, "units", d.id), {
              [`seats.reserved.${USER_ID}`]: deleteField(),
              "seats.taken": Array.isArray(seats.taken) ? seats.taken.filter((s) => s !== prevSeat) : [],
            }).catch(() => {})
          );
        }
      });
      await Promise.all(updates);

      // 2) transaction to reserve
      await runTransaction(db, async (t) => {
        const uRef = doc(db, "units", targetUnitId);
        const uSnap = await t.get(uRef);
        if (!uSnap.exists()) throw new Error("Unit disappeared");

        const data = uSnap.data();
        const seats = data?.seats || {};
        const taken = Array.isArray(seats.taken) ? [...seats.taken] : [];
        const reserved = seats.reserved ? { ...seats.reserved } : {};

        if (taken.includes(seatNumber) && reserved[USER_ID] !== seatNumber) {
          throw new Error("Seat already taken");
        }

        const prevSeatThisUnit = reserved?.[USER_ID];
        if (prevSeatThisUnit && prevSeatThisUnit !== seatNumber) {
          const newTaken = taken.filter((s) => s !== prevSeatThisUnit);
          t.update(uRef, { "seats.taken": newTaken, [`seats.reserved.${USER_ID}`]: seatNumber });
        } else {
          const newTaken = taken.includes(seatNumber) ? taken : [...taken, seatNumber];
          t.update(uRef, { "seats.taken": newTaken, [`seats.reserved.${USER_ID}`]: seatNumber });
        }
      });

      // 3) cleanup other units
      const all = await getDocs(collection(db, "units"));
      for (const docSnap of all.docs) {
        const d = docSnap.data();
        const seats = d?.seats || {};
        const reserved = seats.reserved || {};
        const prev = reserved?.[USER_ID];
        if (prev != null && docSnap.id !== targetUnitId) {
          try {
            await updateDoc(doc(db, "units", docSnap.id), {
              [`seats.reserved.${USER_ID}`]: deleteField(),
              "seats.taken": (Array.isArray(seats.taken) ? seats.taken.filter((s) => s !== prev) : []),
            });
          } catch (e) {
            // ignore
          }
        }
      }
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
        if (!mySeat) return;
        const newTaken = Array.isArray(seats.taken) ? seats.taken.filter((s) => s !== mySeat) : [];
        t.update(uRef, { [`seats.reserved.${USER_ID}`]: deleteField(), "seats.taken": newTaken });
      });
    } catch (err) {
      console.error("cancelReservation error:", err);
      alert("Cancel failed");
    }
  }

  function onSeatClick(unit, seatNum) {
    const state = seatState(unit, seatNum);

    if (state === "available") {
      reserveSeat(unit.id, seatNum);
      setConfirmUnitId(unit.id);
      setConfirmSeat(seatNum);
    } else if (state === "reservedByMe") {
      cancelReservation(unit.id);
    } else {
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

        if (reserved[USER_ID] !== seatNumber) return;

        const taken = Array.isArray(seats.taken) ? seats.taken : [];
        const newTaken = taken.includes(seatNumber) ? taken : [...taken, seatNumber];

        t.update(ref, {
          [`seats.reserved.${USER_ID}`]: deleteField(),
          "seats.taken": newTaken,
        });
      });
    } catch (err) {
      console.error("Confirm reservation failed:", err);
      alert("Could not confirm reservation.");
    }
  }

  // ----------------------------
  // UI LAYOUT (left panel + map + bottom floating)
  // ----------------------------
  return (
    <div className="min-h-screen h-screen bg-[#eef2ff] flex">
      {/* TOP-RIGHT MENU */}
      <div className="fixed top-4 right-6 z-[999999] pointer-events-auto">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-full border shadow bg-white flex items-center justify-center hover:scale-105 transition"
          >
            <img src="https://i.pravatar.cc/100?u=userMenu" className="w-full h-full rounded-full" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white shadow-xl border rounded-lg py-1 z-[999999]">
              <button onClick={() => { setMenuOpen(false); navigate("/account"); }} className="w-full text-left px-4 py-2 hover:bg-gray-100">Account</button>
              <button onClick={() => { setMenuOpen(false); navigate("/settings"); }} className="w-full text-left px-4 py-2 hover:bg-gray-100">Settings</button>
              <button onClick={() => { setMenuOpen(false); signOut(auth).then(() => navigate("/login")); }} className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-50">Logout</button>
            </div>
          )}
        </div>
      </div>

      

      {/* RIGHT MAIN CONTENT */}
      <div className="flex-1 relative flex flex-col">
        <div className="flex justify-center items-center p-4 h-full">
          <div className="w-full max-w-5xl h-full bg-white shadow-xl rounded-xl overflow-hidden">
            <div id="map-container-map" className="w-full h-full" />
          </div>
        </div>

        {/* FLOATING NAV */}
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

        {/* BOTTOM CARD */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[420px] z-[9998]">
          <div className="bg-white/90 backdrop-blur-xl shadow-xl rounded-2xl p-4 border border-white/40">
            {screen === 1 && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Bayambang → Malasiqui</span><b>₱20</b></div>
                <div className="flex justify-between"><span>Malasiqui → Calasiao</span><b>₱25</b></div>
                <div className="flex justify-between"><span>Calasiao → Dagupan</span><b>₱30</b></div>
              </div>
            )}
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
                <p className="mt-2 text-gray-600">Confirm reservation for seat <b>{confirmSeat}</b>?</p>

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
