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
  apiKey: string;
  model: AIModelId;
  theme: AppTheme;
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
    reasoning_effort: "default"
  }
};

export const SPEECH_MODEL = "canopylabs/orpheus-v1-english";
export const TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
export const VOICE_ID = "autumn";