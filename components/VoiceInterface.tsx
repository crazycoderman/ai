import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Loader2, Volume2, MicOff, Zap } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { transcribeAudio, getChatCompletion, generateSpeech } from '../services/groqService';
import { Message, AppSettings, AppTheme } from '../types';

interface VoiceInterfaceProps {
  settings: AppSettings;
}

const SILENCE_THRESHOLD = 15; // Volume threshold (0-255) to detect speech
const SILENCE_DURATION = 1500; // ms of silence to trigger send
const SPEECH_MIN_DURATION = 500; // ms of speech needed to consider it valid input

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ settings }) => {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  
  // States
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Hands-free voice module initialized.', timestamp: Date.now() }
  ]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isHandsFree, setIsHandsFree] = useState(false); // Default to manual

  // VAD & Visualizer Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Logic Refs
  const lastSpeechTimeRef = useRef<number>(0);
  const silenceStartTimeRef = useRef<number>(0);
  const hasSpokenRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);

  // --- Audio Context & Analyser Setup ---
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Create Analyser
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    analyserRef.current = analyser;

    // We need to connect the microphone stream to this analyser when recording starts.
    // However, useAudioRecorder manages the MediaRecorder internally. 
    // To visualize AND record, we need to tap into the stream.
    // For simplicity in this structure, we'll request a separate stream for VAD/Viz if needed,
    // OR ideally update useAudioRecorder to expose the stream.
    // For this implementation, we will request the stream here separately to ensure low-latency VAD access
    // distinct from the recording logic, or we rely on the visualizer loop to drive logic.

    return () => {
      audioContextRef.current?.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // --- Helper to connect stream to analyser ---
  const connectStreamToAnalyser = async () => {
    if (!analyserRef.current || !audioContextRef.current) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        return stream; // Return to close later if needed
    } catch (e) {
        console.error("Error connecting VAD stream", e);
    }
  };

  // --- VAD & Visualizer Loop ---
  const startVADLoop = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkSilence = () => {
      if (!isHandsFree || status !== 'listening' || isProcessingRef.current) return;

      const currentTime = Date.now();
      
      // Calculate average volume
      let sum = 0;
      for(let i=0; i<bufferLength; i++) sum += dataArray[i];
      const avgVolume = sum / bufferLength;

      // Logic
      if (avgVolume > SILENCE_THRESHOLD) {
         // User is speaking
         lastSpeechTimeRef.current = currentTime;
         silenceStartTimeRef.current = 0;
         if (!hasSpokenRef.current) {
             // Just started speaking
             hasSpokenRef.current = true; 
         }
      } else {
         // Silence
         if (hasSpokenRef.current) {
             if (silenceStartTimeRef.current === 0) silenceStartTimeRef.current = currentTime;
             
             const silenceDuration = currentTime - silenceStartTimeRef.current;
             const speechDuration = lastSpeechTimeRef.current - (silenceStartTimeRef.current - 1000); // Approximate

             if (silenceDuration > SILENCE_DURATION) {
                 // Silence timeout reached!
                 handleStopAndProcess();
             }
         }
      }
    };

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      // --- VAD LOGIC CHECK ---
      checkSilence();

      // --- DRAWING ---
      // Clear
      ctx.fillStyle = settings.theme === 'classic' ? '#000000' : 
                      settings.theme === 'vaporwave' ? '#2d0a3d' : '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = settings.theme === 'vaporwave' ? '#ff00ff20' : '#003300';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Horizontal line
      ctx.moveTo(0, canvas.height/2);
      ctx.lineTo(canvas.width, canvas.height/2);
      ctx.stroke();

      // Bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 1.5;

        let r, g, b;
        if (status === 'listening') {
             if (settings.theme === 'vaporwave') {
                r = dataArray[i] + 50; g = 0; b = 255;
             } else {
                r = 0; g = 255; b = 0; // Matrix Green active
             }
             // Highlight if detecting speech
             if (dataArray[i] > SILENCE_THRESHOLD) {
                 g = 255; r = 255; // Yellow/White hot
             }
        } else if (status === 'speaking') {
             r = 0; g = 100; b = 255; // Blue for AI
        } else {
             r = 50; g = 50; b = 50; // Grey idle
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);

        x += barWidth + 1;
      }
    };
    draw();
  }, [settings.theme, isHandsFree, status]); // Dependencies

  useEffect(() => {
    startVADLoop();
  }, [startVADLoop]);

  // --- Handlers ---

  const handleStartListening = async () => {
    if (!settings.apiKey) {
      alert("Please set your API Key in Settings first.");
      return;
    }
    
    // Resume context if needed
    if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
    }
    
    // Connect VAD stream
    await connectStreamToAnalyser();
    
    // Start Recorder
    await startRecording();

    // Reset VAD state
    hasSpokenRef.current = false;
    silenceStartTimeRef.current = 0;
    lastSpeechTimeRef.current = 0;
    isProcessingRef.current = false;

    setStatus('listening');
  };

  const handleStopAndProcess = async () => {
    if (status !== 'listening' || isProcessingRef.current) return;
    
    isProcessingRef.current = true; // Lock
    setStatus('processing');
    
    const audioFile = await stopRecording();
    
    if (audioFile) {
        await processConversationTurn(audioFile);
    } else {
        setStatus('idle');
        isProcessingRef.current = false;
    }
  };

  const processConversationTurn = async (audioFile: File) => {
    try {
      // 1. Transcribe
      const transcript = await transcribeAudio(settings.apiKey, audioFile);
      
      if (!transcript.trim()) {
         console.log("Empty transcript, ignoring.");
         if (isHandsFree) {
             // Restart listening if hands free and just noise
             handleStartListening(); 
             return;
         }
         setStatus('idle');
         isProcessingRef.current = false;
         return;
      }
      
      setCurrentTranscript(transcript);

      // 2. Chat Completion
      let cleanContent = transcript;
      let isReasoning = false;
      
      if (settings.model === 'qwen/qwen3-32b' && (transcript.toLowerCase().includes('/think') || transcript.toLowerCase().startsWith('slash think'))) {
          isReasoning = true;
          cleanContent = transcript.replace(/\/think/i, '').replace(/slash think/i, '').trim();
          if(!cleanContent) cleanContent = "Think about this.";
      }

      const newHistory = [
        ...messages,
        { role: 'user', content: transcript, timestamp: Date.now() } as Message
      ];
      setMessages(newHistory);

      const aiResponseText = await getChatCompletion(
        settings.apiKey,
        settings.model,
        newHistory.map(m => ({ role: m.role as any, content: m.content === transcript ? cleanContent : m.content })),
        { isReasoning }
      );

      const updatedHistory = [
        ...newHistory,
        { role: 'assistant', content: aiResponseText, timestamp: Date.now() } as Message
      ];
      setMessages(updatedHistory);

      // 3. Speech Generation (remove thought tags for speech)
      const speechText = aiResponseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      if (speechText) {
          // Pass selected voice to the speech generation service
          const audioBuffer = await generateSpeech(settings.apiKey, speechText, settings.voice);
          await playAudioResponse(audioBuffer);
      } else {
          // If no speech text (e.g. only thought), just go back
          if (isHandsFree) {
            handleStartListening();
          } else {
            setStatus('idle');
          }
      }

    } catch (error) {
      console.error("Conversation error:", error);
      setStatus('idle');
      isProcessingRef.current = false;
    }
  };

  const playAudioResponse = async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    
    try {
      setStatus('speaking');
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect to analyser for visualization during playback
      if (analyserRef.current) {
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      } else {
        source.connect(audioContextRef.current.destination);
      }

      source.onended = () => {
        if (isHandsFree) {
            // AUTO RESTART LOOP
            handleStartListening();
        } else {
            setStatus('idle');
            isProcessingRef.current = false;
        }
      };
      source.start(0);
    } catch (e) {
      console.error("Error playing audio", e);
      setStatus('idle');
      isProcessingRef.current = false;
    }
  };

  const toggleHandsFree = () => {
      setIsHandsFree(!isHandsFree);
      // If we are turning it off and currently listening, we leave it listening but it won't auto-send
      // If we turn it on and are idle, we don't auto start, user must start once.
  };

  // Styles based on theme
  const getStyles = (theme: AppTheme) => {
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-gray-900',
          text: 'text-gray-200',
          transcriptBox: 'bg-gray-800 border-gray-600 text-green-400',
          buttonIdle: 'bg-gray-700 border-gray-500 hover:bg-gray-600',
          buttonActive: 'bg-red-900 border-red-700',
          buttonProcessing: 'bg-yellow-900 border-yellow-700',
        };
      case 'vaporwave':
        return {
          bg: 'bg-purple-900',
          text: 'text-pink-300',
          transcriptBox: 'bg-indigo-900 border-pink-500 text-cyan-200',
          buttonIdle: 'bg-purple-800 border-cyan-500 hover:bg-purple-700',
          buttonActive: 'bg-pink-700 border-pink-400',
          buttonProcessing: 'bg-cyan-900 border-cyan-400',
        };
      default:
        return {
          bg: 'bg-win98-gray',
          text: 'text-black',
          transcriptBox: 'bg-white border-gray-500 text-gray-800',
          buttonIdle: 'bg-win98-gray border-white shadow-out hover:bg-win98-gray-light',
          buttonActive: 'bg-red-100 border-red-300 shadow-in',
          buttonProcessing: 'bg-yellow-100 border-yellow-300',
        };
    }
  };
  
  const styles = getStyles(settings.theme);

  return (
    <div className={`flex flex-col h-full p-6 items-center justify-between overflow-hidden ${styles.bg} transition-colors duration-300`}>
      
      {/* Top: Hands Free Toggle */}
      <div className="w-full flex justify-end mb-2">
          <button 
            onClick={toggleHandsFree}
            className={`
                flex items-center gap-2 px-3 py-1 text-xs font-bold border rounded
                ${isHandsFree 
                    ? 'bg-green-600 text-white border-green-800 shadow-in' 
                    : 'bg-gray-400 text-gray-700 border-gray-500 shadow-out'}
            `}
          >
             <Zap size={12} fill={isHandsFree ? "currentColor" : "none"} />
             {isHandsFree ? "HANDS-FREE: ON" : "HANDS-FREE: OFF"}
          </button>
      </div>

      {/* Visualizer Screen */}
      <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 mb-4">
        <div className={`p-1 shadow-out rounded-lg w-full max-w-lg ${settings.theme === 'classic' ? 'bg-win98-gray' : 'bg-transparent'}`}>
            <div className="bg-black shadow-in border-4 border-gray-700 relative rounded-lg overflow-hidden h-48 sm:h-64 w-full">
                <canvas ref={canvasRef} width="600" height="300" className="w-full h-full object-cover" />
                
                {/* Status Overlay */}
                <div className="absolute top-2 left-2 right-2 flex justify-between font-mono text-xs z-10">
                    <span className="text-green-500 bg-black/50 px-1 rounded">MODEL: {settings.model.split('/')[1].toUpperCase()}</span>
                    <span className={`px-1 rounded ${
                        status === 'listening' ? 'bg-red-600 text-white animate-pulse' : 
                        status === 'processing' ? 'bg-yellow-600 text-white' :
                        status === 'speaking' ? 'bg-blue-600 text-white' :
                        'text-green-500 bg-black/50'
                    }`}>
                        {status.toUpperCase()}
                    </span>
                </div>

                {/* Hands Free Helper Text */}
                {isHandsFree && status === 'listening' && (
                    <div className="absolute bottom-2 w-full text-center">
                        <span className="text-[10px] text-white/70 bg-black/40 px-2 rounded">
                            Listening... (Stop speaking to send)
                        </span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Transcript Box */}
      <div className={`w-full shadow-in p-3 h-20 mb-6 overflow-y-auto font-sans text-sm border ${styles.transcriptBox}`}>
        {status === 'processing' ? (
             <div className="flex items-center gap-2 animate-pulse">
                <Loader2 className="animate-spin" size={14} /> Processing request...
             </div>
        ) : (
            currentTranscript ? (
                <p>
                    <span className={`font-bold ${settings.theme === 'dark' ? 'text-white' : 'text-blue-800'}`}>Last heard:</span> "{currentTranscript}"
                </p>
            ) : (
                <span className="opacity-50 italic">
                    {isHandsFree ? "Say something..." : "Press the mic to start..."}
                </span>
            )
        )}
      </div>

      {/* Main Control Button */}
      <div className="w-full flex flex-col items-center gap-4">
        <button
          onClick={status === 'listening' ? handleStopAndProcess : handleStartListening}
          disabled={status === 'processing'}
          className={`
            w-20 h-20 rounded-full border-4 shadow-out active:shadow-in flex items-center justify-center transition-all active:translate-y-1
            ${status === 'listening' ? styles.buttonActive : status === 'processing' ? styles.buttonProcessing : styles.buttonIdle}
          `}
        >
          <div className={`
             w-14 h-14 rounded-full shadow-md flex items-center justify-center transition-colors duration-300
             ${status === 'listening' ? 'bg-red-600 animate-pulse' : 
               status === 'processing' ? 'bg-yellow-500' :
               status === 'speaking' ? 'bg-blue-500' : 
               'bg-gradient-to-br from-gray-400 to-gray-600'}
          `}>
             {status === 'processing' ? <Loader2 className="animate-spin text-white" size={28} /> :
              status === 'listening' ? <Square fill="white" className="text-white" size={24} /> : 
              <Mic className="text-white" size={28} />}
          </div>
        </button>
        
        <div className={`text-sm font-bold shadow-out px-4 py-1 active:shadow-in uppercase tracking-wider ${settings.theme === 'classic' ? 'bg-win98-gray' : 'bg-gray-800 text-white border border-gray-600'}`}>
            {status === 'idle' ? "Click to Talk" : 
             status === 'listening' ? (isHandsFree ? "Listening..." : "Stop & Send") : 
             status === 'speaking' ? "AI Speaking..." : 
             "Thinking..."}
        </div>
      </div>

    </div>
  );
};

export default VoiceInterface;