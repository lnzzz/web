const getLinks = async (db) => {
    const collection = db.collection('twitter-links');
    const results = await collection.find({ active: true }).toArray();
    return results;
}

const getLink = async(db, linkTag) => {
    const collection = db.collection('twitter-links');
    const result = await collection.findOne({ linkTag, active: true });
    return result;
}

const createLink = async (db, data) => {
    try {
        const collection = db.collection('twitter-links');
        await collection.updateMany({ linkTag: data.linkTag }, { $set: { active: false} });
        await collection.insertOne({ ...data, active: true });
        return true;
    } catch (err) {
        console.log(`error creating the link ${err.message}`);
        throw new Error(err.message);
    }
}

const removeLink = async (db, data) => {
    try {
        const collection = db.collection('twitter-links');
        await collection.updateMany({ linkTag: data.tag }, { $set: { active: false } });
        return true;
    } catch (err) {
        console.log(`error removing the link`);
        throw new Error(err.message);
    }
}

module.exports = {
    getLinks,
    getLink,
    createLink,
    removeLink
}