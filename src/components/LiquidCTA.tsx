import {
    type CSSProperties,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

/** Direction the liquid fills the button on hover. */
export type LiquidFillDirection = "up" | "down" | "left" | "right"

/** Local font-config shape (replaces the Framer `Font` control). */
export interface LiquidCTAFontConfig {
    fontSize?: string | number
    lineHeight?: string | number
    letterSpacing?: string | number
    textAlign?: "left" | "center" | "right"
    fontWeight?: number
    fontStyle?: "normal" | "italic"
    fontFamily?: string
}

export interface LiquidCTAProps {
    /** Section headline (a decorative accent dot is appended). */
    headline?: string
    /** Supporting sub-text. */
    subtext?: string
    /** Button label. */
    ctaLabel?: string
    /** Primary liquid color. */
    liquidColor?: string
    /** Direction the liquid fills on hover. */
    fillDirection?: LiquidFillDirection
    /** Show rising bubbles (vertical fills only). */
    bubbles?: boolean
    /** Add a damped slosh wobble on hover. */
    sloshOnHover?: boolean
    /** Emit droplet burst on click. */
    burstOnClick?: boolean
    /** Render the button with a frosted glass outline. */
    glassOutline?: boolean
    /** Accent color (gradient bottom, glow, droplets). */
    accentColor?: string
    /** Section background. */
    sectionBackground?: string
    /** Headline text color. */
    headlineColor?: string
    /** Sub-text color. */
    subtextColor?: string
    /** Button label color when the fill is low. */
    buttonTextRestColor?: string
    /** Button label color once the fill passes ~82%. */
    buttonTextFilledColor?: string
    /** Max content width (px). */
    sectionMaxWidth?: number
    /** Section padding (desktop); phone/tablet override internally. */
    sectionPadding?: string
    /** Button width (px) at desktop; scales down on smaller containers. */
    buttonWidth?: number
    /** Button height (px) at desktop; scales down on smaller containers. */
    buttonHeight?: number
    /** Button border radius. */
    buttonRadius?: string | number
    /** Headline font config. */
    headlineFont?: LiquidCTAFontConfig
    /** Sub-text font config. */
    subtextFont?: LiquidCTAFontConfig
    /** Button font config. */
    buttonFont?: LiquidCTAFontConfig
    /** Called when the button is activated (click / Enter / Space). */
    onClick?: () => void
    /** Disable the button (no hover fill, no burst, no activation). */
    disabled?: boolean
    style?: CSSProperties
    className?: string
}

const DEFAULT_HEADLINE_FONT: LiquidCTAFontConfig = {
    fontSize: "clamp(32px, 9cqw, 48px)",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: "1em",
    textAlign: "center",
}
const DEFAULT_SUBTEXT_FONT: LiquidCTAFontConfig = {
    fontSize: "clamp(15px, 3.4cqw, 17px)",
    fontWeight: 500,
    letterSpacing: "-0.01em",
    lineHeight: "1.4em",
    textAlign: "center",
}
const DEFAULT_BUTTON_FONT: LiquidCTAFontConfig = {
    fontSize: "clamp(16px, 3.6cqw, 18px)",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    lineHeight: "1em",
    textAlign: "center",
}

/**
 * LiquidCTA — a CTA section whose button fills with animated liquid on hover:
 * a wave meniscus, rising bubbles, a damped slosh wobble and a click droplet
 * burst, all driven by a single requestAnimationFrame loop. Reduced motion
 * collapses to an instant fill. Fully fluid width with container-query fonts.
 */
export const LiquidCTA = ({
    headline = "Dive right in",
    subtext = "Launch your next project with fluid interactions and a bold, modern visual identity.",
    ctaLabel = "Get started",
    liquidColor = "#22D3EE",
    fillDirection = "up",
    bubbles = true,
    sloshOnHover = true,
    burstOnClick = true,
    glassOutline = true,
    accentColor = "#06B6D4",
    sectionBackground = "#FFFFFF",
    headlineColor = "#000000",
    subtextColor = "#666666",
    buttonTextRestColor = "#000000",
    buttonTextFilledColor = "#FFFFFF",
    sectionMaxWidth = 980,
    sectionPadding = "72px 24px 88px 24px",
    buttonWidth = 360,
    buttonHeight = 76,
    buttonRadius = "999px",
    headlineFont = DEFAULT_HEADLINE_FONT,
    subtextFont = DEFAULT_SUBTEXT_FONT,
    buttonFont = DEFAULT_BUTTON_FONT,
    onClick,
    disabled = false,
    style,
    className,
}: LiquidCTAProps) => {
    const reducedMotion = usePrefersReducedMotion()
    const [isHovered, setIsHovered] = useState(false)
    const [fillProgress, setFillProgress] = useState(0.06)
    const [wavePhase, setWavePhase] = useState(0)
    const [sloshValue, setSloshValue] = useState(0)
    const [bubbleTick, setBubbleTick] = useState(0)
    const [burstProgress, setBurstProgress] = useState(1)
    const [isBursting, setIsBursting] = useState(false)
    const containerRef = useRef<HTMLElement | null>(null)
    const [containerWidth, setContainerWidth] = useState(1200)
    const rafIdRef = useRef<number | null>(null)
    const lastTimeRef = useRef<number>(0)
    const hoverEnterTimeRef = useRef<number>(0)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        if (typeof window === "undefined" || typeof ResizeObserver === "undefined")
            return
        const ro = new ResizeObserver(([entry]) => {
            setContainerWidth(entry.contentRect.width)
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const motionEnabled = !reducedMotion && !disabled
    const isTablet = containerWidth <= 810
    const isPhone = containerWidth <= 390

    const droplets = useMemo(
        () =>
            Array.from({ length: 9 }).map((_, index) => {
                const angle = (Math.PI * 2 * index) / 9
                return {
                    id: index,
                    dx: Math.cos(angle) * (28 + (index % 3) * 10),
                    dy: Math.sin(angle) * (22 + (index % 4) * 8),
                    size: 6 + (index % 4) * 2,
                    delay: (index % 5) * 0.03,
                }
            }),
        []
    )

    const accentDroplets = useMemo(
        () =>
            Array.from({ length: 6 }).map((_, i) => ({
                id: i,
                x: 15 + i * 14,
                y: i % 2 === 0 ? 12 : 6,
                scale: 0.65 + (i % 3) * 0.2,
            })),
        []
    )

    const handleHoverStart = useCallback(() => {
        if (disabled) return
        setIsHovered(true)
        if (typeof performance !== "undefined") {
            hoverEnterTimeRef.current = performance.now()
        }
    }, [disabled])

    const handleHoverEnd = useCallback(() => {
        setIsHovered(false)
    }, [])

    const handleClick = useCallback(() => {
        if (disabled) return
        onClick?.()
        if (!burstOnClick || !motionEnabled) return
        setIsBursting(true)
        setBurstProgress(0)
    }, [burstOnClick, disabled, motionEnabled, onClick])

    useEffect(() => {
        if (!motionEnabled) {
            setFillProgress(isHovered && !disabled ? 1 : 0.06)
            setWavePhase(0)
            setSloshValue(0)
            setBubbleTick(0)
            return
        }

        const step = (time: number) => {
            if (!lastTimeRef.current) lastTimeRef.current = time
            const dt = Math.min(34, time - lastTimeRef.current)
            lastTimeRef.current = time

            const fillTarget = isHovered ? 1 : 0.06
            const fillEase = isHovered ? 0.007 : 0.0045

            setFillProgress(
                (prev) =>
                    prev +
                    (fillTarget - prev) * (1 - Math.exp(-fillEase * dt * 10))
            )
            setWavePhase((prev) => prev + dt * 0.005)
            setBubbleTick((prev) => prev + dt * 0.0012)

            if (sloshOnHover) {
                const elapsed = time - hoverEnterTimeRef.current
                const damp = Math.exp(-elapsed / 550)
                const wobble = isHovered ? Math.sin(elapsed * 0.02) * damp : 0
                setSloshValue(wobble)
            } else {
                setSloshValue(0)
            }

            if (isBursting) {
                setBurstProgress((prev) => Math.min(1, prev + dt / 700))
            }

            rafIdRef.current = requestAnimationFrame(step)
        }

        rafIdRef.current = requestAnimationFrame(step)
        return () => {
            if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
            lastTimeRef.current = 0
        }
    }, [isHovered, isBursting, motionEnabled, sloshOnHover, disabled])

    useEffect(() => {
        if (isBursting && burstProgress >= 1) {
            setIsBursting(false)
        }
    }, [isBursting, burstProgress])

    const fillPercent = useMemo(
        () => Math.max(0, Math.min(100, fillProgress * 100)),
        [fillProgress]
    )

    const wavePath = useMemo(() => {
        const width = 100
        const height = 18
        const waveLength = 28
        const amplitude = 4 + Math.abs(sloshValue) * 8
        let path = `M 0 ${height / 2}`
        for (let x = 0; x <= width; x += 2) {
            const y =
                height / 2 +
                Math.sin((x / waveLength) * Math.PI * 2 + wavePhase * 2.2) *
                    amplitude +
                Math.sin(
                    (x / (waveLength * 0.65)) * Math.PI * 2 - wavePhase * 1.6
                ) *
                    (amplitude * 0.35)
            path += ` L ${x} ${y}`
        }
        path += ` L 100 ${height} L 0 ${height} Z`
        return path
    }, [wavePhase, sloshValue])

    const isFilledForText = fillProgress > 0.82
    const labelColor = isFilledForText
        ? buttonTextFilledColor
        : buttonTextRestColor

    const fillStyle = useMemo<CSSProperties>(() => {
        const base: CSSProperties = {
            position: "absolute",
            overflow: "hidden",
            background: `linear-gradient(180deg, ${liquidColor} 0%, ${accentColor} 100%)`,
            transition: motionEnabled ? "none" : "all 260ms ease",
        }
        if (fillDirection === "up") {
            return { ...base, left: "0%", bottom: "0%", width: "100%", height: `${fillPercent}%` }
        }
        if (fillDirection === "down") {
            return { ...base, left: "0%", top: "0%", width: "100%", height: `${fillPercent}%` }
        }
        if (fillDirection === "left") {
            return { ...base, right: "0%", top: "0%", width: `${fillPercent}%`, height: "100%" }
        }
        return { ...base, left: "0%", top: "0%", width: `${fillPercent}%`, height: "100%" }
    }, [accentColor, fillDirection, fillPercent, liquidColor, motionEnabled])

    const waveTransform = useMemo(() => {
        if (fillDirection === "up") return "translateY(-50%)"
        if (fillDirection === "down") return "translateY(50%) rotate(180deg)"
        if (fillDirection === "left") return "translateX(50%) rotate(90deg)"
        return "translateX(-50%) rotate(-90deg)"
    }, [fillDirection])

    const scaledButtonWidth = useMemo(() => {
        if (isPhone) return Math.max(160, Math.round(buttonWidth * 0.72))
        if (isTablet) return Math.max(180, Math.round(buttonWidth * 0.84))
        return buttonWidth
    }, [buttonWidth, isPhone, isTablet])

    const scaledButtonHeight = useMemo(() => {
        if (isPhone) return Math.max(42, Math.round(buttonHeight * 0.78))
        if (isTablet) return Math.max(46, Math.round(buttonHeight * 0.88))
        return buttonHeight
    }, [buttonHeight, isPhone, isTablet])

    return (
        <section
            ref={containerRef}
            className={className}
            style={{
                position: "relative",
                width: "100%",
                maxWidth: "100%",
                background: sectionBackground,
                display: "flex",
                justifyContent: "center",
                padding: isPhone
                    ? "32px 12px 38px 12px"
                    : isTablet
                      ? "48px 16px 56px 16px"
                      : sectionPadding,
                boxSizing: "border-box",
                overflow: "hidden",
                containerType: "inline-size",
                ...style,
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: `min(${sectionMaxWidth}px, 100%)`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: isPhone ? 10 : isTablet ? 12 : 14,
                    textAlign: "center",
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        color: headlineColor,
                        ...headlineFont,
                        width: "100%",
                    }}
                >
                    {headline}
                    <span style={{ color: accentColor }}> {"●"}</span>
                </h2>
                <p
                    style={{
                        margin: 0,
                        color: subtextColor,
                        ...subtextFont,
                        maxWidth: isPhone ? "100%" : 680,
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {subtext}
                </p>

                <div
                    style={{
                        position: "relative",
                        marginTop: isPhone ? 12 : isTablet ? 14 : 18,
                        width: scaledButtonWidth,
                        maxWidth: "100%",
                    }}
                >
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: -18,
                            pointerEvents: "none",
                        }}
                    >
                        {accentDroplets.map((drop) => {
                            const bob = motionEnabled
                                ? Math.sin(wavePhase * 2.5 + drop.id) * 5
                                : 0
                            return (
                                <span
                                    key={drop.id}
                                    style={{
                                        position: "absolute",
                                        left: `${drop.x}%`,
                                        top: `${drop.y + bob}%`,
                                        width: 8 * drop.scale,
                                        height: 8 * drop.scale,
                                        borderRadius: "999px",
                                        background: accentColor,
                                        opacity: 0.32,
                                        filter: "blur(0.2px)",
                                    }}
                                />
                            )
                        })}
                    </div>

                    <button
                        type="button"
                        aria-label={ctaLabel}
                        disabled={disabled}
                        onMouseEnter={handleHoverStart}
                        onMouseLeave={handleHoverEnd}
                        onFocus={handleHoverStart}
                        onBlur={handleHoverEnd}
                        onClick={handleClick}
                        style={{
                            position: "relative",
                            width: "100%",
                            height: scaledButtonHeight,
                            borderRadius: buttonRadius,
                            border: glassOutline
                                ? `1px solid color-mix(in srgb, ${accentColor} 85%, #ffffff 15%)`
                                : "none",
                            background: glassOutline
                                ? "rgba(255,255,255,0.14)"
                                : "rgba(255,255,255,0.04)",
                            backdropFilter: glassOutline
                                ? "blur(11px) saturate(135%)"
                                : "none",
                            WebkitBackdropFilter: glassOutline
                                ? "blur(11px) saturate(135%)"
                                : "none",
                            boxShadow: glassOutline
                                ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 28px color-mix(in srgb, ${accentColor} 30%, transparent)`
                                : `0 8px 28px color-mix(in srgb, ${accentColor} 20%, transparent)`,
                            overflow: "hidden",
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.6 : 1,
                            outline: "none",
                            padding: 0,
                        }}
                    >
                        <div style={fillStyle}>
                            <svg
                                viewBox="0 0 100 18"
                                preserveAspectRatio="none"
                                style={{
                                    position: "absolute",
                                    width:
                                        fillDirection === "up" ||
                                        fillDirection === "down"
                                            ? "100%"
                                            : 18,
                                    height:
                                        fillDirection === "up" ||
                                        fillDirection === "down"
                                            ? 18
                                            : "100%",
                                    left: fillDirection === "right" ? "100%" : 0,
                                    right:
                                        fillDirection === "left"
                                            ? "100%"
                                            : "auto",
                                    top: fillDirection === "down" ? "100%" : 0,
                                    bottom:
                                        fillDirection === "up" ? "100%" : "auto",
                                    transform: waveTransform,
                                    opacity: 0.95,
                                }}
                            >
                                <path d={wavePath} fill="rgba(255,255,255,0.45)" />
                                <path
                                    d={wavePath}
                                    fill="rgba(255,255,255,0.35)"
                                    transform={`translate(${Math.sin(wavePhase) * 2},0)`}
                                />
                            </svg>

                            {bubbles &&
                                (fillDirection === "up" ||
                                    fillDirection === "down") && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            pointerEvents: "none",
                                        }}
                                    >
                                        {Array.from({ length: 7 }).map(
                                            (_, index) => {
                                                const progress =
                                                    (bubbleTick *
                                                        (0.8 + index * 0.13) +
                                                        index * 0.21) %
                                                    1
                                                const rise = (1 - progress) * 95
                                                return (
                                                    <span
                                                        key={index}
                                                        style={{
                                                            position: "absolute",
                                                            left: `${12 + ((index * 13) % 72)}%`,
                                                            bottom: `${rise}%`,
                                                            width: 5 + (index % 3),
                                                            height: 5 + (index % 3),
                                                            borderRadius: "999px",
                                                            background:
                                                                "rgba(255,255,255,0.45)",
                                                            opacity:
                                                                fillProgress > 0.14
                                                                    ? 0.7 -
                                                                      progress * 0.6
                                                                    : 0,
                                                            transform: `translateX(${Math.sin(progress * 11 + index) * 4}px)`,
                                                            transition:
                                                                "opacity 120ms linear",
                                                        }}
                                                    />
                                                )
                                            }
                                        )}
                                    </div>
                                )}
                        </div>

                        {isBursting && burstOnClick && (
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    pointerEvents: "none",
                                }}
                            >
                                {droplets.map((drop) => {
                                    const t = Math.min(
                                        1,
                                        Math.max(0, burstProgress - drop.delay)
                                    )
                                    const arc =
                                        t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5
                                    const x = drop.dx * arc
                                    const y = drop.dy * arc - arc * arc * 10
                                    return (
                                        <span
                                            key={drop.id}
                                            style={{
                                                position: "absolute",
                                                left: "50%",
                                                top: "50%",
                                                width: drop.size,
                                                height: drop.size,
                                                marginLeft: -drop.size / 2,
                                                marginTop: -drop.size / 2,
                                                borderRadius: "999px",
                                                background: liquidColor,
                                                transform: `translate(${x}px, ${y}px)`,
                                                opacity: 0.2 + arc * 0.9,
                                                filter: "blur(0.2px)",
                                            }}
                                        />
                                    )
                                })}
                            </div>
                        )}

                        <span
                            style={{
                                position: "relative",
                                zIndex: 2,
                                color: labelColor,
                                ...buttonFont,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                height: "100%",
                                minWidth: "max-content",
                                transition: "color 220ms ease",
                            }}
                        >
                            {ctaLabel}
                        </span>
                    </button>
                </div>
            </div>
        </section>
    )
}

/**
 * Tracks `prefers-reduced-motion: reduce`. SSR-safe (returns false until mount).
 */
function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setReduced(mq.matches)
        update()
        mq.addEventListener?.("change", update)
        return () => mq.removeEventListener?.("change", update)
    }, [])
    return reduced
}
