export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export enum AppMode {
  CHAT = 'CHAT',
  VOICE = 'VOICE',
}

export type AIModelId = 'meta-llama/llama-4-scout-17b-16e-instruct' | 'qwen/qwen3-32b';
export type AppTheme = 'classic' | 'dark' | 'vaporwave';

export interface AppSettings {
  apiKey: string; // Groq API Key
  model: AIModelId;
  theme: AppTheme;
  voice: string;
}

export interface AudioState {
  isRecording: boolean;
  isProcessing: boolean;
  isPlaying: boolean;
  audioBlob: Blob | null;
}

// Model Constants
export const MODEL_CONFIGS: Record<AIModelId, any> = {
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    temperature: 1,
    max_completion_tokens: 1024,
    top_p: 1,
  },
  'qwen/qwen3-32b': {
    temperature: 0.6,
    max_completion_tokens: 4096,
    top_p: 0.95,
    // reasoning_effort is conditionally applied in the service
  }
};

export const SPEECH_MODEL = "canopylabs/orpheus-v1-english";
export const TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
export const VOICE_ID = "autumn"; // Default
export const AVAILABLE_VOICES = [
  "autumn",
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer"
];

export const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';