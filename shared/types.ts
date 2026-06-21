export interface ConfigItem {
  key: string;
  value: string;
  description: string;
  encrypted: boolean;
  iv?: string;
  tag?: string;
  updatedAt: string;
  updatedBy: string;
  inheritedFrom?: string;
  overriddenFrom?: string;
}

export type ConfigSourceType = 'local' | 'inherited' | 'overridden';

export interface ResolvedConfigItem extends ConfigItem {
  sourceType: ConfigSourceType;
  sourceProjectId: string;
  sourceProjectName?: string;
  inheritedValue?: string;
  inheritedDescription?: string;
  inheritedEncrypted?: boolean;
  parentUpdatedAt?: string;
  changeHint?: ChangeHint;
}

export interface ChangeHint {
  type: 'value_changed' | 'description_changed' | 'encrypted_changed' | 'deleted';
  projectId: string;
  projectName?: string;
  field: 'value' | 'description' | 'encrypted' | 'config';
  oldValue?: string;
  newValue?: string;
  changedAt: string;
}

export interface Environment {
  name: string;
  configs: ConfigItem[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  parentId?: string | null;
  environments: Environment[];
}

export interface ResolvedEnvironment {
  name: string;
  configs: ResolvedConfigItem[];
  changeHints: ChangeHint[];
}

export interface ResolvedProject extends Project {
  inheritedFrom?: string | null;
  inheritedProjectName?: string | null;
  resolvedEnvironments: ResolvedEnvironment[];
  inheritanceChain: string[];
  children: Project[];
}

export interface InheritanceNode {
  projectId: string;
  projectName: string;
  parentId: string | null;
  depth: number;
  children: InheritanceNode[];
  envCount: number;
  configCount: number;
  overriddenCount: number;
  inheritedCount: number;
}

export interface InheritanceInfo {
  projectId: string;
  projectName: string;
  hasCircularDependency: boolean;
  circularPath: string[];
  chain: Array<{ projectId: string; projectName: string; depth: number }>;
  children: InheritanceNode[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'pull' | 'change' | 'encrypt' | 'decrypt' | 'client_register' | 'notify' | 'inherit_sync';
  clientIp: string;
  clientName: string;
  project: string;
  environment: string;
  detail: string;
}

export interface ClientInfo {
  id: string;
  name: string;
  ip: string;
  token: string;
  lastHeartbeat: string;
  online: boolean;
}

export interface ConfigData {
  encryptionKey: string;
  projects: Project[];
}

export interface LogsData {
  logs: LogEntry[];
}

export interface ClientsData {
  clients: ClientInfo[];
}

export interface PullResponse {
  configs: Record<string, string>;
  version: string;
  pulledAt: string;
  projectId: string;
  inheritanceChain?: string[];
}

export type LogType = LogEntry['type'];
