import {
  generateAdminToken,
} from "../src/lib/adminSecurity.js";

const token =
  generateAdminToken(48);

console.log("");
console.log(
  "=============================="
);
console.log(
  "ZEESHAN NEWS AI ADMIN TOKEN"
);
console.log(
  "=============================="
);
console.log("");
console.log(token);
console.log("");
console.log(
  "Copy this token into ADMIN_API_TOKEN"
);
console.log(
  "Do NOT commit the real token to GitHub."
);
console.log("");
