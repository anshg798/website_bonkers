import {
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

/** A responsive image descriptor for a feature illustration. */
export interface BookFeatureImage {
    src?: string
    srcSet?: string
    alt?: string
}

/** One feature spread (illustration + title + copy). Exported for typing. */
export interface BookFeatureItem {
    /** Illustration shown on the left page. */
    illustration?: BookFeatureImage
    /** Feature title (right page heading). */
    title: string
    /** Feature body copy (right page paragraph). */
    copy: string
}

/** Cover color + title. Exported for typing. */
export interface BookCoverStyle {
    color: string
    title: string
}

/** Page paper texture variant. */
export type BookPageTexture = "Cream" | "White" | "Aged"

/** Local font-config shape (replaces the Framer `Font` control). */
export interface BookFontConfig {
    fontSize?: number | string
    lineHeight?: number | string
    letterSpacing?: number | string
    textAlign?: "left" | "center" | "right"
    fontWeight?: number
    fontStyle?: "normal" | "italic"
    fontFamily?: string
}

export interface BookFeaturesProps {
    /** Feature spreads to page through. */
    features?: BookFeatureItem[]
    /** Hardcover cover color + title. */
    coverStyle?: BookCoverStyle
    /** Page paper texture. */
    pageTexture?: BookPageTexture
    /** Enable the right-edge drag-to-turn affordance. */
    dragToTurn?: boolean
    /** Show the sliding ribbon bookmark. */
    bookmark?: boolean
    /** Serif font config for cover/title/copy. */
    serifFont?: BookFontConfig
    /** Page-turn duration seconds (clamped 0.4–1.2). */
    turnSpeed?: number
    /** Curl/gutter shadow strength, 0–1. */
    curlShadow?: number
    /** Play the cover-open animation on mount. */
    openOnLoad?: boolean
    /** Max book width (px) at full scale; the book scales down to fit. */
    maxWidth?: number
    /** Controlled current spread index. */
    index?: number
    /** Uncontrolled initial spread index. */
    defaultIndex?: number
    /** Fired when the settled spread index changes. */
    onIndexChange?: (index: number) => void
    style?: CSSProperties
    className?: string
}

const BASE_BOOK_W = 920
const BASE_BOOK_H = 560

const DEFAULT_FEATURES: BookFeatureItem[] = [
    {
        illustration: {
            src: "https://framerusercontent.com/images/f9RiWoNpmlCMqVRIHz8l8wYfeI.jpg",
            alt: "Feature illustration one",
        },
        title: "Layered Storytelling",
        copy: "Craft rich product narratives with deeply structured chapters, elegant pacing, and visual rhythm that rewards careful reading.",
    },
    {
        illustration: {
            src: "https://framerusercontent.com/images/2uTNEj5aTl2K3NJaEFWMbnrA.jpg",
            alt: "Feature illustration two",
        },
        title: "Editorial Precision",
        copy: "Every spread highlights one key capability, balancing image and prose to make complex ideas feel effortless and premium.",
    },
    {
        illustration: {
            src: "https://framerusercontent.com/images/BYnxEV1zjYb9bhWh1IwBZ1ZoS60.jpg",
            alt: "Feature illustration three",
        },
        title: "Collector-Grade Finish",
        copy: "Subtle textures, paper shading, and hardcover detailing create a tactile digital experience inspired by heirloom design books.",
    },
]

/**
 * BookFeatures — a hardcover "book" that pages through feature spreads with a
 * 3D page-turn, a cover-open reveal, a sliding bookmark and optional drag-to-turn.
 * Built at a fixed 920×560 design size and uniformly `transform: scale()`-d down
 * to the measured container width (the px-locked-3D responsiveness pattern).
 */
export const BookFeatures = ({
    features = DEFAULT_FEATURES,
    coverStyle = { color: "#000000", title: "Product Features" },
    pageTexture = "Cream",
    dragToTurn = true,
    bookmark = true,
    serifFont,
    turnSpeed = 0.8,
    curlShadow = 0.5,
    openOnLoad = true,
    maxWidth = BASE_BOOK_W,
    index,
    defaultIndex = 0,
    onIndexChange,
    style,
    className,
}: BookFeaturesProps) => {
    const reducedMotion = usePrefersReducedMotion()

    const safeFeatures =
        features.length > 0
            ? features
            : [
                  {
                      title: "Feature",
                      copy: "Add feature content.",
                      illustration: undefined,
                  },
              ]
    const total = safeFeatures.length

    const isControlled = index !== undefined
    const [internalIndex, setInternalIndex] = useState(() =>
        Math.max(0, Math.min(defaultIndex, total - 1))
    )
    const currentIndex = isControlled
        ? Math.max(0, Math.min(index as number, total - 1))
        : internalIndex

    const [turningTo, setTurningTo] = useState<number | null>(null)
    const [turnDirection, setTurnDirection] = useState<1 | -1>(1)
    const [coverOpen, setCoverOpen] = useState(!openOnLoad)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [inView, setInView] = useState(false)
    const [containerWidth, setContainerWidth] = useState(BASE_BOOK_W)

    // Drag state (rAF-driven; replaces useMotionValue/useTransform/animate).
    const dragLayerRef = useRef<HTMLDivElement | null>(null)
    const dragPeelRef = useRef<HTMLDivElement | null>(null)
    const dragXRef = useRef(0)
    const draggingRef = useRef(false)
    const dragStartXRef = useRef(0)
    const releaseRafRef = useRef<number | null>(null)

    const effectiveMaxW = Math.max(240, Math.min(maxWidth, BASE_BOOK_W))
    const scaleFactor = useMemo(() => {
        const cap = Math.min(containerWidth, effectiveMaxW)
        return Math.max(0.26, Math.min(1, (cap - 40) / BASE_BOOK_W))
    }, [containerWidth, effectiveMaxW])
    const scaledH = useMemo(
        () => Math.round(BASE_BOOK_H * scaleFactor),
        [scaleFactor]
    )

    useEffect(() => {
        if (typeof window === "undefined") return
        const node = containerRef.current
        if (!node) return
        const updateWidth = () => {
            const width = node.getBoundingClientRect().width
            setContainerWidth(width > 0 ? width : BASE_BOOK_W)
        }
        updateWidth()
        const observer = new ResizeObserver(updateWidth)
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        const node = containerRef.current
        if (!node) return
        const observer = new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting),
            { threshold: 0.25 }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (reducedMotion || !openOnLoad) {
            setCoverOpen(true)
            return
        }
        if (typeof window === "undefined") return
        const id = window.setTimeout(() => setCoverOpen(true), 240)
        return () => window.clearTimeout(id)
    }, [openOnLoad, reducedMotion])

    const canGoPrev = currentIndex > 0 && turningTo === null
    const canGoNext = currentIndex < total - 1 && turningTo === null

    const commitIndex = useCallback(
        (next: number) => {
            if (!isControlled) setInternalIndex(next)
            onIndexChange?.(next)
        },
        [isControlled, onIndexChange]
    )

    const startTurn = useCallback(
        (direction: 1 | -1) => {
            if (direction === 1 && currentIndex >= total - 1) return
            if (direction === -1 && currentIndex <= 0) return
            if (turningTo !== null) return
            const nextIndex = currentIndex + direction
            setTurnDirection(direction)
            setTurningTo(nextIndex)
        },
        [currentIndex, total, turningTo]
    )

    const onTurnComplete = useCallback(() => {
        setTurningTo((prev) => {
            if (prev === null) return null
            commitIndex(prev)
            return null
        })
    }, [commitIndex])

    const activeItem = safeFeatures[currentIndex]
    const targetItem = turningTo !== null ? safeFeatures[turningTo] : null

    const paperPalette = useMemo(() => {
        if (pageTexture === "White")
            return {
                page: "#FFFFFF",
                grain: "rgba(0,0,0,0.04)",
                edge: "#ECECEC",
            }
        if (pageTexture === "Aged")
            return {
                page: "#F5EEDC",
                grain: "rgba(132,102,44,0.10)",
                edge: "#E5D9BE",
            }
        return {
            page: "#FBF7ED",
            grain: "rgba(97,84,56,0.08)",
            edge: "#EBE2CE",
        }
    }, [pageTexture])

    const bookmarkProgress = total > 1 ? currentIndex / (total - 1) : 0
    const ribbonTop = 14 + bookmarkProgress * 84

    const contentDuration = reducedMotion || !inView ? 0.01 : 0.44
    const turnDuration =
        reducedMotion || !inView
            ? 0.01
            : Math.min(Math.max(turnSpeed, 0.4), 1.2)

    // --- Drag-to-turn: pointer handlers + rAF spring-back (replaces animate()) ---
    const applyDragVisual = useCallback((x: number) => {
        dragXRef.current = x
        if (dragLayerRef.current) {
            dragLayerRef.current.style.transform = `translateX(${x}px)`
        }
        if (dragPeelRef.current) {
            // dragRotate: [-240,0] -> [-150deg, 0]
            const t = Math.max(0, Math.min(1, -x / 240))
            dragPeelRef.current.style.transform = `rotateY(${-150 * t}deg)`
            dragPeelRef.current.style.opacity = `${0.55 * t}`
        }
    }, [])

    const springBackToZero = useCallback(() => {
        if (typeof window === "undefined") {
            applyDragVisual(0)
            return
        }
        if (reducedMotion) {
            applyDragVisual(0)
            return
        }
        const start = dragXRef.current
        const startTime = performance.now()
        const dur = 300
        const ease = (p: number) => 1 - Math.pow(1 - p, 3) // approx [0.2,0.9,0.2,1]
        const tick = (now: number) => {
            const p = Math.min(1, (now - startTime) / dur)
            applyDragVisual(start * (1 - ease(p)))
            if (p < 1) {
                releaseRafRef.current = requestAnimationFrame(tick)
            } else {
                releaseRafRef.current = null
            }
        }
        releaseRafRef.current = requestAnimationFrame(tick)
    }, [applyDragVisual, reducedMotion])

    const handlePointerDown = useCallback(
        (e: ReactPointerEvent<HTMLDivElement>) => {
            if (!canGoNext) return
            draggingRef.current = true
            dragStartXRef.current = e.clientX - dragXRef.current
            if (releaseRafRef.current !== null) {
                cancelAnimationFrame(releaseRafRef.current)
                releaseRafRef.current = null
            }
            e.currentTarget.setPointerCapture?.(e.pointerId)
        },
        [canGoNext]
    )

    const handlePointerMove = useCallback(
        (e: ReactPointerEvent<HTMLDivElement>) => {
            if (!draggingRef.current) return
            // constraints: left -240, right 0, elastic 0.06
            let next = e.clientX - dragStartXRef.current
            if (next > 0) next = next * 0.06
            if (next < -240) next = -240 + (next + 240) * 0.06
            applyDragVisual(next)
        },
        [applyDragVisual]
    )

    const handlePointerUp = useCallback(
        (e: ReactPointerEvent<HTMLDivElement>) => {
            if (!draggingRef.current) return
            draggingRef.current = false
            e.currentTarget.releasePointerCapture?.(e.pointerId)
            const dragged = dragXRef.current
            if (dragged < -120 && canGoNext) {
                applyDragVisual(0)
                startTurn(1)
            } else {
                springBackToZero()
            }
        },
        [applyDragVisual, canGoNext, springBackToZero, startTurn]
    )

    useEffect(() => {
        if (turningTo !== null) {
            if (releaseRafRef.current !== null) {
                cancelAnimationFrame(releaseRafRef.current)
                releaseRafRef.current = null
            }
            applyDragVisual(0)
        }
    }, [applyDragVisual, turningTo])

    useEffect(() => {
        return () => {
            if (releaseRafRef.current !== null)
                cancelAnimationFrame(releaseRafRef.current)
        }
    }, [])

    const baseTextStyle: CSSProperties = {
        fontFamily:
            serifFont?.fontFamily || "Georgia, 'Times New Roman', serif",
        letterSpacing: serifFont?.letterSpacing,
        lineHeight: serifFont?.lineHeight || "1.35em",
        textAlign: serifFont?.textAlign || "left",
        fontWeight: serifFont?.fontWeight,
        fontStyle: serifFont?.fontStyle,
    }

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: "relative",
                width: "100%",
                height: scaledH + 40,
                boxSizing: "border-box",
                background: "transparent",
                perspective: 1600,
                ...style,
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        width: BASE_BOOK_W,
                        height: BASE_BOOK_H,
                        flexShrink: 0,
                        position: "relative",
                        transform: `scale(${scaleFactor})`,
                        transformOrigin: "top center",
                        transformStyle: "preserve-3d",
                        borderRadius: 16,
                        boxSizing: "border-box",
                    }}
                >
                    {bookmark && (
                        <div
                            aria-hidden
                            style={{
                                position: "absolute",
                                top: ribbonTop,
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: 16,
                                height: 120,
                                borderRadius: "0 0 10px 10px",
                                zIndex: 8,
                                background:
                                    "linear-gradient(180deg, #A30F2F 0%, #7C001F 100%)",
                                boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
                                transition: `top ${turnDuration}s cubic-bezier(0.22,1,0.36,1)`,
                            }}
                        />
                    )}

                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 14,
                            overflow: "hidden",
                            background: paperPalette.page,
                            boxShadow:
                                "0 30px 80px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 0 80px rgba(0,0,0,0.05)",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                left: "50%",
                                top: 0,
                                transform: "translateX(-50%)",
                                width: 24,
                                height: "100%",
                                background: `linear-gradient(90deg, rgba(0,0,0,${0.22 * curlShadow}) 0%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,${0.18 * curlShadow}) 100%)`,
                                zIndex: 3,
                            }}
                        />

                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                backgroundImage: `radial-gradient(${paperPalette.grain} 0.5px, transparent 0.5px)`,
                                backgroundSize: "4px 4px",
                                opacity: 0.4,
                                pointerEvents: "none",
                            }}
                        />

                        <div
                            style={{
                                position: "relative",
                                zIndex: 2,
                                display: "flex",
                                width: "100%",
                                height: "100%",
                            }}
                        >
                            <div
                                style={{
                                    width: "50%",
                                    padding: "36px 30px 36px 36px",
                                    boxSizing: "border-box",
                                }}
                            >
                                <div
                                    key={`illustration-${currentIndex}`}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        borderRadius: 10,
                                        overflow: "hidden",
                                        border: `1px solid ${paperPalette.edge}`,
                                        boxShadow:
                                            "0 10px 30px rgba(0,0,0,0.12)",
                                        background: "#F5F5F5",
                                        animation:
                                            contentDuration > 0.02
                                                ? `bf-fade-up-${contentDuration} ${contentDuration}s ease-out both`
                                                : "none",
                                    }}
                                >
                                    {activeItem.illustration?.src ? (
                                        <img
                                            src={activeItem.illustration.src}
                                            srcSet={
                                                activeItem.illustration.srcSet
                                            }
                                            alt={
                                                activeItem.illustration?.alt ||
                                                ""
                                            }
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                display: "block",
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                background:
                                                    "linear-gradient(135deg,#DDD,#F7F7F7)",
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                            <div
                                style={{
                                    width: "50%",
                                    padding: "42px 38px 36px 30px",
                                    boxSizing: "border-box",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 18,
                                }}
                            >
                                <h3
                                    key={`title-${currentIndex}`}
                                    style={{
                                        margin: 0,
                                        color: "#000000",
                                        fontSize:
                                            serifFont?.fontSize !== undefined
                                                ? serifFont.fontSize
                                                : "clamp(24px, 5.2cqw, 32px)",
                                        ...baseTextStyle,
                                        animation:
                                            contentDuration > 0.02
                                                ? `bf-fade-up-${contentDuration} ${contentDuration}s ease-out 0.06s both`
                                                : "none",
                                    }}
                                >
                                    {activeItem.title}
                                </h3>
                                <p
                                    key={`copy-${currentIndex}`}
                                    style={{
                                        margin: 0,
                                        color: "#000000",
                                        fontSize: "16px",
                                        ...baseTextStyle,
                                        animation:
                                            contentDuration > 0.02
                                                ? `bf-fade-up-${contentDuration} ${contentDuration}s ease-out 0.12s both`
                                                : "none",
                                    }}
                                >
                                    {activeItem.copy}
                                </p>
                            </div>
                        </div>

                        {turningTo !== null && targetItem && (
                            <div
                                key={`turn-${currentIndex}-${turningTo}`}
                                onAnimationEnd={onTurnComplete}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: "50%",
                                    width: "50%",
                                    height: "100%",
                                    transformStyle: "preserve-3d",
                                    transformOrigin: "left center",
                                    zIndex: 6,
                                    animation: `bf-turn-${turnDirection}-${turnDuration} ${turnDuration}s cubic-bezier(0.2,0.72,0.2,1) forwards`,
                                }}
                            >
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        backfaceVisibility: "hidden",
                                        background: paperPalette.page,
                                        boxShadow: `-20px 0 40px rgba(0,0,0,${0.1 + curlShadow * 0.25})`,
                                    }}
                                />
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        backfaceVisibility: "hidden",
                                        transform: "rotateY(180deg)",
                                        background: paperPalette.page,
                                        overflow: "hidden",
                                    }}
                                >
                                    <img
                                        src={targetItem.illustration?.src || ""}
                                        alt={targetItem.illustration?.alt || ""}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            opacity: 0.35,
                                        }}
                                    />
                                </div>
                                <div
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        pointerEvents: "none",
                                        background: `linear-gradient(100deg, rgba(0,0,0,${0.05 + curlShadow * 0.3}) 0%, rgba(255,255,255,0.05) 36%, rgba(0,0,0,0.22) 100%)`,
                                        mixBlendMode: "multiply",
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {dragToTurn && canGoNext && turningTo === null && (
                        <div
                            ref={dragLayerRef}
                            role="button"
                            aria-label="Drag to turn page"
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            style={{
                                position: "absolute",
                                right: 6,
                                top: 16,
                                bottom: 16,
                                width: 48,
                                zIndex: 7,
                                cursor: "grab",
                                borderRadius: 10,
                                background: "transparent",
                                touchAction: "none",
                            }}
                        >
                            <div
                                ref={dragPeelRef}
                                aria-hidden
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: 10,
                                    transformOrigin: "right center",
                                    transform: "rotateY(0deg)",
                                    background:
                                        "linear-gradient(270deg, rgba(0,0,0,0.24) 0%, rgba(255,255,255,0.0) 80%)",
                                    opacity: 0,
                                }}
                            />
                        </div>
                    )}

                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: 0,
                            transformStyle: "preserve-3d",
                            transformOrigin: "left center",
                            zIndex: 10,
                            borderRadius: 14,
                            overflow: "hidden",
                            backfaceVisibility: "hidden",
                            background: `linear-gradient(140deg, ${coverStyle.color} 0%, rgba(0,0,0,0.88) 100%)`,
                            boxShadow:
                                "0 24px 70px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.1)",
                            transform: coverOpen
                                ? "rotateY(-110deg)"
                                : "rotateY(0deg)",
                            transition: `transform ${reducedMotion ? 0.01 : Math.max(0.45, turnSpeed)}s cubic-bezier(0.22,1,0.36,1)`,
                            pointerEvents: coverOpen ? "none" : "auto",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                backgroundImage:
                                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
                                opacity: 0.55,
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                inset: "10% 12%",
                                borderRadius: 8,
                                border: "1px solid rgba(255,255,255,0.22)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "20px",
                                boxSizing: "border-box",
                                textAlign: "center",
                            }}
                        >
                            <h2
                                style={{
                                    margin: 0,
                                    color: "#FFFFFF",
                                    fontSize: "clamp(28px, 6cqw, 38px)",
                                    ...baseTextStyle,
                                }}
                            >
                                {coverStyle.title}
                            </h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Previous spread"
                        disabled={!canGoPrev}
                        onClick={() => startTurn(-1)}
                        style={{
                            position: "absolute",
                            left: 12,
                            bottom: 12,
                            zIndex: 12,
                            width: 38,
                            height: 38,
                            borderRadius: 999,
                            border: "1px solid #EEEEEE",
                            background: canGoPrev ? "#FFFFFF" : "#F5F5F5",
                            color: "#000000",
                            opacity: canGoPrev ? 1 : 0.55,
                            cursor: canGoPrev ? "pointer" : "not-allowed",
                        }}
                    >
                        {"←"}
                    </button>
                    <button
                        type="button"
                        aria-label="Next spread"
                        disabled={!canGoNext}
                        onClick={() => startTurn(1)}
                        style={{
                            position: "absolute",
                            right: 12,
                            bottom: 12,
                            zIndex: 12,
                            width: 38,
                            height: 38,
                            borderRadius: 999,
                            border: "1px solid #EEEEEE",
                            background: canGoNext ? "#FFFFFF" : "#F5F5F5",
                            color: "#000000",
                            opacity: canGoNext ? 1 : 0.55,
                            cursor: canGoNext ? "pointer" : "not-allowed",
                        }}
                    >
                        {"→"}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes bf-fade-up-${contentDuration} {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes bf-turn-1-${turnDuration} {
                    from { transform: rotateY(0deg); }
                    to { transform: rotateY(-180deg); }
                }
                @keyframes bf-turn--1-${turnDuration} {
                    from { transform: rotateY(-180deg); }
                    to { transform: rotateY(0deg); }
                }
            `}</style>
        </div>
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
