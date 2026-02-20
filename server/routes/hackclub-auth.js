const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { getDb } = require('../db');
const {
  getHackClubClientId,
  getHackClubClientSecret,
  getGuestAuthRequirements,
  isHackClubOAuthConfigured
} = require('../utils/guest-auth');

const router = express.Router();
const DEFAULT_HACKCLUB_SCOPE = 'openid profile name slack_id';
const DEV_CALLBACK_URI = 'http://127.0.0.1:3000/api/hackclub/callback';

function getRedirectUri() {
  const explicitRedirectUri = process.env.HACKCLUB_REDIRECT_URI || process.env.HC_REDIRECT_URI;
  if (explicitRedirectUri) {
    return explicitRedirectUri;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_CALLBACK_URI;
  }

  const configuredClientUrl = process.env.CLIENT_URL || 'http://127.0.0.1:3000';
  return `${configuredClientUrl.replace(/\/+$/, '')}/api/hackclub/callback`;
}

function getScopes() {
  const rawScopes = process.env.HACKCLUB_SCOPES || process.env.HC_SCOPES || DEFAULT_HACKCLUB_SCOPE;

  // Support space/comma/plus separated values so malformed env input still works.
  const normalized = String(rawScopes)
    .split(/[\s,+]+/)
    .map(scope => scope.trim())
    .filter(Boolean)
    .join(' ');

  return normalized || DEFAULT_HACKCLUB_SCOPE;
}

function getPostAuthClientUrl(redirectUri) {
  const explicitClientUrl = process.env.HACKCLUB_POST_AUTH_URL || process.env.HC_POST_AUTH_URL;
  if (explicitClientUrl) {
    return explicitClientUrl.replace(/\/+$/, '');
  }

  try {
    return new URL(redirectUri).origin;
  } catch (error) {
    return (process.env.CLIENT_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  }
}

// Redirect to Hack Club OAuth
router.get('/login', (req, res) => {
  const clientId = getHackClubClientId();
  const clientSecret = getHackClubClientSecret();

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Hack Club OAuth not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');

  res.cookie('hackclub_oauth_state', state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
    sameSite: 'lax'
  });

  const redirectUri = getRedirectUri();
  const scope = getScopes();

  const authUrl = `https://auth.hackclub.com/oauth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${state}`;

  res.json({ authUrl });
});

// Hack Club OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error: oauthError, error_description: oauthErrorDescription } = req.query;
  const storedState = req.cookies.hackclub_oauth_state;
  const redirectUri = getRedirectUri();
  const clientUrl = getPostAuthClientUrl(redirectUri);

  res.clearCookie('hackclub_oauth_state');

  if (!state || state !== storedState) {
    const detail = 'state_mismatch (cookie/domain mismatch or stale login session)';
    return res.redirect(`${clientUrl}/?error=hackclub_auth_failed&error_detail=${encodeURIComponent(detail)}`);
  }

  if (oauthError) {
    const detail = oauthErrorDescription || oauthError;
    return res.redirect(`${clientUrl}/?error=hackclub_auth_failed&error_detail=${encodeURIComponent(String(detail))}`);
  }

  if (!code) {
    return res.redirect(`${clientUrl}/?error=hackclub_auth_failed&error_detail=${encodeURIComponent('missing_authorization_code')}`);
  }

  try {
    const clientId = getHackClubClientId();
    const clientSecret = getHackClubClientSecret();

    const tokenResponse = await axios.post('https://auth.hackclub.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code'
    });

    const accessToken = tokenResponse.data?.access_token;

    if (!accessToken) {
      return res.redirect(`${clientUrl}/?error=hackclub_auth_failed&error_detail=${encodeURIComponent('token_exchange_failed_no_access_token')}`);
    }

    const userResponse = await axios.get('https://auth.hackclub.com/api/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const hackclubPayload = userResponse.data || {};
    const identity = (hackclubPayload.identity && typeof hackclubPayload.identity === 'object')
      ? hackclubPayload.identity
      : {};
    const payloadScopes = Array.isArray(hackclubPayload.scopes) ? hackclubPayload.scopes : [];

    const hackclubId = String(
      identity.id ||
      identity.user_id ||
      identity.sub ||
      identity.slack_id ||
      identity.primary_email ||
      identity.email ||
      hackclubPayload.id ||
      hackclubPayload.user_id ||
      hackclubPayload.sub ||
      hackclubPayload.slack_id ||
      hackclubPayload.primary_email ||
      hackclubPayload.email ||
      ''
    );

    if (!hackclubId) {
      const detail = `profile_missing_identifier: ${Object.keys(hackclubPayload).join(',')}`;
      return res.redirect(`${clientUrl}/?error=hackclub_auth_failed&error_detail=${encodeURIComponent(detail)}`);
    }

    const fullName = [identity.first_name, identity.last_name].filter(Boolean).join(' ').trim();
    const primaryEmail =
      identity.primary_email ||
      identity.email ||
      hackclubPayload.primary_email ||
      hackclubPayload.email ||
      null;

    const username =
      fullName ||
      identity.name ||
      identity.username ||
      identity.nickname ||
      hackclubPayload.name ||
      hackclubPayload.username ||
      hackclubPayload.nickname ||
      (typeof primaryEmail === 'string' ? primaryEmail.split('@')[0] : null) ||
      `hackclub-${hackclubId}`;

    const avatar =
      identity.avatar_url ||
      identity.avatar ||
      identity.picture ||
      hackclubPayload.avatar_url ||
      hackclubPayload.avatar ||
      hackclubPayload.picture ||
      null;
    const slackId =
      identity.slack_id ||
      hackclubPayload.slack_id ||
      null;

    // Keep minimal auth metadata in DB; scopes are available in logs for debugging.
    if (payloadScopes.length > 0) {
      console.log('Hack Club OAuth scopes:', payloadScopes.join(' '));
    }

    const db = getDb();
    const fingerprintId = req.cookies.fingerprint_id || crypto.randomBytes(16).toString('hex');
    const existing = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
    const now = Math.floor(Date.now() / 1000);

    if (!existing) {
      db.prepare(`
        INSERT INTO fingerprints (id, first_seen, status, username, hackclub_id, hackclub_username, hackclub_avatar, hackclub_slack_id)
        VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
      `).run(fingerprintId, now, username, hackclubId, username, avatar, slackId);
    } else {
      db.prepare(`
        UPDATE fingerprints
        SET username = ?, hackclub_id = ?, hackclub_username = ?, hackclub_avatar = ?, hackclub_slack_id = ?
        WHERE id = ?
      `).run(username, hackclubId, username, avatar, slackId, fingerprintId);
    }

    res.cookie('fingerprint_id', fingerprintId, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.redirect(`${clientUrl}/?hackclub_auth=success`);
  } catch (error) {
    const responseData = error.response?.data;
    const detail = typeof responseData === 'string'
      ? responseData
      : (responseData?.error_description || responseData?.error || responseData?.message || error.message);

    console.error('Hack Club OAuth error:', responseData || error.message);
    res.redirect(`${clientUrl}/?error=hackclub_auth_failed&error_detail=${encodeURIComponent(String(detail || 'unknown_error'))}`);
  }
});

// Check if Hack Club OAuth is configured
router.get('/status', (req, res) => {
  const requirements = getGuestAuthRequirements(null);
  res.json({
    configured: isHackClubOAuthConfigured(),
    enforced: requirements.requireHackClubAuth
  });
});

module.exports = router;
