import { readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const bundleDir = resolve("src-tauri/target/release/bundle/nsis");
const files = readdirSync(bundleDir);

const exeFile = files.find((f) => f.endsWith("-setup.exe"));
const sigFile = files.find((f) => f.endsWith("-setup.exe.sig"));

if (!exeFile || !sigFile) {
  console.error(
    "No se encontró el .exe firmado. ¿Compilaste con TAURI_SIGNING_PRIVATE_KEY?",
  );
  process.exit(1);
}

const sig = readFileSync(resolve(bundleDir, sigFile), "utf8").trim();

const manifest = {
  version,
  notes: process.env.RELEASE_NOTES || `Versión ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: sig,
      url: `https://github.com/njuante/studyflow/releases/download/v${version}/${exeFile}`,
    },
  },
};

writeFileSync(resolve("latest.json"), JSON.stringify(manifest, null, 2));
console.log(`✓ latest.json generado para v${version}`);
