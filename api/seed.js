const {MongoClient} = require('mongodb');
const moment = require("moment-timezone");

module.exports = async (request, response) => {
    const client = new MongoClient(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
    await client.connect(async error => {
        if (error) {
            throw error;
        }
    });

    const database = client.db(process.env.MONGODB_DB);
    const collections = await client.db().listCollections().toArray();
    const collectionNames = collections.map(collection => collection.name);

    if (!collectionNames.includes('sources')) {
        await database.collection('sources').insertMany([
            {
                id: 'UCsXVk37bltHxD1rDPwtNM8Q',
                name: 'Kurzgesagt',
                type: 'channel',
            },
            {
                id: 'PL2aBZuCeDwlQiDSAaW1y0mOU8FC2f8v3g',
                name: 'We Asked a NASA Expert',
                type: 'playlist',
            }
        ]);
    }

    if (!collectionNames.includes('storage')) {
        await database.collection('storage').insertMany([
            {
                name: 'code',
                value: null,
            },
            {
                name: 'access_token',
                value: null,
            },
            {
                name: 'last_sync',
                value: moment().utc().format(),
            }
        ]);
    }

    await client.close();

    return response.send("OK");
};
