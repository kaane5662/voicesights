"use client"
import { useState } from 'react';
import { Mic, Mail, Lock, User, Eye, EyeOff, ArrowRight, Chrome, Github, Loader2, AlertCircle, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { SERVER_URL } from '@/const';

// ============================================
// Types
// ============================================
interface SignupCredentials {
  name: string;
  email: string;
  password: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
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
const api = {
  async signup(credentials: SignupCredentials): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const fieldErrors: Record<string, string> = {};

    if (!credentials.name || credentials.name.length < 2) {
      fieldErrors.name = 'Name must be at least 2 characters';
    }

    if (!credentials.email || !credentials.email.includes('@')) {
      fieldErrors.email = 'Valid email is required';
    }

    if (!credentials.password || credentials.password.length < 8) {
      fieldErrors.password = 'Password must be at least 8 characters';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { success: false, error: 'Please fix the errors below', fieldErrors };
    }

    // Check if email already exists (dummy)
    if (credentials.email === 'test@test.com') {
      return { success: false, error: 'An account with this email already exists' };
    }

    return {
      success: true,
      data: {
        user: {
          id: 'usr_' + Math.random().toString(36).substr(2, 9),
          email: credentials.email,
          name: credentials.name,
          avatar: credentials.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          plan: 'starter',
        },
        tokens: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'rf_token_' + Math.random().toString(36).substr(2, 9),
          expiresIn: 3600,
        },
      },
    };
  },

  async signupWithGoogle(): Promise<ApiResponse<{ redirectUrl: string }>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      data: { redirectUrl: 'https://accounts.google.com/oauth/authorize?client_id=...&scope=email+profile' },
    };
  },

  async signupWithGithub(): Promise<ApiResponse<{ redirectUrl: string }>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      data: { redirectUrl: 'https://github.com/login/oauth/authorize?client_id=...&scope=user:email' },
    };
  },

  async checkEmailAvailability(email: string): Promise<ApiResponse<{ available: boolean }>> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (!email.includes('@')) {
      return { success: false, error: 'Invalid email format' };
    }

    const taken = ['test@test.com', 'admin@voiceai.com'];
    return {
      success: true,
      data: { available: !taken.includes(email.toLowerCase()) },
    };
  },

  async sendVerificationEmail(email: string): Promise<ApiResponse<{ message: string }>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      data: { message: 'Verification email sent' },
    };
  },
};

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
  error,
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  type?: string; 
  placeholder: string; 
  value: string; 
  onChange: (value: string) => void;
  showPasswordToggle?: boolean;
  error?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;

  return (
    <div>
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
      {error && <p className="text-xs text-rose-400 mt-1 ml-1">{error}</p>}
    </div>
  );
}

// ============================================
// Password Strength Component
// ============================================
function PasswordStrength({ password }: { password: string }) {
  const getStrength = (): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score, label: 'Weak', color: 'bg-rose-500' };
    if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 3) return { score, label: 'Good', color: 'bg-emerald-500' };
    return { score, label: 'Strong', color: 'bg-cyan-500' };
  };

  const strength = getStrength();
  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.color : 'bg-white/10'}`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">Password strength: <span className="text-white">{strength.label}</span></p>
    </div>
  );
}

// ============================================
// Signup Page
// ============================================
export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const router = useRouter()
  const handleSignup = async () => {
    setError(null);
    setFieldErrors({});

    
    axios.post(`${SERVER_URL}/profiles/signup`,{
        email:email,
        password:password,
        confirm_password:confirmPassword
    },{withCredentials:true}).then((res)=>{
        router.push('/dashboard')
    }).catch((err)=>{
        console.log(err.response.data)
        if (err.response.data.detail) {
            const detail = err.response.data.detail;
            if (Array.isArray(detail) && detail.length && detail[0].msg) {
                setError(detail[0].msg);
            } else {
                setError(detail);
            }
        }
    })
    .finally(()=>{
        
        setIsLoading(false)
    })
    setIsLoading(false);
  };

  const handleGoogleSignup = async () => {
    const response = await axios.get(`${SERVER_URL}/profiles/google-auth`, { withCredentials: true });
    if (response.status == 200 && response.data) {
      console.log('Redirect to:', response.data.url);
      window.location.href = response.data.url;
    }
  };

  const handleGithubSignup = async () => {
    const response = await api.signupWithGithub();
    if (response.success && response.data) {
      console.log('Redirect to:', response.data.redirectUrl);
    }
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
            Start your journey<br />with VoiceAI today
          </h2>
          <p className="text-lg text-slate-400 max-w-md mb-8">
            Join thousands of professionals who use VoiceAI to capture and analyze their conversations.
          </p>
          
          <div className="space-y-4">
            {[
              '100 free credits to get started',
              'No credit card required',
              'Cancel anytime',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <div className="p-1 rounded-full bg-emerald-500/20">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                {item}
              </div>
            ))}
          </div>
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
            <h1 className="text-2xl font-bold text-white mb-2">Create an account</h1>
            <p className="text-slate-500">Start your 14-day free trial</p>
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
              Account created! Check your email to verify.
            </div>
          )}

          {/* Social Signup */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            <button
              onClick={handleGoogleSignup}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm text-white"
            >
              <Chrome className="w-5 h-5" />
              Google
            </button>
            {/* <button
              onClick={handleGithubSignup}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm text-white"
            >
              <Github className="w-5 h-5" />
              GitHub
            </button> */}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-sm text-slate-500">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* <Input
              icon={User}
              type="text"
              placeholder="Full name"
              value={name}
              onChange={setName}
              error={fieldErrors.name}
            /> */}
            <Input
              icon={Mail}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={setEmail}
              error={fieldErrors.email}
            />
            <Input
            icon={Lock}
            type="password"
            placeholder="Confirm Password"
            value={password}
            onChange={setPassword}
            showPasswordToggle
            // error={fieldErrors.password}
            />
            <PasswordStrength password={password} />
            <div>
            </div>
              <Input
                icon={Lock}
                type="password"
                placeholder="Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                showPasswordToggle
                error={fieldErrors.password}
              />

            <label className="flex items-start gap-2 text-sm text-slate-400 cursor-pointer">
              <input 
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded bg-white/5 border-white/20" 
              />
              <span>
                I agree to the{' '}
                <button className="text-violet-400 hover:text-violet-300">Terms of Service</button>
                {' '}and{' '}
                <button className="text-violet-400 hover:text-violet-300">Privacy Policy</button>
              </span>
            </label>

            <button
              onClick={handleSignup}
              disabled={isLoading || success}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <button className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}