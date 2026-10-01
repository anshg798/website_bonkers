// LCD Toggle — a Game Boy-style LCD switch: an 8×8 pixel-art character walks between OFF and ON,
// swapping walk frames, with a smiley/frowny face blink on arrival, a matrix texture and scanlines.
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export interface LCDToggleProps {
    /** Uncontrolled initial state. Default false. */
    defaultOn?: boolean;
    /** On (lit pixel) color. Default "#5bff4a". */
    onColor?: string;
    /** Off (dark pixel) color. Default "#0a1a08". */
    offColor?: string;
    /** Fires when toggled. */
    onChange?: (isOn: boolean) => void;
    style?: CSSProperties;
}

const TRACK_WIDTH = 100;
const TRACK_HEIGHT = 48;
const SPRITE_SIZE = 24;
const LEFT_X = 6;
const RIGHT_X = 70;
const CENTER_Y = (TRACK_HEIGHT - SPRITE_SIZE) / 2;
const FACE_VISIBILITY_DISTANCE = 10;
const MOVE_STEP = 3;
const TRAVEL_DISTANCE = RIGHT_X - LEFT_X;
const BAR_Y = CENTER_Y + SPRITE_SIZE + 2;

function colorToRgba(color: string, alpha: number): string {
    const trimmed = color.trim();
    const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (hexMatch) {
        const hex = hexMatch[1];
        const normalized = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
}

const WALK_1 = [[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,1,0,1,1,0,1,0],[1,0,0,0,1,0,0,1],[0,0,0,0,1,0,0,0]];
const WALK_2 = [[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,1,0,1,1,0,1,0],[1,0,0,0,1,0,0,1],[0,0,0,1,0,0,0,0]];
const SMILE = [[0,0,1,1,1,1,0,0],[0,1,0,0,0,0,1,0],[1,0,1,0,0,1,0,1],[1,0,0,0,0,0,0,1],[1,0,1,0,0,1,0,1],[1,0,0,1,1,0,0,1],[0,1,0,0,0,0,1,0],[0,0,1,1,1,1,0,0]];
const FROWN = [[0,0,1,1,1,1,0,0],[0,1,0,0,0,0,1,0],[1,0,1,0,0,1,0,1],[1,0,0,0,0,0,0,1],[1,0,0,1,1,0,0,1],[1,0,1,0,0,1,0,1],[0,1,0,0,0,0,1,0],[0,0,1,1,1,1,0,0]];

export const LCDToggle = (props: LCDToggleProps) => {
    const { defaultOn = false, onColor = "#5bff4a", offColor = "#0a1a08", onChange, style } = props;
    const reduceMotion = usePrefersReducedMotion();
    const [scale, setScale] = useState(1);
    const [isOn, setIsOn] = useState(defaultOn);
    const [characterX, setCharacterX] = useState(defaultOn ? RIGHT_X : LEFT_X);
    const [walkFrame, setWalkFrame] = useState(0);
    const [faceVisible, setFaceVisible] = useState(true);
    const progressRef = useRef(defaultOn ? 1 : 0);
    const targetProgressRef = useRef(defaultOn ? 1 : 0);
    const isAnimatingRef = useRef(false);
    const lastArrivalStateRef = useRef(defaultOn);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const node = containerRef.current;
        if (!node) return;
        const updateScale = () => { const width = node.clientWidth; if (width > 0) setScale(width / TRACK_WIDTH); };
        updateScale();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => updateScale());
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (reduceMotion) return;
        if (typeof window === "undefined") return;

        const frameInterval = window.setInterval(() => {
            if (!isAnimatingRef.current) return;
            setWalkFrame((prev) => (prev === 0 ? 1 : 0));
        }, 120);

        const moveInterval = window.setInterval(() => {
            if (!isAnimatingRef.current) return;
            const targetProgress = targetProgressRef.current;
            const currentProgress = progressRef.current;
            const progressStep = MOVE_STEP / TRAVEL_DISTANCE;
            const delta = targetProgress - currentProgress;
            if (Math.abs(delta) <= progressStep) {
                progressRef.current = targetProgress;
                isAnimatingRef.current = false;
                setCharacterX(LEFT_X + TRAVEL_DISTANCE * targetProgress);
                setWalkFrame(0);
                return;
            }
            const nextProgress = currentProgress + Math.sign(delta) * progressStep;
            progressRef.current = nextProgress;
            setCharacterX(LEFT_X + TRAVEL_DISTANCE * nextProgress);
        }, 16);

        return () => { window.clearInterval(frameInterval); window.clearInterval(moveInterval); };
    }, [reduceMotion]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const targetX = isOn ? RIGHT_X : LEFT_X;
        const hasArrived = !isAnimatingRef.current && Math.abs(characterX - targetX) < 0.5;
        if (!hasArrived || lastArrivalStateRef.current === isOn) return;
        lastArrivalStateRef.current = isOn;
        const timers: number[] = [];
        timers.push(window.setTimeout(() => setFaceVisible(false), 0));
        timers.push(window.setTimeout(() => setFaceVisible(true), 100));
        timers.push(window.setTimeout(() => setFaceVisible(false), 200));
        timers.push(window.setTimeout(() => setFaceVisible(true), 300));
        return () => { timers.forEach((timer) => window.clearTimeout(timer)); };
    }, [characterX, isOn]);

    const handleToggle = useCallback(() => {
        setIsOn((prev) => {
            const next = !prev;
            targetProgressRef.current = next ? 1 : 0;
            isAnimatingRef.current = true;
            onChange?.(next);
            return next;
        });
    }, [onChange]);

    const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleToggle(); }
    }, [handleToggle]);

    const lcdPattern = "radial-gradient(circle at 1px 1px, rgba(70, 110, 62, 0.22) 0.8px, transparent 1.1px)";
    const barOnColor = useMemo(() => colorToRgba(onColor, 0.6), [onColor]);
    const barOffColor = useMemo(() => colorToRgba(offColor, 0.4), [offColor]);
    const walkMatrix = walkFrame === 0 ? WALK_1 : WALK_2;
    const showRightFace = isOn && Math.abs(characterX - RIGHT_X) <= FACE_VISIBILITY_DISTANCE;
    const showLeftFace = !isOn && Math.abs(characterX - LEFT_X) <= FACE_VISIBILITY_DISTANCE;
    const barWidth = isOn ? RIGHT_X + SPRITE_SIZE / 2 - LEFT_X : SPRITE_SIZE / 2;
    const barColor = isOn ? barOnColor : barOffColor;

    const renderSprite = useCallback((matrix: number[][], x: number, y: number, key: string, opacity = 1) => (
        <div key={key} style={{ position: "absolute", left: x, top: y, width: SPRITE_SIZE, height: SPRITE_SIZE, display: "grid", gridTemplateColumns: "repeat(8, 3px)", gridTemplateRows: "repeat(8, 3px)", imageRendering: "pixelated", opacity, transition: "opacity 0.1s linear" }}>
            {matrix.flat().map((pixel, index) => (
                <div key={`${key}-px-${index}`} style={{ width: 3, height: 3, backgroundColor: pixel ? onColor : offColor }} />
            ))}
        </div>
    ), [offColor, onColor]);

    return (
        <div ref={containerRef} style={{ width: "100%", height: TRACK_HEIGHT * scale, position: "relative", overflow: "hidden", boxSizing: "border-box", ...style }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: TRACK_WIDTH, height: TRACK_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <div
                    role="switch"
                    aria-checked={isOn}
                    aria-label="LCD Toggle"
                    tabIndex={0}
                    onClick={handleToggle}
                    onKeyDown={handleKeyDown}
                    style={{ position: "relative", width: TRACK_WIDTH, height: TRACK_HEIGHT, overflow: "hidden", cursor: "pointer", boxSizing: "border-box", border: "1px solid #2a3a20", borderRadius: 8, backgroundColor: "#1a1c14", padding: 2, userSelect: "none" }}
                >
                    <div style={{ position: "absolute", left: 2, top: 2, width: TRACK_WIDTH - 4, height: TRACK_HEIGHT - 4, backgroundColor: isOn ? "#020e00" : "#000", boxShadow: isOn ? "inset 0 0 10px rgba(91, 255, 74, 0.15)" : "inset 0 0 0 rgba(91, 255, 74, 0)", transition: "background-color 0.3s, box-shadow 0.3s", backgroundImage: lcdPattern, backgroundSize: "4px 4px", borderRadius: 6 }} />

                    <div style={{ position: "absolute", left: LEFT_X, top: BAR_Y, width: barWidth, height: 2, borderRadius: 1, backgroundColor: barColor, opacity: isOn ? 1 : 0.8, transition: "width 0.4s ease, opacity 0.3s", pointerEvents: "none" }} />

                    {showLeftFace && renderSprite(FROWN, LEFT_X, CENTER_Y, "left-face", faceVisible ? 1 : 0)}
                    {showRightFace && renderSprite(SMILE, RIGHT_X, CENTER_Y, "right-face", faceVisible ? 1 : 0)}
                    {renderSprite(walkMatrix, reduceMotion ? (isOn ? RIGHT_X : LEFT_X) : characterX, CENTER_Y, "walker")}

                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 8, background: "repeating-linear-gradient(transparent 0px, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 3px)" }} />
                </div>
            </div>
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
