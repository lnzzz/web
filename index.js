const express = require('express');
var ejs = require('ejs');
var fs = require('fs');

const port = 3000;

const { subHours } = require('date-fns');

const { MongoClient } = require('mongodb');
const config = require('config');

const url = config.mongo.url;
const client = new MongoClient(url);
const dbName = 'streamstats';
const service = require('./services/data');

const app = express();
app.use(express.static('public'));

function adjustDate(date) {
  const newDate = subHours(date, 3);
  return newDate.getHours();
}

function getByIndex(index, array, channel) {
  const item = (array[index].find(item => item._id.channel.toLowerCase() === channel.toLowerCase()))
  return (item) ? item.totalViewCount : 0;
}


app.get('/', async (req, res) => {
    await client.connect();
    const db = client.db(dbName);
    const channelStatsCol = db.collection('channel-stats');  
    const maxPerDay = await service.getMaxDay(channelStatsCol);
    
    const maxPerDayTwitch = await service.getMaxDay(channelStatsCol, 'twitch');
    const maxPerDayYoutube = await service.getMaxDay(channelStatsCol, 'youtube');
    
    const maxPerMorning = await service.getMaxBetweenHours(channelStatsCol, 7, 10);
    const maxPerMorningTwitch = await service.getMaxBetweenHours(channelStatsCol, 7, 10, 'twitch');
    const maxPerMorningYoutube = await service.getMaxBetweenHours(channelStatsCol, 7, 10, 'youtube');

    const maxPerMidday = await service.getMaxBetweenHours(channelStatsCol, 10, 14);
    const maxPerMiddayTwitch = await service.getMaxBetweenHours(channelStatsCol, 10, 14, 'twitch');
    const maxPerMiddayYoutube = await service.getMaxBetweenHours(channelStatsCol, 10, 14, 'youtube');

    const maxPerAfternoon = await service.getMaxBetweenHours(channelStatsCol, 14, 18);
    const maxPerAfternoonTwitch = await service.getMaxBetweenHours(channelStatsCol, 14, 18, 'twitch');
    const maxPerAfternoonYoutube = await service.getMaxBetweenHours(channelStatsCol, 14, 18, 'youtube');

    const no_data_str = 'sin datos';

    const maxDay = maxPerDay[0] || [no_data_str, 0];
    const maxDayTwitch = maxPerDayTwitch[0] || [no_data_str, 0];
    const maxDayYoutube = maxPerDayYoutube[0] || [no_data_str, 0];

    const maxMorning = maxPerMorning[0] || [no_data_str, 0];
    const maxMorningTwitch = maxPerMorningTwitch[0] || [no_data_str, 0];
    const maxMorningYoutube = maxPerMorningYoutube[0] || [no_data_str, 0];

    const maxMidday = maxPerMidday[0] || [no_data_str, 0];
    const maxMiddayTwitch = maxPerMiddayTwitch[0] || [no_data_str, 0];
    const maxMiddayYoutube = maxPerMiddayYoutube[0] || [no_data_str, 0];

    const maxAfternoon = maxPerAfternoon[0] || [no_data_str, 0];
    const maxAfternoonTwitch = maxPerAfternoonTwitch[0] || [no_data_str, 0];
    const maxAfternoonYoutube = maxPerAfternoonYoutube[0] || [no_data_str, 0];

    const last10 = await service.getLast10Grouped(channelStatsCol);
    
    const htmlContent = fs.readFileSync('templates/main.ejs', 'utf8');
    const htmlRenderized = ejs.render(htmlContent, {
        filename: 'example.ejs',
        data: {
            adjustDate: adjustDate,
            getByIndex: getByIndex,
            totals: {
                maxDay,
                maxMorning,
                maxMidday,
                maxAfternoon,
                maxDayTwitch,
                maxDayYoutube,
                maxMorningTwitch,
                maxMorningYoutube,
                maxMiddayTwitch,
                maxMiddayYoutube,
                maxAfternoonTwitch,
                maxAfternoonYoutube
            },
            values: last10
        }
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(htmlRenderized);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
})
