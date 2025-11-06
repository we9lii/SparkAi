import React from 'react';
import { DEVELOPER_LOGO_URL } from '../constants';
import { MenuIcon } from './icons';

interface HeaderProps {
    onToggleSidebar: () => void;
    showLogo: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, showLogo }) => {
  return (
    <header className="absolute top-0 right-0 left-0 flex items-center justify-between p-4 z-10">
      <div className="flex items-center gap-4">
        <button onClick={onToggleSidebar} className="p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors backdrop-blur-sm">
          <MenuIcon className="h-6 w-6" />
        </button>
        <img 
            src={DEVELOPER_LOGO_URL} 
            alt="شعار المطور" 
            className={`h-20 w-20 rounded-full transition-opacity duration-300 ease-in-out ${showLogo ? 'opacity-100' : 'opacity-0'}`} 
        />
      </div>
    </header>
  );
};