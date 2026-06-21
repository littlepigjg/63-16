import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import { useSSE } from './useSSE';
import { useDocumentVisibility } from './useDocumentVisibility';
import type {
  Project,
  InheritanceNode,
  InheritanceInfo,
  ResolvedProject,
  ChangeHint,
} from '../../shared/types';

interface UseProjectsOptions {
  autoRefresh?: boolean;
  refreshOnVisible?: boolean;
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { autoRefresh = true, refreshOnVisible = true } = options;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isVisible } = useDocumentVisibility();
  const lastFetchRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 2000;

  const fetchProjects = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < MIN_REFRESH_INTERVAL) {
      return;
    }
    lastFetchRef.current = now;

    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Project[]>('/projects');
      if (res.success && res.data) {
        setProjects(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (name: string, description?: string, parentId?: string | null) => {
      const res = await api.post<Project>('/projects', { name, description, parentId });
      if (res.success && res.data) {
        lastFetchRef.current = 0;
        await fetchProjects();
        return res.data;
      }
      if (res.error) {
        throw new Error(res.error);
      }
      return null;
    },
    [fetchProjects]
  );

  const updateProject = useCallback(
    async (id: string, updates: Partial<Project> & { parentId?: string | null }) => {
      const res = await api.put<Project>(`/projects/${id}`, updates);
      if (res.success && res.data) {
        lastFetchRef.current = 0;
        await fetchProjects();
        return res.data;
      }
      if (res.error) {
        throw new Error(res.error);
      }
      return null;
    },
    [fetchProjects]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const res = await api.delete(`/projects/${id}`);
      if (res.success) {
        lastFetchRef.current = 0;
        await fetchProjects();
        return true;
      }
      return false;
    },
    [fetchProjects]
  );

  const getResolvedProject = useCallback(async (projectId: string) => {
    const res = await api.get<ResolvedProject>(`/projects/${projectId}/resolved`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }, []);

  const getInheritanceTrees = useCallback(async () => {
    const res = await api.get<InheritanceNode[]>('/projects/trees');
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }, []);

  const getInheritanceInfo = useCallback(async (projectId: string) => {
    const res = await api.get<InheritanceInfo>(`/projects/${projectId}/inheritance`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }, []);

  const getChangeHints = useCallback(async (projectId: string, envName?: string) => {
    const url = envName
      ? `/projects/${projectId}/change-hints?env=${encodeURIComponent(envName)}`
      : `/projects/${projectId}/change-hints`;
    const res = await api.get<ChangeHint[]>(url);
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!refreshOnVisible || !isVisible) return;

    const timer = setTimeout(() => {
      fetchProjects();
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible, refreshOnVisible, fetchProjects]);

  useSSE({
    enabled: autoRefresh,
    filter: { eventTypes: ['config_changed'] },
    onConfigChanged: () => {
      lastFetchRef.current = 0;
      fetchProjects();
    },
    onRefresh: () => {
      lastFetchRef.current = 0;
      fetchProjects();
    },
  });

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    getResolvedProject,
    getInheritanceTrees,
    getInheritanceInfo,
    getChangeHints,
  };
}
