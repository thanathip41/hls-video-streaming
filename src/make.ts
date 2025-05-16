import fsSystem from 'fs';
import pathSystem from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';

import { 
    getVideoDuration , 
    encryptFile , 
    getTotalSizeOfTsFiles , 
    calculateBandwidth , 
    generateMasterPlaylist 
} from './utils'

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

async function processVideoSegments(): Promise<void> {

    const resolutions = [
        144, 
        240, 
        480, 
        // 720, 
        // 1080
    ];
    
    const resolutionMap: { [key: number]: string } = {
        1080: '1980x1080',
        720: '1280x720',
        480: '854x480',
        240: '426x240',
        144: '256x144'
    };

    const videos = fsSystem.readdirSync(pathSystem.join(pathSystem.resolve(), `public`))
    .filter(file => pathSystem.extname(file) === '.mp4')

    for(const videoName of videos) {

        const folder = videoName
        // pathSystem.basename(videoName, pathSystem.extname(videoName));
        const inputFilePath = pathSystem.join(pathSystem.resolve(), `public/${videoName}`);
        const playlistDir = pathSystem.join(pathSystem.resolve(), `@playlists/${folder}`);
        const hlsDir = pathSystem.join(pathSystem.resolve(), `@hls/${folder}`);

        [playlistDir, hlsDir].forEach(dir => {
        if (!fsSystem.existsSync(dir)) {
            fsSystem.mkdirSync(dir, { recursive: true });
        }
        });

        const streams: { bandwidth: number; resolution: string; playlist: string }[] = [];

        const duration = await getVideoDuration(inputFilePath)

        for (const reso of resolutions) {

            
            const playlistDirResolution = pathSystem.join(playlistDir, `${reso}p`);

            if (!fsSystem.existsSync(playlistDirResolution)) {
                fsSystem.mkdirSync(playlistDirResolution, { recursive: true });
            }

            const segmentsPath = pathSystem.join(playlistDirResolution, 'segment_%05d.ts');
            const playlistFilePath = pathSystem.join(hlsDir, `hls-${reso}p.m3u8`);
            const watermarkImagePath = pathSystem.join(pathSystem.resolve(), `public/watermark.png`);

            const overlayPosition = {
                'top-left': '10:10',
                'top-right': 'main_w-overlay_w-10:10',
                'bottom-left': '30:main_h-overlay_h-30',
                'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
            }

            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input(inputFilePath)
                    .input(watermarkImagePath)
                    .complexFilter([
                        '[1:v]scale=-1:48[wm]',
                        `[0:v][wm]overlay=${overlayPosition['bottom-right']}`
                    ])
                    .outputOptions([
                        '-f hls',
                        '-profile:v baseline',
                        '-level 3.0',
                        '-start_number 1',
                        '-hls_time 10',
                        '-hls_list_size 0',
                        '-hls_segment_filename', segmentsPath,
                        '-s', resolutionMap[reso]
                    ])
                    .save(playlistFilePath)
                    .on('end', async () => {
                        try {
                            const files = fsSystem.readdirSync(playlistDirResolution)
                                .filter(file => file.endsWith('.ts'));

                            for (const file of files) {
                                console.log(`Encrypting ${reso}p segment: ${file}`);
                                const inputPath = pathSystem.join(playlistDirResolution, file);
                                const encryptedPath = pathSystem.join(playlistDirResolution, `encrypted_${file}`);
                                await encryptFile(inputPath, encryptedPath);

                                await new Promise<void>((r) => setTimeout(r, 1000));
                                await fsSystem.promises.unlink(inputPath).catch(err => console.error(err));
                                await fsSystem.promises.rename(encryptedPath, inputPath).catch(err => console.error(err));
                            }

                            const sizeInBytes = getTotalSizeOfTsFiles(playlistDirResolution) 

                            const bandwidth = calculateBandwidth(sizeInBytes / (1024 * 1024) , duration)

                            console.log(`${reso}p segments encrypted successfully`);

                            const resolution = resolutionMap[reso];

                            streams.push({
                                bandwidth,
                                resolution,
                                playlist: `hls-${reso}p.m3u8?folder=${folder}`
                            });

                            return resolve();
                        } catch (error) {
                            return reject(error);
                        }
                    })
                    .on('error', (error) => {
                        console.error(`Error during ${reso}p processing:`, error);
                        reject(error);
                    });
            });
        
        }

        generateMasterPlaylist(hlsDir , streams);

    }
}

processVideoSegments()
.then(() => {
    console.log('Process completed successfully');
})
.catch((error) => {
    console.error('Process failed:', error);
});
