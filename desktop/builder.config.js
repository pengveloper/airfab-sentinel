// electron-builder configuration.
// The Store identity below is the one Partner Center assigned when the name "Sentinel Lab" was
// reserved (Product identity page). These values are public: they are written into every package
// manifest. Environment variables can override them for a fork or a test identity.
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
    identityName: env.APPX_IDENTITY_NAME || 'Pengveloper.SentinelLab',
    publisher: env.APPX_PUBLISHER || 'CN=51D09130-0EBA-4F7D-8E24-51F9EC2B32F3',
    publisherDisplayName: env.APPX_PUBLISHER_DISPLAY_NAME || 'Pengveloper',
    backgroundColor: '#05080d',
    languages: ['ko-KR', 'en-US'],
    capabilities: ['runFullTrust', 'privateNetworkClientServer'],
    artifactName: 'SentinelLab-${version}-store.${ext}',
  },
  linux: { target: [{ target: 'dir' }], category: 'Development' },
  mac: { target: [{ target: 'dir' }], category: 'public.app-category.developer-tools' },
};
