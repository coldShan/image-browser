export type GallerySourceType = "gif" | "webp" | "other";

export type GalleryViewMode = "all" | "album";

export type GalleryImage = {
  id: string;
  name: string;
  relativePath: string;
  lastModified: number;
  size: number;
  sourceType: GallerySourceType;
  width?: number;
  height?: number;
  fileHandle: FileSystemFileHandle;
};

export type CollectedImageMeta = Omit<GalleryImage, "id">;

export type AlbumSummary = {
  path: string;
  title: string;
  coverImageId: string;
  coverRelativePath: string;
  imageCount: number;
};
