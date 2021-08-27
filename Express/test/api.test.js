/**
 * CONFIG
 */
// Set the app to Testing mode first
process.argv[2] = '--test'
// Link to server file
var app = require('../app'); 

const supertest = require('supertest');
const request = supertest(app);

// Shape of Object matcher
const { toMatchOneOf, toMatchShapeOf } = require('jest-to-match-shape-of')
 
expect.extend({
  toMatchOneOf,
  toMatchShapeOf,
})

/**
 * ENDPOINTS
 */
// Define different endpoints to test
let setup = '/api/setup';

let observationBase = '/api/audit/observation/sink/';

let itemBase = '/api/audit/item/sink/';

let invalidItem = '/api/audit/observation/invalid/50'
let invalidObservation = '/api/audit/item/invalid/50'

let nonNumericID = observationBase + 'bad';
let invalidOperator = observationBase + '66?65[get]=01-20-2000';

let o4 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=50&sorta=70';
let o5 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=50&offset=10';
let o6 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=50&offset=10&sorta=70&sortd=70';
let o7 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=50&offset=10&sorta=70&sorta=70';
let o8 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=50&offset[dne]&sorta=70';
let o9 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=0&offset=10&sorta=70';
let o10 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=50&offset=-10&sorta=70';
let o11 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=50&offset=10&sorta=abc'
<<<<<<< Updated upstream

let o12 = observationBase + '66&65&73&70&292&293?65[gte]=01-20-2000&65[lte]=01-20-2020&limit=50&offset=abc&sorta=70';
=======
let o12 = observationBase + '70&81?70[lte]=1.03|70[gte]=7|70[gte]=6&70[lte]=1|70[~]=5'
>>>>>>> Stashed changes

let o13 = '/api/audit/item/key/user?limit=10&offset=1&sorta=264'
let o14 = '/api/audit/observation/key/sink?limit=10&offset=1&sorta=66'
let o15 = '/api/audit/item/user/265?pk=4'

/**
 * OBJECTS
 */

const setupObject = {
    "children": [],
    "subfeatureStartIndex": 0,
    "items": [],
    "itemTypeID": [],
    "features": [],
    "featureTypeID": [],
    "columns": [],
    "datatypes": [],
 
    "returnableIDToTreeID": {},
    "treeIDToReturnableID": {}          
}


/**
 * TESTS
 */

test('setupObject correct shape', done => {
    request
        .get(setup)
        .end( (err, res) => {
            if(err) return done(err)
            expect(Object.keys(res.body)).toEqual([
                'children',
                'subfeatureStartIndex',
                'items',
                'features',
                'columns',
                'datatypes',
                'returnableIDToTreeID',
                'treeIDToReturnableID'
              ])
            done()
        })
})

test('Invalid item', function (done) {
    request
        .get(invalidItem)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2201: observation_invalid is not a valid feature')
            done();
        });
});

test('Invalid observation', function (done) {
    request
        .get(invalidObservation)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2201: item_invalid is not a valid item')
            done();
        });
});

test('Test invalid non-numeric ID', function (done) {
    request
        .get(nonNumericID)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 1601: bad must be numeric')
            done();
        });
});

test('Test invalid operator', function (done) {
    request
        .get(invalidOperator)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 1603: get is not a valid operator');
            done();
        });
});

test('Test limit requiring offset', function (done) {
    request
        .get(o4)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2208: Limit requires offset');
            done();
        });
});

test('Test offset requiring sorta or sortd', function (done) {
    request
        .get(o5)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2207: Offset requires either sorta or sortd');
            done();
        });
});

test('Test not using both sorta and sortd', function (done) {
    request
        .get(o6)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2206: Cannot use both sorta and sortd');
            done();
        });
});

test('Test duplication of filters', function (done) {
    request
        .get(o7)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2205: Cannot have duplicate filters');
            done();
        });
});

test('Test invalid operator for filter', function (done) {
    request
        .get(o8)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2209: Field for offset must be zero or a positive integer');
            done();
        });
});

test('Test positive integer for filter ', function (done) {
    request
        .get(o9)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2210: Field for limit must be a positive integer');
            done();
        });
});

test('Test positive integer or zero for filter', function (done) {
    request
        .get(o10)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe('Bad Request 2209: Field for offset must be zero or a positive integer');
            done();
        });
});


test('Test for valid number for filter', function (done) {
    request
        .get(o11)
        .end(function (err, res) {
            if (err) return done(err);
            checkResponse(res, 400);
            expect(res.text).toBe("Bad Request 2210: Field for sorta must be a positive integer");
            done();
        });
});

test('Test OR operator during filter', function (done) {
    request
        .get(o12)
        .end((err, res) => {
            if(err) return done(err)
            expect(res.body).toEqual({})
            done()
        })
});

test('Test for item/key query', done => {
    request
        .get(o13)
        .end( (err, res) => {
            if (err) return done(err);
            expect(Object.keys(res.body)).toEqual([
                'primaryKey'
            ]);
            done();
        });
});

test('Test for observation/key query', done => {
    request
        .get(o14)
        .end( (err, res) => {
            if (err) return done(err);
            expect(Object.keys(res.body)).toEqual([
                'primaryKey'
            ]);
            done();
        });
});

test('Testing universal pk filter', function (done) {
    request
        .get(o15)
        .end(function (err, res) {
            if (err) return done(err);
            expect(Object.keys(res.body)).toEqual([
                'returnableIDs',
                'rowData',
                'primaryKey'
            ])
            done();
        });
});

// Helper functions
function checkResponse(res, status) {
    if (!expect(res).toBeDefined() || !expect(res.status).toBe(status)) {
        return false;
    }
    return true;
}