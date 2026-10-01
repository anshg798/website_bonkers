import {
    type CSSProperties,
    type FormEvent,
    type MouseEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

/**
 * A single contact form field descriptor.
 * Exported so consumers can build/type their own `formFields` arrays.
 */
export interface AuroraContactField {
    /** Unique field name (used as the value key and React key). */
    name: string
    /** Floating label text. */
    label: string
    /** Input type — "textarea" renders a multi-line field. */
    type: "text" | "email" | "textarea" | "tel"
    /** Whether the field is required for submission. */
    required: boolean
}

/**
 * A contact-strip item (email / phone / location chip).
 * Exported for typing consumer-supplied `contactStrip` arrays.
 */
export interface AuroraContactItem {
    /** Bold prefix label, e.g. "Email". */
    label: string
    /** Display value, e.g. "hello@aurora.studio". */
    value: string
    /** Optional link target — wraps the chip in an anchor when set. */
    href: string
    /** Optional icon name (unused by the strip, kept for parity). */
    iconName?: string
}

/**
 * A social icon link.
 * Exported for typing consumer-supplied `socialIcons` arrays.
 */
export interface AuroraSocialItem {
    /** Accessible label / title for the link. */
    label: string
    /** Link target. */
    href: string
    /** Named icon ("x" | "linkedin" | "github" | "dribbble", else fallback). */
    iconName?: string
    /** Explicit SVG path data — overrides `iconName` when provided. */
    svgPath?: string
}

export interface AuroraContactProps {
    /** Main heading text. */
    heading?: string
    /** Supporting sub-heading paragraph. */
    subheading?: string
    /** Form field descriptors. Fields missing `name`/`label` are skipped. */
    formFields?: AuroraContactField[]
    /** Contact-strip chips rendered below the panel. */
    contactStrip?: AuroraContactItem[]
    /** Social icon links rendered beside the contact strip. */
    socialIcons?: AuroraSocialItem[]
    /** Backdrop blur (px) applied to the frosted glass panel. */
    glassBlur?: number
    /** Parallax/bob intensity, 0–1. 0 disables tilt + bob. */
    floatIntensity?: number
    /** CSS background for the submit button. */
    buttonGradient?: string
    /** Called on successful submit with the current field values. */
    onSubmit?: (values: Record<string, string>) => void
    /** Called whenever any field value changes. */
    onChange?: (name: string, value: string) => void
    /** Milliseconds the success ("Sent") state stays before resetting. */
    successResetMs?: number
    /** Max width (px) of the glass panel. */
    maxWidth?: number
    /** Optional style applied to the outer `<section>`. */
    style?: CSSProperties
    /** Optional className applied to the outer `<section>`. */
    className?: string
}

const DEFAULT_FIELDS: AuroraContactField[] = [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "message", label: "Message", type: "textarea", required: true },
]

const DEFAULT_CONTACT_STRIP: AuroraContactItem[] = [
    {
        label: "Email",
        value: "hello@aurora.studio",
        href: "mailto:hello@aurora.studio",
    },
    { label: "Phone", value: "+1 (415) 555-0148", href: "tel:+14155550148" },
    { label: "Location", value: "San Francisco, CA", href: "" },
]

const DEFAULT_SOCIALS: AuroraSocialItem[] = [
    { label: "X", href: "https://x.com", iconName: "x" },
    { label: "LinkedIn", href: "https://linkedin.com", iconName: "linkedin" },
    { label: "GitHub", href: "https://github.com", iconName: "github" },
    { label: "Dribbble", href: "https://dribbble.com", iconName: "dribbble" },
]

function iconPathFor(iconName?: string): string {
    switch ((iconName || "").toLowerCase()) {
        case "twitter":
        case "x":
            return "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.658l-5.214-6.817-5.965 6.817H1.68l7.73-8.835L1.254 2.25h6.827l4.713 6.231 5.45-6.231Z"
        case "linkedin":
            return "M4.98 3.5C4.98 4.88071 3.86071 6 2.48 6C1.09929 6 0 4.88071 0 3.5C0 2.11929 1.09929 1 2.48 1C3.86071 1 4.98 2.11929 4.98 3.5ZM0.5 8H4.46V21H0.5V8ZM7.5 8H11.29V9.77H11.34C11.87 8.77 13.16 7.72 15.08 7.72C19.08 7.72 19.82 10.35 19.82 13.77V21H15.86V14.39C15.86 12.81 15.83 10.77 13.66 10.77C11.46 10.77 11.12 12.49 11.12 14.28V21H7.5V8Z"
        case "github":
            return "M12 .5C5.65.5.5 5.64.5 12c0 5.09 3.29 9.41 7.86 10.94.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.27-5.24-5.67 0-1.25.44-2.26 1.17-3.06-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.9 10.9 0 0 1 5.74 0c2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.12 3.04.73.8 1.17 1.81 1.17 3.06 0 4.41-2.7 5.38-5.27 5.66.41.36.78 1.08.78 2.18 0 1.57-.01 2.84-.01 3.23 0 .3.2.66.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.64 18.36.5 12 .5Z"
        case "dribbble":
            return "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm6.99 4.83a8.97 8.97 0 0 1 1.94 5.44c-1.72-.35-3.29-.36-4.71-.06-.1-.25-.21-.51-.32-.76a20.2 20.2 0 0 0-1.08-2.1c2.05-.84 3.47-2.04 4.17-2.52Zm-2.02-2.02c-.62.45-1.88 1.58-3.73 2.34a42.7 42.7 0 0 0-2.67-3.47 9 9 0 0 1 6.4 1.13ZM9.1 2.97a39.6 39.6 0 0 1 2.8 3.52c-3.69.98-6.94.95-7.7.94A9 9 0 0 1 9.1 2.97ZM3.5 12c0-.38.03-.74.08-1.1.79.02 4.59.06 8.96-1.26.25.5.48 1 .69 1.5-.12.03-.23.06-.35.1-4.49 1.45-6.87 5.4-7.08 5.77A8.95 8.95 0 0 1 3.5 12Zm3.46 6.42c.16-.28 2.06-3.36 6.37-4.82.1-.03.2-.07.3-.1.92 2.37 1.29 4.35 1.42 5.08a8.95 8.95 0 0 1-8.09-.16Zm10.25-.96a24.98 24.98 0 0 0-1.29-4.65c1.27-.2 2.7-.14 4.27.2a9 9 0 0 1-2.98 4.45Z"
        default:
            return "M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"
    }
}

/**
 * AuroraContact — a self-contained dark contact section with a frosted glass
 * panel, floating-label form, a submit → "Sent" success morph, a contact strip
 * and social icons. Pointer parallax tilt + idle bob respond to `floatIntensity`
 * and are disabled under reduced motion.
 */
export const AuroraContact = ({
    heading = "Let’s Build Something Bright",
    subheading = "Share your idea and we’ll reply with a tailored plan within one business day.",
    formFields = DEFAULT_FIELDS,
    contactStrip = DEFAULT_CONTACT_STRIP,
    socialIcons = DEFAULT_SOCIALS,
    glassBlur = 18,
    floatIntensity = 0.5,
    buttonGradient = "linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #14B8A6 100%)",
    onSubmit,
    onChange,
    successResetMs = 1900,
    maxWidth = 560,
    style,
    className,
}: AuroraContactProps) => {
    const uid = useMemo(() => Math.random().toString(36).slice(2), [])
    const reducedMotion = usePrefersReducedMotion()

    const [mounted, setMounted] = useState(false)
    const [focusedField, setFocusedField] = useState<string | null>(null)
    const [values, setValues] = useState<Record<string, string>>({})
    const [errors, setErrors] = useState<Record<string, boolean>>({})
    const [submitted, setSubmitted] = useState(false)
    const [panelParallax, setPanelParallax] = useState({
        x: 0,
        y: 0,
        rx: 0,
        ry: 0,
    })
    const [inView, setInView] = useState(true)
    const sectionRef = useRef<HTMLElement | null>(null)
    const resetTimerRef = useRef<number | null>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (typeof window === "undefined" || !sectionRef.current) return
        const observer = new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting),
            { threshold: 0.15 }
        )
        observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        return () => {
            if (resetTimerRef.current !== null && typeof window !== "undefined") {
                window.clearTimeout(resetTimerRef.current)
            }
        }
    }, [])

    const safeFields = useMemo(
        () => (formFields || []).filter((f) => f?.name && f?.label),
        [formFields]
    )
    const canAnimate = mounted && !reducedMotion && inView
    const intensity = Math.max(0, Math.min(1, floatIntensity || 0))

    const handleInputChange = useCallback(
        (name: string, value: string) => {
            setValues((prev) => ({ ...prev, [name]: value }))
            setErrors((prev) => ({ ...prev, [name]: false }))
            onChange?.(name, value)
        },
        [onChange]
    )

    const handleSubmit = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const nextErrors: Record<string, boolean> = {}
            safeFields.forEach((field) => {
                const current = (values[field.name] || "").trim()
                if (field.required && !current) nextErrors[field.name] = true
                if (
                    field.type === "email" &&
                    current &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current)
                )
                    nextErrors[field.name] = true
            })
            if (Object.keys(nextErrors).length > 0) {
                setErrors(nextErrors)
                return
            }
            setSubmitted(true)
            onSubmit?.(values)
            if (typeof window !== "undefined") {
                if (resetTimerRef.current !== null)
                    window.clearTimeout(resetTimerRef.current)
                resetTimerRef.current = window.setTimeout(() => {
                    setSubmitted(false)
                    setValues({})
                }, successResetMs)
            }
        },
        [safeFields, values, onSubmit, successResetMs]
    )

    const handleMouseMove = useCallback(
        (event: MouseEvent<HTMLElement>) => {
            if (!canAnimate || !sectionRef.current) return
            const rect = sectionRef.current.getBoundingClientRect()
            const px = (event.clientX - rect.left) / rect.width - 0.5
            const py = (event.clientY - rect.top) / rect.height - 0.5
            const maxOffset = 16 * intensity
            const maxTilt = 6 * intensity
            setPanelParallax({
                x: px * maxOffset,
                y: py * maxOffset,
                rx: -py * maxTilt,
                ry: px * maxTilt,
            })
        },
        [canAnimate, intensity]
    )

    const handleMouseLeave = useCallback(() => {
        setPanelParallax({ x: 0, y: 0, rx: 0, ry: 0 })
    }, [])

    const panelTransform = canAnimate
        ? `translate3d(${panelParallax.x}px, ${panelParallax.y}px, 0) rotateX(${panelParallax.rx}deg) rotateY(${panelParallax.ry}deg)`
        : "translate3d(0,0,0)"

    const hasStrip =
        (contactStrip?.length ?? 0) > 0 || (socialIcons?.length ?? 0) > 0

    return (
        <section
            ref={sectionRef}
            className={className}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                position: "relative",
                width: "100%",
                minHeight: 720,
                overflow: "hidden",
                color: "#FFFFFF",
                padding: "clamp(40px, 8cqw, 64px) clamp(14px, 4cqw, 20px) 32px",
                containerType: "inline-size",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
                ...style,
            }}
        >
            <style>{`
                @keyframes panelBob-${uid} {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-9px); }
                    100% { transform: translateY(0px); }
                }
                @keyframes sweep-${uid} {
                    0% { transform: translateX(-140%) rotate(25deg); opacity: 0; }
                    18% { opacity: 0.32; }
                    45% { opacity: 0.06; }
                    100% { transform: translateX(180%) rotate(25deg); opacity: 0; }
                }
            `}</style>

            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth,
                    transform: panelTransform,
                    animation: canAnimate
                        ? `panelBob-${uid} ${7 - intensity * 2.5}s ease-in-out infinite`
                        : "none",
                    transition: "transform 220ms ease-out",
                    perspective: 900,
                    willChange: "transform",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        borderRadius: 28,
                        border: "1px solid rgba(255,255,255,0.24)",
                        background:
                            "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
                        boxShadow:
                            "0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.38)",
                        backdropFilter: `blur(${glassBlur}px)`,
                        WebkitBackdropFilter: `blur(${glassBlur}px)`,
                        padding: "30px 24px 24px",
                        overflow: "hidden",
                    }}
                >
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: "-40% auto -40% -30%",
                            width: "38%",
                            background:
                                "linear-gradient(120deg, transparent, rgba(255,255,255,0.28), transparent)",
                            animation: canAnimate
                                ? `sweep-${uid} 6.8s ease-in-out infinite`
                                : "none",
                            pointerEvents: "none",
                        }}
                    />
                    <h2
                        style={{
                            margin: 0,
                            color: "#FFFFFF",
                            fontSize: "clamp(26px, 8cqw, 34px)",
                            lineHeight: 1.04,
                            letterSpacing: "-0.03em",
                            fontWeight: 700,
                        }}
                    >
                        {heading}
                    </h2>
                    <p
                        style={{
                            margin: "12px 0 22px",
                            color: "rgba(255,255,255,0.78)",
                            fontSize: "clamp(14px, 3.6cqw, 15px)",
                            lineHeight: 1.5,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {subheading}
                    </p>

                    {safeFields.length > 0 && (
                        <form
                            onSubmit={handleSubmit}
                            style={{ display: "grid", gap: 14 }}
                            noValidate
                        >
                            {safeFields.map((field) => {
                                const value = values[field.name] || ""
                                const lifted =
                                    focusedField === field.name ||
                                    value.length > 0
                                const invalid = !!errors[field.name]
                                const sharedFieldStyle: CSSProperties = {
                                    width: "100%",
                                    borderRadius: 14,
                                    border: `1px solid ${invalid ? "rgba(255,82,82,0.8)" : "rgba(255,255,255,0.22)"}`,
                                    background: "rgba(3,7,18,0.45)",
                                    color: "#FFFFFF",
                                    outline: "none",
                                    fontSize: 15,
                                    boxShadow:
                                        focusedField === field.name
                                            ? "0 0 0 3px rgba(99,102,241,0.20), inset 0 0 0 1px rgba(255,255,255,0.35)"
                                            : "inset 0 1px 0 rgba(255,255,255,0.08)",
                                    transition: "all 220ms ease",
                                    boxSizing: "border-box",
                                }
                                return (
                                    <label
                                        key={field.name}
                                        style={{
                                            position: "relative",
                                            display: "block",
                                        }}
                                    >
                                        {field.type === "textarea" ? (
                                            <textarea
                                                value={value}
                                                onChange={(e) =>
                                                    handleInputChange(
                                                        field.name,
                                                        e.target.value
                                                    )
                                                }
                                                onFocus={() =>
                                                    setFocusedField(field.name)
                                                }
                                                onBlur={() =>
                                                    setFocusedField(null)
                                                }
                                                required={field.required}
                                                rows={4}
                                                aria-invalid={invalid}
                                                style={{
                                                    ...sharedFieldStyle,
                                                    resize: "vertical",
                                                    minHeight: 112,
                                                    lineHeight: 1.45,
                                                    padding: "22px 14px 12px",
                                                }}
                                            />
                                        ) : (
                                            <input
                                                type={field.type}
                                                value={value}
                                                onChange={(e) =>
                                                    handleInputChange(
                                                        field.name,
                                                        e.target.value
                                                    )
                                                }
                                                onFocus={() =>
                                                    setFocusedField(field.name)
                                                }
                                                onBlur={() =>
                                                    setFocusedField(null)
                                                }
                                                required={field.required}
                                                aria-invalid={invalid}
                                                style={{
                                                    ...sharedFieldStyle,
                                                    height: 56,
                                                    lineHeight: 1,
                                                    padding: "22px 14px 10px",
                                                }}
                                            />
                                        )}
                                        <span
                                            style={{
                                                position: "absolute",
                                                left: 14,
                                                top: lifted ? 8 : 18,
                                                fontSize: lifted ? 11 : 14,
                                                letterSpacing: "-0.01em",
                                                color: lifted
                                                    ? "rgba(180,189,255,0.96)"
                                                    : "rgba(255,255,255,0.62)",
                                                pointerEvents: "none",
                                                transition: "all 180ms ease",
                                            }}
                                        >
                                            {field.label}
                                        </span>
                                        <span
                                            aria-hidden
                                            style={{
                                                position: "absolute",
                                                left: 12,
                                                right: 12,
                                                bottom: 6,
                                                height: 2,
                                                borderRadius: 999,
                                                background:
                                                    focusedField === field.name
                                                        ? "linear-gradient(90deg, rgba(99,102,241,0), rgba(99,102,241,0.9), rgba(236,72,153,0.9), rgba(236,72,153,0))"
                                                        : "transparent",
                                                transform:
                                                    focusedField === field.name
                                                        ? "scaleX(1)"
                                                        : "scaleX(0.65)",
                                                opacity:
                                                    focusedField === field.name
                                                        ? 1
                                                        : 0,
                                                transition: "all 220ms ease",
                                                pointerEvents: "none",
                                            }}
                                        />
                                    </label>
                                )
                            })}

                            <button
                                type="submit"
                                aria-label="Submit contact form"
                                style={{
                                    marginTop: 4,
                                    height: 52,
                                    borderRadius: 14,
                                    border: "1px solid rgba(255,255,255,0.25)",
                                    background: buttonGradient,
                                    color: "#FFFFFF",
                                    fontSize: 14,
                                    letterSpacing: "-0.01em",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    position: "relative",
                                    overflow: "hidden",
                                    boxShadow:
                                        "0 14px 34px rgba(124,58,237,0.35)",
                                }}
                            >
                                <span
                                    style={{
                                        position: "relative",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    {submitted ? (
                                        <>
                                            <span aria-hidden>{"✓"}</span>
                                            <span>Sent</span>
                                        </>
                                    ) : (
                                        "Send Message"
                                    )}
                                </span>
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {hasStrip && (
                <div
                    style={{
                        width: "100%",
                        maxWidth: 760,
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.04)",
                        backdropFilter: `blur(${Math.max(6, glassBlur * 0.55)}px)`,
                        WebkitBackdropFilter: `blur(${Math.max(6, glassBlur * 0.55)}px)`,
                        boxShadow: "0 16px 44px rgba(0,0,0,0.35)",
                        padding: "12px 14px",
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        boxSizing: "border-box",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 10,
                            flex: "1 1 360px",
                        }}
                    >
                        {(contactStrip || []).map((item, i) => {
                            const content: ReactNode = (
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        borderRadius: 999,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(255,255,255,0.04)",
                                        padding: "8px 10px",
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.82)",
                                    }}
                                >
                                    <strong
                                        style={{
                                            fontWeight: 600,
                                            color: "#FFFFFF",
                                        }}
                                    >
                                        {item.label}:
                                    </strong>{" "}
                                    {item.value}
                                </span>
                            )
                            if (item.href) {
                                return (
                                    <a
                                        key={`${item.label}-${i}`}
                                        href={item.href}
                                        style={{ textDecoration: "none" }}
                                        aria-label={`${item.label} ${item.value}`}
                                    >
                                        {content}
                                    </a>
                                )
                            }
                            return (
                                <div key={`${item.label}-${i}`}>{content}</div>
                            )
                        })}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flex: "0 0 auto",
                        }}
                    >
                        {(socialIcons || []).map((item, i) => (
                            <a
                                key={`${item.label}-${i}`}
                                href={item.href || "#"}
                                aria-label={item.label}
                                title={item.label}
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 999,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "1px solid rgba(255,255,255,0.16)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "#FFFFFF",
                                    textDecoration: "none",
                                    transition:
                                        "transform 170ms ease, box-shadow 170ms ease, background 170ms ease",
                                    boxShadow: "0 0 0 rgba(124,58,237,0)",
                                }}
                                onMouseEnter={(e) => {
                                    if (!reducedMotion) {
                                        e.currentTarget.style.transform =
                                            "scale(1.12)"
                                        e.currentTarget.style.boxShadow =
                                            "0 0 16px rgba(124,58,237,0.5)"
                                        e.currentTarget.style.background =
                                            "rgba(124,58,237,0.24)"
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "scale(1)"
                                    e.currentTarget.style.boxShadow =
                                        "0 0 0 rgba(124,58,237,0)"
                                    e.currentTarget.style.background =
                                        "rgba(255,255,255,0.06)"
                                }}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    aria-hidden
                                >
                                    <path
                                        d={
                                            item.svgPath ||
                                            iconPathFor(item.iconName)
                                        }
                                    />
                                </svg>
                            </a>
                        ))}
                    </div>
                </div>
            )}
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
