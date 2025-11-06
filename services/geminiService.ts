import { GoogleGenAI, Modality, Chat } from '@google/genai';
import type { Message, Model, Part } from '../types';

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
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
        if (!apiKey) {
            throw new Error('Missing VITE_GEMINI_API_KEY in environment.');
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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
      throw new Error('Missing VITE_GEMINI_API_KEY in environment.');
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