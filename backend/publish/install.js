'use strict';
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, 'default', { value: mod, enumerable: true })
      : target,
    mod,
  )
);
const projectName = 'page-spy-api';
const organization = '@huolala-tech';
const mainPackage = `${organization}/${projectName}`;
// lib/npm/node-platform.ts
var fs = require('fs');
var os = require('os');
var path = require('path');
var knownWindowsPackages = {
  'win32 arm LE': `${organization}/${projectName}-win32-arm`,
  'win32 arm64 LE': `${organization}/${projectName}-win32-arm64`,
  'win32 x64 LE': `${organization}/${projectName}-win32-amd64`,
};
var knownUnixlikePackages = {
  'darwin arm64 LE': `${organization}/${projectName}-darwin-arm64`,
  'darwin x64 LE': `${organization}/${projectName}-darwin-amd64`,
  'linux arm LE': `${organization}/${projectName}-linux-arm`,
  'linux arm64 LE': `${organization}/${projectName}-linux-arm64`,
  'linux x64 LE': `${organization}/${projectName}-linux-amd64`,
};

function pkgAndSubpathForCurrentPlatform() {
  let pkg;
  let subpath;
  let platformKey = `${process.platform} ${os.arch()} ${os.endianness()}`;
  if (platformKey in knownWindowsPackages) {
    pkg = knownWindowsPackages[platformKey];
    subpath = `${projectName}.exe`;
  } else if (platformKey in knownUnixlikePackages) {
    pkg = knownUnixlikePackages[platformKey];
    subpath = `bin/${projectName}`;
  } else {
    throw new Error(`Unsupported platform: ${platformKey}`);
  }
  return { pkg, subpath };
}
function downloadedBinPath(pkg, subpath) {
  const packageLibDir = path.dirname(require.resolve(mainPackage));
  return path.join(
    packageLibDir,
    `downloaded-${pkg.replace('/', '-')}-${path.basename(subpath)}`,
  );
}

// lib/npm/node-install.ts
var fs2 = require('fs');
var os2 = require('os');
var path2 = require('path');
var zlib = require('zlib');
var https = require('https');
var child_process = require('child_process');
var versionFromPackageJSON = require(path2.join(
  __dirname,
  'package.json',
)).version;
var toPath = path2.join(__dirname, 'bin', `${projectName}`);
var isToPathJS = true;
function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          (res.statusCode === 301 || res.statusCode === 302) &&
          res.headers.location
        )
          return fetch(res.headers.location).then(resolve, reject);
        if (res.statusCode !== 200)
          return reject(new Error(`Server responded with ${res.statusCode}`));
        let chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}
function extractFileFromTarGzip(buffer, subpath) {
  try {
    buffer = zlib.unzipSync(buffer);
  } catch (err) {
    throw new Error(
      `Invalid gzip data in archive: ${(err && err.message) || err}`,
    );
  }
  let str = (i, n) =>
    String.fromCharCode(...buffer.subarray(i, i + n)).replace(/\0.*$/, '');
  let offset = 0;
  subpath = `package/${subpath}`;
  while (offset < buffer.length) {
    let name = str(offset, 100);
    let size = parseInt(str(offset + 124, 12), 8);
    offset += 512;
    if (!isNaN(size)) {
      if (name === subpath) return buffer.subarray(offset, offset + size);
      offset += (size + 511) & ~511;
    }
  }
  throw new Error(`Could not find ${JSON.stringify(subpath)} in archive`);
}
function installUsingNPM(pkg, subpath, binPath) {
  const env = { ...process.env, npm_config_global: void 0 };
  const packageLibDir = path2.dirname(require.resolve(mainPackage));
  const installDir = path2.join(packageLibDir, 'npm-install');
  fs2.mkdirSync(installDir);
  try {
    fs2.writeFileSync(path2.join(installDir, 'package.json'), '{}');
    child_process.execSync(
      `npm install --loglevel=error --prefer-offline --no-audit --progress=false ${pkg}@${versionFromPackageJSON}`,
      { cwd: installDir, stdio: 'pipe', env },
    );
    const installedBinPath = path2.join(
      installDir,
      'node_modules',
      pkg,
      subpath,
    );
    fs2.renameSync(installedBinPath, binPath);
  } finally {
    try {
      removeRecursive(installDir);
    } catch {}
  }
}
function removeRecursive(dir) {
  for (const entry of fs2.readdirSync(dir)) {
    const entryPath = path2.join(dir, entry);
    let stats;
    try {
      stats = fs2.lstatSync(entryPath);
    } catch {
      continue;
    }
    if (stats.isDirectory()) removeRecursive(entryPath);
    else fs2.unlinkSync(entryPath);
  }
  fs2.rmdirSync(dir);
}

async function downloadDirectlyFromNPM(pkg, subpath, binPath) {
  const url = `https://registry.npmjs.org/${pkg}/-/${pkg.replace(
    `${organization}/`,
    '',
  )}-${versionFromPackageJSON}.tgz`;
  console.error(`[${projectName}] Trying to download ${JSON.stringify(url)}`);
  try {
    fs2.writeFileSync(
      binPath,
      extractFileFromTarGzip(await fetch(url), subpath),
    );
    fs2.chmodSync(binPath, 493);
  } catch (e) {
    console.error(
      `[${projectName}] Failed to download ${JSON.stringify(url)}: ${
        (e && e.message) || e
      }`,
    );
    throw e;
  }
}
async function checkAndPreparePackage() {
  const { pkg, subpath } = pkgAndSubpathForCurrentPlatform();
  let binPath;
  try {
    binPath = require.resolve(`${pkg}/${subpath}`);
  } catch (e) {
    console.error(`[${projectName}] Failed to find package "${pkg}" on the file system

This can happen if you use the "--no-optional" flag. The "optionalDependencies"
package.json feature is used by ${projectName} to install the correct binary executable
for your current platform. This install script will now attempt to work around
this. If that fails, you need to remove the "--no-optional" flag to use ${projectName}.
`);
    binPath = downloadedBinPath(pkg, subpath);
    try {
      console.error(
        `[${projectName}] Trying to install package "${pkg}" using npm`,
      );
      installUsingNPM(pkg, subpath, binPath);
    } catch (e2) {
      console.error(
        `[${projectName}] Failed to install package "${pkg}" using npm: ${
          (e2 && e2.message) || e2
        }`,
      );
      try {
        await downloadDirectlyFromNPM(pkg, subpath, binPath);
      } catch (e3) {
        throw new Error(`Failed to install package "${pkg}"`);
      }
    }
  }
}

checkAndPreparePackage();
