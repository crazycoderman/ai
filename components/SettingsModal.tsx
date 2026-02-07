import React from 'react';
import WindowFrame from './WindowFrame';
import { Settings, Check, Volume2 } from 'lucide-react';
import { AppSettings, AIModelId, AppTheme, AVAILABLE_VOICES } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdate: (newSettings: AppSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdate, onClose }) => {
  const handleChange = (key: keyof AppSettings, value: any) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <WindowFrame 
        title="Control Panel" 
        icon={<Settings size={14} />} 
        className="w-96 max-w-full"
        onClose={onClose}
      >
        <div className="p-4 space-y-6 text-win98-text text-sm font-sans">
          
          {/* Groq API Key Section */}
          <div className="space-y-2">
            <label className="block font-bold">Groq API Key (Chat/Voice):</label>
            <div className="bg-white p-1 shadow-in">
                <input 
                type="password" 
                value={settings.apiKey}
                onChange={(e) => handleChange('apiKey', e.target.value)}
                className="w-full outline-none font-mono text-xs"
                placeholder="gsk_..."
                />
            </div>
            <p className="text-[10px] text-gray-500">Required for Llama, Whisper, and Orpheus models.</p>
          </div>

          <div className="h-px bg-win98-gray-dark border-b border-win98-gray-light" />

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block font-bold">AI Brain:</label>
            <div className="space-y-1 bg-white p-2 shadow-in h-24 overflow-y-auto">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-win98-blue hover:text-white px-1">
                <input 
                  type="radio" 
                  name="model" 
                  checked={settings.model === 'meta-llama/llama-4-scout-17b-16e-instruct'}
                  onChange={() => handleChange('model', 'meta-llama/llama-4-scout-17b-16e-instruct')}
                  className="hidden"
                />
                <span className="w-3 h-3 border border-black rounded-full flex items-center justify-center bg-white">
                  {settings.model === 'meta-llama/llama-4-scout-17b-16e-instruct' && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                </span>
                <span>Llama 4 Scout (Fast)</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer hover:bg-win98-blue hover:text-white px-1">
                <input 
                  type="radio" 
                  name="model" 
                  checked={settings.model === 'qwen/qwen3-32b'}
                  onChange={() => handleChange('model', 'qwen/qwen3-32b')}
                  className="hidden"
                />
                <span className="w-3 h-3 border border-black rounded-full flex items-center justify-center bg-white">
                  {settings.model === 'qwen/qwen3-32b' && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                </span>
                <span>Qwen 3 32B (Reasoning)</span>
              </label>
            </div>
          </div>

          <div className="h-px bg-win98-gray-dark border-b border-win98-gray-light" />
          
          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="block font-bold flex items-center gap-2">
              <Volume2 size={14} /> Voice ID:
            </label>
            <select 
              value={settings.voice}
              onChange={(e) => handleChange('voice', e.target.value)}
              className="w-full bg-white border border-gray-500 shadow-in px-2 py-1 outline-none capitalize"
            >
              {AVAILABLE_VOICES.map(voice => (
                <option key={voice} value={voice}>{voice}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500">Determines the AI's speaking voice.</p>
          </div>

          <div className="h-px bg-win98-gray-dark border-b border-win98-gray-light" />

          {/* Theme Selection */}
          <div className="space-y-2">
            <label className="block font-bold">Desktop Theme:</label>
            <select 
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value as AppTheme)}
              className="w-full bg-white border border-gray-500 shadow-in px-2 py-1 outline-none"
            >
              <option value="classic">Windows Classic (Teal)</option>
              <option value="dark">Hacker Dark</option>
              <option value="vaporwave">Vaporwave 95</option>
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <button 
              onClick={onClose}
              className="px-6 py-1 bg-win98-gray shadow-out active:shadow-in font-bold hover:bg-win98-gray-light transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
};

export default SettingsModal;