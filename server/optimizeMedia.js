let { spawn } = require('child_process');
// let pathToFfmpeg = require('ffmpeg-static');
let sharp = require('sharp');
let _path = require('path');
let join = _path.join;

let userDataPath = require('electron').app.getPath('userData');
let localStoragePath = userDataPath + '/Local Storage'

var pathToFfmpeg = ''
if (!__dirname.includes('.asar')) { // If dev
    pathToFfmpeg = require('ffmpeg-static')
} else { // if compiled
    let ext = ''
    if (process.platform === 'win32') ext = '.exe' // if windows
    pathToFfmpeg = _path.join(process.resourcesPath + '/ffmpeg' + ext)
}


const delay = time => new Promise(res => setTimeout(res, time));


const getPowOfTwo = (dim, format) => {
    let powOfTwo = format === 'desktop' ? [2048, 1024, 512, 256, 128] : [512, 256, 128];
    return powOfTwo.reduce(function (prev, curr) {
        return (Math.abs(curr - dim) < Math.abs(prev - dim) ? curr : prev);
    });
}

const getPowOfDim = (dim, format) => {
    return { x: getPowOfTwo(dim.x, format), y: getPowOfTwo(dim.y, format) }
}

const getNewDim = (dim, format) => {
    if (format === 'mobile') {
        return {
            x: dim.x > dim.y ? 854 : 480,
            y: dim.x > dim.y ? 480 : 854,
        }
    } else {
        return {
            x: dim.x > dim.y ? 1920 : 1280,
            y: dim.x > dim.y ? 1280 : 1920,
        }
    }
}

const optimizeImage = async ({ src, path, newDim, format }) => {
    let local_path = `${localStoragePath}/temp/${format}/${src}`;
    await sharp(path).resize({ width: newDim.x, height: newDim.y, fit: sharp.fit.fill }).toFile(local_path);
    return delay(500);
}

const optimizeVideo = ({ src, path, newDim, format }) => {
    console.log('optimizeVideo: ', src, path);
    let basename = _path.parse(src).name;
    let local_path = `${localStoragePath}/temp/${format}/${src}`;
    let progress_path = `${localStoragePath}/progress/${basename}.txt`;

    const args = [
        '-i', path,
        '-vf', `scale=${newDim.x}:${newDim.y}`,
        '-codec:a', 'libmp3lame',
        '-c:v', 'libx264',
        '-movflags', '+faststart',
        local_path,
        `-progress`, progress_path,
    ]

    let _proc = spawn(pathToFfmpeg, args);

    _proc.stdout.on('data', function (data) {
        console.info(data);
    });

    _proc.stderr.on('data', function (data) {
        console.error(`err`, data);
    });

    _proc.stderr.setEncoding("utf8")

    _proc.on('close', function () {
        console.info("DONES!");
    })
}


const optimizeMedia = (data, powOfTwo = false) => {
    return new Promise(async (resolve) => {
        let type = data.type;
        let path = data.path;
        let dimensions = data.dimensions;
        let src = data.src;
        let format = data.format;

        let newDim = powOfTwo ? getPowOfDim(dimensions, format) : getNewDim(dimensions, format);

        if (type === 'video') {
            optimizeVideo({ src, path, newDim, format });
            resolve();
        } else if (type === 'image') {
            await optimizeImage({ src, path, newDim, format });
            resolve();
        }
    })
}
module.exports = optimizeMedia;