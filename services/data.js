const { startOfDay, endOfDay, startOfHour, addHours, subHours } = require('date-fns');


const getMaxBetweenHours = async(collection, startHour, endHour, platform=null) => {
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

    const group = {
      $group: {
        _id: { 
          channel: "$channel", 
          platform: "$platform",
          date: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$date" } }
        },
        highestViewCount: { $max: "$viewCount" }, // Calculate highest viewCount for each group
        document: { $first: "$$ROOT" } // Keep the entire document of the first element in each group
      }
    }

    const project = {
      $project: {
        _id: 0,
        channel: "$_id.channel",
        platform: "$_id.platform",
        date: "$_id.date",
        highestViewCount: 1,
        document: 1
      }
    }

    const data = await collection.aggregate([
        match,
        group,
        project
      ]).toArray();

    const channelViewCounts = {};


    data.forEach(item => {
      const { date, channel, highestViewCount } = item;
      const xDate = new Date(date);
      const xDateIndex = xDate.getHours()+":"+String(xDate.getMinutes()).padStart(2, '0');

      if (!channelViewCounts[channel]) {
        channelViewCounts[channel] = {};
      }

      if (!channelViewCounts[channel][xDateIndex]) {
        channelViewCounts[channel][xDateIndex] = highestViewCount;
      } else {
        channelViewCounts[channel][xDateIndex] += highestViewCount;
      }
    })

    const maxValues = {};

    for (const key in channelViewCounts) {
      if (Object.hasOwnProperty.call(channelViewCounts, key)) {
        let max = -Infinity;
        
        for (const subKey in channelViewCounts[key]) {
          if (Object.hasOwnProperty.call(channelViewCounts[key], subKey)) {
            maxValues[key] = {};
            max = Math.max(max, channelViewCounts[key][subKey]);
            maxValues[key][subKey] = max;
          }
        }
      }
    }
    
    let maxSubObject = null;
    let maxValue = -Infinity;
    let maxKey = null;
    
    // Iterate through each property of the main object
    for (const key in maxValues) {
      if (Object.hasOwnProperty.call(maxValues, key)) {
        // Iterate through each subproperty and update the maximum value and sub-object if found
        for (const subKey in maxValues[key]) {
          if (Object.hasOwnProperty.call(maxValues[key], subKey)) {
            if (maxValues[key][subKey] > maxValue) {
              maxValue = maxValues[key][subKey];
              maxSubObject = maxValues[key];
              maxKey = key;
            }
          }
        }
      }
    }
    
    if (maxKey && maxSubObject) {
      const subKey = Object.keys(maxSubObject)[0];
      const arr = [[maxKey, { k: subKey, v: maxSubObject[subKey]}]];
      return arr;
    }
    return false;
    
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
            highestViewCount: { $max: "$viewCount" },
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

const getValuesGrouped = async(channelStatsCol) => {
    const currentDate = new Date();
    
    const todayAt6 = new Date(currentDate.setHours(0, 0, 0, 0));

    const today = new Date();
    const endDate = startOfHour(addHours(today, 1));
    const startDate = todayAt6;

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
    getValuesGrouped
}