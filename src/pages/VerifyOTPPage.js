//src>pages>VerifyOTPPage.js

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { MAIN_API_BASE } from "../config";
import ReactCodesInput from "react-codes-input";

/* ---------- Inline Terms modal (updated) ---------- */
function TermsModal({ open, onAgree }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="relative z-10 w-[92%] max-w-2xl bg-[#0f1422] text-gray-200 border border-[#24314a] rounded-2xl shadow-2xl">
        <div className="px-6 py-5 border-b border-[#24314a]">
          <h2 className="text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-blue-500 to-teal-400">
            Terms &amp; Conditions
          </h2>
          <p className="text-xs text-gray-400 mt-1">Last updated: 18 Aug 2025</p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-4 text-sm leading-6">
          <p>
            By tapping <b>Agree</b>, you confirm that you have read and accept NovaChain’s
            Terms &amp; Conditions. Key points:
          </p>

          <ol className="list-decimal pl-5 space-y-3">
            <li>
              <b>Terms &amp; Conditions</b> — New user startup requires <b>100 USDT</b>.
            </li>

            <li>
              <b>Account Security</b>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Do not disclose your password; platform is not responsible for losses caused by disclosure.</li>
                <li>Avoid using birthday, ID number, or phone number as withdrawal/login passwords.</li>
                <li>If you forget your password(s), contact online support to reset.</li>
                <li>Confidentiality agreement applies between user and company.</li>
              </ul>
            </li>

            <li>
              <b>Funds</b>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>All funds are processed by the system (no manual operations) to avoid losses.</li>
                <li>Accidental loss due to <b>NovaChain’s own mistake</b>: the platform takes full responsibility.</li>
              </ul>
            </li>

            <li>
              <b>Deposit</b>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Top-up amount is chosen by the user.</li>
                <li>Get and confirm the deposit address from your own trading account before depositing.</li>
                <li>Platform is not responsible for losses caused by an incorrect wallet address entered by the user.</li>
              </ul>
            </li>

            <li>
              <b>Withdrawal</b>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>First withdrawal for new users: <b>$100</b>.</li>
                <li>As you trade more and become an old user: daily limit <b>$2,000</b>.</li>
                <li>Withdrawals &gt; <b>$10,000</b> require opening a large-channel account for fund safety.</li>
              </ul>
            </li>

            <li>
              <b>Hours of Operation</b>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Platform opening hours: <b>27/4</b>.</li>
                <li>Online customer service: <b>10:00–22:00</b>.</li>
                <li>Withdrawal time: <b>09:00–22:00</b> (UTC-4).</li>
                <li>Final interpretation right belongs to <b>Novachain LTD</b>.</li>
              </ul>
            </li>
          </ol>

          <p className="text-xs text-gray-400">
            Read the full version any time at{" "}
            <a href="/terms" className="underline text-blue-300">
              Terms &amp; Conditions
            </a>
            .
          </p>
        </div>

        <div className="px-6 py-5 border-t border-[#24314a] flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onAgree}
            className="h-11 px-6 rounded-xl font-extrabold tracking-wide shadow-md transition-all"
            style={{
              background:
                "linear-gradient(90deg,#00eaff 0%,#1f2fff 53%,#ffd700 100%)",
              color: "#232836",
              letterSpacing: 1.2,
              boxShadow: "0 2px 16px #1f2fff14, 0 1.5px 0 #ffd70044",
              border: "none",
              outline: "none",
              fontSize: "1.05rem",
            }}
          >
            Agree &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [showTerms, setShowTerms] = useState(false);
  const pinWrapperRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.email) setEmail(location.state.email);
  }, [location]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");
    setResendSuccess("");
    if (!email || otp.length < 6) {
      setError("Enter your email and the 6-digit code.");
      return;
    }
    try {
      const res = await fetch(`${MAIN_API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect OTP. Please try again.");
        setOtp("");
        return;
      }
      setSuccess(data.message || "Email verified!");
      // Instead of navigating to login, open Terms modal immediately
      setShowTerms(true);
    } catch (err) {
      setError("Verification failed. Try again.");
      setOtp("");
    }
  };

  const handleResend = async () => {
    setError("");
    setResendSuccess("");
    setResendLoading(true);
    try {
      const res = await fetch(`${MAIN_API_BASE}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to resend code.");
      } else {
        setResendSuccess("OTP code resent! Check your email.");
        setResendTimer(60);
      }
    } catch (err) {
      setError("Failed to resend code. Try again.");
    }
    setResendLoading(false);
  };

 const onAgree = () => {
   navigate("/", { replace: true }); // go home; nothing stored
 };

return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative px-4 py-10"
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

          {/* UPDATED: Text styling for dark theme */}
          <h2 className="mt-8 text-center text-2xl font-extrabold text-slate-100">
            Check your email to verify
          </h2>
          <p className="text-base text-slate-300 text-center mb-6 font-medium">
            Enter the 6-digit code sent to your email below.
          </p>

          <form onSubmit={handleVerify}>
            {/* Email input is hidden as it's not editable, but kept for logic */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled
              className="hidden"
            />

            {/* UPDATED: OTP input styling for dark theme */}
            <div className="flex justify-center mb-4">
              <ReactCodesInput
                classNameWrapper="flex justify-center gap-2"
                classNameCodeWrapper="w-11 h-12 md:w-12 md:h-14 flex-none"
                classNameCode="border-2 border-slate-700 bg-slate-800/60 rounded-xl text-center text-2xl font-bold text-white focus:border-sky-400 transition"
                classNameCodeWrapperFocus="shadow-[0_0_0_3px_rgba(56,189,248,0.3)]"
                initialFocus={true}
                wrapperRef={pinWrapperRef}
                id="pin"
                codeLength={6}
                type="text"
                value={otp}
                onChange={setOtp}
                inputMode="numeric"
                autoFocus
              />
            </div>

            {/* UPDATED: Alert styling for dark theme */}
            {error && (
              <div className="w-full max-w-sm mx-auto mb-3 rounded-lg border border-red-400/50 bg-red-500/20 px-3 py-2 text-sm text-center text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="w-full max-w-sm mx-auto mb-3 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-sm text-center text-emerald-200">
                {success}
              </div>
            )}
            {resendSuccess && (
              <div className="w-full max-w-sm mx-auto mb-3 rounded-lg border border-sky-400/50 bg-sky-500/20 px-3 py-2 text-sm text-center text-sky-200">
                {resendSuccess}
              </div>
            )}

            {/* Submit button (styling is consistent) */}
            <button
              className="w-full h-12 rounded-xl font-extrabold text-base md:text-lg tracking-wide shadow-lg border-0 outline-none transition active:scale-[.99] disabled:opacity-70 disabled:cursor-not-allowed"
              type="submit"
              style={{
                background:
                  "linear-gradient(90deg,#00eaff 0%,#1f2fff 55%,#ffd700 100%)",
                color: "white",
                boxShadow: "0 10px 24px rgba(0, 234, 255, 0.15)",
              }}
              disabled={otp.length < 6 || !email}
            >
              Verify
            </button>
          </form>

          {/* UPDATED: Link styling for dark theme */}
          <div className="text-center mt-5 space-y-3">
            <button
              type="button"
              onClick={handleResend}
              className="font-bold text-sky-400 hover:text-sky-300 hover:underline disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
              disabled={resendLoading || resendTimer > 0}
            >
              {resendTimer > 0
                ? `Resend OTP in ${resendTimer}s`
                : resendLoading
                ? "Sending..."
                : "Resend OTP"}
            </button>
            <div className="text-sm">
              <Link to="/login" className="font-bold text-slate-400 hover:text-slate-300 hover:underline transition">
                Back to login
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Terms modal (no changes needed, it's already dark) */}
      <TermsModal open={showTerms} onAgree={onAgree} />
    </div>
  );
}
