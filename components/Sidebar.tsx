import React, { useState, useEffect, useRef } from 'react';
import type { Conversation, Model } from '../types';
import { PlusIcon, PencilIcon, TrashIcon } from './icons';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  selectedModel: Model;
  onModelChange: (model: Model) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const ConversationItem: React.FC<{
    conv: Conversation;
    isActive: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onRename: (newTitle: string) => void;
}> = ({ conv, isActive, onSelect, onDelete, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(conv.title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);
    
    useEffect(() => {
        setTitle(conv.title);
    }, [conv.title]);

    const handleRename = () => {
        if (title.trim()) {
            onRename(title.trim());
        } else {
            setTitle(conv.title); // Reset if empty
        }
        setIsEditing(false);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleRename();
        } else if (e.key === 'Escape') {
            setTitle(conv.title);
            setIsEditing(false);
        }
    }

    return (
        <li className="group relative">
            {isEditing ? (
                 <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    className="w-full text-right p-2 rounded-md truncate text-sm bg-zinc-200 dark:bg-zinc-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
            ) : (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={onSelect}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
                    className={`w-full text-right p-2 rounded-md truncate text-sm transition-colors flex items-center justify-between cursor-pointer ${
                    isActive
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                >
                    <span className="truncate">{conv.title}</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1 hover:text-white"><PencilIcon className="h-4 w-4" /></button>
                       <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`هل أنت متأكد من حذف "${conv.title}"؟`)) onDelete(); }} className="p-1 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                </div>
            )}
        </li>
    )
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  selectedModel,
  onModelChange,
  onDeleteConversation,
  onRenameConversation,
  isOpen,
  onClose,
}) => {
  return (
    <aside className={`sidebar-panel w-72 bg-white/30 dark:bg-zinc-900/50 backdrop-blur-xl flex flex-col border-l border-black/5 dark:border-white/10
        fixed top-0 h-full z-40 transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
    `}>
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5" />
          محادثة جديدة
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-2">
        <h2 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 px-2 my-2">
          سجل المحادثات
        </h2>
        <ul className="space-y-1">
          {conversations.map((conv) => (
            <ConversationItem 
                key={conv.id}
                conv={conv}
                isActive={activeConversationId === conv.id}
                onSelect={() => onSelectConversation(conv.id)}
                onDelete={() => onDeleteConversation(conv.id)}
                onRename={(newTitle) => onRenameConversation(conv.id, newTitle)}
            />
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-zinc-200/50 dark:border-zinc-800/50">
        <h2 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 mb-2">
          الإعدادات
        </h2>
        <div className="space-y-2">
          <label htmlFor="model-select" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            اختر النموذج
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value as Model)}
            className="w-full p-2 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          </select>
          
        </div>
      </div>
    </aside>
  );
};
