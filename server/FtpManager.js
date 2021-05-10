let Client = require('ssh2-sftp-client');
let fsp = require('fs').promises;

let _path = require('path');


function ftpManager() {
    this.queue = [];
    this.ftp = new Client();

    this.connected = false;

    this.getFtpConfig = async () => {
        try {
            const ftp_config = await fsp.readFile(`server/ftp.config`, "utf8");
            this.config = JSON.parse(ftp_config);
            return this.config;
        } catch (err) {
            console.error('ERRRRRRRR: ', err);
            return false;
        }
    }

    this.testFtpConfig = async (config) => {
        try {
            await this.ftp.connect(config.login);
            this.config = config;
            this.ftp.end();

            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
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
        // let progress_path = `${__dirname}/progress/${basename}_upload.txt`;
        let progress_path = _path.join(__dirname, 'progress', `${basename}_upload.txt`);

        fsp.writeFile(progress_path, JSON.stringify(data))
            .then(() => { })
            .catch((err) => { console.error('write err', err) });
    }

    this.processQueue = async () => {
        let a = this.queue.shift();

        try {
            await this.ftp.connect(this.config.login);
            await this.processAction(a.action);
            this.ftp.end();
        }
        catch (err) { console.error(err) };
        a.resolve();

        if (this.queue.length !== 0)
            this.processQueue();
    }
    this.addToQueue = (action) => {
        return new Promise((resolve) => {
            this.queue.push({ action: action, resolve: resolve });
            this.processQueue();
        })

    }
}

module.exports = ftpManager;