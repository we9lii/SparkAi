export type Role = 'user' | 'assistant';

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface Message {
  role: Role;
  parts: Part[];
  isError?: boolean;
}

export type Theme = 'light' | 'dark';

export type Model = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: Model;
  createdAt: string;
}