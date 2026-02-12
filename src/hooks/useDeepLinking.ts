import { LicenseService } from "@/features/auth/services";
import { useCallback, useEffect, useRef } from "react";

interface UseDeepLinkingOptions {
  setLicense: (license: any) => void;
  /** Called when filearchitect://structure/... is opened; open this content in Quick structure */
  onStructureContent?: (content: string) => void;
}

/** Parse path after filearchitect:// - for structure/ the rest may contain encoded slashes */
function parseDeepLinkPath(
  url: string
): { command: string; rest: string } | null {
  if (!url.startsWith("filearchitect://")) return null;
  const afterScheme = url.slice("filearchitect://".length);
  const slashIdx = afterScheme.indexOf("/");
  if (slashIdx === -1) return { command: afterScheme, rest: "" };
  return {
    command: afterScheme.slice(0, slashIdx),
    rest: afterScheme.slice(slashIdx + 1),
  };
}

export function useDeepLinking({
  setLicense,
  onStructureContent,
}: UseDeepLinkingOptions) {
  // Avoid processing the same structure URL twice (e.g. event + getCurrent),
  // which would call exitStructureEditing() again and revert after user selects a saved structure.
  const lastProcessedStructureUrlRef = useRef<string | null>(null);

  const processUrl = useCallback(
    (url: string | null) => {
      const parsed = url ? parseDeepLinkPath(url) : null;
      if (!parsed) return;

      const { command, rest } = parsed;
      switch (command) {
        case "refresh-license":
          LicenseService.updateLicenseOrCreateTrial()
            .then((newLicense) => {
              setLicense(newLicense);
            })
            .catch((error) => {
              console.error("Failed to refresh license from deep link:", error);
            });
          break;
        case "add-license":
          const licenseKey = rest;
          if (licenseKey) {
            LicenseService.addLicenseFromDeepLink(licenseKey)
              .then((newLicense) => {
                setLicense(newLicense);
              })
              .catch((error) => {
                console.error("Failed to add license from deep link:", error);
              });
          } else {
            console.warn("No license key provided in deep link");
          }
          break;
        case "structure":
          if (rest && url) {
            if (url === lastProcessedStructureUrlRef.current) {
              return; // Already processed this URL; avoid reverting to Quick structure after user selected a saved one
            }
            lastProcessedStructureUrlRef.current = url;
            try {
              const structureContent = decodeURIComponent(rest);
              if (onStructureContent) {
                onStructureContent(structureContent);
              } else {
                console.warn(
                  "Deep link structure received but onStructureContent not provided"
                );
              }
            } catch (error) {
              console.error(
                "Failed to decode structure content from deep link:",
                error
              );
            }
          } else {
            console.warn(
              "No structure content provided in deep link for structure"
            );
          }
          break;
        default:
          console.warn("Unknown deep link command:", command);
      }
    },
    [setLicense, onStructureContent]
  );

  useEffect(() => {
    const initializeDeepLinking = async () => {
      const tauriDeepLinkApi = window.__TAURI__.deepLink as {
        getCurrent: () => Promise<string | string[] | null>;
        onOpenUrl: (cb: (urls: string[]) => void) => Promise<void>;
      };
      const tauriEvent = window.__TAURI__.event;

      const handleUrl = (raw: string | string[] | null) => {
        if (!raw) return;
        const url = Array.isArray(raw) ? raw[0] : raw;
        if (url) processUrl(url);
      };

      // Backend emits "deep-link-url" (used on macOS and when app is already open)
      const unlisten = await tauriEvent.listen<string>("deep-link-url", (e) => {
        if (e.payload) handleUrl(e.payload);
      });

      // Plugin getCurrent / onOpenUrl (primary on Windows/Linux; fallback on macOS)
      try {
        const initialUrl = await tauriDeepLinkApi.getCurrent();
        if (initialUrl) {
          handleUrl(initialUrl);
        }
      } catch (err) {
        console.error("Error getting current deep link URL:", err);
      }

      await tauriDeepLinkApi.onOpenUrl((urls: string[]) => {
        handleUrl(urls);
      });

      return unlisten;
    };

    let unlisten: (() => void) | null = null;
    initializeDeepLinking().then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [processUrl]);

  return { processUrl };
}
