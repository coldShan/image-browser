import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GalleryImage } from "../types/gallery";
import App from "../App";
import { useDirectoryImages } from "../hooks/useDirectoryImages";
import { useReadingHistory } from "../hooks/useReadingHistory";

const images: GalleryImage[] = [
  {
    id: "root-1",
    name: "root-1.jpg",
    relativePath: "root-1.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "root-1.jpg" } as unknown as FileSystemFileHandle
  },
  {
    id: "a-1",
    name: "a-1.jpg",
    relativePath: "album-a/a-1.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "a-1.jpg" } as unknown as FileSystemFileHandle
  },
  {
    id: "a-2",
    name: "a-2.jpg",
    relativePath: "album-a/sub/a-2.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "a-2.jpg" } as unknown as FileSystemFileHandle
  },
  {
    id: "b-1",
    name: "b-1.jpg",
    relativePath: "album-b/b-1.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "b-1.jpg" } as unknown as FileSystemFileHandle
  },
  {
    id: "root-2",
    name: "root-2.jpg",
    relativePath: "root-2.jpg",
    lastModified: 0,
    size: 0,
    sourceType: "other",
    fileHandle: { kind: "file", name: "root-2.jpg" } as unknown as FileSystemFileHandle
  }
];

vi.mock("../utils/fileSystem", () => ({
  hasImagePicker: () => true
}));

vi.mock("../hooks/useDirectoryImages", () => ({
  useDirectoryImages: vi.fn()
}));
vi.mock("../hooks/useReadingHistory", () => ({
  useReadingHistory: vi.fn()
}));

const hookResult = {
  images,
  loading: false,
  error: null,
  pickDirectory: vi.fn(async () => {}),
  refreshCurrentDirectory: vi.fn(async () => {}),
  canRefreshCurrentDirectory: true,
  clearImages: vi.fn(() => {}),
  ensurePreviewUrl: vi.fn(async () => "blob:preview"),
  releasePreviewUrl: vi.fn(() => {}),
  syncLightboxWindow: vi.fn(async () => ({})),
  releaseAllLightboxUrls: vi.fn(() => {})
};
const readingHistoryResult = {
  sourceState: {
    lastViewed: {
      relativePath: "album-a/a-1.jpg",
      index: 0,
      viewedAt: 1
    },
    albums: {
      "album-a": {
        relativePath: "album-a/sub/a-2.jpg",
        index: 1,
        viewedAt: 2
      }
    },
    recentAlbumPath: "album-a",
    updatedAt: 2
  },
  recentAlbumPath: "album-a",
  albumProgressByPath: {
    "album-a": 0.5,
    "album-b": 0
  },
  recordView: vi.fn(() => {})
};

type LightboxMockProps = {
  open: boolean;
  index: number;
  onIndexChange: (index: number) => void;
};

let latestLightboxProps: LightboxMockProps | null = null;
let latestGalleryProps: Record<string, unknown> | null = null;
let latestAlbumGridProps: Record<string, unknown> | null = null;
let latestAlbumDetailProps: Record<string, unknown> | null = null;

vi.mock("../components/GalleryGrid", () => ({
  default: ({
    images: current,
    onOpen,
    ...rest
  }: {
    images: GalleryImage[];
    onOpen: (index: number) => void;
    [key: string]: unknown;
  }) => {
    latestGalleryProps = { images: current, onOpen, ...rest };
    return (
      <div data-testid="gallery-grid">
        <button type="button" onClick={() => onOpen(0)}>
          打开第1张
        </button>
        <p>{`当前列表 ${current.length} 张`}</p>
        <ul>
          {current.map((item) => (
            <li key={item.id}>{item.relativePath}</li>
          ))}
        </ul>
      </div>
    );
  }
}));

vi.mock("../components/AlbumGrid", () => ({
  default: ({
    albums,
    onOpenAlbum,
    ...rest
  }: {
    albums: Array<{ path: string; title: string; imageCount: number }>;
    onOpenAlbum: (path: string) => void;
    [key: string]: unknown;
  }) => {
    latestAlbumGridProps = { albums, onOpenAlbum, ...rest };
    return (
      <div data-testid="album-grid">
        {albums.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => onOpenAlbum(item.path)}
            aria-label={`打开画集 ${item.title}`}
          >
            {`${item.title}(${item.imageCount})`}
          </button>
        ))}
      </div>
    );
  }
}));

vi.mock("../components/ImageLightbox", () => ({
  default: (props: LightboxMockProps) => {
    latestLightboxProps = props;
    return props.open ? <div data-testid="lightbox-open">lightbox-open</div> : null;
  }
}));

vi.mock("../components/AlbumDetailModal", () => ({
  default: ({
    open,
    albumPath,
    onClose,
    onOpenImage,
    ...rest
  }: {
    open: boolean;
    albumPath: string | null;
    onClose: () => void;
    onOpenImage: (index: number) => void;
    [key: string]: unknown;
  }) => {
    latestAlbumDetailProps = { open, albumPath, onClose, onOpenImage, ...rest };
    return open ? (
      <div role="dialog" aria-label={`画集详情-${albumPath}`}>
        <button type="button" onClick={() => onOpenImage(0)}>
          弹窗打开第1张
        </button>
        <button type="button" onClick={onClose}>
          触发弹窗关闭事件
        </button>
      </div>
    ) : null;
  }
}));

describe("App view modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestLightboxProps = null;
    latestGalleryProps = null;
    latestAlbumGridProps = null;
    latestAlbumDetailProps = null;
    vi.mocked(useDirectoryImages).mockReturnValue(hookResult);
    vi.mocked(useReadingHistory).mockReturnValue(readingHistoryResult);
  });

  it("defaults to all mode and can switch to album mode", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("tab", { name: "全图模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("gallery-grid")).toBeInTheDocument();
    expect(screen.getByText("当前列表 5 张")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    expect(screen.getByRole("tab", { name: "画集模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("album-grid")).toBeInTheDocument();
  });

  it("passes reading history props to list components", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(latestGalleryProps?.lastViewedRelativePath).toBe("album-a/a-1.jpg");
    expect(latestGalleryProps?.restoreRelativePath).toBe("album-a/a-1.jpg");
    expect(latestGalleryProps?.restoreToken).toEqual(expect.any(Number));

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    expect(latestAlbumGridProps?.recentAlbumPath).toBe("album-a");
    expect(latestAlbumGridProps?.restoreAlbumPath).toBe("album-a");
    expect(latestAlbumGridProps?.restoreToken).toEqual(expect.any(Number));
    expect(
      (latestAlbumGridProps?.progressByAlbumPath as Record<string, number>)["album-a"]
    ).toBe(0.5);
  });

  it("records current image when lightbox opens", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "打开第1张" }));
    await act(async () => {});

    expect(readingHistoryResult.recordView).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 0,
        image: expect.objectContaining({ relativePath: "root-1.jpg" })
      })
    );
  });

  it("keeps current album path when switching from album detail to all mode", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    await user.click(screen.getByRole("button", { name: "打开画集 album-a" }));
    expect(screen.getByRole("dialog", { name: "画集详情-album-a" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "全图模式" }));

    expect(screen.getByText("当前列表 2 张")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "画集详情-album-a" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回根路径全图" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回根路径全图" }));
    expect(screen.getByText("当前列表 5 张")).toBeInTheDocument();
    expect(screen.getByText("root-1.jpg")).toBeInTheDocument();
  });

  it("keeps selected mode after picking directory", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    expect(screen.getByRole("tab", { name: "画集模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "选择文件夹或图片" }));

    expect(hookResult.pickDirectory).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "画集模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("album-grid")).toBeInTheDocument();
  });

  it("refreshes current directory when refresh button is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "刷新当前目录" }));
    expect(hookResult.refreshCurrentDirectory).toHaveBeenCalledTimes(1);
  });

  it("opens album detail in fullscreen modal and keeps album list state", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    await user.click(screen.getByRole("button", { name: "打开画集 album-a" }));

    const dialog = screen.getByRole("dialog", { name: "画集详情-album-a" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId("album-grid")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "触发弹窗关闭事件" }));
    expect(screen.queryByRole("dialog", { name: "画集详情-album-a" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "画集模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("album-grid")).toBeInTheDocument();
  });

  it("restores album detail focus image from reading history", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    await user.click(screen.getByRole("button", { name: "打开画集 album-a" }));

    expect(latestAlbumDetailProps?.restoreRelativePath).toBe("album-a/sub/a-2.jpg");
    await user.keyboard("{Enter}");
    expect(latestLightboxProps?.index).toBe(1);
  });

  it("does not manually lock body scrolling when album detail opens", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    await user.click(screen.getByRole("button", { name: "打开画集 album-a" }));

    expect(screen.getByRole("dialog", { name: "画集详情-album-a" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");
  });

  it("handles modal close event by closing lightbox first", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    await user.click(screen.getByRole("button", { name: "打开画集 album-a" }));
    await user.click(screen.getByRole("button", { name: "弹窗打开第1张" }));
    expect(screen.getByTestId("lightbox-open")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "触发弹窗关闭事件" }));
    expect(screen.queryByTestId("lightbox-open")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "画集详情-album-a" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "触发弹窗关闭事件" }));
    expect(screen.queryByRole("dialog", { name: "画集详情-album-a" })).not.toBeInTheDocument();
  });

  it("closes lightbox before closing album detail on Escape", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "画集模式" }));
    await user.click(screen.getByRole("button", { name: "打开画集 album-a" }));
    await user.click(screen.getByRole("button", { name: "弹窗打开第1张" }));

    expect(screen.getByTestId("lightbox-open")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "画集详情-album-a" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("lightbox-open")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "画集详情-album-a" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "画集详情-album-a" })).not.toBeInTheDocument();
  });

  it("debounces compact header switch on scroll", () => {
    vi.useFakeTimers();
    const originalScrollY = Object.getOwnPropertyDescriptor(window, "scrollY");
    let y = 0;
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => y
    });

    try {
      render(<App />);
      const header = screen.getByRole("banner");
      expect(header).not.toHaveClass("is-scrolled");

      y = 120;
      fireEvent.scroll(window);

      expect(header).not.toHaveClass("is-scrolled");
      act(() => {
        vi.advanceTimersByTime(79);
      });
      expect(header).not.toHaveClass("is-scrolled");

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(header).toHaveClass("is-scrolled");
    } finally {
      if (originalScrollY) {
        Object.defineProperty(window, "scrollY", originalScrollY);
      } else {
        Reflect.deleteProperty(window, "scrollY");
      }
      act(() => {
        vi.runOnlyPendingTimers();
      });
      vi.useRealTimers();
    }
  });

  it("throttles lightbox index updates to at most once per 30ms", async () => {
    vi.useFakeTimers();
    try {
      render(<App />);

      fireEvent.click(screen.getByRole("button", { name: "打开第1张" }));
      expect(screen.getByTestId("lightbox-open")).toBeInTheDocument();

      await act(async () => {});
      hookResult.syncLightboxWindow.mockClear();

      act(() => {
        latestLightboxProps?.onIndexChange(1);
        latestLightboxProps?.onIndexChange(2);
        latestLightboxProps?.onIndexChange(3);
      });
      await act(async () => {});

      expect(hookResult.syncLightboxWindow).toHaveBeenCalledTimes(1);
      expect(hookResult.syncLightboxWindow).toHaveBeenLastCalledWith(1, expect.any(Array));

      act(() => {
        vi.advanceTimersByTime(29);
      });
      expect(hookResult.syncLightboxWindow).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      await act(async () => {});

      expect(hookResult.syncLightboxWindow).toHaveBeenCalledTimes(2);
      expect(hookResult.syncLightboxWindow).toHaveBeenLastCalledWith(3, expect.any(Array));
    } finally {
      act(() => {
        vi.runOnlyPendingTimers();
      });
      vi.useRealTimers();
    }
  });
});
