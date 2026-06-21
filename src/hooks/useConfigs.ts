import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/utils/api';
import { useSSE } from './useSSE';
import { useDocumentVisibility } from './useDocumentVisibility';
import type {
  ConfigItem,
  ResolvedConfigItem,
  ChangeHint,
} from '../../shared/types';

interface UseConfigsOptions {
  projectId: string | null;
  envName: string | null;
  autoRefresh?: boolean;
  refreshOnVisible?: boolean;
  resolveInheritance?: boolean;
}

interface UseConfigsResult {
  configs: ResolvedConfigItem[];
  rawConfigs: ConfigItem[];
  loading: boolean;
  error: string | null;
  changeHints: ChangeHint[];
  fetchConfigs: () => Promise<void>;
  addConfig: (key: string, value: string, description?: string, encrypted?: boolean) => Promise<ConfigItem | null>;
  updateConfig: (key: string, updates: Partial<ConfigItem>) => Promise<ConfigItem | null>;
  deleteConfig: (key: string) => Promise<boolean>;
  encryptConfig: (key: string) => Promise<ConfigItem | null>;
  decryptConfig: (key: string) => Promise<ConfigItem | null>;
}

export function useConfigs(options: UseConfigsOptions): UseConfigsResult {
  const {
    projectId,
    envName,
    autoRefresh = true,
    refreshOnVisible = true,
    resolveInheritance = true,
  } = options;
  const [configs, setConfigs] = useState<ResolvedConfigItem[]>([]);
  const [rawConfigs, setRawConfigs] = useState<ConfigItem[]>([]);
  const [changeHints, setChangeHints] = useState<ChangeHint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isVisible } = useDocumentVisibility();
  const lastFetchRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 2000;

  const fetchConfigs = useCallback(async () => {
    if (!projectId || !envName) {
      setConfigs([]);
      setRawConfigs([]);
      setChangeHints([]);
      return;
    }

    const now = Date.now();
    if (now - lastFetchRef.current < MIN_REFRESH_INTERVAL) {
      return;
    }
    lastFetchRef.current = now;

    setLoading(true);
    setError(null);
    try {
      if (resolveInheritance) {
        const [rawRes, resolvedRes] = await Promise.all([
          api.get<ConfigItem[]>(`/configs/${projectId}/envs/${envName}`),
          api.get<{ configs: ResolvedConfigItem[]; changeHints: ChangeHint[] }>(
            `/configs/${projectId}/envs/${envName}/resolved`
          ),
        ]);
        if (rawRes.success && rawRes.data) {
          setRawConfigs(rawRes.data);
        }
        if (resolvedRes.success && resolvedRes.data) {
          setConfigs(resolvedRes.data.configs);
          setChangeHints(resolvedRes.data.changeHints);
        } else {
          setConfigs([]);
          setChangeHints([]);
        }
      } else {
        const rawRes = await api.get<ConfigItem[]>(`/configs/${projectId}/envs/${envName}`);
        if (rawRes.success && rawRes.data) {
          setRawConfigs(rawRes.data);
          setConfigs(
            rawRes.data.map((c) => ({
              ...c,
              sourceType: 'local' as const,
              sourceProjectId: projectId,
            }))
          );
        } else {
          setConfigs([]);
          setRawConfigs([]);
          setChangeHints([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configs');
      setConfigs([]);
      setRawConfigs([]);
      setChangeHints([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, envName, resolveInheritance]);

  const addConfig = useCallback(
    async (key: string, value: string, description?: string, encrypted?: boolean) => {
      if (!projectId || !envName) return null;
      const res = await api.post<ConfigItem>(`/configs/${projectId}/envs/${envName}`, {
        key,
        value,
        description,
        encrypted,
      });
      if (res.success && res.data) {
        lastFetchRef.current = 0;
        await fetchConfigs();
        return res.data;
      }
      return null;
    },
    [projectId, envName, fetchConfigs]
  );

  const updateConfig = useCallback(
    async (key: string, updates: Partial<ConfigItem>) => {
      if (!projectId || !envName) return null;
      const res = await api.put<ConfigItem>(`/configs/${projectId}/envs/${envName}/${key}`, updates);
      if (res.success && res.data) {
        lastFetchRef.current = 0;
        await fetchConfigs();
        return res.data;
      }
      return null;
    },
    [projectId, envName, fetchConfigs]
  );

  const deleteConfig = useCallback(
    async (key: string) => {
      if (!projectId || !envName) return false;
      const res = await api.delete(`/configs/${projectId}/envs/${envName}/${key}`);
      if (res.success) {
        lastFetchRef.current = 0;
        await fetchConfigs();
        return true;
      }
      return false;
    },
    [projectId, envName, fetchConfigs]
  );

  const encryptConfig = useCallback(
    async (key: string) => {
      if (!projectId || !envName) return null;
      const res = await api.post<ConfigItem>(`/encryption/${projectId}/${envName}/${key}`);
      if (res.success && res.data) {
        lastFetchRef.current = 0;
        await fetchConfigs();
        return res.data;
      }
      return null;
    },
    [projectId, envName, fetchConfigs]
  );

  const decryptConfig = useCallback(
    async (key: string) => {
      if (!projectId || !envName) return null;
      const res = await api.post<ConfigItem>(`/encryption/${projectId}/${envName}/${key}/decrypt`);
      if (res.success && res.data) {
        lastFetchRef.current = 0;
        await fetchConfigs();
        return res.data;
      }
      return null;
    },
    [projectId, envName, fetchConfigs]
  );

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    if (!refreshOnVisible || !isVisible) return;

    const timer = setTimeout(() => {
      fetchConfigs();
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible, refreshOnVisible, fetchConfigs]);

  useSSE({
    enabled: autoRefresh,
    filter: { project: projectId, environment: envName, eventTypes: ['config_changed', 'connected'] },
    onConfigChanged: () => {
      lastFetchRef.current = 0;
      fetchConfigs();
    },
    onRefresh: () => {
      lastFetchRef.current = 0;
      fetchConfigs();
    },
  });

  return {
    configs,
    rawConfigs,
    loading,
    error,
    changeHints,
    fetchConfigs,
    addConfig,
    updateConfig,
    deleteConfig,
    encryptConfig,
    decryptConfig,
  };
}
