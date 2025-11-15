import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, TrashIcon, PaperClipIcon, XCircleIcon, StopCircleIcon, MicrophoneIcon } from './icons';

interface ChatInputProps {
  onSendMessage: (text: string, image?: { mimeType: string; data: string }) => void;
  onClearChat: () => void;
  isLoading: boolean;
  onStopGenerating: () => void;
}

// Extend the Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    mimeType: file.type,
    data: await base64EncodedDataPromise,
  };
};

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, onClearChat, isLoading, onStopGenerating }) => {
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ file: File; preview: string; data?: { mimeType: string; data: string } } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // Reduced height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [text, image]);

   useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);
  
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ar-SA';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
           setText(prevText => prevText + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          alert('تم رفض الوصول إلى المايكروفون. يرجى تمكين الوصول في إعدادات المتصفح لاستخدام هذه الميزة.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
    
    return () => {
        recognitionRef.current?.stop();
    }
  }, []);
  
  const handleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (err) {
            console.error("Error starting speech recognition:", err);
            setIsListening(false);
        }
      } else {
        alert('المعذرة، خاصية الإدخال الصوتي غير مدعومة في متصفحك.');
      }
    }
  };


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      const data = await fileToGenerativePart(file);
      setImage({ file, preview, data });
    }
  };

  const handleSubmit = () => {
    if (text.trim() || image) {
      onSendMessage(text, image?.data);
      setText('');
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input flex flex-col gap-2 p-1.5 rounded-xl border border-zinc-300/50 dark:border-zinc-700/50 bg-zinc-50/80 dark:bg-zinc-800/70 backdrop-blur-lg focus-within:ring-2 focus-within:ring-blue-500 transition-shadow duration-200">
      {image && (
        <div className="relative w-20 h-20 m-1">
            <img src={image.preview} alt="Preview" className="w-full h-full object-cover rounded-md" />
            <button 
                onClick={() => {
                  setImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute -top-2 -right-2 bg-zinc-700 text-white rounded-full p-0.5"
                aria-label="Remove image"
            >
                <XCircleIcon className="w-5 h-5" />
            </button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <button 
          onClick={onClearChat}
          disabled={isLoading}
          className="p-2 rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
          aria-label="Clear chat history"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="p-2 rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
          aria-label="Attach file"
        >
            <PaperClipIcon className="h-5 w-5" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*"
        />
        <button
          onClick={handleListen}
          disabled={isLoading || !isSpeechSupported}
          className={`mic-button p-2 rounded-full focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end ${isListening ? 'text-red-500 bg-red-500/10 dark:bg-red-500/15' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-600'}`}
          aria-label="استخدام الإدخال الصوتي"
          aria-pressed={isListening}
          data-listening={isListening}
          data-supported={isSpeechSupported}
          title={isSpeechSupported ? (isListening ? 'الاستماع قيد التشغيل — اضغط للإيقاف' : 'التسجيل الصوتي') : 'خاصية الإدخال الصوتي غير مدعومة في هذا المتصفح'}
        >
          <MicrophoneIcon className={`h-5 w-5 ${isListening ? 'animate-pulse' : ''}`} />
          <span className="mic-dot" aria-hidden="true" />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب رسالتك هنا أو استخدم المايكروفون..."
          disabled={isLoading}
          rows={1}
          className="w-full bg-transparent focus:outline-none resize-none custom-scrollbar disabled:opacity-50 flex-1 self-center py-1.5"
          style={{ caretColor: '#3b82f6' }}
        />
        {isLoading ? (
            <button
                onClick={onStopGenerating}
                className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 dark:focus:ring-offset-zinc-800 transition-colors self-end"
                aria-label="Stop generating"
            >
                <StopCircleIcon className="h-5 w-5" />
            </button>
        ) : (
            <button
                onClick={handleSubmit}
                disabled={!text.trim() && !image}
                className="p-2 rounded-full btn-gradient text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 dark:focus:ring-offset-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors self-end"
                aria-label="Send message"
            >
                <SendIcon className="h-5 w-5" />
            </button>
        )}
      </div>
    </div>
  );
};
