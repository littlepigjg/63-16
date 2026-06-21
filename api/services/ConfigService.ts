import { configRepository } from '../repositories/ConfigRepository.js';
import { encryptionService } from './EncryptionService.js';
import { notifyService } from './NotifyService.js';
import { logService } from './LogService.js';
import crypto from 'crypto';
import type {
  Project,
  ConfigItem,
  PullResponse,
  ResolvedConfigItem,
  ResolvedEnvironment,
  ResolvedProject,
  ChangeHint,
  InheritanceInfo,
  InheritanceNode,
  Environment,
} from '../../shared/types.js';

export class ConfigService {
  async getAllProjects(): Promise<Project[]> {
    return configRepository.getAllProjects();
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    return configRepository.getProjectById(id);
  }

  async createProject(name: string, description: string, parentId?: string | null): Promise<Project | { error: string }> {
    if (parentId) {
      const parent = await configRepository.getProjectById(parentId);
      if (!parent) {
        return { error: '父项目不存在' };
      }
      const tempId = `_pending_${name}`;
      const cycleCheck = await configRepository.checkCircularDependency(tempId, parentId);
      if (cycleCheck.hasCycle) {
        return { error: '检测到循环继承依赖，无法设置该父项目' };
      }
    }

    const project: Project = {
      id: `proj_${crypto.randomUUID().slice(0, 8)}`,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentId: parentId ?? null,
      environments: [],
    };
    const created = await configRepository.createProject(project);
    await logService.addLog(
      'change',
      '',
      'admin',
      created.name,
      '-',
      parentId ? `创建项目: ${name}，继承自项目ID: ${parentId}` : `创建项目: ${name}`
    );
    return created;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null | { error: string }> {
    const existing = await configRepository.getProjectById(id);
    if (!existing) return null;

    if (updates.parentId !== undefined && updates.parentId !== existing.parentId) {
      if (updates.parentId === id) {
        return { error: '项目不能继承自己' };
      }
      if (updates.parentId) {
        const parent = await configRepository.getProjectById(updates.parentId);
        if (!parent) {
          return { error: '父项目不存在' };
        }
        const cycleCheck = await configRepository.checkCircularDependency(id, updates.parentId);
        if (cycleCheck.hasCycle) {
          return { error: `检测到循环继承依赖: ${cycleCheck.circularPath.join(' → ')}` };
        }
      }
    }

    const result = await configRepository.updateProject(id, updates);
    if (result) {
      await logService.addLog(
        'change',
        '',
        'admin',
        result.name,
        '-',
        `更新项目信息${updates.parentId !== undefined ? `，父项目变更为: ${updates.parentId || '无'}` : ''}`
      );
    }
    return result;
  }

  async deleteProject(id: string): Promise<boolean> {
    return configRepository.deleteProject(id);
  }

  async getEnvironmentConfigs(projectId: string, envName: string): Promise<ConfigItem[] | null> {
    return configRepository.getEnvironmentConfigs(projectId, envName);
  }

  async addConfigItem(
    projectId: string,
    envName: string,
    key: string,
    value: string,
    description: string,
    encrypted: boolean = false
  ): Promise<ConfigItem | null> {
    let storedValue = value;
    let iv: string | undefined;
    let tag: string | undefined;

    if (encrypted) {
      const result = await encryptionService.encrypt(value);
      storedValue = result.encrypted;
      iv = result.iv;
      tag = result.tag;
    }

    const resolved = await this.resolveEnvironment(projectId, envName);
    const existingInherited = resolved?.configs.find(
      (c) => c.key === key && (c.sourceType === 'inherited' || c.sourceType === 'overridden')
    );

    const item: ConfigItem = {
      key,
      value: storedValue,
      description,
      encrypted,
      iv,
      tag,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
      overriddenFrom: existingInherited?.sourceProjectId || undefined,
    };

    const result = await configRepository.addConfigItem(projectId, envName, item);
    if (result) {
      notifyService.notifyChange(projectId, envName, [key]);
      await logService.addLog(
        'change',
        '',
        'admin',
        projectId,
        envName,
        existingInherited
          ? `新增(覆盖)配置项: ${key}，覆盖自项目: ${existingInherited.sourceProjectId}`
          : `新增配置项: ${key}`
      );
      const descendants = await configRepository.getAllDescendants(projectId);
      for (const descId of descendants) {
        notifyService.notifyChange(descId, envName, [key]);
      }
    }
    return result;
  }

  async updateConfigItem(
    projectId: string,
    envName: string,
    key: string,
    updates: Partial<ConfigItem>
  ): Promise<ConfigItem | null> {
    if (updates.encrypted && updates.value) {
      const result = await encryptionService.encrypt(updates.value);
      updates.value = result.encrypted;
      updates.iv = result.iv;
      updates.tag = result.tag;
    }

    const resolved = await this.resolveEnvironment(projectId, envName);
    const existingInherited = resolved?.configs.find(
      (c) => c.key === key && (c.sourceType === 'inherited' || c.sourceType === 'overridden')
    );
    const existingLocal = await configRepository.getEnvironmentConfigs(projectId, envName);
    const localItem = existingLocal?.find((c) => c.key === key);

    if (!localItem && existingInherited) {
      let storedValue = updates.value ?? existingInherited.value;
      let iv: string | undefined = updates.iv;
      let tag: string | undefined = updates.tag;

      if ((updates.encrypted === true || existingInherited.encrypted) && updates.value) {
        const result = await encryptionService.encrypt(updates.value);
        storedValue = result.encrypted;
        iv = result.iv;
        tag = result.tag;
      }

      const newItem: ConfigItem = {
        key,
        value: storedValue,
        description: updates.description ?? existingInherited.description,
        encrypted: updates.encrypted ?? existingInherited.encrypted,
        iv,
        tag,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin',
        overriddenFrom: existingInherited.sourceProjectId,
      };
      const result = await configRepository.addConfigItem(projectId, envName, newItem);
      if (result) {
        notifyService.notifyChange(projectId, envName, [key]);
        await logService.addLog(
          'change',
          '',
          'admin',
          projectId,
          envName,
          `覆盖继承配置项: ${key}，继承自: ${existingInherited.sourceProjectId}`
        );
        const descendants = await configRepository.getAllDescendants(projectId);
        for (const descId of descendants) {
          notifyService.notifyChange(descId, envName, [key]);
        }
        return result;
      }
      return null;
    }

    const result = await configRepository.updateConfigItem(projectId, envName, key, updates);
    if (result) {
      notifyService.notifyChange(projectId, envName, [key]);
      await logService.addLog('change', '', 'admin', projectId, envName, `更新配置项: ${key}`);
      const descendants = await configRepository.getAllDescendants(projectId);
      for (const descId of descendants) {
        notifyService.notifyChange(descId, envName, [key]);
      }
    }
    return result;
  }

  async deleteConfigItem(projectId: string, envName: string, key: string): Promise<boolean> {
    const result = await configRepository.deleteConfigItem(projectId, envName, key);
    if (result) {
      notifyService.notifyChange(projectId, envName, [key]);
      await logService.addLog('change', '', 'admin', projectId, envName, `删除配置项: ${key}`);
      const descendants = await configRepository.getAllDescendants(projectId);
      for (const descId of descendants) {
        notifyService.notifyChange(descId, envName, [key]);
      }
    }
    return result;
  }

  async getResolvedEnvironmentConfigs(
    projectId: string,
    envName: string
  ): Promise<{ configs: ResolvedConfigItem[]; changeHints: ChangeHint[] } | null> {
    const resolved = await this.resolveEnvironment(projectId, envName);
    return resolved || null;
  }

  async getResolvedProject(projectId: string): Promise<ResolvedProject | null> {
    const project = await configRepository.getProjectById(projectId);
    if (!project) return null;

    const chain = await configRepository.getInheritanceChain(projectId);
    const children = await configRepository.getChildrenProjects(projectId);
    const parent = project.parentId ? await configRepository.getProjectById(project.parentId) : null;

    const allEnvNames = new Set<string>();
    for (const link of chain) {
      const p = await configRepository.getProjectById(link.projectId);
      if (p) {
        p.environments.forEach((e) => allEnvNames.add(e.name));
      }
    }

    const resolvedEnvironments: ResolvedEnvironment[] = [];
    for (const envName of allEnvNames) {
      const resolved = await this.resolveEnvironment(projectId, envName);
      if (resolved) {
        resolvedEnvironments.push(resolved);
      }
    }

    return {
      ...project,
      inheritedFrom: project.parentId || null,
      inheritedProjectName: parent?.name || null,
      resolvedEnvironments,
      inheritanceChain: chain.map((c) => c.projectId),
      children,
    };
  }

  private async resolveEnvironment(
    projectId: string,
    envName: string
  ): Promise<ResolvedEnvironment | null> {
    const chain = await configRepository.getInheritanceChain(projectId);
    if (chain.length === 0) return null;

    const chainConfigs: Map<string, { config: ConfigItem; projectId: string; projectName: string }> = new Map();
    for (const link of chain) {
      const envConfigs = await configRepository.getEnvironmentConfigs(link.projectId, envName);
      if (envConfigs) {
        for (const config of envConfigs) {
          if (!chainConfigs.has(config.key)) {
            chainConfigs.set(config.key, {
              config,
              projectId: link.projectId,
              projectName: link.projectName,
            });
          }
        }
      }
    }

    const resultConfigs: ResolvedConfigItem[] = [];
    const changeHints: ChangeHint[] = [];
    const localConfigs = await configRepository.getEnvironmentConfigs(projectId, envName);
    const localConfigsMap = new Map((localConfigs || []).map((c) => [c.key, c]));

    for (const [key, chainData] of chainConfigs.entries()) {
      const localConfig = localConfigsMap.get(key);
      if (localConfig) {
        const sourceProjectId = chainData.projectId;
        const isLocalOrigin = sourceProjectId === projectId;
        const sourceType = isLocalOrigin ? 'local' : 'overridden';

        let hint: ChangeHint | undefined;
        if (sourceType === 'overridden') {
          const parentCfg = chainData.config;
          const checkField = <K extends keyof ConfigItem>(
            field: K,
            fieldName: 'value' | 'description' | 'encrypted'
          ) => {
            if (localConfig.overriddenFrom === sourceProjectId) {
              const parentVal = String(parentCfg[field] ?? '');
              const localVal = String(localConfig[field] ?? '');
              if (field === 'value' && parentCfg.encrypted) {
                return null;
              }
              if (parentVal !== localVal && parentCfg.updatedAt > localConfig.updatedAt) {
                return {
                  type: `${fieldName}_changed` as const,
                  projectId: sourceProjectId,
                  projectName: chainData.projectName,
                  field: fieldName,
                  oldValue: undefined,
                  newValue: undefined,
                  changedAt: parentCfg.updatedAt,
                };
              }
            }
            return null;
          };
          hint =
            checkField('value', 'value') ||
            checkField('description', 'description') ||
            checkField('encrypted', 'encrypted') ||
            undefined;
          if (hint) changeHints.push(hint);
        }

        resultConfigs.push({
          ...localConfig,
          sourceType,
          sourceProjectId: isLocalOrigin ? projectId : sourceProjectId,
          sourceProjectName: isLocalOrigin ? chain[0].projectName : chainData.projectName,
          inheritedValue: sourceType === 'overridden' ? chainData.config.value : undefined,
          inheritedDescription: sourceType === 'overridden' ? chainData.config.description : undefined,
          inheritedEncrypted: sourceType === 'overridden' ? chainData.config.encrypted : undefined,
          parentUpdatedAt: sourceType === 'overridden' ? chainData.config.updatedAt : undefined,
          changeHint: hint,
        });
      } else {
        resultConfigs.push({
          ...chainData.config,
          sourceType: chainData.projectId === projectId ? 'local' : 'inherited',
          sourceProjectId: chainData.projectId,
          sourceProjectName: chainData.projectName,
        });
      }
    }

    for (const [key, local] of localConfigsMap) {
      if (!chainConfigs.has(key)) {
        resultConfigs.push({
          ...local,
          sourceType: 'local',
          sourceProjectId: projectId,
          sourceProjectName: chain[0].projectName,
        });
      }
    }

    resultConfigs.sort((a, b) => a.key.localeCompare(b.key));

    return {
      name: envName,
      configs: resultConfigs,
      changeHints,
    };
  }

  async pullConfigs(
    projectName: string,
    envName: string,
    clientIp: string,
    clientName: string
  ): Promise<PullResponse | null> {
    const projects = await configRepository.getAllProjects();
    const project = projects.find((p) => p.name === projectName || p.id === projectName);
    if (!project) return null;

    const resolved = await this.resolveEnvironment(project.id, envName);
    const rawConfigs = (await configRepository.getEnvironmentConfigs(project.id, envName)) || [];

    const chain = await configRepository.getInheritanceChain(project.id);
    const resolvedConfigs = resolved?.configs || [];
    const hasOverridden = resolvedConfigs.some((c) => c.sourceType === 'overridden');

    const configs: Record<string, string> = {};
    for (const item of resolvedConfigs) {
      if (item.encrypted && item.iv && item.tag) {
        try {
          configs[item.key] = await encryptionService.decrypt(item.value, item.iv, item.tag);
        } catch {
          configs[item.key] = '[DECRYPT_ERROR]';
        }
      } else {
        configs[item.key] = item.value;
      }
    }

    await logService.addLog(
      'pull',
      clientIp,
      clientName,
      project.name,
      envName,
      `客户端 ${clientName} 拉取了 ${Object.keys(configs).length} 个配置项${
        hasOverridden ? '（含继承覆盖）' : ''
      }，继承链深度: ${chain.length}`
    );

    return {
      configs,
      version: project.updatedAt,
      pulledAt: new Date().toISOString(),
      projectId: project.id,
      inheritanceChain: chain.map((c) => c.projectId),
    };
  }

  async encryptConfig(projectId: string, envName: string, key: string): Promise<ConfigItem | null> {
    const configs = await configRepository.getEnvironmentConfigs(projectId, envName);
    if (!configs) return null;
    const item = configs.find((c) => c.key === key);
    if (!item || item.encrypted) return null;

    const result = await encryptionService.encrypt(item.value);
    const updated = await configRepository.updateConfigItem(projectId, envName, key, {
      value: result.encrypted,
      encrypted: true,
      iv: result.iv,
      tag: result.tag,
    });

    if (updated) {
      await logService.addLog('encrypt', '', 'admin', projectId, envName, `加密配置项: ${key}`);
    }
    return updated;
  }

  async decryptConfig(projectId: string, envName: string, key: string): Promise<ConfigItem | null> {
    const configs = await configRepository.getEnvironmentConfigs(projectId, envName);
    if (!configs) return null;
    const item = configs.find((c) => c.key === key);
    if (!item || !item.encrypted || !item.iv || !item.tag) return null;

    const decryptedValue = await encryptionService.decrypt(item.value, item.iv, item.tag);
    const updated = await configRepository.updateConfigItem(projectId, envName, key, {
      value: decryptedValue,
      encrypted: false,
      iv: undefined,
      tag: undefined,
    });

    if (updated) {
      await logService.addLog('decrypt', '', 'admin', projectId, envName, `解密配置项: ${key}`);
    }
    return updated;
  }

  async getInheritanceInfo(projectId: string): Promise<InheritanceInfo | null> {
    const project = await configRepository.getProjectById(projectId);
    if (!project) return null;

    const chain = await configRepository.getInheritanceChain(projectId);
    const hasCycle = await this._detectCycleInChain(chain);

    let circularPath: string[] = [];
    if (hasCycle) {
      const seen = new Set<string>();
      for (const link of chain) {
        if (seen.has(link.projectId)) {
          const startIdx = chain.findIndex((c) => c.projectId === link.projectId);
          circularPath = chain.slice(startIdx).map((c) => c.projectId);
          circularPath.push(link.projectId);
          break;
        }
        seen.add(link.projectId);
      }
    }

    const children = await this._buildInheritanceTree(projectId);

    return {
      projectId: project.id,
      projectName: project.name,
      hasCircularDependency: hasCycle,
      circularPath,
      chain,
      children,
    };
  }

  private async _detectCycleInChain(
    chain: Array<{ projectId: string; projectName: string; depth: number }>
  ): Promise<boolean> {
    const seen = new Set<string>();
    for (const link of chain) {
      if (seen.has(link.projectId)) return true;
      seen.add(link.projectId);
    }
    return false;
  }

  private async _buildInheritanceTree(parentId: string, depth: number = 0): Promise<InheritanceNode[]> {
    const children = await configRepository.getChildrenProjects(parentId);
    const nodes: InheritanceNode[] = [];

    for (const child of children) {
      const node = await this._buildInheritanceNode(child, depth);
      node.children = await this._buildInheritanceTree(child.id, depth + 1);
      nodes.push(node);
    }

    return nodes;
  }

  private async _buildInheritanceNode(project: Project, depth: number): Promise<InheritanceNode> {
    const resolved = await this.getResolvedProject(project.id);
    let configCount = 0;
    let inheritedCount = 0;
    let overriddenCount = 0;

    if (resolved) {
      for (const env of resolved.resolvedEnvironments) {
        for (const cfg of env.configs) {
          configCount++;
          if (cfg.sourceType === 'inherited') inheritedCount++;
          if (cfg.sourceType === 'overridden') overriddenCount++;
        }
      }
    } else {
      for (const env of project.environments) {
        configCount += env.configs.length;
      }
    }

    return {
      projectId: project.id,
      projectName: project.name,
      parentId: project.parentId ?? null,
      depth,
      children: [],
      envCount: project.environments.length,
      configCount,
      overriddenCount,
      inheritedCount,
    };
  }

  async getAllInheritanceTrees(): Promise<InheritanceNode[]> {
    const projects = await configRepository.getAllProjects();
    const rootProjects = projects.filter((p) => !p.parentId);
    const trees: InheritanceNode[] = [];

    for (const root of rootProjects) {
      const node = await this._buildInheritanceNode(root, 0);
      node.children = await this._buildInheritanceTree(root.id, 1);
      trees.push(node);
    }

    const parentedSet = new Set<string>();
    const walk = (nodes: InheritanceNode[]) => {
      for (const n of nodes) {
        parentedSet.add(n.projectId);
        walk(n.children);
      }
    };
    walk(trees);

    for (const p of projects) {
      if (!parentedSet.has(p.id)) {
        const node = await this._buildInheritanceNode(p, 0);
        node.children = await this._buildInheritanceTree(p.id, 1);
        trees.push(node);
      }
    }

    return trees;
  }

  async getChangeHints(projectId: string, envName?: string): Promise<ChangeHint[]> {
    const project = await configRepository.getProjectById(projectId);
    if (!project) return [];

    const envNames = envName
      ? [envName]
      : project.environments.map((e) => e.name);

    const allHints: ChangeHint[] = [];
    for (const name of envNames) {
      const resolved = await this.resolveEnvironment(projectId, name);
      if (resolved) {
        allHints.push(...resolved.changeHints);
      }
    }
    return allHints;
  }
}

export const configService = new ConfigService();
