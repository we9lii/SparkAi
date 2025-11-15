import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, Part } from '../types';
import { generateSpeech } from '../services/geminiService';
import { SpeakerWaveIcon, StopCircleIcon, ArrowPathIcon } from './icons';

interface MessageBubbleProps {
  message: Message;
}

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg my-2 relative text-zinc-900 dark:text-zinc-100">
            <div className="flex justify-between items-center px-4 py-2 bg-zinc-200 dark:bg-zinc-900/50 rounded-t-lg">
                <span className="text-xs font-sans text-zinc-500">Code</span>
                <button 
                    onClick={handleCopy}
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    {copied ? 'تم النسخ!' : 'نسخ'}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm custom-scrollbar" dir="ltr">
                <code>{code}</code>
            </pre>
        </div>
    );
};


export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  const bubbleClasses = isError
    ? 'bg-red-100 dark:bg-red-900/40 border border-red-500/50 text-red-800 dark:text-red-200 me-auto'
    : isUser
    ? 'bg-blue-600 text-white ms-auto'
    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 me-auto';

  const containerClasses = isUser ? 'flex justify-end' : 'flex justify-start';

  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const getTextContent = (parts: Part[]): string => {
    return parts.filter(p => 'text' in p).map(p => (p as { text: string }).text).join('\n');
  }
  
  const handlePlayAudio = async () => {
    if (audioState === 'playing' && audioSourceRef.current) {
        audioSourceRef.current.stop();
        setAudioState('idle');
        return;
    }
    if (audioState === 'loading') return;

    const textToSpeak = getTextContent(message.parts);
    if (!textToSpeak) return;

    setAudioState('loading');
    try {
        const audioBuffer = await generateSpeech(textToSpeak);
        if (audioBuffer) {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.onended = () => {
                setAudioState('idle');
                audioSourceRef.current = null;
            };
            source.start(0);
            audioSourceRef.current = source;
            setAudioState('playing');
        } else {
             setAudioState('idle');
        }
    } catch(error) {
        console.error("Failed to play audio:", error);
        setAudioState('idle');
    }
  }

  const renderAudioIcon = () => {
    switch(audioState) {
        case 'loading': return <ArrowPathIcon className="h-4 w-4 animate-spin" />;
        case 'playing': return <StopCircleIcon className="h-5 w-5" />;
        default: return <SpeakerWaveIcon className="h-5 w-5" />;
    }
  }

  // Handle streaming indicator
  const isEmptyAssistantMessage = message.role === 'assistant' && !isError && getTextContent(message.parts).trim() === '';
  if (isEmptyAssistantMessage) {
    return (
      <div className={containerClasses}>
        <div className={`p-3 rounded-lg max-w-sm md:max-w-md lg:max-w-2xl shadow ${bubbleClasses}`}>
           <div className="flex items-center justify-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-current animate-pulse [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 rounded-full bg-current animate-pulse [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
           </div>
        </div>
      </div>
    );
  }
  

  return (
    <div className={containerClasses}>
      <div className={`message-bubble-card p-3 rounded-lg max-w-sm md:max-w-md lg:max-w-2xl shadow ${bubbleClasses}`}>
        <div className="space-y-2">
         {message.parts.map((part, index) => {
           if ('inlineData' in part) {
             return <img key={index} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} alt="Uploaded content" className="rounded-lg max-w-full h-auto" />;
           }
           if ('text' in part) {
             return (
               <ReactMarkdown
                  key={index}
                  remarkPlugins={[remarkGfm]}
                  className="prose prose-zinc dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 max-w-none"
                  components={{
                    pre({ node, ...props }) {
                        const codeNode = node?.children[0];
                        if (codeNode && codeNode.type === 'element' && codeNode.tagName === 'code' && 'children' in codeNode) {
                            const codeString = String(codeNode.children[0]?.value).replace(/\n$/, '');
                            return <CodeBlock code={codeString} />;
                        }
                        return <pre {...props} className="bg-zinc-800 p-2 rounded-md custom-scrollbar" />;
                    },
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && !match ? (
                        <code className="bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-md text-sm font-mono" {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {part.text}
                </ReactMarkdown>
             );
           }
           return null;
         })}
        </div>
        {message.role === 'assistant' && !isError && getTextContent(message.parts).trim() && (
             <button onClick={handlePlayAudio} className="text-inherit opacity-70 hover:opacity-100 transition-opacity mt-2">
                 {renderAudioIcon()}
             </button>
        )}
      </div>
    </div>
  );
};
