// Centralized error handler middleware
export function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Terjadi kesalahan pada server.';
  res.status(status).json({ error: { code, message } });
}
