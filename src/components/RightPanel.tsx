import { useState } from "react";
import type { Layer, BlendMode } from "../types/layer";
import type { CommitSummary, Branch } from "../api/projects";
import { LayerPanel } from "./LayerPanel";
import { CommitsTab } from "./CommitsTab";
import { BranchesTab } from "./BranchesTab";
import { TreeTab } from "./TreeTab";

type Tab = 'layers' | 'commits' | 'branches' | 'tree';

type Props = {
  // Layer props
  layers:        Layer[],
  activeLayerId: string | null,
  onSelectLayer:  (id: string) => void,
  onAddLayer:     () => void,
  onDeleteLayer:  (id: string) => void,
  onMoveUp:       (id: string) => void,
  onMoveDown:     (id: string) => void,
  onVisibility:   (id: string, visible: boolean) => void,
  onOpacity:      (id: string, opacity: number) => void,
  onBlendMode:    (id: string, blendMode: BlendMode) => void,
  onRename:       (id: string, name: string) => void,
  onClear:        (id: string) => void,

  // Commit props
  branchCommits: CommitSummary[]  // for Commits tab
  allCommits:    CommitSummary[]  // for Tree tab
  viewingCommitId: string | null,
  headCommitId:   string | null,
  activeBranchId: string | null,
  commitMessage:  string,
  committing:     boolean,
  isDetached:     boolean,
  onCommitMessageChange: (msg: string) => void,
  onCommit:       () => void,
  onRestoreCommit:(commit: CommitSummary) => void,
  onCreateBranchFromCommit: (commit: CommitSummary) => void,

  // Branch props
  branches:       Branch[],
  onCheckout:     (branch: Branch) => void,
  onDeleteBranch: (branch: Branch) => void,
};

export function RightPanel(props: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('layers');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'layers', label: 'Layers' },
    { id: 'commits', label: 'Commits' },
    { id: 'branches', label: 'Branches' },
    { id: 'tree', label: 'Tree' },
  ];

    return (
    <div style={{
      position: 'absolute', top: 10, right: 10, zIndex: 10,
      background: 'white', border: '1px solid #ddd',
      borderRadius: 10,
      boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      width: 240,
      display: 'flex', flexDirection: 'column',
      maxHeight: 'calc(100vh - 20px)',
      overflow: 'hidden',
    }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #eee',
        flexShrink: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '8px 0',
              border: 'none', background: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #222' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: 11, cursor: 'pointer',
              color: activeTab === tab.id ? '#222' : '#888',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {activeTab === 'layers' && (
          <LayerPanel
            layers={props.layers}
            activeLayerId={props.activeLayerId}
            onSelect={props.onSelectLayer}
            onAdd={props.onAddLayer}
            onDelete={props.onDeleteLayer}
            onMoveUp={props.onMoveUp}
            onMoveDown={props.onMoveDown}
            onVisibility={props.onVisibility}
            onOpacity={props.onOpacity}
            onBlendMode={props.onBlendMode}
            onRename={props.onRename}
            onClear={props.onClear}
          />
        )}

        {activeTab === 'commits' && (
          <CommitsTab
            commits={props.branchCommits}
            headCommitId={props.headCommitId}
            viewingCommitId={props.viewingCommitId}
            commitMessage={props.commitMessage}
            committing={props.committing}
            isDetached={props.isDetached}
            onCommitMessageChange={props.onCommitMessageChange}
            onCommit={props.onCommit}
            onRestore={props.onRestoreCommit}
            onCreateBranch={props.onCreateBranchFromCommit}
          />
        )}

        {activeTab === 'branches' && (
          <BranchesTab
            branches={props.branches}
            activeBranchId={props.activeBranchId}
            onCheckout={props.onCheckout}
            onDelete={props.onDeleteBranch}
          />
        )}

        {activeTab === 'tree' && (
          <TreeTab
            commits={props.allCommits}
            branches={props.branches}
            headCommitId={props.headCommitId}
            activeBranchId={props.activeBranchId}
            onRestore={props.onRestoreCommit}
            onDeleteBranch={props.onDeleteBranch}
          />
        )}
      </div>
    </div>
  );
}