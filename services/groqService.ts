import Groq from 'groq-sdk';
import { SPEECH_MODEL, TRANSCRIPTION_MODEL, VOICE_ID, MODEL_CONFIGS, AIModelId } from '../types';

const getClient = (apiKey: string) => {
  if (!apiKey) throw new Error("API Key is missing");
  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true 
  });
};

interface CompletionOptions {
  isReasoning?: boolean;
}

export const streamChatCompletion = async (
  apiKey: string,
  modelId: AIModelId,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  onChunk: (chunk: string) => void,
  options: CompletionOptions = {}
) => {
  try {
    const groq = getClient(apiKey);
    const baseConfig = MODEL_CONFIGS[modelId];
    
    // Create a clean config object to avoid mutating constants or passing invalid params
    const requestConfig = { ...baseConfig };
    let messagesToSend = [...messages];

    // Apply reasoning prompt if requested and model is Qwen
    if (modelId === 'qwen/qwen3-32b' && options.isReasoning) {
       // We rely on System Prompt for reasoning in Qwen, as the API param might not be supported.
       const systemInstruction = "You are in reasoning mode. Please output your thought process enclosed in <think> and </think> tags before providing the final answer.";
       
       const sysIndex = messagesToSend.findIndex(m => m.role === 'system');
       if (sysIndex >= 0) {
         messagesToSend[sysIndex] = {
           ...messagesToSend[sysIndex],
           content: messagesToSend[sysIndex].content + " " + systemInstruction
         };
       } else {
         messagesToSend.unshift({ role: 'system', content: systemInstruction });
       }
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: messagesToSend as any,
      model: modelId,
      stream: true,
      stop: null,
      ...requestConfig
    });

    for await (const chunk of (chatCompletion as AsyncIterable<any>)) {
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
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    options: CompletionOptions = {}
  ): Promise<string> => {
    try {
      const groq = getClient(apiKey);
      const baseConfig = MODEL_CONFIGS[modelId];
      
      const requestConfig = { ...baseConfig };
      let messagesToSend = [...messages];

      // Apply reasoning prompt if requested and model is Qwen
      if (modelId === 'qwen/qwen3-32b' && options.isReasoning) {
         const systemInstruction = "You are in reasoning mode. Please output your thought process enclosed in <think> and </think> tags before providing the final answer.";
       
         const sysIndex = messagesToSend.findIndex(m => m.role === 'system');
         if (sysIndex >= 0) {
           messagesToSend[sysIndex] = {
             ...messagesToSend[sysIndex],
             content: messagesToSend[sysIndex].content + " " + systemInstruction
           };
         } else {
           messagesToSend.unshift({ role: 'system', content: systemInstruction });
         }
      }

      const chatCompletion = await groq.chat.completions.create({
        messages: messagesToSend as any,
        model: modelId,
        stream: false,
        stop: null,
        ...requestConfig
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

export const generateSpeech = async (apiKey: string, text: string, voice: string = VOICE_ID): Promise<ArrayBuffer> => {
  try {
    const groq = getClient(apiKey);
    const wav = await groq.audio.speech.create({
      model: SPEECH_MODEL,
      voice: voice as any, 
      response_format: "wav",
      input: text,
    });
    
    return await wav.arrayBuffer();
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};