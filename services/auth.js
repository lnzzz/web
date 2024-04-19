const authenticate = async(username, password, authCollection) => {
    if (!username || username === '') {
        return false;
    }

    if (!password || password === '') {
        return false;
    }

    const valid = await authCollection.findOne({ username, password });
    return valid;
}

const createUser = async(username, password, authCollection) => {
    const exists = await authCollection.findOne({ username });
    if (exists) {
        throw Error(`User already exists`);
    }

    const user = await authCollection.insertOne({ username, password });
    return user;
}

module.exports = {
    authenticate,
    createUser
}