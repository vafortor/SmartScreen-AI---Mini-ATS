
import React from 'react';
import { LayoutDashboard, Briefcase, Users, Settings, Sparkles, ChevronRight, Zap, CreditCard, LogOut, PencilRuler } from 'lucide-react';
import { View, UserTier, TrialInfo } from '../types';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onSignOut: () => void;
  tier: UserTier;
  trial: TrialInfo;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onSignOut, tier, trial }) => {
  const menuItems = [
    { id: 'dashboard' as View, icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { id: 'resume-builder' as View, icon: <PencilRuler size={20} />, label: 'Resume Builder', tag: 'Free' },
    { id: 'jobs' as View, icon: <Briefcase size={20} />, label: 'Job Listings' },
    { id: 'candidates' as View, icon: <Users size={20} />, label: 'Talent Pool' },
  ];

  return (
    <div className="w-64 h-screen bg-[#0f172a] text-slate-400 flex flex-col fixed left-0 top-0 border-r border-slate-800/50 shadow-2xl z-30">
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles className="text-white" size={22} fill="white" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight leading-none">SmartScreen</h1>
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
            {tier === 'pro' ? 'Enterprise Pro' : 'Free Trial'}
          </span>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="h-px bg-slate-800/50 w-full"></div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentView === item.id || (item.id === 'jobs' && currentView === 'job-detail');
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-500/10' 
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} transition-colors`}>
                  {item.icon}
                </span>
                <span className="font-semibold text-sm tracking-wide">{item.label}</span>
              </div>
              {item.tag ? (
                <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter border border-emerald-500/30">
                  {item.tag}
                </span>
              ) : isActive && <ChevronRight size={14} className="text-blue-200" />}
            </button>
          );
        })}
      </nav>

      <div className="p-4 mt-auto space-y-1">
        {tier === 'free' && (
          <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20 mb-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 mb-2 text-indigo-400">
              <Zap size={14} fill="currentColor" />
              <p className="text-[10px] font-black uppercase tracking-widest">Trial Ending Soon</p>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                style={{ width: `${(trial.daysRemaining / 7) * 100}%` }}
              ></div>
            </div>
            <p className="text-[11px] mt-2 text-slate-400 font-medium">
              {trial.daysRemaining} {trial.daysRemaining === 1 ? 'day' : 'days'} remaining
            </p>
            <button 
              onClick={() => onViewChange('billing')}
              className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              Upgrade to Pro
            </button>
          </div>
        )}
        
        <button 
          onClick={() => onViewChange('billing')}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold text-sm ${
            currentView === 'billing' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <CreditCard size={20} />
          <span>Subscription</span>
        </button>
        <button 
          onClick={() => onViewChange('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold text-sm ${
            currentView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <button 
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold text-sm text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
