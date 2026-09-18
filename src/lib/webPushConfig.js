import webpush from "web-push";

function getRequiredEnv(
  name
) {
  const value =
    process.env[name];

  if (
    !value ||
    !String(value).trim()
  ) {
    throw new Error(
      `${name} is not configured`
    );
  }

  return String(value).trim();
}

export function isPushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

export function configureWebPush() {
  const publicKey =
    getRequiredEnv(
      "VAPID_PUBLIC_KEY"
    );

  const privateKey =
    getRequiredEnv(
      "VAPID_PRIVATE_KEY"
    );

  const subject =
    getRequiredEnv(
      "VAPID_SUBJECT"
    );

  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );

  return {
    configured: true,
    subject,
  };
}

export function getVapidPublicKey() {
  return getRequiredEnv(
    "VAPID_PUBLIC_KEY"
  );
}

export function getPushStatus() {
  return {
    configured:
      isPushConfigured(),

    subject:
      process.env.VAPID_SUBJECT ||
      null,
  };
}

export default webpush;