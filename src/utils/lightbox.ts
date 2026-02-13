import type { GalleryImage } from "../types/gallery";

export type LightboxSlide = {
  src: string;
  width?: number;
  height?: number;
  alt?: string;
};

export const BLANK_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export const toLightboxSlides = (
  images: GalleryImage[],
  lightboxUrls: Record<string, string>
): LightboxSlide[] =>
  images.map((image) => ({
    src: lightboxUrls[image.id] ?? BLANK_IMAGE,
    width: image.width,
    height: image.height,
    alt: image.name
  }));
