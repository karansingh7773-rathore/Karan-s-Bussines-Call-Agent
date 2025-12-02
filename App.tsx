import React, { useState, useRef, useEffect } from 'react';
import KnowledgeBase from './components/KnowledgeBase';
import Visualizer from './components/Visualizer';
import { AgentConfig, CalendarEvent, AgentStatus } from './types';
import { LiveClient, LiveStatus } from './services/liveClient';

const DEFAULT_SYSTEM_PROMPT = "You are a friendly front-desk receptionist for 'Nexus Solutions'. You can answer questions about our services (IT Support, Cloud Migration), schedule consultation calls, and take messages. Be professional but warm.";

const App: React.FC = () => {
  // Config State
  const [config, setConfig] = useState<AgentConfig>({
    name: "Nexus Agent",
    role: "Receptionist",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    voiceName: "Zephyr"
  });
  const [businessContext, setBusinessContext] = useState<string>("");

  // Live Session State
  const [status, setStatus] = useState<LiveStatus>('disconnected');
  const [amplitude, setAmplitude] = useState(0);
  const [transcripts, setTranscripts] = useState<{ speaker: 'user' | 'agent', text: string }[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  
  // Refs
  const liveClientRef = useRef<LiveClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const toggleSession = async () => {
    if (status === 'connected' || status === 'connecting') {
      liveClientRef.current?.disconnect();
      setStatus('disconnected');
      setAmplitude(0);
    } else {
      setTranscripts([]);
      const client = new LiveClient(config, businessContext, {
        onStatusChange: setStatus,
        onAudioData: setAmplitude,
        onTranscript: (text, speaker) => {
          setTranscripts(prev => [...prev, { speaker, text }]);
        },
        onNoteTaken: (note) => {
          setNotes(prev => [...prev, note]);
        },
        onCalendarEvent: (event) => {
          setCalendarEvents(prev => [...prev, event]);
        }
      });
      liveClientRef.current = client;
      await client.connect();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col md:flex-row overflow-hidden">
      
      {/* Left Panel: Configuration */}
      <div className="w-full md:w-1/3 border-r border-slate-800 p-6 overflow-y-auto h-screen">
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
                VAPI Clone
            </h1>
            <p className="text-slate-400 text-sm">Configure your AI Voice Agent.</p>
        </div>

        <div className="space-y-6">
            {/* Identity Settings */}
            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <h2 className="font-semibold text-white">Agent Identity</h2>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Agent Name</label>
                    <input 
                        type="text" 
                        value={config.name}
                        onChange={e => setConfig({...config, name: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                    />
                </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Voice</label>
                    <select 
                        value={config.voiceName}
                        onChange={e => setConfig({...config, voiceName: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                    >
                        <option value="Zephyr">Zephyr (Deep, Calm)</option>
                        <option value="Puck">Puck (Energetic)</option>
                        <option value="Kore">Kore (Warm)</option>
                        <option value="Fenrir">Fenrir (Deep, Authority)</option>
                        <option value="Charon">Charon (Professional)</option>
                    </select>
                </div>
            </div>

            {/* Prompt Config */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">System Prompt</label>
                <textarea
                    value={config.systemPrompt}
                    onChange={e => setConfig({...config, systemPrompt: e.target.value})}
                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Define how the agent should behave..."
                />
            </div>

            {/* Knowledge Base */}
            <KnowledgeBase 
                currentContext={businessContext}
                onContextUpdate={setBusinessContext}
            />
        </div>
      </div>

      {/* Right Panel: Live Session */}
      <div className="flex-1 flex flex-col h-screen relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/95 backdrop-blur z-10">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-medium text-slate-200 uppercase tracking-wider text-xs">
                    {status === 'connected' ? 'Live Session Active' : status === 'connecting' ? 'Connecting...' : 'Agent Offline'}
                </span>
            </div>
            <button
                onClick={toggleSession}
                className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                    status === 'connected' || status === 'connecting'
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/50'
                        : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25'
                }`}
            >
                {status === 'connected' || status === 'connecting' ? 'End Call' : 'Start Call'}
            </button>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
            
            {/* Visualizer & Status */}
            <div className="flex flex-col items-center justify-center min-h-[200px] bg-slate-800/30 rounded-2xl border border-slate-800 p-8 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
                 
                 <div className="w-full max-w-lg mb-6">
                    <Visualizer amplitude={amplitude} isActive={status === 'connected'} />
                 </div>

                 <p className="text-slate-500 text-sm font-mono">
                    {status === 'connected' ? "Listening for audio..." : "Press 'Start Call' to begin"}
                 </p>
            </div>

            {/* Split View: Transcript & Tools */}
            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                
                {/* Transcript */}
                <div className="flex-1 bg-slate-800/30 rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                        <h3 className="text-sm font-semibold text-slate-300">Live Transcript</h3>
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                        {transcripts.length === 0 && (
                            <div className="text-center text-slate-600 mt-10 italic text-sm">Conversation will appear here...</div>
                        )}
                        {transcripts.map((t, i) => (
                            <div key={i} className={`flex ${t.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                    t.speaker === 'agent' 
                                        ? 'bg-slate-700/50 text-slate-200 rounded-tl-sm' 
                                        : 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30 rounded-tr-sm'
                                }`}>
                                    <span className="block text-xs opacity-50 mb-1 font-bold">{t.speaker === 'agent' ? config.name : 'User'}</span>
                                    {t.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tools Output */}
                <div className="w-80 flex flex-col gap-4">
                    
                    {/* Notes Panel */}
                    <div className="flex-1 bg-slate-800/30 rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-300">Captured Notes</h3>
                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{notes.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {notes.length === 0 && <p className="text-xs text-slate-600">Agent has not taken any notes yet.</p>}
                            {notes.map((note, i) => (
                                <div key={i} className="bg-yellow-900/10 border border-yellow-700/30 p-3 rounded-lg">
                                    <p className="text-xs text-yellow-200/90">{note}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calendar Panel */}
                    <div className="flex-1 bg-slate-800/30 rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
                         <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-300">Scheduled Events</h3>
                             <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{calendarEvents.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                             {calendarEvents.length === 0 && <p className="text-xs text-slate-600">No appointments scheduled.</p>}
                             {calendarEvents.map((event, i) => (
                                <div key={i} className="bg-emerald-900/10 border border-emerald-700/30 p-3 rounded-lg space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-xs font-bold text-emerald-300">{event.title}</h4>
                                    </div>
                                    <p className="text-[10px] text-emerald-400 font-mono">
                                        {event.startTime}
                                    </p>
                                    {event.description && <p className="text-[10px] text-slate-400">{event.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>

      </div>
    </div>
  );
};

export default App;