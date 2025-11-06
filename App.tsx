import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { Sidebar } from './components/Sidebar';
import { generateResponseStream, generateTitle } from './services/geminiService';
import type { Theme, Message, Conversation, Model, Part } from './types';
import { DEVELOPER_LOGO_URL, SYSTEM_PROMPT } from './constants';
import { GoogleGenAI } from '@google/genai';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark'); // Hardcoded to dark theme
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const savedConversations = localStorage.getItem('chatHistory');
    return savedConversations ? JSON.parse(savedConversations) : [];
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
      const saved = localStorage.getItem('chatHistory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
      return null;
  });
  
  const [selectedModel, setSelectedModel] = useState<Model>('gemini-2.5-flash');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const stopGenerationRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(conversations));
  }, [conversations]);

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'محادثة جديدة',
      messages: [],
      model: selectedModel,
      createdAt: new Date().toISOString(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setIsSidebarOpen(false);
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const hasMessages = activeConversation ? activeConversation.messages.length > 0 : false;

  const generateConversationTitle = async (
    convId: string,
    userPrompt: string,
    assistantResponse: string
  ) => {
    try {
        const newTitle = await generateTitle(userPrompt, assistantResponse);
        if (newTitle) {
            handleRenameConversation(convId, newTitle);
        }
    } catch (error) {
        console.error('Failed to generate conversation title:', error);
        // Silently fail, the temporary title will remain
    }
  };

  const handleStopGenerating = useCallback(() => {
    stopGenerationRef.current = true;
    setIsLoading(false);
  }, []);

  const handleSendMessage = async (text: string, image?: { mimeType: string; data: string }) => {
    if (isLoading || (!text.trim() && !image)) return;

    let currentConvId = activeConversationId;
    let isNewConversation = false;
    const newTitle = text.trim() ? text.substring(0, 30) : 'صورة جديدة';

    if (!currentConvId || !conversations.find(c => c.id === currentConvId)) {
        isNewConversation = true;
        const newConvId = `conv-${Date.now()}`;
        const newConversation: Conversation = {
            id: newConvId,
            title: newTitle,
            messages: [],
            model: selectedModel,
            createdAt: new Date().toISOString(),
        };
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConvId);
        currentConvId = newConvId;
    }

    const userParts: Part[] = [];
    if (image) {
      userParts.push({ inlineData: image });
    }
    if (text.trim()) {
      userParts.push({ text: text });
    }

    const userMessage: Message = { role: 'user', parts: userParts };
    const assistantMessage: Message = { role: 'assistant', parts: [{ text: '' }] };

    setConversations(prev => prev.map(conv => 
      conv.id === currentConvId 
        ? { 
            ...conv,
            title: isNewConversation ? newTitle : conv.title,
            messages: [...conv.messages, userMessage, assistantMessage] 
          } 
        : conv
    ));
    
    setIsLoading(true);
    stopGenerationRef.current = false;
    
    let finalAssistantResponse = '';

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const currentConversation = conversations.find(c => c.id === currentConvId);
      const history = currentConversation?.messages.slice(0, -2) ?? [];
      const stream = generateResponseStream(ai, SYSTEM_PROMPT, history, userParts, selectedModel);
      
      let fullResponse = '';
      for await (const chunk of stream) {
        if (stopGenerationRef.current) {
            break;
        }
        fullResponse += chunk;
        setConversations(prev => prev.map(conv => {
          if (conv.id === currentConvId) {
            const newMessages = [...conv.messages];
            newMessages[newMessages.length - 1] = { role: 'assistant', parts: [{ text: fullResponse }] };
            return { ...conv, messages: newMessages };
          }
          return conv;
        }));
      }
      finalAssistantResponse = fullResponse;

    } catch (err) {
      const errorMessage = 'عذرًا، في مشكلة بالاتصال!';
      setConversations(prev => prev.map(conv => {
         if (conv.id === currentConvId) {
            const newMessages = [...conv.messages];
            newMessages[newMessages.length - 1] = { role: 'assistant', parts: [{ text: errorMessage }], isError: true };
            return { ...conv, messages: newMessages };
         }
         return conv;
      }));
    } finally {
      setIsLoading(false);
      stopGenerationRef.current = false;

      if (isNewConversation && currentConvId && finalAssistantResponse) {
          const userTextPrompt = userParts.find(p => 'text' in p) as { text: string } | undefined;
          generateConversationTitle(
              currentConvId,
              userTextPrompt?.text ?? 'صورة',
              finalAssistantResponse
          );
      }
    }
  };

  const handleClearChat = useCallback(() => {
    if (!activeConversationId) return;
    setConversations(prev => prev.map(conv => 
      conv.id === activeConversationId 
        ? { ...conv, messages: [] } 
        : conv
    ));
  }, [activeConversationId]);
  
  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setIsSidebarOpen(false);
  }

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => {
      const newConversations = prev.filter(c => c.id !== id);
      if (activeConversationId === id) {
        setActiveConversationId(newConversations.length > 0 ? newConversations[0].id : null);
      }
      return newConversations;
    });
  }

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  }

  return (
    <div className="bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex h-screen transition-colors duration-300 overflow-hidden">
      <Sidebar 
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={createNewConversation}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
       {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-30 transition-opacity" />}
      <div className="flex flex-col flex-1 relative">
        <Header onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} showLogo={hasMessages} />
        <div className="flex-1 flex flex-col relative overflow-hidden pt-28">
            <main 
                className={`flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 transition-opacity duration-500 ${hasMessages ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <MessageList messages={activeConversation?.messages ?? []} />
            </main>

            <div 
                className={`absolute w-full px-4 transition-all duration-700 ease-in-out ${hasMessages ? 'bottom-0' : 'top-1/2 -translate-y-1/2'}`}
            >
                <div className="max-w-3xl mx-auto">
                    <div 
                        className={`text-center transition-all duration-500 ease-in-out transform ${hasMessages ? '-translate-y-8 opacity-0 h-0' : 'translate-y-0 opacity-100 h-auto mb-4'}`}
                        aria-hidden={hasMessages}
                    >
                        <img src={DEVELOPER_LOGO_URL} alt="شعار المطور" className="h-32 w-32 rounded-full mx-auto mb-4" />
                        <h2 className="text-2xl font-bold">كيف أقدر أخدمك اليوم؟</h2>
                    </div>
                    
                    <ChatInput 
                        onSendMessage={handleSendMessage} 
                        onClearChat={handleClearChat} 
                        isLoading={isLoading} 
                        onStopGenerating={handleStopGenerating}
                    />

                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;