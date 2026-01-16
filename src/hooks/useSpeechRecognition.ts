import { useState, useRef, useEffect, useCallback } from 'react';
import { logger } from '../logger';

export const useSpeechRecognition = (onResult: (transcript: string) => void) => {
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = 'vi-VN';

          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
          };

          recognition.onerror = (event: any) => {
            logger.error('Speech recognition error:', event.error);
            setIsRecording(false);
          };

          recognition.onend = () => setIsRecording(false);
          recognitionRef.current = recognition;
        }
      }
    } catch (err) {
      logger.error('Failed to initialize Speech Recognition', err);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult]);

  const startRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        logger.error('Could not start speech recognition:', err);
        setIsRecording(false);
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return { isRecording, startRecording, stopRecording };
};