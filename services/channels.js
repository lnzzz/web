const getChannels = async(channelsCol) => {
    const channels = await channelsCol.find({}).toArray();
    const groupedData = channels.reduce((acc, curr) => {
        if (!acc[curr.name]) {
          acc[curr.name] = [curr];
        } else {
          acc[curr.name].push(curr);
        }
        return acc;
      }, {});
      
      const groupedArray = Object.entries(groupedData).map(([name, items]) => ({ name, items }));
      return groupedArray;
}

const getPlatforms = async(channelsCol) => {
  const result = await channelsCol.aggregate([
    {
      $group: {
        _id: null,
        platforms: { $addToSet: "$platform" }
      }
    },
    {
      $project: {
        _id: 0,
        platforms: 1
      }
    }
  ]).toArray();

  return result[0].platforms;
}

module.exports = {
    getChannels,
    getPlatforms
}