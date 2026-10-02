/// Datos de una lista ya cargada más el estado de la página siguiente ("Cargar más").
class Acumulado<T> {
  const Acumulado(this.datos, {this.cargandoMas = false, this.errorMas});

  final T datos;
  final bool cargandoMas;
  final String? errorMas;

  Acumulado<T> cargando() => Acumulado(datos, cargandoMas: true);

  Acumulado<T> conError(String mensaje) => Acumulado(datos, errorMas: mensaje);
}
