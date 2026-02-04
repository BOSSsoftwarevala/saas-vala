import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface VoiceConversationOptions {
  onTranscript?: (text: string) => void;
  onAiResponse?: (text: string) => void;
  onStateChange?: (state: VoiceState) => void;
  language?: string;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

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
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update state and notify
  const updateState = useCallback((newState: VoiceState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('🎤 Listening...');
        updateState('listening');
      };

      recognition.onend = () => {
        console.log('🎤 Recognition ended');
        if (state === 'listening') {
          updateState('idle');
        }
      };

      recognition.onresult = (event: any) => {
        let finalText = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        if (finalText) {
          console.log('🎤 Final transcript:', finalText);
          setTranscript(finalText);
          onTranscript?.(finalText);
          recognition.stop();
          // Process the speech
          processVoiceInput(finalText);
        } else {
          setTranscript(interimText);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('🎤 Recognition error:', event.error);
        updateState('idle');
        
        if (event.error === 'no-speech') {
          toast.info('No speech detected. Try speaking closer to your microphone.');
        } else if (event.error === 'not-allowed') {
          toast.error('Microphone blocked. Click the 🔒 icon in your browser to allow.');
        } else if (event.error !== 'aborted') {
          toast.error(`Voice error: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.stop();
      abortControllerRef.current?.abort();
    };
  }, [language, onTranscript, updateState]);

  // Process voice input through AI and speak response
  const processVoiceInput = useCallback(async (text: string) => {
    updateState('processing');
    
    try {
      // Cancel any pending requests
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Get AI response (non-streaming for voice)
      console.log('🤖 Getting AI response...');
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

      if (!aiResponse.ok) {
        throw new Error('AI request failed');
      }

      const aiData = await aiResponse.json();
      const responseText = aiData.response || aiData.error || 'No response';
      
      console.log('🤖 AI response:', responseText.substring(0, 100) + '...');
      onAiResponse?.(responseText);

      // Convert to speech
      updateState('speaking');
      console.log('🔊 Converting to speech...');
      
      // Try ElevenLabs TTS first, fall back to browser TTS
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
          console.log('🔊 ElevenLabs unavailable, using browser TTS');
          speakWithBrowser(responseText);
          return;
        }

        const ttsData = await ttsResponse.json();
        
        if (ttsData.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${ttsData.audioContent}`;
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          
          audio.onended = () => {
            console.log('🔊 Audio finished');
            updateState('idle');
          };
          
          audio.onerror = () => {
            console.log('🔊 Audio error, falling back to browser TTS');
            speakWithBrowser(responseText);
          };
          
          await audio.play();
        } else {
          speakWithBrowser(responseText);
        }
      } catch (ttsError) {
        console.log('🔊 TTS error, using browser fallback:', ttsError);
        speakWithBrowser(responseText);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error('Voice processing error:', error);
      toast.error('Voice processing failed. Try again.');
      updateState('idle');
    }
  }, [onAiResponse, updateState]);

  // Fallback browser TTS
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

  // Start voice conversation
  const startListening = useCallback(async () => {
    if (!isSupported) {
      toast.error('Voice not supported. Try Chrome or Edge.');
      return;
    }

    try {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis?.cancel();

      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setTranscript('');
      
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
          toast.success('🎤 Listening... Speak now!', { duration: 2000 });
        } catch (e: any) {
          if (!e.message?.includes('already started')) {
            console.error('Start error:', e);
            toast.error('Could not start voice. Try again.');
          }
        }
      }, 100);

    } catch (error: any) {
      console.error('Mic error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone blocked. Click the 🔒 icon to allow access.');
      } else {
        toast.error('Microphone error. Check permissions.');
      }
    }
  }, [isSupported]);

  // Stop everything
  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    abortControllerRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    updateState('idle');
  }, [updateState]);

  // Toggle voice
  const toggle = useCallback(() => {
    if (state === 'idle') {
      startListening();
    } else {
      stop();
    }
  }, [state, startListening, stop]);

  return {
    state,
    transcript,
    isSupported,
    isActive: state !== 'idle',
    startListening,
    stop,
    toggle,
  };
}
