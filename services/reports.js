const { ObjectId } = require('mongodb');

const createReport = async(db, fileName) => {
    const collection = db.collection('reports');
    await collection.updateMany({}, { $set: { active: false }});
    const created = await collection.insertOne({
        fileName,
        active: true,
        date: new Date()
    });
    return created;
}

const getReports = async(db) => {
    const collection = db.collection('reports');
    const results = await collection.find({}).sort({ date: -1 }).toArray();
    return results;
}

const publishReport = async(db, reportId) => {
    const collection = db.collection('reports');
    await collection.updateMany({}, { $set: { active: false }});
    await collection.updateOne({ _id: new ObjectId(reportId) }, { $set: { active: true } });
    return true;
}

const unpublishReport = async(db, reportId) => {
    const collection = db.collection('reports');
    await collection.updateOne({ _id: new ObjectId(reportId) }, { $set: { active: false } });
    return true;
}

const getActiveReport = async(db) => {
    const collection = db.collection('reports');
    const activeReport = await collection.findOne({ active: true });
    return activeReport;
}

module.exports = {
    getReports,
    createReport,
    publishReport,
    unpublishReport,
    getActiveReport
}