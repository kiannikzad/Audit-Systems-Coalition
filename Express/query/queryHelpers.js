// QUERY HELPERS //
/* ============================================================
Contains helper functions which construct various parts of the final SQL query
that is sent to the database in query.js. Many parts of the query depend on
whether it is an item or observation query, and the helpers are divided this way
Functions:
    makeFeatureClauseArray
    makeWhereClauseArray
    makeUniversalFilters
    makeGroupByClause
============================================================ */

// SQL Formatter
const {postgresClient} = require('../pg.js');
const formatSQL = postgresClient.format;

// SQL statements
const {
    whereConditionObject, 
    groupBy,
    rootFeatureJoin,
    subfeatureJoin,
    observationCount,
    sorta,
    sortd,
    limit,
    offset,
    pk
} = require('../statement.js').query;

const { allInternalObjects } = require("../preprocess/load.js");

module.exports = {
    makeFeatureClauseArray,
    makeWhereClause,
    makeUniversalFilters,
    makeGroupByClause,
    makeInternalObjects
}


// QUERY INTERNAL OBJECTS
// ==================================================
function makeInternalObjects(parsed, queryType, dbName) {
    const { internalObjects } = allInternalObjects[dbName];
    const { returnableIDLookup } = internalObjects;

    // array of all features in feature tree (features and subfeatures)
    let featureTree = [];
    // get feature and add to feature tree
    const feature = `${queryType}_${parsed.features}`;
    featureTree.push(feature);

    // if sorting then add ID of the column to sort to allIDs
    let sortID = [];
    if(Object.keys(parsed.universalFilters).includes('sorta')) {
        sortID.push(parsed.universalFilters.sorta);
    } else if(Object.keys(parsed.universalFilters).includes('sortd')) {
        sortID.push(parsed.universalFilters.sortd);
    }

    // array of unique IDs from:
    // 1. returned columns
    // 2. returned filters
    // 3. column to sort by
    const filterColumnIDs = [];
    parsed.filters.forEach( obj => {
        filterColumnIDs.push(obj.id);
    });
    let allIDs = [...new Set(parsed.columns.concat(filterColumnIDs, sortID))];

    // array of returnableID objects from IDs 
    let allReturnableIDs = allIDs.map((id) => returnableIDLookup[id])

    return {
        allReturnableIDs,
        allIDs,
        feature,
        featureTree
    }
}

// FEATURE CLAUSES
// ==================================================
function makeFeatureClauseArray(feature, featureTree, queryType, dbName) {
    const { internalObjects } = allInternalObjects[dbName];
    const { featureParents } = internalObjects;

    let featureClauseArray = [];
    //let subfeatures = Object.keys(featureParents).filter(key => featureParents[key] !== null).map(key => [key, featureParents[key]]);
    let rootFeature = feature

    // Add root feature join
    featureClauseArray.push(formatSQL(rootFeatureJoin, {
        rootFeature: rootFeature
    }))

    // remove root feature from feature tree after join
    featureTree.splice(featureTree.indexOf(rootFeature), 1)

    let currentFeature = [rootFeature]

    // while still features to join, join them
    while(featureTree.length > 0) {

        let nextCurrentFeature = [];

        // for all of the curent features
        currentFeature.forEach(parent => {
            // get the features that depend on 
            featureTree.forEach(child => {
                // if feature in tree is dependent on currentFeature
                if(featureParents[child] == parent) {

                    // add it to be a next current feature
                    nextCurrentFeature.push(child)

                    // join the feature
                    featureClauseArray.push(formatSQL(subfeatureJoin, {
                        feature: parent,
                        subfeature: child
                    }))
                }
            })

            // remove added features from featureTree
            nextCurrentFeature.forEach(addition => {
                featureTree.splice(featureTree.indexOf(addition), 1)
            })
            
        })

        // update current feature
        currentFeature = Array.from(nextCurrentFeature)
    }

    // if an observation query add the observation_count join
    if(queryType == 'observation') {
        featureClauseArray.push(formatSQL(observationCount, {
            feature
        }))
    }

    return featureClauseArray;
}


// WHERE CLAUSES
// ==================================================
function makeWhereClause(whereLookup, builderObject) {

    if(builderObject === null) {
        return '';
    } else {
        return 'WHERE ' + formatGroup(builderObject);
    }

    /*
        [0, {a}, {b}, [1, {c}, {d}]]
        a AND b AND (c OR d)
    */
    function formatGroup(group) {
        let SQLString = [];
        let seperator = group[0] === 0 ? 'AND' : 'OR';
        for(let element of group.slice(1)) {
            // Another group
            if(Array.isArray(element)) {
                SQLString.push(` (${formatGroup(element)}) `);
            } 
            // A filter
            else {
                SQLString.push(formatFilter(element));
            }
        }
        return SQLString.join(` ${seperator} `);
    }
    
    function formatFilter(filter) {
        console.log(whereLookup)
        // special case geoWithinDistance needing an additional argument
        let filterIdAndValue;
        if(filter.op === 'geoWithinDistance') {
            filterIdAndValue = {
                id: whereLookup[filter.id],
                val: filter.val[0],
                additionalArg: filter.val[1]
            }
        } else {
            filterIdAndValue = {
                id: whereLookup[filter.id],
                val: filter.val
            }
        }
        // format SQL with sanitization
        return formatSQL(whereConditionObject[filter.op], filterIdAndValue)
    }
}

// UNIVERSAL FILTERS
// ==================================================
function makeUniversalFilters(whereLookup, universalFilters, feature, queryType) {
    // Applying sorta, sortd, limit, offset, and pk universal filters
    let universalFilterArray = [];

    // default limit of 100 rows
    let universalLimit = formatSQL(limit, {
        limit: 100
    });

    // default no offset
    let universalOffset = formatSQL(offset, {
        offset: 0
    });

    // default sort by time submitted if observation
    //                 item primary key if item
    let universalSort;
    if(queryType == 'observation') {
        // default column to sort observations by
        let columnName = formatSQL('$(table:name).observation_id', {
            table: feature
        })

        universalSort = formatSQL(sortd, {
            columnName
        });
    }
    else {
        // default column to sort items by
        let columnName = formatSQL('$(table:name).item_id', {
            table: feature
        })

        universalSort = formatSQL(sortd, {
            columnName
        });
    }
    
    let universalKey
    if(Object.keys(universalFilters).length > 0) {
        for(universal in universalFilters) {
            if(universal === 'sorta') {
                universalSort = formatSQL(sorta, {
                    columnName: whereLookup[universalFilters[universal]]
                })
            } else if(universal === 'sortd') {
                universalSort = formatSQL(sortd, {
                    columnName: whereLookup[universalFilters[universal]]
                })
            } else if(universal === 'limit') {
                universalLimit = formatSQL(limit, {
                    limit: universalFilters[universal]
                })
            } else if(universal === 'offset') {
                universalOffset = formatSQL(offset, {
                    offset: universalFilters[universal]
                })
            } else if(universal === 'pk') {
                universalKey = formatSQL(pk, {
                    key: universalFilters[universal]
                })
            }
        }
    } 

    universalFilterArray.push(universalKey, universalSort, universalLimit, universalOffset);

    return universalFilterArray;
}

// GROUP BY
// ==================================================
function makeGroupByClause(allReturnableIDs, feature, queryType) {
    let groupByClause = '';

    // get all non-list returnables
    let nonListReturnables = allReturnableIDs.map(returnable => [returnable.ID, returnable.referenceType]).filter(returnable => !['obs-list', 'item-list', 'special'].includes(returnable[1]));

    // if there are list returnables group by the non-list returnables (so the list returnables can be aggregated over)
    if(nonListReturnables.length < allReturnableIDs.length) {
        // first add obspkey because it's on every query
        nonListReturnables = nonListReturnables.map(el => `r${el[0]}`)
        nonListReturnables.push(`${queryType}_pkey`)
        nonListReturnables = nonListReturnables.join(', ')
        // format
        groupByClause = formatSQL(groupBy, {
            nonListReturnables,
            feature: feature
        })
    };

    return groupByClause;
}

