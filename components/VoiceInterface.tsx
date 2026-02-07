import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Activity, Play, Radio } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { transcribeAudio, getChatCompletion, generateSpeech } from '../services/groqService';
import { Message, AppSettings } from '../types';

interface VoiceInterfaceProps {
  settings: AppSettings;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ settings }) => {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'speaking'>('idle');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Voice module initialized.', timestamp: Date.now() }
  ]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  // Audio playback
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Setup Visualizer
    if (audioContextRef.current) {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
    }

    return () => {
      audioContextRef.current?.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Visualizer Loop
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

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        // Retro Gradient Colors
        const r = barHeight + (25 * (i/bufferLength));
        const g = 250 * (i/bufferLength);
        const b = 50;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };
    draw();
  };

  useEffect(() => {
    drawVisualizer();
  }, [status]);

  const playAudioResponse = async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    
    try {
      setStatus('speaking');
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect to analyser for visualization
      if (analyserRef.current) {
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      } else {
        source.connect(audioContextRef.current.destination);
      }

      source.onended = () => {
        setStatus('idle');
      };
      source.start(0);
    } catch (e) {
      console.error("Error playing audio", e);
      setStatus('idle');
    }
  };

  const handleToggleRecording = async () => {
    if (!settings.apiKey) {
      alert("Please set your API Key in Settings first.");
      return;
    }

    if (status === 'idle' || status === 'speaking') {
      if (status === 'speaking' && audioContextRef.current) {
         audioContextRef.current.suspend().then(() => audioContextRef.current?.resume());
      }
      setStatus('recording');
      await startRecording();
    } else if (status === 'recording') {
      setStatus('processing');
      const audioFile = await stopRecording();
      
      if (audioFile) {
        processConversationTurn(audioFile);
      } else {
        setStatus('idle');
      }
    }
  };

  const processConversationTurn = async (audioFile: File) => {
    try {
      const transcript = await transcribeAudio(settings.apiKey, audioFile);
      setCurrentTranscript(transcript);
      
      if (!transcript.trim()) {
        setStatus('idle');
        return;
      }

      const newHistory = [
        ...messages,
        { role: 'user', content: transcript, timestamp: Date.now() } as Message
      ];
      setMessages(newHistory);

      const aiResponseText = await getChatCompletion(
        settings.apiKey,
        settings.model,
        newHistory.map(m => ({ role: m.role as any, content: m.content }))
      );

      const updatedHistory = [
        ...newHistory,
        { role: 'assistant', content: aiResponseText, timestamp: Date.now() } as Message
      ];
      setMessages(updatedHistory);

      const audioBuffer = await generateSpeech(settings.apiKey, aiResponseText);
      await playAudioResponse(audioBuffer);

    } catch (error) {
      console.error("Conversation error:", error);
      setStatus('idle');
    }
  };

  return (
    <div className="flex flex-col h-full bg-win98-gray p-4 items-center justify-center gap-6">
      
      {/* 3D Modern Visualizer in Retro Frame */}
      <div className="bg-win98-gray p-1 shadow-out rounded-lg transform transition-transform hover:scale-105 duration-500">
        <div className="bg-black shadow-in w-[300px] h-[200px] relative overflow-hidden group">
            <canvas ref={canvasRef} width="300" height="200" className="w-full h-full opacity-80" />
            
            {/* Overlay Text */}
            <div className="absolute top-2 left-2 font-mono text-green-500 text-xs">
                MODE: {status.toUpperCase()}
            </div>
            <div className="absolute bottom-2 right-2 font-mono text-green-500 text-xs animate-pulse">
                {status === 'recording' && "● REC"}
                {status === 'processing' && "◌ LOAD"}
                {status === 'speaking' && "🔊 PLAY"}
            </div>

            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none bg-[url('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzM0c3B5ZWR4Z2V4aW15cnh5aDN4Znh5aDN4Znh5aDN4ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7aD2saalBwwftBIY/giphy.gif')] opacity-5 mix-blend-overlay"></div>
        </div>
      </div>

      {/* Transcript Display */}
      <div className="w-full max-w-md bg-white shadow-in p-2 h-24 overflow-y-auto font-sans text-sm border border-gray-400">
        {status === 'processing' ? (
             <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={14} /> Processing audio...
             </div>
        ) : (
            currentTranscript ? `"${currentTranscript}"` : <span className="text-gray-400 italic">Ready to record...</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={handleToggleRecording}
          className={`
            w-16 h-16 rounded-full border-4 shadow-out active:shadow-in flex items-center justify-center transition-all
            ${status === 'recording' ? 'bg-red-800 border-red-900' : 'bg-win98-gray border-win98-gray-light'}
          `}
        >
          {status === 'recording' ? (
            <Square fill="white" className="text-white" />
          ) : (
            <div className="w-6 h-6 bg-red-600 rounded-full shadow-inner" />
          )}
        </button>
      </div>

      <div className="text-win98-text text-xs font-retro">
         ORPHEUS V1.0 // {settings.model.split('/')[1].toUpperCase()}
      </div>
    </div>
  );
};

export default VoiceInterface;