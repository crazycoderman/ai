import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, AppSettings } from '../types';
import { streamChatCompletion } from '../services/groqService';

interface ChatInterfaceProps {
  settings: AppSettings;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ settings }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: `System initialized using ${settings.model.split('/')[1]}.`, timestamp: Date.now() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Notify when model changes in chat
  useEffect(() => {
    setMessages(prev => [...prev, {
      role: 'system',
      content: `Switched model to: ${settings.model}`,
      timestamp: Date.now()
    }]);
  }, [settings.model]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    if (!settings.apiKey) {
      setMessages(prev => [...prev, { role: 'system', content: 'ERROR: API Key missing. Please check Settings.', timestamp: Date.now() }]);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const apiMessages = messages
        .filter(m => m.role !== 'system')
        .concat(userMessage)
        .map(({ role, content }) => ({ role, content }));

      // Add a placeholder for the assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true
      }]);

      let fullContent = '';
      
      await streamChatCompletion(settings.apiKey, settings.model, apiMessages, (chunk) => {
        fullContent += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = fullContent;
          }
          return newMessages;
        });
      });

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'System Error: Connection failed or API limit reached.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        lastMsg.isStreaming = false;
        return newMessages;
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-win98-gray p-2 gap-2">
      {/* Toolbar */}
      <div className="h-8 flex items-center gap-2 px-1 border-b border-win98-gray-dark/20">
        <button className="flex items-center gap-1 px-2 py-0.5 text-xs bg-win98-gray shadow-out active:shadow-in hover:bg-win98-gray-light">
          <Save size={12} /> Save Log
        </button>
        <div className="h-4 w-px bg-gray-400 mx-2" />
        <span className="text-xs text-gray-600 font-mono">Connected: {settings.model}</span>
      </div>

      {/* Chat Area - Retro Terminal Style */}
      <div className="flex-1 bg-terminal-black shadow-in p-4 overflow-y-auto font-retro text-lg">
        {messages.map((msg, idx) => {
          if (msg.role === 'system') {
            return (
              <div key={idx} className="text-yellow-500 font-mono text-sm mb-4 border-b border-yellow-500/30 pb-1">
                {`> SYSTEM: ${msg.content}`}
              </div>
            );
          }
          
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`mb-6 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1 opacity-70">
                <span className={`text-xs font-mono ${isUser ? 'text-cyan-400' : 'text-terminal-green'}`}>
                  {isUser ? '<USER>' : '<CPU>'}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              <div className={`
                max-w-[90%] px-0
                ${isUser ? 'text-cyan-200' : 'text-terminal-green'}
              `}>
                <div className="prose prose-invert prose-p:my-1 prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-terminal-green animate-pulse"/>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="h-auto bg-win98-gray pt-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 bg-white shadow-in flex items-center px-2">
            <span className="text-black font-mono mr-2">{'>'}</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter command..."
              className="w-full py-2 outline-none font-sans text-sm"
              disabled={isLoading}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="w-20 bg-win98-gray shadow-out active:shadow-in flex items-center justify-center disabled:opacity-50 text-black font-bold text-sm hover:bg-win98-gray-light"
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : "SEND"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;