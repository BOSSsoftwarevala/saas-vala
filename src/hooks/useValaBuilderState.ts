import { useCallback, useMemo, useState } from 'react';

export type BuilderRunStatus = '' | 'pending' | 'running' | 'success' | 'fail';

export interface ValaBuilderPersistedState {
  appName: string;
  prompt: string;
  selectedServerId: string;
  runId: string;
  runStatus: BuilderRunStatus;
  demoUrl: string;
  githubUrl: string;
  apkQueueId: string;
  productId: string;
  environment: 'dev' | 'staging' | 'production';
  templateKey: string;
  priority: number;
}

const STORAGE_KEY = 'vala_builder_state_v1';

const DEFAULT_STATE: ValaBuilderPersistedState = {
  appName: '',
  prompt: '',
  selectedServerId: '',
  runId: '',
  runStatus: '',
  demoUrl: '',
  githubUrl: '',
  apkQueueId: '',
  productId: '',
  environment: 'staging',
  templateKey: '',
  priority: 3,
};

function loadState(): ValaBuilderPersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      priority: Math.max(1, Math.min(10, Number(parsed?.priority || DEFAULT_STATE.priority))),
      environment: ['dev', 'staging', 'production'].includes(parsed?.environment) ? parsed.environment : 'staging',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useValaBuilderStateStore() {
  const [state, setState] = useState<ValaBuilderPersistedState>(() => loadState());

  const persist = useCallback((next: ValaBuilderPersistedState) => {
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const patch = useCallback((partial: Partial<ValaBuilderPersistedState>) => {
    setState((prev) => {
      const next = {
        ...prev,
        ...partial,
      } as ValaBuilderPersistedState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRunData = useCallback(() => {
    patch({
      runId: '',
      runStatus: '',
      demoUrl: '',
      githubUrl: '',
      apkQueueId: '',
      productId: '',
    });
  }, [patch]);

  const reset = useCallback(() => {
    persist(DEFAULT_STATE);
  }, [persist]);

  return useMemo(() => ({
    state,
    patch,
    clearRunData,
    reset,
  }), [state, patch, clearRunData, reset]);
}
