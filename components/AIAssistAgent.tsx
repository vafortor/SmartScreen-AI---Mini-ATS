import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User, Loader2, MessageSquare, Zap, Target, BookOpen } from 'lucide-react';
import { ChatMessage, AIAgentContext } from '../types';
import { askAIAssistant } from '../geminiService';

interface AIAssistAgentProps {
  context: AIAgentContext;
}

const AIAssistAgent: React.FC<AIAssistAgentProps> = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'assistant', 
      content: "Hello! I'm your SmartScreen AI Co-pilot. How can I help you optimize your recruitment process today?", 
      timestamp: new Date() 
    }
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

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: inputValue, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await askAIAssistant(inputValue, context);
      const aiMsg: ChatMessage = { role: 'assistant', content: response, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = { 
        role: 'assistant', 
        content: "I encountered an error while processing your request. Please try again.", 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: 'Summarize active role', icon: <Target size={14} />, query: 'Can you summarize the core requirements of the current job requisition?' },
    { label: 'Pipeline analysis', icon: <Zap size={14} />, query: 'Give me a brief analysis of the current candidate pipeline matching quality.' },
    { label: 'Hiring tips', icon: <BookOpen size={14} />, query: 'What are some best practices for interviewing candidates for the active role?' },
  ];

  const handleQuickAction = (query: string) => {
    setInputValue(query);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full shadow-[0_10px_40px_rgba(37,99,235,0.4)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[1000] group"
        >
          <Sparkles className="group-hover:rotate-12 transition-transform" size={28} fill="currentColor" />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-8 right-8 w-[400px] h-[600px] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden z-[1001] animate-in slide-in-from-bottom-8 zoom-in-95 duration-300 border border-slate-100">
          {/* Header */}
          <div className="p-6 bg-[#0f172a] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Bot size={22} />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-none">SmartScreen AI</h4>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">Online Co-pilot</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/10' 
                    : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start animate-pulse">
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 text-sm italic">
                    Neural engine thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Contextual Quick Actions */}
          <div className="px-6 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(action.query)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all whitespace-nowrap shadow-sm"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white border-t border-slate-50">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask your AI agent anything..."
                className="w-full pl-6 pr-14 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-medium text-sm transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-30 shadow-lg shadow-blue-500/20"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-[9px] text-center text-slate-400 mt-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <Zap size={10} className="text-amber-500" /> Powered by Gemini-3 Flash Engine
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistAgent;