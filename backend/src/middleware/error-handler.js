export function notFound(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
}
