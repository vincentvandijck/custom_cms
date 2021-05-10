const electron = require('electron');
const fs = require('fs')
const process = require('process');

const isDev = require('electron-is-dev');


const Server = require('./server/server.js');
const { autoUpdater } = require("electron-updater");
const log = require('electron-log');

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
    _window.setMenu(null);

    const template = [
        {
            label: "Ftp Config",
            submenu: [
                {
                    label: 'Update',
                    click: async () => {
                        FtpConfigPrompt();
                        _window.close();
                    }
                }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));

    fs.readFile(__dirname + '/server/ftp.config', 'utf8', function (err, data) {
        if (err) {
            return console.error(err);
        }
        data = JSON.parse(data);
        _window.loadURL(data.path.url + "/cms");
    });
}

function FtpConfigPrompt() {
    let _window = new Window({ width: 600, height: 310 });
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
    let _window = new Window({ width: 1200, height: 300 });
    _window.setMenu(null);
    _window.loadURL(`file://${__dirname}/progress.html`);
    _window.webContents.on('did-finish-load', () => {
        sendStatusToWindow(100, 'progress');
    })

    this.sendStatusToWindow = (text, type = 'message') => {
        log.info(text);
        _window.webContents.send(type, text);
    }
}

async function init() {
    // check autoupdater
    if (!isDev) {
        await initAutoUpdater();
    }

    if (!fs.existsSync(__dirname + "/server/ftp.config")) {
        FtpConfigPrompt();
    } else {
        protocol.registerFileProtocol('file', (request, callback) => {
            const pathname = decodeURI(request.url.replace('file:///', ''));
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