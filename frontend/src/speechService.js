/**
 * speechService.js — vendor-agnostic speech-to-text + text-to-speech.
 *
 * Swap vendors in .env.local (no code changes):
 *   VITE_STT_PROVIDER=openai | google | browser
 *   VITE_TTS_PROVIDER=openai | google | browser
 */

const STT_PROVIDER = import.meta.env.VITE_STT_PROVIDER || 'openai';
const TTS_PROVIDER = import.meta.env.VITE_TTS_PROVIDER || 'openai';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;

/* ---------------- Speech to Text providers ---------------- */

const sttProviders = {
  openai: async (audioBlob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Whisper error: ${res.status}`);
    const data = await res.json();
    return data.text;
  },

  google: async (audioBlob) => {
    const arrayBuffer = await audioBlob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64Audio = btoa(binary);

    const res = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { languageCode: 'en-US' },
          audio: { content: base64Audio },
        }),
      }
    );
    if (!res.ok) throw new Error(`Google STT error: ${res.status}`);
    const data = await res.json();
    return data.results?.[0]?.alternatives?.[0]?.transcript || '';
  },

  browser: () =>
    new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return reject(new Error('Browser speech recognition not supported'));
      const rec = new SR();
      rec.lang = 'en-US';
      rec.onresult = (e) => resolve(e.results[0][0].transcript);
      rec.onerror = (e) => reject(new Error(e.error));
      rec.start();
    }),
};

/* ---------------- Text to Speech providers ---------------- */

const ttsProviders = {
  openai: async (text) => {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1', input: text, voice: 'alloy' }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS error: ${res.status}`);
    return await res.blob();
  },

  google: async (text) => {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'en-US', name: 'en-US-Neural2-C' },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      }
    );
    if (!res.ok) throw new Error(`Google TTS error: ${res.status}`);
    const data = await res.json();
    const binary = atob(data.audioContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'audio/mp3' });
  },

  browser: async (text) => {
    // Speaks directly; returns null so playAudio() is a no-op.
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    return null;
  },
};

/* ---------------- Public API ---------------- */

/** Start recording from the mic. Returns { stop } which resolves to an audio Blob. */
export async function recordAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  mediaRecorder.start();

  return {
    stop: () =>
      new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: 'audio/webm' }));
        };
        mediaRecorder.stop();
      }),
  };
}

export async function speechToText(audioBlob) {
  const fn = sttProviders[STT_PROVIDER];
  if (!fn) throw new Error(`Unknown STT provider: ${STT_PROVIDER}`);
  return fn(audioBlob);
}

export async function textToSpeech(text) {
  const fn = ttsProviders[TTS_PROVIDER];
  if (!fn) throw new Error(`Unknown TTS provider: ${TTS_PROVIDER}`);
  return fn(text);
}

export function playAudio(blob) {
  if (!blob) return; // browser TTS already spoke
  const audio = new Audio(URL.createObjectURL(blob));
  audio.play();
}
