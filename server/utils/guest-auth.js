const { getDb } = require('../db');
const { getConfig } = require('./config');

function isConfigEnabled(key) {
  return getConfig(key) === 'true';
}

function getHackClubClientId() {
  return process.env.HACKCLUB_CLIENT_ID || process.env.HC_CLIENT_ID || '';
}

function getHackClubClientSecret() {
  return process.env.HACKCLUB_CLIENT_SECRET || process.env.HC_CLIENT_SECRET || '';
}

function isGithubOAuthConfigured() {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function isHackClubOAuthConfigured() {
  return !!(getHackClubClientId() && getHackClubClientSecret());
}

function getGuestAuthRequirements(fingerprint) {
  const requireGithubAuth = isConfigEnabled('require_github_auth');
  const requireHackClubAuth =
    isConfigEnabled('require_hackclub_auth') || isConfigEnabled('require_hc_auth');

  const hasGithubAuth = !!fingerprint?.github_id;
  const hasHackClubAuth = !!fingerprint?.hackclub_id;

  const needsGithubAuth = requireGithubAuth && !hasGithubAuth;
  const needsHackClubAuth = requireHackClubAuth && !hasHackClubAuth;

  return {
    requireGithubAuth,
    requireHackClubAuth,
    hasGithubAuth,
    hasHackClubAuth,
    needsGithubAuth,
    needsHackClubAuth,
    authRequired: needsGithubAuth || needsHackClubAuth,
    githubOAuthConfigured: isGithubOAuthConfigured(),
    hackClubOAuthConfigured: isHackClubOAuthConfigured()
  };
}

function getFingerprintIdFromRequest(req) {
  return req.body?.fingerprint_id || req.query?.fingerprint_id || req.cookies?.fingerprint_id || null;
}

function getFingerprintFromRequest(req) {
  const fingerprintId = getFingerprintIdFromRequest(req);
  if (!fingerprintId) {
    return null;
  }

  const db = getDb();
  return db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId) || null;
}

function sendAuthRequiredResponse(res, requirements) {
  const missingProviders = [];
  const unconfiguredProviders = [];

  if (requirements.needsGithubAuth) {
    missingProviders.push('GitHub');
    if (!requirements.githubOAuthConfigured) {
      unconfiguredProviders.push('GitHub');
    }
  }

  if (requirements.needsHackClubAuth) {
    missingProviders.push('Hack Club');
    if (!requirements.hackClubOAuthConfigured) {
      unconfiguredProviders.push('Hack Club');
    }
  }

  if (unconfiguredProviders.length > 0) {
    return res.status(503).json({
      error: `${unconfiguredProviders.join(' and ')} OAuth is not configured, but auth enforcement is enabled.`,
      requires_github_auth: requirements.needsGithubAuth,
      requires_hackclub_auth: requirements.needsHackClubAuth,
      github_oauth_configured: requirements.githubOAuthConfigured,
      hackclub_oauth_configured: requirements.hackClubOAuthConfigured
    });
  }

  return res.status(401).json({
    error: `${missingProviders.join(' and ')} authentication required.`,
    requires_github_auth: requirements.needsGithubAuth,
    requires_hackclub_auth: requirements.needsHackClubAuth,
    github_oauth_configured: requirements.githubOAuthConfigured,
    hackclub_oauth_configured: requirements.hackClubOAuthConfigured
  });
}

function enforceGuestAuth(res, fingerprint) {
  const requirements = getGuestAuthRequirements(fingerprint);
  if (!requirements.authRequired) {
    return false;
  }

  sendAuthRequiredResponse(res, requirements);
  return true;
}

function enforceGuestAuthForRequest(req, res) {
  const fingerprint = getFingerprintFromRequest(req);
  return enforceGuestAuth(res, fingerprint);
}

module.exports = {
  getHackClubClientId,
  getHackClubClientSecret,
  isGithubOAuthConfigured,
  isHackClubOAuthConfigured,
  getGuestAuthRequirements,
  getFingerprintIdFromRequest,
  getFingerprintFromRequest,
  sendAuthRequiredResponse,
  enforceGuestAuth,
  enforceGuestAuthForRequest
};
