const glob = require('glob');
var Glob = require("glob").Glob
const sharp = require('sharp');
const fs = require('fs').promises;
let pathToFfmpeg = require('ffmpeg-static');
let { spawn } = require('child_process');
const PATH = require('path');


const optimizeVideo = async (path) => {
    let temp_path = `${PATH.dirname(path)}/_${PATH.basename(path)}`;

    // await fs.rename(path, temp_path);
    const args = [
        '-y',
        '-i', temp_path,
        '-filter:v',
        'fps=fps=29.97',
        path
    ]
    let _proc = spawn(pathToFfmpeg, args);
    _proc.stdout.on('data', function (data) {
        console.log(data);
    });
    _proc.stderr.on('data', function (data) {
        console.log(`err`, data);
    });
    _proc.stderr.setEncoding("utf8")
    _proc.on('close', async () => {
        console.log("CONVERTING DONE: ", path);
        await fs.unlink(temp_path);
    })
}

const optimizeImage = async (path) => {
    if (path.includes('.png')) {
        let newPath = path.replace('.png', '.jpg');
        await sharp(path).toFormat('jpg').toFile(newPath);
        await fs.unlink(path)
    }
}



const getAllMedia = () => {
    let images = [];
    let videos = [];

    let g = new Glob("../postneon.com/projects/*", { mark: true, sync: true });
    g.found.forEach(project => {
        g = new Glob(`${project}/Image/desktop/*`, { mark: true, sync: true });
        g.found.forEach(m => images.push(m));
        g = new Glob(`${project}/Image/mobile/*`, { mark: true, sync: true });
        g.found.forEach(m => images.push(m));

        g = new Glob(`${project}/Video/desktop/*`, { mark: true, sync: true });
        g.found.forEach(m => videos.push(m));
        g = new Glob(`${project}/Video/mobile/*`, { mark: true, sync: true });
        g.found.forEach(m => videos.push(m));
    })
    return { images, videos }
}

const optimizeMedia = ({ images, videos }) => {
    const optimizeImages = () => {
        images.forEach(image => {
            optimizeImage(image);
        })
    }

    const optimizeVideos = async () => {
        console.log(videos);
        await videos.reduce(function (p, video) {
            return p.then(function (results) {
                console.log(video);
                return optimizeVideo(video);
            });
        }, Promise.resolve([]));
        console.log('ok');
    }
    optimizeImages(images);
    optimizeVideos(videos);
}

let media = getAllMedia();
console.log(media);
optimizeMedia(media);







