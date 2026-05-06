# StudyFlow

App de calendario de estudio en Tauri + React + TypeScript.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Publicar nueva versión

Las releases se distribuyen vía GitHub Releases con el plugin oficial `tauri-plugin-updater`. Cada tag `vX.Y.Z` dispara el workflow de GitHub Actions, que compila, firma con ed25519 y publica los binarios + `latest.json`.

### Pasos

1. **Bump version** en los tres sitios (deben coincidir):
   - `package.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version = "..."`
   - `src-tauri/tauri.conf.json` → `"version"`
2. **Commit + tag + push**:
   ```bash
   git commit -am "Release vX.Y.Z"
   git tag vX.Y.Z
   git push && git push --tags
   ```
3. GitHub Actions compila con `TAURI_SIGNING_PRIVATE_KEY`, firma el `.exe`, genera `latest.json` y sube todo al release.
4. Las apps instaladas detectan la versión nueva en máximo 4h (intervalo de polling) o al reiniciar.

### Setup inicial (una sola vez)

#### Generar las claves de firma ed25519

```bash
npx tauri signer generate -w ~/.tauri/studyflow.key
```

Te pedirá una contraseña. Guárdala en un sitio seguro (gestor de contraseñas, NO en el repo). Genera dos archivos:

- `~/.tauri/studyflow.key` — clave **privada**, NO commitear nunca.
- `~/.tauri/studyflow.key.pub` — clave **pública**, va en `tauri.conf.json` (es pública, sin riesgo).

#### Configurar `tauri.conf.json`

Sustituye en `src-tauri/tauri.conf.json`:

- `njuante` por tu usuario de GitHub (en el endpoint del updater).
- `<PEGAR_AQUI_EL_CONTENIDO_DE_studyflow.key.pub>` por el contenido completo del fichero `.pub`.

#### Crear el repo en GitHub y configurar Secrets

Settings → Secrets and variables → Actions → New repository secret:

- `TAURI_PRIVATE_KEY` — contenido completo del fichero `~/.tauri/studyflow.key`.
- `TAURI_KEY_PASSWORD` — la contraseña que pusiste al generar la clave.

> El secreto `GITHUB_TOKEN` lo provee GitHub automáticamente, no hace falta crearlo.

### ⚠️ Versión puente (primera actualización manual)

La app que tengas instalada **antes** de incluir el plugin updater no sabe comprobar actualizaciones. Para activar el flujo automático:

1. Compila localmente la primera versión con el plugin (`npm run tauri build`).
2. **Desinstala** la versión antigua e **instala** el `.exe` nuevo manualmente.
3. A partir de ahí, todas las releases siguientes (`v0.1.2`, `v0.1.3`, …) se aplicarán solas en el banner de la app.

Es un paso único: la siguiente vez que pongas un tag, la app instalada detectará el `latest.json` y se actualizará en sitio.

### Probar el flujo end-to-end

1. Bump version a `0.1.1` en los tres archivos.
2. `git push && git push --tags` con tag `v0.1.1`.
3. Espera ~5 min al CI.
4. Verifica en `https://github.com/njuante/studyflow/releases/latest` que existen `latest.json` y el `.exe`.
5. Abre la app instalada localmente: en pocos segundos debería aparecer el banner "Versión 0.1.1 disponible".

## Development

```bash
npm run tauri dev    # app completa con hot reload
npm run dev          # solo frontend en navegador (sin backend Tauri)
npm test             # tests unitarios (vitest)
npm run icons:build  # regenerar iconos a partir del SVG fuente
```
