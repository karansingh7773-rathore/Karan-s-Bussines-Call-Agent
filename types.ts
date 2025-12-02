export interface BusinessContext {
  rawText: string;
  sourceFiles: string[];
}

export interface AgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
  voiceName: string; // 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'
  pitch: number; // -10 to 10, abstract scale
  speed: number; // 0.5 to 2.0, multiplier
}

export interface CallLog {
  id: string;
  timestamp: Date;
  summary: string;
  notes: string[];
  transcription: { speaker: 'user' | 'agent'; text: string }[];
}

export interface CalendarEvent {
  title: string;
  startTime: string;
  endTime: string;
  description: string;
}

export enum AgentStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  LISTENING = 'LISTENING',
  SPEAKING = 'SPEAKING',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export interface ToolCall {
  name: string;
  args: any;
  id: string;
}