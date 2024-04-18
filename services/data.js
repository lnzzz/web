const { startOfDay, endOfDay, startOfHour, addHours, subHours } = require('date-fns');


const getMaxBetweenHours = async(collection, startHour, endHour, platform=null) => {
    return 0;
    const startTime = new Date();
    startTime.setHours(startHour, 0, 0, 0);

    const endTime = new Date();
    endTime.setHours(endHour, 0, 0, 0);

    const match = {
      $match: {
        date: { $gte: startTime, $lte: endTime }
      }
    };

    if (platform) {
      match.$match['platform'] = platform;
    }

    const data = await collection.aggregate([
        match,
        {
          $group: {
            _id: { channel: "$channel", platform: "$platform" },
            highestViewCount: { $max: { $toInt: "$viewCount" } }, // Calculate highest viewCount for each group
            document: { $first: "$$ROOT" } // Keep the entire document of the first element in each group
          }
        },
        {
          $project: {
            _id: 0,
            channel: "$_id.channel",
            platform: "$_id.platform",
            highestViewCount: 1,
            document: 1
          }
        }
      ]).toArray();

      const channelViewCounts = {};

      data.forEach(item => {
        const { channel, highestViewCount } = item;
        
        if (channelViewCounts[channel]) {
          channelViewCounts[channel] += highestViewCount;
        } else {
          channelViewCounts[channel] = highestViewCount;
        }
      });
    const sortedChannelViewCounts = Object.entries(channelViewCounts);
    sortedChannelViewCounts.sort((a, b) => b[1] - a[1]);
    return sortedChannelViewCounts;
}

const getMaxDay = async(collection, platform=null) => {
    const today = new Date();
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);

    const match = {
      $match: {
        date: { $gte: dayStart, $lte: dayEnd }
      }
    }

    if (platform) {
      match.$match['platform'] = platform;
    }

    const data = await collection.aggregate([
        match,
        {
          $group: {
            _id: { channel: "$channel", platform: "$platform" },
            highestViewCount: { $max: { $toInt: "$viewCount" } },
            document: { $first: "$$ROOT" }
          }
        },
        {
          $project: {
            _id: 0,
            channel: "$_id.channel",
            platform: "$_id.platform",
            highestViewCount: 1,
            document: 1
          }
        }
      ]).toArray();

      const channelViewCounts = {};

      data.forEach(item => {
        const { channel, highestViewCount } = item;
        if (channelViewCounts[channel]) {
          channelViewCounts[channel] += highestViewCount;
        } else {
          channelViewCounts[channel] = highestViewCount;
        }
      });
    const sortedChannelViewCounts = Object.entries(channelViewCounts);
    sortedChannelViewCounts.sort((a, b) => b[1] - a[1]);
    return sortedChannelViewCounts;
}

const getLast10Grouped = async(channelStatsCol) => {
    const today = new Date();
    
    const endDate = startOfHour(addHours(today, 1));
    const startDate = startOfHour(subHours(endDate, 2));

    const match = {
        $match: {
          platform: 'twitch',
          date: { $gte: startDate, $lte: endDate }
        }
    }

    const twitch = await channelStatsCol.aggregate([
        match,
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$date" } },
              channel: "$channel"
            },
            totalViewCount: { $sum: "$viewCount" }
          }
        },
        {
            $sort: {
              "_id.date": -1,
              "_id.channel": 1
            }
          }
      ]).toArray();

    const youtube = await channelStatsCol.aggregate([
        {
          $match: {
            platform: 'youtube',
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$date" } },
              channel: "$channel"
            },
            totalViewCount: { $sum: "$viewCount" }
          }
        },
        {
            $sort: {
              "_id.date": -1,
              "_id.channel": 1
            }
          }
      ]).toArray();

    const totals = await channelStatsCol.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$date" } },
              channel: "$channel"
            },
            totalViewCount: { $sum: "$viewCount" }
          }
        },
        {
            $sort: {
              "_id.date": -1,
              "_id.channel": 1
            }
          }
      ]).toArray();

    const parsedTotals = totals.reduce((acc, curr) => {
        const { date } = curr._id;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(curr);
        return acc;
      }, {});
    
    const channels = [...new Set(totals.map(item => item._id.channel))];
    
    const parsedTwitch = twitch.reduce((acc, curr) => {
        const { date } = curr._id;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(curr);
        return acc;
      }, {});

    const parsedYoutube = youtube.reduce((acc, curr) => {
      const { date } = curr._id;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(curr);
      return acc;
    }, {});


    const data = {
        channels,
        twitch: parsedTwitch,
        youtube: parsedYoutube,
        totals: parsedTotals
    }

    return data;
};

module.exports = {
    getMaxBetweenHours,
    getMaxDay,
    getLast10Grouped
}