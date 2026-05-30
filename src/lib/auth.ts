/**
 * Hash a PIN using SHA-256 via Web Crypto API.
 * Returns a hex string.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against a stored hash.
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const computedHash = await hashPin(pin);
  return computedHash === hash;
}

/**
 * Hash a security answer using SHA-256 (alias for hashPin).
 */
export const hashAnswer = hashPin;

/**
 * Check if WebAuthn platform authentication (biometric) is available.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof PublicKeyCredential === 'undefined') return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Register a biometric credential (WebAuthn).
 * Returns true if registration succeeded.
 */
export async function registerBiometric(userName: string): Promise<boolean> {
  if (!await isBiometricAvailable()) return false;

  try {
    // Generate a random credential ID to store as the user handle
    const userId = crypto.getRandomValues(new Uint8Array(32));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'MyEco' },
        user: {
          id: userId,
          name: userName || 'MyEco User',
          displayName: userName || 'MyEco User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    });

    if (!credential) return false;

    // Store the credential ID in localStorage for later verification
    const credId = btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId)));
    localStorage.setItem('myeco-biometric-credential', credId);

    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate using biometric (WebAuthn).
 * Returns true if authentication succeeded.
 */
export async function authenticateBiometric(): Promise<boolean> {
  if (!await isBiometricAvailable()) return false;

  const storedCredId = localStorage.getItem('myeco-biometric-credential');
  if (!storedCredId) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credentialId = Uint8Array.from(atob(storedCredId), c => c.charCodeAt(0));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          id: credentialId,
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return !!assertion;
  } catch {
    return false;
  }
}

/**
 * Remove stored biometric credential.
 */
export function removeBiometricCredential(): void {
  localStorage.removeItem('myeco-biometric-credential');
}
