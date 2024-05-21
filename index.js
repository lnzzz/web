const ejs = require('ejs');
const fs = require('fs');
const crypto = require('crypto');
const config = require('config');
const uuid = require('uuid').v4;
const multer = require('multer');

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
const twitterLinksService = require('./services/twitterLinks');
const reportsService = require('./services/reports');
const apiService = require('./services/api');

const no_data_str = 'sin datos';

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

app.use(jwt({ secret: config.jwt.secretKey, algorithms: ["HS256"] }).unless({ path: [
  '/', 
  '/token', 
  '/login', 
  '/logout', 
  '/dashboard', 
  '/upload', 
  { url: /^\/images\/twitch\/.*/, methods: ["GET"] }
]}));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/reports/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

const isAuthenticated = async(req) => {
  req.session.returnTo = req.originalUrl;
  let auth = false;
    if (req.session.user) {
      auth = true;
    }

  if (req.cookies && req.cookies.remember_me && req.cookies.remember_me === req.session.rememberMeToken) {
      auth = true;
  }
  return auth;
}

function adjustDate(date) {
  const newDate = subHours(date, 3);
  return newDate.getHours();
}

function getByIndex(index, array, channel) {
  const item = (array[index].find(item => item._id.channel.toLowerCase() === channel.toLowerCase()))
  return (item) ? item.totalViewCount : 0;
}

function getDate(index, array, channel) {
  const item = (array[index].find(item => item._id.channel.toLowerCase() === channel.toLowerCase()))
  if (!item) return null;
  return item._id.date;
}

function getChannelId (channelName, channelsData, platform) {
  const channelId = channelsData.find((item) => item.name === channelName).items.find((item) => item.platform === platform);
  if (channelId !== undefined) {
    return channelId.id;
  } else {
    return null;
  }  
}

function getFilename(channelId, date, platform) {
  const realDate = new Date(date);
  const hours = realDate.getHours() - 3;

  console.log(hours);
  const minutes = String(realDate.getMinutes()).padStart(2, '0');
  const year = realDate.getFullYear();
  const month = realDate.getMonth()+1;
  const day = realDate.getDate();
  const filename = channelId + "_" + year + month + day + "_" + hours + "_" + minutes + ".jpg";
  const fullPath = `./public/images/${platform}/${filename}`;
  if (fs.existsSync(fullPath)) {
    return filename;
  } else {
    return null;
  }
}

function getLink(channelData, platform) {
  for (const i in channelData.items) {
    if (channelData.items[i].platform === platform) {
      if (platform === 'twitch') {
        return `https://twitch.tv/${channelData.items[i].id}`
      }
      return channelData.items[i].channelUri
    }
  }
}

const jsonMiddleware = (req, res, next) => {
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(400).json({ error: 'Content-Type must be application/json' });
  }
  next();
};

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
    req.session.isPremium = auth.premium || false;
    res.redirect(req.session.returnTo || '/');
    delete req.session.returnTo;
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

app.get('/dashboard', async(req, res) => {
  const loggedIn = await isAuthenticated(req);
  if (loggedIn) {
    const webAppToken = jsonwebtoken.sign({ username: 'webApplication' }, config.jwt.secretKey, { expiresIn: '24h' });
    const db = client.db(dbName);
    const channelsCol = db.collection('channels');
    const channelData = await channelService.getChannels(channelsCol);
    const linksData = await twitterLinksService.getLinks(db);
    const reportsData = await reportsService.getReports(db);
    const htmlContent = fs.readFileSync('templates/dashboard/dashboard.ejs', 'utf8');
    const htmlRenderized = ejs.render(htmlContent, {
          filename: 'dashboard.ejs',
          data: {
            adjustDate: adjustDate,
            getByIndex: getByIndex,
            getLink: getLink,
            linksData: linksData,
            reportsData: reportsData,
            channelData: channelData,
            webAppToken
          }
    });
    res.cookie('webAppToken', webAppToken, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false, secure: true });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(htmlRenderized);
  } else {
    res.redirect('/'); 
  }
});


app.get('/', async (req, res) => {
    let auth = false;

    if (req.session.user) {
      auth = true;
    }

    if (req.cookies && req.cookies.remember_me && req.cookies.remember_me === req.session.rememberMeToken) {
      auth = true;
    }

    const db = client.db(dbName);
    const channelStatsCol = db.collection('channel-stats');
    const channelsCol = db.collection('channels');

    let webAppToken;
    let isPremium;
    let statsValues;
    let channelData;
    const platforms = await channelService.getPlatforms(channelsCol);
    let activeReport;

    if (auth === true) {
      webAppToken = jsonwebtoken.sign({ username: 'webApplication' }, config.jwt.secretKey, { expiresIn: '24h' });
      isPremium = req.session.isPremium;
      statsValues = await statsService.getValuesGrouped(channelStatsCol);
      channelData = await channelService.getChannels(channelsCol);
      activeReport = await reportsService.getActiveReport(db);
    }

    const maxes = {
      all: {
        maxDay: (await statsService.getMaxDay(channelStatsCol))[0] || [no_data_str, 0],
        maxMorning: (await statsService.getMaxBetweenHours(channelStatsCol, 6, 10))[0] || [no_data_str, 0],
        maxMidday: (await statsService.getMaxBetweenHours(channelStatsCol, 10, 14))[0] || [no_data_str, 0],
        maxAfternoon: (await statsService.getMaxBetweenHours(channelStatsCol, 14, 18))[0] || [no_data_str, 0],
        maxNight: (await statsService.getMaxBetweenHours(channelStatsCol, 18, 23))[0] || [no_data_str, 0]
      }
    }

    for (const i in platforms) {
      maxes[platforms[i]] = {
        maxDay: (await statsService.getMaxDay(channelStatsCol, platforms[i]))[0] || [no_data_str, 0],
        maxMorning: (await statsService.getMaxBetweenHours(channelStatsCol, 6, 10, platforms[i]))[0] || [no_data_str, 0],
        maxMidday: (await statsService.getMaxBetweenHours(channelStatsCol, 10, 14, platforms[i]))[0] || [no_data_str, 0],
        maxAfternoon: (await statsService.getMaxBetweenHours(channelStatsCol, 14, 18, platforms[i]))[0] || [no_data_str, 0],
        maxNight: (await statsService.getMaxBetweenHours(channelStatsCol, 18, 23, platforms[i]))[0] || [no_data_str, 0]
      }
    }

    const maxDayLink = await twitterLinksService.getLink(db, 'max-day');
    const maxMorningLink = await twitterLinksService.getLink(db, 'max-morning');
    const maxMiddayLink = await twitterLinksService.getLink(db, 'max-midday');
    const maxAfternoonLink = await twitterLinksService.getLink(db, 'max-afternoon');
    const maxNightLink = await twitterLinksService.getLink(db, 'max-night');

    const passThroughData = {
      adjustDate: adjustDate,
      getByIndex: getByIndex,
      getLink: getLink,
      getChannelId: getChannelId,
      getDate: getDate,
      getFilename: getFilename,
      channelData: channelData,
      maxes,
      values: statsValues,
      links: {
        maxDayLink,
        maxMorningLink,
        maxMiddayLink,
        maxAfternoonLink,
        maxNightLink
      },
      activeReport,
      fs: fs,
      isPremium: isPremium,
      webAppToken
    }
    
    if (auth === true) {
      const htmlContent = fs.readFileSync('templates/main.ejs', 'utf8');
      const htmlRenderized = ejs.render(htmlContent, {
          filename: 'main.ejs',
          data: passThroughData
      });
      res.statusCode = 200;
      res.cookie('webAppToken', webAppToken, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false, secure: true });
      res.setHeader('Content-Type', 'text/html');
      res.end(htmlRenderized);
    } else {
      delete passThroughData.values;
      delete passThroughData.activeReport;
      delete passThroughData.channelData;
      delete passThroughData.webAppToken;
      delete passThroughData.isPremium;
      const htmlContent = fs.readFileSync('templates/login.ejs', 'utf8');
      const htmlRenderized = ejs.render(htmlContent, {
        filename: 'login.ejs',
        data: passThroughData
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.end(htmlRenderized);
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

app.get('/data/accum-channel', jsonMiddleware, async(req, res) => {
  const db = client.db(dbName);
  const channelStatsCol = db.collection('channel-stats');

  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;
  let platform = req.query.platform;
  if (platform === 'all') {
    platform = null;
  }

  const accumulated = await apiService.getAccumulated(channelStatsCol, dateFrom, dateTo, platform);
  res.status(200).send(accumulated);
});

app.get('/data/query', jsonMiddleware, async(req, res) => {
  const db = client.db(dbName);
  const channelStatsCol = db.collection('channel-stats');

  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;
  let platform = req.query.platform;
  if (platform === 'all') {
    platform = null;
  }

  const maxDay = await apiService.getMaxDay(channelStatsCol, dateFrom, dateTo, platform, true);
  const maxMorning = await apiService.getMaxBetweenHoursM(channelStatsCol, dateFrom, dateTo, 6, 10, platform);
  const maxMidday = await apiService.getMaxBetweenHoursM(channelStatsCol, dateFrom, dateTo, 10, 14, platform);
  const maxAfternoon = await apiService.getMaxBetweenHoursM(channelStatsCol, dateFrom, dateTo, 14, 18, platform);
  const maxNight = await apiService.getMaxBetweenHoursM(channelStatsCol, dateFrom, dateTo, 18, 23, platform);

  const daysGrouped = await apiService.getGrouped(channelStatsCol, dateFrom, dateTo);
  
  res.status(200).send({
    maxDay,
    maxMorning,
    maxMidday,
    maxAfternoon,
    maxNight,
    daysGrouped
  });
})

app.get('/data/totals', jsonMiddleware, async (req, res) => {
  const db = client.db(dbName);
  const channelStatsCol = db.collection('channel-stats');
  const maxDay = await apiService.getMaxDay(channelStatsCol, null, null, null, null);
  const maxMorning = await apiService.getMaxBetweenHours(channelStatsCol, 6, 10);
  const maxMidday = await apiService.getMaxBetweenHours(channelStatsCol, 10, 14);
  const maxAfternoon = await apiService.getMaxBetweenHours(channelStatsCol, 14, 18);
  const maxNight = await apiService.getMaxBetweenHours(channelStatsCol, 18, 23);

  const tMaxDay = await apiService.getMaxDay(channelStatsCol, null, null, 'twitch', null);
  const tMaxMorning = await apiService.getMaxBetweenHours(channelStatsCol, 6, 10, 'twitch');
  const tMaxMidday = await apiService.getMaxBetweenHours(channelStatsCol, 10, 14, 'twitch');
  const tMaxAfternoon = await apiService.getMaxBetweenHours(channelStatsCol, 14, 18, 'twitch');
  const tMaxNight = await apiService.getMaxBetweenHours(channelStatsCol, 18, 23, 'twitch');

  const ytMaxDay = await apiService.getMaxDay(channelStatsCol, null, null, 'youtube', null);
  const ytMaxMorning = await apiService.getMaxBetweenHours(channelStatsCol, 6, 10, 'youtube');
  const ytMaxMidday = await apiService.getMaxBetweenHours(channelStatsCol, 10, 14, 'youtube');
  const ytMaxAfternoon = await apiService.getMaxBetweenHours(channelStatsCol, 14, 18, 'youtube');
  const ytMaxNight = await apiService.getMaxBetweenHours(channelStatsCol, 18, 23, 'youtube');
  res.status(200).send({
    totals: {
      maxDay: maxDay,
      maxMorning: maxMorning,
      maxMidday: maxMidday,
      maxAfternoon: maxAfternoon,
      maxNight: maxNight
    },
    twitch: {
      maxDay: tMaxDay,
      maxMorning: tMaxMorning,
      maxMidday: tMaxMidday,
      maxAfternoon: tMaxAfternoon,
      maxNight: tMaxNight
    },
    youtube: {
      maxDay: ytMaxDay,
      maxMorning: ytMaxMorning,
      maxMidday: ytMaxMidday,
      maxAfternoon: ytMaxAfternoon,
      maxNight: ytMaxNight
    }
  })
});

app.get('/data/maxes-per-channel-filtered', jsonMiddleware, async(req, res) => {
  const qChannels = req.query.channels.split(',');
  const qDateFrom = req.query.dateFrom;
  const qDateTo = req.query.dateTo;
  const qPlatforms = req.query.platform;
  const db = client.db(dbName);
  const channelStatsCol = db.collection('channel-stats');

  const data = await apiService.getPeaksFiltered(
    channelStatsCol, 
    qDateFrom, 
    qDateTo,
    qChannels,
    qPlatforms
  );

  res.status(200).send(data);

});

app.get('/data/hourly-values', jsonMiddleware, async(req, res) => {
  const qChannels = req.query.channels.split(',');
  const qDateFrom = req.query.dateFrom;
  const qDateTo = req.query.dateTo;
  const qPlatforms = req.query.platform;
  const db = client.db(dbName);
  const channelStatsCol = db.collection('channel-stats');

  const data = await apiService.getHourlyValues(channelStatsCol, qDateFrom, qDateTo, qChannels, qPlatforms);

  res.status(200).send(data);
});

app.get('/data/maxes-per-channel', jsonMiddleware, async(req, res) => {
  const db = client.db(dbName);
  const channelStatsCol = db.collection('channel-stats');
  const channelsCol = db.collection('channels');
  const channelData = await channelService.getChannels(channelsCol);
  
  const perChannel = {};

  for (const i in channelData) {
    const channelName = channelData[i].name;
    perChannel[channelName] = {};
    const maxPeak = await apiService.getMaxDay(channelStatsCol, null, null, null, null, channelName);
    perChannel[channelName].maxPeak = (maxPeak) ? maxPeak.value : null;
    for (const j in channelData[i].items) {
      const channelPlatform = channelData[i].items[j].platform;
      if (!perChannel[channelName][channelPlatform]) perChannel[channelName][channelPlatform] = {};
      perChannel[channelName][channelPlatform].maxDay = await apiService.getMaxDayPerChannelAndPlatform(channelStatsCol, channelName, channelPlatform);
      perChannel[channelName][channelPlatform].maxMorning = await apiService.getMaxBetweenHoursPerChannelAndPlatform(channelStatsCol, channelName, channelPlatform, 6, 10);
      perChannel[channelName][channelPlatform].maxMidday = await apiService.getMaxBetweenHoursPerChannelAndPlatform(channelStatsCol, channelName, channelPlatform, 10, 14);
      perChannel[channelName][channelPlatform].maxAfternoon = await apiService.getMaxBetweenHoursPerChannelAndPlatform(channelStatsCol, channelName, channelPlatform, 14, 18);
      perChannel[channelName][channelPlatform].maxNight = await apiService.getMaxBetweenHoursPerChannelAndPlatform(channelStatsCol, channelName, channelPlatform, 18, 23);
    }
  }
  res.status(200).send(perChannel);
});

app.post('/twitter/links', jsonMiddleware, async(req, res) => {
  try {
    const db = client.db(dbName);
    const created = await twitterLinksService.createLink(db, req.body);
    res.status(200).send({ created: created });
  } catch (err) {
    res.status(400).json({ code: 'err_creation', message: err.message });
  }
});

app.delete('/twitter/links', jsonMiddleware, async(req, res) => {
  try {
    const db = client.db(dbName);
    const deleted = await twitterLinksService.removeLink(db, req.body);
    res.status(200).send({ deleted: deleted });
  } catch (err) {
    res.status(400).json({ code: 'err_deletion', message: err.message });
  }
});

app.post('/reports/publish', jsonMiddleware, async(req, res) => {
  try {
    const db = client.db(dbName);
    const published = await reportsService.publishReport(db, req.body.reportId);
    res.status(200).send({ published: published });
  } catch (err) {
    res.status(400).json({ code: 'err_publish', message: err.message });
  }
})

app.post('/reports/unpublish', jsonMiddleware, async(req, res) => {
  try {
    const db = client.db(dbName);
    const unpublished = await reportsService.unpublishReport(db, req.body.reportId);
    res.status(200).send({ unpublished: unpublished });
  } catch (err) {
    res.status(400).json({ code: 'err_unpublish', message: err.message });
  }
})

app.post('/upload', upload.single('report-file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const db = client.db(dbName);
  await reportsService.createReport(db, req.file.filename);
  res.redirect('/dashboard?activeTab=informes');
});

/* end api */

app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  await client.connect();
})
