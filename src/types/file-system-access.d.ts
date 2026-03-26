declare global {
  interface FileSystemHandlePermissionDescriptor {
    mode?: "read" | "readwrite";
  }

  type FileSystemPermissionState = "granted" | "denied" | "prompt";

  interface FileSystemHandle {
    queryPermission?(
      descriptor?: FileSystemHandlePermissionDescriptor
    ): Promise<FileSystemPermissionState>;
    requestPermission?(
      descriptor?: FileSystemHandlePermissionDescriptor
    ): Promise<FileSystemPermissionState>;
  }

  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    keys(): AsyncIterableIterator<string>;
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}

export {};
