declare interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_COLLAB_URL: string;
  readonly VITE_STATIC_PUBLIC_ENDPOINT: string;
  readonly VITE_STATIC_PRIVATE_ENDPOINT: string;
  readonly VITE_SUBSCRIPTION_ENABLED: boolean;
  readonly VITE_CANVAS_TEMPLATE_ENABLED: boolean;
  readonly VITE_SENTRY_ENABLED: boolean;
  readonly VITE_RUNTIME: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
