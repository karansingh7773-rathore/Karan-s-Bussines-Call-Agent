import React, { useState, useRef, useEffect } from 'react';
import KnowledgeBase from './components/KnowledgeBase';
import Visualizer from './components/Visualizer';
import { AgentConfig, CalendarEvent, AgentStatus } from './types';
import { LiveClient, LiveStatus } from './services/liveClient';
import { generateSessionSummary } from './services/geminiService';

const DEFAULT_SYSTEM_PROMPT = "You are a friendly front-desk receptionist for 'Nexus Solutions'. You can answer questions about our services (IT Support, Cloud Migration), schedule consultation calls, and take messages. Be professional but warm.";

const App: React.FC = () => {
  // Config State
  const [config, setConfig] = useState<AgentConfig>({
    name: "Nexus Agent",
    role: "Receptionist",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    voiceName: "Zephyr",
    pitch: 0,
    speed: 1.0
  });
  const [businessContext, setBusinessContext] = useState<string>("");

  // Live Session State
  const [status, setStatus] = useState<LiveStatus>('disconnected');
  const [amplitude, setAmplitude] = useState(0);
  const [transcripts, setTranscripts] = useState<{ speaker: 'user' | 'agent', text: string }[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  
  // Post-Call State
  const [summary, setSummary] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isProcessingSummary, setIsProcessingSummary] = useState(false);

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
      // Disconnect
      if (liveClientRef.current) {
          liveClientRef.current.disconnect();
          const blob = await liveClientRef.current.getRecording();
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob);
            setRecordingUrl(url);
          }
      }
      setStatus('disconnected');
      setAmplitude(0);
      
      // Generate Summary
      setIsProcessingSummary(true);
      const sum = await generateSessionSummary(transcripts);
      setSummary(sum);
      setIsProcessingSummary(false);

    } else {
      // Connect
      setTranscripts([]);
      setNotes([]);
      setCalendarEvents([]);
      setSummary(null);
      setRecordingUrl(null);
      
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
    <div className="min-h-screen bg-black text-neutral-200 flex flex-col md:flex-row overflow-hidden font-sans selection:bg-white selection:text-black">
      
      {/* Left Panel: Configuration */}
      <div className="w-full md:w-1/3 border-r border-neutral-800 p-6 overflow-y-auto h-screen custom-scrollbar bg-neutral-950">
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                VAPI Clone
            </h1>
            <p className="text-neutral-500 text-sm">Configure your AI Voice Agent.</p>
        </div>

        <div className="space-y-6">
            {/* Identity Settings */}
            <div className="space-y-4 bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                <h2 className="font-semibold text-white">Agent Identity</h2>
                <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Agent Name</label>
                    <input 
                        type="text" 
                        value={config.name}
                        onChange={e => setConfig({...config, name: e.target.value})}
                        className="w-full bg-black border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-white outline-none transition-colors"
                    />
                </div>
                 <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Voice</label>
                    <select 
                        value={config.voiceName}
                        onChange={e => setConfig({...config, voiceName: e.target.value})}
                        className="w-full bg-black border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-white outline-none transition-colors"
                    >
                        <optgroup label="Masculine / Deep">
                          <option value="Zephyr">Zephyr (Balanced)</option>
                          <option value="Orpheus">Orpheus (Confident)</option>
                          <option value="Charon">Charon (Professional)</option>
                          <option value="Fenrir">Fenrir (Deep, Authority)</option>
                          <option value="Puck">Puck (Energetic)</option>
                        </optgroup>
                        <optgroup label="Feminine / High">
                          <option value="Aoede">Aoede (Expressive)</option>
                          <option value="Kore">Kore (Warm)</option>
                          <option value="Leda">Leda (Calm)</option>
                          <option value="Pegasus">Pegasus (Engaged)</option>
                          <option value="Thalia">Thalia (Soft)</option>
                        </optgroup>
                    </select>
                </div>
                
                {/* Advanced Voice Settings */}
                <div className="pt-4 border-t border-neutral-800 mt-2">
                    <h3 className="text-xs font-bold text-neutral-500 mb-3 uppercase tracking-wider">Advanced Voice</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-xs font-medium text-neutral-400 mb-1 flex justify-between">
                                Speed <span className="text-white">{config.speed}x</span>
                             </label>
                             <input 
                                type="range" 
                                min="0.5" 
                                max="2.0" 
                                step="0.1"
                                value={config.speed}
                                onChange={e => setConfig({...config, speed: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-neutral-400 mb-1 flex justify-between">
                                Pitch <span className="text-white">{config.pitch}</span>
                             </label>
                             <input 
                                type="range" 
                                min="-10" 
                                max="10" 
                                step="1"
                                value={config.pitch}
                                onChange={e => setConfig({...config, pitch: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
                             />
                        </div>
                    </div>
                </div>
            </div>

            {/* Prompt Config */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-300">System Prompt</label>
                <textarea
                    value={config.systemPrompt}
                    onChange={e => setConfig({...config, systemPrompt: e.target.value})}
                    className="w-full h-32 bg-black border border-neutral-800 rounded-lg p-3 text-sm text-white focus:border-white focus:outline-none transition-colors"
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
      <div className="flex-1 flex flex-col h-screen relative bg-black">
        {/* Header */}
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-8 bg-black z-10">
            <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                    status === 'connected' 
                        ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]' 
                        : status === 'connecting' 
                            ? 'bg-neutral-500 animate-pulse' 
                            : 'bg-neutral-800'
                }`} />
                <span className="font-medium text-neutral-300 uppercase tracking-widest text-xs">
                    {status === 'connected' ? 'Live Session Active' : status === 'connecting' ? 'Connecting...' : 'Agent Offline'}
                </span>
            </div>
            <button
                onClick={toggleSession}
                className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 text-sm tracking-wide ${
                    status === 'connected' || status === 'connecting'
                        ? 'bg-transparent text-red-500 border border-red-900/50 hover:bg-red-950/30'
                        : 'bg-white text-black hover:bg-neutral-200 hover:scale-105 shadow-lg shadow-white/10'
                }`}
            >
                {status === 'connected' || status === 'connecting' ? 'End Call' : 'Start Call'}
            </button>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6 relative">
            
            {/* Visualizer & Status */}
            <div className="flex flex-col items-center justify-center min-h-[200px] bg-neutral-900/50 rounded-2xl border border-neutral-800 p-8 relative overflow-hidden group">
                 <div className="w-full max-w-lg mb-6 z-10">
                    <Visualizer amplitude={amplitude} isActive={status === 'connected'} />
                 </div>

                 <p className="text-neutral-500 text-xs font-mono tracking-widest uppercase z-10">
                    {status === 'connected' ? "Listening..." : "Ready to connect"}
                 </p>
                 
                 {/* Subtle Glow Background */}
                 {status === 'connected' && (
                     <div className="absolute inset-0 bg-white/5 blur-3xl rounded-full transform scale-150 animate-pulse pointer-events-none"></div>
                 )}
            </div>

            {/* Split View: Transcript & Tools */}
            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                
                {/* Transcript */}
                <div className="flex-1 bg-neutral-900/30 rounded-2xl border border-neutral-800 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-neutral-800 bg-neutral-900/50">
                        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Live Transcript</h3>
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {transcripts.length === 0 && (
                            <div className="text-center text-neutral-700 mt-10 italic text-sm">Conversation will appear here...</div>
                        )}
                        {transcripts.map((t, i) => (
                            <div key={i} className={`flex ${t.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                                    t.speaker === 'agent' 
                                        ? 'bg-neutral-800 text-neutral-200 rounded-tl-sm border border-neutral-700' 
                                        : 'bg-white text-black rounded-tr-sm'
                                }`}>
                                    <span className={`block text-[10px] uppercase tracking-wider font-bold mb-1 opacity-50 ${t.speaker === 'agent' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                        {t.speaker === 'agent' ? config.name : 'User'}
                                    </span>
                                    {t.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tools Output */}
                <div className="w-80 flex flex-col gap-4">
                    
                    {/* Notes Panel */}
                    <div className="flex-1 bg-neutral-900/30 rounded-2xl border border-neutral-800 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Notes</h3>
                            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full border border-neutral-700">{notes.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {notes.length === 0 && <p className="text-xs text-neutral-600">No notes yet.</p>}
                            {notes.map((note, i) => (
                                <div key={i} className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
                                    <p className="text-xs text-neutral-300">{note}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calendar Panel */}
                    <div className="flex-1 bg-neutral-900/30 rounded-2xl border border-neutral-800 flex flex-col overflow-hidden">
                         <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Events</h3>
                             <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full border border-neutral-700">{calendarEvents.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                             {calendarEvents.length === 0 && <p className="text-xs text-neutral-600">No events.</p>}
                             {calendarEvents.map((event, i) => (
                                <div key={i} className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-xs font-bold text-white">{event.title}</h4>
                                    </div>
                                    <p className="text-[10px] text-neutral-400 font-mono">
                                        {event.startTime}
                                    </p>
                                    {event.description && <p className="text-[10px] text-neutral-500">{event.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* Post-Call Summary Modal */}
            {(summary || isProcessingSummary) && status === 'disconnected' && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white tracking-tight">Call Summary</h2>
                            <button onClick={() => setSummary(null)} className="text-neutral-500 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {isProcessingSummary ? (
                             <div className="flex flex-col items-center py-8">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4"></div>
                                <p className="text-neutral-400 text-sm">Analyzing conversation...</p>
                             </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-black border border-neutral-800 p-4 rounded-lg text-sm text-neutral-300 leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                                    {summary}
                                </div>
                                <div className="flex gap-3 pt-2">
                                    {recordingUrl && (
                                        <a 
                                            href={recordingUrl} 
                                            download={`call-recording-${new Date().toISOString()}.webm`}
                                            className="flex-1 flex justify-center items-center gap-2 bg-white hover:bg-neutral-200 text-black py-2 rounded-lg font-medium text-sm transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Recording
                                        </a>
                                    )}
                                    <button 
                                        onClick={() => setSummary(null)}
                                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>

      </div>
    </div>
  );
};

export default App;