// Textos del inicio y de la barra superior (web-redesign, design D5): puros, en hora de Buenos Aires.

const ZONA = 'America/Argentina/Buenos_Aires';

const hora = new Intl.DateTimeFormat('es-AR', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: ZONA,
});
const partes = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: ZONA,
});

/** "Buen día" de 5 a 12 h, "Buenas tardes" de 12 a 20 h, "Buenas noches" el resto. */
export function saludo(ahora: Date = new Date()): string {
  const h = Number(hora.format(ahora));
  if (h >= 5 && h < 12) return 'Buen día';
  if (h >= 12 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** "jueves 2 de octubre". */
export function fechaLarga(ahora: Date = new Date()): string {
  const p = Object.fromEntries(partes.formatToParts(ahora).map((x) => [x.type, x.value]));
  return `${p['weekday']} ${p['day']} de ${p['month']}`;
}
