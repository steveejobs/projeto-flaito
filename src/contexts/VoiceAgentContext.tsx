import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useActiveClient } from './ActiveClientContext';
import { useAuth } from './AuthContext';
import { useOfficeSession } from '@/hooks/useOfficeSession';
import { UnifiedAgent } from '@/types/agents';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ============================================================
// Types & Enums
// ============================================================

export enum AssistantState {
  IDLE = "idle",
  LISTENING_WAKE_WORD = "listening_for_wake_word",
  CAPTURING_COMMAND = "capturing_command",
  PROCESSING = "processing",
  SPEAKING = "speaking",
  ERROR = "error"
}

export type VoiceMode = 'consultation' | 'assisted' | 'critical' | 'automatic';

export interface AssistantSession {
  sessionId: string;
  createdAt: Date;
  lastInteractionAt: Date;
  transcriptHistory: { user: string; assistant: string; timestamp: Date }[];
  pendingConfirmation?: { actionId: string; intent: string; args: Record<string, any>; expiresAt: Date };
}

export interface VoiceAgentContextType {
  isActive: boolean;
  state: AssistantState;
  wakeWord: string;
  transcript: string;
  interimTranscript: string;
  isCapturingAudio: boolean;
  currentSession: AssistantSession | null;
  mode: VoiceMode;
  isBrowserSupported: boolean;
  effectiveMode: VoiceMode | null;
  pendingAction: { actionId: string; intent: string; expiresAt: Date } | null;
  setSilenceSeconds: (s: number) => void;
  logs: string[];
  toggleActive: (state?: boolean) => void;
  setWakeWord: (word: string) => void;
  setMode: (m: VoiceMode) => void;
  speak: (text: string, ttsConfig?: any) => void;
  manuallyTriggerListening: () => void;
  cancelCapture: () => void;
  resetSession: () => void;
}

// ============================================================
// Config constants
// ============================================================

const WAKE_WORD_DEBOUNCE_MS = 1500;
const COOLDOWN_AFTER_TTS_MS = 2500;
const COMMAND_TIMEOUT_MS = 12000;
const SESSION_STORAGE_KEY = '@flaito:voiceSession';

const VoiceAgentContext = createContext<VoiceAgentContextType | undefined>(undefined);

// ============================================================
// Provider Component
// ============================================================

export const VoiceAgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Compatibilidade
  const [isBrowserSupported, setIsBrowserSupported] = useState<boolean>(true);

  // Estado da assistente
  const [isActive, setIsActive] = useState<boolean>(false);
  const [state, setState] = useState<AssistantState>(AssistantState.IDLE);
  const [wakeWord, setWakeWordState] = useState<string>('athena');
  const [mode, setModeState] = useState<VoiceMode>('automatic');
  const [effectiveMode, setEffectiveMode] = useState<VoiceMode | null>(null);
  const [pendingAction, setPendingAction] = useState<{ actionId: string; intent: string; expiresAt: Date } | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isCapturingAudio, setIsCapturingAudio] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<AssistantSession | null>(null);
  const [silenceSeconds, setSilenceSecondsState] = useState<number>(2);
  const [logs, setLogs] = useState<string[]>([]);

  // Refs
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isSpeakingRef = useRef<boolean>(false);
  const commandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastWakeWordDetectionRef = useRef<number>(0);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-4), msg]);
    console.log(`[VoiceAgent] ${msg}`);
  }, []);

  // ============================================================
  // Settings & DB Sync
  // ============================================================

  const { activeProfile } = useActiveClient();
  const { officeId } = useOfficeSession(user?.id);
  const [agentConfig, setAgentConfig] = useState<Partial<UnifiedAgent> | null>(null);

  const loadSettingsAndSync = useCallback(async () => {
    if (!officeId) return;
    
    try {
      // Fetch centralized config from Agent Studio (ai_agent_configs)
      const { data, error } = await supabase
        .from('ai_agent_configs')
        .select('*')
        .eq('slug', 'voice-assistant')
        .or(`office_id.eq.${officeId},office_id.is.null`)
        .order('office_id', { ascending: false }) // office-specific first
        .limit(1)
        .maybeSingle();

      if (data) {
        setAgentConfig(data);
        const meta = data.metadata || {};
        if (meta.wake_word) setWakeWordState(meta.wake_word);
        addLog(`Configuração '${data.name}' carregada.`);
      }
    } catch (e) {
      console.warn('[VoiceAgent] Sync failed:', e);
    }
  }, [officeId, addLog]);

  const setMode = useCallback(async (newMode: VoiceMode) => {
    setModeState(newMode);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_voice_settings').upsert({
          user_id: user.id,
          default_voice_mode: newMode,
          updated_at: new Date().toISOString()
        });
        addLog(`Modo alterado para: ${newMode}`);
      }
    } catch (e) {
      toast.error('Erro ao salvar preferência de modo.');
    }
  }, [addLog]);

  const setWakeWord = useCallback(async (word: string) => {
    const normalized = word.toLowerCase();
    setWakeWordState(normalized);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_voice_settings').upsert({
          user_id: user.id,
          wake_word: normalized,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) { }
  }, []);

  const setSilenceSeconds = useCallback((s: number) => {
    const validValue = Math.max(1.5, Math.min(5, Number(s.toFixed(1))));
    setSilenceSecondsState(validValue);
    addLog(`Configuração: Silêncio ajustado para ${validValue}s`);
  }, [addLog]);

  // ============================================================
  // Session & Transitions
  // ============================================================

  const transitionTo = useCallback((newState: AssistantState) => {
    addLog(`Transition: ${state} \u2192 ${newState}`);
    setState(newState);
    if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = null;
    }
  }, [state, addLog]);

  const cancelCapture = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      audioPlaybackRef.current = null;
    }
    window.speechSynthesis?.cancel();
    isSpeakingRef.current = false;
    setTranscript('');
    setInterimTranscript('');
    transitionTo(AssistantState.LISTENING_WAKE_WORD);
    if (isActive) {
      try { recognitionRef.current?.start(); } catch { }
    }
  }, [isActive, transitionTo]);

  const resetSession = useCallback(() => {
    cancelCapture();
    setCurrentSession({
        sessionId: crypto.randomUUID(),
        createdAt: new Date(),
        lastInteractionAt: new Date(),
        transcriptHistory: []
    });
    toast.success('Sessão reiniciada.');
  }, [cancelCapture]);

  // ============================================================
  // Audio Input/Output Logic
  // ============================================================

  const speak = useCallback((text: string, ttsConfig?: any) => {
    if (!text) return;
    
    const onEnd = () => {
      cooldownTimeoutRef.current = setTimeout(() => {
        if (isActive && !isSpeakingRef.current) {
          try { recognitionRef.current?.start(); } catch { }
          transitionTo(AssistantState.LISTENING_WAKE_WORD);
        }
      }, COOLDOWN_AFTER_TTS_MS);
    };

    isSpeakingRef.current = true;
    if (recognitionRef.current) recognitionRef.current.stop();
    transitionTo(AssistantState.SPEAKING);

    if (ttsConfig?.audioBase64) {
      const audio = new Audio(ttsConfig.audioBase64);
      audioPlaybackRef.current = audio;
      audio.onended = () => { isSpeakingRef.current = false; onEnd(); };
      audio.onerror = () => { isSpeakingRef.current = false; onEnd(); };
      audio.play().catch(onEnd);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.onend = () => { isSpeakingRef.current = false; onEnd(); };
      window.speechSynthesis.speak(utterance);
    }
  }, [isActive, transitionTo]);

  const processCommand = async (blob: Blob | null, text?: string) => {
    transitionTo(AssistantState.PROCESSING);
    try {
      const payload: any = {
        sessionId: currentSession?.sessionId,
        inputMode: blob ? "voice" : "text",
        command: text,
        currentPath: location.pathname,
        confirmActionId: pendingAction?.actionId,
        mode,
        // Context Awareness (Parity with LexosChatAssistant)
        activeClientId: activeProfile?.id,
        vertical: location.pathname.includes('/medical') ? 'MEDICAL' : 'LEGAL',
        // Configuration Overrides
        voiceSettings: agentConfig?.metadata || {}
      };

      if (blob) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
        });
        payload.audioBase64 = base64;
      }

      const { data, error } = await supabase.functions.invoke('voice-assistant', { body: payload });
      if (error) throw error;

      const res = data as any;
      speak(res.reply, res.tts);

      // Handle Handshake (Stage 7)
      if (res.action === 'require_confirmation') {
        setPendingAction({
            actionId: res.pendingActionId,
            intent: res.intent,
            expiresAt: new Date(res.expires_at)
        });
      } else {
        setPendingAction(null);
      }

      if (res.mode_effective) {
          setEffectiveMode(res.mode_effective);
      }

    } catch (e) {
      toast.error('Ocorreu um erro ao processar seu comando.');
      transitionTo(AssistantState.LISTENING_WAKE_WORD);
      if (isActive) try { recognitionRef.current?.start(); } catch { }
    }
  };

  const startMediaRecorder = useCallback(async (): Promise<Blob | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      
      return new Promise((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach(t => t.stop());
          resolve(blob);
        };
        recorder.start();
        setIsCapturingAudio(true);
      });
    } catch {
      toast.error('Erro ao acessar microfone.');
      return null;
    }
  }, []);

  // ============================================================
  // Wake Word & Recognition Setup
  // ============================================================

  const setupRecognition = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setIsBrowserSupported(false);
      return;
    }

    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'pt-BR';

    rec.onresult = (event: any) => {
      if (isSpeakingRef.current || state === AssistantState.PROCESSING) return;

      let resultText = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        resultText += event.results[i][0].transcript;
      }
      
      const normalized = resultText.toLowerCase().trim();
      setInterimTranscript(normalized);

      if (state === AssistantState.LISTENING_WAKE_WORD && normalized.includes(wakeWord)) {
          const now = Date.now();
          if (now - lastWakeWordDetectionRef.current < WAKE_WORD_DEBOUNCE_MS) return;
          lastWakeWordDetectionRef.current = now;
          
          addLog(`Detectado "${wakeWord}"!`);
          transitionTo(AssistantState.CAPTURING_COMMAND);

          startMediaRecorder().then(blob => {
            setIsCapturingAudio(false);
            if (blob && blob.size > 1000) processCommand(blob);
          });

          // Detector de silêncio para encerrar CAPTURING_COMMAND
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
          }, silenceSeconds * 1000);
      }
    };

    rec.onend = () => {
      if (isActive && !isSpeakingRef.current && state !== AssistantState.CAPTURING_COMMAND) {
          try { rec.start(); } catch { }
      }
    };

    recognitionRef.current = rec;
  }, [isActive, state, wakeWord, silenceSeconds, startMediaRecorder]);

  // ============================================================
  // Manual Trigger (PTT)
  // ============================================================

  const manuallyTriggerListening = useCallback(() => {
    addLog('Acionamento manual (PTT)');
    if (isSpeakingRef.current) window.speechSynthesis.cancel();
    
    transitionTo(AssistantState.CAPTURING_COMMAND);
    if (recognitionRef.current) recognitionRef.current.stop();

    startMediaRecorder().then(blob => {
        setIsCapturingAudio(false);
        if (blob) processCommand(blob);
    });
  }, [transitionTo, startMediaRecorder]);

  const toggleActive = useCallback((val?: boolean) => {
    const next = val !== undefined ? val : !isActive;
    setIsActive(next);
    if (next) {
        loadSettingsAndSync();
        setupRecognition();
        try { recognitionRef.current?.start(); } catch { }
        transitionTo(AssistantState.LISTENING_WAKE_WORD);
    } else {
        if (recognitionRef.current) recognitionRef.current.stop();
        transitionTo(AssistantState.IDLE);
    }
  }, [isActive, loadSettingsAndSync, setupRecognition, transitionTo]);

  // Lifecycle
  useEffect(() => {
    const saved = localStorage.getItem('@flaito:voiceAgentActive');
    if (saved === 'true') toggleActive(true);
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, []);

  return (
    <VoiceAgentContext.Provider
      value={{
        isActive, state, wakeWord, transcript, interimTranscript, isCapturingAudio,
        currentSession, mode, isBrowserSupported, silenceSeconds,
        setSilenceSeconds, logs, toggleActive, setWakeWord, setMode, speak,
        manuallyTriggerListening, cancelCapture, resetSession,
        effectiveMode, pendingAction, processCommand
      }}
    >
      {children}
    </VoiceAgentContext.Provider>
  );
};

export const useVoiceAgent = () => {
  const context = useContext(VoiceAgentContext);
  if (!context) throw new Error('useVoiceAgent out of provider');
  return context;
};
