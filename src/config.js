// src/config.js

const isLocalhost = process.env.NODE_ENV === 'development';

export const MAIN_API_BASE = isLocalhost 
  ? "http://localhost:5000/api" 
  : "https://novachaindigital-backend.onrender.com/api";

export const ADMIN_API_BASE = isLocalhost 
  ? "http://localhost:5000" 
  : "https://novachaindigital-admin-back.onrender.com";