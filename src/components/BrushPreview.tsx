import { useEffect, useRef } from "react";

type Props = {
  size: number,
  visible: boolean,
  canvasWidth: number,
  canvasHeight: number,
};

export function BrushPreview({ size, visible, canvasWidth, canvasHeight }: Props) {
  const opacity = useRef(0);
  const rafRef = useRef<number | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);
  const fillRef = useRef<SVGCircleElement>(null);

  // updates opacity directly on the SVG element => no React re-render necessary
  // every animation frame is run during the fade
  function applyOpacity(val: number) {
    opacity.current = val;
    if (svgRef.current) svgRef.current.style.opacity = String(val);
  }

  function fadeOut() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const startOpacity = opacity.current;
    const startTime = performance.now();
    const duration = 400;  // ms

    function step(now: number) {
      const time = Math.min(1, (now - startTime) / duration);
      applyOpacity(startOpacity * (1 - time));
      if (time < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    if (visible) {
      // cancels any in-progress fade and snap to full opacity
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      applyOpacity(1);
    } else {
      // starts fade after a short delay
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(fadeOut, 800);
    }
  }, [visible]);

  // updates circle geometry directly when size changes => no rerender
  // => direct DOM manipulation for smooth real-time feedback
  useEffect(() => {
    if (!circleRef.current || !fillRef.current) return;
    const r = size / 2;

    circleRef.current.setAttribute('r', String(r));
    fillRef.current.setAttribute('r', String(r));
  }, [size]);

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',  // never intercept canvas input
        opacity: 0,             // starts invisible
        zIndex: 5,
      }}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
    >
      {/* Semi-transparent white fill — dims canvas beneath to distinguish preview */}
      <circle
        ref={fillRef}
        cx={cx}
        cy={cy}
        r={size / 2}
        fill="rgba(255,255,255,0.25)"
      />
      {/* Solid ring outline */}
      <circle
        ref={circleRef}
        cx={cx}
        cy={cy}
        r={size / 2}
        fill="none"
        stroke="rgba(0,0,0,0.7)"
        strokeWidth="1.5"
      />
    </svg>
  );
}