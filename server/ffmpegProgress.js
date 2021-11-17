
let fsp = require('fs').promises;
let path = require('path');

let localStoragePath = require('electron').app.getPath('userData') + '/Local Storage';

const ffmpegProgress = async (src) => {
    let basename = path.parse(src).name;
    let progress_path = `${localStoragePath}/progress/${basename}.txt`;
    let content = await fsp.readFile(progress_path, 'utf8');
    if (!content) return;
    var progresses = content.match(/progress=(.*?)\n/g);
    let progress = progresses ? progresses[progresses.length - 1].replace("progress=", "").replace("\n", "") : null;
    if (progress) { // Did it match?
        let times = content.match(/out_time_ms=(.*?)\n/g);
        let time = times ? times[times.length - 1].replace("out_time_ms=", "").replace("\n", "") : null;
        if (progress === 'end') fsp.unlink(progress_path);
        return ({ status: progress, time: time, completed: progress === 'end' ? true : false });
    } else {
        return ({ status: 'initializing', time: 0, completed: false });
    }
}

module.exports = ffmpegProgress;