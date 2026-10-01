// Smash Button — destructive-action button with cursor-origin crack spread on hover,
// irregular shard shatter on click, and dust-like reassembly.
// Responsive via container-width ResizeObserver breakpoints (preserved from original).
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";

/** Font styling for the label. */
export interface FontConfig {
    fontSize?: number | string;
    fontWeight?: number | string;
    letterSpacing?: string;
    lineHeight?: string;
    fontFamily?: string;
    fontStyle?: string;
    textAlign?: CSSProperties["textAlign"];
}

export interface SmashButtonProps {
    /** Label. Default "DELETE". */
    label?: string;
    /** Surface color. Default "#0A0A0A". */
    surfaceColor?: string;
    /** Crack / accent color. Default "#FF1744". */
    crackColor?: string;
    /** Text color. Default "#FFFFFF". */
    textColor?: string;
    /** Corner radius in px. Default 10. */
    cornerRadius?: number;
    /** Number of shards (16–80). Default 36. */
    shardCount?: number;
    /** Shatter duration in ms. Default 900. */
    shatterDuration?: number;
    /** Reassemble delay in ms. Default 700. */
    reassembleDelay?: number;
    /** Label font config. */
    font?: FontConfig;
    /** Design height in px. Default 52. */
    height?: number;
    /** Disable interaction. Default false. */
    disabled?: boolean;
    /** Click handler (fires with the shatter). */
    onClick?: () => void;
    style?: CSSProperties;
}

interface Point {
    x: number;
    y: number;
}
interface CrackPath {
    id: number;
    d: string;
}
interface Shard {
    id: number;
    points: Point[];
    velocityX: number;
    velocityY: number;
    rotateStart: number;
    rotateDelta: number;
    blur: number;
    driftX: number;
    driftY: number;
}

const DEFAULT_FONT: FontConfig = {
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    lineHeight: "1em",
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function toRgba(hex: string, alpha: number) {
    const clean = hex.replace("#", "");
    const normalized =
        clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const n = Number.parseInt(normalized, 16);
    if (Number.isNaN(n)) return `rgba(255, 23, 68, ${alpha})`;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function buildCrackNetwork(origin: Point, width: number, height: number, seed: number): CrackPath[] {
    const paths: CrackPath[] = [];
    const mainBranches = 7 + Math.floor(seed % 4);
    let id = 0;
    for (let i = 0; i < mainBranches; i++) {
        const baseAngle = (Math.PI * 2 * i) / mainBranches + rand(-0.35, 0.35);
        const segments = 4 + Math.floor(rand(3, 7));
        let x = origin.x;
        let y = origin.y;
        let d = `M ${x.toFixed(2)} ${y.toFixed(2)}`;
        let angle = baseAngle;
        const stepBase = Math.min(width, height) * 0.08;
        for (let s = 0; s < segments; s++) {
            angle += rand(-0.35, 0.35);
            const step = stepBase * rand(0.7, 1.45);
            x = clamp(x + Math.cos(angle) * step, 0, width);
            y = clamp(y + Math.sin(angle) * step, 0, height);
            d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
            if (Math.random() > 0.68) {
                const branchAngle = angle + rand(-1, 1);
                const branchLen = step * rand(0.4, 0.95);
                const bx = clamp(x + Math.cos(branchAngle) * branchLen, 0, width);
                const by = clamp(y + Math.sin(branchAngle) * branchLen, 0, height);
                paths.push({ id: id++, d: `M ${x.toFixed(2)} ${y.toFixed(2)} L ${bx.toFixed(2)} ${by.toFixed(2)}` });
            }
        }
        paths.push({ id: id++, d });
    }
    return paths;
}

function createIrregularShard(cx: number, cy: number, radius: number): Point[] {
    const corners = 3 + Math.floor(rand(0, 3));
    const points: Point[] = [];
    const start = rand(0, Math.PI * 2);
    for (let i = 0; i < corners; i++) {
        const t = start + (Math.PI * 2 * i) / corners + rand(-0.35, 0.35);
        const r = radius * rand(0.55, 1.15);
        points.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }
    return points;
}

function pointsToPath(points: Point[]): string {
    if (points.length === 0) return "";
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
    return d + " Z";
}

export const SmashButton = (props: SmashButtonProps) => {
    const {
        label = "DELETE",
        surfaceColor = "#0A0A0A",
        crackColor = "#FF1744",
        textColor = "#FFFFFF",
        cornerRadius = 10,
        shardCount = 36,
        shatterDuration = 900,
        reassembleDelay = 700,
        font,
        height: baseHeight = 52,
        disabled = false,
        onClick,
        style,
    } = props;

    const f = { ...DEFAULT_FONT, ...font };
    const uid = useMemo(() => Math.random().toString(36).slice(2), []);
    const reduceMotion = usePrefersReducedMotion();

    const containerRef = useRef<HTMLButtonElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    const [containerWidth, setContainerWidth] = useState(600);

    const [isHovered, setIsHovered] = useState(false);
    const [cracks, setCracks] = useState<CrackPath[]>([]);
    const [crackSeed, setCrackSeed] = useState(0);
    const [origin, setOrigin] = useState<Point>({ x: 90, y: 26 });
    const [isShattering, setIsShattering] = useState(false);
    const [shards, setShards] = useState<Shard[]>([]);
    const [reducedPulse, setReducedPulse] = useState(false);
    const [vbW, setVbW] = useState(180);
    const [vbH, setVbH] = useState(52);
    const crackMoveTickRef = useRef(0);
    const timersRef = useRef<number[]>([]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof IntersectionObserver === "undefined") {
            setInView(true);
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) setInView(e.intersectionRatio >= 0.25);
            },
            { threshold: [0, 0.25, 1] }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const node = wrapperRef.current;
        if (!node) return;
        const updateWidth = () => {
            const nextWidth = node.getBoundingClientRect().width;
            if (nextWidth > 0) setContainerWidth(nextWidth);
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect && rect.width > 0) {
                setVbW(rect.width);
                setVbH(rect.height);
            }
        };
        updateWidth();
        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => updateWidth());
            observer.observe(node);
            return () => observer.disconnect();
        }
    }, []);

    const responsive = useMemo(() => {
        if (containerWidth >= 600)
            return { dimensionScale: 1, fontScale: 1, paddingScale: 1 };
        if (containerWidth >= 360)
            return { dimensionScale: 0.8, fontScale: 0.85, paddingScale: 0.75 };
        return { dimensionScale: 0.65, fontScale: 0.75, paddingScale: 0.6 };
    }, [containerWidth]);

    const scaledFontSize = useMemo(() => {
        if (typeof f.fontSize === "number") return f.fontSize * responsive.fontScale;
        if (typeof f.fontSize === "string" && f.fontSize.includes("px")) {
            const px = parseFloat(f.fontSize);
            if (!Number.isNaN(px)) return `${px * responsive.fontScale}px`;
        }
        return f.fontSize;
    }, [f.fontSize, responsive.fontScale]);

    const canAnimate = inView && !reduceMotion;

    const updateCracksFromPoint = useCallback(
        (point: Point) => {
            const node = containerRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            const paths = buildCrackNetwork(point, rect.width, rect.height, crackSeed);
            setOrigin(point);
            setCracks(paths);
            setCrackSeed((prev) => prev + 1);
        },
        [crackSeed]
    );

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLButtonElement>) => {
            if (!canAnimate || isShattering) return;
            const node = containerRef.current;
            if (!node) return;
            const now = Date.now();
            if (now - crackMoveTickRef.current < 70) return;
            crackMoveTickRef.current = now;
            const rect = node.getBoundingClientRect();
            updateCracksFromPoint({
                x: clamp(event.clientX - rect.left, 0, rect.width),
                y: clamp(event.clientY - rect.top, 0, rect.height),
            });
        },
        [canAnimate, isShattering, updateCracksFromPoint]
    );

    const handlePointerEnter = useCallback(
        (event: React.PointerEvent<HTMLButtonElement>) => {
            if (!canAnimate || isShattering) return;
            const node = containerRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            setIsHovered(true);
            updateCracksFromPoint({
                x: clamp(event.clientX - rect.left, 0, rect.width),
                y: clamp(event.clientY - rect.top, 0, rect.height),
            });
        },
        [canAnimate, isShattering, updateCracksFromPoint]
    );

    const handlePointerLeave = useCallback(() => {
        setIsHovered(false);
        setCracks([]);
    }, []);

    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            if (disabled || isShattering) return;
            onClick?.();
            if (reduceMotion) {
                setReducedPulse(true);
                const t = window.setTimeout(() => setReducedPulse(false), 180);
                timersRef.current.push(t);
                return;
            }
            const node = containerRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            const clickPoint = {
                x: clamp(event.clientX - rect.left, 0, rect.width),
                y: clamp(event.clientY - rect.top, 0, rect.height),
            };
            const count = clamp(Math.round(shardCount), 16, 80);
            const output: Shard[] = [];
            for (let i = 0; i < count; i++) {
                const cx = rand(6, rect.width - 6);
                const cy = rand(6, rect.height - 6);
                const points = createIrregularShard(cx, cy, rand(4, 11));
                const dx = cx - clickPoint.x;
                const dy = cy - clickPoint.y;
                const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
                const impulse = rand(90, 250) + dist * 2.2;
                output.push({
                    id: i,
                    points,
                    velocityX: (dx / dist) * impulse + rand(-40, 40) * 0.25,
                    velocityY: (dy / dist) * impulse - rand(35, 90),
                    rotateStart: rand(-16, 16),
                    rotateDelta: rand(-260, 260),
                    blur: rand(0.6, 2),
                    driftX: rand(-22, 22),
                    driftY: rand(16, 38),
                });
            }
            setShards(output);
            setIsShattering(true);
            setIsHovered(false);
            setCracks([]);
            const resetAt = shatterDuration + reassembleDelay + 380;
            const t = window.setTimeout(() => {
                setIsShattering(false);
                setShards([]);
            }, resetAt);
            timersRef.current.push(t);
        },
        [disabled, isShattering, reduceMotion, onClick, shardCount, shatterDuration, reassembleDelay]
    );

    useEffect(
        () => () => {
            timersRef.current.forEach((id) => {
                if (typeof window !== "undefined") window.clearTimeout(id);
            });
        },
        []
    );

    const crackGlow = toRgba(crackColor, 0.8);
    const crackSoftGlow = toRgba(crackColor, 0.35);
    const clipId = `smash-clip-${uid}`;
    const shatterSecs = (shatterDuration + reassembleDelay) / 1000;
    const ds = responsive.dimensionScale;

    return (
        <div ref={wrapperRef} style={{ position: "relative", display: "block", width: "100%", maxWidth: "100%", boxSizing: "border-box", height: baseHeight * ds, ...style }}>
            <style>{`
                @keyframes smb-pulse-${uid} {
                    0%,100% { opacity: 1; transform: scale(1); }
                    50%     { opacity: 0.88; transform: scale(0.98); }
                }
                @keyframes smb-label-${uid} {
                    0% { opacity: 1; } 25% { opacity: 0.15; } 40% { opacity: 0; } 82% { opacity: 0.9; } 100% { opacity: 1; }
                }
            `}</style>

            <button
                ref={containerRef}
                type="button"
                aria-label={label}
                disabled={disabled}
                onPointerEnter={handlePointerEnter}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                onClick={handleClick}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    borderRadius: cornerRadius * ds,
                    border: `1px solid ${toRgba(crackColor, 0.3)}`,
                    color: textColor,
                    cursor: disabled ? "default" : "pointer",
                    overflow: "hidden",
                    background: "linear-gradient(180deg, rgba(18,18,18,0.65) 0%, rgba(5,5,5,1) 100%)",
                    backgroundColor: surfaceColor,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -10px 22px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.5)",
                    outline: "none",
                    opacity: disabled ? 0.6 : 1,
                    padding: `${10 * responsive.paddingScale}px ${14 * responsive.paddingScale}px`,
                    fontFamily: f.fontFamily,
                    fontSize: scaledFontSize,
                    fontWeight: f.fontWeight,
                    lineHeight: f.lineHeight,
                    letterSpacing: f.letterSpacing,
                    fontStyle: f.fontStyle,
                    textAlign: f.textAlign,
                    animation: reducedPulse ? `smb-pulse-${uid} 0.2s ease-out` : undefined,
                }}
            >
                <span
                    style={{
                        position: "relative",
                        zIndex: 5,
                        color: textColor,
                        userSelect: "none",
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                        animation:
                            isShattering && !reduceMotion
                                ? `smb-label-${uid} ${shatterSecs}s ease-in-out`
                                : undefined,
                    }}
                >
                    {label}
                </span>

                {canAnimate && (
                    <svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${vbW} ${vbH}`}
                        style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}
                    >
                        <defs>
                            <clipPath id={clipId}>
                                <rect x="0" y="0" width="100%" height="100%" rx={cornerRadius * ds} ry={cornerRadius * ds} />
                            </clipPath>
                        </defs>
                        <g clipPath={`url(#${clipId})`}>
                            {isHovered &&
                                cracks.map((crack) => (
                                    <path
                                        key={crack.id}
                                        d={crack.d}
                                        fill="none"
                                        stroke={crackColor}
                                        strokeWidth={1}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        pathLength={1}
                                        style={{
                                            filter: `drop-shadow(0 0 1px ${crackGlow}) drop-shadow(0 0 6px ${crackSoftGlow})`,
                                            strokeDasharray: 1,
                                            strokeDashoffset: 0,
                                            animation: `smb-draw-${uid} 0.24s ease-out`,
                                        }}
                                    />
                                ))}
                            {isHovered && (
                                <circle
                                    cx={origin.x}
                                    cy={origin.y}
                                    r={2}
                                    fill={crackColor}
                                    style={{ filter: `drop-shadow(0 0 6px ${crackGlow})` }}
                                />
                            )}
                        </g>
                        <style>{`@keyframes smb-draw-${uid} { from { stroke-dashoffset: 1; opacity: 0.15; } to { stroke-dashoffset: 0; opacity: 1; } }`}</style>
                    </svg>
                )}

                {canAnimate && isShattering && (
                    <svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${vbW} ${vbH}`}
                        style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none", overflow: "visible" }}
                    >
                        <g clipPath={`url(#${clipId})`}>
                            {shards.map((shard) => {
                                const kf = `smb-shard-${uid}-${shard.id}`;
                                const midX = shard.velocityX * 0.55;
                                const midY = shard.velocityY * 0.45;
                                const outX = shard.velocityX + shard.driftX + shard.velocityX * 0.12;
                                const outY = shard.velocityY + Math.abs(shard.velocityY) * 0.8 + shard.driftY;
                                return (
                                    <path
                                        key={shard.id}
                                        d={pointsToPath(shard.points)}
                                        fill={surfaceColor}
                                        stroke={toRgba(crackColor, 0.42)}
                                        strokeWidth={0.7}
                                        style={{ animation: `${kf} ${shatterSecs}s cubic-bezier(0.22,0.74,0.18,1) forwards` }}
                                    >
                                        <style>{`
                                            @keyframes ${kf} {
                                                0%   { transform: translate(0,0) rotate(${shard.rotateStart}deg) scale(1); opacity: 1; filter: blur(0px); }
                                                34%  { transform: translate(${midX}px,${midY}px) rotate(${shard.rotateStart + shard.rotateDelta * 0.65}deg) scale(0.9); opacity: 0.92; filter: blur(${(shard.blur * 0.6).toFixed(2)}px); }
                                                58%  { transform: translate(${outX}px,${outY}px) rotate(${shard.rotateStart + shard.rotateDelta}deg) scale(0.45); opacity: 0; filter: blur(${shard.blur.toFixed(2)}px); }
                                                82%  { opacity: 0.88; }
                                                100% { transform: translate(0,0) rotate(${shard.rotateStart}deg) scale(1); opacity: 1; filter: blur(0px); }
                                            }
                                        `}</style>
                                    </path>
                                );
                            })}
                        </g>
                    </svg>
                )}
            </button>
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
