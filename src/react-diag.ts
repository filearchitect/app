// dev-only diagnostic to detect multiple React copies
if (import.meta.env?.DEV) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const coreVersion = require("react/package.json").version;
    console.log("[React-Diag] core version:", coreVersion);
    // eslint-disable-next-line no-console
    console.log("[React-Diag] react path:", require.resolve("react"));
    // eslint-disable-next-line no-console
    console.log(
      "[React-Diag] jsx-runtime path:",
      require.resolve("react/jsx-runtime")
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[React-Diag] failed", e);
  }
}
