import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import Fs from 'node:fs';
import Path from 'node:path';

type TWatermarkOptions = {
  watermarkWidth?: number;
  watermarkHeight?: number;
  offsetX?: number | string;
  offsetY?: number;
};

type TWatermarkInput = {
  filePath: string;
  watermarkPath: string;
  outputPath: string;
};

export class Watermark {
  private filePath: string;
  private watermarkPath: string;
  private outputPath: string;

  constructor({ filePath, watermarkPath, outputPath }: TWatermarkInput) {
    this.filePath = filePath;
    this.watermarkPath = watermarkPath;
    this.outputPath = outputPath;
  }

  public build(options: TWatermarkOptions = {}): Promise<void> {
    const {
      watermarkWidth = 196,
      watermarkHeight = 32,
      offsetX = 15,
      offsetY = 45
    } = options;

    return new Promise((resolve, reject) => {
      ffmpeg.setFfmpegPath(ffmpegPath.path);
      ffmpeg()
        .input(this.filePath)
        .input(this.watermarkPath)
        .complexFilter(
          [
            `[0:v]scale=iw:ih[bg];`,
            `[1:v]scale=${watermarkWidth}:${watermarkHeight}:flags=lanczos[wm];`,
            `[bg][wm]overlay=${offsetX}:${offsetY}`
          ].join('')
        )
        .videoCodec('libx264')
        .audioBitrate('128k')
        .videoBitrate('450k')
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('end', () => {
          console.log('✅ Watermark applied successfully!');
          return resolve();
        })
        .on('error', (err) => {
          console.error('❌ Error applying watermark:', err);
          return reject(err);
        })
        .save(this.outputPath);
    });
  }
}

const video = new Watermark({
  filePath: 'public/bbb-b.mp4',
  watermarkPath: 'public/watermark.jpg',
  outputPath: 'public/output.mp4'
});

void video.build({
  watermarkWidth: 196,
  watermarkHeight: 32,
  offsetX: 15,
  offsetY: 45
});
