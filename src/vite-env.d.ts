/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AS_URL?: string;
  readonly VITE_BRIDGE_URL?: string;
  readonly VITE_REPO?: string;
  readonly VITE_BRANCH?: string;
  readonly VITE_ENTRIES?: string;
}
