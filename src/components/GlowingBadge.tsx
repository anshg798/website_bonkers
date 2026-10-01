// Glowing Badge — luxury badge/display text with an animated gradient border, a shimmer
// sweep across the label, a soft glow, and a pulse on hover.
// Font scales fluidly with clamp() + container queries (preserved from original).
import {
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
} from "react";

export interface GlowingBadgeProps {
    /** Badge label. Default "Luxury". */
    label?: string;
    /** CSS gradient for the border. Default a gold→coral gradient. */
    gradient?: string;
    /** Inner background color. Default "#181818". */
    background?: string;
    /** Text color. Default "#fff". */
    textColor?: string;
    /** Glow/shadow color. Default "#FF4E50". */
    shadowColor?: string;
    /** Shimmer sweep color. Default "#fffbe6". */
    shimmerColor?: string;
    style?: CSSProperties;
}

export const GlowingBadge = (props: GlowingBadgeProps) => {
    const {
        label = "Luxury",
        gradient = "linear-gradient(90deg, #F9D423, #FF4E50)",
        background = "#181818",
        textColor = "#fff",
        shadowColor = "#FF4E50",
        shimmerColor = "#fffbe6",
        style,
    } = props;

    const uid = useMemo(() => Math.random().toString(36).slice(2), []);
    const reduceMotion = usePrefersReducedMotion();
    const [hovered, setHovered] = useState(false);
    const borderRadius = 16;

    const scale = hovered ? 1.06 : 1;
    const gradientParts = gradient.split(",");

    return (
        <div
            role="status"
            aria-label={label}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: "relative",
                display: "flex",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                borderRadius,
                padding: 2,
                background: gradient,
                boxShadow: `0 2px 24px 0 ${shadowColor}`,
                transition: "transform 0.22s cubic-bezier(.4,1.6,.4,1)",
                transform: `scale(${scale})`,
                cursor: "default",
                alignItems: "center",
                justifyContent: "center",
                ["containerType" as string]: "inline-size",
                overflow: "visible",
                ...style,
            }}
        >
            <style>{`
                @keyframes gb-shimmer-${uid} {
                    0%   { background-position: -120% 0; }
                    100% { background-position: 120% 0; }
                }
            `}</style>

            <div
                style={{
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    borderRadius: 14,
                    background,
                    padding: "1em",
                    color: textColor,
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 1px 4px 0 ${shadowColor}33`,
                    overflow: "visible",
                }}
            >
                <span
                    style={{
                        position: "relative",
                        zIndex: 2,
                        background: `linear-gradient(90deg, transparent 0%, ${shimmerColor} 50%, transparent 100%)`,
                        backgroundSize: "200% 100%",
                        backgroundRepeat: "no-repeat",
                        WebkitBackgroundClip: reduceMotion || hovered ? undefined : "text",
                        WebkitTextFillColor: reduceMotion || hovered ? textColor : "transparent",
                        animation: reduceMotion || hovered ? undefined : `gb-shimmer-${uid} 2.2s linear infinite`,
                        display: "inline-block",
                        fontSize: "clamp(1rem, 15cqi, 3.5rem)",
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        lineHeight: 1.2,
                        color: textColor,
                    }}
                >
                    {label}
                </span>
            </div>

            <div
                aria-hidden="true"
                style={{
                    pointerEvents: "none",
                    position: "absolute",
                    inset: 0,
                    borderRadius,
                    zIndex: 1,
                    boxShadow: `0 0 16px 4px ${gradientParts[0]}44, 0 0 32px 8px ${gradientParts[1] || gradientParts[0]}22`,
                    opacity: 0.7,
                }}
            />
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
