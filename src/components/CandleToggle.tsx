// Candle Toggle — a candle-shaped switch with a layered, flickering flame and glow when lit, a spark
// on ignite, a snuff-out transition, and a rising wisp of smoke when off. Uses SMIL + CSS (no framer-motion).
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";

export interface CandleToggleProps {
    /** Uncontrolled initial lit state. Default true. */
    defaultOn?: boolean;
    /** Controlled lit state. */
    isOn?: boolean;
    /** Fires when toggled. */
    onChange?: (isOn: boolean) => void;
    style?: CSSProperties;
}

export const CandleToggle = (props: CandleToggleProps) => {
    const { defaultOn = true, isOn: isOnProp, onChange, style } = props;

    const uid = useMemo(() => Math.random().toString(36).slice(2), []);
    const reduceMotion = usePrefersReducedMotion();
    const isControlled = isOnProp !== undefined;
    const [internalOn, setInternalOn] = useState(defaultOn);
    const isOn = isControlled ? isOnProp : internalOn;
    const [scale, setScale] = useState(1);
    const [phase, setPhase] = useState<"idle" | "snuffing" | "igniting">("idle");
    const [inView, setInView] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const snuffTimerRef = useRef<number | null>(null);
    const igniteTimerRef = useRef<number | null>(null);

    const shouldAnimate = !reduceMotion && inView;

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
        const io = new IntersectionObserver((entries) => { for (const e of entries) setInView(e.intersectionRatio >= 0.2); }, { threshold: [0, 0.2, 1] });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => () => {
        if (typeof window !== "undefined") {
            if (snuffTimerRef.current !== null) window.clearTimeout(snuffTimerRef.current);
            if (igniteTimerRef.current !== null) window.clearTimeout(igniteTimerRef.current);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const node = containerRef.current;
        if (!node) return;
        const updateScale = () => { const width = node.clientWidth; if (width > 0) setScale(width / 40); };
        updateScale();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => updateScale());
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const handleToggle = useCallback(() => {
        if (phase !== "idle") return;
        if (isOn) {
            setPhase("snuffing");
            if (typeof window !== "undefined") {
                snuffTimerRef.current = window.setTimeout(() => {
                    if (!isControlled) setInternalOn(false);
                    onChange?.(false);
                    setPhase("idle");
                }, 300);
            } else {
                if (!isControlled) setInternalOn(false);
                onChange?.(false);
                setPhase("idle");
            }
            return;
        }
        if (!isControlled) setInternalOn(true);
        onChange?.(true);
        setPhase("igniting");
        if (typeof window !== "undefined") {
            igniteTimerRef.current = window.setTimeout(() => setPhase("idle"), 420);
        } else {
            setPhase("idle");
        }
    }, [isOn, phase, isControlled, onChange]);

    const candleBodyGradient = isOn || phase === "igniting"
        ? "linear-gradient(180deg, #FFF8E9 0%, #F6EAD0 45%, #E8D9BE 100%)"
        : "linear-gradient(180deg, #F4F2ED 0%, #E7E3DA 45%, #D8D4CA 100%)";

    const showFlame = isOn;
    const showSmoke = !isOn;
    const wickTop = 16;
    const flameActive = showFlame || phase === "snuffing" || phase === "igniting";

    const outerD = "M13 2 C8 8, 5 14, 6.6 20.5 C7.8 25.7, 10.5 29.2, 13 30 C15.5 29.2, 18.2 25.7, 19.4 20.5 C21 14, 18 8, 13 2 Z";

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%", height: 80 * scale, overflow: "hidden", boxSizing: "border-box", ...style }}>
            <style>{`
                @keyframes candle-glow-${uid} { 0%,100% { transform: scale(1.04); opacity: 0.72; } 33% { transform: scale(1.12); opacity: 0.95; } 66% { transform: scale(1.02); opacity: 0.8; } }
                @keyframes candle-flame-in-${uid} { 0% { opacity: 0.15; transform: scale(0.15) translateY(5px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes candle-flame-out-${uid} { 0% { opacity: 1; transform: scale(1) rotate(0deg); } 50% { opacity: 1; transform: scale(1.08) rotate(8deg); } 100% { opacity: 0; transform: scale(0.28) rotate(0deg); } }
                @keyframes candle-flame-idle-${uid} { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03) translateY(-0.5px); } }
                @keyframes candle-spark-${uid} { 0% { opacity: 0; transform: scale(0.2); } 40% { opacity: 1; transform: scale(1.3); } 70% { opacity: 0.2; transform: scale(0.85); } 100% { opacity: 0; transform: scale(0); } }
            `}</style>

            <div style={{ position: "absolute", top: 0, left: 0, width: 40, height: 80, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    aria-label={isOn ? "Candle is lit" : "Candle is extinguished"}
                    onClick={handleToggle}
                    style={{ position: "relative", width: 40, height: 80, padding: 0, border: "none", background: "transparent", cursor: "pointer", overflow: "visible", display: "block" }}
                >
                    {flameActive && (
                        <div
                            aria-hidden
                            style={{
                                position: "absolute",
                                left: -8,
                                top: -12,
                                width: 56,
                                height: 56,
                                borderRadius: "50%",
                                background: "radial-gradient(circle, rgba(255,175,68,0.45) 0%, rgba(255,137,27,0.22) 42%, rgba(255,125,25,0) 75%)",
                                pointerEvents: "none",
                                opacity: isOn ? 0.88 : 0,
                                transform: "scale(1)",
                                transition: "opacity 0.35s ease",
                                animation: shouldAnimate && (isOn || phase === "snuffing") ? `candle-glow-${uid} 1.8s ease-in-out infinite` : undefined,
                            }}
                        />
                    )}

                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            left: 5,
                            bottom: 2,
                            width: 30,
                            height: 60,
                            borderRadius: "12px 12px 8px 8px",
                            background: candleBodyGradient,
                            boxShadow: isOn
                                ? "inset -4px 0 8px rgba(176,138,84,0.22), inset 4px 0 10px rgba(255,255,255,0.52), 0 2px 4px rgba(0,0,0,0.15)"
                                : "inset -4px 0 8px rgba(130,130,130,0.2), inset 4px 0 9px rgba(255,255,255,0.38), 0 2px 4px rgba(0,0,0,0.12)",
                            transition: "box-shadow 240ms ease, background 240ms ease",
                        }}
                    >
                        <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.14) 25%, rgba(255,255,255,0.04) 40%, rgba(0,0,0,0.03) 60%, rgba(255,255,255,0.08) 75%, rgba(255,255,255,0) 100%)", opacity: 0.85, pointerEvents: "none" }} />
                        <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 22, borderRadius: "inherit", background: "radial-gradient(circle at 50% 0%, rgba(255,178,78,0.45) 0%, rgba(255,149,66,0.16) 38%, rgba(255,135,50,0) 70%)", opacity: isOn ? 1 : 0, transition: "opacity 0.3s ease" }} />
                    </div>

                    <div aria-hidden style={{ position: "absolute", left: 18, top: wickTop, width: 4, height: 6, borderRadius: 2, background: "#1B1A18", boxShadow: "0 0 1px rgba(0,0,0,0.45)" }} />

                    {flameActive && (
                        <svg
                            width="26"
                            height="34"
                            viewBox="0 0 26 34"
                            aria-hidden
                            style={{
                                position: "absolute",
                                left: 7,
                                top: -7,
                                overflow: "visible",
                                transformOrigin: "50% 82%",
                                pointerEvents: "none",
                                animation: phase === "snuffing"
                                    ? `candle-flame-out-${uid} 0.3s ease-out forwards`
                                    : phase === "igniting"
                                        ? `candle-flame-in-${uid} 0.4s ease-out both`
                                        : shouldAnimate ? `candle-flame-idle-${uid} 1.15s ease-in-out infinite` : undefined,
                            }}
                        >
                            <defs>
                                <linearGradient id={`candle-outer-${uid}`} x1="13" y1="2" x2="13" y2="30">
                                    <stop offset="0%" stopColor="#FFF8CD" />
                                    <stop offset="44%" stopColor="#FFAD3D" />
                                    <stop offset="100%" stopColor="#FF6A00" />
                                </linearGradient>
                                <linearGradient id={`candle-inner-${uid}`} x1="13" y1="5" x2="13" y2="27">
                                    <stop offset="0%" stopColor="#FFFFEE" />
                                    <stop offset="55%" stopColor="#FFD57A" />
                                    <stop offset="100%" stopColor="#FF8C00" />
                                </linearGradient>
                            </defs>

                            <path d={outerD} fill={`url(#candle-outer-${uid})`}>
                                {shouldAnimate && phase !== "snuffing" && (
                                    <animate
                                        attributeName="d"
                                        dur="1.15s"
                                        repeatCount="indefinite"
                                        values={[
                                            outerD,
                                            "M13 2 C9.4 7.6, 6 13.5, 7.1 20 C8.1 25.4, 10.2 28.6, 13 30 C15.8 28.8, 18.2 25.3, 19 19.8 C19.9 13.8, 16.5 8.3, 13 2 Z",
                                            "M13 2 C7.8 8.3, 4.8 14.8, 6.9 21.2 C8.3 25.9, 10.8 29.1, 13 30 C15.2 29.1, 17.9 26.1, 19.1 21.1 C20.6 14.6, 18.3 8.6, 13 2 Z",
                                            outerD,
                                        ].join(";")}
                                        calcMode="spline"
                                        keyTimes="0;0.33;0.66;1"
                                        keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                                    />
                                )}
                            </path>
                            <path d="M13 6 C10 11, 8.8 15.8, 9.5 20 C10.2 23.6, 11.5 25.8, 13 26.8 C14.5 25.8, 15.8 23.6, 16.5 20 C17.2 15.8, 16 11, 13 6 Z" fill={`url(#candle-inner-${uid})`}>
                                {shouldAnimate && (
                                    <animate attributeName="opacity" dur="0.88s" repeatCount="indefinite" values="0.95;0.88;1;0.9;0.96" />
                                )}
                            </path>
                            <ellipse cx="13" cy="22.5" rx="3.2" ry="2.8" fill="rgba(255,110,0,0.9)">
                                {shouldAnimate && (
                                    <>
                                        <animate attributeName="rx" dur="0.72s" repeatCount="indefinite" values="3;3.6;3" />
                                        <animate attributeName="ry" dur="0.72s" repeatCount="indefinite" values="2.3;3.1;2.4" />
                                        <animate attributeName="opacity" dur="0.72s" repeatCount="indefinite" values="0.8;0.95;0.8" />
                                    </>
                                )}
                            </ellipse>
                        </svg>
                    )}

                    {phase === "igniting" && (
                        <div aria-hidden style={{ position: "absolute", left: 15, top: 12, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,245,1) 0%, rgba(255,198,102,0.95) 42%, rgba(255,160,47,0) 72%)", pointerEvents: "none", animation: `candle-spark-${uid} 0.35s ease-out both` }} />
                    )}

                    {showSmoke && (
                        <svg width="24" height="30" viewBox="0 0 24 30" aria-hidden style={{ position: "absolute", left: 8, top: -8, overflow: "visible", pointerEvents: "none" }}>
                            <path d="M12 24 C11 20, 14 18, 13 14 C12 10, 9.5 9, 10 6 C10.5 3.5, 13 2.5, 12.4 1" fill="none" stroke="rgba(130,130,130,0.45)" strokeWidth="1.25" strokeLinecap="round">
                                {shouldAnimate && (
                                    <>
                                        <animate attributeName="d" dur="2.4s" repeatCount="indefinite" values={[
                                            "M12 24 C11 20, 14 18, 13 14 C12 10, 9.5 9, 10 6 C10.5 3.5, 13 2.5, 12.4 1",
                                            "M12 24 C12.5 20.5, 15 18.5, 14 14.2 C13 10.8, 10 9.8, 10.5 6.4 C11 3.6, 13.8 2.4, 13.2 1",
                                            "M12 24 C10.6 20.2, 12.6 18.1, 11.8 14 C11 10.3, 8.8 8.8, 9.5 6 C10.1 3.8, 12.8 2.7, 12.2 1",
                                        ].join(";")} />
                                        <animate attributeName="opacity" dur="2.4s" repeatCount="indefinite" values="0.55;0.38;0.2;0" />
                                    </>
                                )}
                            </path>
                        </svg>
                    )}
                </button>
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
