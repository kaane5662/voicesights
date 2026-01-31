import { useState, useEffect } from 'react';
import { X, Check, Zap, Rocket, Building, Crown } from 'lucide-react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { SERVER_URL } from '@/const';

// ============================================
// Types
// ============================================
interface Price {
  price_id: string;
  price: number;
  annual: boolean;
}

interface MaxPerDay {
  video: number;
  podcast: number;
}

interface Plan {
  id: string;
  name: string;
  credits: number;
  minDuration: number;
  maxDuration: number;
  maxPerDay: MaxPerDay;
  features: string[];
  stripeId: string;
  prices: Price[];
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  popular?: boolean;
}

interface UpgradePopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanId?: string;
//   onSelectPlan?: (planId: string, priceId: string) => void;
}

// ============================================
// Plan Data
// ============================================
const plans: Plan[] = [
  {
    id: 'premium',
    name: 'Premium',
    credits: 100,
    minDuration: 60,
    maxDuration: 600,
    maxPerDay: { video: 10, podcast: 10 },
    features: ['Basic support', 'Limited usage', 'Single user'],
    stripeId: 'plan_starter',
    prices: [
      { price_id: 'price_starter_monthly', price: 1000, annual: false },
      { price_id: 'price_starter_annual', price: 10000, annual: true },
    ],
    icon: Zap,
    color: 'slate',
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 500,
    minDuration: 60,
    maxDuration: 1800,
    maxPerDay: { video: 50, podcast: 50 },
    features: ['Priority support', 'Extended usage', 'Up to 5 users', 'API access', 'Integrations'],
    stripeId: 'plan_pro',
    prices: [
      { price_id: 'price_pro_monthly', price: 2900, annual: false },
      { price_id: 'price_pro_annual', price: 29000, annual: true },
    ],
    icon: Rocket,
    color: 'violet',
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    credits: 2000,
    minDuration: 60,
    maxDuration: 3600,
    maxPerDay: { video: 200, podcast: 200 },
    features: ['24/7 support', 'Unlimited usage', 'Unlimited users', 'API access', 'Custom integrations', 'SSO'],
    stripeId: 'plan_business',
    prices: [
      { price_id: 'price_business_monthly', price: 9900, annual: false },
      { price_id: 'price_business_annual', price: 99000, annual: true },
    ],
    icon: Building,
    color: 'amber',
  },
  
];

// ============================================
// Utility Functions
// ============================================
const formatPrice = (cents: number): string => {
  if (cents < 0) return 'Custom';
  return `$${(cents / 100).toFixed(0)}`;
};


const formatLimit = (value: number): string => {
  if (value < 0) return 'Unlimited';
  return value.toString();
};

// ============================================
// Plan Card Component
// ============================================
function PlanCard({ 
  plan, 
  isAnnual, 
  isCurrentPlan, 
  onSelect 
}: { 
  plan: Plan; 
  isAnnual: boolean; 
  isCurrentPlan: boolean; 
  onSelect: (priceId: string) => void;
}) {
  const Icon = plan.icon;
  const price = plan.prices.find(p => p.annual === isAnnual) || plan.prices[0];
  const monthlyPrice = isAnnual && price.price > 0 ? price.price / 12 : price.price;
  
  const colorClasses: Record<string, { bg: string; border: string; icon: string; button: string }> = {
    slate: { 
      bg: 'bg-slate-500/10', 
      border: 'border-slate-500/30', 
      icon: 'text-slate-400', 
      button: 'bg-white/10 hover:bg-white/20 text-white' 
    },
    violet: { 
      bg: 'bg-violet-500/10', 
      border: 'border-violet-500/30', 
      icon: 'text-violet-400', 
      button: 'bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:opacity-90 text-white' 
    },
    amber: { 
      bg: 'bg-amber-500/10', 
      border: 'border-amber-500/30', 
      icon: 'text-amber-400', 
      button: 'bg-amber-500 hover:bg-amber-600 text-black' 
    },
    cyan: { 
      bg: 'bg-cyan-500/10', 
      border: 'border-cyan-500/30', 
      icon: 'text-cyan-400', 
      button: 'bg-cyan-500 hover:bg-cyan-600 text-black' 
    },
  };
  
  const colors = colorClasses[plan.color];

  return (
    <div className={`relative flex flex-col p-4 rounded-2xl border transition-all ${
      isCurrentPlan 
        ? 'border-emerald-500/50 bg-emerald-500/5' 
        : plan.popular 
          ? 'border-violet-500/50 bg-violet-500/5' 
          : 'border-white/10 bg-white/5'
    }`}>
      {plan.popular && !isCurrentPlan && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-violet-500 text-white text-xs font-medium">
          Popular
        </span>
      )}
      {isCurrentPlan && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-medium">
          Current
        </span>
      )}
      
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${colors.bg} border ${colors.border}`}>
          <Icon className={`w-4 h-4 ${colors.icon}`} />
        </div>
        <h3 className="font-semibold text-white">{plan.name}</h3>
      </div>

      <div className="mb-3">
        <span className="text-2xl font-bold text-white">{formatPrice(monthlyPrice)}</span>
        {price.price > 0 && <span className="text-slate-500 text-sm">/mo</span>}
        {isAnnual && price.price > 0 && (
          <p className="text-xs text-emerald-400 mt-0.5">Billed annually</p>
        )}
      </div>

      {/* Limits */}
    <div className="p-2 my-2 text-sm rounded-lg bg-white/5">
        <p className="text-slate-500">Credits</p>
        <p className="text-white font-medium">{formatLimit(plan.credits)}</p>
    </div>
      

      {/* Features */}
      <ul className="space-y-1.5 mb-4 flex-1">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(price.price_id)}
        disabled={isCurrentPlan}
        className={`w-full py-2 rounded-xl font-medium text-sm transition-all ${
          isCurrentPlan 
            ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
            : colors.button
        }`}
      >
        {isCurrentPlan ? 'Current Plan' : price.price < 0 ? 'Contact Sales' : 'Upgrade'}
      </button>
    </div>
  );
}

// ============================================
// Upgrade Popup Component
// ============================================
export default function UpgradePopup({isOpen, onClose, currentPlanId = 'starter',  }: UpgradePopupProps) {
  const [isAnnual, setIsAnnual] = useState(true);

  

  const handleSelectPlan = (planId: string, priceId: string) => {
    // onSelectPlan?.(planId, priceId);
    axios.post(`${SERVER_URL}/stripe/checkout`,{
        plan: planId,
        annual:isAnnual
    },{withCredentials:true}).then((res)=>{
        window.location.href = res.data.checkout_url
    }).catch((err)=>{
        console.log(err?.message)
    })
    console.log('Selected:', planId, priceId);
  };


  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Upgrade Your Plan</h2>
            <p className="text-sm text-slate-500">Choose the plan that works best for you</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className={`text-sm ${!isAnnual ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-12 h-6 rounded-full transition-colors ${isAnnual ? 'bg-violet-500' : 'bg-white/20'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isAnnual ? 'left-7' : 'left-1'}`} />
            </button>
            <span className={`text-sm ${isAnnual ? 'text-white' : 'text-slate-500'}`}>Annual</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Save 17%</span>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-3 gap-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isAnnual={isAnnual}
                isCurrentPlan={currentPlanId === plan.id}
                onSelect={(priceId) => handleSelectPlan(plan.id, priceId)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 text-center">
          <p className="text-xs text-slate-500">
            All plans include a 14-day free trial. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
    ,
    document.querySelector('body') as any
  );
}

