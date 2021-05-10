let { spawn } = require('child_process');
let pathToFfmpeg = require('ffmpeg-static');
let sharp = require('sharp');
let path = require('path');
let join = path.join;


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

const optimizeImage = async (_src, _path, _dim, _format) => {
    let newDim = getPowOfDim(_dim, _format);
    let local_path = `${__dirname}/temp/${_format}/${_src}`;
    await sharp(_path).resize({ width: newDim.x, height: newDim.y, fit: sharp.fit.fill }).toFile(local_path);
    return delay(500);
}

const optimizeVideo = (_src, _path, _dim, _format) => {
    console.log("OPTIMIIIIIZE");
    let basename = path.parse(_src).name;
    let newDim = {
        x: getPowOfTwo(_dim.x, _format),
        y: getPowOfTwo(_dim.y, _format)
    }

    let dist_path = `${__dirname}/temp/${_format}/${_src}`;
    let progress_path = `${__dirname}/progress/${basename}.txt`;

    const args = [
        '-i', _path,
        '-vf', `scale=${newDim.x}:${newDim.y}`,
        '-codec:a', 'libmp3lame',
        '-c:v', 'libx264',
        '-movflags', '+faststart',
        dist_path,
        `-progress`, progress_path,
    ]
    console.log('optimize', basename, _src, args);

    let _proc = spawn(pathToFfmpeg, args);

    _proc.stdout.on('data', function (data) {
        console.log(data);
    });

    _proc.stderr.on('data', function (data) {
        console.log(`err`, data);
    });


    _proc.stderr.setEncoding("utf8")

    _proc.on('close', function () {
        console.log("DONES!");
    })
}


const optimizeMedia = (data) => {
    return new Promise((resolve) => {
        let type = data.type;
        let path = data.path;
        let dimensions = data.dimensions;
        let src = data.src;
        let format = data.format;
        let transparency = data.transparency;

        if (type === 'video') {
            optimizeVideo(src, path, dimensions, format);
            resolve();
        }
        if (type === 'image') {
            optimizeImage(src, path, dimensions, format, transparency)
                .then(() => {
                    resolve();
                })
        }
    })
}
module.exports = optimizeMedia;

// export default optimizeMedia;