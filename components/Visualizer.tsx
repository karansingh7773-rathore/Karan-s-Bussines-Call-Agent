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
    let phase = 0;
    let currentAmplitude = 0;

    // Handle high-DPI displays
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    
    // Initial size
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      // Smooth amplitude transition for less jitter
      // If active, target is amplitude. If idle, target is a tiny breathing motion.
      const targetAmplitude = isActive ? Math.max(0.15, amplitude) : 0;
      currentAmplitude += (targetAmplitude - currentAmplitude) * 0.1;

      // Clear canvas
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const centerY = height / 2;
      
      ctx.clearRect(0, 0, width, height);

      // Animation speed
      phase += isActive ? 0.15 : 0.05;

      // Define waves: Color, Width, Frequency, Speed Factor
      const waves = [
        { color: 'rgba(255, 255, 255, 1.0)', lineWidth: 2, freq: 0.015, speed: 1.0 },
        { color: 'rgba(255, 255, 255, 0.4)', lineWidth: 1, freq: 0.02, speed: 1.5 },
        { color: 'rgba(255, 255, 255, 0.2)', lineWidth: 1, freq: 0.01, speed: 0.7 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = wave.lineWidth;

        for (let x = 0; x <= width; x += 3) {
            // Normalized X (-1 to 1)
            const nx = (x / width) * 2 - 1;
            
            // Window function to taper edges to 0 (Parabolic)
            const window = Math.max(0, 1 - Math.pow(nx, 2)); 
            
            // If idle, use a constant small amplitude for "breathing" effect
            const effectiveAmp = isActive ? currentAmplitude : 0.05;

            const y = Math.sin(x * wave.freq + phase * wave.speed) * (effectiveAmp * height * 0.4) * window;
            
            if (x === 0) ctx.moveTo(x, centerY + y);
            else ctx.lineTo(x, centerY + y);
        }
        ctx.stroke();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animationId);
    };
  }, [amplitude, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-32"
    />
  );
};

export default Visualizer;