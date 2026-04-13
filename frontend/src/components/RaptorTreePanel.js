import { useEffect, useState, useRef } from 'react';
import { RefreshCcw, TreeDeciduous } from 'lucide-react';

// Simple SVG tree renderer that fetches the full RAPTOR tree and lays it out
// top-down. Summary nodes display their short `title` (2-3 words) while the
// full text is available as hover alt-text (truncated).

const PreviewLen = 300;

const RaptorTreePanel = ({ apiBase }) => {
  const [treeRoots, setTreeRoots] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  // Pan & zoom transform: translate (px) then scale
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const panRef = useRef({ dragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  const MIN_SCALE = 0.25;
  const MAX_SCALE = 4;

  useEffect(() => {
    fetchFullTree();
  }, []);

  const fetchNodes = async (parentId = null) => {
    const query = parentId ? `?node_id=${encodeURIComponent(parentId)}` : '';
    const url = `${apiBase}/raptor/tree/${query}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.nodes || [];
  };

  const fetchSubtree = async (node, depth = 0) => {
    const children = await fetchNodes(node.id);
    node.children = [];
    node._depth = depth;
    if (children && children.length > 0) {
      for (const c of children) {
        const child = await fetchSubtree(c, depth + 1);
        node.children.push(child);
      }
    }
    return node;
  };

  const fetchFullTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const roots = await fetchNodes(null);
      const built = [];
      for (const r of roots) {
        const node = await fetchSubtree(r, 0);
        built.push(node);
      }

      // assign colors per top-level root and compute layout
      const colored = built.map((r, i) => ({ ...r, _color: `hsl(${(i * 360) / Math.max(1, built.length)},70%,60%)` }));
      for (const r of colored) propagateColor(r, r._color);

      computeLayout(colored);
      setTreeRoots(colored);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Pan/zoom handlers
  const onWheel = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setTransform((t) => {
      const scaleBy = e.deltaY > 0 ? 0.9 : 1.1;
      const newK = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.k * scaleBy));
      const worldX = (mouseX - t.x) / t.k;
      const worldY = (mouseY - t.y) / t.k;
      const newX = mouseX - worldX * newK;
      const newY = mouseY - worldY * newK;
      return { x: newX, y: newY, k: newK };
    });
  };

  const onPointerDown = (e) => {
    // only left button
    if (e.button !== undefined && e.button !== 0) return;
    panRef.current.dragging = true;
    panRef.current.startX = e.clientX;
    panRef.current.startY = e.clientY;
    panRef.current.startTx = transform.x;
    panRef.current.startTy = transform.y;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    if (!panRef.current.dragging) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setTransform((t) => ({ ...t, x: panRef.current.startTx + dx, y: panRef.current.startTy + dy }));
  };

  const onPointerUp = (e) => {
    if (panRef.current.dragging) {
      panRef.current.dragging = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const onDoubleClick = () => {
    setTransform({ x: 0, y: 0, k: 1 });
  };

  const propagateColor = (node, color) => {
    node._color = color;
    if (node.children) node.children.forEach((c) => propagateColor(c, color));
  };

  const getTextColor = (hsl) => {
    if (!hsl) return '#111';
    const m = /hsl\(\s*([0-9.]+)\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*\)/i.exec(hsl);
    if (!m) return '#111';
    const L = Number(m[3]);
    return L > 50 ? '#071423' : '#fff';
  };

  const computeLayout = (roots) => {
    const hGap = 140;
    const vGap = 110;
    let leafCounter = 0;
    let maxDepth = 0;

    const setPos = (node, depth = 0) => {
      maxDepth = Math.max(maxDepth, depth);
      if (!node.children || node.children.length === 0) {
        node.x = leafCounter * hGap + 60;
        node.y = depth * vGap + 40;
        leafCounter += 1;
        return node.x;
      }
      const xs = node.children.map((c) => setPos(c, depth + 1));
      node.x = xs.reduce((a, b) => a + b, 0) / xs.length;
      node.y = depth * vGap + 40;
      return node.x;
    };

    for (const r of roots) setPos(r, 0);
    // store layout metadata
    roots._layout = {
      width: Math.max(800, Math.max(1, leafCounter) * hGap + 120),
      height: (maxDepth + 1) * vGap + 120,
    };
  };

  const renderLinks = (node, links = []) => {
    if (!node.children) return links;
    for (const c of node.children) {
      links.push({ x1: node.x, y1: node.y, x2: c.x, y2: c.y, color: node._color });
      renderLinks(c, links);
    }
    return links;
  };

  const renderNodes = (node, acc = []) => {
    acc.push(node);
    if (node.children) node.children.forEach((c) => renderNodes(c, acc));
    return acc;
  };

  if (error) {
    return (
      <div className="p-4 bg-base-100 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <TreeDeciduous className="w-4 h-4" />
          <span>RAPTOR Tree</span>
        </div>
        <div className="mt-3 text-sm text-rose-600">{error}</div>
        <button className="btn btn-xs btn-outline mt-3" onClick={fetchFullTree}>
          <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
        </button>
      </div>
    );
  }

  if (loading || !treeRoots) {
    return (
      <div className="p-4 bg-base-100 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <TreeDeciduous className="w-4 h-4" />
          <span>RAPTOR Tree</span>
        </div>
        <div className="mt-3 text-sm text-slate-600">Loading tree…</div>
      </div>
    );
  }

  const layout = treeRoots._layout || { width: 800, height: 600 };
  const links = [];
  const nodes = [];
  for (const r of treeRoots) {
    renderLinks(r, links);
    renderNodes(r, nodes);
  }

  // compute tooltip screen position inside container from world coords
  const showTooltipFor = (node) => {
    const { x, y, k } = transform;
    setTooltip({ visible: true, x: node.x * k + x + 16, y: node.y * k + y - 10, content: node.document || '' });
  };

  const hideTooltip = () => setTooltip((t) => ({ ...t, visible: false }));

  return (
    <div
      className="p-4 bg-base-100 rounded-2xl border border-slate-200 shadow-sm"
      ref={containerRef}
      style={{ position: 'relative' }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <TreeDeciduous className="w-4 h-4" />
          <span>RAPTOR Tree</span>
        </div>
        <button type="button" onClick={fetchFullTree} className="btn btn-xs btn-outline">
          <RefreshCcw className="w-3 h-3 mr-1" />
          Refresh
        </button>
      </div>

      <div className="overflow-auto" style={{ height: '70vh' }}>
        <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMinYMin meet">
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
            </filter>
          </defs>

          <g transform={`scale(${transform.k}) translate(${transform.x}, ${transform.y})`}>
            {links.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color || '#999'} strokeWidth={1.5} strokeOpacity={0.9} />
            ))}

            {nodes.map((n, i) => {
              const textColor = getTextColor(n._color);
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onPointerEnter={() => showTooltipFor(n)}
                  onPointerLeave={() => hideTooltip()}
                >
                  <rect x={-28} y={-18} rx={8} ry={8} width={56} height={36} fill={n._color || '#ddd'} stroke="#2a2a2a" strokeWidth={1} filter="url(#shadow)" />
                  {n.title ? (
                    <text x={0} y={0} fontSize={12} fill={textColor} className="select-none" textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 700 }}>
                      {n.title}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* HTML tooltip */}
      {tooltip.visible && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(8px, -8px)',
            maxWidth: 520,
            maxHeight: 320,
            overflow: 'auto',
            background: 'white',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            padding: '12px',
            zIndex: 9999,
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 12, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{tooltip.content}</div>
        </div>
      )}
    </div>
  );
};

export default RaptorTreePanel;
