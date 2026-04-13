export interface GlobalActivity {
  id: string;
  type: string;
  title: string;
  details?: string;
  status?: 'running' | 'completed' | 'failed';
  progress?: number;
}

export const addGlobalActivity = (_activity: GlobalActivity): void => {};
export const updateGlobalActivity = (_id: string, _update: Partial<GlobalActivity>): void => {};
export const removeGlobalActivity = (_id: string): void => {};
