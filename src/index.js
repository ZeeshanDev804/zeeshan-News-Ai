export const APP_CONFIG = {
  name: "ZEESHAN NEWS AI",
  version: "1.0.0",
  description:
    "AI-powered global news, sports, entertainment, technology and trends platform.",
  features: {
    originalContent: true,
    factChecking: true,
    duplicateChecking: true,
    seo: true,
    analytics: true,
    adSenseReady: true,
    pushNotifications: true,
    socialDistribution: true,
    shortVideos: true
  }
};

export function getSystemStatus() {
  return {
    status: "ready",
    timestamp: new Date().toISOString()
  };
}
