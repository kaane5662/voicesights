"use client"
import { useEffect, useState } from 'react';
import { User, Mail, CreditCard, Shield, Bell, Palette, Trash2, Save, Loader2, Check, AlertCircle, Eye, EyeOff, Lock, LogOut, ChevronRight, ExternalLink, Copy, Key } from 'lucide-react';
import axios from 'axios';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { notFound } from 'next/navigation';
import { SERVER_URL } from '@/const';

// ============================================
// Types
// ============================================
export interface Profile {
  id: string;
  username: string;
  email: string;
  plan?: string;
  bio?: string;
  stripe_customer_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface UpdateProfileData {
  username?: string;
  email?: string;
  bio?: string;
}

interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}

type SettingsTab = 'profile' | 'security' | 'billing' | 'notifications';

// ============================================
// API Functions
// ============================================
const api = {
  async getProfile(): Promise<ApiResponse<Profile>> {
    await new Promise(r => setTimeout(r, 500));
    return {
      success: true,
      data: {
        id: 'usr_abc123',
        username: 'alexjohnson',
        email: 'alex@company.com',
        plan: 'pro',
        bio: 'Product designer and AI enthusiast. Building the future of voice interfaces.',
        stripe_customer_id: 'cus_xyz789',
        created_at: '2024-06-15T10:30:00Z',
        updated_at: '2025-01-10T14:22:00Z',
      },
    };
  },

  async updateProfile(data: UpdateProfileData): Promise<ApiResponse<Profile>> {
    await new Promise(r => setTimeout(r, 1000));
    
    if (data.username && data.username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }
    if (data.email && !data.email.includes('@')) {
      return { success: false, error: 'Invalid email format' };
    }

    return {
      success: true,
      data: {
        id: 'usr_abc123',
        username: data.username || 'alexjohnson',
        email: data.email || 'alex@company.com',
        bio: data.bio,
        plan: 'pro',
        stripe_customer_id: 'cus_xyz789',
        created_at: '2024-06-15T10:30:00Z',
        updated_at: new Date().toISOString(),
      },
    };
  },

  async updatePassword(data: UpdatePasswordData): Promise<ApiResponse<{ message: string }>> {
    await new Promise(r => setTimeout(r, 1000));
    
    if (data.currentPassword.length < 6) {
      return { success: false, error: 'Current password is incorrect' };
    }
    if (data.newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters' };
    }

    return { success: true, data: { message: 'Password updated successfully' } };
  },

  async deleteAccount(password: string): Promise<ApiResponse<{ message: string }>> {
    await new Promise(r => setTimeout(r, 1000));
    
    if (password !== 'delete') {
      return { success: false, error: 'Incorrect password' };
    }

    return { success: true, data: { message: 'Account deleted' } };
  },

  async getStripePortalUrl(): Promise<ApiResponse<{ url: string }>> {
    await new Promise(r => setTimeout(r, 500));
    return {
      success: true,
      data: { url: 'https://billing.stripe.com/session/xxx' },
    };
  },

  async regenerateApiKey(): Promise<ApiResponse<{ apiKey: string }>> {
    await new Promise(r => setTimeout(r, 800));
    return {
      success: true,
      data: { apiKey: 'vai_' + Math.random().toString(36).substr(2, 32) },
    };
  },
};

// ============================================
// Tab Button Component
// ============================================
function TabButton({ icon: Icon, label, isActive, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all ${
        isActive
          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
          : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

// ============================================
// Input Component
// ============================================
function Input({ label, type = 'text', value, onChange, placeholder, disabled = false }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <label className="block text-sm font-medium text-slate-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />
        {isPassword && (
          <button onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Profile Settings
// ============================================
function ProfileSettings({ profile, onUpdate }: { profile: Profile; onUpdate: (p: Profile) => void }) {
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [bio, setBio] = useState(profile.bio || '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await axios.post(`${SERVER_URL}/profiles/change-email`, { new_email: email },{withCredentials:true});
      if (res.data && res.data.success) {
        onUpdate({ ...profile, email: res.data.new_email });
        setMessage({ type: 'success', text: 'Email updated successfully' });
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to update email' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.detail || e?.response?.data?.error || 'An error occurred while updating email' });
    }finally{
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Profile</h2>
        <p className="text-sm text-slate-500">Manage your public profile information</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-2xl font-bold text-white">
          {username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-white">{username}</p>
          <p className="text-sm text-slate-500">Member since {new Date(profile.created_at || '').toLocaleDateString()}</p>
        </div>
      </div> */}

      <div className="grid grid-cols-1 gap-4">
        {/* <Input label="Username" value={username} onChange={setUsername} placeholder="username" /> */}
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="email@example.com" />
      </div>

      

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ============================================
// Security Settings
// ============================================
function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [apiKey, setApiKey] = useState('vai_xxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  const [copied, setCopied] = useState(false);

  const handleUpdatePassword = async () => {
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setIsLoading(true);
    // INSERT_YOUR_CODE
    try {
      const res = await axios.post(
        `${SERVER_URL}/profiles/reset-password`,
        {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
        { withCredentials: true }
      );
      if (res.data && res.data.success) {
        setMessage({ type: "success", text: "Password changed successfully." });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (e: any) {
      let msg =
        e?.response?.data?.detail || e?.response?.data?.error
      setMessage({ type: "error", text: msg });
    }finally{
        setIsLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    const res = await api.regenerateApiKey();
    if (res.success && res.data) {
      setApiKey(res.data.apiKey);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Security</h2>
        <p className="text-sm text-slate-500">Manage your password and API access</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Password */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-violet-400" />
          <h3 className="font-medium text-white">Change Password</h3>
        </div>
        <Input label="Current Password" type="password" value={currentPassword} onChange={setCurrentPassword} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="New Password" type="password" value={newPassword} onChange={setNewPassword} />
          <Input label="Confirm Password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleUpdatePassword}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-500/30 disabled:opacity-50 transition-all"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Update Password
          </button>
        </div>
      </div>

      

      {/* Sessions */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogOut className="w-5 h-5 text-slate-400" />
            <div>
              <h3 className="font-medium text-white">Active Sessions</h3>
              <p className="text-sm text-slate-500">Manage your logged in devices</p>
            </div>
          </div>
          <button className="text-sm text-rose-400 hover:text-rose-300 transition-colors">
            Sign out all devices
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Billing Settings
// ============================================
function BillingSettings({ profile }: { profile: Profile }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleManageBilling = async () => {
    setIsLoading(true);
    try{
        
    }catch{

    }finally{
        setIsLoading(false)
    }
    const res = await api.getStripePortalUrl();
    if (res.success && res.data) {
      console.log('Redirect to:', res.data.url);
      // window.location.href = res.data.url;
    }
    setIsLoading(false);
  };

  const planColors: Record<string, string> = {
    starter: 'bg-slate-500/20 text-slate-400',
    pro: 'bg-violet-500/20 text-violet-400',
    business: 'bg-amber-500/20 text-amber-400',
    enterprise: 'bg-cyan-500/20 text-cyan-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Billing</h2>
        <p className="text-sm text-slate-500">Manage your subscription and payment methods</p>
      </div>

      {/* Current Plan */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-slate-500">Current Plan</p>
            <div className="flex items-center gap-2 mt-1">
              <h3 className="text-xl font-semibold text-white capitalize">{profile.plan}</h3>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${planColors[profile.plan || 'starter']}`}>
                Active
              </span>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white text-sm font-medium hover:opacity-90 transition-all">
            Upgrade Plan
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-sm text-slate-500">Credits Used</p>
            <p className="text-lg font-semibold text-white">247 / 500</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Next Billing</p>
            <p className="text-lg font-semibold text-white">Feb 15, 2025</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Amount</p>
            <p className="text-lg font-semibold text-white">$29/mo</p>
          </div>
        </div>
      </div>

      {/* Stripe Portal */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-slate-400" />
            <div>
              <h3 className="font-medium text-white">Payment Methods</h3>
              <p className="text-sm text-slate-500">Manage cards and billing info via Stripe</p>
            </div>
          </div>
          <button
            onClick={handleManageBilling}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-all"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Manage Billing
          </button>
        </div>
      </div>

      {/* Customer ID */}
      {profile.stripe_customer_id && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500">Stripe Customer ID</p>
          <code className="text-sm text-slate-400 font-mono">{profile.stripe_customer_id}</code>
        </div>
      )}
    </div>
  );
}

// ============================================
// Notifications Settings
// ============================================
function NotificationsSettings() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [sessionComplete, setSessionComplete] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [productUpdates, setProductUpdates] = useState(true);

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-violet-500' : 'bg-white/20'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Notifications</h2>
        <p className="text-sm text-slate-500">Manage how you receive notifications</p>
      </div>

      <div className="space-y-4">
        {[
          { label: 'Email Notifications', desc: 'Receive notifications via email', value: emailNotifs, onChange: setEmailNotifs },
          { label: 'Session Complete', desc: 'Get notified when transcription is ready', value: sessionComplete, onChange: setSessionComplete },
          { label: 'Weekly Digest', desc: 'Summary of your weekly activity', value: weeklyDigest, onChange: setWeeklyDigest },
          { label: 'Product Updates', desc: 'News about features and improvements', value: productUpdates, onChange: setProductUpdates },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div>
              <h3 className="font-medium text-white">{item.label}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
            <Toggle enabled={item.value} onChange={item.onChange} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Danger Zone
// ============================================
function DangerZone() {
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    const res = await api.deleteAccount(password);
    if (res.success) {
      console.log('Account deleted');
    } else {
      alert(res.error);
    }
    setIsLoading(false);
  };

  return (
    <div className="mt-8 p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20">
      <div className="flex items-center gap-3 mb-4">
        <Trash2 className="w-5 h-5 text-rose-400" />
        <h3 className="font-medium text-rose-400">Danger Zone</h3>
      </div>
      
      {!showDelete ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Delete Account</p>
            <p className="text-sm text-slate-500">Permanently delete your account and all data</p>
          </div>
          <button
            onClick={() => setShowDelete(true)}
            className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 text-sm hover:bg-rose-500/30 transition-all"
          >
            Delete Account
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Type your password to confirm deletion. This action cannot be undone.</p>
          <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter password" />
          <div className="flex gap-3">
            <button onClick={() => setShowDelete(false)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500 text-white text-sm hover:bg-rose-600 disabled:opacity-50 transition-all"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Permanently Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Settings Page
// ============================================
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [loading,setLoading] = useState(false)
  const [profile, setProfile] = useState<Profile>({
    id: 'usr_abc123',
    username: 'alexjohnson',
    email: 'alex@company.com',
    plan: 'pro',
    bio: 'Product designer and AI enthusiast.',
    stripe_customer_id: 'cus_xyz789',
    created_at: '2024-06-15T10:30:00Z',
    updated_at: '2025-01-10T14:22:00Z',
  });


  // INSERT_YOUR_CODE
  // Fetch profile from API on mount and set the state
  

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const res = await axios.get(`${SERVER_URL}/profiles`, { withCredentials: true });
        if (res.data && res.data.profile) {
          setProfile(res.data.profile);
        }
      } catch (err:any) {
        console.log(err.message)
        // optionally handle error
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);
  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];


  if(loading)
    return <LoadingScreen loadingText='Loading Settings...'/>

  if(!profile)
    return notFound()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-500 mt-1">Manage your account preferences</p>
        </header>

        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-56 shrink-0 space-y-1">
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                icon={tab.icon}
                label={tab.label}
                isActive={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'profile' && <ProfileSettings profile={profile} onUpdate={setProfile} />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'billing' && <BillingSettings profile={profile} />}
            {activeTab === 'notifications' && <NotificationsSettings />}
            
            {activeTab === 'profile' && <DangerZone />}
          </div>
        </div>
      </div>
    </div>
  );
}