import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Bienvenida del onboarding (ADR 0025, design D2 de app-animations): el stock baja, aparece la
// alerta, sale la orden y el stock se repone. El último cuadro es igual al primero, así el WebP
// hace loop sin salto. Sin texto: las palabras van en la pantalla, no en la imagen.

export type Colores = {
  brand: string;
  onBrand: string;
  t1: string;
  t2: string;
  card: string;
  line: string;
  ok: string;
  warn: string;
  crit: string;
  whatsapp: string;
  onWhatsapp: string;
  suave: string;
  trazo: string;
};

export type PropsBienvenida = { tema: "claro" | "oscuro"; colores: Colores };

const suave = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Alturas de las barras (0–1): la cuarta es el producto que se queda sin stock.
const ALTURAS = [0.55, 0.8, 0.65, 0.9, 0.45];

export const Bienvenida: React.FC<PropsBienvenida> = ({ colores }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // La barra 4 baja entre 0,3 s y 1,6 s y se repone entre 4,6 s y 5,6 s.
  const nivel = interpolate(
    frame,
    [0.3 * fps, 1.6 * fps, 4.6 * fps, 5.6 * fps],
    [ALTURAS[3], 0.08, 0.08, ALTURAS[3]],
    { ...clamp, easing: suave },
  );
  const bajo = nivel < 0.3;

  return (
    <AbsoluteFill
      style={{ background: "transparent", fontFamily: "system-ui, sans-serif" }}
    >
      {/* Tarjeta del inventario con las barras */}
      <div
        style={{
          position: "absolute",
          left: 24,
          top: 40,
          width: 196,
          height: 160,
          borderRadius: 20,
          background: colores.card,
          border: `2px solid ${colores.line}`,
          boxShadow: "0 10px 24px -14px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 16,
            width: 70,
            height: 8,
            borderRadius: 4,
            background: colores.t2,
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 18,
            bottom: 18,
            right: 18,
            height: 100,
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          {ALTURAS.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${(i === 3 ? nivel : h) * 100}%`,
                borderRadius: 6,
                background: i === 3 && bajo ? colores.crit : colores.brand,
                opacity: i === 3 ? 1 : 0.55,
              }}
            />
          ))}
        </div>
      </div>

      {/* Escena 2: aparece la alerta de reposición (1,6 s – 4,2 s) */}
      <Sequence from={1.6 * fps} durationInFrames={2.6 * fps} premountFor={fps}>
        <Alerta colores={colores} />
      </Sequence>

      {/* Escena 3: sale la orden por WhatsApp (3 s – 5,4 s) */}
      <Sequence from={3 * fps} durationInFrames={2.4 * fps} premountFor={fps}>
        <Orden colores={colores} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Alerta: React.FC<{ colores: Colores }> = ({ colores }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fin = 2.6 * fps;
  return (
    <div
      style={{
        position: "absolute",
        left: 180,
        top: 28,
        width: 64,
        height: 64,
        borderRadius: 32,
        background: colores.card,
        border: `2px solid ${colores.crit}`,
        display: "grid",
        placeItems: "center",
        boxShadow: "0 10px 24px -12px rgba(0,0,0,0.5)",
        scale: interpolate(frame, [0, 0.4 * fps], [0.4, 1], {
          ...clamp,
          easing: Easing.spring({ damping: 12 }),
          output: "perceptual-scale",
        }),
        opacity: interpolate(
          frame,
          [0, 0.2 * fps, fin - 0.4 * fps, fin],
          [0, 1, 1, 0],
          clamp,
        ),
        rotate: interpolate(
          frame,
          [0.3 * fps, 0.5 * fps, 0.7 * fps, 0.9 * fps, 1.1 * fps],
          ["0deg", "12deg", "-10deg", "6deg", "0deg"],
          clamp,
        ),
      }}
    >
      {/* Campana simplificada */}
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <path
          d="M9 23c0-8 2-14 8-14s8 6 8 14l2 2H7l2-2Z"
          fill={colores.suave}
          stroke={colores.crit}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M14 28a3 3 0 0 0 6 0"
          stroke={colores.crit}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="17" cy="7" r="2" fill={colores.crit} />
      </svg>
    </div>
  );
};

const Orden: React.FC<{ colores: Colores }> = ({ colores }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fin = 2.4 * fps;
  return (
    <div
      style={{
        position: "absolute",
        left: 196,
        top: 112,
        width: 140,
        height: 72,
        borderRadius: 18,
        background: colores.card,
        border: `2px solid ${colores.line}`,
        boxShadow: "0 12px 26px -14px rgba(0,0,0,0.5)",
        translate: interpolate(frame, [0, 0.5 * fps], ["40px 0px", "0px 0px"], {
          ...clamp,
          easing: suave,
        }),
        opacity: interpolate(
          frame,
          [0, 0.3 * fps, fin - 0.4 * fps, fin],
          [0, 1, 1, 0],
          clamp,
        ),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 16,
          width: 64,
          height: 8,
          borderRadius: 4,
          background: colores.t2,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 32,
          width: 44,
          height: 8,
          borderRadius: 4,
          background: colores.t2,
          opacity: 0.35,
        }}
      />
      {/* Botón de WhatsApp que se "toca" y pasa a enviado */}
      <div
        style={{
          position: "absolute",
          right: 12,
          top: 18,
          width: 36,
          height: 36,
          borderRadius: 18,
          background: colores.whatsapp,
          display: "grid",
          placeItems: "center",
          scale: interpolate(
            frame,
            [0.8 * fps, 0.95 * fps, 1.1 * fps],
            [1, 0.86, 1],
            clamp,
          ),
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M5 10.5l3.2 3.2L15 6.8"
            stroke={colores.onWhatsapp}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="16"
            strokeDashoffset={interpolate(
              frame,
              [1 * fps, 1.4 * fps],
              [16, 0],
              { ...clamp, easing: suave },
            )}
          />
        </svg>
      </div>
    </div>
  );
};
