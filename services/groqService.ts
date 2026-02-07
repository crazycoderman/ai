import Groq from 'groq-sdk';
import { SPEECH_MODEL, TRANSCRIPTION_MODEL, VOICE_ID, MODEL_CONFIGS, AIModelId } from '../types';

const getClient = (apiKey: string) => {
  if (!apiKey) throw new Error("API Key is missing");
  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true 
  });
};

export const streamChatCompletion = async (
  apiKey: string,
  modelId: AIModelId,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  onChunk: (chunk: string) => void
) => {
  try {
    const groq = getClient(apiKey);
    const config = MODEL_CONFIGS[modelId];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: modelId,
      stream: true,
      stop: null,
      ...config
    });

    for await (const chunk of chatCompletion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        onChunk(content);
      }
    }
  } catch (error) {
    console.error("Error in chat completion:", error);
    throw error;
  }
};

export const getChatCompletion = async (
    apiKey: string,
    modelId: AIModelId,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  ): Promise<string> => {
    try {
      const groq = getClient(apiKey);
      const config = MODEL_CONFIGS[modelId];

      const chatCompletion = await groq.chat.completions.create({
        messages: messages,
        model: modelId,
        stream: false,
        stop: null,
        ...config
      });
  
      return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("Error in chat completion:", error);
      throw error;
    }
  };

export const transcribeAudio = async (apiKey: string, audioFile: File): Promise<string> => {
  try {
    const groq = getClient(apiKey);
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: TRANSCRIPTION_MODEL,
      response_format: 'json',
      language: 'en',
      temperature: 0.0,
    });
    return transcription.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
};

export const generateSpeech = async (apiKey: string, text: string): Promise<ArrayBuffer> => {
  try {
    const groq = getClient(apiKey);
    const wav = await groq.audio.speech.create({
      model: SPEECH_MODEL,
      voice: VOICE_ID as any, 
      response_format: "wav",
      input: text,
    });
    
    return await wav.arrayBuffer();
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};