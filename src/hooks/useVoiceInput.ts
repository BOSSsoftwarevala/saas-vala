import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  autoSend?: boolean;
  language?: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

export function useVoiceInput({ onTranscript, autoSend = true, language = 'en-US' }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        console.log('Voice recognition started');
        setIsListening(true);
      };

      recognition.onend = () => {
        console.log('Voice recognition ended');
        setIsListening(false);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(finalTranscript);
          if (autoSend) {
            onTranscript(finalTranscript);
            recognition.stop();
          }
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);

        switch (event.error) {
          case 'no-speech':
            toast.error('No speech detected. Please try again.');
            break;
          case 'audio-capture':
            toast.error('No microphone found. Please check your device.');
            break;
          case 'not-allowed':
            toast.error('Microphone access denied. Please allow microphone access.');
            break;
          default:
            toast.error(`Voice error: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, onTranscript, autoSend]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      toast.error('Voice input not supported in this browser. Try Chrome or Edge.');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setTranscript('');
      recognitionRef.current?.start();
      toast.success('Listening... Speak now!', { duration: 2000 });
    } catch (error) {
      console.error('Microphone access error:', error);
      toast.error('Could not access microphone. Please allow microphone access.');
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
