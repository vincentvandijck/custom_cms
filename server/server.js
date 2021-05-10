let http = require('http');
let path = require('path');
let favicon = require('serve-favicon');
let join = path.join;
let express = require('express');
let cors = require('cors');
let fetch = require('node-fetch');
let bodyParser = require('body-parser');
let fs = require('fs');
let fsp = fs.promises;
let optimizeMedia = require('./optimizeMedia.js');
let ffmpegProgress = require('./ffmpegProgress.js');
let ftpManager = require('./FTPManager.js');


function Server() {
    const Api = express();
    const HTTP = http.Server(Api);
    this.ftpManager = new ftpManager();
    this.ftpManager.getFtpConfig();

    let inProgress = {
        resize: false,
        upload: false
    }

    const capitalize = (s) => {
        if (typeof s !== 'string') return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }



    Api.use(express.static(join(__dirname, '..', 'public')));
    Api.use(cors());
    Api.use(bodyParser.urlencoded({ extended: true }));
    Api.use(bodyParser.json());
    Api.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
        next();
    });
    Api.post("/testFtpConfig", async (req, res) => {
        console.log(req.body);
        const result = await this.ftpManager.testFtpConfig(req.body);
        console.log('results test are ', result);
        if (result) await fsp.writeFile('./server/ftp.config', JSON.stringify(req.body));
        res.send(result);
    })

    Api.post("/saveFtpConfig", (req, res) => {

        fsp.writeFile('../ftp.config',);
    })
    Api.get("/", (req, res) => {
        res.status(200).send("ok");
    })



    Api.get('/fetch', (req, res) => {
        console.log('CONFIGGGGG', this.ftpManager.config);
        fetch(`${this.ftpManager.config.path.url}/JSON/data.json`)
            .then(res => { return res.json() })
            .then((json) => {
                res.send(json);
            })
    });




    Api.post('/save', (req, res) => {
        let data = req.body;
        let local_path = join(__dirname, 'temp', 'data.json');
        let remote_path = `${this.ftpManager.config.path.root}/JSON/data.json`;
        fsp.writeFile(local_path, JSON.stringify(data), () => { }).then(() => {
            return this.ftpManager.addToQueue({ type: 'put', local: local_path, remote: remote_path });
        }).then((e) => {
            res.send('saved');
        }).catch((err) => {
            res.send(err);
            // res.sendStatus(404);
        })
    })

    Api.post('/resize', (req, res) => {
        inProgress.resize = true;
        let media = req.body;
        optimizeMedia(media).then(() => {
            if (media.type === 'image') {
                inProgress.resize = false;
            };
            res.send({ status: 'ok', media: media });
        });
    });



    Api.post('/delete', (req, res) => {
        let _data = req.body;
        let _media = _data.media;


        let remote_path = `${this.ftpManager.config.path.root}/projects/${_data.project}/${capitalize(_media.type)}/desktop/${_media.src}`;
        this.ftpManager.addToQueue({ type: 'delete', remote: remote_path }).then(() => {
            let remote_path = `${this.ftpManager.config.path.root}/projects/${_data.project}/${capitalize(_media.type)}/mobile/${_media.src}`;
            return this.ftpManager.addToQueue({ type: 'delete', remote: remote_path })
        }).then(() => {
            res.send('deleted');
        }).catch((err) => {
            res.sendStatus(404);
        })
    })

    Api.post('/progressUpload', (req, res) => {
        let src = req.body.src;
        let basename = path.parse(src).name;
        // let progress_path = `./progress/${basename}_upload.txt`;
        let progress_path = join(__dirname, 'progress', `${basename}_upload.txt`);

        fsp.readFile(progress_path, "utf8").then(content => {
            if (!content) res.send({ status: 'uploading', percent: 0 });
            content = JSON.parse(content);
            let status = content.percent > 99 ? 'end' : 'uploading';
            res.send({ status: status, percent: content.percent, format: content.format })
        }).catch((err) => {
            res.send({ status: 'uploading', percent: 0 });
        })
    })

    Api.post('/upload', (req, res) => {
        const uploadMedia = async (_media, format) => {
            console.log('upload media !!!, ', _media);
            let local_path = join(__dirname, 'temp', format, _media.src);
            let remote_path = `${this.ftpManager.config.path.root}/projects/${_media.project}/${capitalize(_media.type)}/${format}/${_media.src}`;
            let basename = path.parse(_media.src).name;
            var filesize = fs.statSync(local_path).size;
            try {

                this.ftpManager.progressUpload(basename, 0, filesize, format)
                /* uploadfile.on('data', function (buffer) {
                    var segmentLength = buffer.length;
                    uploadedSize += segmentLength;
                    console.log("Progress:\t" + ((uploadedSize / f.size * 100).toFixed(2) + "%"));
                }); */
                await this.ftpManager.addToQueue({
                    type: 'fastPut',
                    local: local_path,
                    remote: remote_path,
                    media_type: _media.type,
                    progress: (e) => { console.log('progress yooo ', e) }
                })
                console.log('did it work????????????????');
            } catch (e) {
                console.log('ftp error', e);
            } finally {
                let progress_path = `${__dirname}/progress/${basename}_upload.txt`;
                fsp.writeFile(progress_path, JSON.stringify({ percent: 100, format: format }));
                fs.unlinkSync(local_path);
                return;
            }
        }

        console.log('this happens!!!!!!!');
        let _media = req.body;

        inProgress.upload = true;
        uploadMedia(_media, 'desktop').then(() => {
            return uploadMedia(_media, 'mobile');
        }).then(() => {
            inProgress.upload = false;
            res.send({ sucess: true });
        }).catch((err) => {
            inProgress.upload = false;
            res.send({ sucess: false, error: err });
        })
    })

    Api.get('/log', (req, res) => console.log('GETTT'));

    Api.post('/progressResize', (req, res) => {
        let _src = req.body.src;
        ffmpegProgress(_src).then((progress) => {
            if (progress.completed) {
                inProgress.resize = false;
            };
            res.send(progress);
        })
    })

    Api.post('/addProject', (req, res) => {
        let _project = req.body.project;
        let _base = `${this.ftpManager.config.path.root}/projects/${_project}`;
        let remote_path = _base;
        this.ftpManager.addToQueue({ type: 'mkdir', remote: remote_path }).then(() => {
            let remote_path = `${_base}/Image`;
            return this.ftpManager.addToQueue({ type: 'mkdir', remote: remote_path });
        }).then(() => {
            let remote_path = `${_base}/Image/mobile`;
            return this.ftpManager.addToQueue({ type: 'mkdir', remote: remote_path });
        }).then(() => {
            let remote_path = `${_base}/Image/desktop`;
            return this.ftpManager.addToQueue({ type: 'mkdir', remote: remote_path });
        }).then(() => {
            let remote_path = `${_base}/Video`;
            return this.ftpManager.addToQueue({ type: 'mkdir', remote: remote_path });
        }).then(() => {
            let remote_path = `${_base}/Video/mobile`;
            return this.ftpManager.addToQueue({ type: 'mkdir', remote: remote_path });
        }).then(() => {
            let remote_path = `${_base}/Video/desktop`;
            return this.ftpManager.addToQueue({ type: 'mkdir', remote: remote_path });
        }).then(() => {
            res.send('project added');
        }).catch((err) => {
            res.send(err);
        })
    })

    Api.post('/deleteProject', (req, res) => {
        let _project = req.body.project;
        let _base = `${this.ftpManager.config.path.root}/projects/${_project}`;
        this.ftpManager.addToQueue({ type: 'rmdir', remote: _base })
            .then(() => {
                console.log('delete ')
                res.send('project deleted');
            }).catch((e) => {
                console.log("ERRRORRR", e)
                res.send(e);
            })
    })

    HTTP.listen(9002, () => {
        console.log('listening on *:9002');
    });
}

module.exports = Server