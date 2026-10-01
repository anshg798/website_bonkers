// Morphing Mandala — a radially symmetric canvas loader: multiple rings of petals morph their
// counts, rotate at different speeds, and cycle through a jewel-tone palette around an ornate center.
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";

export interface MorphingMandalaProps {
    /** Animation speed multiplier. Default 1. */
    speed?: number;
    style?: CSSProperties;
}

interface RGBColor {
    r: number;
    g: number;
    b: number;
}

function hexToRgb(hex: string): RGBColor {
    const value = hex.replace("#", "");
    const normalized = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
    const int = Number.parseInt(normalized, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function mixColor(a: RGBColor, b: RGBColor, t: number): RGBColor {
    return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t),
    };
}

function toRgba(color: RGBColor, alpha: number): string {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

export const MorphingMandala = (props: MorphingMandalaProps) => {
    const { speed = 1, style } = props;
    const reduceMotion = usePrefersReducedMotion();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const frameRef = useRef<number>(0);
    const [containerSize, setContainerSize] = useState({ width: 80, height: 80 });

    const jewelPalette = useMemo(
        () => ["#1E6FDB", "#C4183C", "#10855C", "#D4A017"].map(hexToRgb),
        []
    );

    const getCycledColor = useCallback(
        (time: number, offset: number): RGBColor => {
            const cycle = (time * 0.15 + offset) % jewelPalette.length;
            const i0 = Math.floor(cycle);
            const i1 = (i0 + 1) % jewelPalette.length;
            const blend = cycle - i0;
            return mixColor(jewelPalette[i0], jewelPalette[i1], blend);
        },
        [jewelPalette]
    );

    const drawPetalSet = useCallback(
        (
            ctx: CanvasRenderingContext2D,
            centerX: number,
            centerY: number,
            count: number,
            rotation: number,
            innerRadius: number,
            outerRadius: number,
            lineWidth: number,
            color: RGBColor,
            alpha: number
        ) => {
            const step = (Math.PI * 2) / count;
            const halfWidth = step * 0.42;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(rotation);
            ctx.lineWidth = lineWidth;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            for (let i = 0; i < count; i++) {
                const a = i * step;
                const leftBaseX = Math.cos(a - halfWidth) * innerRadius;
                const leftBaseY = Math.sin(a - halfWidth) * innerRadius;
                const rightBaseX = Math.cos(a + halfWidth) * innerRadius;
                const rightBaseY = Math.sin(a + halfWidth) * innerRadius;
                const tipX = Math.cos(a) * outerRadius;
                const tipY = Math.sin(a) * outerRadius;

                const c1x = Math.cos(a - halfWidth * 0.55) * (innerRadius + (outerRadius - innerRadius) * 0.72);
                const c1y = Math.sin(a - halfWidth * 0.55) * (innerRadius + (outerRadius - innerRadius) * 0.72);
                const c2x = Math.cos(a + halfWidth * 0.55) * (innerRadius + (outerRadius - innerRadius) * 0.72);
                const c2y = Math.sin(a + halfWidth * 0.55) * (innerRadius + (outerRadius - innerRadius) * 0.72);

                ctx.beginPath();
                ctx.moveTo(leftBaseX, leftBaseY);
                ctx.bezierCurveTo(c1x, c1y, c1x, c1y, tipX, tipY);
                ctx.bezierCurveTo(c2x, c2y, c2x, c2y, rightBaseX, rightBaseY);
                ctx.closePath();

                ctx.strokeStyle = toRgba(color, alpha);
                ctx.stroke();
                ctx.fillStyle = toRgba(color, alpha * 0.15);
                ctx.fill();
            }

            ctx.lineWidth = Math.max(0.5, lineWidth * 0.55);
            for (let i = 0; i < count; i++) {
                const a = i * step;
                const x1 = Math.cos(a) * (innerRadius - 1);
                const y1 = Math.sin(a) * (innerRadius - 1);
                const x2 = Math.cos(a) * (outerRadius + 1);
                const y2 = Math.sin(a) * (outerRadius + 1);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = toRgba(color, alpha * 0.5);
                ctx.stroke();
            }

            ctx.restore();
        },
        []
    );

    useEffect(() => {
        if (typeof window === "undefined") return;
        const element = containerRef.current;
        if (!element) return;
        const updateSize = () => {
            setContainerSize({
                width: Math.max(1, element.offsetWidth || 80),
                height: Math.max(1, element.offsetHeight || 80),
            });
        };
        updateSize();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(updateSize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const width = Math.max(1, containerSize.width);
        const height = Math.max(1, containerSize.height);
        const scale = Math.min(width / 80, height / 80);
        const offsetX = (width - 80 * scale) / 2;
        const offsetY = (height - 80 * scale) / 2;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const centerX = 40;
        const centerY = 40;

        const ringConfigs = [
            { inner: 6, outer: 14, speed: 0.25, morphA: 4, morphB: 8, phase: 0.0, width: 1.2 },
            { inner: 13, outer: 22, speed: 0.5, morphA: 5, morphB: 10, phase: 0.9, width: 1.0 },
            { inner: 21, outer: 31, speed: 0.85, morphA: 6, morphB: 12, phase: 1.8, width: 0.95 },
            { inner: 30, outer: 38, speed: 1.2, morphA: 8, morphB: 10, phase: 2.7, width: 0.85 },
        ];

        const drawFrame = (nowMs: number) => {
            const t = (nowMs / 1000) * speed;
            context.clearRect(0, 0, width, height);
            context.save();
            context.translate(offsetX, offsetY);
            context.scale(scale, scale);

            for (let i = 0; i < ringConfigs.length; i++) {
                const ring = ringConfigs[i];
                const rotation = t * ring.speed + ring.phase;
                const morphNorm = 0.5 + 0.5 * Math.sin(t * 0.9 + ring.phase);
                const blendCount = ring.morphA + (ring.morphB - ring.morphA) * morphNorm;
                const lowCount = Math.floor(blendCount);
                const highCount = Math.ceil(blendCount);
                const countBlend = blendCount - lowCount;
                const pulse = 0.28 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.35 + ring.phase * 1.7));
                const color = getCycledColor(t, i * 0.55);

                if (lowCount > 0) {
                    drawPetalSet(context, centerX, centerY, lowCount, rotation, ring.inner, ring.outer, ring.width, color, pulse * (1 - countBlend));
                }
                if (highCount !== lowCount && highCount > 0) {
                    drawPetalSet(context, centerX, centerY, highCount, rotation + 0.06, ring.inner, ring.outer, ring.width, color, pulse * countBlend);
                }
            }

            const centerColor = getCycledColor(t, 1.1);
            context.beginPath();
            context.arc(centerX, centerY, 3.2, 0, Math.PI * 2);
            context.fillStyle = toRgba(centerColor, 0.5);
            context.fill();

            context.beginPath();
            context.arc(centerX, centerY, 5.2, 0, Math.PI * 2);
            context.strokeStyle = toRgba(centerColor, 0.85);
            context.lineWidth = 0.9;
            context.stroke();

            for (let i = 0; i < 8; i++) {
                const a = i * ((Math.PI * 2) / 8) + t * 0.35;
                const x = centerX + Math.cos(a) * 6.5;
                const y = centerY + Math.sin(a) * 6.5;
                context.beginPath();
                context.arc(x, y, 0.7, 0, Math.PI * 2);
                context.fillStyle = toRgba(centerColor, 0.6);
                context.fill();
            }
            context.restore();

            if (!reduceMotion && typeof window !== "undefined") {
                frameRef.current = window.requestAnimationFrame(drawFrame);
            }
        };

        if (typeof window !== "undefined") {
            if (reduceMotion) drawFrame(0);
            else frameRef.current = window.requestAnimationFrame(drawFrame);
        }

        return () => {
            if (typeof window !== "undefined") window.cancelAnimationFrame(frameRef.current);
        };
    }, [containerSize.height, containerSize.width, drawPetalSet, getCycledColor, speed, reduceMotion]);

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                boxSizing: "border-box",
                ...style,
            }}
        >
            <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
        </div>
    );
};

// ---------------------------------------------------------------------------
function usePrefersReducedMotion(): boolean {
    const [reduce, setReduce] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduce(mq.matches);
        const onChange = () => setReduce(mq.matches);
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, []);
    return reduce;
}
