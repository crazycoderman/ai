import React, { useState, useEffect } from 'react';
import { MessageSquare, Mic, Settings, Monitor, Minus } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import VoiceInterface from './components/VoiceInterface';
import SettingsModal from './components/SettingsModal';
import WindowFrame from './components/WindowFrame';
import { AppMode, AppSettings, AppTheme } from './types';

const App: React.FC = () => {
  // Global State
  const [activeApp, setActiveApp] = useState<AppMode | null>(AppMode.CHAT);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Window State
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Settings State - Initialize from LocalStorage or Env
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('groqmind_settings');
      const envKey = process.env.GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY || '';
      
      if (saved) {
        const parsed = JSON.parse(saved);
        // We prioritize the saved key if it exists, otherwise fall back to env
        // This allows users to override the env key via UI if they want
        return {
            ...parsed,
            apiKey: parsed.apiKey || envKey,
            // Ensure compatibility if voice wasn't in previous save
            voice: parsed.voice || 'autumn' 
        };
      }
      
      return {
        apiKey: envKey,
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        theme: 'classic',
        voice: 'autumn'
      };
    } catch (e) {
      console.error("Failed to load settings", e);
      return {
        apiKey: process.env.GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY || '',
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        theme: 'classic',
        voice: 'autumn'
      };
    }
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem('groqmind_settings', JSON.stringify(settings));
  }, [settings]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Theme Handling
  const getThemeColors = () => {
    switch (settings.theme) {
      case 'dark': return 'bg-slate-900';
      case 'vaporwave': return 'bg-purple-900';
      default: return 'bg-win98-teal';
    }
  };

  const launchApp = (mode: AppMode) => {
    setActiveApp(mode);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const closeApp = () => {
    setActiveApp(null);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const getWindowTitle = () => {
    switch(activeApp) {
        case AppMode.CHAT: return "GroqMind - Chat Interface";
        case AppMode.VOICE: return "GroqMind - Realtime Voice";
        default: return "Application";
    }
  }

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${getThemeColors()} font-sans text-win98-text crt transition-colors duration-500`}>
      
      {/* Desktop Area */}
      <main className="flex-1 relative p-4 flex items-center justify-center">
        
        {/* Desktop Icons */}
        <div className="absolute top-4 left-4 flex flex-col gap-6 z-0">
            <button onClick={() => launchApp(AppMode.CHAT)} className="flex flex-col items-center gap-1 group text-white w-16">
                <MessageSquare size={32} className="drop-shadow-md group-hover:scale-110 transition-transform" />
                <span className="text-xs bg-transparent group-hover:bg-blue-800 px-1 win98-text-shadow">Chat.exe</span>
            </button>
            <button onClick={() => launchApp(AppMode.VOICE)} className="flex flex-col items-center gap-1 group text-white w-16">
                <Mic size={32} className="drop-shadow-md group-hover:scale-110 transition-transform" />
                <span className="text-xs bg-transparent group-hover:bg-blue-800 px-1 win98-text-shadow">Voice.wav</span>
            </button>
            <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-1 group text-white w-16">
                <Settings size={32} className="drop-shadow-md group-hover:scale-110 transition-transform" />
                <span className="text-xs bg-transparent group-hover:bg-blue-800 px-1 win98-text-shadow">Config</span>
            </button>
        </div>

        {/* Main Application Window */}
        {activeApp && !isMinimized && (
          <div className={`
             z-10 perspective-1000 transition-all duration-300
             ${isMaximized ? 'fixed inset-0 m-0 z-20 pb-10' : 'w-full max-w-4xl h-[80vh]'}
          `}>
               <WindowFrame 
                  title={getWindowTitle()}
                  icon={<Monitor size={16} />}
                  className="h-full animate-in fade-in zoom-in duration-300"
                  isMaximized={isMaximized}
                  onClose={closeApp}
                  onMinimize={toggleMinimize}
                  onMaximize={toggleMaximize}
               >
                  {activeApp === AppMode.CHAT && <ChatInterface settings={settings} />}
                  {activeApp === AppMode.VOICE && <VoiceInterface settings={settings} />}
               </WindowFrame>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
            <SettingsModal 
                settings={settings} 
                onUpdate={setSettings} 
                onClose={() => setShowSettings(false)} 
            />
        )}
      </main>

      {/* Taskbar */}
      <footer className="h-10 bg-win98-gray border-t-2 border-white shadow-out flex items-center px-1 gap-1 z-50 select-none">
        <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1 px-2 py-1 bg-win98-gray shadow-out active:shadow-in font-bold text-sm active:translate-y-px ${showSettings ? 'shadow-in bg-gray-300' : ''}`}
        >
            <div className="w-4 h-4 bg-gradient-to-r from-red-500 to-yellow-500 rounded-sm" />
            Start
        </button>
        
        <div className="w-px h-6 bg-gray-400 mx-1" />

        {/* Active Window Tabs */}
        <div className="flex-1 flex gap-1">
            {activeApp && (
                <div 
                    onClick={toggleMinimize}
                    className={`
                        flex items-center gap-2 px-3 py-1 text-sm font-bold w-48 cursor-pointer
                        ${isMinimized 
                            ? 'bg-win98-gray shadow-out' 
                            : 'bg-gradient-to-r from-gray-200 to-gray-300 shadow-in'}
                    `}
                >
                    <Monitor size={14} />
                    <span className="truncate">{getWindowTitle()}</span>
                </div>
            )}
        </div>

        {/* Tray */}
        <div className="bg-win98-gray shadow-in px-3 py-1 text-xs font-mono flex items-center gap-2">
            <span className={settings.apiKey ? "text-green-600" : "text-red-600"}>
                {settings.apiKey ? "ONLINE" : "OFFLINE"}
            </span>
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;