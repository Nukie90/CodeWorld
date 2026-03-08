import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, User, Bot, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import axios from 'axios';

const ChatBot = ({ isDarkMode, projectContext }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [expandedReasoning, setExpandedReasoning] = useState({});

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMessage = { role: 'user', content: inputValue };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await axios.post('http://127.0.0.1:8000/api/ai/chat', {
                messages: newMessages,
                project_context: messages.length === 0 ? projectContext : null
            });

            if (response.data) {
                setMessages([...newMessages, response.data]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages([...newMessages, {
                role: 'assistant',
                content: `Error: ${error.response?.data?.detail || error.message}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleReasoning = (index) => {
        setExpandedReasoning(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className={`w-96 mb-4 rounded-3xl overflow-hidden flex flex-col shadow-2xl border transition-all duration-300 transform origin-bottom-right scale-100 ${isDarkMode ? 'bg-gray-900/40 border-white/10' : 'bg-white/40 border-black/5'
                    } backdrop-blur-2xl`}>

                    {/* Header */}
                    <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-white/10 bg-gray-800/20' : 'border-black/5 bg-white/20'}`}>
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-blue-500/20">
                                <Bot size={20} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>CodeWorld Assistant</h3>
                                <p className="text-[10px] text-blue-500 font-medium tracking-wider uppercase">Online • Nemotron 30B</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-600'}`}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 h-[400px] overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-blue-500/20 scrollbar-track-transparent">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                                <div className="p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20">
                                    <MessageSquare size={32} className="text-blue-500 opacity-50" />
                                </div>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Ask me anything about your project! I can help with metrics, complexity, and file structure.
                                </p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] rounded-tr-none'
                                    : (isDarkMode ? 'bg-white/10 text-gray-200 rounded-tl-none border border-white/5' : 'bg-white text-gray-700 rounded-tl-none shadow-sm border border-black/5')
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex items-center gap-2 text-blue-500 text-xs font-medium animate-pulse">
                                <Loader size={12} className="animate-spin" />
                                CodeWorld is thinking...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className={`p-4 border-t ${isDarkMode ? 'border-white/10 bg-gray-800/20' : 'border-black/5 bg-white/20'}`}>
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Ask about the project..."
                                className={`w-full pl-4 pr-12 py-3 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${isDarkMode ? 'bg-black/20 border-white/10 text-white placeholder-gray-500' : 'bg-white border-black/5 text-gray-900 placeholder-gray-400'
                                    } border shadow-inner`}
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isLoading}
                                className="absolute right-2 p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:scale-95 transition-all shadow-lg active:scale-90"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-4 rounded-3xl shadow-2xl transition-all duration-500 transform hover:scale-110 active:scale-90 flex items-center gap-3 border ${isOpen
                    ? 'bg-red-500 text-white border-red-400'
                    : 'bg-blue-600 text-white border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)]'
                    }`}
            >
                {isOpen ? <X size={24} /> : <>
                    <MessageSquare size={24} />
                    <span className="font-bold text-sm pr-2">AI Assistant</span>
                </>}
            </button>
        </div>
    );
};

export default ChatBot;
