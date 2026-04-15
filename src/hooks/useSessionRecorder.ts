import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// IndexedDB Helper - Atualizado para Sessions
const DB_NAME = 'flaito-sessions-db';
const STORE_NAME = 'audio-chunks';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

interface ChunkData {
  id?: number;
  sessionId: string;
  officeId: string;
  chunkIndex: number;
  blob: Blob;
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
  duration: number;
  checksum: string;
}

export const useSessionRecorder = (sessionId: string | null, officeId: string | null) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [syncStatus, setSyncStatus] = useState<{ pending: number; synced: number }>({ pending: 0, synced: 0 });
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const syncIntervalRef = useRef<number | null>(null);

  // Hash Utility
  const calculateSHA256 = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Status updates
  const updateSyncStats = async () => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    return new Promise<void>((resolve) => {
      request.onsuccess = () => {
        const allChunks = request.result as ChunkData[];
        const sessionChunks = allChunks.filter(c => c.sessionId === sessionId);
        const pendingCount = sessionChunks.filter(c => c.status !== 'synced').length;
        const syncedCount = sessionChunks.filter(c => c.status === 'synced').length;
        
        setSyncStatus({
          pending: pendingCount,
          synced: syncedCount,
        });
        resolve();
      };
    });
  };

  // Sync Logic
  const syncChunks = useCallback(async () => {
    if (!sessionId || !officeId) return;

    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise<void>((resolve) => {
      request.onsuccess = async () => {
        const pendingChunks = (request.result as ChunkData[])
          .filter(c => c.sessionId === sessionId && c.status !== 'synced')
          .sort((a, b) => a.chunkIndex - b.chunkIndex);

        if (pendingChunks.length === 0) {
          resolve();
          return;
        }

        for (const chunk of pendingChunks) {
          try {
            const formData = new FormData();
            formData.append('session_id', chunk.sessionId);
            formData.append('office_id', chunk.officeId);
            formData.append('chunk_index', chunk.chunkIndex.toString());
            formData.append('file', chunk.blob, `chunk_${chunk.chunkIndex}.webm`);
            formData.append('checksum', chunk.checksum);
            formData.append('duration', chunk.duration.toString());

            const { error: uploadError } = await supabase.functions.invoke('session-processor', {
              body: formData,
              queryParams: { action: 'ingest_chunk' }
            });

            if (!uploadError) {
              const updateTx = db.transaction(STORE_NAME, 'readwrite');
              const updateStore = updateTx.objectStore(STORE_NAME);
              await updateStore.put({ ...chunk, status: 'synced' });
            } else {
              console.error('Upload failed for chunk', chunk.chunkIndex, uploadError);
            }
          } catch (e) {
            console.error('Error syncing chunk', e);
          }
        }
        await updateSyncStats();
        resolve();
      };
    });
  }, [sessionId, officeId]);

  // Start Sync Interval
  useEffect(() => {
    syncIntervalRef.current = window.setInterval(syncChunks, 10000); // Sync every 10s
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [syncChunks]);

  const startRecording = async () => {
    if (!sessionId || !officeId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const checksum = await calculateSHA256(e.data);
          const db = await initDB();
          const chunkData: ChunkData = {
            sessionId,
            officeId,
            chunkIndex: chunkIndexRef.current++,
            blob: e.data,
            status: 'pending',
            retryCount: 0,
            duration: 30, // assuming 30s timeslice
            checksum,
          };
          
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).add(chunkData);
          updateSyncStats();
        }
      };

      recorder.start(30000); // 30s chunks
      setIsRecording(true);
      setError(null);

      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording', err);
      setError('Acesso ao microfone negado ou falha no hardware.');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    
    console.log('[Recorder] Stop triggered. Awaiting final sync...');
    
    // Aguardar o flush final (máximo 5 tentativas)
    let pending = 1;
    let attempts = 0;
    while (pending > 0 && attempts < 5) {
      await syncChunks();
      const db = await initDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      pending = await new Promise<number>((resolve) => {
        request.onsuccess = () => {
          const sessionChunks = (request.result as ChunkData[]).filter(c => c.sessionId === sessionId);
          resolve(sessionChunks.filter(c => c.status !== 'synced').length);
        };
      });

      if (pending > 0) {
        console.log(`[Recorder] ${pending} chunks remaining. Waiting...`);
        await new Promise(r => setTimeout(r, 2000));
      }
      attempts++;
    }

    // Finalize session on backend
    if (sessionId && officeId) {
      const { data, error: finalError } = await supabase.functions.invoke('session-processor', {
        body: { session_id: sessionId, office_id: officeId },
        queryParams: { action: 'finalize_session' }
      });

      if (finalError) {
        console.error('Failed to finalize session', finalError);
        setError('Erro ao finalizar sessão. Algumas partes do áudio podem estar ausentes.');
      } else {
        console.log('[Recorder] Session finalized successfully:', data);
      }
    }
  };


  return {
    isRecording,
    duration,
    syncStatus,
    error,
    startRecording,
    stopRecording,
  };
};
