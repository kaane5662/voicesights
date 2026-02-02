// INSERT_YOUR_CODE
"use client";
import { useState } from "react";
import Link from "next/link";
import { Mic, Sparkles, Folder, LayoutDashboard, BookOpen, MessageSquare, ChevronRight, Check, Loader2 } from "lucide-react";

// ---- Hero Section ----
function Hero() {
  return (
    <section className="relative flex flex-col-reverse lg:flex-row min-h-[68vh] items-center justify-between py-20 px-6 lg:px-16 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Left Content */}
      <div className="flex-1 flex flex-col items-start justify-center gap-8 z-10 mt-8 lg:mt-0">
        <div className="flex items-center gap-3">
          <Mic className="w-7 h-7 text-white" />
          <span className="text-lg font-bold text-white">voicesights</span>
        </div>
        <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold text-white leading-tight max-w-xl">
          Transform your <span className="bg-gradient-to-r from-violet-400 to-fuchsia-600 bg-clip-text text-transparent">voice</span> into actionable insights.
        </h1>
        <p className="text-lg text-slate-400 max-w-lg">
          Capture conversations and meetings, let AI organize your knowledge, and unlock instant, actionable summaries—so you can focus on what matters.
        </p>
        <div className="flex gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-semibold hover:opacity-90 transition-all shadow-lg shadow-violet-500/25"
          >
            Get Started Free
          </Link>
          <a
            href="#pricing"
            className="px-6 py-3 rounded-xl border border-violet-500 bg-white/5 text-violet-300 font-medium hover:bg-violet-700/10 transition-all"
          >
            View Pricing
          </a>
        </div>
        <div className="flex flex-wrap gap-2 mt-6">
          <span className="px-3 py-1 bg-violet-400/10 text-violet-300 rounded-full text-xs font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> AI Note-Taking
          </span>
          <span className="px-3 py-1 bg-fuchsia-400/10 text-fuchsia-300 rounded-full text-xs font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> App Integrations
          </span>
          <span className="px-3 py-1 bg-cyan-400/10 text-cyan-300 rounded-full text-xs font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> Real-Time Knowledge Base
          </span>
        </div>
      </div>

      {/* Hero Image */}
      <div className="flex-1 flex items-center justify-center mb-12 lg:mb-0">
        <div className="relative w-[360px] h-[400px] lg:w-[420px] lg:h-[480px] flex items-center justify-center">
          {/* Main Device Image */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 rounded-3xl blur-xl"></div>
          <div className="w-full h-full bg-white/5 border border-white/10 rounded-3xl shadow-lg flex items-center justify-center">
            {/* Placeholder image */}
            <span className="text-slate-500 text-xl font-semibold">[Product Mockup]</span>
          </div>
          {/* Overlay Integration Logos (boilerplate) */}
          <div className="absolute -top-8 -left-10 flex flex-col items-center">
            <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center shadow-md mb-2">
              <img src="/integration-google-calendar.svg" alt="Google Calendar" className="w-8 h-8 opacity-70" />
            </div>
            <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center shadow-md">
              <img src="/integration-linear.svg" alt="Linear" className="w-8 h-8 opacity-70" />
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 w-14 h-14 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center shadow-md">
            <img src="/integration-google-sheets.svg" alt="Google Sheets" className="w-8 h-8 opacity-70" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- Features Section ----
function Features() {
  const features = [
    {
      icon: <Sparkles className="w-8 h-8 text-violet-400" />,
      title: "AI-Powered Note-Taking",
      desc: "Automatically create clean, searchable transcripts from every session.",
    },
    {
      icon: <Folder className="w-8 h-8 text-fuchsia-400" />,
      title: "Organized With Folders",
      desc: "Structure and group materials intuitively for every workflow.",
    },
    {
      icon: <LayoutDashboard className="w-8 h-8 text-cyan-400" />,
      title: "Multiple App Integrations",
      desc: (
        <>
          Effortlessly connect <span className="font-bold">Google Calendar</span>, <span className="font-bold">Sheets</span>, <span className="font-bold">Linear</span> and more.
        </>
      ),
    },
    {
      icon: <MessageSquare className="w-8 h-8 text-emerald-400" />,
      title: "Chat With Your Apps",
      desc: "Ask the chatbot for insights, and let it take actions for you.",
    },
    {
      icon: <BookOpen className="w-8 h-8 text-yellow-400" />,
      title: "Real-Time Knowledge Base",
      desc: "Your database grows and updates automatically after every session.",
    },
  ];
  return (
    <section className="py-20 px-6 lg:px-16 relative overflow-x-hidden">
      <h2 className="text-3xl font-bold text-white mb-12 text-center">All-in-one Productivity With AI</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {features.map((f, i) => (
          <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-8 flex flex-col items-start shadow-lg hover:scale-105 transition-transform">
            <div className="mb-4">{f.icon}</div>
            <h3 className="text-xl font-semibold text-white mb-2">{f.title}</h3>
            <p className="text-slate-400 text-base">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Pricing Section ----
function Pricing() {
  const plans = [
    {
      name: "Monthly",
      price: "$9.99",
      period: "/month",
      perks: [
        "Unlimited sessions",
        "AI notes & chatbot",
        "All integrations",
        "Full real-time knowledge base",
        "Priority support",
      ],
      cta: "/signup",
      highlight: false,
    },
    {
      name: "Yearly",
      price: "$99.99",
      period: "/year",
      perks: [
        "Everything in Monthly",
        "2 months free (save 17%)",
      ],
      cta: "/signup",
      highlight: true,
    },
  ];
  return (
    <section id="pricing" className="py-20 px-6 lg:px-16 bg-gradient-to-br from-violet-900/60 to-fuchsia-900/40">
      <h2 className="text-3xl font-bold text-white mb-12 text-center">Simple Pricing</h2>
      <div className="flex flex-col md:flex-row justify-center gap-8 max-w-3xl mx-auto">
        {plans.map((p, i) => (
          <div
            key={p.name}
            className={`flex-1 rounded-2xl bg-white/5 border border-white/10 p-9 shadow-xl transition-all ${
              p.highlight
                ? "border-violet-500/50 scale-105 shadow-violet-500/10 relative"
                : ""
            }`}
          >
            {p.highlight && (
              <span className="absolute top-5 right-6 px-3 py-1 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white text-xs rounded-full font-bold">
                Best Value
              </span>
            )}
            <h3 className="text-xl font-bold text-white mb-2">{p.name}</h3>
            <div className="flex items-end gap-1 mb-4">
              <span className="text-4xl font-extrabold text-white">{p.price}</span>
              <span className="text-lg text-slate-400 mb-1">{p.period}</span>
            </div>
            <ul className="text-slate-400 space-y-2 mb-8">
              {p.perks.map((perk, j) => (
                <li key={j} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-violet-400" /> {perk}
                </li>
              ))}
            </ul>
            <Link
              href={p.cta}
              className={`block w-full py-3 rounded-xl text-center font-semibold ${
                p.highlight
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:opacity-90"
                  : "bg-white/10 border border-violet-500 text-violet-300 hover:bg-white/20"
              } transition-all`}
            >
              Start {p.name}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Knowledge Base Updates Section ----
function KnowledgeBase() {
  // Fake knowledge base items for demo
  const items = [
    { title: "Chat with Google Calendar", time: "a few seconds ago" },
    { title: "Linear ticket created: UI Refactor", time: "3 mins ago" },
    { title: "Meeting with Jill transcribed", time: "8 mins ago" },
    { title: "Brainstorm Notes added to Project folder", time: "10 mins ago" },
  ];
  return (
    <section className="py-20 px-6 lg:px-16 flex flex-col lg:flex-row items-center gap-16">
      <div className="flex-1 flex flex-col items-start">
        <h2 className="text-3xl font-bold text-white mb-6">Your Knowledge Base, In Real Time</h2>
        <p className="text-lg text-slate-400 mb-8">
          As you record sessions, take notes, or use integrations, your knowledge base grows automatically. It's always up-to-date—one source of truth for every workflow.
        </p>
        <ul className="flex flex-col gap-4 w-full">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-4">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <span className="text-white text-base font-medium">{item.title}</span>
              <span className="ml-auto text-xs text-slate-400">{item.time}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-[320px] h-[340px] bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
          <span className="text-slate-500 text-lg font-semibold">[Knowledge Base UI]</span>
        </div>
      </div>
    </section>
  );
}

// ---- Testimonials Section ----
function Testimonials() {
  const testimonials = [
    {
      quote:
        "voicesights completely transformed how I document and follow up on meetings—connecting my notes to my Linear tasks in seconds.",
      author: "Ava T.",
      title: "Product Manager",
    },
    {
      quote:
        "The integrations just work, and the chatbot answers my workflow questions better than any dashboard. Game-changing!",
      author: "David W.",
      title: "Startup Founder",
    },
    {
      quote:
        "No more searching for anything. Folders, notes, chats—everything is organized and accessible by AI. Love it.",
      author: "Priya R.",
      title: "Consultant",
    },
  ];
  return (
    <section className="py-20 px-6 lg:px-16 bg-gradient-to-br from-fuchsia-900/40 to-violet-900/40">
      <h2 className="text-3xl font-bold text-white mb-12 text-center">What Users Say</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-lg flex flex-col items-start"
          >
            <div className="mb-4">
              <Sparkles className="w-6 h-6 text-fuchsia-400" />
            </div>
            <p className="text-lg text-white italic mb-6">&ldquo;{t.quote}&rdquo;</p>
            <div className="flex flex-col gap-0">
              <span className="font-semibold text-violet-300">{t.author}</span>
              <span className="text-sm text-slate-400">{t.title}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- FAQ Section ----
function Faq() {
  const faqs = [
    {
      q: "What integrations are supported?",
      a: "You can connect Google Calendar, Google Sheets, Linear, and more apps—see your dashboard for all available integrations.",
    },
    {
      q: "Is my data private and secure?",
      a: "Absolutely. All sessions and notes are encrypted. You have full control over your connected data.",
    },
    {
      q: "How does the AI note-taking work?",
      a: "voicesights transcribes your voice sessions using intelligent AI, organizing action items, key points, and more.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes! You can cancel monthly or yearly subscriptions at any time via your account settings.",
    },
    {
      q: "How does the real-time knowledge base update?",
      a: "Every session, note, or chat updates the knowledge base instantly, so your workspace is always up-to-date.",
    },
  ];
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 px-6 lg:px-16">
      <h2 className="text-3xl font-bold text-white mb-12 text-center">FAQ</h2>
      <div className="max-w-2xl mx-auto">
        {faqs.map((item, i) => (
          <div key={i} className="mb-4 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between px-6 py-4 text-left text-white font-semibold focus:outline-none"
            >
              <span>{item.q}</span>
              <ChevronRight
                className={`w-5 h-5 transition-transform ${
                  open === i ? "rotate-90" : ""
                }`}
              />
            </button>
            <div
              className={`px-6 pb-4 text-slate-400 text-base transition-all ${
                open === i ? "block" : "hidden"
              }`}
            >
              {item.a}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Footer ----
function Footer() {
  return (
    <footer className="py-10 px-8 text-center border-t border-white/10 text-slate-500 text-sm mt-6">
      &copy; {new Date().getFullYear()} voicesights &middot; All rights reserved ·{" "}
      <Link href="/privacy" className="text-violet-300 hover:text-violet-100 underline">Privacy Policy</Link>
    </footer>
  );
}

// ---- Page ----
export default function LandingPage() {
  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white min-h-screen">
      <Hero />
      <Features />
      <KnowledgeBase />
      <Pricing />
      <Testimonials />
      <Faq />
      <Footer />
    </div>
  );
}

