// ========================================
// ZEESHAN NEWS AI — WEB PUSH CONFIG
// ========================================

import {
  isWebPushConfigured,
  getPublicVapidKey,
} from "./notificationService.js";


// ========================================
// GET WEB PUSH CONFIGURATION
// ========================================

export function getWebPushConfig() {
  return {
    configured:
      isWebPushConfigured(),

    publicKey:
      getPublicVapidKey(),

    subject:
      process.env.VAPID_SUBJECT ||
      null,
  };
}


// ========================================
// REQUIRE WEB PUSH CONFIGURATION
// ========================================

export function requireWebPushConfig() {
  const configured =
    isWebPushConfigured();

  if (!configured) {
    throw new Error(
      "Web Push is not configured. VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are required."
    );
  }

  return {
    publicKey:
      process.env.VAPID_PUBLIC_KEY,

    privateKey:
      process.env.VAPID_PRIVATE_KEY,

    subject:
      process.env.VAPID_SUBJECT,
  };
      }
