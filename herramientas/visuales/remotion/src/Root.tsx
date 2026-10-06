import { Composition } from "remotion";
import { Bienvenida, type PropsBienvenida } from "./Bienvenida";

// Colores por defecto (tema oscuro) para Studio; exportar.mjs pasa los de cada tema con --props.
const oscuro: PropsBienvenida = {
  tema: "oscuro",
  colores: {
    brand: "#e0a54a",
    onBrand: "#1f1a14",
    t1: "#f3ece1",
    t2: "#b8ac99",
    card: "#1e1a15",
    line: "rgba(243,236,225,0.08)",
    ok: "#5bb585",
    warn: "#e5824a",
    crit: "#e5574f",
    whatsapp: "#25d366",
    onWhatsapp: "#062b14",
    suave: "rgba(224,165,74,0.18)",
    trazo: "#f0c07a",
  },
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Bienvenida"
      component={Bienvenida}
      durationInFrames={180}
      fps={30}
      width={360}
      height={240}
      defaultProps={oscuro}
    />
  );
};
