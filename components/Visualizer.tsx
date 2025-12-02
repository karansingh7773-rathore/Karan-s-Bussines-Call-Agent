import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  amplitude: number;
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ amplitude, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bars = 20;
    const barWidth = canvas.width / bars;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!isActive) {
        // Draw idle line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Draw dynamic bars
      for (let i = 0; i < bars; i++) {
        // Create a wave effect based on amplitude and time
        const time = Date.now() / 200;
        const wave = Math.sin(i * 0.5 + time);
        const height = Math.max(2, (amplitude * 100) * (Math.abs(wave) + 0.5) * (canvas.height / 2));
        
        const x = i * barWidth;
        const y = (canvas.height - height) / 2;
        
        ctx.fillStyle = `rgba(56, 189, 248, ${0.5 + amplitude * 2})`; // Sky blue with dynamic opacity
        ctx.fillRect(x + 2, y, barWidth - 4, height);
      }
      
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [amplitude, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={100} 
      className="w-full h-24 bg-slate-800/50 rounded-lg border border-slate-700"
    />
  );
};

export default Visualizer;