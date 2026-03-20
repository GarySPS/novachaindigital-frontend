// src/components/TimerBar.jsx
import React, { useEffect, useRef, useState } from "react";

export default function TimerBar({ endAt, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const secs = Math.ceil((endAt - Date.now()) / 1000);
    return secs > 0 ? secs : 0;
  });

  const intervalRef = useRef(null);
  const initialDuration = useRef(timeLeft);
  const onCompleteRef = useRef(onComplete);

  // Keep the callback fresh without forcing the timer to restart
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Clear any old interval
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const remaining = Math.ceil((endAt - Date.now()) / 1000);
      setTimeLeft(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        onCompleteRef.current?.();
      }
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [endAt]); // Removed onComplete from here so the chart updates don't break the loop

  const percent =
    initialDuration.current > 0
      ? ((initialDuration.current - timeLeft) / initialDuration.current) * 100
      : 100;

  return (
    <div className="w-full max-w-[290px]">
      <div className="mb-2 text-4xl font-extrabold text-yellow-300 text-center">
        {timeLeft}s
      </div>
      <div className="relative w-full h-6 bg-theme-n-5 rounded-full overflow-hidden shadow-inner border border-theme-stroke">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#FFD700] via-[#00ffcc] to-[#2474ff] rounded-full shadow-lg transition-all duration-300"
          style={{
            width: `${percent}%`,
            filter: "blur(0.5px)",
          }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center font-semibold text-theme-primary text-lg"
          style={{ letterSpacing: "1px" }}
        >
          Trading...
        </div>
      </div>
    </div>
  );
}