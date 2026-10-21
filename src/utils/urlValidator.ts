export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateRpcUrl(url: string): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL cannot be empty' };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { isValid: false, error: 'URL cannot be empty' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }
    if (!parsed.hostname) {
      return { isValid: false, error: 'URL must contain a valid hostname' };
    }
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}
