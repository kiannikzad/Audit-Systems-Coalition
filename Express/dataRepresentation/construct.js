// CALLING //
// ============================================================
/*
1. Insert features into metadata_feature,
    create feature_..., subfeature_..., and item_... tables (auditing tables)
2. Add foreign key constraints for auditing tables

3. Insert columns into metadata_column and add data_... columns
4. Add foreign key constraints for data_... columns
5. Add local-global and special columns into metadata_column for every feature

Proposed New Steps:
1.  in: featureInput
        - create item_... tables for root features
            create_observational_item_table(feature_name TEXT)
                -> item table name
        - add foreign key constraints for observational item tables
            add_item_to_item_reference(item_name TEXT, requiredItem regclass, isID BOOLEAN, isNullable BOOLEAN)
        - insert observable items into metadata_item
            insert_metadata_item_observable(item, creationpriv)
        - insert item to item relations into m2m_metadata_item
            insert_m2m_metadata_item(item)
        - create observation_... and subobservation_... tables (obs first!)
            create_observation_table
            create_subobservation_table
        - insert features into metadata_feature
            insert_metadata_feature
            insert_metadata_subfeature

*/

/*

3.  in: returnableInput

Problem
    attributes make there a single metadata_column map to two returnables within a feature
\
constraint: no item can reference another item more than once
            lists are always nullable
            item cannot reference same location type more than once
            attributes are always non nullable
            lists and factors are specific to one item or observation table


Finding returnables
1. start at feature and go to corresponding observable item
2. find all data columns for that item
3. go to that item's referenced items and go back to step 2

repeats:
    attribute
    data column referenced more than once within a feature tree


forEach root + submission {

    let generateReturnables(...)

}


npm run construct -- make-schema [water] [--show-computed | -sc] 

    if there is a returnables folder it doesn't remake

npm run construct -- --config-returnables [water] file=[config] [--remove | -r]
                        command        audit schema     file     remove the file   

npm run construct -- inspect [--feature | -f] [--returnable | -r] [--column | -c]

make the returnables folder and files


let ex = {
    metadataColumnID: 'a',
    featureName: 'a',
    rootFeatureName: 'a',
    joinObject: {
        columns: 'Array',
        tables: 'Array',
        appendSQL: 'String',
        selectSQL: 'String'
    },
    isRealGeo: 'a'
}
*/

// ============================================================
// This script constructs feature/subfeature tables
// and simultaneously inserts relevant metadata.
//
// TODO: referencing items that were specified
//       everything inside a transaction?
//
// ============================================================
const pgp = require("pg-promise")(); // Postgres interaction
const fs = require('fs'); // Import Node.js File System
const stripJsonComments = require('strip-json-comments');
const chalk = require('chalk');
var util = require('util');


const {} = require('../statement.js');
const { utils } = require("pg-promise");

// Database Connection Setup
// connection info
const connection = { 
    host: 'localhost',
    port: 5432,
    database: 'v4',
    user: 'postgres',
    password: null,
    max: 5 // use up to 5 connections
    };

    // connect to postgres
    var db = pgp(connection);


// SQL Statements

var insert_m2m_metadata_item = 'CALL "insert_m2m_metadata_item"($(observableItem), $(referenced), $(isID), $(isNullable))';

var add_item_to_item_reference = 'SELECT "add_item_to_item_reference"($(observableItem), $(referenced), $(isID), $(isNullable)) AS idColumn';

var insert_metadata_column = 'CALL \
"insert_metadata_column"($(columnName), $(tableName), $(observationTableName), $(subobservationTableName), $(itemTableName), $(isDefault), $(isNullable), $(frontendName), $(filterSelectorName), $(inputSelectorName), $(frontendType), $(information), $(sqlType), $(referenceType))';

var insert_metadata_feature = 'CALL "insert_metadata_feature"($(tableName), $(itemTableName), $(information), $(frontendName))';

var insert_metadata_subfeature = 'CALL "insert_metadata_subfeature"($(tableName), $(parentTableName), $(numFeatureRange), $(information), $(frontendName))';

var insert_metadata_item_observable = 'CALL "insert_metadata_item_observable"($(itemName), $(creationPrivilege))';

var create_observation_table = 'CALL "create_observation_table"($(tableName))';

var create_subobservation_table = 'CALL "create_subobservation_table"($(tableName), $(parentTableName))';

var create_observational_item_table = 'SELECT "create_observational_item_table"($(featureName))';

var add_unique_constraint = 'CALL "add_unique_constraint"($(tableName), $(uniqueOver))';

var add_data_col = 'CALL "add_data_col"($(tableName), $(columnName), $(sqlType), $(isNullable))';

var add_list = 'CALL "add_list"($(itemTableName), $(tableName), $(columnName), $(sqlType), $(isObservational))';

var add_location = 'CALL "add_location"($(itemTableName), $(locationTableName), $(isNullable))';

var add_factor = 'CALL "add_factor"($(itemTableName), $(tableName), $(columnName), $(sqlType), $(isNullable), $(isObservational))';

var add_attribute = 'CALL "add_attribute"($(itemTableName), $(tableName), $(columnName), $(sqlType))';

const getReturnables = 'SELECT r.returnable_id AS id, f.table_name AS feature, r.frontend_name as frontendName, r.is_used AS isUsed, r.join_object AS joinObject, r.is_real_geo AS isRealGeo \
                        FROM metadata_returnable AS r LEFT JOIN metadata_feature AS f on r.feature_id = f.feature_id'


const getItemParents = 'SELECT child.table_name AS child, parent.table_name AS parent_, m2m.is_id AS isID \
                          FROM metadata_item AS child \
                          INNER JOIN m2m_metadata_item AS m2m ON child.item_id = m2m.item_id \
                          INNER JOIN metadata_item AS parent ON m2m.referenced_item_id = parent.item_id';

const makeItemReturnablesColumnQuery = 'SELECT c.column_id AS columnID, c.column_name AS columnName, c.table_name AS tableName, c.subobservation_table_name AS subobservationTableName, c.frontend_name AS frontendName, r.type_name AS ReferenceTypeName FROM metadata_column AS c INNER JOIN metadata_reference_type AS r ON c.reference_type = r.type_id WHERE c.metadata_item_id = (SELECT i.item_id FROM metadata_item AS i WHERE i.table_name = $(itemName))'
const makeItemReturnablesFeatureQuery = 'SELECT f.feature_id AS featureID FROM metadata_feature AS f WHERE f.table_name = $(featureName)'
const makeItemReturnablesSubobservationQuery = 'SELECT f.feature_id AS featureID FROM metadata_feature AS f WHERE f.table_name = $(subobservationTableName)'
const insert_metadata_returnable = 'SELECT "insert_metadata_returnable"($(columnID), $(featureID), $(rootFeatureID), $(frontendName), $(isUsed), $(joinObject:json), $(isRealGeo)) AS returnableid'
    
// use PROCEDURE instead of FUNCTION for PostgreSQL v10 and below
const checkAuditorNameTrigger = "CREATE TRIGGER $(tableName:value)_check_auditor_name BEFORE INSERT OR UPDATE ON $(tableName:value) \
FOR EACH ROW EXECUTE FUNCTION check_auditor_name();"


// Construction CLI //
// ============================================================

// remove boilerplate argv elements
process.argv.splice(0, 2)

console.log(chalk.blue.bold(`Running ${process.argv[0]}`));

if(process.argv[0] == 'make-schema') {
    let commandLineArgs = {};
    // remove command
    process.argv.splice(0, 1);
    // get and remove audit type
    commandLineArgs.schema = process.argv[0];
    process.argv.splice(0, 1);
    // configure command line arguments
    (process.argv.includes('--show-computed') || process.argv.includes('-sc') ? commandLineArgs.showComputed = true : commandLineArgs.showComputed = false);
    // here we go
    return makeSchema(commandLineArgs);
} else if(process.argv[0] == 'config') {
    let commandLineArgs = {};
    // remove command
    process.argv.splice(0, 1);
    // get and remove audit type
    commandLineArgs.schema = process.argv[0];
    process.argv.splice(0, 1);
    // configure command line arguments
    let argFile = process.argv.filter(arg => /^file=.*/.test(arg));
    if(argFile.length != 1) throw 'One file must be specified as a command line argument with \'--file=yourFile\'';
    commandLineArgs.file = argFile[0].match(/^file=(.*)/)[1];
    (process.argv.includes('log') ? commandLineArgs.log = true : commandLineArgs.log = false);
    // here we go
    return configureReturnables(commandLineArgs);
} else if(process.argv[0] == 'inspect') {
    let commandLineArgs = {};
    // remove command
    process.argv.splice(0, 1);
    // configure command line arguments
    if(process.argv.includes('--returnable') || process.argv.includes('-r')) {
        commandLineArgs.type = 'r'
        let argFilter = process.argv.filter(arg => /^--filter=.*/.test(arg));
        if(argFilter.length == 1) {
            commandLineArgs.filter = argFilter[0].match(/^--filter=(.*)/)[1];
        } else {
            commandLineArgs.filter = null;
        }
        (process.argv.includes('-u') || process.argv.includes('--used') ? commandLineArgs.used = true : commandLineArgs.used = false);
    } else if(process.argv.includes('--feature') || process.argv.includes('-f')) {
        commandLineArgs.type = 'f'
    } else if(process.argv.includes('--column') || process.argv.includes('-c')) {
        commandLineArgs.type = 'c'
    } else {
        throw Error('\'construct inspect\' requires flag of \'-r\', \'-f\', or \'-f\'')
    }
    // here we go
    return inspectSchema(commandLineArgs);
} else {
    throw Error('Not a valid construction command');
};



// High Level Functions //
// ============================================================
async function makeSchema(commandLineArgs) {
    console.log(commandLineArgs)

    // Read schema
    // Columns
    let columns = readSchema(`/auditSchemas/${commandLineArgs.schema}/columns.jsonc`);
    let globalColumns = readSchema('/auditSchemas/globalSchema/columns.jsonc');
    // Features
    let features = readSchema(`/auditSchemas/${commandLineArgs.schema}/features.jsonc`);

    // Call Construction Function
    await asyncConstructAuditingTables(features, [...columns, ...globalColumns], commandLineArgs);

    // Closing the database connection
    db.$pool.end();
}

async function inspectSchema(commandLineArgs) {
    let out;

    if(commandLineArgs.type === 'r') {

        if(commandLineArgs.used === true) {
            if(commandLineArgs.filter !== null) {
                out = await db.any(pgp.as.format('SELECT * FROM metadata_returnable AS r WHERE r.feature_id = (SELECT feature_id FROM metadata_feature WHERE table_name = $(filter)) AND r.is_used = true', {
                    filter: commandLineArgs.filter
                }));
            } else {
                out = await db.any('SELECT * FROM metadata_returnable WHERE is_used = true')
            }
        } else {
            if(commandLineArgs.filter !== null) {
                out = await db.any(pgp.as.format('SELECT * FROM metadata_returnable AS r WHERE r.feature_id = (SELECT feature_id FROM metadata_feature WHERE table_name = $(filter))', {
                    filter: commandLineArgs.filter
                }));
            } else {
                out = await db.any('SELECT * FROM metadata_returnable')
            }
        }
        
    } else if(commandLineArgs.type === 'f') {
        out = await db.any('SELECT * FROM metadata_feature');
    } else if(commandLineArgs.type === 'c') {
        out = await db.any('SELECT * FROM metadata_column');
    }

    console.log(out)

    // Closing the database connection
    db.$pool.end();
}


// Functions //
// ============================================================


/* asyncConstructAuditingTables (featureSchema, columnSchema)
============================================================
Takes a list of metadataFeatureInput objects (featureSchema)
and list of metadataColumnInput objects (columnSchema)
to execute all SQL statements to construct relevant tables

in: featureSchema: Array of metadataFeatureInput objects (parsed features.jsonc)
    columnSchema: Array of metadataColumnInput objects (parsed columns.jsonc)

out: nothing (database queries are made within)
============================================================ */

async function asyncConstructAuditingTables(featureSchema, columnSchema, commandLineArgs) {

    // Step 1.
    /*
        1.  in: featureInput
        - create item_... tables for root features
            create_observational_item_table(feature_name TEXT)
                -> item table name
        - add foreign key constraints for observational item tables
            add_item_to_item_reference(item_name TEXT, requiredItem regclass, isID BOOLEAN, isNullable BOOLEAN)
        - insert observable items into metadata_item
            insert_metadata_item_observable(item, creationpriv)
        - insert item to item relations into m2m_metadata_item
            insert_m2m_metadata_item(item)
        - create observation_... and subobservation_... tables (obs first!)
            create_observation_table
            create_subobservation_table
        - insert features into metadata_feature
            insert_metadata_feature
            insert_metadata_subfeature
    */
    //console.log('\x1b[1m', '1. Constructing Features')
    console.log(chalk.whiteBright.bold('1. Constructing Features'));

    let featureOutput = await constructFeatures2(featureSchema);
    // if there is an error in feature construction exit function
    if(featureOutput.error === true) {
        return
    }

    console.log(chalk.green('Done Constructing Features \n'))

    // Step 2.
    /*
    2.  in: columnInput
            forEach column:
                - insert column into metadata_column
                switch (refType) 
                    item-id
                        add item data col
                    item-non-id
                        add item data col
                    item-list
                        create list and m2m tables
                        add foreign keys
                    item-location
                        add location_<type> column
                        add foreign key
                    item-factor
                        create factor table
                        add item reference column
                        add foreign key
                    obs
                        add observation data column
                    obs-global
                        add observation data column for every feature
                    obs-list
                        create list and m2m tables
                        add foreign keys
                    obs-factor
                        create factor table
                        add item reference column
                        add foreign key
                    special
                        perform special operation for every feature
                    attribute 
                        create attribute table
                        add attribute reference column in observation_... table
                        add attribute reference column in item_... table
            - add observable item_... table unique constraints
    */
    console.log(chalk.whiteBright.bold('2. Constructing Columns'));

    let columnOutput = await addDataColumns2(columnSchema, featureSchema, featureOutput.itemIDColumnLookup, featureOutput.featureItemLookup);
    // if there is an error in column construction exit function
    if(columnOutput.error === true) {
        return 
    }

    // Intermezzo: construct the itemParents object
    let itemParentLookup = await makeItemParentLookup();

    console.log(chalk.green('Constructed the itemParents object'));
    
    console.log(chalk.green('Done Constructing Columns \n'));

    // Step 3.
    // Generate Returnables and insert into metadata_returnable
    // maybe get all the features from step 1 and then iterate through
    // them and call generateReturnables

    console.log(chalk.whiteBright.bold('3. Constructing Returnables'));

    // for each root feature generate returnables
    for(let feature of Object.keys(featureOutput.featureItemLookup)) {
        console.log(chalk.whiteBright.bold(`Constructing returnables for the ${feature} feature`));
        let itemArray = [
            {
                featureName: feature,
                itemName: featureOutput.featureItemLookup[feature],
                path: []
            }
        ];

        // Calling generateReturnables
        let returnables = await generateReturnables(itemArray, [], itemParentLookup, featureOutput.itemRealGeoLookup, featureOutput.featureItemLookup);
        console.log(chalk.whiteBright.bold(`Constructed IDs: ${returnables.join(', ')} for the ${feature} feature \n`));
    };

    // Creating the computed file and returnables folder 
    if(commandLineArgs.showComputed === true) {
        console.log(chalk.whiteBright.bold(`Writing returnables to the ${commandLineArgs.schema} folder`));

        fs.mkdirSync(__dirname + '/auditSchemas/' + commandLineArgs.schema + '/returnables', {recursive: true})
        console.log(chalk.whiteBright.bold(`Made the 'returnables' directory for auditSchemas/${commandLineArgs.schema}`));

        let currentReturnables = await db.many(getReturnables);
        currentReturnables = JSON.stringify(currentReturnables);

        // writing the JSON
        fs.writeFileSync(`${__dirname}/auditSchemas/${commandLineArgs.schema}/returnables/computedAt-${Date.now()}.json`, currentReturnables);
        console.log(chalk.whiteBright.bold(`Wrote computedAt-${Date.now()}.json in the 'returnables' directory for auditSchemas/${commandLineArgs.schema}`));
    }
    
    // Done!
    
    console.log(chalk.blueBright.bgWhiteBright('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'));
    console.log(chalk.blueBright.bgWhiteBright('                             '));
    console.log(chalk.green.bgWhiteBright('   Successful Construction   '));
    console.log(chalk.blueBright.bgWhiteBright('                             '));
    console.log(chalk.blueBright.bgWhiteBright('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'));
    console.log(chalk.black.bgWhiteBright(' Long live the power source! '));
    
};



/* constructFeatures (features)
============================================================
Inserts all the features into metadata_features and creates the 
observation_..., subobservation_... and observable item tables
 needed for the features to exist in the schema

in: features: Array of metadataColumnInput objects (parsed features.jsonc)

out: errorObject: specifies if there is an error
     itemIDColumnLookup: item -> Array of ID Columns
     featureItemLookup: feature -> item
     itemRealGeoLookup: item -> realGeo object
============================================================ */
async function constructFeatures2(features) {

    let featureItemLookup = {};
    let itemIDColumnLookup = {};
    let itemRealGeoLookup = {};

    // Split root features and subfeatures
    let rootFeatures = features.filter(feature => feature.observableItem !== null);
    let subfeatures = features.filter(feature => feature.observableItem === null);

    // Sanity check
    if([...rootFeatures, ...subfeatures].length !== features.length) {
        return constructjsError('Root features and subfeatures do not partition all features')
    }

    // a. Create item_... tables for root features and make lookups
    for(let feature of rootFeatures) {
        try {
            // Wait for item table creation and return item table name
            let item = await db.one(pgp.as.format(create_observational_item_table, {
                featureName: feature.tableName
            }));

            item = item.create_observational_item_table;

            console.log(chalk.green(`Feature Construction: Observable item table created for ${feature.tableName}`));

            // make lookups
            featureItemLookup[feature.tableName] = item;
            itemIDColumnLookup[item] = [];
            itemRealGeoLookup[featureItemLookup[feature.tableName]] = feature.observableItem.realGeo;

        } catch(sqlError) {
            return constructjsError(sqlError);
        }
    };

    // b. Insert observable items into metadata_item
    for(let feature of rootFeatures) {
        try {
            await db.none(pgp.as.format(insert_metadata_item_observable, {
                itemName: featureItemLookup[feature.tableName],
                creationPrivilege: feature.observableItem.creationPrivilege
            }));

            console.log(chalk.green(`Feature Metadata: Inserted ${featureItemLookup[feature.tableName]} into metadata_item`));
        } catch(sqlError) {
            return constructjsError(sqlError);
        }
    };

    // c. Add foreign key constraints for observational item tables
    // d. Insert item to item relations into m2m_metadata_item    
    for(let feature of rootFeatures) {
        // for every required item in the feature
        for(let required of feature.observableItem.requiredItem) {
            try {
                // c.
                let idColumn = await db.one(pgp.as.format(add_item_to_item_reference, {
                    observableItem: featureItemLookup[feature.tableName],
                    referenced: required.name,
                    isID: required.isID,
                    isNullable: required.isNullable
                }));

                idColumn = idColumn.idcolumn;

                itemIDColumnLookup[featureItemLookup[feature.tableName]].push(idColumn);

                console.log(chalk.green(`Feature Construction: ${featureItemLookup[feature.tableName]} to ${required.name} relation created`));

                // d.
                await db.none(pgp.as.format(insert_m2m_metadata_item, {
                    observableItem: featureItemLookup[feature.tableName],
                    referenced: required.name,
                    isID: required.isID,
                    isNullable: required.isNullable
                })); 

                console.log(chalk.green(`Feature Metadata: Inserted ${featureItemLookup[feature.tableName]} to ${required.name} relation into m2m_metadata_item`));
            } catch(sqlError) {
                return constructjsError(sqlError);
            }
        }
    };

    // e. Create observation_... tables
    // f. Insert features into metadata_feature
    // filtering to get just root features
    for(let rootFeature of rootFeatures) {
        try {
            // e.
            await db.none(pgp.as.format(create_observation_table, {
                tableName: rootFeature.tableName
            }));

            console.log(chalk.green(`Feature Construction: Created ${rootFeature.tableName} table`));

            //f. 
            await db.none(pgp.as.format(insert_metadata_feature, {
                tableName: rootFeature.tableName,
                itemTableName: featureItemLookup[rootFeature.tableName],
                information: rootFeature.information,
                frontendName: rootFeature.frontendName
            }));

            console.log(chalk.green(`Feature Metadata: Inserted ${rootFeature.tableName} into metadata_feature`));

        } catch(sqlError) {
            return constructjsError(sqlError);
        }
    };

    // g. Create subobservation_... tables
    // h. Insert subfeatures into metadata_feature
    // filtering to get just subfeatures
    for(let subfeature of subfeatures) {
        try {
            // g.
            await db.none(pgp.as.format(create_subobservation_table, {
                tableName: subfeature.tableName,
                parentTableName: subfeature.parentTableName
            }));

            console.log(chalk.green(`Feature Construction: Created ${subfeature.tableName} table`));

            // h.
            await db.none(pgp.as.format(insert_metadata_subfeature, {
                tableName: subfeature.tableName,
                parentTableName: subfeature.parentTableName,
                numFeatureRange: subfeature.numFeatureRange,
                information: subfeature.information,
                frontendName: subfeature.frontendName
            }));

            console.log(chalk.green(`Feature Metadata: Inserted ${subfeature.tableName} into metadata_feature`));
        } catch(sqlError) {
            return constructjsError(sqlError);
        }
    };

    // No construction errors
    return {error: false, itemIDColumnLookup, featureItemLookup, itemRealGeoLookup};
};



/* addDataColumns (columns, features, itemIDColumnLookup, featureItemLookup)
============================================================
Inserts all the columns into metadata_column and creates the 
tables or columns needed for the column to exist in the schema

in: columns: Array of metadataFeatureInput objects (parsed features.jsonc)
    features: Array of metadataColumnInput objects (parsed features.jsonc)
    itemIDColumnLookup: item -> Array of ID Columns
    featureItemLookup: feature -> item

out: errorObject: specifies if there is an error
============================================================ */

async function addDataColumns2(columns, features, itemIDColumnLookup, featureItemLookup) {

    // Globals
    // These data columns are defined for every feature
    for(let column of columns.filter(column => column.referenceType === 'obs-global' || column.referenceType === 'special')) {
        for(let feature of features) {

            // insert into metadata_column
            try {
                await db.none(pgp.as.format(insert_metadata_column, {
                    columnName: column.columnName,
                    tableName: (column.tableName === null ? feature.tableName : column.tableName),
                    observationTableName: column.observationTableName,
                    subobservationTableName: column.subobservationTableName,
                    itemTableName: featureItemLookup[feature.tableName],
                    isDefault: column.isDefault,
                    isNullable: column.isNullable,
                    frontendName: column.frontendName,
                    filterSelectorName: column.filterSelectorName,
                    inputSelectorName: column.inputSelectorName,
                    frontendType: column.frontendType,
                    information: column.information,
                    sqlType: column.sqlType,
                    referenceType: column.referenceType
                }));

                console.log(chalk.green(`Column Metadata: Inserted global column ${column.columnName} into metadata_column for ${featureItemLookup[feature.tableName]}`));
            } catch(sqlError) {
                return constructjsError(sqlError);
            }

            // if observation-global add the data column for all features
            if(column.referenceType === 'obs-global') {
                try {
                    await db.none(pgp.as.format(add_data_col, {
                        tableName: feature.tableName,
                        columnName: column.columnName,
                        sqlType: column.sqlType,
                        isNullable: column.isNullable
                    }))

                    console.log(chalk.green(`Column Construction: Added global column ${column.columnName} to ${feature.tableName}`));
                } catch(sqlError) {
                    return constructjsError(sqlError);
                }
            }
            
        }
        
    };

    // Standard columns (Non global)
    for(let column of columns.filter(column => column.referenceType !== 'obs-global' && column.referenceType !== 'special')) {

        // insert into metadata_column
        try {
            await db.none(pgp.as.format(insert_metadata_column, {
                columnName: column.columnName,
                tableName: column.tableName,
                observationTableName: column.observationTableName,
                subobservationTableName: column.subobservationTableName,
                itemTableName: column.itemName,
                isDefault: column.isDefault,
                isNullable: column.isNullable,
                frontendName: column.frontendName,
                filterSelectorName: column.filterSelectorName,
                inputSelectorName: column.inputSelectorName,
                frontendType: column.frontendType,
                information: column.information,
                sqlType: column.sqlType,
                referenceType: column.referenceType
            }));

            console.log(chalk.green(`Column Metadata: Inserted column ${column.columnName} into metadata_column for ${column.itemName}`));
        } catch(sqlError) {
            return constructjsError(sqlError);
        }

        try {
            switch (column.referenceType) {
                case 'item-id':
                    // reference type test
                    if((column.itemName !== column.tableName) || column.isNullable !== false) {
                        throw 'item-id returnables must have matching table name and item name, and be not nullable';
                    };

                    // add to the id column lookup
                    itemIDColumnLookup[column.itemName].push(column.columnName);
    
                    // schema generation
                    await db.none(pgp.as.format(add_data_col, {
                        tableName: column.tableName, // same as itemName
                        columnName: column.columnName,
                        sqlType: column.sqlType,
                        isNullable: column.isNullable // must be false
                    }));

                    console.log(chalk.green(`Column Construction: Added ${column.referenceType} column ${column.columnName} to ${column.itemName}`));
                    break;

                case 'item-non-id':
                    // reference type test
                    if(column.itemName !== column.tableName) {
                        throw 'item-non-id returnables must have matching table name and item name';
                    };

                    await db.none(pgp.as.format(add_data_col, {
                        tableName: column.tableName, // same as itemName
                        columnName: column.columnName,
                        sqlType: column.sqlType,
                        isNullable: column.isNullable
                    }));

                    console.log(chalk.green(`Column Construction: Added ${column.referenceType} column ${column.columnName} to ${column.itemName}`));
                    break;

                case 'item-list':
                    // reference type test
                    if(/^list_/.test(column.tableName) !== true) {
                        throw 'item-list returnables must be within a list_... table';
                    };
                    
                    await db.none(pgp.as.format(add_list, {
                        itemTableName: column.itemName,
                        tableName: column.tableName,
                        columnName: column.columnName,
                        sqlType: column.sqlType,
                        isObservational: false  // false because item-list and not obs-list
                    }));

                    console.log(chalk.green(`Column Construction: Created ${column.tableName} tables with ${column.columnName} column for ${column.itemName}`));
                    break;

                case 'item-location':
                    // reference type test
                    if(/^location_/.test(column.tableName) !== true) {
                        throw 'item-location returnables must be within a location_... table';
                    };

                    await db.none(pgp.as.format(add_location, {
                        itemTableName: column.itemName,
                        locationTableName: column.tableName,
                        isNullable: column.isNullable
                    }));

                    console.log(chalk.green(`Column Construction: Added ${column.referenceType} column ${column.columnName} to ${column.itemName}`));
                    break;
                    
                case 'item-factor':
                    // reference type test
                    if(/^factor_/.test(column.tableName) !== true) {
                        throw 'item-factor returnables must be within a factor_... table';
                    };
                    
                    await db.none(pgp.as.format(add_factor, {
                        itemTableName: column.itemName,
                        tableName: column.tableName,
                        columnName: column.columnName,
                        sqlType: column.sqlType,
                        isNullable: column.isNullable,
                        isObservational: false  // false because item-factor and not obs-factor
                    }));

                    console.log(chalk.green(`Column Construction: Created ${column.tableName} table with ${column.columnName} column for ${column.itemName}`));
                    break;

                case 'obs':
                    
                    await db.none(pgp.as.format(add_data_col, {
                        tableName: column.tableName,
                        columnName: column.columnName,
                        sqlType: column.sqlType,
                        isNullable: column.isNullable
                    }));

                    console.log(chalk.green(`Column Construction: Added ${column.referenceType} column ${column.columnName} to ${column.itemName}`));
                    break;
                    
                case 'obs-global':

                    // This shouldn't happen!
                    throw 'Global observation columns should have been handled earlier in the function';

                case 'obs-list':
                    // reference type test
                    if(/^list_/.test(column.tableName) !== true) {
                        throw 'obs-list returnables must be within a list_... table';
                    };
                    
                    await db.none(pgp.as.format(add_list, {
                        itemTableName: column.itemName,
                        tableName: column.tableName,
                        columnName: column.columnName,
                        sqlType: column.sqlType,
                        isObservational: true  // true because obs-list and not item-list
                    }));

                    console.log(chalk.green(`Column Construction: Created ${column.tableName} tables with ${column.columnName} column for ${column.itemName}`));
                    break;

                case 'obs-factor':
                    // reference type test
                    if(/^factor_/.test(column.tableName) !== true) {
                        throw 'obs-factor returnables must be within a factor_... table';
                    };
                    
                    await db.none(pgp.as.format(add_factor, {
                        itemTableName: column.itemName,
                        tableName: column.tableName,
                        columnName: column.columnName,
                        sqlType: column.sqlType,
                        isNullable: column.isNullable,
                        isObservational: true  // true because obs-factor and not item-factor
                    }));

                    console.log(chalk.green(`Column Construction: Created ${column.tableName} table with ${column.columnName} column for ${column.itemName}`));
                    break;

                case 'special':

                    // This shouldn't happen!
                    throw 'Special columns should have been handled earlier in the function';

                case 'attribute':
                    // reference type test
                    if(/^attribute_/.test(column.tableName) !== true) {
                        throw 'attribute returnables must be within an attribute_... table';
                    };
                    
                    await db.none(pgp.as.format(add_attribute, {
                        itemTableName: column.itemName,
                        tableName: column.tableName,
                        columnName: column.columnName,
                        sqlType: column.sqlType
                    }));
                    
                    console.log(chalk.green(`Column Construction: Created ${column.tableName} table with ${column.columnName} column for ${column.itemName}`));
                    break;

                default:
                    throw `column ${column.columnName} has an invalid reference type of ${column.referenceType}`
            }
        } catch(sqlError) {
            return constructjsError(sqlError);
        };
    };

    // Adding unique constraints
    for(let item in itemIDColumnLookup) {

        let uniqueOver = itemIDColumnLookup[item].join(', ');
        try {
            await db.none(pgp.as.format(add_unique_constraint, {
                tableName: item,
                uniqueOver: uniqueOver
            }));   
        } catch(sqlError) {
            return constructjsError(sqlError);
        }
        
        console.log(chalk.green(`Column Construction: Created unique constraint on ${item} over ID columns ${uniqueOver}`));
    }

    // No construction errors
    return {error: false};
}



/* generateReturnables (itemArray, returnableArray, itemParentLookup, itemRealGeoLookup)
============================================================
in: itemArray: Array of items to find returnables for and their paths
    returnableArray: The array of returnables found within the recursion (starts out empty)
    itemParentLookup: item -> Array of parent items
    itemRealGeoLookup: item -> realGeo object

out: returnableArray: The complete array of returnableIDs
============================================================ */
async function generateReturnables(itemArray, returnableArray, itemParentLookup, itemRealGeoLookup, featureItemLookup) {

    let referencedItems = [];

    // For every item in round
    for(let itemObject of itemArray) {

        // generate returnable for every data column within or referenced by item
        // Calling makeItemReturnables
        let itemReturnables = await makeItemReturnables(itemObject, itemRealGeoLookup, featureItemLookup)

        // add returnables to master list
        returnableArray = [...returnableArray, ...itemReturnables];

        // if item has a parent calculate new path and add to referencedItems array 
        if(Object.keys(itemParentLookup).includes(itemObject.itemName)) {

            let parentItemArray = itemParentLookup[itemObject.itemName]

            // for each parent item
            parentItemArray.forEach(parent => {

                console.log(chalk.greenBright.underline(`Returnable Construction: Added parent item ${parent.itemName} of child item ${itemObject.itemName} to item stack`))

                // Make path with new item
                let newPath = [...itemObject.path, ...[itemObject.itemName, parent.itemName]]

                console.log(chalk.greenBright(`Returnable Construction: Path Updated: ${itemObject.path.join(', ')} -> ${newPath.join(', ')}`))

                // add parent to referencedItems
                referencedItems.push({
                    featureName: itemObject.featureName,
                    itemName: parent.itemName,
                    path: newPath
                })
            })
            
        }
    };
        
    if(referencedItems.length > 0) {
        // call again with new items and pass found returnables
        return generateReturnables(referencedItems, returnableArray, itemParentLookup, itemRealGeoLookup, featureItemLookup)
    } else {
        // return all the returnables
        return returnableArray
    }
    
}



/* makeItemReturnables (itemObject, itemRealGeoLookup, featureItemLookup)
============================================================
in: itemObject: Object that contains the feature, item, and path
    itemRealGeoLookup: contains the info to identify a real geo column
    featureItemLookup: feature -> item

out: returnables: Array of the returnables for the item
============================================================ */
async function makeItemReturnables(itemObject, itemRealGeoLookup, featureItemLookup) {
    let returnables = [];
    let joinObject = {
        columns: [],
        tables: []
    };
    let featureID;
    let isRealGeo = false;
    let rootFeatureID;

    // go to metadata_column and find all columns for said item
    let columns = await db.any(pgp.as.format(makeItemReturnablesColumnQuery, {
        itemName: itemObject.itemName
    }));

    // if not submission get the featureID
    if(itemObject.featureName !== null) {
        featureID = await db.one(pgp.as.format(makeItemReturnablesFeatureQuery, {
            featureName: itemObject.featureName
        }));

        featureID = featureID.featureid;
    }

    // construct joinObject from path
    if(itemObject.path.length > 0) {
        // sanity check
        if(itemObject.path.length % 2 !== 0) {
            throw 'References must come in sets of 2'
        }
        // copy tables
        joinObject.tables = Array.from(itemObject.path)
        // make columns
        for(let n = 0; n < itemObject.path.length; n += 2) {
            // push foreign key column
            joinObject.columns.push(`${itemObject.path[n+1]}_id`);
            // push primary key column
            joinObject.columns.push('item_id');
        }
    }

    // if this is not the feature's observable item we ignore all non item-... columns
    if(featureItemLookup[itemObject.featureName] !== itemObject.itemName) {
        columns = columns.filter(col => ['item-id', 'item-non-id', 'item-list', 'item-location', 'item-factor', 'attribute'].includes(col.referencetypename))
    }
    
    // for each column related to the item
    for(let col of columns) {
        // PK
        let columnID = col.columnid;
        let frontendName = col.frontendname;
        // this is lowkey kind of dumb. The attributeType is different between cols so we can't
        // mutate the base joinObject. I'm sure there's a better way.
        let insertableJoinObject = {
            columns: joinObject.columns,
            tables: joinObject.tables,
            attributeType: null
        };

        // if not submission
        if(itemObject.featureName !== null) {
            // is it the realGeo column?
            let itemRealGeo = itemRealGeoLookup[featureItemLookup[itemObject.featureName]];
            // if it passes the identifying conditions, then it is the real geo
            if(itemRealGeo.itemName == itemObject.itemName && itemRealGeo.tableName == col.tablename && itemRealGeo.columnName == col.columnname) {
                isRealGeo = true;
            }

            // if subobservation
            if(col.subobservationtablename !== null) {
                rootFeatureID = featureID;
                console.log(chalk.red.bgBlack(pgp.as.format(makeItemReturnablesSubobservationQuery, {
                    subobservationTableName: col.subobservationtablename
                })));

                featureID = await db.one(pgp.as.format(makeItemReturnablesSubobservationQuery, {
                    subobservationTableName: col.subobservationtablename
                }));

                

                featureID = featureID.featureid;
            } else {
                // else then feature is already root
                rootFeatureID = null;
            }

        } else { // else then submission and no feature or geo information
            isRealGeo = false;
            featureID = false;
            rootFeatureID = false;
        }

        // attribute edge case where one column maps to 2 returnables
        if(col.referencetypename === 'attribute') {
            // if this is not the feature's observable item we only use 'current' attribute
            if(featureItemLookup[itemObject.featureName] !== itemObject.itemName) {

                // set attribute type
                insertableJoinObject.attributeType = 'current';
                // make valid JSON
                let insertableJoinObject_ = JSON.stringify(insertableJoinObject);

                // insert returnable into metadata_returnable and get returnableID
                let returnableID = await db.one(pgp.as.format(insert_metadata_returnable, {
                    columnID: columnID,
                    featureID: featureID,
                    rootFeatureID: rootFeatureID,
                    frontendName: 'Current ' + frontendName,
                    isUsed: true,
                    joinObject: insertableJoinObject_,
                    isRealGeo: isRealGeo
                }));

                returnableID = returnableID.returnableid;

                returnables.push(returnableID);
                console.log(chalk.green(`Returnable Construction: ReturnableID:${returnableID} created for the ${itemObject.featureName} feature`));

            } else { // special case of two returnables per column

                // set attribute type
                insertableJoinObject.attributeType = 'current';
                // make valid JSON
                let insertableJoinObject_ = JSON.stringify(insertableJoinObject);

                // insert returnable into metadata_returnable and get returnableID
                let returnableID = await db.one(pgp.as.format(insert_metadata_returnable, {
                    columnID: columnID,
                    featureID: featureID,
                    rootFeatureID: rootFeatureID,
                    frontendName: 'Current ' + frontendName,
                    isUsed: true,
                    joinObject: insertableJoinObject_,
                    isRealGeo: isRealGeo
                }));

                returnableID = returnableID.returnableid;

                returnables.push(returnableID);
                console.log(chalk.green(`Returnable Construction: ReturnableID:${returnableID} created for the ${itemObject.featureName} feature`));


                // set attribute type
                insertableJoinObject.attributeType = 'observed';
                // make valid JSON
                insertableJoinObject_ = JSON.stringify(insertableJoinObject);

                // insert returnable into metadata_returnable and get returnableID
                returnableID = await db.one(pgp.as.format(insert_metadata_returnable, {
                    columnID: columnID,
                    featureID: featureID,
                    rootFeatureID: rootFeatureID,
                    frontendName: 'Observed ' + frontendName,
                    isUsed: true,
                    joinObject: insertableJoinObject_,
                    isRealGeo: isRealGeo
                }));

                returnableID = returnableID.returnableid;

                returnables.push(returnableID);
                console.log(chalk.green(`Returnable Construction: ReturnableID:${returnableID} created for the ${itemObject.featureName} feature`));
            }
        } else { //then not an attribute and do things normally

            // make valid JSON
            let insertableJoinObject_ = JSON.stringify(insertableJoinObject);

            // insert returnable into metadata_returnable and get returnableID
            let returnableID = await db.one(pgp.as.format(insert_metadata_returnable, {
                columnID: columnID,
                featureID: featureID,
                rootFeatureID: rootFeatureID,
                frontendName: frontendName,
                isUsed: true,
                joinObject: insertableJoinObject_,
                isRealGeo: isRealGeo
            }));

            returnableID = returnableID.returnableid;

            returnables.push(returnableID);
            console.log(chalk.green(`Returnable Construction: ReturnableID:${returnableID} created for the ${itemObject.featureName} feature`));
        }
        
    };

    return returnables;
}



// Helper Functions //
// ============================================================


async function makeItemParentLookup() {
    /*
        {
            child: [{itemName: String, isID: Boolean}, ...],
            ...
        }
    */
    let itemParentLookup = {};

    // query metadata to get in {child: String, parent_: String, isID: Boolean} format
    let query = await db.any(getItemParents);

    // fill itemParents
    query.forEach(rel => {
        // if item hasn't been added to object yet add it
        if(!(rel.child in itemParentLookup)) {
            itemParentLookup[rel.child] = [];
        } 
        itemParentLookup[rel.child].push({itemName: rel.parent_, isID: rel.isid});
    });

    return itemParentLookup;
};



function constructjsError(error) {
    console.log(chalk.bgWhite.red(error));
    console.log(chalk.bgWhite.red('CONSTRUCT.JS EXECUTION HALTED'));
    throw Error('we are throwing I guess!');
    return {error: true};
}



function readSchema(file) { // Schema read function
    return JSON.parse(stripJsonComments(fs.readFileSync(__dirname + file, 'utf8')))
}




















// ============================================================
// constructFeatures (features)
// ============================================================
// Takes a list of metadataFeatureInput objects
// and returns an object of the form
// 	{createList:	 [list of SQL create statements],
// 	 refList:			 [list of SQL ref statements],
//   metadataList: [list of SQL metadata insert statements]}
// ============================================================

function constructFeatures(features) {
    
		
	let metadataList = [];
    let createList = [];
    let refList = [];

    /* TODO: add validation so subfeature with nonexistent parent cannot be created */

    //For every feature/subfeature
    features.forEach((element, index) => {
        
        // if root feature
        if (element.parentTableName === null) {
            
						// add metadata_feature entry
						metadataList.push(pgp.as.format(newMetadataFeature, {
                                tableName: element.tableName,
								numFeatureRange: (element.numFeatureRange === null ?
																	null : element.numFeatureRange),
								information: element.information,
								frontendName: element.frontendName
            }));


            // add create feature table to stack
            createList.push(pgp.as.format(newCreateFeature, {
                feature: element.tableName
            }));

            // add feature to submission reference to stack
             refList.push(pgp.as.format(reference, {
                pkCol: 'submission_id',
                pkTable: 'tdg_submission',
                fkCol: 'submission_id',
                fkTable: element.tableName
            }));
            
            // add feature to observation count reference to stack
            refList.push(pgp.as.format(reference, {
                pkCol: 'observation_count_id' ,
                pkTable: 'tdg_observation_count',
                fkCol: 'observation_count_id',
                fkTable: element.tableName
            }));

            // If room or building we need to do something else because these items already exist
            if(['item_room', 'item_building'].includes(element.tableName.replace('feature_', 'item_'))) {

                // add feature to feature item reference to stack
                refList.push(pgp.as.format(reference, {
                    pkCol: 'item_id',
                    pkTable: element.tableName.replace('feature_', 'item_'),
                    fkCol: 'featureitem_id',
                    fkTable: element.tableName
                }));

            } else {

                // add create feature item to stack
                createList.push(pgp.as.format(newCreateFeatureItem, {
                    feature: element.tableName.replace('feature_', 'item_'),
                    location: element.location + '_id'  
                }));

                // add feature to feature item reference to stack
                refList.push(pgp.as.format(reference, {
                    pkCol: 'item_id',
                    pkTable: element.tableName.replace('feature_', 'item_'),
                    fkCol: 'featureitem_id',
                    fkTable: element.tableName
                }));

                // add feature item to location reference to stack
                if(['item_room', 'item_building'].includes(element.location)) {
                    refList.push(pgp.as.format(reference, {
                        pkCol: 'item_id',
                        pkTable: element.location,
                        fkCol: element.location + '_id' ,
                        fkTable: element.tableName.replace('feature_', 'item_')
                    }));
                } else {
                    refList.push(pgp.as.format(reference, {
                        pkCol: 'location_id',
                        pkTable: element.location,
                        fkCol: element.location + '_id' ,
                        fkTable: element.tableName.replace('feature_', 'item_')
                    }));
                }
                
            }

        } else { // then a subfeature
						
						// add metadata_feature entry
						metadataList.push(pgp.as.format(newMetadataSubfeature, {
                                tableName: element.tableName,
								parentTableName: element.parentTableName,
								numFeatureRange: (element.numFeatureRange === null ?
																	null : element.numFeatureRange),
								information: element.information,
								frontendName: element.frontendName
            }));

            // if no feature item
            if(element.location === null) {

                // add create subfeature to stack
                createList.push(pgp.as.format(newCreateSubfeature.withoutFeatureItem, {
                    feature: element.tableName
                }));

            } else { // then featureitem
                
                // add create subfeature to stack
                createList.push(pgp.as.format(newCreateSubfeature.withFeatureItem, {
                    feature: element.tableName
                }));

                // add create feature item to stack
                createList.push(pgp.as.format(newCreateFeatureItem, {
                    feature: element.tableName.replace('subfeature_', 'item_'),
                    location: element.location + '_id'  
                }));

                // add subfeature to feature item reference to stack
                refList.push(pgp.as.format(reference, {
                    pkCol : 'featureitem_id',
                    pkTable: element.tableName,
                    fkCol: 'item_id',
                    fkTable: element.tableName.replace('subfeature_', 'item_')
                }))

                // add feature item to location reference to stack
                if(['item_room', 'item_building'].includes(element.location)) {
                    refList.push(pgp.as.format(reference, {
                        pkCol: 'item_id',
                        pkTable: element.location,
                        fkCol: element.location + '_id' ,
                        fkTable: element.tableName.replace('feature_', 'item_')
                    }));
                } else {
                    refList.push(pgp.as.format(reference, {
                        pkCol: 'location_id',
                        pkTable: element.location,
                        fkCol: element.location + '_id' ,
                        fkTable: element.tableName.replace('feature_', 'item_')
                    }));
                }

            }

            // add subfeature to observation count reference to stack
            refList.push(pgp.as.format(reference, {
                pkCol: 'observation_count_id' ,
                pkTable: 'tdg_observation_count',
                fkCol: 'observation_count_id',
                fkTable: element.tableName
            }));
        }
    })

    return {fCreateList: createList, fRefList: refList, fMetadataList: metadataList}
}

// ============================================================
// addDataColumns (columns)
// ============================================================
// Takes a list of metadataColumnInput objects
// and returns an object of the form
// 	{createList:	 [list of SQL create statements],
// 	 refList:			 [list of SQL ref statements],
//   metadataList: [list of SQL metadata insert statements]}
// ============================================================

function addDataColumns(columns, features) {

    let createList = [];
    let refList = [];
	let metadataList = [];

    columns.forEach( column => {

        // INSERTING INTO METADATA_COLUMN //

        if (column.referenceDatatype != 'local-global' && column.referenceDatatype != 'special') {

            // Insert metadata_column entry for all non-globals (except submission)
            metadataList.push(pgp.as.format(newMetadataColumn, {
                featureName: column.featureName,
                rootFeatureName: column.rootFeatureName,
                frontendName: column.frontendName,
                columnName: column.columnName,
                tableName: column.tableName,
                referenceColumnName: column.referenceColumnName,
                referenceTableName: column.referenceTableName,
                information: column.information,
                filterSelectorName: column.filterSelectorName,
                inputSelectorName: column.inputSelectorName,
                sqlDatatype: column.sqlDatatype,
                referenceDatatype: column.referenceDatatype,
                frontendDatatype: column.frontendDatatype,
                nullable: column.nullable,
                default: column.default,
                global: column.global,
                groundTruthLocation: column.groundTruthLocation
            }))

        } else {

            // Insert metadata_column entry for local-global and special FOR EVERY FEATURE
            // Note: It's done this way because these are the same for every feature, and thus
            //       are in globalColumns.json once, but must be included in metadata_column
            //       for every feature

            for(feature of features) {

                metadataList.push(pgp.as.format(newMetadataColumn, {
                    featureName: feature.tableName,
                    rootFeatureName: null,
                    frontendName: column.frontendName,
                    columnName: column.columnName,
                    tableName: feature.tableName,
                    referenceColumnName: column.referenceColumnName,
                    referenceTableName: column.referenceTableName,
                    information: column.information,
                    filterSelectorName: column.filterSelectorName,
                    inputSelectorName: column.inputSelectorName,
                    sqlDatatype: column.sqlDatatype,
                    referenceDatatype: column.referenceDatatype,
                    frontendDatatype: column.frontendDatatype,
                    nullable: column.nullable,
                    default: column.default,
                    global: column.global,
                    groundTruthLocation: column.groundTruthLocation
                }))
            }
            
        }

        // CREATING LISTS, DATA_... COLUMNS, AND REFERENCES //
				
        if (column.referenceDatatype == 'list') {

            // Create List table
            createList.push(pgp.as.format(newCreateList, {
                tableName: column.tableName,
                columnName: column.columnName,
                sqlDatatype: column.sqlDatatype
            }))

            // Create List Many to Many
            createList.push(pgp.as.format(newCreateListm2m, {
                tableName: column.tableName.replace('list_', 'list_m2m_')
            }))

            // Create m2m to List reference
            refList.push(pgp.as.format(reference, {
                pkCol: 'list_id',
                pkTable: column.tableName,
                fkCol: 'list_id',
                fkTable: column.tableName.replace('list_', 'list_m2m_')
            }))

            // Create m2m to feature reference
            refList.push(pgp.as.format(reference, {
                pkCol: 'observation_id',
                pkTable: column.featureName,
                fkCol: 'observation_id',
                fkTable: column.tableName.replace('list_', 'list_m2m_')
            }))
            
        } else if (column.referenceDatatype == 'local') {

            createList.push(pgp.as.format(newAddColumn, {
                tableName: column.tableName,
                columnName: column.columnName,
                sqlDatatype: column.sqlDatatype,
                nullable: (column.nullable ? '' : 'NOT NULL')
            }))

        } else if (column.referenceDatatype == 'item' || column.referenceDatatype == 'location' ) {
            // For now new columns cannot be created with metadata_column entries!

                /* DEFINING LOCAL-GLOBAL AND SPECIAL FOR EVERY FEATURE
                1. Adding local-global and special entries to metdata_column for every feature
                2. Adding local-global columns to every feature
                3. Adding the data_auditor_name column to every feature
                4. Adding the Auditor Name trigger for every feature
                */

        } else if (column.referenceDatatype == 'local-global') { //LOCAL GLOBALS ARE SPECIFIED FOR EVERY FEATURE

            for(feature of features) { // Data column is added for every feature
                
                // 2.
                createList.push(pgp.as.format(newAddColumn, {
                    tableName: feature.tableName,
                    columnName: column.columnName,
                    sqlDatatype: column.sqlDatatype,
                    nullable: (column.nullable ? '' : 'NOT NULL')
                }))

            } //for every feature
        } else if (column.referenceDatatype == 'special' && column.frontendName == 'Auditor Name') {
            // special case for auditor name
            for(feature of features) { // for every feature
                // Data column is added for every feature
                createList.push(pgp.as.format(newAddColumn, {
                    tableName: feature.tableName,
                    columnName: column.columnName,
                    sqlDatatype: column.sqlDatatype,
                    nullable: (column.nullable ? '' : 'NOT NULL')
                }))

                // Auditor Name trigger is added for every feature
                refList.push(pgp.as.format(checkAuditorNameTrigger, {
                    tableName: feature.tableName
                }))

            } 
        }
        
    })
    
    return {cCreateList: createList, cRefList: refList, cMetadataList: metadataList};
};