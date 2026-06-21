import { JsonRepository } from './JsonRepository.js';
import type { ConfigData, Project, ConfigItem } from '../../shared/types.js';

export class ConfigRepository {
  private repo: JsonRepository<ConfigData>;

  constructor() {
    this.repo = new JsonRepository<ConfigData>('config.json', {
      encryptionKey: '',
      projects: [],
    });
  }

  async getData(): Promise<ConfigData> {
    return this.repo.read();
  }

  async saveData(data: ConfigData): Promise<void> {
    await this.repo.write(data);
  }

  async getAllProjects(): Promise<Project[]> {
    const data = await this.getData();
    return data.projects;
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    const data = await this.getData();
    return data.projects.find((p) => p.id === id);
  }

  async createProject(project: Project): Promise<Project> {
    const data = await this.getData();
    data.projects.push(project);
    await this.saveData(data);
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const data = await this.getData();
    const idx = data.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    data.projects[idx] = { ...data.projects[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.saveData(data);
    return data.projects[idx];
  }

  async deleteProject(id: string): Promise<boolean> {
    const data = await this.getData();
    const idx = data.projects.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    const childProjects = data.projects.filter((p) => p.parentId === id);
    for (const child of childProjects) {
      const childIdx = data.projects.findIndex((p) => p.id === child.id);
      if (childIdx !== -1) {
        data.projects[childIdx] = { ...data.projects[childIdx], parentId: null, updatedAt: new Date().toISOString() };
      }
    }
    data.projects.splice(idx, 1);
    await this.saveData(data);
    return true;
  }

  async getEnvironmentConfigs(projectId: string, envName: string): Promise<ConfigItem[] | null> {
    const project = await this.getProjectById(projectId);
    if (!project) return null;
    const env = project.environments.find((e) => e.name === envName);
    return env ? env.configs : null;
  }

  async addConfigItem(projectId: string, envName: string, item: ConfigItem): Promise<ConfigItem | null> {
    const data = await this.getData();
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) return null;
    let env = project.environments.find((e) => e.name === envName);
    if (!env) {
      env = { name: envName, configs: [] };
      project.environments.push(env);
    }
    const existing = env.configs.find((c) => c.key === item.key);
    if (existing) return null;
    env.configs.push(item);
    project.updatedAt = new Date().toISOString();
    await this.saveData(data);
    return item;
  }

  async updateConfigItem(projectId: string, envName: string, key: string, updates: Partial<ConfigItem>): Promise<ConfigItem | null> {
    const data = await this.getData();
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) return null;
    const env = project.environments.find((e) => e.name === envName);
    if (!env) return null;
    const config = env.configs.find((c) => c.key === key);
    if (!config) return null;
    Object.assign(config, updates, { updatedAt: new Date().toISOString() });
    project.updatedAt = new Date().toISOString();
    await this.saveData(data);
    return config;
  }

  async deleteConfigItem(projectId: string, envName: string, key: string): Promise<boolean> {
    const data = await this.getData();
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) return false;
    const env = project.environments.find((e) => e.name === envName);
    if (!env) return false;
    const idx = env.configs.findIndex((c) => c.key === key);
    if (idx === -1) return false;
    env.configs.splice(idx, 1);
    project.updatedAt = new Date().toISOString();
    await this.saveData(data);
    return true;
  }

  async getEncryptionKey(): Promise<string> {
    const data = await this.getData();
    return data.encryptionKey;
  }

  async setEncryptionKey(key: string): Promise<void> {
    const data = await this.getData();
    data.encryptionKey = key;
    await this.saveData(data);
  }

  async getChildrenProjects(parentId: string): Promise<Project[]> {
    const data = await this.getData();
    return data.projects.filter((p) => p.parentId === parentId);
  }

  async getInheritanceChain(projectId: string): Promise<Array<{ projectId: string; projectName: string; depth: number }>> {
    const chain: Array<{ projectId: string; projectName: string; depth: number }> = [];
    const visited = new Set<string>();
    let currentId: string | undefined = projectId;
    let depth = 0;

    while (currentId) {
      if (visited.has(currentId)) {
        break;
      }
      visited.add(currentId);
      const project = await this.getProjectById(currentId);
      if (!project) break;
      chain.push({ projectId: project.id, projectName: project.name, depth });
      currentId = project.parentId ?? undefined;
      depth++;
    }

    return chain;
  }

  async checkCircularDependency(projectId: string, newParentId: string | null): Promise<{ hasCycle: boolean; circularPath: string[] }> {
    if (!newParentId) {
      return { hasCycle: false, circularPath: [] };
    }
    const chain = await this.getInheritanceChain(newParentId);
    const hasCycle = chain.some((p) => p.projectId === projectId);
    if (hasCycle) {
      const circularPath = chain
        .filter((p) => {
          const idx = chain.findIndex((c) => c.projectId === p.projectId);
          const endIdx = chain.findIndex((c) => c.projectId === projectId);
          return idx >= endIdx;
        })
        .map((p) => p.projectId);
      circularPath.push(projectId);
      return { hasCycle: true, circularPath };
    }
    return { hasCycle: false, circularPath: [] };
  }

  async getAllDescendants(projectId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue: string[] = [projectId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = await this.getChildrenProjects(current);
      for (const child of children) {
        if (!descendants.includes(child.id)) {
          descendants.push(child.id);
          queue.push(child.id);
        }
      }
    }

    return descendants;
  }

  async updateEnvironment(projectId: string, envName: string, configs: ConfigItem[]): Promise<ConfigItem[] | null> {
    const data = await this.getData();
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) return null;
    let env = project.environments.find((e) => e.name === envName);
    if (!env) {
      env = { name: envName, configs: [] };
      project.environments.push(env);
    }
    env.configs = configs;
    project.updatedAt = new Date().toISOString();
    await this.saveData(data);
    return env.configs;
  }
}

export const configRepository = new ConfigRepository();
