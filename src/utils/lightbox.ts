import type { GalleryImage } from "../types/gallery";

export type LightboxSlide = {
  src: string;
  width?: number;
  height?: number;
  alt?: string;
};

export const toLightboxSlides = (images: GalleryImage[]): LightboxSlide[] =>
  images.map((image) => ({
    src: image.url,
    width: image.width,
    height: image.height,
    alt: image.name
  }));
