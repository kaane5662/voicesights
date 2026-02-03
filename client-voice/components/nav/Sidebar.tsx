"use client"
import { useState } from 'react';
import { LayoutDashboard, Mic, AppWindow, Settings, LogOut, ChevronLeft, ChevronRight, Bell, Search, Moon, HelpCircle, Rocket, FileText, Sparkles, Edit, Folder, Globe } from 'lucide-react';
import Link from 'next/link';
import UpgradePopup from '../popups/SubscriptionPopup';
import { SearchContentDropdown } from '../popups/SearchContent';

// ============================================
// Types
// ============================================
type NavItemId = string;

interface NavItem {
  id: NavItemId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  href:string;
}

interface User {
  name: string;
  email: string;
  avatar: string;
  plan: 'free' | 'pro' | 'enterprise';
}

interface SidebarProps {
  currentPage: NavItemId;
  onNavigate: (page: NavItemId) => void;
  user: User;
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  collapsed: boolean;
  
}

interface UserProfileProps {
  user: User;
  collapsed: boolean;
  onLogout: () => void;
}

// ============================================
// Navigation Items
// ============================================
// Recursive definition for sectioning nav items for notes, sessions, and chats all at once

interface SectionNavItem extends NavItem {
  children?: SectionNavItem[];
}

// This definition allows for deep nesting by recursion in 'children'
const sectionedNavItems: SectionNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    id: 'folder',
    label: 'Folders',
    icon: Folder,
    href: '/folders',
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: Globe,
    href: '/knowledge',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: Edit,
    badge: 3,
    href: '/sessions',
    children: [
      {
        id: 'sessions',
        label: 'Sessions',
        icon: Mic,
        href: '/sessions',
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: FileText,
        href: '/docs',
        children: [
          // Recursive: notes could have further sectioning if needed
        ],
      },
      {
        id: 'chats',
        label: 'Chats',
        icon: Sparkles,
        href: '/chats',
        children: [
          // Recursive: chats could have further sectioning if needed
        ],
      }
    ],
  },
  
  {
    id: 'apps',
    label: 'Apps',
    icon: AppWindow,
    href: '/apps',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings',
  },
  
];

// ============================================
// Nav Item Component
// ============================================
function NavItemButton({ item, isActive, onClick, collapsed }: NavItemProps) {
  const Icon = item.icon;
  
  return (
    <Link href={item.href}
      onClick={onClick}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
        isActive
          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
          : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
      }`}
    >
      <div className={`shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-white'}`}>
        <Icon className="w-5 h-5" />
      </div>
      
      {!collapsed && (
        <>
          <span className="font-medium text-sm">{item.label}</span>
          {item.badge && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-medium">
              {item.badge}
            </span>
          )}
        </>
      )}
      
      {collapsed && item.badge && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center">
          {item.badge}
        </span>
      )}

      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 rounded-lg bg-slate-800 text-white text-sm whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
          {item.label}
        </div>
      )}
    </Link >
  );
}

// ============================================
// User Profile Component
// ============================================
function UserProfile({ user, collapsed, onLogout }: UserProfileProps) {
  const [showMenu, setShowMenu] = useState<boolean>(false);

  const planColors: Record<User['plan'], string> = {
    free: 'bg-slate-500/20 text-slate-400',
    pro: 'bg-violet-500/20 text-violet-400',
    enterprise: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-lg font-semibold text-white shadow-lg">
            {user.avatar}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
        </div>
        
        {!collapsed && (
          <div className="flex-1 text-left min-w-0">
            <p className="font-medium text-white text-sm truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        )}
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className={`absolute ${collapsed ? 'left-full ml-2 bottom-0' : 'bottom-full mb-2 left-0 right-0'} bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50`}>
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-lg font-semibold text-white">
                  {user.avatar}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white text-sm truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <div className="mt-2">
                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium capitalize ${planColors[user.plan]}`}>
                  {user.plan} Plan
                </span>
              </div>
            </div>
            
            <div className="p-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 text-sm transition-all">
                <Settings className="w-4 h-4" />
                Account Settings
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 text-sm transition-all">
                <HelpCircle className="w-4 h-4" />
                Help & Support
              </button>
            </div>
            
            <div className="p-1 border-t border-white/10">
              <button
                onClick={() => { onLogout(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-400 text-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Sidebar Component
// ============================================
export default function Sidebar() {
  const [collapsed,setCollapsed] = useState(false)
  const [upgradeOpen,setUpgradeOpen] = useState(false)
  const [semanticSearch,setSemanticSearch] = useState(false)
  return (
    <aside className={`h-screen flex flex-col bg-slate-900/50 border-r border-white/10 transition-all duration-300 ${
      collapsed ? 'w-20' : 'w-64'
    }`}>

      
        <UpgradePopup isOpen={upgradeOpen} onClose={()=>setUpgradeOpen(false)}/>
        {semanticSearch &&(
          <SearchContentDropdown onClose={()=>setSemanticSearch(false)}/>
        )}
     
      {/* Logo */}
      <div className={`p-4 border-b border-white/10 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Mic className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              VoiceAI
            </span>
          )}
        </div>
        {setCollapsed && !collapsed && (
          <button
            onClick={()=>setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && setCollapsed && (
        <button
          onClick={()=>setCollapsed(!collapsed)}
          className="mx-auto mt-2 p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Quick Actions */}
      {!collapsed && (
        <div className="p-4">
          <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium text-sm hover:opacity-90 transition-all shadow-lg shadow-violet-500/25">
            <Mic className="w-4 h-4" />
            New Session
          </button>
        </div>
      )}

      {collapsed && (
        <div className="p-2 flex justify-center">
          <button className="p-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:opacity-90 transition-all shadow-lg shadow-violet-500/25">
            <Mic className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {sectionedNavItems.map((item) => (
          <div key={item.id}>
            <NavItemButton
              item={item}
              collapsed={collapsed}
              isActive={false} // You may want to control active state based on router
              onClick={() => {}}
            />
            {item.children && item.children.length > 0 && !collapsed && (
              <div className="pl-5">
                {item.children.map((child) => (
                  <NavItemButton
                    key={child.id}
                    item={child}
                    collapsed={collapsed}
                    isActive={false}
                    onClick={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        <NavItemButton 
        isActive={false}
        collapsed={collapsed} onClick={()=>setSemanticSearch(true)} item={{icon:Sparkles,label:"Search", id:'semantic-search', href:''}}/>

      </nav>

      {/* Bottom Actions */}
      {/* <div className={`p-2 border-t border-white/10 ${collapsed ? 'flex flex-col items-center gap-2' : 'space-y-1'}`}>
        <button className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all ${
          collapsed ? 'justify-center w-full' : 'w-full'
        }`}>
          <Bell className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm">Notifications</span>}
          {!collapsed && (
            <span className="ml-auto w-2 h-2 rounded-full bg-rose-500" />
          )}
          {collapsed && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>
      </div> */}

      {/* User Profile */}
      <div className="p-3 border-t border-white/10">
        {/* <UserProfile collapsed={collapsed} /> */}
      </div>
    </aside>
  );
}

