/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DUCK_OPS_URL?: string
  readonly VITE_PHILS_BRIDGE_URL?: string
  readonly VITE_WEATHER_LAT?: string
  readonly VITE_WEATHER_LON?: string
  readonly VITE_NHL_TEAM_ABBREV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
