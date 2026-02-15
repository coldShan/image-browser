import type { AlbumSummary, GalleryImage } from "../types/gallery";

const byPathAsc = (a: { relativePath: string }, b: { relativePath: string }): number =>
  a.relativePath.localeCompare(b.relativePath, undefined, {
    numeric: true,
    sensitivity: "base"
  });

const normalizePath = (path: string): string => path.replace(/^\/+|\/+$/g, "");

export const isUnderPath = (relativePath: string, path: string): boolean => {
  const normalized = normalizePath(path);
  if (!normalized) return true;
  return relativePath.startsWith(`${normalized}/`);
};

export const filterImagesByPath = (images: GalleryImage[], path: string): GalleryImage[] => {
  const normalized = normalizePath(path);
  if (!normalized) return images;
  return images.filter((item) => isUnderPath(item.relativePath, normalized));
};

export const buildAlbums = (images: GalleryImage[]): AlbumSummary[] => {
  const map = new Map<string, GalleryImage[]>();

  for (const image of images) {
    const slashIndex = image.relativePath.indexOf("/");
    if (slashIndex <= 0) continue;
    const topLevel = image.relativePath.slice(0, slashIndex);
    const list = map.get(topLevel);
    if (list) {
      list.push(image);
      continue;
    }
    map.set(topLevel, [image]);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base"
      })
    )
    .map(([path, list]) => {
      const [cover] = [...list].sort(byPathAsc);
      return {
        path,
        title: path,
        coverImageId: cover.id,
        coverRelativePath: cover.relativePath,
        imageCount: list.length
      };
    });
};
