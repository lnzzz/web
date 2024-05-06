const c = require('config');
const { startOfDay, endOfDay, eachDayOfInterval, format, startOfHour, addHours } = require('date-fns');

const getMaxDay = async(collection, dateFrom=null, dateTo = null, platform=null, multipleQuery=null) => {
    const today = new Date();
    
    const startDate = (dateFrom) ? new Date(dateFrom) : today;
    const dayStart = startOfDay(startDate);
    const endDate = (dateTo) ? new Date(dateTo) : today;

    if (dateFrom !== null) {
      dayStart.setDate(dayStart.getDate() + 1);
    }

    if (dateTo !== null) {
      endDate.setDate(endDate.getDate() + 1);
    }

    
    let datesBetween = eachDayOfInterval({ start: dayStart, end: endDate });

    if (datesBetween.length === 1) {
      datesBetween = [datesBetween[0]];
    }

    let result = {};

    for (let i=0; i<datesBetween.length; i++) {
      const startDate = startOfDay(datesBetween[i]);
      const endDate = endOfDay(datesBetween[i]);


      const match = {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          viewCount: { $ne: 0 }
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
      if (multipleQuery) {
        const formatted = format(datesBetween[i], 'dd-MM-yyyy');
        if (!result[formatted] && sortedChannelViewCounts && sortedChannelViewCounts[0]) {
          result[formatted] = sortedChannelViewCounts[0];
        }
      } else {
        if (sortedChannelViewCounts.length > 0) {
          result = {
            channel: sortedChannelViewCounts[0][0],
            value: sortedChannelViewCounts[0][1]
          };
        } else {
          result = null;
        }
      }
  }
  return result;
}

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
      if (!maxSubObject[subKey]) return null;
      const max = {
        channel: maxKey,
        value: maxSubObject[subKey]
      }
      return max;
    }
    return null;
    
}

const getMaxBetweenHoursM = async(collection, dateFrom, dateTo, startHour, endHour, platform=null) => {
  const startTime = new Date(dateFrom);
  startTime.setHours(startHour, 0, 0, 0);
  startTime.setDate(startTime.getDate() +1);

  const endTime = new Date(dateTo);
  endTime.setHours(endHour, 0, 0, 0);
  endTime.setDate(endTime.getDate() + 1);


  let datesBetween = eachDayOfInterval({ start: startTime, end: endTime });
  const result = {};
  for (let i=0; i<datesBetween.length; i++) {
    
    const startDate = new Date(datesBetween[i]);
    const endDate = new Date(datesBetween[i]);
    
    startDate.setHours(startHour, 0, 0, 0);
    endDate.setHours(endHour, 0, 0, 0);

    const match = {
      $match: {
        date: { $gte: startDate, $lte: endDate }
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
      const { date, channel, document, highestViewCount } = item;
      const xDate = new Date(date);
      const xDateIndex = xDate.getHours()+":"+String(xDate.getMinutes()).padStart(2, '0');

      if (!channelViewCounts[channel]) {
        channelViewCounts[channel] = {};
      }

      if (!channelViewCounts[channel][xDateIndex]) {
        channelViewCounts[channel][xDateIndex] = document.viewCount;
      } else {
        channelViewCounts[channel][xDateIndex] += document.viewCount;
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
      if (!maxSubObject[subKey]) return null;
      const formatted = format(datesBetween[i], 'dd-MM-yyyy');
      const max = {
        channel: maxKey,
        value: maxSubObject[subKey]
      }
      if (!result[formatted]) {
        result[formatted] = max;
      }
    }
  }

  if (Object.keys(result).length === 0) return null;
  return result;
  
}

const getGrouped = async(channelStatsCol, dateFrom, dateTo) => {
  const startTime = new Date(dateFrom);
  startTime.setHours(6, 0, 0, 0);
  startTime.setDate(startTime.getDate() +1);

  const endTime = new Date(dateTo);
  endTime.setHours(23, 0, 0, 0);
  endTime.setDate(endTime.getDate() + 1);

  let datesBetween = eachDayOfInterval({ start: startTime, end: endTime });
  let data = {};
  
  for (let i=0; i<datesBetween.length; i++) {
    const match = {
        $match: {
          platform: 'twitch',
          date: { $gte: startTime, $lte: endTime }
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
            date: { $gte: startTime, $lte: endTime }
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
            date: { $gte: startTime, $lte: endTime }
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
        const realDate = new Date(date);
        if (realDate.getDate() === datesBetween[i].getDate() && realDate.getMonth() === datesBetween[i].getMonth() && realDate.getFullYear() === datesBetween[i].getFullYear()) {
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(curr);
          return acc;
        }
      }, {});
    
    const channels = [...new Set(totals.map(item => item._id.channel))];
    
    const parsedTwitch = twitch.reduce((acc, curr) => {
        const { date } = curr._id;
        const realDate = new Date(date);
        if (realDate.getDate() === datesBetween[i].getDate() && realDate.getMonth() === datesBetween[i].getMonth() && realDate.getFullYear() === datesBetween[i].getFullYear()) {
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(curr);
          return acc;
        }
      }, {});

    const parsedYoutube = youtube.reduce((acc, curr) => {
      const { date } = curr._id;
      const realDate = new Date(date);
      if (realDate.getDate() === datesBetween[i].getDate() && realDate.getMonth() === datesBetween[i].getMonth() && realDate.getFullYear() === datesBetween[i].getFullYear()) {
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(curr);
        return acc;
      }
    }, {});

    const formatted = format(datesBetween[i], 'dd-MM-yyyy');

    data[formatted] = {
        channels,
        twitch: parsedTwitch,
        youtube: parsedYoutube,
        totals: parsedTotals
    }
  }

  return data;
};

module.exports = {
    getMaxDay,
    getMaxBetweenHours,
    getMaxBetweenHoursM,
    getGrouped
}