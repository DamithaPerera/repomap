'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { ProjectAnalysis } from '@/types/analysis';
import { buildGraphElements } from './graphBuilder';
import { ApiNode, SocketNode, DbNode } from './nodeTypes';
import { DetailPanel } from './DetailPanel';
import { Legend } from './Legend';

const nodeTypes = {
  apiNode: ApiNode,
  socketNode: SocketNode,
  dbNode: DbNode,
};

interface Props {
  analysis: ProjectAnalysis;
  focusNodeId?: string | null;
  onNodeSelect?: (id: string | null) => void;
}

function GraphInner({ analysis, focusNodeId, onNodeSelect }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphElements(analysis),
    [analysis]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const { fitView, setCenter } = useReactFlow();

  // Highlight + pan to node when focusNodeId changes (from list click)
  useEffect(() => {
    if (!focusNodeId) return;
    const target = nodes.find((n) => n.id === focusNodeId);
    if (!target) return;

    // Highlight the node
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === focusNodeId,
      }))
    );

    // Pan to it
    setCenter(
      target.position.x + 120,
      target.position.y + 40,
      { zoom: 1.2, duration: 600 }
    );

    setSelectedNode(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const next = selectedNode?.id === node.id ? null : node;
    setSelectedNode(next);
    onNodeSelect?.(next?.id ?? null);
  }, [selectedNode, onNodeSelect]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls className="!bg-slate-800 !border-slate-700 !rounded-lg" />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'apiNode') return '#6366f1';
            if (n.type === 'socketNode') return '#14b8a6';
            return '#22c55e';
          }}
          maskColor="rgba(15,23,42,0.7)"
          className="!bg-slate-900 !border-slate-700 !rounded-lg"
        />
      </ReactFlow>

      <DetailPanel node={selectedNode} onClose={() => { setSelectedNode(null); onNodeSelect?.(null); }} />
      <Legend />
    </div>
  );
}

export function RepoGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
