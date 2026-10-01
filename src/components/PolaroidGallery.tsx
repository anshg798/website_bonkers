import {
    type CSSProperties,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

/** One photo + caption. Exported for typing consumer-supplied arrays. */
export interface PolaroidPhoto {
    src: string
    caption: string
}

export interface PolaroidGalleryProps {
    /** Photos to scatter. */
    photos?: PolaroidPhoto[]
    /** Max absolute rotation (deg) applied to each polaroid. */
    rotationRange?: number
    /** Scatter spread multiplier (0.5 tight → 2 loose). */
    scatterDensity?: number
    /** Google-font family name for handwritten captions. */
    captionFont?: string
    /** Straighten a polaroid to 0deg on hover. */
    hoverStraighten?: boolean
    /** Open a fullscreen lightbox on click / Enter / Space. */
    lightboxOnClick?: boolean
    /** Base polaroid width (px) at desktop; scales down on smaller containers. */
    polaroidWidth?: number
    /** Fired when a lightbox opens, with the photo's index. */
    onPhotoOpen?: (index: number) => void
    /** Fired when the lightbox closes. */
    onLightboxClose?: () => void
    style?: CSSProperties
    className?: string
}

const DEFAULT_PHOTOS: PolaroidPhoto[] = [
    { src: "https://picsum.photos/seed/1/400/300", caption: "Summer '22" },
    { src: "https://picsum.photos/seed/2/400/300", caption: "Road trip" },
    { src: "https://picsum.photos/seed/3/400/300", caption: "Golden hour" },
    { src: "https://picsum.photos/seed/4/400/300", caption: "Beach day" },
    { src: "https://picsum.photos/seed/5/400/300", caption: "Old town" },
]

/** Deterministic PRNG so scatter is stable across renders. */
function mulberry32(seed: number) {
    let t = seed
    return function () {
        t += 0x6d2b79f5
        let r = Math.imul(t ^ (t >>> 15), 1 | t)
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * PolaroidGallery — a scattered, seeded polaroid wall with handwritten captions,
 * idle sway, hover lift/straighten + dimming of the others, and an optional
 * lightbox. Layout and sizing derive from the measured container width; the
 * caption Google-font is loaded via an injected, de-duplicated `<link>`.
 */
export const PolaroidGallery = ({
    photos = DEFAULT_PHOTOS,
    rotationRange = 12,
    scatterDensity = 1,
    captionFont = "Caveat",
    hoverStraighten = true,
    lightboxOnClick = true,
    polaroidWidth = 200,
    onPhotoOpen,
    onLightboxClose,
    style,
    className,
}: PolaroidGalleryProps) => {
    const uid = useMemo(() => Math.random().toString(36).slice(2), [])
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [containerWidth, setContainerWidth] = useState(0)
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [activeLightboxIndex, setActiveLightboxIndex] = useState<
        number | null
    >(null)
    const [fontHref, setFontHref] = useState<string | null>(null)

    const responsiveMode = useMemo(() => {
        if (containerWidth >= 810) return "desktop" as const
        if (containerWidth >= 390) return "tablet" as const
        return "phone" as const
    }, [containerWidth])

    const responsiveSizeScale = useMemo(() => {
        if (responsiveMode === "tablet") return 0.85
        if (responsiveMode === "phone") return 0.65
        return 1
    }, [responsiveMode])

    const effectivePolaroidWidth = useMemo(() => {
        if (responsiveMode === "desktop") return polaroidWidth
        const scaledBase = polaroidWidth * responsiveSizeScale
        if (responsiveMode === "tablet") {
            const containerBased =
                containerWidth > 0 ? containerWidth * 0.34 : scaledBase
            return Math.max(
                140,
                Math.min(170, Math.min(scaledBase, containerBased))
            )
        }
        const containerBased =
            containerWidth > 0 ? containerWidth * 0.46 : scaledBase
        return Math.max(
            110,
            Math.min(130, Math.min(scaledBase, containerBased))
        )
    }, [containerWidth, polaroidWidth, responsiveMode, responsiveSizeScale])

    const effectiveRotationRange = useMemo(() => {
        if (responsiveMode === "phone") return rotationRange * 0.65
        if (responsiveMode === "tablet") return rotationRange * 0.9
        return rotationRange
    }, [rotationRange, responsiveMode])

    const cardHeight =
        effectivePolaroidWidth * (3 / 4) + 60 * responsiveSizeScale
    const basePadding =
        responsiveMode === "desktop"
            ? 44
            : responsiveMode === "tablet"
              ? 36
              : 28

    useEffect(() => {
        if (typeof window === "undefined") return
        if (!containerRef.current || typeof ResizeObserver === "undefined")
            return
        const node = containerRef.current
        const measure = () => setContainerWidth(node.clientWidth || 0)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    const layoutData = useMemo(() => {
        const placements = photos.map((_, index) => {
            const rand = mulberry32((index + 1) * 99991)
            const columns = Math.max(2, Math.ceil(Math.sqrt(photos.length)))
            const row = Math.floor(index / columns)
            const col = index % columns
            const baseX = col * (effectivePolaroidWidth * 0.72 * scatterDensity)
            const baseY = row * (cardHeight * 0.66 * scatterDensity)
            const jitterX =
                (rand() - 0.5) * effectivePolaroidWidth * 0.5 * scatterDensity
            const jitterY = (rand() - 0.5) * cardHeight * 0.42 * scatterDensity
            const rotation = (rand() * 2 - 1) * effectiveRotationRange
            const sway = 1 + rand() * 0.5
            const swayDuration = 6 + rand() * 4
            const swayDelay = rand() * 2.4
            const unclampedX = baseX + jitterX
            const maxXLimit = Math.max(
                0,
                (containerWidth || 0) - effectivePolaroidWidth - basePadding * 2
            )
            const clampedX =
                containerWidth > 0
                    ? Math.max(0, Math.min(unclampedX, maxXLimit))
                    : unclampedX
            return {
                x: clampedX,
                y: baseY + jitterY,
                rotation,
                sway,
                swayDuration,
                swayDelay,
                z: index + 1,
            }
        })

        const minX = placements.reduce(
            (acc, p) => Math.min(acc, p.x),
            Number.POSITIVE_INFINITY
        )
        const minY = placements.reduce(
            (acc, p) => Math.min(acc, p.y),
            Number.POSITIVE_INFINITY
        )
        const maxY = placements.reduce(
            (acc, p) => Math.max(acc, p.y + cardHeight),
            Number.NEGATIVE_INFINITY
        )

        const shiftX = Number.isFinite(minX) ? basePadding - minX : basePadding
        const shiftY = Number.isFinite(minY) ? basePadding - minY : basePadding
        const height =
            Number.isFinite(maxY) && Number.isFinite(minY)
                ? Math.max(140, maxY - minY + basePadding * 2)
                : 180

        return { placements, shiftX, shiftY, height }
    }, [
        photos,
        effectivePolaroidWidth,
        cardHeight,
        scatterDensity,
        effectiveRotationRange,
        containerWidth,
        basePadding,
    ])

    // Build the Google Fonts href (SSR-safe: rendered as an inline <link>).
    useEffect(() => {
        const trimmedFont = (captionFont || "Caveat").trim()
        const safeFont = encodeURIComponent(trimmedFont).replace(/%20/g, "+")
        setFontHref(
            `https://fonts.googleapis.com/css2?family=${safeFont}:wght@400;500;600;700&display=swap`
        )
    }, [captionFont])

    useEffect(() => {
        if (typeof window === "undefined") return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setActiveLightboxIndex(null)
                onLightboxClose?.()
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [onLightboxClose])

    const openLightbox = useCallback(
        (index: number) => {
            if (!lightboxOnClick) return
            setActiveLightboxIndex(index)
            onPhotoOpen?.(index)
        },
        [lightboxOnClick, onPhotoOpen]
    )

    const handleBackdropClick = useCallback(() => {
        setActiveLightboxIndex(null)
        onLightboxClose?.()
    }, [onLightboxClose])

    const lightboxPadding =
        responsiveMode === "desktop"
            ? "24px 16px 20px"
            : responsiveMode === "tablet"
              ? "20px 14px 16px"
              : "16px 12px 14px"

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: "relative",
                width: "100%",
                maxWidth: "100%",
                height: layoutData.height,
                overflow: "hidden",
                backgroundColor: "transparent",
                borderRadius: 12,
                boxSizing: "border-box",
                ...style,
            }}
        >
            {fontHref && <link rel="stylesheet" href={fontHref} />}
            <style>{`
                @keyframes polaroidEntry-${uid} {
                    0% { opacity: 0; transform: translateY(30px) scale(0.9); }
                    70% { opacity: 1; transform: translateY(-4px) scale(1.03); }
                    100% { opacity: 1; transform: translateY(0px) scale(1); }
                }
                @keyframes polaroidSway-${uid} {
                    0% { transform: rotate(calc(var(--base-rot) - var(--sway-amount))); }
                    50% { transform: rotate(calc(var(--base-rot) + var(--sway-amount))); }
                    100% { transform: rotate(calc(var(--base-rot) - var(--sway-amount))); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .polaroid-anim-${uid} { animation: none !important; }
                }
            `}</style>

            {photos.map((photo, index) => {
                const p = layoutData.placements[index]
                const isHovered = hoveredIndex === index
                const dimOthers =
                    hoveredIndex !== null && hoveredIndex !== index

                const swayStyle: CSSProperties =
                    isHovered && hoverStraighten
                        ? {
                              transform: "rotate(0deg)",
                              transition:
                                  "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease",
                          }
                        : {
                              transform: `rotate(${p.rotation}deg)`,
                              transition:
                                  "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease",
                              animationPlayState: isHovered
                                  ? "paused"
                                  : "running",
                              ["--base-rot" as any]: `${p.rotation}deg`,
                              ["--sway-amount" as any]: `${p.sway}deg`,
                          }

                return (
                    <div
                        key={`${photo.src}-${index}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open photo ${photo.caption}`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => openLightbox(index)}
                        onKeyDown={(event) => {
                            if (
                                (event.key === "Enter" || event.key === " ") &&
                                lightboxOnClick
                            ) {
                                event.preventDefault()
                                openLightbox(index)
                            }
                        }}
                        style={{
                            position: "absolute",
                            left: layoutData.shiftX + p.x,
                            top: layoutData.shiftY + p.y,
                            width: effectivePolaroidWidth,
                            cursor: lightboxOnClick ? "pointer" : "default",
                            zIndex: isHovered ? 100 : p.z,
                            opacity: dimOthers ? 0.6 : 1,
                            transition: "opacity 0.25s ease",
                            outline: "none",
                        }}
                    >
                        <div
                            className={`polaroid-anim-${uid}`}
                            style={{
                                animation: `polaroidEntry-${uid} 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both`,
                                animationDelay: `${index * 80}ms`,
                            }}
                        >
                            <div
                                className={
                                    isHovered && hoverStraighten
                                        ? undefined
                                        : `polaroid-anim-${uid}`
                                }
                                style={{
                                    ...swayStyle,
                                    animation:
                                        isHovered && hoverStraighten
                                            ? undefined
                                            : `polaroidSway-${uid} ${p.swayDuration}s ease-in-out ${p.swayDelay}s infinite`,
                                }}
                            >
                                <div
                                    style={{
                                        width: "100%",
                                        background: "#FFFFFF",
                                        border: "3px solid #F0EBE1",
                                        borderRadius: 2,
                                        boxShadow: isHovered
                                            ? "0 18px 34px rgba(74, 55, 40, 0.28)"
                                            : "0 12px 22px rgba(74, 55, 40, 0.18)",
                                        overflow: "hidden",
                                        transform: isHovered
                                            ? "scale(1.08)"
                                            : "scale(1)",
                                        transition:
                                            "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease",
                                    }}
                                >
                                    <img
                                        src={photo.src}
                                        alt={photo.caption || ""}
                                        style={{
                                            display: "block",
                                            width: "100%",
                                            aspectRatio: "4 / 3",
                                            objectFit: "cover",
                                        }}
                                    />
                                    <div
                                        style={{
                                            padding: "24px 16px 20px",
                                            minHeight: 56,
                                            color: "#4A3728",
                                            fontFamily: `"${captionFont}", "Caveat", cursive`,
                                            fontSize: 17 * responsiveSizeScale,
                                            lineHeight: 1.1,
                                        }}
                                    >
                                        {photo.caption}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}

            {lightboxOnClick &&
                activeLightboxIndex !== null &&
                photos[activeLightboxIndex] && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Photo lightbox"
                        onClick={handleBackdropClick}
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0, 0, 0, 0.75)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 1000,
                            padding: 24,
                        }}
                    >
                        <div
                            onClick={(event) => event.stopPropagation()}
                            style={{
                                width: "100%",
                                maxWidth: 480,
                                transform: "rotate(0deg)",
                            }}
                        >
                            <div
                                style={{
                                    width: "100%",
                                    background: "#FFFFFF",
                                    border: "3px solid #F0EBE1",
                                    borderRadius: 2,
                                    boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
                                    overflow: "hidden",
                                }}
                            >
                                <img
                                    src={photos[activeLightboxIndex].src}
                                    alt={
                                        photos[activeLightboxIndex].caption || ""
                                    }
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        aspectRatio: "4 / 3",
                                        objectFit: "cover",
                                    }}
                                />
                                <div
                                    style={{
                                        padding: lightboxPadding,
                                        color: "#4A3728",
                                        fontFamily: `"${captionFont}", "Caveat", cursive`,
                                        fontSize: 18 * responsiveSizeScale,
                                        lineHeight: 1.1,
                                    }}
                                >
                                    {photos[activeLightboxIndex].caption}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    )
}
