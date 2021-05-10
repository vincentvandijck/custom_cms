const electron = require('electron');
const fs = require('fs')

const Server = require('./server/server.js');
const { autoUpdater } = require("electron-updater");
const log = require('electron-log');

const { ipcMain } = require('electron')

const app = electron.app;
const protocol = electron.protocol
const BrowserWindow = electron.BrowserWindow;
let mainWindow;

let server = new Server();

const path = require('path');

log.info('App starting...');


function createSafeProtocol() {
    const protocolName = 'safe'
    protocol.registerFileProtocol(protocolName, (request, callback) => {
        const url = request.url.replace(`${protocolName}://`, '')
        try {
            return callback(decodeURIComponent(url))
        }
        catch (error) {
            console.error(error)
        }
    })
}

function initAutoUpdater() {
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';

    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
    })
    autoUpdater.on('update-available', (info) => {
        _progress.create();
        _progress.sendStatusToWindow('downloading update');
    })
    autoUpdater.on('update-not-available', (info) => {
        _program.create()
    })
    autoUpdater.on('error', (err) => {
        _progress.sendStatusToWindow('Error in auto-updater. ' + err);
    })
    autoUpdater.on('download-progress', (progressObj) => {
        _progress.sendStatusToWindow(progressObj.percent, 'progress');
    })
    autoUpdater.on('update-downloaded', (info) => {
        _progress.sendStatusToWindow('download complete');
        setTimeout(() => {
            _progress.close();
        }, 1500)
    });
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

    fs.readFile(__dirname + '/server/ftp.config', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }
        data = JSON.parse(data);
        console.log(data);
        _window.loadURL(data.path.url + "/cms");

        _window.on('closed', function () {
            _window = null;
        });

        _window.webContents.on('did-finish-load', () => {
            // sendStatusToWindow('please');
        })
    });

    /* _window.loadURL('http://localhost:9002/');

    _window.on('closed', function () {
        _window = null;
    });

    _window.webContents.on('did-finish-load', () => {
        // sendStatusToWindow('please');
    }) */
}

function FtpConfigPrompt() {
    let _window = new Window({ width: 600, height: 300 });
    _window.loadURL(`file://${__dirname}/ftp_config.html`);
    // _window.setMenu(null);
    ipcMain.on(`config-finished`, function (e, args) {
        let program = new Program();
        _window.close();
    })
}


/* function Progress() {
    let _window = new Window();

    this.create = () => {
        _window = new BrowserWindow({
            width: 600, height: 200,
            webPreferences: {
                nodeIntegration: true,
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegrationInWorker: true,
                webSecurity: false,
            },
            icon: __dirname + '/favicon.ico'
        });

        _window.setMenu(null);

        _window.loadURL(`file://${__dirname}/progress.html`);


        _window.webContents.on('did-finish-load', () => {
            sendStatusToWindow(100, 'progress');
        })
    }

    this.sendStatusToWindow = (text, type = 'message') => {
        log.info(text);
        _window.webContents.send(type, text);
    }


} */

function init() {

    // check if it has ftp_config

    // check autoupdater
    autoUpdater.checkForUpdatesAndNotify();

    if (!fs.existsSync(__dirname + "/server/ftp.config")) {
        let ftpConfigPrompt = new FtpConfigPrompt();
    } else {
        createSafeProtocol();


        // i think this is useless code but not 100% sure
        protocol.registerFileProtocol('file', (request, callback) => {
            const pathname = decodeURI(request.url.replace('file:///', ''));
            callback(pathname);
        });

        let program = new Program();
    }



}

app.on('ready', init);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});