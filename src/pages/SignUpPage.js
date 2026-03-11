//src>pages>SignUpPage.js

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MAIN_API_BASE } from "../config";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      const res = await fetch(`${MAIN_API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email }),
      });
      const data = await res.json();

      if (res.status === 409 && data.unverified) {
        setSuccess("You have already registered but not verified. Please check your email for the OTP code.");
        setTimeout(() => navigate("/verify-otp", { state: { email } }), 1200);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }
      setSuccess("OTP code sent to your email. Please verify to complete sign up.");
      setTimeout(() => navigate("/verify-otp", { state: { email } }), 1200);
    } catch {
      setError("Signup failed. Please try again.");
    }
  };

return (
    <div
      className="min-h-screen w-full relative flex items-center justify-center px-4 py-10 md:py-14"
      style={{
        backgroundImage: 'url("/login.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay has been removed */}

      <div className="relative z-10 w-full">
        {/* UPDATED: Card styling to match login page */}
        <div className="mx-auto w-full max-w-[480px] rounded-3xl bg-[#10162F]/80 backdrop-blur-xl shadow-2xl border border-sky-500/30 px-6 py-8 md:px-10 md:py-10">
          
          {/* Logo has been removed */}

          {/* ADDED: Inner video to match login page */}
          <div className="w-full h-36 md:h-40 rounded-2xl overflow-hidden shadow-inner border border-sky-400/20">
              <video
                  src="/login.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
              />
          </div>

          {/* UPDATED: Title styling for dark theme */}
          <h2 className="mt-8 text-center text-2xl md:text-3xl font-extrabold tracking-tight text-slate-100">
            Create Account
          </h2>

          {/* UPDATED: Form styling for dark theme */}
          <form onSubmit={handleSignUp} className="mt-6 space-y-4 md:space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm md:text-base font-semibold text-slate-300">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Create your username"
                className="w-full h-12 rounded-xl px-4 bg-slate-800/60 text-slate-100 placeholder-slate-500 border border-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 transition"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm md:text-base font-semibold text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="Enter your email"
                className="w-full h-12 rounded-xl px-4 bg-slate-800/60 text-slate-100 placeholder-slate-500 border border-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 transition"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm md:text-base font-semibold text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Create a password"
                className="w-full h-12 rounded-xl px-4 bg-slate-800/60 text-slate-100 placeholder-slate-500 border border-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 transition"
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm md:text-base font-semibold text-slate-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Re-enter your password"
                className="w-full h-12 rounded-xl px-4 bg-slate-800/60 text-slate-100 placeholder-slate-500 border border-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 transition"
              />
            </div>

            {/* Alerts */}
            {error && (
              <div className="w-full rounded-lg border border-red-400/50 bg-red-500/20 px-3 py-2 text-sm md:text-base text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="w-full rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-sm md:text-base text-emerald-200">
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="mt-1 w-full h-12 md:h-12 rounded-xl font-extrabold text-base md:text-lg tracking-wide shadow-lg border-0 outline-none transition active:scale-[.99]"
              style={{
                background:
                  "linear-gradient(90deg,#00eaff 0%,#1f2fff 55%,#ffd700 100%)",
                color: "white",
                letterSpacing: "0.02em",
                boxShadow: "0 10px 24px rgba(0, 234, 255, 0.15)",
              }}
            >
              Register
            </button>
          </form>

          {/* Terms */}
          <p className="mt-7 text-center text-[11px] md:text-xs text-slate-400 font-medium leading-relaxed">
            By signing up, you agree to the{" "}
            <a className="text-sky-400 hover:underline" href="/" target="_blank" rel="noreferrer">
              Terms of Use
            </a>
            ,{" "}
            <a className="text-sky-400 hover:underline" href="/" target="_blank" rel="noreferrer">
              Privacy Notice
            </a>{" "}
            and{" "}
            <a className="text-sky-400 hover:underline" href="/" target="_blank" rel="noreferrer">
              Cookie Notice
            </a>
            .
          </p>

          {/* Login Link */}
          <div className="mt-4 flex justify-center">
            <Link
              to="/login"
              className="text-sm md:text-base font-bold text-sky-400 hover:text-sky-300 hover:underline"
            >
              Already have an account? Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
