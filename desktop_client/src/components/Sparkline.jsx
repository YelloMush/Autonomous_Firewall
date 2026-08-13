import React from 'react';

function computePoints(data, width, height) {
  const values = (data || []).map((v) => (Number.isFinite(v) ? v : 0));
  const n = values.length;

  if (n <= 1) {
    const midY = height / 2;
    return [[0, midY], [width, midY]];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return values.map((v, i) => {
    const x = (i / (n - 1)) * width;
    const y = range === 0 ? height / 2 : height - ((v - min) / range) * height;
    return [x, y];
  });
}

export default function Sparkline({
  data = [],
  width = 56,
  height = 20,
  color = 'var(--sage)',
  strokeWidth = 1.3,
  fill = true,
}) {
  const points = computePoints(data, width, height);
  const strokePoints = points.map(([x, y]) => `${x},${y}`).join(' ');

  const [firstX, firstY] = points[0];
  const [lastX] = points[points.length - 1];
  const fillPath =
    `M ${firstX},${firstY} ` +
    points.slice(1).map(([x, y]) => `L ${x},${y}`).join(' ') +
    ` L ${lastX},${height} L ${firstX},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {fill && (
        <defs>
          <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {fill && (
        <path d={fillPath} fill="url(#sparkline-fill)" stroke="none" />
      )}
      <polyline
        points={strokePoints}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
