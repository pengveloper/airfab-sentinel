// electron-builder configuration.
// Store identity values come from Partner Center after the app name is reserved; until then the
// placeholders below produce a package that builds and installs for local testing only.
const env = process.env;

module.exports = {
  appId: 'io.github.pengveloper.sentinellab',
  productName: 'Sentinel Lab',
  copyright: 'Copyright (c) 2026 pengveloper',
  directories: { output: 'dist', buildResources: 'desktop/build' },
  files: ['package.json', 'desktop/main/**', 'desktop/preload/**', 'desktop/build/icon.png', 'console/**', '!console/**/*.map'],
  asar: true,
  compression: 'normal',
  npmRebuild: false,
  // Hardening switches burned into the executable at build time.
  electronFuses: {
    runAsNode: false,                               // the app binary cannot be used as a general Node runtime
    enableNodeOptionsEnvironmentVariable: false,    // NODE_OPTIONS is ignored
    enableNodeCliInspectArguments: false,           // no --inspect debugging port
    enableCookieEncryption: true,
    enableEmbeddedAsarIntegrityValidation: true,    // the app archive is checked against a hash in the binary
    onlyLoadAppFromAsar: true,                      // no loose app folder can replace the archive
    grantFileProtocolExtraPrivileges: false,
  },
  win: {
    icon: 'desktop/build/icon.ico',
    target: [{ target: 'appx', arch: ['x64'] }, { target: 'zip', arch: ['x64'] }],
    artifactName: 'SentinelLab-${version}-win-${arch}.${ext}',
  },
  appx: {
    applicationId: 'SentinelLab',
    displayName: 'Sentinel Lab',
    identityName: env.APPX_IDENTITY_NAME || 'pengveloper.SentinelLab',
    publisher: env.APPX_PUBLISHER || 'CN=pengveloper',
    publisherDisplayName: env.APPX_PUBLISHER_DISPLAY_NAME || 'pengveloper',
    backgroundColor: '#05080d',
    languages: ['ko-KR', 'en-US'],
    capabilities: ['runFullTrust', 'privateNetworkClientServer'],
    artifactName: 'SentinelLab-${version}-store.${ext}',
  },
  linux: { target: [{ target: 'dir' }], category: 'Development' },
  mac: { target: [{ target: 'dir' }], category: 'public.app-category.developer-tools' },
};
