/**
 * Role-Based Access Control (RBAC) Middleware
 */

/**
 * Authorize middleware - checks if user has required role
 * @param {Array} allowedRoles - Array of roles that can access the route
 */
export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
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
