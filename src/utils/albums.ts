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

export const getAlbumPath = (relativePath: string): string => {
  const segments = normalizePath(relativePath).split("/").filter(Boolean);
  if (segments.length <= 1) return ROOT_ALBUM_PATH;
  return segments.slice(0, Math.min(segments.length - 1, 2)).join("/");
};

export const filterImagesByPath = (images: GalleryImage[], path: string): GalleryImage[] => {
  if (!path) return images;
  if (path === ROOT_ALBUM_PATH) return images.filter((item) => isRootImage(item.relativePath));
  const normalized = normalizePath(path);
  return images.filter((item) => getAlbumPath(item.relativePath) === normalized);
};

export const buildAlbums = (images: GalleryImage[]): AlbumSummary[] => {
  const map = new Map<string, GalleryImage[]>();
  const rootImages: GalleryImage[] = [];

  for (const image of images) {
    const albumPath = getAlbumPath(image.relativePath);
    if (albumPath === ROOT_ALBUM_PATH) {
      rootImages.push(image);
      continue;
    }
    const list = map.get(albumPath);
    if (list) {
      list.push(image);
      continue;
    }
    map.set(albumPath, [image]);
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
