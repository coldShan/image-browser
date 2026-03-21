import type { AlbumSummary, GalleryImage } from "../types/gallery";

export const ROOT_ALBUM_PATH = "__root__";
export const ROOT_ALBUM_TITLE = "当前目录";

const byPathAsc = (a: { relativePath: string }, b: { relativePath: string }): number =>
  a.relativePath.localeCompare(b.relativePath, undefined, {
    numeric: true,
    sensitivity: "base"
  });

const normalizePath = (path: string): string => path.replace(/^\/+|\/+$/g, "");
const isRootImage = (relativePath: string): boolean => !relativePath.includes("/");

export const isUnderPath = (relativePath: string, path: string): boolean => {
  const normalized = normalizePath(path);
  if (!normalized) return true;
  return relativePath.startsWith(`${normalized}/`);
};

export const filterImagesByPath = (images: GalleryImage[], path: string): GalleryImage[] => {
  if (!path) return images;
  if (path === ROOT_ALBUM_PATH) return images.filter((item) => isRootImage(item.relativePath));
  const normalized = normalizePath(path);
  return images.filter((item) => isUnderPath(item.relativePath, normalized));
};

export const buildAlbums = (images: GalleryImage[]): AlbumSummary[] => {
  const map = new Map<string, GalleryImage[]>();
  const rootImages: GalleryImage[] = [];

  for (const image of images) {
    const slashIndex = image.relativePath.indexOf("/");
    if (slashIndex <= 0) {
      rootImages.push(image);
      continue;
    }
    const topLevel = image.relativePath.slice(0, slashIndex);
    const list = map.get(topLevel);
    if (list) {
      list.push(image);
      continue;
    }
    map.set(topLevel, [image]);
  }

  const albums = Array.from(map.entries())
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

  if (rootImages.length) {
    const [cover] = [...rootImages].sort(byPathAsc);
    albums.unshift({
      path: ROOT_ALBUM_PATH,
      title: ROOT_ALBUM_TITLE,
      coverImageId: cover.id,
      coverRelativePath: cover.relativePath,
      imageCount: rootImages.length
    });
  }

  return albums;
};
