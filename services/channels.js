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

module.exports = {
    getChannels
}