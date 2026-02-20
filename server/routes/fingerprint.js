const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { getConfig } = require('../utils/config');
const { getGuestAuthRequirements, sendAuthRequiredResponse } = require('../utils/guest-auth');

const router = express.Router();

// Generate or retrieve fingerprint
router.post('/generate', (req, res) => {
  const db = getDb();
  const fingerprintId = req.cookies.fingerprint_id || crypto.randomBytes(16).toString('hex');
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : null;
  const requireUsername = getConfig('require_username') === 'true';
  
  // Check if fingerprint exists
  const existing = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  const provisionalFingerprint = existing || { username, github_id: null, hackclub_id: null };
  const provisionalAuth = getGuestAuthRequirements(provisionalFingerprint);
  const authGateActive = provisionalAuth.authRequired;
  
  if (!existing) {
    // Create new fingerprint
    const now = Math.floor(Date.now() / 1000);
    
    // If username is required but not provided, return error (unless auth gate is active)
    if (requireUsername && !username && !authGateActive) {
      return res.status(400).json({ 
        error: 'Username is required',
        requires_username: true,
        requires_github_auth: provisionalAuth.needsGithubAuth,
        requires_hackclub_auth: provisionalAuth.needsHackClubAuth,
        github_oauth_configured: provisionalAuth.githubOAuthConfigured,
        hackclub_oauth_configured: provisionalAuth.hackClubOAuthConfigured
      });
    }
    
    db.prepare(`
      INSERT INTO fingerprints (id, first_seen, last_queue_attempt, cooldown_expires, status, username)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fingerprintId, now, null, null, 'active', username);
  } else {
    // Update username if provided and not already set
    if (username && !existing.username) {
      db.prepare('UPDATE fingerprints SET username = ? WHERE id = ?').run(username, fingerprintId);
    }
    
    // If username is required but not set, return error (unless auth gate is active)
    if (requireUsername && !existing.username && !username && !authGateActive) {
      return res.status(400).json({ 
        error: 'Username is required',
        requires_username: true,
        requires_github_auth: provisionalAuth.needsGithubAuth,
        requires_hackclub_auth: provisionalAuth.needsHackClubAuth,
        github_oauth_configured: provisionalAuth.githubOAuthConfigured,
        hackclub_oauth_configured: provisionalAuth.hackClubOAuthConfigured
      });
    }
  }
  
  res.cookie('fingerprint_id', fingerprintId, {
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    sameSite: 'lax'
  });
  
  const fingerprint = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  const authRequirements = getGuestAuthRequirements(fingerprint);
  res.json({ 
    fingerprint_id: fingerprintId,
    username: fingerprint.username,
    requires_username: requireUsername && !fingerprint.username && !authRequirements.authRequired,
    requires_github_auth: authRequirements.needsGithubAuth,
    requires_hackclub_auth: authRequirements.needsHackClubAuth,
    github_authenticated: authRequirements.hasGithubAuth,
    hackclub_authenticated: authRequirements.hasHackClubAuth,
    github_oauth_configured: authRequirements.githubOAuthConfigured,
    hackclub_oauth_configured: authRequirements.hackClubOAuthConfigured
  });
});

// Validate fingerprint
router.post('/validate', (req, res) => {
  const db = getDb();
  const fingerprintId = req.body.fingerprint_id || req.cookies.fingerprint_id;
  const requireUsername = getConfig('require_username') === 'true';
  
  if (!fingerprintId) {
    return res.status(400).json({ error: 'No fingerprint provided' });
  }
  
  const fingerprint = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  
  if (!fingerprint) {
    return res.status(400).json({ error: 'Invalid fingerprint' });
  }
  
  // Check if username is required but not set
  const authRequirements = getGuestAuthRequirements(fingerprint);
  if (authRequirements.authRequired) {
    return sendAuthRequiredResponse(res, authRequirements);
  }

  if (requireUsername && !fingerprint.username) {
    return res.status(400).json({ 
      error: 'Username is required',
      requires_username: true,
      requires_github_auth: authRequirements.needsGithubAuth,
      requires_hackclub_auth: authRequirements.needsHackClubAuth,
      github_oauth_configured: authRequirements.githubOAuthConfigured,
      hackclub_oauth_configured: authRequirements.hackClubOAuthConfigured
    });
  }
  
  if (fingerprint.status === 'blocked') {
    return res.status(403).json({ error: 'Device is blocked from queueing songs.' });
  }
  
  const now = Math.floor(Date.now() / 1000);
  const cooldownEnabled = getConfig('fingerprinting_enabled') === 'true';
  
  if (cooldownEnabled && fingerprint.cooldown_expires && fingerprint.cooldown_expires > now) {
    const remaining = fingerprint.cooldown_expires - now;
    return res.status(429).json({ 
      error: 'Please wait before queueing another song!',
      cooldown_remaining: remaining
    });
  }
  
  res.json({
    valid: true,
    fingerprint,
    requires_github_auth: authRequirements.needsGithubAuth,
    requires_hackclub_auth: authRequirements.needsHackClubAuth,
    github_oauth_configured: authRequirements.githubOAuthConfigured,
    hackclub_oauth_configured: authRequirements.hackClubOAuthConfigured
  });
});

module.exports = router;
