import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("");
console.log("VAPID_PUBLIC_KEY=");
console.log(keys.publicKey);
console.log("");

console.log("VAPID_PRIVATE_KEY=");
console.log(keys.privateKey);
console.log("");

console.log(
  "⚠️ Keep the private key secret. Never commit it to GitHub."
);
