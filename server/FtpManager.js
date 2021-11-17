let Client = require('ssh2-sftp-client');
let fs = require('fs');
let fsp = fs.promises;

let _path = require('path');
const log = require('electron-log');
let userDataPath = require('electron').app.getPath('userData');
let localStoragePath = userDataPath + '/Local Storage'



function ftpManager() {
    this.queue = [];
    this.ftp = new Client();
    this.connected = false;
    this.processing = false;

    this.getFtpConfig = async () => {
        try {
            const ftp_config = await fsp.readFile(`${userDataPath}/Local Storage/ftp.config`, "utf8");
            console.log("CONFIG IS ", ftp_config);
            this.config = JSON.parse(ftp_config);
            return this.config;
        } catch (err) {
            console.error('ERRRRRRRR: ', err);
            return false;
        }
    }

    this.testFtpConfig = async (config) => {
        return new Promise((resolve) => {
            log.info('testFTPConfig', config);

            this.ftp.connect(config.login).then(() => {
                log.info('could connect to ftp');
                this.config = config;
                this.ftp.end();
                resolve(true);
            }).catch(err => {
                log.error(err, 'catch error');
                console.error(err);
                resolve(false);
            });
        })

    }

    this.processAction = async (action) => {
        switch (action.type) {
            case 'put':
                return await this.ftp.put(action.local, action.remote);
            case 'delete':
                return await this.ftp.delete(action.remote);
            case 'fastPut':
                return this.ftp.fastPut(
                    action.local,
                    action.remote,
                    {
                        autoClose: false,
                        step: action.progress
                    }
                )
            case 'mkdir':
                return await this.ftp.mkdir(action.remote);
            case 'rmdir':
                return await this.ftp.rmdir(action.remote, true);
            default:
                break;
        }
    }

    this.progressUpload = (basename, progress, filesize, format) => {
        let percent = Math.round(progress / filesize * 100 * 100) / 100;
        let data = { percent: percent, format: format };
        console.log('progressUpload', data);
        let progress_path = _path.join(localStoragePath, 'progress', `${basename}_upload.txt`);

        fsp.writeFile(progress_path, JSON.stringify(data))
            .then(() => { })
            .catch((err) => { console.error('write err', err) });
    }

    this.processQueue = async () => {
        console.log('processAction', this.queue);

        let a = this.queue.shift();

        this.processing = true;

        try {
            await this.ftp.connect(this.config.login);
            await this.processAction(a.action);
            console.log('processQueueu', a, ' is finished');
            this.ftp.end();
        }
        catch (err) {
            console.error(err)
        };
        this.processing = false;

        a.resolve();

        if (this.queue.length !== 0)
            this.processQueue();
    }
    this.addToQueue = (action) => {
        return new Promise((resolve) => {
            this.queue.push({ action: action, resolve: resolve });
            if (!this.processing)
                this.processQueue();
        })

    }
}

module.exports = ftpManager;