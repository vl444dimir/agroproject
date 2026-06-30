import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Row, Col, Card, Table, Space, Button, Spin, Input, Tag, Tooltip, Statistic, Empty, Alert, Progress,
  Timeline, Drawer, Switch
} from 'antd';
import {
  BarChartOutlined, SearchOutlined, ReloadOutlined, GlobalOutlined, ArrowUpOutlined,
  DashboardOutlined, RiseOutlined, SwapOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend,
  AreaChart, Area
} from 'recharts';
import { marketAnalysisApi } from '../api/marketAnalysis';

const { Title, Text, Paragraph } = Typography;

// Deduplication and normalization helper for company names
const normalizeId = (name) => {
  if (!name) return '';
  let id = name.trim().toUpperCase();
  // Replace Latin characters that are identical/similar in meaning/usage
  id = id.replace(/\bTOO\b/g, 'ТОО');
  id = id.replace(/\bIP\b/g, 'ИП');
  id = id.replace(/\bKX\b/g, 'КХ');
  // Remove all quotes (single, double, guillemets, typography quotes)
  id = id.replace(/["'«»“”]/g, '');
  // Normalize whitespaces
  id = id.replace(/\s+/g, ' ');
  return id;
};

// Check if a new label is more readable/better formatted than current
const isBetterLabel = (currentLabel, newLabel) => {
  if (!currentLabel) return true;
  if (!newLabel) return false;
  const currentIsUpper = currentLabel === currentLabel.toUpperCase();
  const newIsUpper = newLabel === newLabel.toUpperCase();
  // We prefer mixed-case over all-uppercase
  if (currentIsUpper && !newIsUpper) return true;
  return false;
};

// ─── SVG-based interactive Node Graph component for Supply Chain ───
const SvgNodeGraph = ({ data, showLabelsConstantly }) => {
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupSmallBuyers, setGroupSmallBuyers] = useState(false);

  // Helper to format organization names beautifully
  const formatDisplayName = (name) => {
    if (!name) return '';
    let res = name;
    res = res.replace(/Товарищество с ограниченной ответственностью/gi, 'ТОО');
    res = res.replace(/Индивидуальный предприниматель/gi, 'ИП');
    return res.trim();
  };

  // 1. Identify leaf buyers and their volumes to filter small ones
  const buyerVolumes = {};
  const sellersSet = new Set(data.map(item => normalizeId(item.sellerName)));
  
  data.forEach(item => {
    if (item.buyerName) {
      const buyerId = normalizeId(item.buyerName);
      buyerVolumes[buyerId] = (buyerVolumes[buyerId] || 0) + (item.quantity || 0);
    }
  });

  const smallBuyers = new Set();
  if (groupSmallBuyers) {
    Object.entries(buyerVolumes).forEach(([buyerId, vol]) => {
      // If they only buy (never sell) and total volume is less than 50 tons
      if (!sellersSet.has(buyerId) && vol < 50) {
        smallBuyers.add(buyerId);
      }
    });
  }

  // 2. Find all unique nodes and group raw edges
  const nodesMap = new Map();
  const groupedEdgesMap = new Map();
  const virtualGroupInfo = new Map(); // virtualNodeName -> Map of originalCompany -> volume

  data.forEach((item) => {
    const rawSeller = item.sellerName;
    const rawBuyer = item.buyerName;
    
    const sellerId = normalizeId(rawSeller);
    let buyerId = normalizeId(rawBuyer);

    // Group small leaf buyers into virtual nodes per seller
    const isSmallBuyer = smallBuyers.has(buyerId);
    if (groupSmallBuyers && isSmallBuyer) {
      const virtualId = `PROCHIE_BUYERS_${sellerId}`;
      buyerId = virtualId;

      if (!virtualGroupInfo.has(virtualId)) {
        virtualGroupInfo.set(virtualId, new Map());
      }
      const compMap = virtualGroupInfo.get(virtualId);
      compMap.set(rawBuyer, (compMap.get(rawBuyer) || 0) + (item.quantity || 0));
    }

    // Add seller node
    const isImport = rawSeller && rawSeller.startsWith("Импорт");
    if (!nodesMap.has(sellerId)) {
      nodesMap.set(sellerId, {
        id: sellerId,
        label: rawSeller,
        level: item.hopIndex,
        isImport: isImport,
        isGroupNode: false
      });
    } else {
      const existingNode = nodesMap.get(sellerId);
      if (isBetterLabel(existingNode.label, rawSeller)) {
        existingNode.label = rawSeller;
      }
      if (existingNode.level > item.hopIndex) {
        existingNode.level = item.hopIndex;
      }
    }

    // Add buyer node
    if (!nodesMap.has(buyerId)) {
      const isVirtual = buyerId.startsWith("PROCHIE_BUYERS_");
      nodesMap.set(buyerId, {
        id: buyerId,
        label: isVirtual ? "Прочие покупатели" : rawBuyer,
        level: item.hopIndex + 1,
        isImport: false,
        isGroupNode: isVirtual
      });
    } else {
      const buyerNode = nodesMap.get(buyerId);
      if (buyerNode.level < item.hopIndex + 1) {
        buyerNode.level = item.hopIndex + 1;
      }
      const isVirtual = buyerId.startsWith("PROCHIE_BUYERS_");
      if (!isVirtual && isBetterLabel(buyerNode.label, rawBuyer)) {
        buyerNode.label = rawBuyer;
      }
    }

    const edgeKey = `${sellerId} -> ${buyerId}`;
    if (!groupedEdgesMap.has(edgeKey)) {
      groupedEdgesMap.set(edgeKey, []);
    }
    groupedEdgesMap.get(edgeKey).push({
      ...item,
      sellerName: sellerId,
      buyerName: buyerId
    });
  });

  // Populate group details inside node objects for rich tooltips
  nodesMap.forEach((node) => {
    if (node.isGroupNode && virtualGroupInfo.has(node.id)) {
      const compMap = virtualGroupInfo.get(node.id);
      node.groupedCompanies = Array.from(compMap.entries()).map(([name, quantity]) => ({
        name,
        quantity
      })).sort((a, b) => b.quantity - a.quantity);
    }
  });

  // Override parseDate to be cleaner
  const parseDateClean = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts[0].length === 4) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts[2]?.length === 4) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  const edges = Array.from(groupedEdgesMap.entries()).map(([key, items]) => {
    const from = items[0].sellerName;
    const to = items[0].buyerName;

    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalPrice = items.reduce((sum, item) => {
      const itemPrice = item.totalPrice != null ? item.totalPrice : ((item.quantity || 0) * (item.unitPrice || 0));
      return sum + itemPrice;
    }, 0);

    const unitPrice = totalQuantity > 0 ? (totalPrice / totalQuantity) : (items.reduce((sum, item) => sum + (item.unitPrice || 0), 0) / items.length);

    const markupItems = items.filter(item => item.markupPercentage != null);
    const averageMarkup = markupItems.length > 0 
      ? (markupItems.reduce((sum, item) => sum + item.markupPercentage, 0) / markupItems.length) 
      : null;

    let dateRangeStr = '';
    if (items.length === 1) {
      dateRangeStr = items[0].date;
    } else {
      const dates = items.map(item => ({ str: item.date, date: parseDateClean(item.date) })).filter(d => d.str);
      if (dates.length > 0) {
        dates.sort((a, b) => a.date - b.date);
        const minDate = dates[0].str;
        const maxDate = dates[dates.length - 1].str;
        dateRangeStr = `${items.length} сделок (${minDate} ... ${maxDate})`;
      } else {
        dateRangeStr = `${items.length} сделок`;
      }
    }

    return {
      id: `${from}-${to}`,
      from,
      to,
      date: dateRangeStr,
      quantity: totalQuantity,
      unitPrice,
      totalPrice,
      markup: averageMarkup,
      count: items.length
    };
  });

  const nodes = Array.from(nodesMap.values());

  // 3. Group nodes by level to assign coordinates
  const levels = {};
  nodes.forEach(node => {
    if (!levels[node.level]) levels[node.level] = [];
    levels[node.level].push(node);
  });

  // Calculate max nodes in any single column to dynamically size height
  let maxNodesInColumn = 1;
  Object.keys(levels).forEach(key => {
    if (levels[key].length > maxNodesInColumn) {
      maxNodesInColumn = levels[key].length;
    }
  });

  const totalLevels = Math.max(1, Object.keys(levels).length);
  const svgWidth = Math.max(1200, totalLevels * 460);
  const svgHeight = Math.max(600, maxNodesInColumn * (showLabelsConstantly ? 160 : 110));

  // Assign x, y positions to each node
  const nodePositions = {};
  const nodeWidth = 220;

  Object.keys(levels).sort((a,b)=>a-b).forEach((lvlStr, colIdx) => {
    const lvl = parseInt(lvlStr);
    const lvlNodes = levels[lvl];
    const x = (colIdx + 0.5) * (svgWidth / totalLevels);
    
    lvlNodes.forEach((node, rowIdx) => {
      const y = (rowIdx + 0.5) * (svgHeight / lvlNodes.length);
      nodePositions[node.id] = { x, y };
    });
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Header Control Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#111827',
        padding: '12px 20px',
        borderRadius: '10px',
        border: '1px solid #1f2937',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.8px' }}>
            ЛЕГЕНДА:
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Tag color="#1e3a8a" style={{ border: '1px solid #3b82f6', color: '#93c5fd', borderRadius: '4px', margin: 0 }}>
              🚢 Импорт
            </Tag>
            <Tag color="#1f2937" style={{ border: '1px solid #374151', color: '#cbd5e1', borderRadius: '4px', margin: 0 }}>
              🏢 Посредники
            </Tag>
            <Tag color="#312e81" style={{ border: '1px solid #6366f1', color: '#c7d2fe', borderRadius: '4px', margin: 0 }}>
              📦 Мелкие клиенты
            </Tag>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Space size="small" style={{ marginRight: '8px' }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Группировать мелких (&lt; 50 т/л):</span>
            <Switch
              checkedChildren="Да"
              unCheckedChildren="Нет"
              checked={groupSmallBuyers}
              onChange={(checked) => setGroupSmallBuyers(checked)}
            />
          </Space>
          <Input
            placeholder="Поиск компании на схеме..."
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            allowClear
            style={{
              width: '240px',
              background: '#1f2937',
              border: '1px solid #374151',
              color: '#ffffff',
              borderRadius: '6px'
            }}
          />
        </div>
      </div>

      {/* Scrollable Graph Area */}
      <div style={{ 
        width: '100%', 
        maxHeight: 'calc(100vh - 320px)', 
        overflow: 'auto', 
        background: '#0b0f19', 
        borderRadius: '12px', 
        padding: '24px', 
        border: '1px solid #1f2937', 
        boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.6)' 
      }}>
        <style>{`
          @keyframes flowDash {
            to {
              stroke-dashoffset: -20;
            }
          }
          .flow-edge-active {
            stroke-dasharray: 6, 4;
            animation: flowDash 1.2s linear infinite;
            stroke: #10b981 !important;
            stroke-width: 2.8px !important;
          }
          .node-rect {
            transition: fill 0.3s ease, stroke 0.3s ease, filter 0.3s ease, height 0.3s ease;
          }
          .node-rect:hover {
            filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.5));
          }
          .node-g {
            transition: opacity 0.3s ease;
          }
          .edge-g {
            transition: opacity 0.3s ease;
          }
        `}</style>
        <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
          {/* Definitions for arrowheads and gradients */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4b5563" />
            </marker>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
            </marker>
            <linearGradient id="importNodeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </linearGradient>
            <linearGradient id="standardNodeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f2937" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>
            <linearGradient id="groupNodeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#312e81" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </linearGradient>
          </defs>

          {/* ─── Render Connections (Edges) ─── */}
          {edges.map((edge) => {
            const fromPos = nodePositions[edge.from];
            const toPos = nodePositions[edge.to];
            if (!fromPos || !toPos) return null;

            const startX = fromPos.x + nodeWidth / 2;
            const startY = fromPos.y;
            const endX = toPos.x - nodeWidth / 2;
            const endY = toPos.y;

            const isHovered = hoveredEdge === edge.id || 
                              (hoveredNode === edge.from) || 
                              (hoveredNode === edge.to);

            const strokeColor = isHovered ? '#10b981' : '#374151';
            const strokeWidth = isHovered ? 2.8 : 1.5;

            // Draw bezier curve for smooth link
            const dx = endX - startX;
            const cp1x = startX + dx * 0.4;
            const cp2x = startX + dx * 0.6;
            const pathD = `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;

            const fromLabel = nodesMap.get(edge.from)?.label || '';
            const toLabel = nodesMap.get(edge.to)?.label || '';
            const edgeMatchesSearch = !searchTerm || 
              fromLabel.toLowerCase().includes(searchTerm.toLowerCase()) || 
              toLabel.toLowerCase().includes(searchTerm.toLowerCase());
            const isEdgeDimmed = !edgeMatchesSearch;

            return (
              <g key={edge.id}
                 className="edge-g"
                 onMouseEnter={() => setHoveredEdge(edge.id)}
                 onMouseLeave={() => setHoveredEdge(null)}
                 style={{ 
                   cursor: 'pointer',
                   opacity: isEdgeDimmed ? 0.08 : 1,
                   pointerEvents: isEdgeDimmed ? 'none' : 'auto'
                 }}
              >
                {/* Path connector line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  markerEnd={isHovered ? "url(#arrow-active)" : "url(#arrow)"}
                  className={isHovered ? "flow-edge-active" : ""}
                  style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease' }}
                />
                
                {/* Transparent thicker line for easier hovering */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={15}
                />
              </g>
            );
          })}

          {/* ─── Render Nodes (Companies) ─── */}
          {nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isNodeHovered = hoveredNode === node.id;

            const matchesSearch = !searchTerm || node.label.toLowerCase().includes(searchTerm.toLowerCase());
            const isNodeDimmed = !matchesSearch;

            const incomingEdges = edges.filter(e => e.to === node.id);
            const hasIncoming = incomingEdges.length > 0;
            
            // Adjust card height dynamically depending on if we display incoming transaction details
            const showDetails = hasIncoming && showLabelsConstantly;
            const nodeHeight = showDetails ? 120 : 52;

            let fillGrad = "url(#standardNodeGrad)";
            if (node.isImport) fillGrad = "url(#importNodeGrad)";
            else if (node.isGroupNode) fillGrad = "url(#groupNodeGrad)";

            const strokeColor = isNodeHovered 
              ? '#10b981' 
              : (node.isImport ? '#3b82f6' : (node.isGroupNode ? '#6366f1' : '#4b5563'));

            let nodeLabel = formatDisplayName(node.label);
            if (nodeLabel.length > 22) {
              nodeLabel = nodeLabel.substring(0, 20) + '...';
            }

            let subLabel = `ЗВЕНО #${node.level}`;
            let subLabelColor = "#9ca3af";
            let emoji = '🏢';

            if (node.isImport) {
              subLabel = 'ТАМОЖНЯ (ИМПОРТ)';
              subLabelColor = "#93c5fd";
              emoji = '🚢';
            } else if (node.isGroupNode) {
              subLabel = `${node.groupedCompanies?.length || 0} КОМПАНИЙ`;
              subLabelColor = "#c7d2fe";
              emoji = '📦';
            }

            // Calculate incoming transaction details
            const totalQty = incomingEdges.reduce((sum, e) => sum + (e.quantity || 0), 0);
            const avgPrice = incomingEdges.reduce((sum, e) => sum + ((e.unitPrice || 0) * (e.quantity || 0)), 0) / (totalQty || 1);
            const avgMarkup = incomingEdges.reduce((sum, e) => sum + (e.markup || 0), 0) / (incomingEdges.length || 1);

            const qtyStr = `📦 ${totalQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} т/л`;
            const priceStr = `💰 ${Math.round(avgPrice).toLocaleString()} ₸`;
            const markupStr = avgMarkup > 0 ? `📈 +${avgMarkup.toFixed(0)}%` : '';

            // Built rich tooltip content for nodes
            const tooltipContent = node.isGroupNode ? (
              <div style={{ padding: '4px', maxWidth: '280px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '12px', borderBottom: '1px solid #374151', paddingBottom: '3px' }}>
                  Групповой узел мелких клиентов:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {node.groupedCompanies?.map((c, i) => (
                    <div key={i} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <span style={{ color: '#cbd5e1' }}>• {formatDisplayName(c.name)}</span>
                      <span style={{ color: '#38bdf8', fontWeight: '600' }}>{c.quantity.toLocaleString(undefined, {maximumFractionDigits: 1})} т/л</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : hasIncoming ? (
              <div style={{ padding: '4px', maxWidth: '280px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '12px', borderBottom: '1px solid #374151', paddingBottom: '3px' }}>
                  Детали поставок:
                </div>
                <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    🏢 От кого: {formatDisplayName(nodesMap.get(incomingEdges[0]?.from)?.label || incomingEdges[0]?.from)}
                  </div>
                  <div>Период: <span style={{ color: '#cbd5e1' }}>{incomingEdges[0]?.date || '—'}</span></div>
                  <div>Объем: <span style={{ color: '#ffffff', fontWeight: '600' }}>{totalQty.toLocaleString()} т/л</span></div>
                  <div>Цена: <span style={{ color: '#38bdf8', fontWeight: '600' }}>{Math.round(avgPrice).toLocaleString()} ₸</span></div>
                  {avgMarkup > 0 && (
                    <div>Наценка: <span style={{ color: avgMarkup > 30 ? "#ef4444" : (avgMarkup > 15 ? "#f59e0b" : "#10b981"), fontWeight: '600' }}>+{avgMarkup.toFixed(1)}%</span></div>
                  )}
                </div>
              </div>
            ) : (
              node.label
            );

            return (
              <Tooltip key={node.id} title={tooltipContent} placement="top" color={node.isGroupNode || hasIncoming ? "#1e1b4b" : undefined}>
                <g
                   className="node-g"
                   transform={`translate(${pos.x - nodeWidth / 2}, ${pos.y - nodeHeight / 2})`}
                   onMouseEnter={() => setHoveredNode(node.id)}
                   onMouseLeave={() => setHoveredNode(null)}
                   style={{ 
                     cursor: 'pointer',
                     opacity: isNodeDimmed ? 0.15 : 1,
                     pointerEvents: isNodeDimmed ? 'none' : 'auto'
                   }}
                >
                  {/* Node Box */}
                  <rect
                    className="node-rect"
                    width={nodeWidth}
                    height={nodeHeight}
                    rx="8"
                    fill={fillGrad}
                    stroke={strokeColor}
                    strokeWidth={isNodeHovered ? "2" : "1.2"}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                  
                  {/* Icon Emoji */}
                  <text x="14" y="33" fontSize="18">
                    {emoji}
                  </text>

                  {/* Text label */}
                  <text
                    x="42"
                    y="25"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="start"
                  >
                    {nodeLabel}
                  </text>

                  {/* Sub-label */}
                  <text
                    x="42"
                    y="41"
                    fill={subLabelColor}
                    fontSize="8.5"
                    fontWeight="600"
                    textAnchor="start"
                    letterSpacing="0.8"
                  >
                    {subLabel}
                  </text>

                  {/* Integrated Transaction Details at Bottom */}
                  {showDetails && (
                    <>
                      <line x1="0" y1="52" x2={nodeWidth} y2="52" stroke="#374151" strokeWidth="1" />
                      
                      {/* От кого */}
                      <text x="12" y="68" fill="#9ca3af" fontSize="8.5" textAnchor="start">
                        От кого:
                      </text>
                      <text x="60" y="68" fill="#cbd5e1" fontSize="8.5" fontWeight="bold" textAnchor="start">
                        {incomingEdges[0]?.from ? (
                          (() => {
                            const label = nodesMap.get(incomingEdges[0].from)?.label || incomingEdges[0].from;
                            const formatted = formatDisplayName(label);
                            return formatted.length > 24 ? formatted.substring(0, 22) + '...' : formatted;
                          })()
                        ) : '—'}
                      </text>

                      {/* Период */}
                      <text x="12" y="82" fill="#9ca3af" fontSize="8.5" textAnchor="start">
                        Период:
                      </text>
                      <text x="60" y="82" fill="#cbd5e1" fontSize="8.5" textAnchor="start">
                        {incomingEdges[0]?.date || '—'}
                      </text>

                      {/* Объем */}
                      <text x="12" y="96" fill="#9ca3af" fontSize="8.5" textAnchor="start">
                        Объем:
                      </text>
                      <text x="60" y="96" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="start">
                        {totalQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} т/л
                      </text>

                      {/* Цена */}
                      <text x="12" y="110" fill="#9ca3af" fontSize="8.5" textAnchor="start">
                        Цена:
                      </text>
                      <text x="60" y="110" fill="#38bdf8" fontSize="8.5" fontWeight="bold" textAnchor="start">
                        {Math.round(avgPrice).toLocaleString()} ₸
                      </text>

                      {/* Наценка */}
                      {avgMarkup > 0 && (
                        <text x="160" y="110" fill={avgMarkup > 30 ? "#ef4444" : (avgMarkup > 15 ? "#f59e0b" : "#10b981")} fontSize="8.5" fontWeight="bold" textAnchor="start">
                          {markupStr}
                        </text>
                      )}
                    </>
                  )}
                </g>
              </Tooltip>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const MarketAnalysis = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState('');
  
  // ─── Supply Chain Drawer States ───
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [supplyChainData, setSupplyChainData] = useState([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [showLabelsConstantly, setShowLabelsConstantly] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await marketAnalysisApi.getProductsAnalysis();
      setData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch market analysis data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── Fetch Product Supply Chain ───
  const handleProductClick = async (record) => {
    setSelectedProduct(record);
    setDrawerVisible(true);
    setChainLoading(true);
    setSupplyChainData([]);
    try {
      const res = await marketAnalysisApi.getProductSupplyChain(record.productId);
      setSupplyChainData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch product supply chain', err);
    } finally {
      setChainLoading(false);
    }
  };

  // ─── Filtered Data for Search ───
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const nameMatch = item.productName?.toLowerCase().includes(searchText.toLowerCase());
      const catMatch = item.categoryName?.toLowerCase().includes(searchText.toLowerCase());
      return nameMatch || catMatch;
    });
  }, [data, searchText]);

  // ─── Categories list for filter buttons ───
  const categories = useMemo(() => {
    const set = new Set(data.map(item => item.categoryName).filter(Boolean));
    return Array.from(set);
  }, [data]);

  // ─── Aggregated Statistics ───
  const stats = useMemo(() => {
    if (data.length === 0) return { totalSales: 0, totalImports: 0, avgMarkup: 0, topProduct: '—' };

    let totalSales = 0;
    let totalImports = 0;
    let sumMarkup = 0;
    let countMarkup = 0;
    let maxSales = 0;
    let topProduct = '—';

    data.forEach(item => {
      totalSales += item.totalSalesVolume || 0;
      totalImports += item.totalImportVolume || 0;
      if (item.priceDifferencePercentage != null && item.priceDifferencePercentage > 0) {
        sumMarkup += item.priceDifferencePercentage;
        countMarkup++;
      }
      if ((item.totalSalesVolume || 0) > maxSales) {
        maxSales = item.totalSalesVolume;
        topProduct = item.productName;
      }
    });

    return {
      totalSales: Math.round(totalSales * 10) / 10,
      totalImports: Math.round(totalImports * 10) / 10,
      avgMarkup: countMarkup > 0 ? Math.round((sumMarkup / countMarkup) * 10) / 10 : 0,
      topProduct: topProduct.length > 30 ? topProduct.substring(0, 30) + '...' : topProduct
    };
  }, [data]);

  // ─── Chart Data (Top 8 products by Sales Volume for readability) ───
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => (b.totalSalesVolume || 0) - (a.totalSalesVolume || 0))
      .slice(0, 8)
      .map(item => ({
        name: item.productName.length > 15 ? item.productName.substring(0, 15) + '...' : item.productName,
        'Объем продаж (ЭСФ), т/л': item.totalSalesVolume || 0,
        'Объем импорта (Таможня), т/л': item.totalImportVolume || 0,
        'Цена продажи (ЭСФ), ₸': item.averageSalesPrice || 0,
        'Цена импорта (Таможня), ₸': item.averageImportPrice || 0,
      }));
  }, [data]);

  const tableColumns = [
    {
      title: 'Препарат (нажмите для анализа цепи)',
      dataIndex: 'productName',
      key: 'productName',
      render: (text, record) => (
        <Tooltip title="Нажмите, чтобы проследить всю цепочку перепродаж по ЭСФ">
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 'bold', color: '#1a7c3e', textAlign: 'left' }}
            onClick={() => handleProductClick(record)}
          >
            {text}
          </Button>
        </Tooltip>
      ),
      sorter: (a, b) => a.productName.localeCompare(b.productName),
    },
    {
      title: 'Категория',
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (cat) => <Tag color="blue">{cat || 'Прочее'}</Tag>,
      filters: categories.map(cat => ({ text: cat, value: cat })),
      onFilter: (value, record) => record.categoryName === value,
    },
    {
      title: 'Продажи (ЭСФ)',
      children: [
        {
          title: 'Объем (т/л)',
          dataIndex: 'totalSalesVolume',
          key: 'totalSalesVolume',
          render: (val) => val ? `${val.toLocaleString()} т/л` : <Text type="secondary">—</Text>,
          sorter: (a, b) => (a.totalSalesVolume || 0) - (b.totalSalesVolume || 0),
        },
        {
          title: 'Ср. цена (₸)',
          dataIndex: 'averageSalesPrice',
          key: 'averageSalesPrice',
          render: (val) => val ? `${Math.round(val).toLocaleString()} ₸` : <Text type="secondary">—</Text>,
          sorter: (a, b) => (a.averageSalesPrice || 0) - (b.averageSalesPrice || 0),
        }
      ]
    },
    {
      title: 'Импорт (Таможня)',
      children: [
        {
          title: 'Объем (т/л)',
          dataIndex: 'totalImportVolume',
          key: 'totalImportVolume',
          render: (val) => val ? `${val.toLocaleString()} т/л` : <Text type="secondary">—</Text>,
          sorter: (a, b) => (a.totalImportVolume || 0) - (b.totalImportVolume || 0),
        },
        {
          title: 'Ср. цена (₸)',
          dataIndex: 'averageImportPrice',
          key: 'averageImportPrice',
          render: (val) => val ? `${Math.round(val).toLocaleString()} ₸` : <Text type="secondary">—</Text>,
          sorter: (a, b) => (a.averageImportPrice || 0) - (b.averageImportPrice || 0),
        }
      ]
    },
    {
      title: 'Наценка рынка',
      dataIndex: 'priceDifferencePercentage',
      key: 'priceDifferencePercentage',
      sorter: (a, b) => (a.priceDifferencePercentage || 0) - (b.priceDifferencePercentage || 0),
      render: (val) => {
        if (val == null || val <= 0) return <Text type="secondary">—</Text>;
        let color = 'green';
        if (val > 30) color = 'red';
        else if (val > 15) color = 'orange';
        
        return (
          <Tooltip title={`Разница между средней ценой продажи по ЭСФ и ценой импорта`}>
            <Tag color={color} style={{ fontWeight: 'bold', fontSize: 13, padding: '3px 8px' }}>
              <ArrowUpOutlined /> {val.toFixed(1)}%
            </Tag>
          </Tooltip>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Анализируем электронные счета-фактуры и таможенные декларации..." />
      </div>
    );
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} className="agro-page-title" style={{ marginBottom: 0 }}>
            Анализ рынка сбыта пестицидов и удобрений
          </Title>
          <Text type="secondary">
            Оценка реальной картины продаж удобрений и пестицидов на основе электронных счетов-фактур (ЭСФ) и таможенных деклараций.
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData}>Обновить данные</Button>
          </Space>
        </Col>
      </Row>

      {data.length === 0 ? (
        <Card className="agro-card" style={{ textAlign: 'center', padding: 40 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size="middle">
                <Text strong style={{ fontSize: 16 }}>Данные для анализа рынка отсутствуют</Text>
                <Paragraph style={{ maxWidth: 500, margin: '0 auto' }}>
                  Чтобы построить отчет, загрузите электронные счета-фактуры (ЭСФ) и таможенные декларации через универсальный импорт Excel.
                </Paragraph>
              </Space>
            }
          >
            <Button type="primary" size="large" icon={<RiseOutlined />} onClick={() => navigate('/import')}>
              Перейти к импорту данных
            </Button>
          </Empty>
        </Card>
      ) : (
        <>
          {/* ─── Metric Cards ─── */}
          <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card className="agro-card" bordered={false} style={{ background: 'linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)' }}>
                <Statistic
                  title={<Text strong type="secondary">Объем продаж (ЭСФ)</Text>}
                  value={stats.totalSales}
                  suffix="т/л"
                  prefix={<BarChartOutlined style={{ color: '#1a7c3e' }} />}
                  valueStyle={{ color: '#1a7c3e', fontWeight: 'bold' }}
                />
                <Progress percent={stats.totalImports > 0 ? Math.min(100, Math.round((stats.totalSales / (stats.totalImports || 1)) * 100)) : 0} size="small" strokeColor="#1a7c3e" format={p => `Реализовано ${p}% от импорта`} style={{ marginTop: 8 }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="agro-card" bordered={false}>
                <Statistic
                  title={<Text strong type="secondary">Объем импорта (Таможня)</Text>}
                  value={stats.totalImports}
                  suffix="т/л"
                  prefix={<GlobalOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>Импортировано из стран ближнего и дальнего зарубежья</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="agro-card" bordered={false}>
                <Statistic
                  title={<Text strong type="secondary">Средняя наценка рынка</Text>}
                  value={stats.avgMarkup}
                  suffix="%"
                  prefix={<RiseOutlined style={{ color: '#fa8c16' }} />}
                  valueStyle={{ color: '#fa8c16', fontWeight: 'bold' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>Разница между импортной стоимостью и ценой реализации</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="agro-card" bordered={false}>
                <Statistic
                  title={<Text strong type="secondary">Лидер продаж</Text>}
                  value={stats.topProduct}
                  valueStyle={{ color: '#722ed1', fontSize: 16, fontWeight: 'bold' }}
                  prefix={<DashboardOutlined style={{ color: '#722ed1' }} />}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>Наибольший физический объем сбыта на рынке АПК</Text>
              </Card>
            </Col>
          </Row>

          {/* ─── Charts Section ─── */}
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="Соотношение импорта и реальных продаж (т/л)" className="agro-card">
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <ChartTooltip />
                      <Legend />
                      <Bar dataKey="Объем импорта (Таможня), т/л" fill="#1890ff" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Объем продаж (ЭСФ), т/л" fill="#1a7c3e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Корреляция цен импорта и розничных продаж (₸ / кг-л)" className="agro-card">
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#237804" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#237804" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorImport" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#096dd9" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#096dd9" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <ChartTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="Цена импорта (Таможня), ₸" stroke="#1890ff" strokeWidth={2.5} fillOpacity={1} fill="url(#colorImport)" />
                      <Area type="monotone" dataKey="Цена продажи (ЭСФ), ₸" stroke="#1a7c3e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>

          {/* ─── Dynamic Table & Search ─── */}
          <Card title="Сравнительная таблица по пестицидам и удобрениям" className="agro-card">
            <Row justify="space-between" style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12}>
                <Input
                  placeholder="Быстрый поиск по названию или категории..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  allowClear
                  style={{ maxWidth: 400, width: '100%' }}
                />
              </Col>
            </Row>

            <Table
              dataSource={filteredData.map((item, idx) => ({ ...item, key: item.productId || idx }))}
              columns={tableColumns}
              pagination={{ pageSize: 10 }}
              size="middle"
              scroll={{ x: true }}
              rowClassName={(record, idx) => idx % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
            />
          </Card>
        </>
      )}

      {/* ─── Supply Chain Traceability Drawer ─── */}
      <Drawer
        title={
          <Row justify="space-between" align="middle" style={{ width: '95%' }}>
            <Col>
              <div style={{ color: '#1a7c3e', fontWeight: 'bold', fontSize: 18 }}>
                <SwapOutlined /> Карта цепочки поставок: {selectedProduct?.productName}
              </div>
            </Col>
            <Col>
              <Space size="middle">
                <span style={{ fontSize: 13, color: '#595959' }}>Показывать ярлыки сделок:</span>
                <Switch
                  checkedChildren="Постоянно"
                  unCheckedChildren="При наведении"
                  checked={showLabelsConstantly}
                  onChange={(checked) => setShowLabelsConstantly(checked)}
                />
              </Space>
            </Col>
          </Row>
        }
        placement="right"
        width="100%"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        destroyOnClose
      >
        {chainLoading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin size="large" tip="Реконструируем карту цепочки поставок..." />
          </div>
        ) : supplyChainData.length === 0 ? (
          <Empty
            description={
              <Space direction="vertical" size="small">
                <Text strong>Цепочка сделок не найдена</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  В базе данных нет связанных импортных или торговых записей о данном препарате.
                </Text>
              </Space>
            }
          />
        ) : (
          <div style={{ padding: '10px 0', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Statistics Row */}
            <Card
              size="small"
              style={{
                marginBottom: 24,
                background: 'linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)',
                border: '1px solid #d9f7be',
                borderRadius: 8
              }}
            >
              <Row gutter={16} style={{ textAlign: 'center' }}>
                <Col span={8}>
                  <Statistic
                    title={<Text style={{ fontSize: 12 }} type="secondary">Звеньев в цепи</Text>}
                    value={supplyChainData.length}
                    valueStyle={{ fontSize: 20, color: '#1a7c3e', fontWeight: 'bold' }}
                    suffix="сделок"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={<Text style={{ fontSize: 12 }} type="secondary">Участников (компаний)</Text>}
                    value={new Set(supplyChainData.flatMap(n => [n.sellerName, n.buyerName]).map(normalizeId)).size}
                    valueStyle={{ fontSize: 20, color: '#1890ff', fontWeight: 'bold' }}
                    suffix="фирм"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={<Text style={{ fontSize: 12 }} type="secondary">Максимальный шаг перепродаж</Text>}
                    value={Math.max(...supplyChainData.map(n => n.hopIndex))}
                    valueStyle={{ fontSize: 20, color: '#722ed1', fontWeight: 'bold' }}
                    suffix="посредников"
                  />
                </Col>
              </Row>
            </Card>

            {/* SVG Interactive Node Graph Flow */}
            <SvgNodeGraph data={supplyChainData} showLabelsConstantly={showLabelsConstantly} />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default MarketAnalysis;
