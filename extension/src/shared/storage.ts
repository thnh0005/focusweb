export async function getStorageValue<T>(
  key: string,
  fallback: T
): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

export async function setStorageValue<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function removeStorageValue(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

export async function patchStorageValue<T extends object>(
  key: string,
  patch: Partial<T>,
  fallback: T
): Promise<T> {
  const current = await getStorageValue<T>(key, fallback);
  const next = { ...current, ...patch };
  await setStorageValue(key, next);
  return next;
}
