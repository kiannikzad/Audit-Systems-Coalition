const queryHelpers = require('../query/queryHelpers.js');
const { allInternalObjects } = require("../preprocess/load.js");

// Database connection and SQL formatter
const {postgresClient} = require('../pg.js');
// get connection object
const formatSQL = postgresClient.format;

const validateUploadRecordLookup = {
    item_sop: ['organization_id'],
    item_template: ['organization_id'],
    item_user: ['user_id'],
    item_global: ['user_id', 'organization_id'],
    item_catalog: ['organization_id'],
    item_audit: ['user_id', 'organization_id'],
};

class RequestValidationError extends Error {
    constructor(errObject, ...params) {
      // Pass remaining arguments (including vendor specific ones) to parent constructor
      super(...params)
  
      // Maintains proper stack trace for where our error was thrown (only available on V8)
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, RequestValidationError)
      }
  
      this.name = 'RequestValidationError'
      // Custom debugging information
      this.code = errObject.code
      this.msg = errObject.msg
    }
}

/**
 * 
 * @param {'query' | 'submission'} queryOrUpload
 */
function authorizationGenerator(queryOrUpload, queryType) {

    return async (req, res, next) => {
        let collectedItems;
        if(queryOrUpload === 'query') {
            // [tableName, ...]
            collectedItems = collectQueryItems(res.locals.parsed, queryType, res.locals.databaseConnectionName);
        } else {
            // [{
            //    tableName: String,  
            //    itemID: Number | null
            //    userID: Number | null
            //    organizationID: Number | null
            //    globalID: Number | null
            //    isCreate: Boolean
            // }, ...]
            collectedItems = collectSubmissionItems(req.body, res.locals.databaseConnectionName);
        }
        
        try {
            // throws error if invalid
            await validateItemsOnRequesterRole(collectedItems, res.locals.authorization, queryOrUpload, res.locals.databaseConnection, res.locals.databaseConnectionName);
            return next();
        } catch(err) {
            console.log(err);
            if(err instanceof RequestValidationError) {
                return res.status(err.code).send(err.msg);
            } else {
                return res.status(500).send(err);
            }  
        }
    }
    
}

/**
 * null values are for guest requests
 * @typedef {Object} authorizationObject
 * @param {String | null} privilege
 * @param {String[]} role
 * @param {Number[]} organizationID Because user can be associated with multiple organizations
 * @param {Number | null} userID
 */

/**
 * 
 * @param {String[]} uniqueItems
 * @param {authorizationObject} authorizationObject
 * @param {'query' | 'submission'} queryOrUpload 
 * @throws {RequestValidationError}
 */
async function validateItemsOnRequesterRole(items, authorizationObject, queryOrUpload, db, dbName) {
    
    // validate every passed item
    for(let itemObjectOrTableName of items) {
        // Check if upload and query is possible based on authorization properties of schemaFeatureInput
        checkRequesterRole(itemObjectOrTableName, authorizationObject, queryOrUpload, dbName)

        // Additional upload checks
        if(queryOrUpload === 'upload') {
            // Check if upload is possible based on if reference to organization and user is self
            // optimization to not check same globalID twice
            const alreadyCheckedGlobalIDs = [];
            const newCheckedGlobalID = await validateUploadRecordWithSession(itemObjectOrTableName, authorizationObject, alreadyCheckedGlobalIDs, db);
            if(newCheckedGlobalID !== null) {
                alreadyCheckedGlobalIDs.push(newCheckedGlobalID);
            }
        }
        
    }

    /**
     * 
     * @param {*} itemTableName 
     * @param {*} authorizationObject 
     * @throws {RequestValidationError}
     */
    function checkRequesterRole(itemTableName, authorizationObject, queryOrUpload, dbName) {
        if(queryOrUpload === 'upload') {
            itemTableName = itemTableName.tableName;
        }

        const { internalObjects } = allInternalObjects[dbName];
        const { allItems } = internalObjects;
        const itemAuthorizationLookup = {};
        allItems.forEach(item => {
            itemAuthorizationLookup[item.i__table_name] = {
                queryRole: item.qr__type_name,
                uploadRole: item.ur__type_name,
                queryPrivilege: item.qp__privilege_name,
                uploadPrivilege: item.up__privilege_name,
            };
        });

        const {
            queryRole,
            uploadRole,
            queryPrivilege,
            uploadPrivilege,
        } = itemAuthorizationLookup[itemTableName];

        // queryRole and queryPrivilege
        if(queryOrUpload === 'query') {
            if(queryPrivilege === 'guest') return;
            if(queryPrivilege === 'superuser') {
                if(authorizationObject.privilege !== 'superuser') {
                    throw new RequestValidationError({code: 403, msg: `Querying table ${itemTableName} is restricted to superusers`});
                } else {
                    return;
                }
            } 
            // then 'user'
            else {
                if(authorizationObject.privilege !== 'user') {
                    throw new RequestValidationError({code: 401, msg: `Querying table ${itemTableName} is restricted to logged in users`});
                } else {
                    if(queryRole === 'auditor') return;
                    if(!authorizationObject.role.includes('admin')) {
                        throw new RequestValidationError({code: 401, msg: `Querying table ${itemTableName} is restricted to users with admin role`});
                    } else {
                        return;
                    }
                }
            }
        } 
        // uploadRole and uploadPrivilege
        else {
            if(uploadPrivilege === 'guest') return;
            if(uploadPrivilege === 'superuser') {
                if(authorizationObject.privilege !== 'superuser') {
                    throw new RequestValidationError({code: 403, msg: `Uploading to table ${itemTableName} is restricted to superusers`});
                } else {
                    return;
                }
            } 
            // then 'user'
            else {
                if(authorizationObject.privilege === 'superuser') {
                    return;
                }
                else if(authorizationObject.privilege !== 'user') {
                    throw new RequestValidationError({code: 401, msg: `Uploading to table ${itemTableName} is restricted to logged in users`});
                } else {
                    if(uploadRole === 'auditor') return;
                    if(!authorizationObject.role.includes('admin')) {
                        throw new RequestValidationError({code: 401, msg: `Uploading to table ${itemTableName} is restricted to users with admin role`});
                    } else {
                        return;
                    }
                }
            }
        }
    }

    /**
     * 
     * @param {Object} itemObject 
     * @param {Object} authorizationObject
     * @param {Number[]} alreadyCheckedGlobalIDs
     * @throws {RequestValidationError}
     */
    async function validateUploadRecordWithSession(itemObject, authorizationObject, alreadyCheckedGlobalIDs, db) {
        const {
            tableName, 
            itemID,
            userID,
            organizationID,
            globalID,
            isCreate,
        } = itemObject;
        let newCheckedGlobalID = null;
        
        // Escape validation for superuser
        if(authorizationObject.privilege === 'superuser') {
            return newCheckedGlobalID;
        }

        // Check all referenced globals for new items are good
        if(globalID !== null && !alreadyCheckedGlobalIDs.includes(globalID)) {
            let organizationID;
            try {
                const data = await db.one(formatSQL(`
                    SELECT item_user_id, item_organization_id
                    FROM item_global
                    WHERE item_id = $(globalID)
                `, {
                    globalID
                }));

                organizationID = data.item_organization_id;
            } catch(err) {
                console.log(err);
                throw new RequestValidationError({code: 400, msg: `Global item primary key: ${globalID} does not exist`});
            }

            if(!authorizationObject.organizationID.includes(organizationID)) {
                throw new RequestValidationError({code: 401, msg: `Global item primary key: ${globalID} does not belong to requesting user's organization(s)`});
            }
            newCheckedGlobalID = globalID;
        }
        // Only check self for items which must be validated
        if(!(tableName in validateUploadRecordLookup)) {
            return;
        }
        // If creating then check passed organization and user ID directly
        if(isCreate) {
            if(organizationID !== null && !authorizationObject.organizationID.includes(organizationID)) {
                throw new RequestValidationError({code: 401, msg: `Organization ID: ${organizationID} referenced when creating item ${tableName} does not belong to requesting user's organization(s)`});
            }
            if(userID !== null && !authorizationObject.userID !== userID) {
                throw new RequestValidationError({code: 401, msg: `User ID: ${userID} referenced when creating item ${tableName} does not belong to requesting user's organization(s)`});
            }
        } 
        // Otherwise use itemID to query table for IDs and then check
        else {
            for(let IDColumnToValidate of validateUploadRecordLookup[tableName]) {
                const foundID = (await db.one(formatSQL(`
                    SELECT $(IDColumnToValidate) AS id
                    FROM $(tableName)
                    WHERE item_id = $(itemID)
                `, {
                    IDColumnToValidate,
                    tableName,
                    itemID,
                }))).id

                // Organization
                if(IDColumnToValidate === 'item_organization') {
                    if(!authorizationObject.organizationID.includes(foundID)) {
                        throw new RequestValidationError({code: 401, msg: `Item ${tableName} with primary key ${itemID} does not belong to requesting user's organization(s)`});
                    }
                }
                // User
                else {
                    if(authorizationObject.userID !== foundID) {
                        throw new RequestValidationError({code: 401, msg: `Item ${tableName} with primary key ${itemID} does not belong to requesting user`});
                    }
                }
            }
        }
        // return new checked globalIDs
        return newCheckedGlobalID;
    }
}

/**
 * 
 * @param {ReturnableID[]} returnables 
 * @returns {String[]}
 */
function collectQueryItems(parsed, queryType, dbName) {
    const { internalObjects } = allInternalObjects[dbName];
    const { columnIdItemLookup } = internalObjects;


    // get column
    let {
        allReturnableIDs
    } = queryHelpers.makeInternalObjects(parsed, queryType, dbName);
    // go through all the returnables and get unique items
    const uniqueItems = [];
    // console.log(allReturnableIDs)
    for(let returnable of allReturnableIDs) {
        let tableName = columnIdItemLookup[returnable.columnID];
        /*
        // if observation table convert to item table
        if(tableName in observationItemTableNameLookup) {
            tableName = observationItemTableNameLookup[tableName];
        }
        */
        if(!uniqueItems.includes(tableName)) {
            uniqueItems.push(tableName);
        }
        
    }
    return uniqueItems;
}

/**
 * 
 * @param {ReturnableID[]} returnables 
 * @returns {{tableName: String, itemID: Number | null, userID: Number | null, organizationID: Number | null, globalID: Number | null, isCreate: Boolean}}
 */
function collectSubmissionItems(submissionObject, dbName) {
    const items = []; 
    const { internalObjects } = allInternalObjects[dbName];
    const { itemTableNames } = internalObjects;
    const userItemTypeID = Object.entries(itemTableNames).filter(pair => pair[0] === 'item_user')[1];
    const organizationItemTypeID = Object.entries(itemTableNames).filter(pair => pair[0] === 'item_organization')[1];  
    for(let itemsOrObservations of Object.values(submissionObject)) {
        for(let actionPair of Object.entries(itemsOrObservations)) {
            const isCreate = actionPair[0] === 'create';
            for(let actionObject of actionPair[1]) {
                // userID and organizationID are only checked for 
                // predefined items in validateUploadRecordLookup
                // get userID and organizationID
                let userID = null;
                let organizationID = null;
                // create item or update item
                if('requiredItems' in actionObject || 'nonIDRequiredItems' in actionObject) {
                    let requiredItemsKey = 'nonIDRequiredItems' in actionObject ? 'nonIDRequiredItems' : 'requiredItems';
                    let requiredOrganizations = actionObject[requiredItemsKey].filter(obj => obj.itemTypeID === organizationItemTypeID);
                    if(requiredOrganizations.length > 0) {
                        organizationID = requiredOrganizations[0].primaryKey; 
                    }

                    let requiredUsers = actionObject[requiredItemsKey].filter(obj => obj.itemTypeID === userItemTypeID);
                    if(requiredUsers.length > 0) {
                        userID = requiredUsers[0].primaryKey; 
                    }
                }
                items.push({
                    tableName: itemTableNames[actionObject.itemTypeID],
                    itemID: 'primaryKey' in actionObject ? actionObject.primaryKey : null,
                    globalID: 'globalPrimaryKey' in actionObject ? actionObject.globalPrimaryKey : null,
                    organizationID,
                    userID,
                    isCreate,
                });
            }
        }
    }
    return items;
}

function authorizeSessionGenerator(config) {
    return (req, res, next) => {
        try {
            if(config.privilege === 'user') {
                if(!['user', 'superuser'].includes(res.locals.authorization.privilege)) {
                    return res.status(401).end()
                }
                return next();
            }
            else if(config.privilege === 'superuser') {
                if(res.locals.authorization.privilege !== 'superuser') {
                    return res.status(401).end();
                }
                return next();
            }
            else if(config.role === 'auditor') {
                // Needs to be an auditor of any organization to pass
                if(config.anyOrg) {
                    if(!res.locals.authorization.role.some(role => ['auditor', 'admin'].includes(role))) {
                        console.log(res.locals.authorization)
                        return res.status(401).end();
                    }
                    return next();
                // Needs to be an auditor of the organization that has been requested to modify to pass
                } else {
                    const organizationIDIndex = res.locals.authorization.organizationID.indexOf(res.locals.requestedOrganizationID);
                    if(!['auditor', 'admin'].includes(res.locals.authorization.role[organizationIDIndex])) {
                        console.log(res.locals.authorization.role[organizationIDIndex])
                        return res.status(401).end();
                    }
                    return next();
                }
            } else if(config.role === 'admin') {
                // Needs to be an admin of any organization to pass
                if(config.anyOrg) {
                    if(!res.locals.authorization.role.some(role => role === 'admin')) {
                        return res.status(401).end();
                    }
                    return next();
                // Needs to be an admin of the organization that has been requested to modify to pass
                } else {
                    const organizationIDIndex = res.locals.authorization.organizationID.indexOf(res.locals.requestedOrganizationID);
                    if(res.locals.authorization.role[organizationIDIndex] !== 'admin') {
                        return res.status(401).end();
                    }
                    return next();
                }
            } else {
                throw Error('Invalid authorizationSessionGenerator configuration');
            }
        } catch(err) {
            console.log(err);
            return res.status(500).end();
        }
    }
}

module.exports = {
    authorizeSubmission: authorizationGenerator('upload'),
    authorizeItemQuery: authorizationGenerator('query', 'item'),
    authorizeObservationQuery: authorizationGenerator('query', 'observation'),
    authorizeLoggedIn: authorizeSessionGenerator({ privilege: 'user'}),
    authorizeSuperuser: authorizeSessionGenerator({ privilege: 'superuser' }),
    authorizeAdmin: authorizeSessionGenerator({ role: 'admin' }),
    authorizeAuditor: authorizeSessionGenerator({ role: 'auditor' }),
    authorizeAuditorAnyOrg: authorizeSessionGenerator({ role: 'auditor', anyOrg: true }),
    authorizeAdminAnyOrg: authorizeSessionGenerator({ role: 'admin', anyOrg: true }),
};