import jwt from 'jsonwebtoken';

/**
 * Middleware autentikasi khusus akun konsumen (pelanggan).
 * Memverifikasi Bearer token dengan payload { customerId, role: 'customer' }.
 */
export function requireCustomerAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Silakan masuk sebagai pelanggan terlebih dahulu.' },
    });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme_jwt_secret');
    if (payload.role !== 'customer' || !payload.customerId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Token tidak valid untuk akun pelanggan.' },
      });
    }
    req.customerId = payload.customerId;
    next();
  } catch {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Sesi pelanggan tidak valid atau sudah kadaluarsa.' },
    });
  }
}

