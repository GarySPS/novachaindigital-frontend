//src/pages/VerifyOTPPage.js

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { MAIN_API_BASE } from "../config";
// REMOVED react-codes-input completely

/* ---------- Inline Terms modal ---------- */
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
            <li><b>Terms &amp; Conditions</b> — New user startup requires <b>100 USDT</b>.</li>
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
              background: "linear-gradient(90deg,#00eaff 0%,#1f2fff 53%,#ffd700 100%)",
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
  
  // Use an array to store references to the 6 inputs natively
  const inputRefs = useRef([]);

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
        if(inputRefs.current[0]) inputRefs.current[0].focus();
        return;
      }
      setSuccess(data.message || "Email verified!");
      setShowTerms(true);
    } catch (err) {
      setError("Verification failed. Try again.");
      setOtp("");
      if(inputRefs.current[0]) inputRefs.current[0].focus();
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
    navigate("/login", { replace: true }); 
  };

  // Native OTP Handlers
  const handleOtpChange = (e, index) => {
    const val = e.target.value;
    if (val && !/^[0-9]*$/.test(val)) return;

    let newOtp = otp.split('');
    while(newOtp.length < 6) newOtp.push(""); 
    newOtp[index] = val.substring(val.length - 1); 
    
    const finalOtp = newOtp.join('').substring(0, 6);
    setOtp(finalOtp);

    // Auto-advance focus
    if (val && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
    if (pastedData) {
      setOtp(pastedData);
      const focusIndex = Math.min(pastedData.length, 5);
      if(inputRefs.current[focusIndex]) inputRefs.current[focusIndex].focus();
    }
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
      <div className="relative z-10 w-full">
        <div className="mx-auto w-full max-w-[480px] rounded-3xl bg-[#10162F]/80 backdrop-blur-xl shadow-2xl border border-sky-500/30 px-6 py-8 md:px-10 md:py-10">

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

          <h2 className="mt-8 text-center text-2xl md:text-3xl font-extrabold tracking-tight text-slate-100">
            Check your email to verify
          </h2>
          <p className="text-sm md:text-base text-slate-300 text-center mb-8 mt-2 font-medium">
            Enter the 6-digit code sent to your email below.
          </p>

          <form onSubmit={handleVerify}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled
              className="hidden"
            />

            {/* PREMIUM NATIVE OTP INPUTS (Matches SignUp Page styles) */}
            <div className="flex justify-center gap-2 md:gap-3 mb-8">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const char = otp.length > index ? otp[index] : "";
                return (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={char}
                    autoFocus={index === 0}
                    onChange={(e) => handleOtpChange(e, index)}
                    onKeyDown={(e) => handleOtpKeyDown(e, index)}
                    onPaste={handleOtpPaste}
                    className="w-12 h-14 md:w-14 md:h-16 rounded-xl text-center text-2xl md:text-3xl font-bold bg-slate-800/60 text-slate-100 placeholder-slate-500 border border-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 transition shadow-inner"
                  />
                );
              })}
            </div>

            {error && (
              <div className="w-full rounded-lg border border-red-400/50 bg-red-500/20 px-3 py-2 text-sm md:text-base text-center text-red-200 mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="w-full rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-sm md:text-base text-center text-emerald-200 mb-4">
                {success}
              </div>
            )}
            {resendSuccess && (
              <div className="w-full rounded-lg border border-sky-400/50 bg-sky-500/20 px-3 py-2 text-sm md:text-base text-center text-sky-200 mb-4">
                {resendSuccess}
              </div>
            )}

            <button
              className="mt-1 w-full h-12 md:h-12 rounded-xl font-extrabold text-base md:text-lg tracking-wide shadow-lg border-0 outline-none transition active:scale-[.99] disabled:opacity-70 disabled:cursor-not-allowed"
              type="submit"
              style={{
                background: "linear-gradient(90deg,#00eaff 0%,#1f2fff 55%,#ffd700 100%)",
                color: "white",
                letterSpacing: "0.02em",
                boxShadow: "0 10px 24px rgba(0, 234, 255, 0.15)",
              }}
              disabled={otp.length < 6 || !email}
            >
              Verify
            </button>
          </form>

          <div className="text-center mt-6 space-y-4">
            <button
              type="button"
              onClick={handleResend}
              className="text-sm md:text-base font-bold text-sky-400 hover:text-sky-300 hover:underline disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
              disabled={resendLoading || resendTimer > 0}
            >
              {resendTimer > 0
                ? `Resend OTP in ${resendTimer}s`
                : resendLoading
                ? "Sending..."
                : "Resend OTP"}
            </button>
            <div className="text-sm md:text-base">
              <Link to="/login" className="font-bold text-slate-400 hover:text-slate-300 hover:underline transition">
                Back to login
              </Link>
            </div>
          </div>

        </div>
      </div>

      <TermsModal open={showTerms} onAgree={onAgree} />
    </div>
  );
}