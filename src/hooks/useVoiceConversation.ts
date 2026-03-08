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
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number>(0);

  const startListening = useCallback(async () => {
    try {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis?.cancel();

      console.log('[VOICE] Requesting microphone access...');

      // Get microphone access with noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        }
      });
      streamRef.current = stream;
      console.log('[VOICE] Microphone access granted. Tracks:', stream.getAudioTracks().length);

      // Setup audio analyser for silence detection
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Monitor audio level
      let hasSpeech = false;
      silenceStartRef.current = 0;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkSilence = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        if (volume > 10) {
          hasSpeech = true;
          silenceStartRef.current = 0;
        } else if (hasSpeech && silenceStartRef.current === 0) {
          silenceStartRef.current = Date.now();
        }
        
        // Auto-stop after 2.5s silence (only if speech was detected)
        if (hasSpeech && silenceStartRef.current > 0 && Date.now() - silenceStartRef.current > 2500) {
          console.log('[VOICE] Auto-stopping after silence');
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          return;
        }
        
        silenceTimerRef.current = setTimeout(checkSilence, 100);
      };
      silenceTimerRef.current = setTimeout(checkSilence, 500);

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      console.log('[VOICE] Using MIME type:', mimeType);

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Clear silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        analyserRef.current = null;
        
        // Stop mic tracks
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('[VOICE] Recording stopped. Blob size:', audioBlob.size);

        if (audioBlob.size < 1000) {
          toast.info('🎤 Koi awaaz nahi mili. Mic ke paas bolein aur retry karein.', { duration: 4000 });
          updateState('idle');
          return;
        }

        // Transcribe with ElevenLabs Scribe
        updateState('processing');
        setTranscript('Samajh raha hoon...');

        try {
          abortControllerRef.current = new AbortController();
          const text = await transcribeAudio(audioBlob);
          console.log('[VOICE] Transcription result:', text);

          if (!text.trim()) {
            toast.info('🎤 Awaaz samajh nahi aayi. Clear bolein aur retry karein.');
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
            console.error('[VOICE] Transcription error:', error);
            toast.error('🎤 Voice recognition fail. Retry karein.');
          }
          updateState('idle');
          setTranscript('');
        }
      };

      recorder.onerror = (e) => {
        console.error('[VOICE] Recorder error:', e);
        toast.error('Recording fail. Microphone check karein.');
        updateState('idle');
      };

      // Auto-stop after 30 seconds max
      const maxTimer = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          console.log('[VOICE] Max duration reached, stopping');
          mediaRecorderRef.current.stop();
        }
      }, 30000);

      recorder.addEventListener('stop', () => clearTimeout(maxTimer), { once: true });

      recorder.start(250);
      updateState('listening');
      toast.success('🎤 Sun raha hoon... Boliye! (Auto-stop on silence)', { duration: 4000 });

    } catch (error: any) {
      console.error('Mic error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('🎤 Microphone blocked!', {
          description: 'Browser address bar mein 🔒 icon pe click karein → Microphone → Allow → Page refresh',
          duration: 8000,
        });
      } else if (error.name === 'NotFoundError') {
        toast.error('🎤 No microphone found!', {
          description: 'Koi mic connected nahi. Headset ya external mic lagayein.',
          duration: 6000,
        });
      } else if (error.name === 'NotReadableError' || error.name === 'AbortError') {
        toast.error('🎤 Microphone busy!', {
          description: 'Mic kisi aur app mein use ho raha hai. Band karein aur retry karein.',
          duration: 6000,
        });
      } else {
        toast.error('🎤 Microphone error', {
          description: `${error.message || error.name}. Browser refresh karke retry karein.`,
          duration: 6000,
        });
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
