import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  auth_time: number;
}

// In-memory cache for Google's public x509 certificates
let cachedCertificates: Record<string, string> | null = null;
let cacheExpiresAt = 0;

// Resolve Firebase project ID from configuration
function getFirebaseProjectId(): string {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.projectId) return parsed.projectId;
    }
  } catch (err) {
    console.warn('[FirebaseVerifier] Failed to read firebase-applet-config.json:', err);
  }
  return 'charismatic-catfish-b46tg';
}

/**
 * Fetch and cache Google's public certificates for Firebase ID Token verification
 */
async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCertificates && now < cacheExpiresAt) {
    return cachedCertificates;
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch Google public keys: HTTP ${res.status}`);
    }

    // Parse Cache-Control header to determine TTL (default 6 hours)
    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
    const ttlSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 21600;

    const certs = (await res.json()) as Record<string, string>;
    cachedCertificates = certs;
    cacheExpiresAt = now + ttlSeconds * 1000;
    return certs;
  } catch (err: any) {
    if (cachedCertificates) {
      console.warn('[FirebaseVerifier] Using stale certificates after fetch failure:', err.message);
      return cachedCertificates;
    }
    throw new Error(`Cannot verify Firebase ID token: Unable to fetch Google public signing keys (${err.message})`);
  }
}

/**
 * Base64URL decode helper
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Cryptographically verify a Firebase ID Token.
 * Enforces signature, issuer, audience, expiration, and header integrity.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('INVALID_TOKEN: Missing or malformed Firebase ID token.');
  }

  const parts = idToken.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('INVALID_TOKEN: Token must be a 3-part JWT (header.payload.signature).');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Parse and validate Header
  let header: { alg?: string; kid?: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    throw new Error('INVALID_TOKEN: Failed to parse token header JSON.');
  }

  if (header.alg !== 'RS256') {
    throw new Error(`INVALID_TOKEN: Invalid algorithm '${header.alg}'. Expected 'RS256'.`);
  }

  if (!header.kid || typeof header.kid !== 'string') {
    throw new Error('INVALID_TOKEN: Missing key identifier (kid) in token header.');
  }

  // 2. Parse and validate Payload
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    throw new Error('INVALID_TOKEN: Failed to parse token payload JSON.');
  }

  const projectId = getFirebaseProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const clockSkewLeeway = 300; // 5 minutes leeway for clock differences

  // Validate audience
  if (payload.aud !== projectId) {
    throw new Error(`INVALID_AUDIENCE: Token audience '${payload.aud}' does not match Firebase project '${projectId}'.`);
  }

  // Validate issuer
  if (payload.iss !== expectedIssuer) {
    throw new Error(`INVALID_ISSUER: Token issuer '${payload.iss}' does not match expected '${expectedIssuer}'.`);
  }

  // Validate subject (Firebase UID)
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('INVALID_SUBJECT: Token subject (sub) must be a non-empty string corresponding to the Firebase UID.');
  }

  // Validate expiration
  if (typeof payload.exp !== 'number' || payload.exp < nowInSeconds - clockSkewLeeway) {
    throw new Error('TOKEN_EXPIRED: The Firebase ID token has expired. Please sign in again.');
  }

  // Validate issue time
  if (typeof payload.iat !== 'number' || payload.iat > nowInSeconds + clockSkewLeeway) {
    throw new Error('INVALID_IAT: Token issued-at timestamp is in the future.');
  }

  // 3. Cryptographically verify signature using Google's public X.509 certificate
  const publicKeys = await getGooglePublicKeys();
  const certificatePem = publicKeys[header.kid];

  if (!certificatePem) {
    throw new Error(`UNKNOWN_KEY: No public signing certificate found matching key ID '${header.kid}'.`);
  }

  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const signatureBuffer = Buffer.from(signatureB64, 'base64url');
    const isValidSignature = verifier.verify(certificatePem, signatureBuffer);

    if (!isValidSignature) {
      throw new Error('SIGNATURE_VERIFICATION_FAILED: Cryptographic signature mismatch on Firebase ID token.');
    }
  } catch (cryptoErr: any) {
    if (cryptoErr.message?.includes('SIGNATURE_VERIFICATION_FAILED')) {
      throw cryptoErr;
    }
    throw new Error(`CRYPTOGRAPHIC_VERIFICATION_ERROR: ${cryptoErr.message}`);
  }

  return {
    uid: payload.sub,
    email: payload.email,
    email_verified: Boolean(payload.email_verified),
    name: payload.name,
    picture: payload.picture,
    iss: payload.iss,
    aud: payload.aud,
    sub: payload.sub,
    exp: payload.exp,
    iat: payload.iat,
    auth_time: payload.auth_time || payload.iat
  };
}
