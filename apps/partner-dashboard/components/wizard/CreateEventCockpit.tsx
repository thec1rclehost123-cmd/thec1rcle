import React from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Calendar, MapPin, Ticket, 
  Settings, ChevronRight, Save, Eye 
} from 'lucide-react';

/**
 * THE C1RCLE - Create Event Cockpit
 * A single-frame, zero-scroll interface for rapid event configuration.
 */
export const CreateEventCockpit = () => {
  return (
    <div className="h-screen w-full bg-[var(--bg-base)] text-[var(--text-primary)] p-10 overflow-hidden flex flex-col font-display">
      
      {/* 1. Header Area - High Visual Clarity */}
      <header className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-[40px] font-black uppercase tracking-tight leading-none bg-gradient-to-r from-text-primary to-text-tertiary bg-clip-text text-transparent">
            Create Event
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-c1rcle-orange animate-pulse" />
            <p className="text-[14px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
              Drafting Mode <span className="text-[var(--text-quaternary)] ml-1">• Auto-saved 2m ago</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Progress Indicator - Compact */}
           <div className="flex gap-1.5">
             {[1, 2, 3, 4, 5].map((i) => (
               <div key={i} className={`h-1.5 w-6 rounded-full ${i <= 3 ? 'bg-c1rcle-orange' : 'bg-[var(--bg-secondary)]'}`} />
             ))}
           </div>
        </div>
      </header>

      {/* 2. Main Cockpit Grid - 3 Columns, Single Frame */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
        
        {/* Column 1: Core Identity */}
        <div className="flex flex-col gap-8 min-h-0">
          {/* Event Basics Module */}
          <CockpitModule title="Event Basics" icon={Sparkles} color="orange">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[18px] font-semibold text-[var(--text-tertiary)]">Event Name</label>
                <input 
                  type="text" 
                  placeholder="Give your event a memorable name"
                  className="w-full bg-transparent border-b-2 border-[var(--border-subtle)] focus:border-c1rcle-orange text-[18px] py-2 transition-colors outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[18px] font-semibold text-[var(--text-tertiary)]">Event Type</label>
                <select className="w-full bg-[var(--bg-secondary)]/30 rounded-2xl p-4 text-[18px] outline-none border border-[var(--border-subtle)] appearance-none cursor-pointer">
                  <option>Music</option>
                  <option>Nightlife</option>
                  <option>Workshop</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[18px] font-semibold text-[var(--text-tertiary)]">Description</label>
                <textarea 
                  placeholder="Tell your story..."
                  className="w-full bg-[var(--bg-secondary)]/30 rounded-2xl p-4 text-[18px] min-h-[100px] border border-[var(--border-subtle)] outline-none"
                />
              </div>
            </div>
          </CockpitModule>

          {/* Venue Module */}
          <CockpitModule title="Venue Information" icon={MapPin} color="orange">
             <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-[var(--bg-secondary)]/50 border border-c1rcle-orange/20 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-c1rcle-orange/10 flex items-center justify-center">
                    <MapPin className="text-c1rcle-orange w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-[18px] font-bold">Epitome, Pune</h4>
                    <p className="text-[14px] text-[var(--text-tertiary)]">Your primary venue is auto-linked.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[18px] font-semibold text-[var(--text-tertiary)]">Detailed Location</label>
                  <input 
                    type="text" 
                    placeholder="E.g. Table 12, Main Bar"
                    className="w-full bg-transparent border-b-2 border-[var(--border-subtle)] text-[18px] py-2 outline-none"
                  />
                </div>
             </div>
          </CockpitModule>
        </div>

        {/* Column 2: Logistics & Governance */}
        <div className="flex flex-col gap-8 min-h-0">
          {/* Date and Time Module */}
          <CockpitModule title="Date and Time" icon={Calendar} color="orange">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[18px] font-semibold text-[var(--text-tertiary)]">Start Date</label>
                  <input type="date" className="w-full bg-[var(--bg-secondary)]/30 rounded-2xl p-4 text-[18px] border border-[var(--border-subtle)] outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[18px] font-semibold text-[var(--text-tertiary)]">Start Time</label>
                    <input type="time" className="w-full bg-[var(--bg-secondary)]/30 rounded-2xl p-4 text-[18px] border border-[var(--border-subtle)] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[18px] font-semibold text-[var(--text-tertiary)]">End Time</label>
                    <input type="time" className="w-full bg-[var(--bg-secondary)]/30 rounded-2xl p-4 text-[18px] border border-[var(--border-subtle)] outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </CockpitModule>

          {/* Visibility Controls Module */}
          <CockpitModule title="Visibility and Controls" icon={Settings} color="orange">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-secondary)]/20">
                <div>
                  <h5 className="text-[18px] font-bold">Public Visibility</h5>
                  <p className="text-[14px] text-[var(--text-quaternary)]">Visible to everyone in C1RCLE</p>
                </div>
                <div className="w-12 h-6 rounded-full bg-c1rcle-orange relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[18px] font-semibold text-[var(--text-tertiary)]">Age Restriction</label>
                <div className="flex gap-2">
                  {['None', '18+', '21+'].map((age) => (
                    <button key={age} className={`flex-1 py-3 px-4 rounded-xl text-[16px] font-bold border transition-all ${age === '21+' ? 'bg-c1rcle-orange border-c1rcle-orange text-white' : 'bg-[var(--bg-secondary)]/30 border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-text-placeholder'}`}>
                      {age}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CockpitModule>
        </div>

        {/* Column 3: Tickets & Preview */}
        <div className="flex flex-col gap-8 min-h-0">
          {/* Tickets & Entry Module */}
          <CockpitModule title="Tickets and Entry" icon={Ticket} color="orange">
            <div className="space-y-6">
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                 <div className="p-4 rounded-[24px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between transition-all hover:bg-indigo-500/20">
                    <div>
                      <p className="text-[16px] font-bold">General Admission</p>
                      <p className="text-[13px] text-[var(--text-tertiary)] font-medium">400 tickets available</p>
                    </div>
                    <span className="text-[20px] font-black text-indigo-400">₹500</span>
                 </div>
                 <button className="w-full py-4 rounded-[24px] border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-quaternary)] font-bold hover:border-c1rcle-orange hover:text-c1rcle-orange transition-all">
                    + Add Ticket Tier
                 </button>
              </div>
              
              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="text-[16px] font-bold text-[var(--text-tertiary)]">Total Capacity</p>
                  <p className="text-[20px] font-black uppercase tracking-tight">400 Guests</p>
                </div>
                <div className="text-right">
                  <p className="text-[16px] font-bold text-[var(--text-tertiary)]">Est. Revenue</p>
                  <p className="text-[20px] font-black uppercase tracking-tight text-c1rcle-orange">₹2,00,000</p>
                </div>
              </div>
            </div>
          </CockpitModule>

          {/* Action Module / Preview */}
          <div className="flex-1 flex flex-col justify-end gap-4 pb-2">
             <div className="group relative w-full aspect-[4/3] rounded-[32px] overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-subtle)] cursor-pointer transition-transform hover:scale-[0.98]">
                <div className="absolute inset-0 bg-gradient-to-br from-c1rcle-orange/20 to-indigo-500/20 mix-blend-overlay group-hover:opacity-60 transition-opacity" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Eye className="w-8 h-8 text-[var(--text-tertiary)] group-hover:text-c1rcle-orange transition-colors" />
                  <span className="text-[14px] font-black uppercase tracking-widest text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]">Preview Event Page</span>
                </div>
             </div>
          </div>
        </div>

      </main>

      {/* 3. Footer Control Bar - Fixed at Bottom */}
      <footer className="mt-10 flex items-center justify-between pt-8 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-10">
           <button className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              <Save className="w-5 h-5" />
              <span className="text-[18px] font-bold uppercase tracking-wider">Save Draft</span>
           </button>
           <div className="h-6 w-px bg-border-subtle" />
           <p className="text-[14px] font-medium text-[var(--text-quaternary)]">
              Review carefully. All fields correctly validated.
           </p>
        </div>

        <button className="group relative px-10 py-5 bg-c1rcle-orange rounded-[24px] overflow-hidden shadow-2xl shadow-c1rcle-orange/30 hover:scale-[1.05] active:scale-95 transition-all outline-none">
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <div className="relative flex items-center gap-3">
            <span className="text-[20px] font-black uppercase tracking-widest text-white">Create Event</span>
            <ChevronRight className="w-6 h-6 text-white" />
          </div>
        </button>
      </footer>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(244, 74, 34, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(244, 74, 34, 0.4);
        }
      `}</style>
    </div>
  );
};

interface CockpitModuleProps {
  title: string;
  icon: any;
  children: React.ReactNode;
  color?: 'orange' | 'indigo';
}

const CockpitModule = ({ 
  title, 
  icon: Icon, 
  children,
  color = 'orange'
}: CockpitModuleProps) => {
  return (
    <div className="bg-[var(--bg-fill)]/40 backdrop-blur-xl border border-[var(--border-subtle)]/50 rounded-[32px] p-6 flex flex-col gap-6 shadow-xl shadow-black/10 transition-all hover:bg-[var(--bg-fill)]/50">
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-xl ${color === 'orange' ? 'bg-c1rcle-orange/10 text-c1rcle-orange' : 'bg-indigo-500/10 text-indigo-400'}`}>
          <Icon className="w-6 h-6" />
        </div>
        <h2 className="text-[24px] font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
};
