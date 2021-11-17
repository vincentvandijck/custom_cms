const electron = require('electron');
const fs = require('fs')
const process = require('process');
const debug = require('electron-debug');

const { isPackaged } = require('electron-is-packaged');


const Server = require('./server/server.js');
const { autoUpdater } = require("electron-updater");
const log = require('electron-log');
const userDataPath = electron.app.getPath('userData');


const { ipcMain, Menu, app, protocol, BrowserWindow } = require('electron');

let server = new Server();

const path = require('path');

log.info('App starting...');


function initAutoUpdater() {
    return new Promise((resolve) => {

        autoUpdater.logger = log;
        autoUpdater.logger.transports.file.level = 'info';

        autoUpdater.on('checking-for-update', () => {

            console.info('Checking for update...');
        })
        autoUpdater.on('update-available', (info) => {
            let progress = new Progress();
            progress.sendStatusToWindow('downloading update');

            autoUpdater.on('download-progress', (progressObj) => {
                progress.sendStatusToWindow(progressObj.percent, 'progress');
            })
            autoUpdater.on('update-downloaded', (info) => {
                progress.sendStatusToWindow('download complete');
                setTimeout(() => {
                    autoUpdater.quitAndInstall();
                }, 1500)
            });
            autoUpdater.on('error', (err) => {
                progress.sendStatusToWindow('Error in auto-updater. ' + err);
            })
        })
        autoUpdater.on('update-not-available', (info) => {
            resolve();
        })

        autoUpdater.checkForUpdates()
    })
}

function Window({ width, height }) {
    this.close = () => {
        _window.close();
    }

    let _window = new BrowserWindow({
        width: width, height: height,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegrationInWorker: true,
            webSecurity: false,
        },
        icon: __dirname + '/favicon.ico'
    });
    return _window;
}

function Program() {
    let _window = new Window({ width: 1200, height: 900 });
    // _window.setMenu(null);

    const template = [
        {
            label: "Update Ftp Config",
            click: () => {
                FtpConfigPrompt();
                _window.close();
            }
        },
        {
            label: 'Debug',
            click: () => {
                _window.webContents.openDevTools()
            }
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    log.info('open ', userDataPath + '/server/ftp.config');
    fs.readFile(`${userDataPath}/Local Storage/ftp.config`, 'utf8', function (err, data) {
        if (err) {
            console.error(err);
            log.error(err);
            return;
        }
        log.info(data);
        data = JSON.parse(data);
        _window.loadURL(data.path.url + "/cms");
    });
}

function FtpConfigPrompt() {
    let _window = new Window({ width: 600, height: 310 });
    console.log(`file://${__dirname}/ftp_config.html`);

    _window.loadURL(`file://${__dirname}/ftp_config.html`);
    _window.setMenu(null);
    _window.setResizable(false)

    // _window.setMenu(null);
    ipcMain.on(`config-finished`, function (e, args) {
        let program = new Program();
        _window.close();
    })


    _window.webContents.on('did-finish-load', async () => {
        let config = await server.ftpManager.getFtpConfig();
        console.log('config: ', config);
        _window.webContents.send('existing-config', config);
        _window.webContents.send('ping', 'whoooooooh!')
    })
}


function Progress() {
    let _window = new Window({ width: 400, height: 100 });
    _window.setMenu(null);
    _window.loadURL(`file://${__dirname}/progress.html`);
    /* _window.webContents.on('did-finish-load', () => {
        this.sendStatusToWindow(100, 'progress');
    }) */

    this.sendStatusToWindow = (text, type = 'message') => {
        log.info('sendStatusToWindow', text);
        _window.webContents.send(type, text);
    }
}

async function init() {
    // check autoupdater
    if (isPackaged) {
        await initAutoUpdater();
    }

    console.log(userDataPath, __dirname);

    if (!fs.existsSync(`${userDataPath}/Local Storage/ftp.config`)) {
        FtpConfigPrompt();
    } else {
        protocol.registerFileProtocol('file', (request, callback) => {
            const pathname = decodeURI(request.url.replace('file:///', ''));
            callback(pathname);
        });

        protocol.registerFileProtocol('safe', (request, callback) => {
            const pathname = decodeURIComponent(request.url.replace('safe://', ''));
            callback(pathname);
        });

        Program();
    }
}

app.on('ready', init);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});