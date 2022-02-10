const axios = require('axios');
const qs = require('qs');
const {MongoClient} = require('mongodb');

module.exports = async (request, response) => {
    const redirectURI = `http://${process.env.VERCEL_URL}/callback`;

    await axios.post('https://getpocket.com/v3/oauth/request', {
        consumer_key: process.env.POCKET_CONSUMER_KEY,
        redirect_uri: redirectURI,
    }).then(async response2 => {
        const code = qs.parse(response2.data).code;

        const client = new MongoClient(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
        await client.connect(async error => {
            if (error) {
                throw error;
            }

            const database = client.db(process.env.MONGODB_DB);
            const storage = database.collection('storage');
            await storage.updateOne({name: 'code'}, {$set: {value: code}}, {upsert: true});
            await client.close();

            const redirect = `https://getpocket.com/auth/authorize?request_token=${code}&redirect_uri=${redirectURI}`;

            response.json({
                code,
                redirect,
            });
        });
    });
};
