/**
 * Role-Based Access Control (RBAC) Middleware
 */

/**
 * Authorize middleware - checks if user has required role
 * @param {...string|string[]} allowedRoles - Roles that can access the route (variadic or array)
 */
export const authorize = (...allowedRoles) => {
  // Flatten in case an array is passed: authorize(['admin', 'io']) or authorize('admin', 'io')
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

export default {
  authorize
};
