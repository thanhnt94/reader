import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidBlockProps {
  chart: string;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#0d1117',
        primaryColor: '#10b981',
        primaryTextColor: '#fff',
        primaryBorderColor: '#059669',
        lineColor: '#64748b',
        secondaryColor: '#06b6d4',
        tertiaryColor: '#1e293b',
      },
    });

    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
        setError(null);
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        setError(err.message || 'Failed to render diagram');
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 my-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
        Failed to render Mermaid diagram: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-6 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex justify-center items-center overflow-x-auto shadow-lg"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
