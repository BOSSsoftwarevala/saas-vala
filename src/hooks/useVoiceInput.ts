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
      recognition.continuous = false; // Stop after first result for better UX
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('🎤 Voice recognition started');
        setIsListening(true);
      };

      recognition.onend = () => {
        console.log('🎤 Voice recognition ended');
        setIsListening(false);
      };

      // Handle audio start - user's mic is active
      recognition.onaudiostart = () => {
        console.log('🎤 Audio capturing started');
      };

      recognition.onspeechstart = () => {
        console.log('🎤 Speech detected!');
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
        console.error('🎤 Speech recognition error:', event.error);
        setIsListening(false);

        switch (event.error) {
          case 'no-speech':
            toast.info('No speech heard. Tap mic and speak clearly into your microphone.', { duration: 4000 });
            break;
          case 'audio-capture':
            toast.error('No microphone found. Please connect a microphone.');
            break;
          case 'not-allowed':
            toast.error('Microphone blocked! Click the lock 🔒 icon in browser address bar to allow.');
            break;
          case 'network':
            toast.error('Network error. Check your internet connection.');
            break;
          case 'aborted':
            // User stopped - don't show error
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
      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      setTranscript('');
      
      // Small delay to ensure recognition is ready
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
          toast.success('🎤 Listening... Speak now!', { duration: 2000 });
        } catch (startError: any) {
          console.error('Recognition start error:', startError);
          if (startError.message?.includes('already started')) {
            // Already running, just update state
            setIsListening(true);
          } else {
            toast.error('Could not start voice recognition. Please try again.');
          }
        }
      }, 100);
    } catch (error: any) {
      console.error('Microphone access error:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Microphone blocked! Click the 🔒 icon in your browser address bar to allow access.', {
          duration: 5000
        });
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Voice input requires HTTPS. Please use a secure connection.');
      } else {
        toast.error(`Microphone error: ${error.message || 'Unknown error'}. Please check browser permissions.`);
      }
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
