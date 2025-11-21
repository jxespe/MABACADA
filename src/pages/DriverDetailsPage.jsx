import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function DriverDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [unit, setUnit] = useState(null);

  useEffect(() => {
    return onSnapshot(doc(db, "units", id), (snap) => {
      if (snap.exists()) setUnit({ id: snap.id, ...snap.data() });
    });
  }, [id]);

  if (!unit)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );

  return (
    <div className="min-h-screen bg-[#e8ffe8] p-6">
      {/* BACK BUTTON */}
      <button
        onClick={() => navigate(-1)}
        className="mb-5 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Back
      </button>

      {/* HEADER PROFILE */}
      <div className="flex gap-3 mb-6">
        <img
          src={unit.photo ?? `https://i.pravatar.cc/150?u=${unit.id}`}
          className="w-16 h-16 rounded-full border"
        />
        <div>
          <div className="font-bold text-lg">{unit.driver}</div>
          <div className="text-sm">{unit.plate ?? unit.id}</div>
          <div className="text-xs text-gray-500">{unit.route}</div>
        </div>
      </div>

      {/* PASSENGER COUNT + ETA */}
      <div className="flex gap-4 mb-6">
        <div className="w-24 h-24 rounded-full bg-green-600 text-white flex items-center justify-center text-3xl font-bold">
          {unit.seats && Array.isArray(unit.seats.taken)
            ? unit.seats.taken.length
            : unit.seats?.occupied ?? 0}
        </div>

        <div>
          <div className="text-xs">Passengers</div>
          <div className="text-sm mt-2 font-bold">ETA</div>
          <div className="text-2xl font-bold">{unit.eta ?? "—"}</div>
        </div>
      </div>

      {/* SEAT MAP */}
      <div>
        <div className="font-semibold text-sm">Seat Map</div>

        <div className="grid grid-cols-5 gap-2 mt-3">
          {(() => {
            let seatNumber = 1;
            const totalSeats = unit.seats?.total ?? 25;

            return Array.from({ length: totalSeats + 5 }).map((_, i) => {
              const col = (i % 5) + 1;

              // Aisle in column 3
              if (col === 3) {
                return <div key={`aisle-${i}`} className="w-10 h-10"></div>;
              }

              // Do not render beyond seat count
              if (seatNumber > totalSeats) {
                return <div key={`extra-${i}`} className="w-10 h-10"></div>;
              }

              const num = seatNumber++;
              const isTaken = unit.seats?.taken?.includes(num);

              return (
                <div
                  key={num}
                  className={`w-10 h-10 flex items-center justify-center text-xs rounded select-none border ${
                    isTaken
                      ? "bg-blue-600 text-white"
                      : "bg-white text-black"
                  }`}
                >
                  {num}
                </div>
              );
            });
          })()}
        </div>

        {/* LEGEND */}
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center gap-1">
            <div
              className="rounded border bg-white"
              style={{ width: "43px", height: "18px" }}
            ></div>
            <span>Available</span>
          </div>

          <div className="flex items-center gap-1">
            <div
              className="rounded border bg-blue-600"
              style={{ width: "43px", height: "18px" }}
            ></div>
            <span>Taken</span>
          </div>
        </div>
      </div>

      {/* CALL BUTTON */}
      <div className="mt-6">
        <button
          onClick={() =>
            unit.phone ? window.open(`tel:${unit.phone}`) : null
          }
          className="py-2 bg-blue-600 text-white w-full rounded"
        >
          Driver Info
        </button>
      </div>
    </div>
  );
}
