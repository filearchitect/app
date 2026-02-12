interface Window {
  __TAURI__: {
    event: {
      listen<T = unknown>(
        event: string,
        callback: (event: { payload: T }) => void
      ): Promise<() => void>;
    };
    deepLink: {
      getCurrent(): Promise<string | string[] | null>;
      onOpenUrl(callback: (urls: string[]) => void): Promise<void>;
    };
  };
}
