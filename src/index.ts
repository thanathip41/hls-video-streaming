import express, { Request, Response } from 'express';
import pathSystem from 'path';
import fsSystem from 'fs';
import cors from 'cors';

import { decryptFileToBuffer } from './utils'

const app = express();
const port = 3000;
app.use(cors());

app.get('/', (req, res) => {
    res.sendFile(pathSystem.join(pathSystem.resolve(), 'public', 'index.html'));
  });
app.get('/playlists/*', async (req: Request, res: Response) => {
    
    const filePath = pathSystem.join(pathSystem.resolve(), '@playlists', req.params[0]);

    if (!fsSystem.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    try {
        
        const decryptedBuffer = await decryptFileToBuffer(filePath);

        res.setHeader('Content-Type', 'video/MP2T');
        res.setHeader('Content-Disposition', `inline; filename="${req.params[0]}"`);

        res.write(decryptedBuffer);

        return res.end();

    } catch (error) {
        return res.status(500).send('Server error');
    }
});

app.get('/hls.m3u8', (req: Request, res: Response) => {
    const playlistFilePath = pathSystem.join(pathSystem.resolve(),'@hls','hls.m3u8');
    if (!fsSystem.existsSync(playlistFilePath)) {
        return res.status(404).send('Playlist not found');
    }

    let playlistData = fsSystem.readFileSync(playlistFilePath, 'utf8');

    const modifiedContent = playlistData.replace(/(segment_\d+\.ts)/g, `http://localhost:${port}/hls/$1`);
    return res.send(modifiedContent);
});

for (const reso of [144, 240, 480, 720, 1080]) {
    app.get(`/hls-${reso}p.m3u8`, (req: Request, res: Response) => {
        const playlistFilePath = pathSystem.join(pathSystem.resolve(), '@hls', `hls-${reso}p.m3u8`);
        if (!fsSystem.existsSync(playlistFilePath)) {
            return res.status(404).send('Playlist not found');
        }

        let playlistData = fsSystem.readFileSync(playlistFilePath, 'utf8');

        const modifiedContent = playlistData.replace(/(segment_\d+\.ts)/g, `http://localhost:${port}/playlists/${reso}p/$1`);
        return res.send(modifiedContent);
    });
}

app.listen(port, () => {
    console.log(`HLS server running at http://localhost:${port}`);
});
