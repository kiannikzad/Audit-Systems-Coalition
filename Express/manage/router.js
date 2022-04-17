const express = require('express'); 
const router = express.Router(); //use router instead of app

// File Parsing
const multer  = require('multer');
const uploadFile = multer()

// Middleware
const parse = require('../parse.js');
const { formatDistinct } = require('../query/query.js');
const { auditManagment, sopManagement } = require('../query/direct.js');
const { validateObservation, validateItem } = require('../validate.js')
const cacheLayer = require('../query/cacheLayer.js');
const template = require('../template.js');
const { authorizeObservationQuery, authorizeItemQuery } =  require('../auth/authorizer.js');
const { sendSignedUrl } = require('./signedUrl.js');
const { authorizeAuditor } = require('../auth/authorizer.js');
const { parseOrganizationID, parseSignedUrl } = require('../parse.js');
const { itemOrObservationQuery, setupSpreadsheet, formatObjectsSpreadsheet, generateSpreadsheet } = require('./spreadsheet/generate.js');
const { parseSpreadsheet } = require('./spreadsheet/upload.js');


router.get('/audits', parseOrganizationID, authorizeAuditor, auditManagment);

router.get('/signed-url', parseSignedUrl, authorizeAuditor, sendSignedUrl);

router.get('/sops', parseOrganizationID, authorizeAuditor, sopManagement);

router.get('/spreadsheet', parseOrganizationID, authorizeAuditor, setupSpreadsheet, itemOrObservationQuery, formatDistinct, formatObjectsSpreadsheet, generateSpreadsheet)

router.post('/spreadsheet', parseOrganizationID, authorizeAuditor,  uploadFile.single('spreadsheet'), parseSpreadsheet)

module.exports = router;