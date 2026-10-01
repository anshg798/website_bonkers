// Fluid Input — a single-line text input over a live WebGL Navier-Stokes fluid simulation. Typing,
// pointer movement, focus and submit inject dye/velocity splats. Falls back to a plain input when
// WebGL is unavailable or reduced motion is preferred.
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ChangeEvent,
    type FormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";

export interface FluidInputProps {
    /** Placeholder text. Default "Type something…". */
    placeholder?: string;
    /** Initial / controlled value. Default "". */
    value?: string;
    /** Text color. Default "#F5F7FF". */
    textColor?: string;
    /** Placeholder color. Default "#8B909E". */
    placeholderColor?: string;
    /** Background color. Default "#050505". */
    backgroundColor?: string;
    /** Dye color. Default "#22D3EE". */
    dyeColor?: string;
    /** Accent color. Default "#FF8A65". */
    accentColor?: string;
    /** Corner radius in px. Default 12. */
    cornerRadius?: number;
    /** Border color. Default "#EEEEEE". */
    borderColor?: string;
    /** Border width in px. Default 1. */
    borderWidth?: number;
    /** Font size in px. Default 18. */
    fontSize?: number;
    /** Font family. Default "Inter, sans-serif". */
    fontFamily?: string;
    /** Splat radius (normalized). Default 0.02. */
    splatRadius?: number;
    /** Impulse strength. Default 2800. */
    impulseStrength?: number;
    /** Simulation resolution. Default 128. */
    simResolution?: number;
    /** Dye dissipation. Default 0.985. */
    dissipation?: number;
    /** Velocity dissipation. Default 0.99. */
    velocityDissipation?: number;
    /** Fires with the value on change. */
    onValueChange?: (value: string) => void;
    /** Fires on submit (Enter). */
    onSubmit?: () => void;
    style?: CSSProperties;
}

interface Size { width: number; height: number; }
interface SplatEvent { x: number; y: number; dx: number; dy: number; radius: number; color: [number, number, number]; velocityOnly?: boolean; }
interface FluidSystem {
    step: (dt: number, warmth: number, bg: [number, number, number], accent: [number, number, number]) => void;
    splat: (event: SplatEvent) => void;
    dispose: () => void;
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = 0.5 * (aPosition + 1.0);
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
const CLEAR_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
void main() { gl_FragColor = value * texture2D(uTexture, vUv); }
`;
const SPLAT_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main() {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 base = texture2D(uTarget, vUv).xyz;
    float splat = exp(-dot(p, p) / max(0.00001, radius));
    gl_FragColor = vec4(base + splat * color, 1.0);
}
`;
const ADVECTION_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
void main() {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec3 result = texture2D(uSource, coord).xyz;
    gl_FragColor = vec4(result * dissipation, 1.0);
}
`;
const DIVERGENCE_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
void main() {
    float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).y;
    float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
`;
const PRESSURE_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 texelSize;
void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float div = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - div) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;
const GRADIENT_SUBTRACT_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity -= vec2(R - L, T - B) * 0.5;
    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;
const DISPLAY_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uDye;
uniform vec3 uBackground;
uniform vec3 uAccent;
uniform float uWarmth;
void main() {
    vec3 dye = texture2D(uDye, vUv).rgb;
    dye = pow(max(dye, vec3(0.0)), vec3(0.82)) * 1.65;
    float focusBoost = 1.0 + clamp(uWarmth, 0.0, 1.0) * 0.35;
    vec3 color = uBackground + dye * focusBoost;
    color = vec3(1.0) - exp(-color * 1.8);
    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
}
`;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function colorToRGB(color: string, fallback: [number, number, number]): [number, number, number] {
    if (typeof document === "undefined") return fallback;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return fallback;
    context.fillStyle = color;
    const normalized = context.fillStyle;
    const match = normalized.match(/\d+(\.\d+)?/g);
    if (!match || match.length < 3) return fallback;
    return [clamp(Number(match[0]) / 255, 0, 1), clamp(Number(match[1]) / 255, 0, 1), clamp(Number(match[2]) / 255, 0, 1)];
}

function createFluidSystem(canvas: HTMLCanvasElement, simResolution: number, dissipation: number, velocityDissipation: number): FluidSystem | null {
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false });
    if (!gl) return null;

    const extHalfFloat = gl.getExtension("OES_texture_half_float");
    const extFloat = gl.getExtension("OES_texture_float");
    const extLinearHalfFloat = gl.getExtension("OES_texture_half_float_linear");
    const extLinearFloat = gl.getExtension("OES_texture_float_linear");
    const canLinearFloat = Boolean(extLinearHalfFloat || extLinearFloat);

    const supportsType = (type: number, filter: number) => {
        const t = gl.createTexture();
        const fb = gl.createFramebuffer();
        if (!t || !fb) return false;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, type, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.deleteTexture(t);
        gl.deleteFramebuffer(fb);
        return ok;
    };

    const candidates: Array<{ type: number; filter: number }> = [];
    if (extHalfFloat) candidates.push({ type: extHalfFloat.HALF_FLOAT_OES, filter: canLinearFloat ? gl.LINEAR : gl.NEAREST });
    if (extFloat) candidates.push({ type: gl.FLOAT, filter: canLinearFloat ? gl.LINEAR : gl.NEAREST });
    candidates.push({ type: gl.UNSIGNED_BYTE, filter: gl.LINEAR });
    candidates.push({ type: gl.UNSIGNED_BYTE, filter: gl.NEAREST });

    const selected = candidates.find((candidate) => supportsType(candidate.type, candidate.filter)) ?? candidates[candidates.length - 1];
    const finalType = selected.type;
    const filter = selected.filter;

    const width = Math.max(16, Math.floor(simResolution));
    const height = Math.max(16, Math.floor(simResolution));

    const compile = (type: number, source: string): WebGLShader | null => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
        return shader;
    };

    const createProgram = (fragment: string): WebGLProgram | null => {
        const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = compile(gl.FRAGMENT_SHADER, fragment);
        if (!vs || !fs) return null;
        const program = gl.createProgram();
        if (!program) return null;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
        return program;
    };

    const resources = { textures: [] as WebGLTexture[], framebuffers: [] as WebGLFramebuffer[], programs: [] as WebGLProgram[] };

    const programs = {
        clear: createProgram(CLEAR_SHADER),
        splat: createProgram(SPLAT_SHADER),
        advection: createProgram(ADVECTION_SHADER),
        divergence: createProgram(DIVERGENCE_SHADER),
        pressure: createProgram(PRESSURE_SHADER),
        gradient: createProgram(GRADIENT_SUBTRACT_SHADER),
        display: createProgram(DISPLAY_SHADER),
    };
    if (Object.values(programs).some((p) => !p)) return null;
    resources.programs = Object.values(programs) as WebGLProgram[];

    const quad = gl.createBuffer();
    if (!quad) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const setupProgram = (program: WebGLProgram): number => {
        gl.useProgram(program);
        const location = gl.getAttribLocation(program, "aPosition");
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        return location;
    };
    Object.values(programs).forEach((program) => setupProgram(program as WebGLProgram));

    const createTarget = () => {
        const texture = gl.createTexture();
        const fbo = gl.createFramebuffer();
        if (!texture || !fbo) return null;
        resources.textures.push(texture);
        resources.framebuffers.push(fbo);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, finalType, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return { texture, fbo };
    };

    const createDouble = () => {
        const read = createTarget();
        const write = createTarget();
        if (!read || !write) return null;
        return {
            read,
            write,
            swap() { const r = this.read; this.read = this.write; this.write = r; },
        };
    };

    const velocity = createDouble();
    const dye = createDouble();
    const pressure = createDouble();
    const divergence = createTarget();
    if (!velocity || !dye || !pressure || !divergence) return null;

    const blit = (target: WebGLFramebuffer | null, w: number, h: number) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, w, h);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const bindTexture = (unit: number, texture: WebGLTexture | null, uniform: WebGLUniformLocation | null) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        if (uniform) gl.uniform1i(uniform, unit);
    };

    const texelSize: [number, number] = [1 / width, 1 / height];
    const p = programs as Record<string, WebGLProgram>;

    const splat = (event: SplatEvent) => {
        gl.disable(gl.BLEND);
        gl.useProgram(p.splat);
        gl.uniform1f(gl.getUniformLocation(p.splat, "aspectRatio"), width / height);
        gl.uniform2f(gl.getUniformLocation(p.splat, "point"), event.x, event.y);
        gl.uniform1f(gl.getUniformLocation(p.splat, "radius"), event.radius);
        gl.uniform3f(gl.getUniformLocation(p.splat, "color"), event.dx, -event.dy, 0);
        bindTexture(0, velocity.read.texture, gl.getUniformLocation(p.splat, "uTarget"));
        blit(velocity.write.fbo, width, height);
        velocity.swap();

        if (!event.velocityOnly) {
            gl.uniform3f(gl.getUniformLocation(p.splat, "color"), event.color[0], event.color[1], event.color[2]);
            bindTexture(0, dye.read.texture, gl.getUniformLocation(p.splat, "uTarget"));
            blit(dye.write.fbo, width, height);
            dye.swap();
        }
    };

    const step = (dt: number, warmth: number, bg: [number, number, number], accent: [number, number, number]) => {
        gl.disable(gl.BLEND);

        gl.useProgram(p.advection);
        gl.uniform2f(gl.getUniformLocation(p.advection, "texelSize"), texelSize[0], texelSize[1]);
        gl.uniform1f(gl.getUniformLocation(p.advection, "dt"), dt);
        gl.uniform1f(gl.getUniformLocation(p.advection, "dissipation"), clamp(velocityDissipation, 0.8, 1));
        bindTexture(0, velocity.read.texture, gl.getUniformLocation(p.advection, "uVelocity"));
        bindTexture(1, velocity.read.texture, gl.getUniformLocation(p.advection, "uSource"));
        blit(velocity.write.fbo, width, height);
        velocity.swap();

        gl.useProgram(p.divergence);
        gl.uniform2f(gl.getUniformLocation(p.divergence, "texelSize"), texelSize[0], texelSize[1]);
        bindTexture(0, velocity.read.texture, gl.getUniformLocation(p.divergence, "uVelocity"));
        blit(divergence.fbo, width, height);

        gl.useProgram(p.clear);
        gl.uniform1f(gl.getUniformLocation(p.clear, "value"), 0.98);
        bindTexture(0, pressure.read.texture, gl.getUniformLocation(p.clear, "uTexture"));
        blit(pressure.write.fbo, width, height);
        pressure.swap();

        gl.useProgram(p.pressure);
        gl.uniform2f(gl.getUniformLocation(p.pressure, "texelSize"), texelSize[0], texelSize[1]);
        bindTexture(1, divergence.texture, gl.getUniformLocation(p.pressure, "uDivergence"));
        for (let i = 0; i < 12; i += 1) {
            bindTexture(0, pressure.read.texture, gl.getUniformLocation(p.pressure, "uPressure"));
            blit(pressure.write.fbo, width, height);
            pressure.swap();
        }

        gl.useProgram(p.gradient);
        gl.uniform2f(gl.getUniformLocation(p.gradient, "texelSize"), texelSize[0], texelSize[1]);
        bindTexture(0, pressure.read.texture, gl.getUniformLocation(p.gradient, "uPressure"));
        bindTexture(1, velocity.read.texture, gl.getUniformLocation(p.gradient, "uVelocity"));
        blit(velocity.write.fbo, width, height);
        velocity.swap();

        gl.useProgram(p.advection);
        gl.uniform2f(gl.getUniformLocation(p.advection, "texelSize"), texelSize[0], texelSize[1]);
        gl.uniform1f(gl.getUniformLocation(p.advection, "dt"), dt);
        gl.uniform1f(gl.getUniformLocation(p.advection, "dissipation"), clamp(dissipation, 0.85, 1));
        bindTexture(0, velocity.read.texture, gl.getUniformLocation(p.advection, "uVelocity"));
        bindTexture(1, dye.read.texture, gl.getUniformLocation(p.advection, "uSource"));
        blit(dye.write.fbo, width, height);
        dye.swap();

        gl.useProgram(p.display);
        gl.uniform3f(gl.getUniformLocation(p.display, "uBackground"), bg[0], bg[1], bg[2]);
        gl.uniform3f(gl.getUniformLocation(p.display, "uAccent"), accent[0], accent[1], accent[2]);
        gl.uniform1f(gl.getUniformLocation(p.display, "uWarmth"), warmth);
        bindTexture(0, dye.read.texture, gl.getUniformLocation(p.display, "uDye"));
        blit(null, canvas.width, canvas.height);
    };

    const dispose = () => {
        resources.programs.forEach((program) => gl.deleteProgram(program));
        resources.textures.forEach((texture) => gl.deleteTexture(texture));
        resources.framebuffers.forEach((framebuffer) => gl.deleteFramebuffer(framebuffer));
        gl.deleteBuffer(quad);
    };

    return { step, splat, dispose };
}

export const FluidInput = (props: FluidInputProps) => {
    const {
        placeholder = "Type something…",
        value: initialValue = "",
        textColor = "#F5F7FF",
        placeholderColor = "#8B909E",
        backgroundColor = "#050505",
        dyeColor = "#22D3EE",
        accentColor = "#FF8A65",
        cornerRadius = 12,
        borderColor = "#EEEEEE",
        borderWidth = 1,
        fontSize = 18,
        fontFamily = "Inter, sans-serif",
        splatRadius = 0.02,
        impulseStrength = 2800,
        simResolution = 128,
        dissipation = 0.985,
        velocityDissipation = 0.99,
        onValueChange,
        onSubmit,
        style,
    } = props;

    const uid = useMemo(() => Math.random().toString(36).slice(2), []);
    const reduceMotion = usePrefersReducedMotion();
    const rootRef = useRef<HTMLFormElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const fluidRef = useRef<FluidSystem | null>(null);
    const splatsRef = useRef<SplatEvent[]>([]);
    const visibleRef = useRef(true);
    const focusedRef = useRef(false);
    const warmthRef = useRef(0);
    const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
    const pendingShockwaveRef = useRef<number | null>(null);
    const previousValueRef = useRef(initialValue);
    const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [value, setValue] = useState(initialValue);
    const [size, setSize] = useState<Size>({ width: 320, height: 64 });
    const [webglEnabled, setWebglEnabled] = useState(true);

    const parsedColors = useMemo(() => ({
        bg: colorToRGB(backgroundColor, [0.02, 0.02, 0.02]),
        dye: colorToRGB(dyeColor, [0.13, 0.83, 0.93]),
        accent: colorToRGB(accentColor, [1, 0.54, 0.4]),
    }), [backgroundColor, dyeColor, accentColor]);

    const textShadow = useMemo(() => `0 1px 2px rgba(0,0,0,0.7), 0 0 12px ${dyeColor}33`, [dyeColor]);

    const pushSplat = useCallback((event: SplatEvent) => {
        splatsRef.current.push(event);
        if (splatsRef.current.length > 40) splatsRef.current.shift();
    }, []);

    const submitValue = useCallback(() => {
        pendingShockwaveRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
        onSubmit?.();
    }, [onSubmit]);

    const measureCaretX = useCallback((nextValue: string, caretIndex: number) => {
        if (typeof document === "undefined") return size.width * 0.5;
        if (!measureCanvasRef.current) measureCanvasRef.current = document.createElement("canvas");
        const context = measureCanvasRef.current.getContext("2d");
        if (!context) return size.width * 0.5;
        context.font = `${fontSize}px ${fontFamily}`;
        const leftPadding = 18;
        const snippet = nextValue.slice(0, clamp(caretIndex, 0, nextValue.length));
        return clamp(leftPadding + context.measureText(snippet).width, 0, Math.max(leftPadding, size.width - leftPadding));
    }, [fontFamily, fontSize, size.width]);

    useEffect(() => {
        setValue(initialValue);
        previousValueRef.current = initialValue;
    }, [initialValue]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const target = rootRef.current;
        if (!target) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) });
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const target = rootRef.current;
        if (!target) return;
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            visibleRef.current = Boolean(entry?.isIntersecting);
        }, { threshold: 0.01 });
        observer.observe(target);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || reduceMotion) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(2, Math.floor(size.width * dpr));
        canvas.height = Math.max(2, Math.floor(size.height * dpr));
        canvas.style.width = `${size.width}px`;
        canvas.style.height = `${size.height}px`;

        fluidRef.current?.dispose();
        fluidRef.current = createFluidSystem(canvas, simResolution, dissipation, velocityDissipation);
        if (!fluidRef.current) { setWebglEnabled(false); return; }
        setWebglEnabled(true);

        let lastTime = performance.now();
        const loop = (time: number) => {
            rafRef.current = window.requestAnimationFrame(loop);
            const isDocumentVisible = typeof document === "undefined" ? true : document.visibilityState === "visible";
            if ((!visibleRef.current && !isDocumentVisible) || !fluidRef.current) return;
            const dt = clamp((time - lastTime) / 1000, 0.001, 0.033);
            lastTime = time;

            const targetWarmth = focusedRef.current ? 1 : 0;
            warmthRef.current += (targetWarmth - warmthRef.current) * 0.08;

            while (splatsRef.current.length > 0) {
                const event = splatsRef.current.shift();
                if (event) fluidRef.current.splat(event);
            }

            if (pendingShockwaveRef.current !== null) {
                const elapsed = (time - pendingShockwaveRef.current) / 600;
                if (elapsed >= 1) {
                    pendingShockwaveRef.current = null;
                } else {
                    fluidRef.current.splat({
                        x: clamp(elapsed, 0, 1),
                        y: 0.5,
                        dx: impulseStrength * 0.0009,
                        dy: Math.sin(elapsed * Math.PI * 8) * impulseStrength * 0.0002,
                        radius: splatRadius * 6,
                        color: parsedColors.dye,
                    });
                }
            }

            fluidRef.current.step(dt, warmthRef.current, parsedColors.bg, parsedColors.accent);
        };
        rafRef.current = window.requestAnimationFrame(loop);

        return () => {
            if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            fluidRef.current?.dispose();
            fluidRef.current = null;
        };
    }, [dissipation, impulseStrength, reduceMotion, parsedColors.accent, parsedColors.bg, parsedColors.dye, simResolution, size.height, size.width, splatRadius, velocityDissipation]);

    const injectCaretSplat = useCallback((nextValue: string, caret: number) => {
        const xPx = measureCaretX(nextValue, caret);
        const normalizedX = size.width <= 0 ? 0.5 : clamp(xPx / size.width, 0.02, 0.98);
        const spin = (Math.random() - 0.5) * 2;
        pushSplat({
            x: normalizedX,
            y: 0.5,
            dx: spin * impulseStrength * 0.0012,
            dy: impulseStrength * 0.001 * (Math.random() - 0.5),
            radius: Math.max(0.0008, splatRadius),
            color: parsedColors.dye,
        });
    }, [impulseStrength, measureCaretX, parsedColors.dye, pushSplat, size.width, splatRadius]);

    const setVal = useCallback((next: string) => { setValue(next); onValueChange?.(next); }, [onValueChange]);

    const onInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        const caret = event.target.selectionStart ?? next.length;
        const changed = previousValueRef.current !== next;
        previousValueRef.current = next;
        setVal(next);
        if (changed) injectCaretSplat(next, caret);
    }, [injectCaretSplat, setVal]);

    const onInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") { event.preventDefault(); submitValue(); return; }
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            const caret = event.currentTarget.selectionStart ?? value.length;
            const previewValue = `${value.slice(0, caret)}${event.key}${value.slice(caret)}`;
            injectCaretSplat(previewValue, caret + 1);
        }
    }, [injectCaretSplat, submitValue, value]);

    const onFormSubmit = useCallback((event: FormEvent<HTMLFormElement>) => { event.preventDefault(); submitValue(); }, [submitValue]);

    const stirAtPointer = useCallback((clientX: number, clientY: number, bounds: DOMRect) => {
        const x = clamp((clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1);
        const y = clamp((clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1);
        const prev = lastPointerRef.current;
        lastPointerRef.current = { x, y };
        if (!prev) return;
        const dx = (x - prev.x) * impulseStrength * 0.18;
        const dy = (y - prev.y) * impulseStrength * 0.18;
        pushSplat({ x, y, dx, dy, radius: splatRadius * 0.75, color: parsedColors.dye, velocityOnly: false });
    }, [impulseStrength, parsedColors.dye, pushSplat, splatRadius]);

    const onPointerMove = useCallback((event: ReactPointerEvent<HTMLFormElement>) => {
        stirAtPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    }, [stirAtPointer]);

    const onInputPointerMove = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
        const bounds = rootRef.current?.getBoundingClientRect();
        if (!bounds) return;
        stirAtPointer(event.clientX, event.clientY, bounds);
    }, [stirAtPointer]);

    const containerStyle: CSSProperties = useMemo(() => ({
        position: "relative",
        width: "100%",
        height: 64,
        minWidth: 120,
        minHeight: 44,
        borderRadius: cornerRadius,
        overflow: "hidden",
        border: `${Math.max(0, borderWidth)}px solid ${borderColor}`,
        backgroundColor,
        boxSizing: "border-box",
        ...style,
    }), [backgroundColor, borderColor, borderWidth, cornerRadius, style]);

    const inputStyle: CSSProperties = useMemo(() => ({
        position: "relative",
        zIndex: 2,
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        background: "transparent",
        color: textColor,
        fontSize,
        fontFamily,
        padding: "0 18px",
        boxSizing: "border-box",
        textShadow,
        caretColor: textColor,
    }), [fontFamily, fontSize, textColor, textShadow]);

    if (reduceMotion || !webglEnabled) {
        return (
            <form ref={rootRef} onSubmit={onFormSubmit} style={containerStyle}>
                <input
                    ref={inputRef}
                    aria-label={placeholder || "Fluid input"}
                    type="text"
                    value={value}
                    onChange={onInputChange}
                    onKeyDown={onInputKeyDown}
                    onFocus={() => { focusedRef.current = true; }}
                    onBlur={() => { focusedRef.current = false; }}
                    placeholder={placeholder}
                    style={{ ...inputStyle, backgroundColor }}
                    className={`fluid-input-${uid}`}
                />
                <style>{`.fluid-input-${uid}::placeholder { color: ${placeholderColor}; }`}</style>
            </form>
        );
    }

    return (
        <form ref={rootRef} onSubmit={onFormSubmit} style={containerStyle} onPointerMove={onPointerMove}>
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, display: "block" }} aria-hidden="true" />
            <input
                ref={inputRef}
                aria-label={placeholder || "Fluid input"}
                type="text"
                value={value}
                onChange={onInputChange}
                onKeyDown={onInputKeyDown}
                onFocus={() => { focusedRef.current = true; }}
                onBlur={() => { focusedRef.current = false; }}
                onPointerMove={onInputPointerMove}
                placeholder={placeholder}
                style={inputStyle}
                className={`fluid-input-${uid}`}
            />
            <style>{`.fluid-input-${uid}::placeholder { color: ${placeholderColor}; }`}</style>
        </form>
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
