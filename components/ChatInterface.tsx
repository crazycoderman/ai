import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Save, Brain, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, AppSettings, AppTheme } from '../types';
import { streamChatCompletion } from '../services/groqService';

interface ChatInterfaceProps {
  settings: AppSettings;
}

const ReasoningAccordion: React.FC<{ content: string, styles: any, defaultOpen?: boolean }> = ({ content, styles, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="my-2 select-none">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold p-1 rounded transition-colors w-full text-left mb-1 ${styles.reasoningHeader}`}
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Brain size={12} className="mr-1" />
        <span>Thought Process</span>
      </button>
      
      {isOpen && (
        <div className={`p-2 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap ${styles.reasoningContent}`}>
           {content}
        </div>
      )}
    </div>
  );
};

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

  const getThemeStyles = (theme: AppTheme) => {
    switch (theme) {
      case 'dark':
        return {
          wrapper: 'bg-gray-900',
          toolbar: 'bg-gray-800 border-gray-700 text-gray-300',
          container: 'bg-black',
          inputArea: 'bg-gray-900',
          inputFieldContainer: 'bg-gray-800 border-gray-700',
          inputFieldText: 'text-white placeholder-gray-500',
          userBubble: 'bg-blue-900 text-white border border-blue-700',
          assistantBubble: 'bg-gray-800 text-gray-100 border border-gray-700',
          systemMsg: 'bg-gray-800 text-blue-400 border-blue-900',
          timestampUser: 'text-blue-300',
          timestampAssistant: 'text-gray-500',
          // Blue/Cyan for reasoning in Dark Mode
          reasoningHeader: 'text-cyan-400 hover:bg-cyan-900/30',
          reasoningContent: 'text-cyan-300 border-l-2 border-cyan-500 bg-cyan-900/10',
          avatarUser: 'bg-gray-800 border-gray-600 text-blue-500',
          avatarBot: 'bg-gray-800 border-gray-600 text-gray-400',
          sendButton: 'bg-gray-700 text-white hover:bg-gray-600 border-gray-600',
          proseClass: 'prose-invert'
        };
      case 'vaporwave':
        return {
          wrapper: 'bg-purple-900',
          toolbar: 'bg-pink-800 border-pink-600 text-cyan-200',
          container: 'bg-indigo-950',
          inputArea: 'bg-purple-800',
          inputFieldContainer: 'bg-pink-100 border-pink-300',
          inputFieldText: 'text-purple-900 placeholder-purple-400',
          userBubble: 'bg-cyan-600 text-white border border-cyan-300',
          assistantBubble: 'bg-pink-500 text-white border border-pink-300',
          systemMsg: 'bg-purple-200 text-purple-900 border-purple-400',
          timestampUser: 'text-cyan-200',
          timestampAssistant: 'text-pink-200',
          // Yellow for reasoning in Vaporwave
          reasoningHeader: 'text-yellow-300 hover:bg-purple-800',
          reasoningContent: 'text-yellow-200 border-l-2 border-yellow-400 bg-purple-900/30 italic',
          avatarUser: 'bg-cyan-200 border-cyan-400 text-purple-600',
          avatarBot: 'bg-pink-200 border-pink-400 text-purple-600',
          sendButton: 'bg-cyan-500 text-white hover:bg-cyan-400 border-cyan-300',
          proseClass: 'prose-invert'
        };
      default: // classic
        return {
          wrapper: 'bg-win98-gray',
          toolbar: 'bg-win98-gray border-white text-gray-600',
          container: 'bg-white',
          inputArea: 'bg-win98-gray',
          inputFieldContainer: 'bg-white border-gray-500',
          inputFieldText: 'text-black placeholder-gray-400',
          userBubble: 'bg-win98-blue text-white',
          assistantBubble: 'bg-win98-gray-light text-black border border-white',
          systemMsg: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          timestampUser: 'text-blue-200',
          timestampAssistant: 'text-gray-500',
          // Blue for reasoning in Classic
          reasoningHeader: 'text-blue-800 hover:bg-blue-50 border border-transparent hover:border-blue-200',
          reasoningContent: 'text-blue-900 border-l-2 border-blue-400 bg-blue-50',
          avatarUser: 'bg-win98-gray border-gray-400 text-blue-800',
          avatarBot: 'bg-win98-gray border-gray-400 text-green-800',
          sendButton: 'bg-win98-gray text-black hover:bg-win98-gray-light',
          proseClass: ''
        };
    }
  };

  const styles = getThemeStyles(settings.theme);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    if (!settings.apiKey) {
      setMessages(prev => [...prev, { role: 'system', content: 'ERROR: API Key missing. Please check Settings.', timestamp: Date.now() }]);
      return;
    }

    // Check for reasoning command
    let cleanContent = inputValue.trim();
    let isReasoning = false;
    
    if (settings.model === 'qwen/qwen3-32b' && cleanContent.toLowerCase().startsWith('/think')) {
      isReasoning = true;
      cleanContent = cleanContent.replace(/^\/think\s*/i, '');
      if (!cleanContent) cleanContent = "Think about this."; // Fallback if user just types /think
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
        .concat({ ...userMessage, content: cleanContent }) 
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
      }, { isReasoning });

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

  const renderMessageContent = (content: string, isStreaming: boolean = false) => {
    // Split by think tags to isolate reasoning
    // If we are streaming, we might have an unclosed <think> tag
    const parts = content.split(/(<think>[\s\S]*?<\/think>)/g);
    
    return parts.map((part, index) => {
        // Case 1: Completed reasoning block
        if (part.startsWith('<think>')) {
            const inner = part.replace(/<\/?think>/g, '').trim();
            if (!inner) return null;
            return <ReasoningAccordion key={index} content={inner} styles={styles} />;
        }
        
        // Case 2: Unclosed reasoning block (likely streaming)
        if (part.includes('<think>') && !part.includes('</think>')) {
             const subParts = part.split('<think>');
             // subParts[0] is text before, subParts[1] is thinking content so far
             return (
                 <React.Fragment key={index}>
                    {subParts[0] && (
                        <ReactMarkdown className={`prose prose-sm max-w-none prose-p:my-1 ${styles.proseClass}`}>
                            {subParts[0]}
                        </ReactMarkdown>
                    )}
                    {subParts[1] && (
                        <ReasoningAccordion 
                            content={subParts[1]} 
                            styles={styles} 
                            defaultOpen={true} // Keep open while thinking
                        />
                    )}
                 </React.Fragment>
             );
        }

        if (!part.trim()) return null;
        return (
            <div key={index}>
                 <ReactMarkdown className={`prose prose-sm max-w-none prose-p:my-1 ${styles.proseClass}`}>
                    {part}
                 </ReactMarkdown>
            </div>
        );
    });
  };

  return (
    <div className={`flex flex-col h-full p-1 gap-1 ${styles.wrapper}`}>
      {/* Toolbar */}
      <div className={`h-8 flex items-center gap-2 px-2 border-b shadow-in mb-1 ${styles.toolbar}`}>
        <div className="flex items-center gap-1 text-xs font-sans">
            <span className="font-bold">Connected:</span> {settings.model.split('/')[1]}
        </div>
        <div className="flex-1" />
        <button className={`flex items-center gap-1 px-2 py-0.5 text-xs shadow-out active:shadow-in border ${styles.toolbar}`}>
          <Save size={12} /> Save Log
        </button>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 shadow-in p-4 overflow-y-auto font-sans ${styles.container}`}>
        {messages.map((msg, idx) => {
          if (msg.role === 'system') {
            return (
              <div key={idx} className="text-center my-4">
                <span className={`text-xs px-2 py-1 border rounded shadow-sm ${styles.systemMsg}`}>
                  {msg.content}
                </span>
              </div>
            );
          }
          
          const isUser = msg.role === 'user';
          
          return (
            <div key={idx} className={`mb-6 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] flex items-start gap-2
                ${isUser ? 'flex-row-reverse' : 'flex-row'}
              `}>
                {/* Avatar Box */}
                <div className={`
                  w-8 h-8 flex items-center justify-center shrink-0 border shadow-out ${isUser ? styles.avatarUser : styles.avatarBot}
                `}>
                  {isUser ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                {/* Message Bubble */}
                <div className={`
                   p-3 shadow-out text-sm relative
                   ${isUser ? styles.userBubble : styles.assistantBubble}
                `}>
                   {/* Header */}
                  <div className={`text-[10px] mb-1 font-bold ${isUser ? styles.timestampUser : styles.timestampAssistant}`}>
                    {isUser ? 'User' : settings.model.split('/')[1]} • {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>

                  <div className="leading-relaxed">
                    {renderMessageContent(msg.content, msg.isStreaming || false)}
                  </div>
                  
                  {msg.isStreaming && <Loader2 size={12} className="animate-spin mt-2" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`h-auto pt-2 px-1 pb-1 ${styles.inputArea}`}>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className={`flex-1 shadow-in flex items-center px-2 py-1 border ${styles.inputFieldContainer}`}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={settings.model.includes('qwen') ? "Type /think for reasoning..." : "Type your message..."}
              className={`w-full outline-none font-sans text-sm bg-transparent ${styles.inputFieldText}`}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className={`px-6 shadow-out active:shadow-in flex items-center justify-center disabled:opacity-50 font-bold text-sm active:translate-y-px ${styles.sendButton}`}
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;