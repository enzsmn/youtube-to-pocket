const moment = require('moment-timezone');
const {MongoClient} = require('mongodb');

module.exports = async (request, response) => {
    const client = new MongoClient(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
    client.connect(async error => {
        if (error) {
            throw error;
        }

        const database = client.db(process.env.MONGODB_DB);

        const storage = database.collection('storage');
        const lastSync = (await storage.findOne({name: 'last_sync'})).value;
        const lastSyncLocal = moment(lastSync).tz('Europe/Brussels').format('Y-MM-DD HH:mm:ss');

        const logs = database.collection('logs');
        const lastVideos = await logs.find({}).sort({$natural: -1}).limit(5).toArray();
        const lastVideosMapped = lastVideos.map(video => ({
            source: video.source,
            url: `https://www.youtube.com/watch?v=${video.video}`,
            date: moment(video.date).tz('Europe/Brussels').format('Y-MM-DD HH:mm:ss'),
        }));

        const totalVideos = await logs.countDocuments();

        return response.json({
            last_sync: lastSyncLocal,
            last_videos: lastVideosMapped,
            total_videos: totalVideos,
        });
    });
};
