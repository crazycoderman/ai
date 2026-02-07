import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Zap, Radio, Loader2 } from 'lucide-react';
import { AppSettings, AppTheme, GEMINI_LIVE_MODEL } from '../types';

interface LiveInterfaceProps {
  settings: AppSettings;
}

// --- Audio Utils (Base64 & PCM) ---
function b64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Float32 (Web Audio) to Int16 (PCM for Gemini)
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ settings }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false); // Model is talking
  const [error, setError] = useState<string | null>(null);
  
  // Refs for Audio Handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Playback Queue
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // --- Visualizer Logic ---
  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      // Clear
      ctx.fillStyle = settings.theme === 'classic' ? '#000000' : 
                      settings.theme === 'vaporwave' ? '#2d0a3d' : '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center Line
      const centerY = canvas.height / 2;
      
      // Draw Waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = isTalking 
        ? (settings.theme === 'vaporwave' ? '#ff00ff' : '#00ff00') 
        : (settings.theme === 'classic' ? '#008080' : '#333');
      
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // 0..2
        const y = v * (canvas.height / 2); // Amplitude

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      
      // Add "Live" indicator
      if (isConnected) {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(canvas.width - 20, 20, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "10px monospace";
        ctx.fillText("LIVE", canvas.width - 50, 24);
      }
    };
    draw();
  };

  useEffect(() => {
    // Setup Audio Context for Output & Visualizer
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Setup Analyser
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
    analyser.connect(audioContextRef.current.destination); // Connect to speakers
    
    drawVisualizer();

    return () => {
      disconnect();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioContextRef.current?.close();
    };
  }, []);


  const connect = async () => {
    if (!process.env.API_KEY) {
      setError("Gemini API Key missing in environment (process.env.API_KEY).");
      return;
    }
    setError(null);

    try {
      // 1. Setup Input Audio (Microphone)
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      sourceRef.current = inputContextRef.current.createMediaStreamSource(streamRef.current);
      
      // ScriptProcessor is deprecated but reliable for raw PCM extraction in this context without extra worklet files
      processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);
      
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(inputContextRef.current.destination);

      // 2. Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 3. Connect Live Session
      const sessionPromise = ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setIsConnected(true);
            nextStartTimeRef.current = 0;
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio) {
              setIsTalking(true);
              const ctx = audioContextRef.current!;
              
              // Decode custom base64 -> Uint8 -> Float32 AudioBuffer
              const audioBytes = b64ToUint8Array(base64Audio);
              const dataInt16 = new Int16Array(audioBytes.buffer);
              const float32 = new Float32Array(dataInt16.length);
              
              for(let i=0; i<dataInt16.length; i++) {
                float32[i] = dataInt16[i] / 32768.0;
              }

              const buffer = ctx.createBuffer(1, float32.length, 24000);
              buffer.getChannelData(0).set(float32);

              // Schedule Playback
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(analyserRef.current!); // Connect to analyser (which connects to speakers)
              
              // Gapless playback logic
              const currentTime = ctx.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
              }
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsTalking(false);
              };
            }
          },
          onclose: () => {
            console.log("Gemini Live Closed");
            setIsConnected(false);
            setIsTalking(false);
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setError("Connection Error. Check console.");
            disconnect();
          }
        }
      });

      sessionRef.current = sessionPromise;

      // 4. Stream Input Audio
      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample/Convert to PCM 16-bit
        const pcm16 = floatTo16BitPCM(inputData);
        
        // Send to Gemini
        const base64PCM = arrayBufferToBase64(pcm16.buffer);
        
        sessionPromise.then(session => {
          session.sendRealtimeInput({
            media: {
              mimeType: "audio/pcm;rate=16000",
              data: base64PCM
            }
          });
        });
      };

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start Live session");
      disconnect();
    }
  };

  const disconnect = () => {
    // Stop Microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
    }

    // Close Session
    if (sessionRef.current) {
      // Need to cast because close() is on the resolved session object
      sessionRef.current.then((s: any) => s.close && s.close());
      sessionRef.current = null;
    }
    
    // Stop Playing Audio
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    
    setIsConnected(false);
    setIsTalking(false);
  };

  const getThemeStyles = (theme: AppTheme) => {
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-gray-900',
          text: 'text-gray-200',
          panel: 'bg-gray-800 border-gray-700',
          buttonPrimary: 'bg-green-700 hover:bg-green-600 text-white',
          buttonStop: 'bg-red-700 hover:bg-red-600 text-white',
        };
      case 'vaporwave':
        return {
          bg: 'bg-indigo-950',
          text: 'text-pink-300',
          panel: 'bg-purple-900 border-pink-500',
          buttonPrimary: 'bg-cyan-600 hover:bg-cyan-500 text-white border-pink-300',
          buttonStop: 'bg-pink-600 hover:bg-pink-500 text-white border-cyan-300',
        };
      default: // classic
        return {
          bg: 'bg-win98-gray',
          text: 'text-black',
          panel: 'bg-white border-gray-500',
          buttonPrimary: 'bg-win98-gray shadow-out active:shadow-in',
          buttonStop: 'bg-win98-gray shadow-out active:shadow-in',
        };
    }
  };

  const styles = getThemeStyles(settings.theme);

  return (
    <div className={`flex flex-col h-full p-4 ${styles.bg} ${styles.text} font-sans`}>
      
      {/* Visualizer Area */}
      <div className={`flex-1 mb-4 p-1 shadow-in ${settings.theme === 'classic' ? 'bg-gray-800' : 'bg-transparent'}`}>
         <div className="h-full w-full bg-black relative border-2 border-gray-700 rounded overflow-hidden">
            <canvas ref={canvasRef} width="600" height="300" className="w-full h-full object-cover opacity-80" />
            
            {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <Radio size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="opacity-75">Ready to Connect</p>
                    </div>
                </div>
            )}
         </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative text-xs">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className={`p-4 shadow-out border ${styles.panel} flex flex-col gap-2 items-center justify-center`}>
        <div className="flex items-center gap-4">
            {!isConnected ? (
                <button
                    onClick={connect}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-lg rounded-sm transition-all active:translate-y-px ${styles.buttonPrimary}`}
                >
                    <Zap size={20} />
                    GO LIVE
                </button>
            ) : (
                <button
                    onClick={disconnect}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-lg rounded-sm transition-all active:translate-y-px ${styles.buttonStop}`}
                >
                    <MicOff size={20} />
                    DISCONNECT
                </button>
            )}
        </div>
        
        <div className="text-xs opacity-70 mt-2 font-mono text-center">
            {isConnected ? (
                <span className="text-green-500 animate-pulse">● LIVE CONNECTION (WebSockets)</span>
            ) : (
                <span>Mode: Gemini 2.5 Flash Native Audio</span>
            )}
            <br/>
            {process.env.API_KEY ? "API Key Loaded" : "⚠️ NO API KEY"}
        </div>
      </div>

    </div>
  );
};

export default LiveInterface;