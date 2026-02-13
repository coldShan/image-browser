export type GalleryImage = {
  id: string;
  name: string;
  relativePath: string;
  lastModified: number;
  size: number;
  url: string;
  previewUrl: string;
  width?: number;
  height?: number;
};

export type CollectedImage = Omit<GalleryImage, "id" | "url" | "previewUrl"> & {
  file: File;
};
