import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface VoiceConversationOptions {
  onTranscript?: (text: string) => void;
  onAiResponse?: (text: string) => void;
  onStateChange?: (state: VoiceState) => void;
  language?: string;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

const STT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-stt`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export function useVoiceConversation({
  onTranscript,
  onAiResponse,
  onStateChange,
  language = 'en-US'
}: VoiceConversationOptions = {}) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const updateState = useCallback((newState: VoiceState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      abortControllerRef.current?.abort();
    };
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Send recorded audio to ElevenLabs Scribe for transcription
  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(STT_URL, {
      method: 'POST',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: formData,
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'STT failed' }));
      throw new Error(err.error || 'Transcription failed');
    }

    const data = await response.json();
    return data.text || '';
  }, []);

  // Process voice: AI response + TTS
  const processVoiceInput = useCallback(async (text: string) => {
    updateState('processing');

    try {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Get AI response
      const aiResponse = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          stream: false
        }),
        signal: abortControllerRef.current.signal
      });

      if (!aiResponse.ok) throw new Error('AI request failed');

      const aiData = await aiResponse.json();
      const responseText = aiData.response || aiData.error || 'No response';
      onAiResponse?.(responseText);

      // Convert to speech via ElevenLabs TTS
      updateState('speaking');

      try {
        const ttsResponse = await fetch(TTS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: responseText.length > 500 ? responseText.substring(0, 500) + '...' : responseText,
            returnBase64: true
          }),
          signal: abortControllerRef.current.signal
        });

        if (!ttsResponse.ok) {
          speakWithBrowser(responseText);
          return;
        }

        const ttsData = await ttsResponse.json();

        if (ttsData.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${ttsData.audioContent}`;
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.onended = () => updateState('idle');
          audio.onerror = () => speakWithBrowser(responseText);
          await audio.play();
        } else {
          speakWithBrowser(responseText);
        }
      } catch {
        speakWithBrowser(responseText);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Voice processing error:', error);
      toast.error('Voice processing failed. Try again.');
      updateState('idle');
    }
  }, [onAiResponse, updateState]);

  // Browser TTS fallback
  const speakWithBrowser = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => updateState('idle');
      utterance.onerror = () => updateState('idle');
      window.speechSynthesis.speak(utterance);
    } else {
      updateState('idle');
    }
  }, [updateState]);

  // Start recording from microphone
  const startListening = useCallback(async () => {
    try {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis?.cancel();

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Stop mic tracks
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size < 1000) {
          toast.info('No speech detected. Tap mic and speak clearly.');
          updateState('idle');
          return;
        }

        // Transcribe with ElevenLabs Scribe
        updateState('processing');
        setTranscript('Transcribing...');

        try {
          abortControllerRef.current = new AbortController();
          const text = await transcribeAudio(audioBlob);

          if (!text.trim()) {
            toast.info('Could not understand speech. Try again.');
            updateState('idle');
            setTranscript('');
            return;
          }

          setTranscript(text);
          onTranscript?.(text);

          // Process through AI
          await processVoiceInput(text);
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.error('Transcription error:', error);
            toast.error('Voice recognition failed. Try again.');
          }
          updateState('idle');
          setTranscript('');
        }
      };

      recorder.onerror = () => {
        toast.error('Recording failed. Check microphone.');
        updateState('idle');
      };

      recorder.start(250); // Collect data every 250ms
      updateState('listening');
      toast.success('🎤 Listening... Tap mic again when done.', { duration: 3000 });

    } catch (error: any) {
      console.error('Mic error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone blocked. Click the 🔒 icon in browser to allow.');
      } else {
        toast.error('Microphone error. Check permissions.');
      }
    }
  }, [onTranscript, transcribeAudio, processVoiceInput, updateState]);

  // Stop everything
  const stop = useCallback(() => {
    stopRecording();
    abortControllerRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    updateState('idle');
    setTranscript('');
  }, [updateState, stopRecording]);

  // Toggle voice - if listening, stop recording (triggers transcription). If idle, start.
  const toggle = useCallback(() => {
    if (state === 'listening') {
      // Stop recording - this triggers onstop which does transcription
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } else if (state === 'idle') {
      startListening();
    } else {
      stop();
    }
  }, [state, startListening, stop]);

  return {
    state,
    transcript,
    isSupported: true, // MediaRecorder is universally supported
    isActive: state !== 'idle',
    startListening,
    stop,
    toggle,
  };
}
