"use client"
import { useState,useEffect } from 'react';
import { Search, Plus, Check, ChevronRight, Shield, Key, Trash2, Settings, ExternalLink, ToggleLeft, ToggleRight, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { SERVER_URL } from '@/const';

const availableApps = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Create events, check availability, and manage schedules',
    icon: '📅',
    color: 'from-blue-500 to-cyan-500',
    category: 'Productivity',
    type:'google',
    
    permissions: [
      {
        id: 'https://www.googleapis.com/auth/calendar.events.readonly',
        name: 'View events (all calendars)',
        description: 'View events on all your calendars.',
        required: true
      },
      {
        id: 'https://www.googleapis.com/auth/calendar.settings.readonly',
        name: 'View calendar settings',
        description: 'View your Calendar settings.',
        required: false
      },
      {
        id: 'https://www.googleapis.com/auth/calendar.addons.execute',
        name: 'Run as Calendar add-on',
        description: 'Run as a Calendar add-on.',
        required: false
      },
      {
        id: 'https://www.googleapis.com/auth/calendar.addons.current.event.read',
        name: 'See opened event details',
        description: 'See the events you open in Google Calendar.',
        required: false
      },
      {
        id: 'https://www.googleapis.com/auth/calendar.addons.current.event.write',
        name: 'Edit opened events',
        description: 'Edit the events you open in Google Calendar.',
        required: false
      },
      {
        id: 'https://www.googleapis.com/auth/calendar.events.owned',
        name: 'Manage owned calendars',
        description: 'See, create, change, and delete events on Google calendars you own.',
        required: false
      },
      {
        id: 'https://www.googleapis.com/auth/calendar.events.owned.readonly',
        name: 'View events (owned calendars only)',
        description: 'See the events on Google calendars you own.',
        required: false
      },
      {
        id: 'https://www.googleapis.com/auth/calendar.events.freebusy',
        name: 'View free/busy availability',
        description: 'See the availability on Google calendars you have access to.',
        required: false
      },
      {
        id: 'https://www.googleapis.com/auth/calendar.calendarlist',
        name: 'View and manage your calendar list',
        description: 'View and manage the list of calendars in your Google Calendar account.',
        required: false
      },
    ]
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, send, and manage your email messages',
    icon: '✉️',
    color: 'from-red-500 to-rose-500',
    category: 'Communication',
    permissions: [
      { id: 'read_mail', name: 'Read emails', description: 'View your email messages and threads', required: true },
      { id: 'send_mail', name: 'Send emails', description: 'Compose and send new emails', required: false },
      { id: 'manage_labels', name: 'Manage labels', description: 'Create, edit, and delete email labels', required: false },
      { id: 'delete_mail', name: 'Delete emails', description: 'Move emails to trash or permanently delete', required: false },
    ]
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    description: 'Create, read, and edit documents',
    icon: '📄',
    color: 'from-blue-600 to-indigo-500',
    category: 'Productivity',
    permissions: [
      { id: 'read_docs', name: 'Read documents', description: 'View your documents and their content', required: true },
      { id: 'write_docs', name: 'Edit documents', description: 'Modify existing document content', required: false },
      { id: 'create_docs', name: 'Create documents', description: 'Create new documents in your Drive', required: false },
    ]
  },
  {
    type:"google",
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Access and modify spreadsheet data',
    icon: '📊',
    color: 'from-green-500 to-emerald-500',
    category: 'Productivity',
    permissions: [
      {
        id: 'https://www.googleapis.com/auth/spreadsheets',
        name: 'Full access to Google Sheets',
        description: 'See, edit, create, and delete all your Google Sheets spreadsheets.',
        sensitivity: 'Sensitive',
        required: true,
      },
      {
        id: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        name: 'View Google Sheets (read-only)',
        description: 'See all your Google Sheets spreadsheets.',
        sensitivity: 'Sensitive',
        required: false,
      },
      {
        id: 'https://www.googleapis.com/auth/drive.file',
        name: 'Access specific Drive files used with this app',
        description: 'See, edit, create, and delete only the specific Google Drive files you use with this app.',
        sensitivity: 'Recommended, Non-sensitive',
        required: false,
      },
      {
        id: 'https://www.googleapis.com/auth/drive',
        name: 'Full access to Google Drive',
        description: 'See, edit, create, and delete all of your Google Drive files.',
        sensitivity: 'Restricted',
        required: false,
      },
      {
        id: 'https://www.googleapis.com/auth/drive.readonly',
        name: 'View all Google Drive files (read-only)',
        description: 'See and download all your Google Drive files.',
        sensitivity: 'Restricted',
        required: false,
      },
    ]
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Manage boards, lists, and cards',
    icon: '📋',
    color: 'from-sky-500 to-blue-600',
    category: 'Project Management',
    permissions: [
      { id: 'read_boards', name: 'Read boards', description: 'View your boards, lists, and cards', required: true },
      { id: 'write_cards', name: 'Create & edit cards', description: 'Add and modify cards', required: false },
      { id: 'manage_boards', name: 'Manage boards', description: 'Create boards and lists', required: false },
      { id: 'delete_cards', name: 'Delete cards', description: 'Remove cards from boards', required: false },
    ]
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Track issues, projects, and sprints',
    icon: '⚡',
    color: 'from-violet-500 to-purple-600',
    category: 'Project Management',
    permissions: [
      { id: 'read', name: 'Read access', description: "Read access for the user's account. This scope will always be present.", required: true },
      { id: 'write', name: 'Write access', description: "Write access for the user's account. If your application only needs to create comments, use a more targeted scope.", required: false },
      { id: 'issues:create', name: 'Create issues', description: 'Allows creating new issues and their attachments', required: false },
      { id: 'comments:create', name: 'Create comments', description: 'Allows creating new issue comments', required: false },
      { id: 'timeSchedule:write', name: 'Manage time schedules', description: 'Allows creating and modifying time schedules', required: false },
      { id: 'admin', name: 'Admin access', description: 'Full access to admin level endpoints. You should never ask for this permission unless it is absolutely needed.', required: false },
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Access pages, databases, and workspaces',
    icon: '📝',
    color: 'from-gray-600 to-gray-800',
    category: 'Productivity',
    permissions: [
      { id: 'read_content', name: 'Read content', description: 'View pages and databases', required: true },
      { id: 'write_content', name: 'Edit content', description: 'Modify pages and database entries', required: false },
      { id: 'create_content', name: 'Create content', description: 'Add new pages and entries', required: false },
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages and access channels',
    icon: '💬',
    color: 'from-purple-500 to-pink-500',
    category: 'Communication',
    permissions: [
      { id: 'read_messages', name: 'Read messages', description: 'View messages in channels', required: true },
      { id: 'send_messages', name: 'Send messages', description: 'Post messages to channels', required: false },
      { id: 'manage_channels', name: 'Manage channels', description: 'Create and archive channels', required: false },
    ]
  },
];

function AppCard({ app, isConnected, onConnect, onManage }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isConnected 
        ? 'bg-white/5 border-emerald-500/30' 
        : 'bg-white/5 border-white/10 hover:border-white/20'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-2xl shadow-lg`}>
          {app.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{app.name}</h3>
            {isConnected && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                <Check className="w-3 h-3" /> Connected
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{app.description}</p>
          <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-white/5 text-xs text-slate-500">
            {app.category}
          </span>
        </div>
        <button
          onClick={() => isConnected ? onManage(app) : onConnect(app)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            isConnected
              ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
              : 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:opacity-90'
          }`}
        >
          {isConnected ? 'Manage' : 'Connect'}
        </button>
      </div>
    </div>
  );
}

function PermissionToggle({ permission, enabled, onChange, disabled }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${
      disabled ? 'bg-white/5' : 'bg-white/5 hover:bg-white/[0.07]'
    } transition-all`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{permission.name}</span>
          {permission.required && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">Required</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{permission.description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`p-1 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {enabled ? (
          <ToggleRight className="w-8 h-8 text-emerald-400" />
        ) : (
          <ToggleLeft className="w-8 h-8 text-slate-500" />
        )}
      </button>
    </div>
  );
}

function ConnectModal({ app, onClose, onConnect }) {
  const [permissions, setPermissions] = useState(
    app.permissions.reduce((acc, p) => ({ ...acc, [p.id]: p.required }), {})
  );
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      onConnect(app, permissions);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-3xl shadow-lg`}>
              {app.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Connect {app.name}</h2>
              <p className="text-sm text-slate-400">Select permissions for this integration</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
            <Shield className="w-4 h-4" />
            <span>Choose what this app can access</span>
          </div>
          {app.permissions.map((perm) => (
            <PermissionToggle
              key={perm.id}
              permission={perm}
              enabled={permissions[perm.id]}
              onChange={(val) => setPermissions({ ...permissions, [perm.id]: val })}
              disabled={perm.required}
            />
          ))}
        </div>

        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Authorize & Connect
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageModal({ app, connections, onClose, onDisconnect, onUpdatePermissions }:{app: typeof availableApps[0] }) {
  console.log(connections)
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>(connections);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-3xl shadow-lg`}>
              {app.icon}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{app.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 text-sm text-emerald-400">
                  <Check className="w-3.5 h-3.5" /> Connected
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  <Clock className="w-3.5 h-3.5" /> {/*  {connection.connectedAt} */}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between text-sm mb-4">
            <span className="text-slate-400 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Permissions
            </span>
            <span className="text-slate-500">
              {Object.values(permissions).filter(Boolean).length} of {app.permissions.length} enabled
            </span>
          </div>
          {app.permissions.map((perm) => (
            <PermissionToggle
              key={perm.id}
              permission={perm}
              enabled={permissions[perm.id]}
              onChange={(val) => setPermissions({ ...permissions, [perm.id]: val })}
              disabled={perm?.required}
            />
          ))}
        </div>

        <div className="p-6 border-t border-white/10 space-y-3">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => { onUpdatePermissions(app, permissions); onClose(); }}
              className="flex-1 px-4 py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all"
            >
              Save Changes
            </button>
          </div>
          <button
            onClick={() => { onDisconnect(app.id); onClose(); }}
            className="w-full px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Disconnect App
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppsIntegrations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [connectModal, setConnectModal] = useState(null);
  const [manageModal, setManageModal] = useState(null);
  

  const categories = ['All', ...new Set(availableApps.map(a => a.category))];

  

  const [connectedApps, setConnectedApps] = useState<typeof availableApps>([]);
  const [availableToConnect, setAvailableToConnect] = useState<typeof availableApps>([]);
  const [myPermissions, setMyPermissions] = useState<Record<string, Record<string,string>>>({});
  const filteredApps = availableApps
    .filter(a => selectedCategory === 'All' || a.category === selectedCategory)
    .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  useEffect(() => {
    
    // eslint-disable-next-line
  }, [searchQuery]);

  const handleConnect = (appId, permissions) => {
    setConnections({ ...connections, [appId]: { permissions, connectedAt: 'Just now' } });
  };

  const handleDisconnect = (appId:string) => {
    axios.post(`${SERVER_URL}/integrations/${appId}`, {
      app_id: appId,
      permissions: [],
      action: 'disconnect'
    },{withCredentials:true}).then(response => {
      
      // Optionally update local state if needed
      // setConnections({ ...connections, [appId]: { ...connections[appId], permissions } });
    }).catch(error => {
      console.error('Failed to update app permissions', error);
    });
  };

  const handleUpdatePermissions = (app:typeof availableApps[0], permissions:Record<string,string>) => {
    console.log(Object.keys(permissions))
    // INSERT_YOUR_CODE
    axios.post(`${SERVER_URL}/integrations/${app.type || app.id}`, {
      app_id: app.id,
      permissions: Object.keys(permissions),
      action: 'connect'
    },{withCredentials:true}).then(response => {
      window.location.href = response.data.url
      // Optionally update local state if needed
      // setConnections({ ...connections, [appId]: { ...connections[appId], permissions } });
    }).catch(error => {
      console.error('Failed to update app permissions', error);
    });
    // setConnections({ ...connections, [appId]: { ...connections[appId], permissions } });
  };

  // Fetch user's connected apps from the server using axios
  async function fetchApps() {
    try {
      // Replace with actual backend route if needed
      const response = await axios.get(`${SERVER_URL}/integrations/apps`,{withCredentials:true}); // or '/apps' if proxied
      // Expected response structure: { apps: [{ app_id, permissions }] }
      let myApps:[] = response.data.apps
      // Get apps where app_id exists
      // const filteredApps:[] = apps.filter((app: { app_id?: string }) => app.app_id);
      // n^2
      const connectedApps: typeof availableApps = [];
      const otherApps: typeof availableApps = [];
      let perms = {}
      myApps.forEach((app)=>{
        perms[app.app_id] = (app.permissions || []).reduce((acc, id) => {
          acc[id] = true;
          return acc;
        }, {});
      })
      availableApps.forEach(app => {
        if (myApps.some(a => a.app_id === app.id)) {
          connectedApps.push(app);
        } else {
          otherApps.push(app);
        }
      });
      setMyPermissions(perms)
      setConnectedApps(connectedApps)
      setAvailableToConnect(otherApps)
      
      
    } catch (error) {
      // Optional: handle error
      console.error('Failed to fetch connected apps', error);
    }
  }

  useEffect(() => {
    

    fetchApps();
    // Optionally, only run on mount
    // eslint-disable-next-line
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Apps & Integrations
          </h1>
          <p className="text-slate-500 mt-1">Connect your favorite apps to enhance your transcripts</p>
        </header>

        {/* Search & Filters */}
        <div className="flex gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search apps..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm transition-all ${
                  selectedCategory === cat
                    ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Connected Apps */}
        {connectedApps.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-400" />
              Connected ({connectedApps.length})
            </h2>
            <div className="space-y-3">
              {connectedApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  isConnected={true}
                  onManage={() => setManageModal(app)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Available Apps */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-slate-400" />
            Available Apps ({availableToConnect.length})
          </h2>
          <div className="space-y-3">
            {availableToConnect.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                isConnected={false}
                onConnect={() => setConnectModal(app)}
              />
            ))}
          </div>
        </section>

        {filteredApps.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <Search className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-slate-400">No apps found</h3>
            <p className="text-slate-600 mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {connectModal && (
        <ConnectModal
          app={connectModal}
          onClose={() => setConnectModal(null)}
          onConnect={handleUpdatePermissions}

        />
      )}
      {manageModal && (
        <ManageModal
          app={manageModal}
          connections={myPermissions[manageModal.id]}
          onClose={() => setManageModal(null)}
          onDisconnect={handleDisconnect}
          onUpdatePermissions={handleUpdatePermissions}
        />
      )}
    </div>
  );
}