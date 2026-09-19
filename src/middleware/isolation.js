function enforceClientIsolation(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthenticated.' });
  }

  // If user is a CLIENT, enforce scoping
  if (req.user.role === 'CLIENT') {
    if (!req.user.clientId) {
      return res.status(403).json({ success: false, error: 'Client account not linked to a client organization.' });
    }

    // If request contains clientId or client_id in params or body or query, verify match
    const targetClientId = req.params.clientId || req.params.id || req.query.client_id || req.body.client_id;
    if (targetClientId && String(targetClientId) !== String(req.user.clientId)) {
      return res.status(403).json({
        success: false,
        error: 'Security Alert: Access forbidden. You cannot access resources belonging to another client.'
      });
    }

    // Force query filter to own clientId
    req.scopedClientId = req.user.clientId;
  }

  next();
}

function blockClientFromInternal(req, res, next) {
  if (req.user && req.user.role === 'CLIENT') {
    return res.status(403).json({
      success: false,
      error: 'Security Alert: Access forbidden. Clients cannot access internal agency operations data.'
    });
  }
  next();
}

module.exports = {
  enforceClientIsolation,
  blockClientFromInternal
};
