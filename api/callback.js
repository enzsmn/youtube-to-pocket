const axios = require('axios');
const qs = require('qs');
const {MongoClient} = require('mongodb');

module.exports = async (request, response) => {
    const client = new MongoClient(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
    await client.connect(async error => {
        if (error) {
            throw error;
        }

        const database = client.db(process.env.MONGODB_DB);
        const storage = database.collection('storage');
        const code = (await storage.findOne({name: 'code'})).value;

        axios.post('https://getpocket.com/v3/oauth/authorize', {
            consumer_key: process.env.POCKET_CONSUMER_KEY,
            code: code,
        }).then(async response2 => {
            const accessToken = qs.parse(response2.data).access_token;

            await storage.updateOne({name: 'access_token'}, {$set: {value: accessToken}}, {upsert: true});
            await client.close();

            response.json({
                accessToken,
                code,
            });
        });
    });
};
