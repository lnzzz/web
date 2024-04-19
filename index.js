const ejs = require('ejs');
const fs = require('fs');
const crypto = require('crypto');
const config = require('config');
const uuid = require('uuid').v4;

const express = require('express');
const { expressjwt:jwt } = require('express-jwt');
const session = require('express-session');

const { subHours } = require('date-fns');
const { MongoClient } = require('mongodb');

const jsonwebtoken = require('jsonwebtoken');
const bodyParser = require('body-parser');

const port = 3000;
const url = config.mongo.url;
const client = new MongoClient(url);
const dbName = 'streamstats';

const statsService = require('./services/data');
const authService = require('./services/auth');
const channelService = require('./services/channels');

const app = express();

app.use(express.static('public'));
app.use(bodyParser.json());
const urlEncodedBodyParser = bodyParser.urlencoded({ extended: true });

app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false
  }
}));

app.use(jwt({ secret: config.jwt.secretKey, algorithms: ["HS256"] }).unless({ path: ['/', '/token', '/login', '/logout'] }));

function adjustDate(date) {
  const newDate = subHours(date, 3);
  return newDate.getHours();
}

function getByIndex(index, array, channel) {
  const item = (array[index].find(item => item._id.channel.toLowerCase() === channel.toLowerCase()))
  return (item) ? item.totalViewCount : 0;
}

function getLink(channelName, channelsData, platform, returnDefault=true) {

  const ch = channelsData.find((item) => item.name === channelName);
  const chP = ch.items.find((item) => item.platform === platform);

  if (platform === 'youtube' && chP.hasOwnProperty('channelUri') && chP.channelUri) {
    return chP.channelUri;
  }

  if (chP && platform === 'twitch') {
    return `https://twitch.tv/${chP.id}`;
  } else {
    if (returnDefault === true) {
      return getLink(channelName, channelsData, 'youtube');
    }
  }
}

const jsonMiddleware = (req, res, next) => {
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(400).json({ error: 'Content-Type must be application/json' });
  }
  next();
};

app.get('/login', async(req, res) => {
  const htmlContent = fs.readFileSync('templates/login.ejs', 'utf8');
  const htmlRenderized = ejs.render(htmlContent, {
    filename: 'login.ejs'
  });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(htmlRenderized);
});

app.post('/login', urlEncodedBodyParser, async(req, res) => {
  const username = req.body.username || null;
  const password = req.body.password || null;
  const db = client.db(dbName);
  const authCol = db.collection('auth');
  const hashedPwd = crypto.createHash('md5').update(password).digest('hex');
  const auth = await authService.authenticate(username, hashedPwd, authCol);
  if (auth) {
    if (req.body.rememberMe) {
        const rememberMeToken = uuid();
        req.session.rememberMeToken = rememberMeToken;
        res.cookie('remember_me', rememberMeToken, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
    }
    req.session.user = req.body.username;
    res.redirect('/');
  } else {
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          console.error(err);
      } else {
          res.redirect('/');
      }
  });
});


app.get('/', async (req, res) => {
    let auth = false;
    if (req.session.user) {
      auth = true;
    }

    if (req.cookies && req.cookies.remember_me && req.cookies.remember_me === req.session.rememberMeToken) {
      auth = true;
    }

    if (auth === true) {
      const db = client.db(dbName);
      const channelStatsCol = db.collection('channel-stats');
      const channelsCol = db.collection('channels');
      const maxPerDay = await statsService.getMaxDay(channelStatsCol);
      
      const maxPerDayTwitch = await statsService.getMaxDay(channelStatsCol, 'twitch');
      const maxPerDayYoutube = await statsService.getMaxDay(channelStatsCol, 'youtube');
      
      const maxPerMorning = await statsService.getMaxBetweenHours(channelStatsCol, 7, 10);
      const maxPerMorningTwitch = await statsService.getMaxBetweenHours(channelStatsCol, 7, 10, 'twitch');
      const maxPerMorningYoutube = await statsService.getMaxBetweenHours(channelStatsCol, 7, 10, 'youtube');

      const maxPerMidday = await statsService.getMaxBetweenHours(channelStatsCol, 10, 14);
      const maxPerMiddayTwitch = await statsService.getMaxBetweenHours(channelStatsCol, 10, 14, 'twitch');
      const maxPerMiddayYoutube = await statsService.getMaxBetweenHours(channelStatsCol, 10, 14, 'youtube');

      const maxPerAfternoon = await statsService.getMaxBetweenHours(channelStatsCol, 14, 18);
      const maxPerAfternoonTwitch = await statsService.getMaxBetweenHours(channelStatsCol, 14, 18, 'twitch');
      const maxPerAfternoonYoutube = await statsService.getMaxBetweenHours(channelStatsCol, 14, 18, 'youtube');

      const maxPerNight = await statsService.getMaxBetweenHours(channelStatsCol, 18, 23);
      const maxPerNightTwitch = await statsService.getMaxBetweenHours(channelStatsCol, 18, 23, 'twitch');
      const maxPerNightYoutube = await statsService.getMaxBetweenHours(channelStatsCol, 18, 23, 'youtube');

      const last10 = await statsService.getLast10Grouped(channelStatsCol);
      const channelData = await channelService.getChannels(channelsCol);

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

      const maxNight = maxPerNight[0] || [no_data_str, 0];
      const maxNightTwitch = maxPerNightTwitch[0] || [no_data_str, 0];
      const maxNightYoutube = maxPerNightYoutube[0] || [no_data_str, 0];
      
      
      const htmlContent = fs.readFileSync('templates/main.ejs', 'utf8');
      const htmlRenderized = ejs.render(htmlContent, {
          filename: 'example.ejs',
          data: {
              adjustDate: adjustDate,
              getByIndex: getByIndex,
              getLink: getLink,
              channelData: channelData,
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
                  maxAfternoonYoutube,
                  maxNight,
                  maxNightTwitch,
                  maxNightYoutube
              },
              values: last10
          }
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.end(htmlRenderized);
    } else {
      res.redirect('/login');
    }
});



/* api */
app.post('/token', jsonMiddleware, async(req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const db = client.db(dbName);
  const authCollection = db.collection('auth');

  const valid = await authCollection.findOne({ username, password });
  if (valid) {
    const token = jsonwebtoken.sign({ username: username }, config.jwt.secretKey, { expiresIn: '1h' });
    res.json({ token: token });
  } else {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

app.get('/youtube/channels', jsonMiddleware, async(req, res) => {
  const db = client.db(dbName);
  const channelsCol = db.collection('channels');
  const channels = await channelsCol.find({ platform: 'youtube' }).toArray();
  res.status(200).send(channels);
});

app.post('/users', jsonMiddleware, async(req, res) => {
  try {
    const db = client.db(dbName);
    const username = req.body.username;
    const password = req.body.password;
    const authCol = db.collection('auth');
    const hashedPwd = crypto.createHash('md5').update(password).digest('hex');
    const user = await authService.createUser(username, hashedPwd, authCol);
    res.status(200).send(user);
  } catch (err) {
    res.status(400).send({ err: err.message });
  }
});


app.put('/youtube/channel/:name', jsonMiddleware, async(req, res) => {
  const db = client.db(dbName);
  const channelsCol = db.collection('channels');
  const channel = await channelsCol.findOne({ platform: 'youtube', name: req.params.name });
  if (channel) {
    const set = {}
    if (req.body.hasOwnProperty("videoId")) {
      set.videoId = req.body.videoId;
    }

    if (req.body.channelUri) {
      set.channelUri = req.body.channelUri;
    }
    const updated = await channelsCol.updateOne({ _id: channel._id }, { 
      $set: set
    });
    res.status(200).send(updated);

  } else {
    res.status(404).json({ message: 'channel_not_found' });
  }
});

/* end api */

app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  await client.connect();
})
