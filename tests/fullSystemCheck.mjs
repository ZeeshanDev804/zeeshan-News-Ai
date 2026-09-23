import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".vercel",
  "dist",
  "build",
  "coverage",
]);

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
]);

const errors = [];
const warnings = [];
const passed = [];

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function addError(type, file, message) {
  errors.push({
    type,
    file: relative(file),
    message,
  });
}

function addWarning(type, file, message) {
  warnings.push({
    type,
    file: relative(file),
    message,
  });
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, {
    withFileTypes: true,
  })) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(
        path.extname(entry.name)
      )
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function readFile(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    addError(
      "READ_ERROR",
      file,
      error.message
    );

    return "";
  }
}

function extractImports(source) {
  const imports = [];

  const importRegex =
    /(?:import\s+(?:[\s\S]*?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/g;

  let match;

  while (
    (match = importRegex.exec(source))
  ) {
    imports.push(match[1]);
  }

  const requireRegex =
    /require\s*\(\s*["']([^"']+)["']\s*\)/g;

  while (
    (match = requireRegex.exec(source))
  ) {
    imports.push(match[1]);
  }

  return [
    ...new Set(imports),
  ];
}

function extractImportedNames(source) {
  const results = [];

  const namedRegex =
    /import\s*\{([\s\S]*?)\}\s*from\s*["'][^"']+["']/g;

  let match;

  while (
    (match = namedRegex.exec(source))
  ) {
    const names = match[1]
      .split(",")
      .map((item) =>
        item
          .trim()
          .split(/\s+as\s+/i)[0]
          .trim()
      )
      .filter(Boolean);

    results.push(...names);
  }

  return [
    ...new Set(results),
  ];
}

function extractExports(source) {
  const exports = new Set();

  const namedExportRegex =
    /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;

  let match;

  while (
    (match = namedExportRegex.exec(source))
  ) {
    exports.add(match[1]);
  }

  const exportListRegex =
    /export\s*\{([\s\S]*?)\}/g;

  while (
    (match = exportListRegex.exec(source))
  ) {
    const names = match[1]
      .split(",")
      .map((item) =>
        item
          .trim()
          .split(/\s+as\s+/i)[0]
          .trim()
      )
      .filter(Boolean);

    for (const name of names) {
      exports.add(name);
    }
  }

  if (
    /export\s+default\s+/m.test(source)
  ) {
    exports.add("default");
  }

  return exports;
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = path.resolve(
    path.dirname(fromFile),
    specifier
  );

  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.cjs`,
    path.join(base, "index.js"),
    path.join(base, "index.mjs"),
    path.join(base, "index.cjs"),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    ) {
      return candidate;
    }
  }

  return null;
}

function checkSyntax(file) {
  try {
    execFileSync(
      process.execPath,
      ["--check", file],
      {
        cwd: ROOT,
        stdio: "pipe",
      }
    );

    passed.push({
      type: "SYNTAX",
      file: relative(file),
    });

    return true;
  } catch (error) {
    const output =
      error?.stderr?.toString() ||
      error?.stdout?.toString() ||
      error?.message ||
      "Unknown syntax error";

    addError(
      "SYNTAX_ERROR",
      file,
      output.trim()
    );

    return false;
  }
}

function checkImports(file, source, fileMap) {
  const imports =
    extractImports(source);

  for (const specifier of imports) {
    if (!specifier.startsWith(".")) {
      continue;
    }

    const resolved =
      resolveImport(
        file,
        specifier
      );

    if (!resolved) {
      addError(
        "MISSING_IMPORT",
        file,
        `Cannot resolve "${specifier}"`
      );

      continue;
    }

    if (fileMap.has(resolved)) {
      passed.push({
        type: "IMPORT",
        file: relative(file),
        target: relative(resolved),
      });
    }
  }
}

function checkNamedExports(
  file,
  source,
  fileMap
) {
  const importedNames =
    extractImportedNames(source);

  if (
    importedNames.length === 0
  ) {
    return;
  }

  const importRegex =
    /import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g;

  let match;

  while (
    (match = importRegex.exec(source))
  ) {
    const names = match[1]
      .split(",")
      .map((item) =>
        item
          .trim()
          .split(/\s+as\s+/i)
          .filter(Boolean)
      )
      .filter(
        (parts) =>
          parts.length > 0 &&
          parts[0]
      );

    const specifier = match[2];

    if (
      !specifier.startsWith(".")
    ) {
      continue;
    }

    const resolved =
      resolveImport(
        file,
        specifier
      );

    if (!resolved) {
      continue;
    }

    const targetSource =
      fileMap.get(resolved);

    if (
      targetSource === undefined
    ) {
      continue;
    }

    const targetExports =
      extractExports(
        targetSource
      );

    for (const parts of names) {
      const importedName =
        parts[0];

      if (
        !targetExports.has(
          importedName
        )
      ) {
        addError(
          "EXPORT_MISMATCH",
          file,
          `"${importedName}" is imported from "${specifier}" but is not exported by "${relative(resolved)}"`
        );
      } else {
        passed.push({
          type: "EXPORT_MATCH",
          file: relative(file),
          target: relative(resolved),
          name: importedName,
        });
      }
    }
  }
}

function checkRequiredProjectFiles(
  fileMap
) {
  const requiredFiles = [
    "server.js",

    "src/lib/retryEngine.js",
    "src/lib/contentApprovalQueue.js",
    "src/lib/analyticsEngine.js",
    "src/lib/socialDistributionEngine.js",
  ];

  for (const required of requiredFiles) {
    const fullPath =
      path.join(
        ROOT,
        required
      );

    if (
      !fileMap.has(fullPath)
    ) {
      addError(
        "MISSING_PROJECT_FILE",
        fullPath,
        `Required project file not found: ${required}`
      );
    } else {
      passed.push({
        type: "REQUIRED_FILE",
        file: required,
      });
    }
  }
}

function checkPackageJson() {
  const packagePath =
    path.join(
      ROOT,
      "package.json"
    );

  if (
    !fs.existsSync(packagePath)
  ) {
    addError(
      "PACKAGE_JSON",
      packagePath,
      "package.json was not found."
    );

    return;
  }

  try {
    const packageJson =
      JSON.parse(
        fs.readFileSync(
          packagePath,
          "utf8"
        )
      );

    passed.push({
      type: "PACKAGE_JSON",
      file: "package.json",
    });

    if (
      !packageJson.scripts
    ) {
      addWarning(
        "PACKAGE_SCRIPT",
        packagePath,
        "No npm scripts section found."
      );
    }

    if (
      !packageJson.type
    ) {
      addWarning(
        "MODULE_TYPE",
        packagePath,
        'package.json has no "type" field. Check whether the project expects CommonJS or ESM.'
      );
    }
  } catch (error) {
    addError(
      "PACKAGE_JSON",
      packagePath,
      `Invalid package.json: ${error.message}`
    );
  }
}

function checkDuplicateFunctionNames(
  file,
  source
) {
  const names = [];

  const regex =
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;

  let match;

  while (
    (match = regex.exec(source))
  ) {
    names.push(match[1]);
  }

  const duplicates =
    names.filter(
      (name, index) =>
        names.indexOf(name) !==
        index
    );

  for (
    const duplicate of [
      ...new Set(duplicates),
    ]
  ) {
    addWarning(
      "DUPLICATE_FUNCTION",
      file,
      `Function "${duplicate}" appears more than once.`
    );
  }
}

function checkFile(
  file,
  fileMap
) {
  const source =
    fileMap.get(file) || "";

  if (!source) {
    return;
  }

  checkSyntax(file);

  checkImports(
    file,
    source,
    fileMap
  );

  checkNamedExports(
    file,
    source,
    fileMap
  );

  checkDuplicateFunctionNames(
    file,
    source
  );
}

function printSection(title) {
  console.log("");
  console.log("=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

function main() {
  console.log("");
  console.log(
    "ZEESHAN NEWS AI — FULL SYSTEM COMPATIBILITY CHECK"
  );
  console.log(
    "Scanning project files..."
  );

  const files =
    walk(ROOT);

  const fileMap =
    new Map();

  for (const file of files) {
    fileMap.set(
      file,
      readFile(file)
    );
  }

  printSection(
    "PROJECT FILES"
  );

  console.log(
    `JavaScript files found: ${files.length}`
  );

  checkRequiredProjectFiles(
    fileMap
  );

  checkPackageJson();

  printSection(
    "SYNTAX + IMPORT + EXPORT CHECK"
  );

  for (const file of files) {
    checkFile(
      file,
      fileMap
    );
  }

  printSection(
    "RESULT"
  );

  console.log(
    `✓ Passed checks: ${passed.length}`
  );

  console.log(
    `⚠ Warnings: ${warnings.length}`
  );

  console.log(
    `✗ Errors: ${errors.length}`
  );

  if (warnings.length) {
    printSection(
      "WARNINGS"
    );

    for (const warning of warnings) {
      console.log(
        `⚠ ${warning.type} — ${warning.file}`
      );
      console.log(
        `  ${warning.message}`
      );
    }
  }

  if (errors.length) {
    printSection(
      "ERRORS"
    );

    for (const error of errors) {
      console.log(
        `✗ ${error.type} — ${error.file}`
      );
      console.log(
        `  ${error.message}`
      );
    }
  }

  printSection(
    "FINAL STATUS"
  );

  if (errors.length === 0) {
    console.log(
      "✓ NO STRUCTURAL ERRORS FOUND"
    );

    if (warnings.length) {
      console.log(
        "⚠ Warnings exist — they should be reviewed."
      );
    } else {
      console.log(
        "✓ ALL CHECKS ARE CLEAN"
      );
    }

    process.exitCode = 0;
  } else {
    console.log(
      "✗ SYSTEM CHECK FOUND ERRORS"
    );

    console.log(
      "Fix the errors above before moving to production testing."
    );

    process.exitCode = 1;
  }
}

main();
