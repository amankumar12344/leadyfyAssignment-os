function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated.' });
    }

    // OWNER has full system-wide access
    if (req.user.role === 'OWNER') {
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Access denied. Role '${req.user.role}' lacks permission for this resource.`
    });
  };
}

function requireSubRole(allowedSubRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated.' });
    }

    // OWNER and ADMIN / OPERATIONS_MANAGER have operational override
    if (req.user.role === 'OWNER' || req.user.role === 'ADMIN') {
      return next();
    }

    if (allowedSubRoles.includes(req.user.sub_role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Access denied. Sub-role '${req.user.sub_role}' lacks permission for this action.`
    });
  };
}

module.exports = {
  requireRole,
  requireSubRole
};
