import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decodeAudioData, PCM_SAMPLE_RATE, PLAYBACK_SAMPLE_RATE, base64ToUint8Array } from './audioUtils';
import { AgentConfig, CalendarEvent } from '../types';

export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface LiveClientCallbacks {
  onStatusChange: (status: LiveStatus) => void;
  onAudioData: (amplitude: number) => void;
  onTranscript: (text: string, speaker: 'user' | 'agent', isFinal: boolean) => void;
  onNoteTaken: (note: string) => void;
  onCalendarEvent: (event: CalendarEvent) => void;
}

export class LiveClient {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  
  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private audioChunks: Blob[] = [];

  private nextStartTime: number = 0;
  private callbacks: LiveClientCallbacks;
  private config: AgentConfig;
  private businessContext: string;

  constructor(config: AgentConfig, businessContext: string, callbacks: LiveClientCallbacks) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    this.config = config;
    this.businessContext = businessContext;
    this.callbacks = callbacks;
  }

  public async connect() {
    this.callbacks.onStatusChange('connecting');
    this.audioChunks = [];

    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PLAYBACK_SAMPLE_RATE });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup Recording: Route Mic -> RecordingDest (in output context)
      // We need to create a source for the mic in the output context to mix it for recording
      // without playing it to destination (to avoid feedback).
      if (this.outputAudioContext) {
        this.recordingDestination = this.outputAudioContext.createMediaStreamDestination();
        const micStreamForRecord = this.outputAudioContext.createMediaStreamSource(stream);
        micStreamForRecord.connect(this.recordingDestination);
        
        this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream);
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };
        this.mediaRecorder.start();
      }

      // Define tools including Google Search
      const tools: any[] = [
        { googleSearch: {} },
        { googleMaps: {} },
        {
           functionDeclarations: [
             {
               name: 'scheduleAppointment',
               description: 'Schedule an appointment or meeting for the user.',
               parameters: {
                 type: Type.OBJECT,
                 properties: {
                   title: { type: Type.STRING, description: 'Title of the appointment' },
                   startTime: { type: Type.STRING, description: 'Start time (ISO 8601 or descriptive)' },
                   endTime: { type: Type.STRING, description: 'End time (ISO 8601 or descriptive)' },
                   description: { type: Type.STRING, description: 'Details about the appointment' },
                 },
                 required: ['title', 'startTime'],
               },
             },
             {
               name: 'takeNote',
               description: 'Take a note of important information from the call.',
               parameters: {
                 type: Type.OBJECT,
                 properties: {
                   content: { type: Type.STRING, description: 'The content of the note' },
                 },
                 required: ['content'],
               },
             }
           ]
        }
      ];

      // Construct dynamic system instructions for voice settings
      const speedDesc = this.config.speed < 1 ? "slow and steady" : this.config.speed > 1 ? "fast and energetic" : "natural";
      const pitchDesc = this.config.pitch < 0 ? "deeper" : this.config.pitch > 0 ? "higher pitched" : "natural";

      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: `
            You are ${this.config.name}, a helpful AI voice assistant.
            Role: ${this.config.role}
            
            System Instructions:
            ${this.config.systemPrompt}
            
            Speaking Style Instructions:
            - Speed: ${speedDesc} (${this.config.speed}x pace)
            - Tone: ${pitchDesc}
            - Maintain this persona consistently.

            Business Knowledge Base:
            ${this.businessContext}

            Behavior:
            - Keep responses concise and conversational.
            - Use a human-like tone.
            - If you need to find information not in the knowledge base, USE THE googleSearch tool.
            - If you need location info, use Google Maps.
            - If the user wants to book something, use scheduleAppointment.
            - Record important details using takeNote.
          `,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.voiceName || 'Zephyr' } },
          },
          tools: tools,
          inputAudioTranscription: {}, 
          outputAudioTranscription: {}, 
        },
        callbacks: {
          onopen: () => {
            this.callbacks.onStatusChange('connected');
            this.startAudioStream(stream);
          },
          onmessage: (msg) => this.handleMessage(msg),
          onclose: () => {
            this.callbacks.onStatusChange('disconnected');
            this.stopAudioStream();
          },
          onerror: (err) => {
            console.error('Live API Error:', err);
            this.callbacks.onStatusChange('error');
          }
        }
      });

      await this.sessionPromise;

    } catch (error) {
      console.error("Connection failed", error);
      this.callbacks.onStatusChange('error');
    }
  }

  private startAudioStream(stream: MediaStream) {
    if (!this.inputAudioContext) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate simple volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.callbacks.onAudioData(rms);

      const blob = createPcmBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then(session => {
          session.sendRealtimeInput({ media: blob });
        });
      }
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private stopAudioStream() {
    // Stop recording
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
  }

  public async getRecording(): Promise<Blob> {
      return new Blob(this.audioChunks, { type: 'audio/webm' });
  }

  private async handleMessage(message: LiveServerMessage) {
    // 1. Handle Tool Calls
    if (message.toolCall) {
        for (const fc of message.toolCall.functionCalls) {
            console.log("Tool call:", fc.name, fc.args);
            let result = { result: "ok" };
            
            if (fc.name === 'takeNote') {
                this.callbacks.onNoteTaken(fc.args.content as string);
                result = { result: "Note saved." };
            } else if (fc.name === 'scheduleAppointment') {
                const event: CalendarEvent = {
                    title: fc.args.title as string,
                    startTime: fc.args.startTime as string,
                    endTime: fc.args.endTime as string || fc.args.startTime as string, // Fallback
                    description: fc.args.description as string || ''
                };
                this.callbacks.onCalendarEvent(event);
                result = { result: "Appointment scheduled." };
            }

            // Send response back
            this.sessionPromise?.then(session => {
                session.sendToolResponse({
                    functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: result
                    }
                });
            });
        }
    }

    // 2. Handle Transcription
    if (message.serverContent?.inputTranscription) {
        this.callbacks.onTranscript(message.serverContent.inputTranscription.text, 'user', true);
    }
    if (message.serverContent?.outputTranscription) {
        this.callbacks.onTranscript(message.serverContent.outputTranscription.text, 'agent', false);
    }

    // 3. Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && this.outputAudioContext) {
        const audioBytes = base64ToUint8Array(audioData);
        // Track next start time for smooth playback
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext);
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to Speakers
        source.connect(this.outputAudioContext.destination);
        
        // Connect to Recorder (if active)
        if (this.recordingDestination) {
            source.connect(this.recordingDestination);
        }

        source.start(this.nextStartTime);
        
        this.nextStartTime += audioBuffer.duration;
    }
  }

  public disconnect() {
    this.sessionPromise?.then(session => {
        if (typeof (session as any).close === 'function') {
            (session as any).close();
        }
    });
    this.stopAudioStream();
    this.callbacks.onStatusChange('disconnected');
  }
}