import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { Fragment, useCallback, useRef, type WheelEvent } from "react";
import type { GalleryImage } from "../types/gallery";
import GalleryGrid from "./GalleryGrid";

type AlbumDetailModalProps = {
  open: boolean;
  albumPath: string | null;
  images: GalleryImage[];
  onClose: () => void;
  onOpenImage: (index: number) => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
};

export default function AlbumDetailModal({
  open,
  albumPath,
  images,
  onClose,
  onOpenImage,
  ensurePreviewUrl,
  releasePreviewUrl
}: AlbumDetailModalProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const onPanelWheelCapture = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    const target = event.target;
    if (!body || !(target instanceof Node) || body.contains(target)) return;

    const maxScrollTop = body.scrollHeight - body.clientHeight;
    if (maxScrollTop <= 0) return;

    const nextScrollTop = Math.min(
      maxScrollTop,
      Math.max(0, body.scrollTop + event.deltaY)
    );

    if (nextScrollTop === body.scrollTop) return;
    body.scrollTop = nextScrollTop;
    event.preventDefault();
  }, []);

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as="div"
        className="album-detail-modal"
        onClose={onClose}
        aria-label={`画集详情 ${albumPath ?? ""}`.trim()}
      >
        <TransitionChild
          as={Fragment}
          enter="album-detail-fade-enter"
          enterFrom="album-detail-fade-from"
          enterTo="album-detail-fade-to"
          leave="album-detail-fade-leave"
          leaveFrom="album-detail-fade-to"
          leaveTo="album-detail-fade-from"
        >
          <div className="album-detail-backdrop" />
        </TransitionChild>

        <div className="album-detail-viewport">
          <div className="album-detail-centre">
            <TransitionChild
              as={Fragment}
              enter="album-detail-panel-enter"
              enterFrom="album-detail-panel-from"
              enterTo="album-detail-panel-to"
              leave="album-detail-panel-leave"
              leaveFrom="album-detail-panel-to"
              leaveTo="album-detail-panel-from"
            >
              <DialogPanel
                className="album-detail-panel"
                onWheelCapture={onPanelWheelCapture}
              >
                <header className="album-detail-header">
                  <div className="album-detail-title-wrap">
                    <span className="album-detail-kicker">album screen</span>
                    <DialogTitle as="h2">{albumPath ?? "未命名画集"}</DialogTitle>
                    <p>{images.length} 张图片</p>
                  </div>
                  <button
                    type="button"
                    className="album-detail-close"
                    onClick={onClose}
                    aria-label="关闭画集详情"
                  >
                    关闭
                  </button>
                </header>

                <div ref={bodyRef} className="album-detail-body">
                  {images.length > 0 ? (
                    <GalleryGrid
                      images={images}
                      onOpen={onOpenImage}
                      ensurePreviewUrl={ensurePreviewUrl}
                      releasePreviewUrl={releasePreviewUrl}
                    />
                  ) : (
                    <section className="album-detail-empty">
                      <h3>画集中暂无可展示图片</h3>
                      <p>请返回列表后检查目录内容，或重新选择图片来源。</p>
                    </section>
                  )}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
