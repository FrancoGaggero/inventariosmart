-- CreateIndex: movimientos por comercio en el orden en que cambió el stock (HU-18, design D2).
-- Permite leer los últimos 90 días ordenados por creado_en sin recorrer el historial.
CREATE INDEX "movimiento_comercio_id_creado_en_id_idx" ON "movimiento"("comercio_id", "creado_en", "id");
