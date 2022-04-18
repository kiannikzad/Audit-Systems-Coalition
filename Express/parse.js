////// QUERY PARSING //////

const { compareSync } = require("bcrypt");
const e = require("express");
const { query } = require("express");
const { isNumber, indexOf, rest, isInteger } = require("lodash");

function operation_map(operation) {
    switch(operation){
        case 'gte':
            op = '>=';
            break;
        case 'gt':
            op = '>';
            break;
        case 'lte':
            op = '<=';
            break;
        case 'lt':
            op = '<';
            break;
        case 'e':
            op = 'Exists';
            break;
        case 'dne':
            op = 'Does not exist';
            break;
        case '~':
            op = 'not';
            break;
        default:
            op = null; //set op to null if non-valid operation
    }
    return op;
}

function deconstructQuery(queryStatement){
    // array with all components of query statement separated
    // ex. 65[gte]=01-20-2000 ==> {key: returnableID, op: operation, value: value} ==> {key: 65, op: gte, value: 01-20-200}
    // ex. limit=50 ==> [key: limit, op: '', value: 50]
    let deconstructedQuery = {};
    let key;
    let op;
    let val;

    let open = queryStatement.indexOf('[');
    let close = queryStatement.indexOf(']');
    let equals = queryStatement.indexOf('=');

    // get returnable ID of query as key
    let i = 0;
    while (i < queryStatement.length && Number.isInteger(parseInt(queryStatement[i])))
        ++i;
    if (i > 0)
        key = queryStatement.slice(0,i);
    else if (open !== -1 && close !== -1)
        key = queryStatement.slice(0, open);
    else
        key = queryStatement.slice(0, equals);

    const operation = queryStatement.slice(open+1, close)
    // get operation of query as op
    if (open !== -1 && close !== -1)
        op = operation_map(operation);
    else
        op = '=';   

    // get value as val
    if (equals !== -1)
        val = queryStatement.slice(equals+1);
    else
        val = '';

    deconstructedQuery = {
        key,
        op,
        val
    };

    return deconstructedQuery;
}

function separateQueries(queryStatements) {

    if (queryStatements.indexOf('?') === -1)
        return [];
    // remove query string until '?'
    queryStatements = queryStatements.substring(queryStatements.indexOf('?')+1);
    let operationIndices = [];
    let separatedQuery = [];

    // alter query string from URL encoding '%7C' to '|'
    // commented out because decodeURIComponent() included
    /*
    let orCode = queryStatements.indexOf('%7C');
    while (orCode !== -1){
        queryStatements = queryStatements.substring(0, orCode) + '|' + queryStatements.substring(orCode+3);
        orCode = queryStatements.indexOf('%7C')
    }
    */

    // determine whether any params are AND-ed or OR-ed
    if (queryStatements.indexOf("&") === -1 && queryStatements.indexOf("|") === -1) {
        separatedQuery.push(['', deconstructQuery(queryStatements)]);
    } 
    else { 
        // add each param between the ANDs and ORs
        for (let i = 0; i < queryStatements.length; i++){
            if (queryStatements[i] === "&" || queryStatements[i] === "|"){
                // add first param
                if (separatedQuery.length === 0)
                    separatedQuery.push(['', deconstructQuery(queryStatements.substring(0, i))]);
                // add params in between ANDs and ORs
                else{
                    let query = queryStatements.substring(operationIndices.slice(-1), i);
                    separatedQuery.push([query[0], deconstructQuery(query.slice(1))]);
                }   
                // add index of operation
                operationIndices.push(i);    
            }
        }
        // add last param
        let query = queryStatements.substring(operationIndices.slice(-1));
        separatedQuery.push([query[0], deconstructQuery(query.slice(1))]);
    }
    return separatedQuery;
}

function parseConstructor (init) {

    return (req, res, next) => {
        const url = req.originalUrl;
        let filter = separateQueries(decodeURIComponent(url));
        let {feature} = req.params; 
        let include;

        // if we're doing a key query then include is just null
        if (init == 'key') {
            include = [];
        }
        else {
            include = req.params.include;
            include = include.split('&');
        }

        // init parsed values
        res.locals.parsed = {};
    
        // Validate column IDs are numeric
        for(let id of include) {
            if(isNaN(parseInt(id))) {
                return res.status(400).send(`Bad Request 1601: ${id} must be numeric`);
            }
        }

        // console.log('feature = ', feature);
        // console.log('includes = ', include);
        console.log('filters = ', filter);
    
        // Construct object of parsed filters
        // console.log(filter);
        let filters = [];
        let universalFilters = {};

        for (const elem in filter) {

            let isUniverisal = false;
            const keys = Object.values(filter[elem][1])
            // check for universal filters
            if(['sorta','sortd','limit','offset','pk'].includes(keys[0])) {
                let id = keys[2];
                let key = keys[0];
                if (universalFilters[key]){
                    return res.status(400).send(`Bad Request 2205: Cannot have duplicate filters`);
                } else {
                    universalFilters[key] = id;
                }
                isUniverisal = true;
                continue;
            }
            
            // Validate filter keys are numeric
            if(isNaN(parseInt(keys[0]))) {
                return res.status(400).send(`Bad Request 1602: filters must be numeric IDs or universals`);
            }

            let operation = keys[1];
            
            // if not a valid operation
            if(operation === null) {
                return res.status(400).send(`Bad Request 1603: ${url.slice(url.indexOf('[')+1, url.indexOf(']'))} is not a valid operator`);
            } 
            
            // setting up custom operator
            /*
                filters
                
                Group: ['and'|'or', Group|Filter]
                Filter: { key: String, op: String, val: String }
            */
            if (!isUniverisal) {
                // first operation
                if (filter[elem][0] === '')
                    filters.push([filter[elem][1]]);
                
                // operator for AND
                else if (filter[elem][0] === '&')
                    filters.push([filter[elem][1]]);
                
                // operator for OR
                else if (filter[elem][0] == '|'){
                    //console.log(filters);
                    filters[filters.length-1].push(filter[elem][1]);
                    //console.log(filters);
                }
                else
                    return res.status(400).send(`Bad Request 1604: ${filter[elem][0]} is not a valid operator`);
            }
        }

        console.log('Filters: ', filters)
        // attaching parsed object
        res.locals.parsed.request = "audit";
        res.locals.parsed.features = feature;
        res.locals.parsed.columns = include;
        res.locals.parsed.filters = filters;
        res.locals.parsed.universalFilters = universalFilters;
        next(); // passing to validate.js 
    }
}

////// UPLOAD PARSING ////// 

function uploadParse(req, res, next) {
    res.locals.parsed = {}; // attaching parsed object
    next(); // passing to insert.js
}

////// TEMPLATE PARSING //////

function templateParse(req, res, next) {
    // init request parse object
    res.locals.parsed = {};
    res.locals.parsed = JSON.parse(JSON.stringify(req.body));
    next(); // passing to template.js
}

////// SETUP PARSING //////

function setupParse(req, res, next) {
    // init request parse object
    res.locals.parsed = {};
    // add If-Modified-Since header
    res.locals.parsed.ifModifiedSince = req.headers['If-Modified-Since'];
    next();
}

////// END OF SETUP PARSING //////

function parseOrganizationID(req, res, next) {
    try {
        if(!req.query.organizationID || isNaN(parseInt(req.query.organizationID))) {
            return res.status(400).end();
        }

        res.locals.requestedOrganizationID = parseInt(req.query.organizationID);
        return next();
    } catch(err) {
        return res.status(500).end();
    }
}

function parseSignedUrl(req, res, next) {
    try {
        if(!req.query.organizationID || !req.query.type || !req.query.fileName || isNaN(parseInt(req.query.organizationID))) {
            return res.status(400).end();
        }

        res.locals.requestedOrganizationID = parseInt(req.query.organizationID);
        res.locals.contentType = req.query.type;
        res.locals.fileName = req.query.fileName;

        return next();
    } catch(err) {
        return res.status(500).end();
    }
}

////// STATS PARSING //////
// ==================================================
// No parsing needed for stats query
// ==================================================
function statsParse(req, res, next) {
    next();
}
// ==================================================
////// END OF STATS PARSING //////

////// DATE PARSING //////
function timestamptzParse(s) {
    let b = s.split(/\D/);
    --b[1];                  // Adjust month number
    b[6] = b[6].substr(0,3); // Microseconds to milliseconds
    return new Date(Date.UTC(...b)).toUTCString();
}

// this will throw if date isn't validated to be MM-DD-YYYY
function apiDateToUTC(date) {
    let arr = date.split('-');
    return(new Date(arr[2] + '-' + arr[0] + '-' + arr[1]).toUTCString());
}
////// END OF TIMESTAMPTZ PARSING  //////

module.exports = {
    statsParse,
    keyQueryParse: parseConstructor('key'),
    queryParse: parseConstructor('other'),
    uploadParse,
    templateParse,
    setupParse,
    timestamptzParse,
    apiDateToUTC,
    parseOrganizationID,
    parseSignedUrl,
}