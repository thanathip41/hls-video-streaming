import fsSystem from 'fs';
import pathSystem from 'path';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

const ALGORITHM = 'aes-256-cbc';
const CUSTOM_KEY = 'my key';

function getKeyAndIV(): { key: Buffer; iv: Buffer } {
    const hash = crypto.createHash('sha256');
    hash.update(CUSTOM_KEY);
    const key = hash.digest();
    const iv = crypto.createHash('md5').update(CUSTOM_KEY).digest();
    return { key, iv };
}

export function decryptFileToBuffer(inputFile: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const { key, iv } = getKeyAndIV();
            const readStream = fsSystem.createReadStream(inputFile);
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

            const chunks: Buffer[] = [];
            readStream
                .pipe(decipher)
                .on('data', (chunk) => chunks.push(chunk))
                .on('end', () => resolve(Buffer.concat(chunks)))
                .on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

export function encryptFile(inputFile: string, outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const { key, iv } = getKeyAndIV();
            const readStream = fsSystem.createReadStream(inputFile);
            const writeStream = fsSystem.createWriteStream(outputFile);
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            
            readStream
                .pipe(cipher)
                .pipe(writeStream);
                
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
}

export function generateMasterPlaylist(playlistDir : string,streams: { bandwidth: number; resolution: string; playlist: string }[]): void {
    let masterPlaylistContent = '#EXTM3U\n';

    streams.forEach(stream => {

        masterPlaylistContent += `#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=${stream.bandwidth},RESOLUTION=${stream.resolution}\n`;
        masterPlaylistContent += `http://localhost:3000/${stream.playlist}\n\n`;
       
    });
    
    fsSystem.writeFileSync(pathSystem.join(playlistDir, 'hls.m3u8'), masterPlaylistContent.trim());
}

export function getVideoDuration(videoPath : string) : Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          return reject(err);
        }
        const duration = metadata.format.duration;
        resolve(duration ?? 0);
      });
    });
}

export function calculateBandwidth(totalFileSizeMB : number, durationSeconds : number) {
    const fileSizeBits = totalFileSizeMB * 8 * 1024 * 1024;
    return Math.round(fileSizeBits / durationSeconds);
}
  
export function getTotalSizeOfTsFiles(folderPath : string) {
    let totalSizeBytes = 0;

    const files = fsSystem.readdirSync(folderPath);
  
    for (const file of files) {
      const filePath = pathSystem.join(folderPath, file);
  
      if (fsSystem.statSync(filePath).isFile() && file.endsWith('.ts')) {
        totalSizeBytes += fsSystem.statSync(filePath).size;
      }
    }
  
    return totalSizeBytes;
}