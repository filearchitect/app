// Polyfill for older Tauri API expectations when running with newer runtime
if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
  const internals = (window as any).__TAURI_INTERNALS__;
  if (typeof internals.unregisterCallback !== "function") {
    internals.unregisterCallback = (_id?: number) => {
      // noop – new runtime auto-cleans callbacks
    };
  }
}
