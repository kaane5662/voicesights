// INSERT_YOUR_CODE
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogIn, LogOut, User, LayoutGrid, Mic } from "lucide-react";
import { SERVER_URL } from "@/const";


export default function LandingNavbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Use nextjs cookies client API to check for auth_token
    // Note: The next/headers cookies() API is only available on the server side.
    // On the client, we'll still need to check document.cookie, as next/headers cannot be called from client components or useEffect.
    async function checkAuth() {
      try {
        const res = await fetch(`${SERVER_URL}/profiles`, {
          method: "GET",
          credentials: "include",
        });
        if (res.ok) {
          const user = await res.json();
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        setIsAuthenticated(false);
      }
    }

    checkAuth()
  }, []);

  const handleLogout = async () => {
    // Optionally call a backend endpoint to invalidate session
    await fetch(`${SERVER_URL}/profiles/logout`, { method: "DELETE", credentials: "include" });
    location.reload()
    // Remove the cookie and reload page
  };

  return (
    <nav className="w-full px-8 py-4 flex items-center justify-between backdrop-blur-md bg-gradient-to-b from-slate-950/70 to-transparent fixed z-50 top-0 left-0">
      {/* Logo and Brand */}
      <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold text-lg shadow-lg shadow-violet-500/25">
          <Mic className="w-5 h-5" />
        </span>
        <span className="hidden sm:inline">VoiceSights</span>
      </Link>
      {/* Navigation Links */}
      <div className="hidden md:flex items-center gap-8 text-slate-300 font-medium text-sm">
        <Link href="#features" className="hover:text-white transition-colors">Features</Link>
        <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
        <Link href="#faq" className="hover:text-white transition-colors">FAQ</Link>
        <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
      </div>
      {/* CTA Buttons */}
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md shadow-violet-500/25"
            >
              <LayoutGrid className="w-4 h-4" />
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-slate-200 font-medium text-sm hover:bg-white/20 transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-violet-400 font-medium text-sm hover:bg-white/10 hover:text-white transition-all"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md shadow-violet-500/25"
            >
              <User className="w-4 h-4" />
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
