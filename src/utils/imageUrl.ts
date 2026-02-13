export type UrlRegistry = Set<string>;

export const createUrlRegistry = (): UrlRegistry => new Set<string>();

export const createManagedObjectUrl = (
  blob: Blob,
  registry: UrlRegistry
): string => {
  const url = URL.createObjectURL(blob);
  registry.add(url);
  return url;
};

export const revokeManagedObjectUrl = (
  url: string,
  registry: UrlRegistry
): void => {
  if (!registry.has(url)) return;
  URL.revokeObjectURL(url);
  registry.delete(url);
};

export const releaseAllObjectUrls = (registry: UrlRegistry): void => {
  for (const url of registry) URL.revokeObjectURL(url);
  registry.clear();
};
