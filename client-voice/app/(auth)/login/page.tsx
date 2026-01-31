"use client"
import { useState } from 'react';
import { Mic, Mail, Lock, Eye, EyeOff, ArrowRight, Chrome, Github, Loader2, AlertCircle, Check } from 'lucide-react';
import axios from 'axios';
import { SERVER_URL } from '@/const';
import { useRouter } from 'next/navigation';

// ============================================
// Types
// ============================================
interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  plan: 'starter' | 'pro' | 'business' | 'enterprise';
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================
// API Functions
// ============================================


// ============================================
// Input Component
// ============================================
function Input({ 
  icon: Icon, 
  type = 'text', 
  placeholder, 
  value, 
  onChange,
  showPasswordToggle = false,
  error = false,
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  type?: string; 
  placeholder: string; 
  value: string; 
  onChange: (value: string) => void;
  showPasswordToggle?: boolean;
  error?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
      <input
        type={inputType}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pl-12 pr-12 py-3 rounded-xl bg-white/5 border text-white placeholder-slate-500 focus:outline-none transition-all ${
          error ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-violet-500/50'
        }`}
      />
      {showPasswordToggle && (
        <button
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}

// ============================================
// Login Page
// ============================================
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter()

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);

    axios.post(`${SERVER_URL}/profiles/login`,{
        email:email,
        password:password
    },{withCredentials:true}).then((res)=>{
        router.push('/dashboard')
    }).finally(()=>{
        setIsLoading(false)
    })

  };

  const handleGoogleLogin = async () => {
    const response = await api.loginWithGoogle();
    if (response.success && response.data) {
      console.log('Redirect to:', response.data.redirectUrl);
      // window.location.href = response.data.redirectUrl;
    }
  };

  const handleGithubLogin = async () => {
    const response = await api.loginWithGithub();
    if (response.success && response.data) {
      console.log('Redirect to:', response.data.redirectUrl);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email first');
      return;
    }
    setIsLoading(true);
    // const response = await api.forgotPassword(email);
    // if (response.success) {
    //   setError(null);
    //   alert(response.data?.message);
    // } else {
    //   setError(response.error || 'Failed to send reset email');
    // }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-3xl" />
      </div>

      {/* Left Panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">VoiceAI</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Transform your voice<br />into actionable insights
          </h2>
          <p className="text-lg text-slate-400 max-w-md">
            Record, transcribe, and analyze your conversations with AI-powered tools.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {['🎨', '🚀', '💡', '🎯'].map((emoji, i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-lg">
                {emoji}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500">
            <span className="text-white font-medium">10,000+</span> users already joined
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/25 mb-4 lg:hidden">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-slate-500">Sign in to continue to VoiceAI</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm mb-6">
              <Check className="w-4 h-4 shrink-0" />
              Login successful! Redirecting...
            </div>
          )}

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm text-white"
            >
              <Chrome className="w-5 h-5" />
              Google
            </button>
            <button
              onClick={handleGithubLogin}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm text-white"
            >
              <Github className="w-5 h-5" />
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-sm text-slate-500">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Input
              icon={Mail}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={setEmail}
              error={!!error}
            />
            <Input
              icon={Lock}
              type="password"
              placeholder="Password"
              value={password}
              onChange={setPassword}
              showPasswordToggle
              error={!!error}
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-white/5 border-white/20" 
                />
                Remember me
              </label>
              <button 
                onClick={handleForgotPassword}
                className="text-violet-400 hover:text-violet-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoading || success}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <button className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}