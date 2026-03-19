//src>pages>ProfilePage.js

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { MAIN_API_BASE } from '../config';
import Card from "../components/card";
import Field from "../components/field";
import Modal from "../components/modal";
import Tooltip from "../components/tooltip";
import Icon from "../components/icon";
import Chart from "../components/chart";
import AssetsDonut from "../components/assetsdonut";
import { useTranslation } from "react-i18next";
import i18n from "i18next";

/* -------- Small helpers (unchanged logic) -------- */
function isIOSSafari() {
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isNotChrome = !/CriOS/.test(ua);
  return isIOS && isWebkit && isNotChrome;
}
function bustCache(url) {
  if (!url) return url;
  return url + (url.includes('?') ? '&bust=' : '?bust=') + Date.now();
}

/* ================================================== */

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [user, setUser] = useState(null);
  const [assets, setAssets] = useState([]);
  const [prices, setPrices] = useState({});
  const [totalUsd, setTotalUsd] = useState(0);
  const [loading, setLoading] = useState(true);

  const [kycStatus, setKycStatus] = useState("unverified");
  const [kycSelfie, setKycSelfie] = useState(null);
  const [kycId, setKycId] = useState(null);
  const [kycSubmitted, setKycSubmitted] = useState(false);
  const [kycSelfiePreview, setKycSelfiePreview] = useState(null);
  const [kycIdPreview, setKycIdPreview] = useState(null);
  const [kycError, setKycError] = useState("");

  const [showEditPic, setShowEditPic] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("/logo192_new.png");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [avatarError, setAvatarError] = useState("");

  const pw1 = useRef("");
  const pw2 = useRef("");
  const pwCurrent = useRef("");

  const [pwErr, setPwErr] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [authChecked, setAuthChecked] = useState(false);

const [deferredPrompt, setDeferredPrompt] = useState(null);
const [isInstalled, setIsInstalled] = useState(false);


  /* -------- preload prices from localStorage (unchanged) -------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nc_prices");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") setPrices(parsed);
      }
    } catch {}
  }, []);

/* -------- PWA prompt -------- */
useEffect(() => {
  // detect already-installed (standalone) modes
  const checkInstalled = () => {
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
      || window.navigator.standalone === true; // iOS Safari
    setIsInstalled(Boolean(standalone));
  };
  checkInstalled();

  const onBIP = (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
  };
  const onInstalled = () => {
    setIsInstalled(true);
    setDeferredPrompt(null);
  };

  window.addEventListener('beforeinstallprompt', onBIP);
  window.addEventListener('appinstalled', onInstalled);
  window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', checkInstalled);

  return () => {
    window.removeEventListener('beforeinstallprompt', onBIP);
    window.removeEventListener('appinstalled', onInstalled);
    window.matchMedia?.('(display-mode: standalone)')?.removeEventListener?.('change', checkInstalled);
  };
}, []);


  /* -------- reset submit banner when not pending -------- */
  useEffect(() => {
    if (kycStatus !== "pending") setKycSubmitted(false);
  }, [kycStatus]);

  /* -------- live prices (unchanged logic) -------- */
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await axios.get(`${MAIN_API_BASE}/prices`);
        if (stopped) return;
        let map = res.data?.prices;
        if (!map || !Object.keys(map).length) {
          map = {};
          (res.data?.data || []).forEach(c => {
            if (c?.symbol) map[c.symbol] = c?.quote?.USD?.price;
          });
        }
        if (map && Object.keys(map).length) {
          setPrices(prev => {
            const next = { ...prev, ...map };
            try { localStorage.setItem("nc_prices", JSON.stringify(next)); } catch {}
            return next;
          });
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 10_000);
    return () => { stopped = true; clearInterval(id); };
  }, [MAIN_API_BASE]);

  /* -------- balance history (unchanged logic) -------- */
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${MAIN_API_BASE}/balance/history`, { headers });
        const history = (res.data.history || []).map(row => ({
          time: row.date,
          value: Number(row.total_usd)
        }));
        setBalanceHistory(history);
      } catch {}
    })();
  }, []);

  /* -------- profile, balances, kyc (unchanged logic) -------- */
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${MAIN_API_BASE}/profile`, { headers });
        setUser(res.data.user);

        const balRes = await axios.get(`${MAIN_API_BASE}/balance`, { headers });
        setAssets(balRes.data.assets || []);

        const kycRes = await axios.get(`${MAIN_API_BASE}/kyc/status`, { headers });
        setKycStatus((kycRes.data.status || "unverified").toLowerCase());

        setLoading(false);
      } catch {
        navigate("/login", { replace: true });
      }
    })();
    setAuthChecked(true);
  }, [navigate]);

  /* -------- compute total USD (unchanged logic) -------- */
  useEffect(() => {
    if (!assets.length) { setTotalUsd(0); return; }
    if (!Object.keys(prices).length) return;
    let sum = 0;
    assets.forEach(({ symbol, balance }) => {
      const coinPrice = prices[symbol] || (symbol === "USDT" ? 1 : 0);
      sum += Number(balance) * coinPrice;
    });
    setTotalUsd(sum);
  }, [assets, prices]);

  /* -------- avatar bind (unchanged logic) -------- */
  useEffect(() => {
    if (!user || !user.avatar) { setAvatarUrl("/logo192_new.png"); return; }
    setAvatarUrl(user.avatar);
  }, [user]);

  /* -------- auth guard (unchanged logic) -------- */
  useEffect(() => {
    if (!authChecked) return;
    const token = localStorage.getItem("token");
    if (!token) navigate("/login", { replace: true });
  }, [authChecked, navigate]);

  /* -------- poll kyc while pending (unchanged logic) -------- */
  useEffect(() => {
    if (kycStatus !== "pending") return;
    const id = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${MAIN_API_BASE}/kyc/status`, { headers });
        setKycStatus((res.data.status || "unverified").toLowerCase());
      } catch {}
    }, 10_000);
    return () => clearInterval(id);
  }, [kycStatus]);

  /* -------- actions (unchanged logic) -------- */
  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  async function handleKycSubmit(e) {
    e.preventDefault();
    if (!kycSelfie || !kycId || kycStatus === "pending" || kycStatus === "approved") return;

    setKycError("");
    setKycSubmitted(true);
    try {
      setKycStatus("pending");
      const formData = new FormData();
      formData.append("selfie", kycSelfie);
      formData.append("id_card", kycId);
      const token = localStorage.getItem("token");
      await axios.post(`${MAIN_API_BASE}/kyc`, formData, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: false,
      });
      setKycSelfie(null); setKycId(null);
      setKycSelfiePreview(null); setKycIdPreview(null);
    } catch (err) {
      console.error("KYC submit error:", err?.response?.status, err?.message);
      if (kycStatus !== "pending") {
        setKycError(t("Upload failed. Please try again."));
        setKycSubmitted(false);
      }
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  }
  async function saveAvatar() {
    if (!avatarFile || !user?.id) return;
    setAvatarSuccess(""); setAvatarError("");
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      await axios.post(`${MAIN_API_BASE}/profile/avatar`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      const updated = await axios.get(`${MAIN_API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      setUser(updated.data.user);
      setAvatarFile(null);
      setAvatarSuccess(t('profile_avatar_updated'));
      setTimeout(() => { setAvatarSuccess(""); setShowEditPic(false); }, 1700);
    } catch {
      setAvatarError(t('profile_avatar_failed'));
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwErr(""); setPwSuccess("");
    if (pw1.current.value !== pw2.current.value) {
      setPwErr(t('Password Unmatch')); return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${MAIN_API_BASE}/profile/change-password`, {
        old_password: pwCurrent.current.value, new_password: pw1.current.value
      }, { headers: { Authorization: `Bearer ${token}` } });
      pwCurrent.current.value = ""; pw1.current.value = ""; pw2.current.value = "";
      setPwSuccess(t('Successful'));
      setTimeout(() => { setPwSuccess(""); setShowChangePw(false); }, 1800);
    } catch { setPwErr(t('Failed')); }
  }

/* -------- skeleton -------- */
  if (!authChecked || loading || !user) {
    // This is the updated loading screen using your video.
    return (
      <div className="fixed inset-0 w-full h-full bg-black">
        <video
          src="/loading.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  /* ======================= UI ======================= */
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center px-3 pt-8 pb-14"
      style={{
        background: 'url("/novachain.jpg") no-repeat center/cover fixed',
      }}
    >
      <div className="fixed inset-0 bg-[linear-gradient(120deg,#0b1020f0_0%,#0d1220d8_60%,#0a101dd1_100%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl space-y-10">

        {/* ========= 1) Profile + Total Assets ========= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Profile */}
          <Card className="md:col-span-2 p-8 md:p-10 rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <div className="flex flex-col items-center text-center">
              <img
                src={avatarFile ? URL.createObjectURL(avatarFile) : bustCache(avatarUrl) || "/logo192_new.png"}
                alt="Profile"
                className="w-28 h-28 rounded-full border-4 border-[#ffd700] shadow-xl bg-white object-cover"
                onError={(e) => { e.currentTarget.src = "/logo192_new.png"; }}
              />

              <div className="mt-1 flex items-center gap-2">
                <div className="text-2xl md:text-3xl font-black text-white drop-shadow">
                  {user.username}
                </div>
                {kycStatus === "approved" && (
                  <span className="inline-flex items-center" aria-label="Verified">
                    <svg width="26" height="26" viewBox="0 0 26 26">
                      <circle cx="13" cy="13" r="13" fill="#26c281" />
                      <path d="M19.25 9.25L11.75 16.75L7.75 12.75" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>

              <div
                className={`mt-2 inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold
                ${kycStatus === "approved" ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" :
                  kycStatus === "pending" ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30" :
                  kycStatus === "rejected" ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30" :
                  "bg-white/10 text-white/80 ring-1 ring-white/20"}`}
              >
                {kycStatus === "approved" ? t("Verified")
                  : kycStatus === "pending" ? t("Automated review")
                  : kycStatus === "rejected" ? t("Needs new upload")
                  : t("Not verified")}
              </div>

              <button
                className="mt-8 h-11 px-6 rounded-2xl font-bold bg-white text-slate-900 hover:bg-slate-100 transition"
                onClick={handleLogout}
              >
                <Icon name="logout" className="mr-2" /> {t('profile_logout')}
              </button>
            </div>
          </Card>

          {/* Total Assets + Quick Actions */}
          <Card className="p-8 md:p-10 rounded-3xl border border-white/10 bg-gradient-to-br from-white/85 to-white/60 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.20)]">
            <div className="text-center">
              <div className="text-slate-600 font-bold">{t('profile_total_assets')}</div>
              <div className="mt-1 text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                {typeof totalUsd === "number"
                  ? `$${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : "--"}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3">
              <button 
                className="h-12 rounded-xl font-bold bg-slate-900 text-white hover:scale-[1.02] transition flex items-center justify-center"
                onClick={() => navigate(`/wallet?action=deposit&coin=USDT`)}
              >
                {t('profile_deposit')}
              </button>
              <button 
                className="h-12 rounded-xl font-bold bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 transition flex items-center justify-center"
                onClick={() => navigate(`/wallet?action=withdraw&coin=BTC`)}
              >
                <Icon name="arrow-up-right" className="mr-2" /> {t('profile_withdraw')}
              </button>
              <button 
                className="h-12 rounded-xl font-bold bg-slate-900 text-white hover:scale-[1.02] transition flex items-center justify-center"
                onClick={() => navigate(`/wallet?action=convert`)}
              >
                <Icon name="swap" className="mr-2" /> {t('profile_convert')}
              </button>
            </div>
          </Card>
        </div>

        {/* ========= 2) Chart + Assets Donut ========= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <Card className="p-6 md:p-8 rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <div className="mb-3 text-white/80 font-bold">{t('Balance History')}</div>
            <Chart data={balanceHistory} />
          </Card>

          <Card className="p-6 md:p-8 rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <div className="mb-3 text-white/80 font-bold">{t('profile_assets')}</div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex-1 min-w-[220px]">
                <AssetsDonut assets={assets} prices={prices} plain />
              </div>
              <div className="flex-1 w-full max-w-sm">
                {assets.filter(a => a.balance > 0).map((a, i) => {
                  const price = prices[a.symbol] || (a.symbol === "USDT" ? 1 : 0);
                  const usd = Number(a.balance) * price;
                  const percent = totalUsd ? (usd / totalUsd * 100) : 0;
                  const palette = ["#ffd600", "#00e676", "#2979ff", "#ff6f00", "#e040fb", "#ff1744"];
                  return (
                    <div key={a.symbol} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/10 transition">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />
                        <span className="w-16 font-semibold text-white/90">{a.symbol}</span>
                      </div>
                      <span className="font-bold text-white/80">{percent.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* ========= 3) KYC + Settings ========= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* KYC */}
          <Card className="p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/85 to-white/65 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.20)]">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-slate-800 font-black text-2xl">
                <Icon name="shield-check" className="w-7 h-7 text-slate-700" />
                {t('Verification')}
              </div>

              <div className="mt-2 inline-flex items-center text-sm font-bold px-3 py-1.5 rounded-full
                bg-slate-900/5 ring-1 ring-slate-900/10 text-slate-700">
                <span className={`w-2 h-2 rounded-full mr-2
                  ${kycStatus === "approved" ? "bg-emerald-500" :
                    kycStatus === "pending" ? "bg-amber-400" :
                    kycStatus === "rejected" ? "bg-rose-400" : "bg-slate-400"}`} />
                {kycStatus === "approved" ? t("Verified") :
                 kycStatus === "pending" ? t("Automated review in progress") :
                 kycStatus === "rejected" ? t("Needs new upload") : t("Not verified")}
              </div>
            </div>

            {(kycStatus === "unverified" || kycStatus === "rejected") && (
              <form className="mt-6 space-y-6" onSubmit={handleKycSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Selfie */}
                  <div>
                    <label className="mb-2 block font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <Icon name="user" className="w-5 h-5 text-slate-700" /> {t('Upload Selfie')}
                        <Tooltip text={t('profile_tooltip_selfie')} />
                      </span>
                    </label>
                    <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl px-3 py-6 flex flex-col items-center justify-center hover:border-slate-400 transition">
                      <input
                        type="file"
                        accept="image/*"
                        id="selfie"
                        className="hidden"
                        disabled={kycStatus === "pending" || kycStatus === "approved"}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) { setKycSelfie(file); setKycSelfiePreview(URL.createObjectURL(file)); }
                        }}
                      />
                      <label htmlFor="selfie" className="cursor-pointer flex flex-col items-center text-slate-700">
                        <Icon name="upload-cloud" className="w-8 h-8 mb-1" />
                        <span className="text-sm font-semibold">{t('Selfie')}</span>
                      </label>
                      {kycSelfiePreview && (
                        <img src={kycSelfiePreview} alt="Selfie Preview" className="rounded-lg mt-3 border-2 border-emerald-300 shadow max-w-[110px]" />
                      )}
                    </div>
                  </div>
                  {/* ID */}
                  <div>
                    <label className="mb-2 block font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <Icon name="id-card" className="w-5 h-5 text-slate-700" /> {t('Upload ID')}
                        <Tooltip text={t('profile_tooltip_id')} />
                      </span>
                    </label>
                    <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl px-3 py-6 flex flex-col items-center justify-center hover:border-slate-400 transition">
                      <input
                        type="file"
                        accept="image/*"
                        id="id-card"
                        className="hidden"
                        disabled={kycStatus === "pending" || kycStatus === "approved"}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) { setKycId(file); setKycIdPreview(URL.createObjectURL(file)); }
                        }}
                      />
                      <label htmlFor="id-card" className="cursor-pointer flex flex-col items-center text-slate-700">
                        <Icon name="upload-cloud" className="w-8 h-8 mb-1" />
                        <span className="text-sm font-semibold">{t('ID')}</span>
                      </label>
                      {kycIdPreview && (
                        <img src={kycIdPreview} alt="ID Preview" className="rounded-lg mt-3 border-2 border-amber-300 shadow max-w-[110px]" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    type="submit"
                    className="h-12 px-8 rounded-xl font-bold bg-slate-900 text-white hover:scale-[1.02] transition w-full sm:w-72"
                    disabled={!kycSelfie || !kycId || kycStatus === "pending" || kycStatus === "approved"}
                  >
                    {kycStatus === "rejected" ? t("Re-upload for review") : t("Submit for automated review")}
                  </button>
                </div>

                {(kycStatus === "pending" && kycSubmitted) && (
                  <div className="text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-4 py-2 text-center">
                    {t("Submitted. Our automated system is analyzing your images.")}
                  </div>
                )}
                {kycError && (
                  <div className="text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-4 py-2 text-center">
                    {kycError}
                  </div>
                )}
            </form>
            )}

            <div className="mt-4 text-sm text-slate-600 text-center">
              {kycStatus === "approved" ? t("Your identity is verified.") :
               kycStatus === "pending" ? t("Typically completes shortly. You’ll be notified when done.") :
               kycStatus === "rejected" ? t("We couldn’t validate that attempt. Please re-upload clear photos.") :
               t("Upload a clear selfie and your ID to get verified.")}
            </div>
          </Card>

          {/* Settings */}
          <Card className="p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/85 to-white/65 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.20)]">
            <div className="text-center text-slate-800 font-black text-xl mb-4">{t('Settings')}</div>

            <div className="grid grid-cols-2 gap-4">
              <button
                className="h-16 px-4 rounded-xl font-bold bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 transition flex flex-col items-center justify-center"
                onClick={() => setShowChangePw(true)}
              >
                <Icon name="lock" className="mb-1 w-6 h-6" /> {t('profile_change_password')}
              </button>

              <button
                className="h-16 px-4 rounded-xl font-bold bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 transition flex flex-col items-center justify-center"
                onClick={() => setShowEditPic(true)}
              >
                <Icon name="edit" className="mb-1 w-6 h-6" /> {t('profile_change_profile')}
              </button>

              {/* New Buttons Added Below */}
              <button
                className="h-16 px-4 rounded-xl font-bold bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 transition flex flex-col items-center justify-center"
                onClick={() => navigate('/news')}
              >
                <Icon name="newspaper" className="mb-1 w-6 h-6" /> {t('news')}
              </button>
              
              <button
                className="h-16 px-4 rounded-xl font-bold bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 transition flex flex-col items-center justify-center"
                onClick={() => navigate('/about')}
              >
                <Icon name="info" className="mb-1 w-6 h-6" /> {t('about_us')}
              </button>
            </div>

            {/* Language */}
            <div className="mt-5">
              <select
                className="w-full h-12 pl-4 pr-6 rounded-xl bg-white ring-1 ring-slate-200 text-slate-800 font-bold focus:ring-2 focus:ring-sky-200 outline-none"
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="es">Español</option>
              </select>
            </div>

{/* Install Buttons */}
<div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
  {/* Android */}
  <button
    className="h-12 rounded-xl font-bold bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 transition"
    onClick={async () => {
      if (isInstalled) {
        alert('App is already installed.');
        return;
      }
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        // clear so Chrome can re-fire later if needed
        setDeferredPrompt(null);
        if (choice?.outcome !== 'accepted') {
          alert('Installation was dismissed. You can also use the browser menu → "Add to Home screen".');
        }
      } else {
        alert('To install: open this site in Chrome/Brave/Opera on Android, then use the menu → "Add to Home screen".');
      }
    }}
  >
    <Icon name="download" className="mr-2" /> Android Install
  </button>

  {/* iOS */}
  <button
    className="h-12 rounded-xl font-bold bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 transition disabled:opacity-50"
    onClick={() => navigate('/guide')}
    disabled={!isIOSSafari()}
  >
    <Icon name="download" className="mr-2" /> iOS Install
  </button>
</div>

          </Card>
        </div>

        {/* ========= 4) Referral + Support ========= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Referral */}
          <Card className="p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/85 to-white/65 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.20)]">
            <div className="text-center text-slate-800 font-black text-xl">{t('profile_referral_code')}</div>
            <div className="mt-2 flex items-center justify-center gap-3">
              <span className="text-2xl font-black text-slate-900">{user.referral || "NC-INVITE-8437"}</span>
              <button
                className="h-9 px-4 rounded-xl font-bold bg-slate-900 text-white hover:scale-[1.02] transition"
                onClick={() => { navigator.clipboard.writeText(user.referral || "NC-INVITE-8437"); alert(t('profile_copied_clipboard')); }}
              >
                <Icon name="copy" className="mr-1" /> {t('profile_copy')}
              </button>
            </div>
            <div className="mt-2 text-sm text-slate-600 text-center">{t('profile_referral_invite')}</div>
          </Card>

          {/* Support */}
          <Card className="p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/85 to-white/65 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.20)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                className="h-12 rounded-xl font-bold text-white bg-[#25D366] hover:opacity-95 transition"
                onClick={() => window.open('https://wa.me/16627053615', '_blank')}
              >
                WhatsApp
              </button>
              <button
                className="h-12 rounded-xl font-bold text-white bg-[#229ED9] hover:opacity-95 transition"
                onClick={() => window.open('https://t.me/novachainsingapore', '_blank')}
              >
                Telegram
              </button>
            </div>
            <div className="mt-3 text-sm text-slate-600 text-center">
              {t("You can contact support via WhatsApp or Telegram, 9-5 office hours.")}
            </div>
          </Card>
        </div>
      </div>

      {/* ========= Modals ========= */}
      <Modal visible={showChangePw} onClose={() => setShowChangePw(false)}>
        <h3 className="text-title-2 font-semibold mb-4">{t('profile_change_password')}</h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <Field type="password" placeholder={t('profile_current_password')} inputRef={pwCurrent} />
          <Field type="password" placeholder={t('profile_new_password')} inputRef={pw1} />
          <Field type="password" placeholder={t('profile_confirm_new_password')} inputRef={pw2} />
          {pwErr && <div className="text-theme-red mb-2">{pwErr}</div>}
          {pwSuccess && (
            <div className="bg-green-100 border border-green-300 text-green-700 rounded-lg px-4 py-2 text-center mb-2">
              {pwSuccess}
            </div>
          )}
          <div className="flex justify-center gap-4 mt-4">
            <button type="submit" className="btn-primary" disabled={!!pwSuccess}>{t('profile_save')}</button>
            <button type="button" onClick={() => setShowChangePw(false)} className="btn-secondary">{t('profile_cancel')}</button>
          </div>
        </form>
      </Modal>

      <Modal visible={showEditPic} onClose={() => setShowEditPic(false)}>
        <h3 className="text-title-2 font-semibold mb-4">{t('profile_change_picture')}</h3>
        <div className="flex flex-col items-center gap-4">
          <img
            src={avatarFile ? URL.createObjectURL(avatarFile) : bustCache(avatarUrl) || "/logo192_new.png"}
            alt="Profile Preview"
            className="w-28 h-28 rounded-full border-4 border-[#ffd700] shadow-xl bg-white object-cover"
            onError={(e) => { e.currentTarget.src = "/logo192_new.png"; }}
          />
          <input type="file" accept="image/*" id="profile-pic-input" className="hidden" onChange={handleAvatarChange} />
          <label htmlFor="profile-pic-input" className="w-full">
            <span className="btn-primary mt-2 block text-center cursor-pointer">{t('profile_choose_new_photo')}</span>
          </label>

          {avatarSuccess && (
            <div className="bg-green-100 border border-green-300 text-green-700 rounded-lg px-4 py-2 text-center">
              {avatarSuccess}
            </div>
          )}
          {avatarError && (
            <div className="bg-red-100 border border-red-300 text-red-700 rounded-lg px-4 py-2 text-center">
              {avatarError}
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-primary" onClick={saveAvatar} disabled={!avatarFile}>{t('profile_save')}</button>
            <button className="btn-secondary" onClick={() => setShowEditPic(false)}>{t('profile_cancel')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
