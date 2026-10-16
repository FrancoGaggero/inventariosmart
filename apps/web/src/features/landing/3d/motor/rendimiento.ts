// Vigila el ritmo de cuadros mientras la escena se mueve (landing-3d D2): si el promedio pasa 1,5
// veces el presupuesto, primero baja la resolución y, si sigue lento, pide la imagen fija.

export type Ajuste = 'nada' | 'bajarResolucion' | 'degradar';

export class MonitorDeCuadros {
  private muestras: number[] = [];
  private bajada = false;

  constructor(
    private readonly presupuesto: number,
    private readonly tamano = 60,
  ) {}

  /** Registra los segundos de un cuadro seguido de otro; los saltos por pausas no cuentan. */
  medir(dt: number): Ajuste {
    if (dt <= 0 || dt > 0.25) return 'nada';
    this.muestras.push(dt);
    if (this.muestras.length < this.tamano) return 'nada';
    const promedio = this.muestras.reduce((a, b) => a + b, 0) / this.muestras.length;
    this.muestras = [];
    if (promedio <= this.presupuesto * 1.5) return 'nada';
    if (!this.bajada) {
      this.bajada = true;
      return 'bajarResolucion';
    }
    return 'degradar';
  }
}
