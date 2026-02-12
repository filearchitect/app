const ENCRYPTION_KEY =
  import.meta.env.VITE_STORE_ENCRYPTION_KEY ?? "FileArchitect-Store-Key-v1";

function xorEncrypt(text: string, key: string): string {
  if (!key || typeof key !== "string") {
    throw new Error("Encryption key is required");
  }
  if (text == null || typeof text !== "string") {
    throw new Error("Text to encrypt must be a string");
  }
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result); // Convert to base64 for safe storage
}

function xorDecrypt(encryptedBase64: string, key: string): string {
  try {
    const encrypted = atob(encryptedBase64); // Convert from base64
    let result = "";
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (error) {
    throw new Error("Decryption failed");
  }
}

export async function encrypt(data: string): Promise<string> {
  return xorEncrypt(data, ENCRYPTION_KEY);
}

export async function decrypt(encryptedData: string): Promise<string> {
  return xorDecrypt(encryptedData, ENCRYPTION_KEY);
}
