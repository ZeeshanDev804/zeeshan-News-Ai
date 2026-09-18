import webpush from "web-push";

export function generateVapidKeys() {
  const keys =
    webpush.generateVAPIDKeys();

  return {
    publicKey:
      keys.publicKey,

    privateKey:
      keys.privateKey,
  };
}
