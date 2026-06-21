import { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  Download,
  Upload,
  FolderPlus,
  ChevronDown,
  GitBranch,
  AlertTriangle,
  Settings2,
  Eye,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useProjects, useConfigs } from '@/hooks';
import PageHeader from '@/components/PageHeader';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import InheritanceVisualizer from '@/components/InheritanceVisualizer';
import { maskValue, envLabel } from '@/utils/format';
import type { ConfigItem, ConfigSourceType, ResolvedConfigItem } from '../../shared/types';

const DEFAULT_ENVS = ['development', 'testing', 'production'];

const SOURCE_LABELS: Record<ConfigSourceType, { text: string; variant: 'default' | 'info' | 'warning' }> = {
  local: { text: '本地', variant: 'default' },
  inherited: { text: '继承', variant: 'info' },
  overridden: { text: '覆盖', variant: 'warning' },
};

export default function Configs() {
  const { selectedProjectId, setSelectedProjectId, selectedEnv, setSelectedEnv } = useAppStore();
  const { projects, createProject, updateProject } = useProjects();
  const { configs, addConfig, updateConfig, deleteConfig, loading, changeHints } = useConfigs({
    projectId: selectedProjectId,
    envName: selectedEnv,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showProjectEditModal, setShowProjectEditModal] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [showInheritanceModal, setShowInheritanceModal] = useState(false);
  const [showChangeHintModal, setShowChangeHintModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ResolvedConfigItem | null>(null);
  const [selectedHintConfig, setSelectedHintConfig] = useState<ResolvedConfigItem | null>(null);

  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEncrypted, setFormEncrypted] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectParentId, setProjectParentId] = useState<string | null>('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [editProjectParentId, setEditProjectParentId] = useState<string | null>('');
  const [envName, setEnvName] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const parentProject = currentProject?.parentId
    ? projects.find((p) => p.id === currentProject.parentId)
    : null;

  const inheritedCount = configs.filter((c) => c.sourceType === 'inherited').length;
  const overriddenCount = configs.filter((c) => c.sourceType === 'overridden').length;
  const localCount = configs.filter(
    (c) => c.sourceType === 'local' && c.key !== '_init'
  ).length;

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  const resetForm = () => {
    setFormKey('');
    setFormValue('');
    setFormDesc('');
    setFormEncrypted(false);
    setFormError(null);
  };

  const resetProjectForm = () => {
    setProjectName('');
    setProjectDesc('');
    setProjectParentId(null);
    setFormError(null);
  };

  const openEditProjectModal = () => {
    if (!currentProject) return;
    setEditProjectName(currentProject.name);
    setEditProjectDesc(currentProject.description);
    setEditProjectParentId(currentProject.parentId ?? null);
    setFormError(null);
    setShowProjectEditModal(true);
  };

  const handleAddConfig = async () => {
    if (!selectedProjectId || !formKey) return;
    const result = await addConfig(formKey, formValue, formDesc, formEncrypted);
    if (result) {
      setShowAddModal(false);
      resetForm();
    } else {
      setFormError('配置项已存在或创建失败');
    }
  };

  const handleEditConfig = async () => {
    if (!selectedProjectId || !editingConfig) return;
    const body: Partial<ConfigItem> = {};
    if (formValue !== undefined && formValue !== '') body.value = formValue;
    if (formDesc !== undefined) body.description = formDesc;
    body.encrypted = formEncrypted;
    const result = await updateConfig(editingConfig.key, body);
    if (result) {
      setShowEditModal(false);
      setEditingConfig(null);
      resetForm();
    } else {
      setFormError('更新失败');
    }
  };

  const handleDeleteConfig = async (key: string) => {
    if (!confirm(`确定删除配置项 "${key}" 吗？`)) return;
    await deleteConfig(key);
  };

  const handleCreateProject = async () => {
    if (!projectName) return;
    setFormError(null);
    try {
      const project = await createProject(
        projectName,
        projectDesc,
        projectParentId === '' ? undefined : projectParentId
      );
      if (project) {
        setShowProjectModal(false);
        resetProjectForm();
        setSelectedProjectId(project.id);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleUpdateProject = async () => {
    if (!selectedProjectId || !editProjectName) return;
    setFormError(null);
    try {
      const result = await updateProject(selectedProjectId, {
        name: editProjectName,
        description: editProjectDesc,
        parentId: editProjectParentId === '' ? undefined : editProjectParentId,
      });
      if (result) {
        setShowProjectEditModal(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleAddEnv = async () => {
    if (!selectedProjectId || !envName) return;
    const result = await addConfig('_init', '', 'Environment initializer', false);
    if (result) {
      setShowEnvModal(false);
      setEnvName('');
      setSelectedEnv(envName);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(configs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'config'}_${selectedEnv}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !selectedProjectId) return;
      const text = await file.text();
      try {
        const items = JSON.parse(text);
        if (Array.isArray(items)) {
          for (const item of items) {
            await addConfig(item.key, item.value || '', item.description || '', false);
          }
        }
      } catch {
        alert('导入失败：无效的JSON文件');
      }
    };
    input.click();
  };

  const openEditModal = (config: ResolvedConfigItem) => {
    setEditingConfig(config);
    setFormValue(config.encrypted ? '' : config.value);
    setFormDesc(config.description);
    setFormEncrypted(config.encrypted);
    setShowEditModal(true);
  };

  const openHintModal = (config: ResolvedConfigItem) => {
    setSelectedHintConfig(config);
    setShowChangeHintModal(true);
  };

  const acceptParentValue = async (config: ResolvedConfigItem) => {
    if (!config || !selectedProjectId) return;
    const body: Partial<ConfigItem> = {};
    if (config.inheritedValue !== undefined) body.value = config.inheritedValue;
    if (config.inheritedDescription !== undefined) body.description = config.inheritedDescription;
    if (config.inheritedEncrypted !== undefined) body.encrypted = config.inheritedEncrypted;
    const result = await updateConfig(config.key, body);
    if (result) {
      setShowChangeHintModal(false);
      setSelectedHintConfig(null);
    }
  };

  const projectEnvs = currentProject?.environments.map((e) => e.name) || [];
  const allEnvs = [...new Set([...DEFAULT_ENVS, ...projectEnvs])];

  return (
    <div className="animate-slide-in">
      <PageHeader
        title="配置管理"
        subtitle="按项目和环境管理配置项，支持多级继承与覆盖"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInheritanceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"
            >
              <GitBranch className="w-4 h-4" /> 继承图
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"
            >
              <Download className="w-4 h-4" /> 导出
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"
            >
              <Upload className="w-4 h-4" /> 导入
            </button>
            <button
              onClick={() => setShowProjectModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"
            >
              <FolderPlus className="w-4 h-4" /> 新建项目
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              <Plus className="w-4 h-4" /> 添加配置
            </button>
          </div>
        }
      />

      {changeHints.length > 0 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm text-amber-400 font-medium mb-1">
              检测到 {changeHints.length} 条父项目配置变更
            </div>
            <div className="text-xs text-[#94A3B8]">
              你有覆盖的配置项，其继承自的父项目已更新。请查看表格中黄色标记的配置项进行确认。
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] hover:border-emerald-500/30 transition-colors min-w-[220px] justify-between"
          >
            <span className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#64748B]" />
              {currentProject?.name || '选择项目'}
            </span>
            <ChevronDown className="w-4 h-4 text-[#64748B]" />
          </button>
          {showProjectDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl z-20 overflow-hidden">
              {projects.map((p) => {
                const pParent = p.parentId ? projects.find((pp) => pp.id === p.parentId) : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setShowProjectDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[#334155] transition-colors ${
                      p.id === selectedProjectId ? 'text-emerald-400' : 'text-[#94A3B8]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.parentId && (
                        <span className="text-[10px] text-[#64748B] ml-auto flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {pParent?.name || p.parentId}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {currentProject && (
          <button
            onClick={openEditProjectModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#64748B] border border-[#334155] rounded-lg hover:bg-[#334155] hover:text-[#94A3B8] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> 编辑项目
          </button>
        )}

        {parentProject && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs">
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[#64748B]">继承自：</span>
            <span className="text-sky-400 font-medium">{parentProject.name}</span>
          </div>
        )}

        <div className="flex items-center gap-1 bg-[#1E293B] border border-[#334155] rounded-lg p-1 ml-auto">
          {allEnvs.map((env) => (
            <button
              key={env}
              onClick={() => setSelectedEnv(env)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedEnv === env
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {envLabel(env)}
            </button>
          ))}
          <button
            onClick={() => setShowEnvModal(true)}
            className="px-2 py-1.5 text-xs text-[#64748B] hover:text-emerald-400 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {selectedProjectId && (
        <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 text-[#64748B]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 本地 {localCount}
          </div>
          <div className="flex items-center gap-1.5 text-[#64748B]">
            <span className="w-2 h-2 rounded-full bg-sky-500" /> 继承 {inheritedCount}
          </div>
          <div className="flex items-center gap-1.5 text-[#64748B]">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 覆盖 {overriddenCount}
          </div>
        </div>
      )}

      {!selectedProjectId ? (
        <div className="text-center py-16 text-[#64748B]">
          <FolderPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请先创建或选择一个项目</p>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">键名</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">值</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">描述</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">来源</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">状态</th>
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && configs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B] text-sm">
                    加载中...
                  </td>
                </tr>
              ) : configs.length === 0 ||
                (configs.length === 1 && configs[0].key === '_init') ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B] text-sm">
                    此环境下暂无配置项
                  </td>
                </tr>
              ) : (
                configs
                  .filter((c) => c.key !== '_init')
                  .map((config) => {
                    const source = SOURCE_LABELS[config.sourceType];
                    const hasHint = !!config.changeHint;
                    return (
                      <tr
                        key={config.key}
                        className={`border-b border-[#334155]/50 hover:bg-[#0F172A]/50 transition-colors ${
                          hasHint ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-emerald-400">
                              {config.key}
                            </span>
                            {hasHint && (
                              <button
                                onClick={() => openHintModal(config)}
                                className="p-1 rounded hover:bg-amber-500/20 transition-colors"
                                title="父项目配置已变更"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-[#94A3B8]">
                              {config.encrypted
                                ? maskValue(config.value)
                                : config.value.length > 40
                                ? config.value.slice(0, 40) + '...'
                                : config.value}
                            </span>
                            {config.encrypted && (
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">
                          {config.description || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={source.variant}>{source.text}</Badge>
                            {config.sourceProjectName &&
                              config.sourceType !== 'local' && (
                                <span
                                  className="text-xs text-[#64748B] flex items-center gap-1"
                                  title={`来自项目: ${config.sourceProjectName}`}
                                >
                                  <GitBranch className="w-3 h-3" />
                                  {config.sourceProjectName}
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {config.encrypted ? (
                            <Badge variant="warning">已加密</Badge>
                          ) : (
                            <Badge variant="success">明文</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {config.sourceType === 'inherited' && (
                              <button
                                onClick={() => openEditModal(config)}
                                className="p-1.5 text-[#64748B] hover:text-sky-400 rounded transition-colors"
                                title="覆盖此继承配置"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(config)}
                              className="p-1.5 text-[#64748B] hover:text-emerald-400 rounded transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {config.sourceType !== 'inherited' && (
                              <button
                                onClick={() => handleDeleteConfig(config.key)}
                                className="p-1.5 text-[#64748B] hover:text-rose-400 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="添加配置项"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">键名</label>
            <input
              value={formKey}
              onChange={(e) => setFormKey(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50"
              placeholder="例如: DB_HOST"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">值</label>
            <input
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50"
              placeholder="配置值"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
              placeholder="配置项描述"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formEncrypted}
              onChange={(e) => setFormEncrypted(e.target.checked)}
              className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50"
            />
            <label className="text-sm text-[#94A3B8]">加密存储此值</label>
          </div>
          {formError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddConfig}
              className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingConfig(null);
          resetForm();
        }}
        title={`${editingConfig?.sourceType === 'inherited' ? '覆盖继承配置' : '编辑'}: ${editingConfig?.key}`}
      >
        <div className="space-y-4">
          {editingConfig?.sourceType === 'inherited' && editingConfig.sourceProjectName && (
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs text-sky-400 flex items-start gap-2">
              <GitBranch className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                此配置项继承自 <b>{editingConfig.sourceProjectName}</b>
                。保存后将在当前项目创建本地覆盖副本。
              </div>
            </div>
          )}
          {editingConfig?.sourceType === 'overridden' && editingConfig.sourceProjectName && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                此配置项覆盖自 <b>{editingConfig.sourceProjectName}</b>
                。修改后仅影响当前项目。
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-[#64748B] mb-1">
              值 {editingConfig?.encrypted && '(留空保持原值)'}
            </label>
            <input
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50"
              placeholder="配置值"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
              placeholder="配置项描述"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formEncrypted}
              onChange={(e) => setFormEncrypted(e.target.checked)}
              className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50"
            />
            <label className="text-sm text-[#94A3B8]">加密存储此值</label>
          </div>
          {formError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditingConfig(null);
                resetForm();
              }}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleEditConfig}
              className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              {editingConfig?.sourceType === 'inherited' ? '覆盖' : '保存'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          resetProjectForm();
        }}
        title="新建项目"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">项目名称</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
              placeholder="例如: 用户服务"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
              placeholder="项目描述"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">
              父项目（可选，用于继承配置）
            </label>
            <select
              value={projectParentId ?? ''}
              onChange={(e) => setProjectParentId(e.target.value || null)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">无（独立项目）</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {formError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowProjectModal(false);
                resetProjectForm();
              }}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreateProject}
              className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              创建
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showProjectEditModal}
        onClose={() => {
          setShowProjectEditModal(false);
          setFormError(null);
        }}
        title="编辑项目"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">项目名称</label>
            <input
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input
              value={editProjectDesc}
              onChange={(e) => setEditProjectDesc(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">
              父项目（用于继承配置）
            </label>
            <select
              value={editProjectParentId ?? ''}
              onChange={(e) => setEditProjectParentId(e.target.value || null)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">无（独立项目）</option>
              {projects
                .filter((p) => p.id !== selectedProjectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-[#64748B]">
              修改父项目将重新计算所有继承的配置项，防止循环继承。
            </p>
          </div>
          {formError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowProjectEditModal(false);
                setFormError(null);
              }}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleUpdateProject}
              className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showEnvModal}
        onClose={() => setShowEnvModal(false)}
        title="添加环境"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">环境名称</label>
            <input
              value={envName}
              onChange={(e) => setEnvName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
              placeholder="例如: staging"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowEnvModal(false)}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddEnv}
              className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showChangeHintModal}
        onClose={() => {
          setShowChangeHintModal(false);
          setSelectedHintConfig(null);
        }}
        title="父项目配置变更提示"
      >
        <div className="space-y-4">
          {selectedHintConfig?.changeHint && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="text-amber-400 font-medium mb-1">
                  {selectedHintConfig.changeHint.projectName ||
                    selectedHintConfig.changeHint.projectId} 中的{' '}
                  {selectedHintConfig.changeHint.field === 'value'
                    ? '值'
                    : selectedHintConfig.changeHint.field === 'description'
                    ? '描述'
                    : selectedHintConfig.changeHint.field === 'encrypted'
                    ? '加密状态'
                    : '配置'}
                  已变更
                </div>
                <div className="text-[#94A3B8] text-xs">
                  变更时间:{' '}
                  {new Date(selectedHintConfig.changeHint.changedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#1E293B] border border-[#334155] rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-[#334155] text-xs font-medium text-[#64748B]">
              当前（本地覆盖）
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="text-[#64748B] w-20 flex-shrink-0">值:</span>
                <span className="font-mono text-emerald-400 break-all">
                  {selectedHintConfig?.encrypted
                    ? maskValue(selectedHintConfig.value)
                    : selectedHintConfig?.value}
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-[#64748B] w-20 flex-shrink-0">描述:</span>
                <span className="text-[#94A3B8]">{selectedHintConfig?.description}</span>
              </div>
            </div>
          </div>

          <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-sky-500/20 text-xs font-medium text-sky-400">
              父项目最新（{selectedHintConfig?.sourceProjectName}）
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="text-[#64748B] w-20 flex-shrink-0">值:</span>
                <span className="font-mono text-sky-400 break-all">
                  {selectedHintConfig?.inheritedEncrypted
                    ? maskValue(selectedHintConfig.inheritedValue || '')
                    : selectedHintConfig?.inheritedValue}
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-[#64748B] w-20 flex-shrink-0">描述:</span>
                <span className="text-[#94A3B8]">
                  {selectedHintConfig?.inheritedDescription}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => {
                setShowChangeHintModal(false);
                setSelectedHintConfig(null);
              }}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              保持当前值
            </button>
            <button
              onClick={() => selectedHintConfig && acceptParentValue(selectedHintConfig)}
              className="px-4 py-2 text-sm bg-sky-500/15 text-sky-400 rounded-lg hover:bg-sky-500/25 transition-colors"
            >
              采用父项目值
            </button>
          </div>
        </div>
      </Modal>

      <InheritanceVisualizer
        open={showInheritanceModal}
        onClose={() => setShowInheritanceModal(false)}
        selectedProjectId={selectedProjectId}
      />
    </div>
  );
}
