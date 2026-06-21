import { useState, useEffect } from 'react';
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  Folder,
  Settings,
  Shield,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useProjects } from '@/hooks';
import type { InheritanceNode, InheritanceInfo } from '../../shared/types';

interface InheritanceVisualizerProps {
  open: boolean;
  onClose: () => void;
  selectedProjectId?: string | null;
}

function TreeNode({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: InheritanceNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.projectId;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-emerald-500/15 border border-emerald-500/30'
            : 'hover:bg-[#334155]/50 border border-transparent'
        }`}
        style={{ marginLeft: `${depth * 24}px` }}
        onClick={() => onSelect?.(node.projectId)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-0.5 text-[#64748B] hover:text-[#94A3B8] disabled:invisible"
          disabled={!hasChildren}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <GitBranch
          className={`w-4 h-4 ${
            depth === 0 ? 'text-sky-400' : isSelected ? 'text-emerald-400' : 'text-[#64748B]'
          }`}
        />
        <span
          className={`flex-1 text-sm ${
            isSelected ? 'text-emerald-400 font-medium' : 'text-[#F1F5F9]'
          }`}
        >
          {node.projectName}
        </span>
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <span className="flex items-center gap-1">
            <Folder className="w-3 h-3" />
            {node.envCount}
          </span>
          <span className="flex items-center gap-1">
            <Settings className="w-3 h-3" />
            {node.configCount}
          </span>
          {node.inheritedCount > 0 && (
            <span className="flex items-center gap-1 text-sky-400" title="继承配置">
              <GitBranch className="w-3 h-3" />
              {node.inheritedCount}
            </span>
          )}
          {node.overriddenCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400" title="覆盖配置">
              <Shield className="w-3 h-3" />
              {node.overriddenCount}
            </span>
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.projectId}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InheritanceVisualizer({
  open,
  onClose,
  selectedProjectId,
}: InheritanceVisualizerProps) {
  const { projects, getInheritanceTrees, getInheritanceInfo } = useProjects({
    autoRefresh: false,
  });
  const [trees, setTrees] = useState<InheritanceNode[]>([]);
  const [info, setInfo] = useState<InheritanceInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getInheritanceTrees()
      .then(setTrees)
      .finally(() => setLoading(false));
  }, [open, getInheritanceTrees]);

  useEffect(() => {
    if (!open || !selectedProjectId) {
      setInfo(null);
      return;
    }
    getInheritanceInfo(selectedProjectId).then(setInfo);
  }, [open, selectedProjectId, getInheritanceInfo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0F172A] border border-[#334155] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-[#F1F5F9]">继承关系可视化</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] rounded-lg hover:bg-[#334155] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/2 border-r border-[#334155] overflow-y-auto p-4">
            <h3 className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-3">
              项目继承树
            </h3>
            {loading ? (
              <div className="text-center py-12 text-[#64748B] text-sm">加载中...</div>
            ) : trees.length === 0 ? (
              <div className="text-center py-12 text-[#64748B] text-sm">
                <GitBranch className="w-10 h-10 mx-auto mb-2 opacity-50" />
                暂无项目数据
              </div>
            ) : (
              <div className="space-y-2">
                {trees.map((tree) => (
                  <TreeNode
                    key={tree.projectId}
                    node={tree}
                    selectedId={selectedProjectId ?? undefined}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-1/2 overflow-y-auto p-4">
            <h3 className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-3">
              继承链详情
            </h3>
            {!info ? (
              <div className="text-center py-12 text-[#64748B] text-sm">
                <GitBranch className="w-10 h-10 mx-auto mb-2 opacity-50" />
                请从项目下拉菜单选择项目查看详情
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
                  <div className="text-sm text-[#94A3B8] mb-2">
                    当前项目：
                    <span className="text-emerald-400 font-medium ml-1">{info.projectName}</span>
                  </div>
                  {info.hasCircularDependency && (
                    <div className="flex items-start gap-2 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium mb-1">检测到循环继承</div>
                        <div className="font-mono opacity-80">
                          {info.circularPath.join(' → ')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-medium text-[#64748B] mb-2">继承链（从根到当前）</div>
                  <div className="bg-[#1E293B] border border-[#334155] rounded-lg overflow-hidden">
                    {info.chain.map((link, idx) => (
                      <div
                        key={link.projectId}
                        className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#334155]/50 last:border-b-0 ${
                          idx === 0
                            ? 'bg-sky-500/5'
                            : link.projectId === info.projectId
                            ? 'bg-emerald-500/10'
                            : ''
                        }`}
                      >
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#334155] text-xs font-mono text-[#94A3B8]">
                          {link.depth}
                        </span>
                        <GitBranch
                          className={`w-4 h-4 ${
                            idx === 0
                              ? 'text-sky-400'
                              : link.projectId === info.projectId
                              ? 'text-emerald-400'
                              : 'text-[#64748B]'
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            link.projectId === info.projectId
                              ? 'text-emerald-400 font-medium'
                              : 'text-[#F1F5F9]'
                          }`}
                        >
                          {link.projectName}
                        </span>
                        {link.depth === 0 && (
                          <span className="ml-auto text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                            根项目
                          </span>
                        )}
                        {link.projectId === info.projectId && (
                          <span className="ml-auto text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            当前
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-[#64748B] mb-2">直接子项目</div>
                  {info.children.length === 0 ? (
                    <div className="text-center py-6 text-[#64748B] text-xs bg-[#1E293B] border border-[#334155] rounded-lg">
                      无子项目
                    </div>
                  ) : (
                    <div className="bg-[#1E293B] border border-[#334155] rounded-lg overflow-hidden">
                      {info.children.map((child) => (
                        <div
                          key={child.projectId}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-[#334155]/50 last:border-b-0"
                        >
                          <ChevronDown className="w-4 h-4 text-[#64748B]" />
                          <span className="text-sm text-[#F1F5F9]">{child.projectName}</span>
                          <span className="ml-auto text-xs text-[#64748B]">
                            {child.envCount} 环境 · {child.configCount} 配置
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-[#334155] bg-[#0F172A]/50 flex items-center justify-between text-xs text-[#64748B]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> 根项目
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#64748B]" /> 中间层级
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> 当前项目
            </span>
          </div>
          <div>共 {projects.length} 个项目</div>
        </div>
      </div>
    </div>
  );
}
