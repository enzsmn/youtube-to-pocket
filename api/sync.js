const axios = require('axios');
const moment = require('moment-timezone');
const {MongoClient} = require('mongodb');
const {google} = require('googleapis');
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
});

let syncStart;
let client;
let storageCollection;
let sourcesCollection;
let logsCollection;
let sources;
let accessToken;
let lastSync;

module.exports = async (request, response) => {
    syncStart = moment().utc().format();

    await connectToDatabase();

    await loadData();

    const videos = [];
    videos.push(...await getChannelVideos());
    videos.push(...await getPlaylistVideos());

    await writeLogs(videos);

    await addToPocked(videos);

    await updateLastSync();

    await client.close();

    return response.json({
        videos: videos.length,
    });
};

async function connectToDatabase() {
    return new Promise(resolve => {
        client = new MongoClient(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
        client.connect(async error => {
            if (error) {
                throw error;
            }

            const database = client.db(process.env.MONGODB_DB);
            storageCollection = database.collection('storage');
            sourcesCollection = database.collection('sources');
            logsCollection = database.collection('logs');

            resolve();
        });
    });
}

async function loadData() {
    accessToken = (await storageCollection.findOne({name: 'access_token'})).value;
    lastSync = (await storageCollection.findOne({name: 'last_sync'})).value;
    sources = (await sourcesCollection.find({}).toArray());
}

async function updateLastSync() {
    await storageCollection.updateOne({name: 'last_sync'}, {$set: {value: syncStart}}, {upsert: true});
}

async function getChannelVideos() {
    const channels = sources.filter(s => s.type === 'channel');

    const videos = [];

    for (const channel of channels) {
        const results = await youtube.search.list({
            part: 'id',
            channelId: channel.id,
            publishedAfter: lastSync,
            type: 'video',
        });

        for (const video of results.data.items) {
            videos.push({
                id: video.id.videoId,
                source: channel.name,
            });
        }
    }

    return videos;
}

async function getPlaylistVideos() {
    const playlists = sources.filter(s => s.type === 'playlist');

    const videos = [];

    for (const playlist of playlists) {
        let pageToken;
        do {
            const body = {
                part: 'id,snippet',
                playlistId: playlist.id,
                maxResults: 50,
            }
            if (pageToken) {
                body.pageToken = pageToken;
            }
            const results = await youtube.playlistItems.list(body);

            for (const video of results.data.items) {
                if (moment(video.snippet.publishedAt).isAfter(lastSync)) {
                    videos.push({
                        id: video.snippet.resourceId.videoId,
                        source: playlist.name,
                    });
                }
            }

            pageToken = results.data.nextPageToken;
        } while (pageToken);
    }

    return videos;
}

async function writeLogs(videos) {
    if (videos.length === 0) {
        return;
    }

    const data = videos.map((video) => ({
        date: moment().format(),
        source: video.source,
        video: video.id,
    }));

    await logsCollection.insertMany(data);
}

async function addToPocked(videos) {
    return new Promise(resolve => {
        let promises = [];
        videos.forEach(video => {
            promises.push(
                axios.post(
                    'https://getpocket.com/v3/add',
                    {
                        url: `https://www.youtube.com/watch?v=${video.id}`,
                        title: video.source,
                        consumer_key: process.env.POCKET_CONSUMER_KEY,
                        access_token: accessToken,
                    }
                ),
            );
        });
        Promise.all(promises).then(() => {
            resolve();
        });
    });
}
