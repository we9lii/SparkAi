import { GoogleGenAI, Modality, Chat } from '@google/genai';
import type { Message, Model, Part, FileEntry } from '../types';

function mapMessagesToGeminiHistory(messages: Message[]) {
    return messages
      .filter(msg => msg.parts.some(part => (part as {text: string}).text?.trim() || (part as any).inlineData))
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: msg.parts.map(part => {
            if ('text' in part) {
                return { text: part.text };
            }
            return {
                inlineData: {
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data,
                }
            }
        })
    }));
}

export async function* generateResponseStream(
  ai: GoogleGenAI,
  systemPrompt: string,
  history: Message[],
  newParts: Part[],
  model: Model,
): AsyncGenerator<string> {
  try {
    const chat: Chat = ai.chats.create({
        model: model,
        config: {
            systemInstruction: systemPrompt,
        },
        history: mapMessagesToGeminiHistory(history),
    });

    const responseStream = await chat.sendMessageStream({ message: newParts as any }); // Cast needed due to SDK typing
    
    for await (const chunk of responseStream) {
        yield chunk.text;
    }

  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to get response from Gemini API.");
  }
};


// --- Text-to-Speech ---

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  const sampleRate = 24000;
  const numChannels = 1;
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export async function generateSpeech(text: string): Promise<AudioBuffer | null> {
    try {
        const apiKey = (import.meta.env as any).GEMINI_API_KEY || (process.env as any)?.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Missing GEMINI_API_KEY in environment.');
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const decodedBytes = decode(base64Audio);
            const audioBuffer = await decodeAudioData(decodedBytes, outputAudioContext);
            return audioBuffer;
        }
        return null;

    } catch (error) {
        console.error("Gemini TTS error:", error);
        throw new Error("Failed to generate speech from Gemini API.");
    }
}

// --- Title Generation ---

export async function generateTitle(
  userPrompt: string,
  assistantResponse: string
): Promise<string> {
  try {
    const apiKey = (import.meta.env as any).GEMINI_API_KEY || (process.env as any)?.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY in environment.');
    }
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `بناءً على الحوار التالي، اقترح عنوانًا قصيرًا وموجزًا (4 كلمات كحد أقصى) لهذه المحادثة. أجب بالعنوان فقط دون أي مقدمات أو نصوص إضافية.

المستخدم: "${userPrompt}"
المساعد: "${assistantResponse}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const title = response.text.trim().replace(/^"|"$/g, '');
    return title;
  } catch (error) {
    console.error("Gemini Title Generation error:", error);
    return ''; 
  }
}

// --- Project Manifest Generation ---

export async function generateProjectManifest(
  description: string,
  model: Model = 'gemini-2.5-pro'
): Promise<FileEntry[]> {
  const apiKey = (import.meta.env as any).GEMINI_API_KEY || (process.env as any)?.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in environment.');
  }
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `أنت منشئ مشاريع واجهات أمامية. أنشئ ملفات مشروع React + Vite (واجهة فقط) حسب الوصف التالي.

المتطلبات:
- أجب بصيغة JSON فقط، بدون أي نص إضافي.
- البنية:
[
  {"path": "index.html", "content": "..."},
  {"path": "src/App.tsx", "content": "..."},
  {"path": "public/vite.svg", "content": "..."}
]
- لا تستخدم شفرات ثلاثية أو وسوم Markdown.
- اجعل المحتوى مكتوبًا بنص عادي داخل خاصية content.
- ضَع favicon باسم public/vite.svg حتى لا يظهر تحذير 404.
 - أضف ملفًا "preview.html" ذاتي الاكتفاء (Self-contained): كل CSS و JS بداخله بدون واردات خارجية أو وحدات، حتى نعرض معاينة مباشرة داخل iframe.

الوصف:
${description}
`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  const raw = response.text?.trim() ?? '';

  // Try direct JSON parse; then try to extract array region if needed.
  function tryParse(jsonText: string): FileEntry[] {
    const val = JSON.parse(jsonText);
    if (!Array.isArray(val)) throw new Error('Manifest must be a JSON array.');
    return val.map((item: any) => ({ path: String(item.path), content: String(item.content ?? '') }));
  }

  try {
    return tryParse(raw);
  } catch {
    // Attempt to find first [ ... ] block
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      const sliced = raw.slice(start, end + 1);
      return tryParse(sliced);
    }
    throw new Error('تعذر تحليل مخرجات النموذج إلى JSON صالح.');
  }
}
