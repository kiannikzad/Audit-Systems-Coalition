/**
 * @file Contains SQL statements that may or may not contain 
 *       pg-promise parametrization for use in generating
 *       dynamic SQL. 
 */


/**
 * SQL statements specific to query.js
 */
const query = {

    referenceSelectionJoin: 'LEFT JOIN $(joinTable:name) AS $(joinAlias:name) ON $(joinAlias:name).$(joinColumn:name) = $(originalAlias:name).$(originalColumn:name)',

    sorta: 'ORDER BY $(columnName:raw) ASC',

    sortd: 'ORDER BY $(columnName:raw) DESC',

    limit: 'LIMIT $(limit)',

    offset: 'OFFSET $(offset)',

    pk: 'WHERE item_id = $(key)',

    observationSelect: 'SELECT $(feature:name)."observation_id" AS observation_pkey, $(selectClauses:raw)',

    itemSelect: 'SELECT $(item:name)."item_id" AS item_pkey, $(selectClauses:raw)',

    emptyObservationSelect: 'SELECT $(feature:name)."observation_id" AS observation_pkey',

    emptyItemSelect: 'SELECT $(item:name)."item_id" AS item_pkey',

    observationCount: 'INNER JOIN tdg_observation_count on $(feature:name).observation_count_id = tdg_observation_count.observation_count_id',

    whereConditionObject: { 
        equals: '$(id:raw) = $(val)',
        textContainsCase: '$(id:raw) LIKE $(val)',
        textContainsNoCase: '$(id:raw) ILIKE $(val)',
        lessOrEqual: '$(id:raw) <= $(val)',
        less: '$(id:raw) < $(val)',
        greater: '$(id:raw) > $(val)',
        greaterOrEqual: '$(id:raw) >= $(val)',
        contains: '$(id:raw) @> $(val)',
        containedBy: '$(id:raw) <@ $(val)',
        overlaps: '$(id:raw) && $(val)',
        geoContains: 'ST_Contains($(id:raw), ST_GeomFromGeoJSON($(val)))',
        geoCrosses: 'ST_Crosses($(id:raw), ST_GeomFromGeoJSON($(val)))',
        geoDisjoint: 'ST_Disjoint($(id:raw), ST_GeomFromGeoJSON($(val)))',
        geoWithinDistance: 'ST_DWithin($(id:raw), ST_GeomFromGeoJSON($(val)), $(additionalArg))',
        geoEquals: 'ST_Equals($(id:raw), ST_GeomFromGeoJSON($(val)))',
        geoIntersects: 'ST_Intersects($(id:raw), ST_GeomFromGeoJSON($(val)))',
        geoOverlaps: 'ST_Overlaps($(id:raw), ST_GeomFromGeoJSON($(val)))',
        geoTouches: 'ST_Touches($(id:raw), ST_GeomFromGeoJSON($(val)))',
        geoWithin: 'ST_Within($(id:raw), ST_GeomFromGeoJSON($(val)))',
    },

    submission: 'LEFT JOIN item_submission ON $(feature:name).submission_id = item_submission.item_id',

    globalItem: 'LEFT JOIN item_global on $(feature:name).global_id = item_global.item_id',

    subfeatureJoin: 'INNER JOIN $(subfeature:value) ON $(subfeature:value).parent_id = $(feature:value).observation_id',

    rootFeatureJoin: 'FROM $(rootFeature:value)',

    groupBy: 'GROUP BY $(nonListReturnables:raw)'

};

/**
 * SQL statements specific to construct.js
 */
const construct = {

    insert_m2m_metadata_item: 'CALL "insert_m2m_metadata_item"($(observableItem), $(referenced), $(isID), $(isNullable), $(frontendName), $(information))',

    add_item_to_item_reference: 'SELECT "add_item_to_item_reference"($(observableItem), $(referenced), $(isID), $(isNullable)) AS idColumn',
    
    insert_metadata_column: 'CALL \
    "insert_metadata_column"($(columnName), $(tableName), $(observationTableName), $(subobservationTableName), $(itemTableName), $(isDefault), $(isNullable), $(frontendName), $(filterSelectorName), $(inputSelectorName), $(frontendType), $(information), $(accuracy), $(sqlType), $(referenceType), $(selectorType), $(isFilterable))',
    
    insert_metadata_feature: 'CALL "insert_metadata_feature"($(tableName), $(itemTableName), $(information), $(frontendName))',
    
    insert_metadata_subfeature: 'CALL "insert_metadata_subfeature"($(tableName), $(parentTableName), $(numFeatureRange), $(information), $(frontendName))',
    
    insert_metadata_item_observable: 'CALL "insert_metadata_item_observable"($(itemName), $(frontendName), $(queryRole), $(queryPrivilege), $(uploadRole), $(uploadPrivilege))',
    
    create_observation_table: 'CALL "create_observation_table"($(tableName))',
    
    create_subobservation_table: 'CALL "create_subobservation_table"($(tableName), $(parentTableName))',
    
    create_observational_item_table: 'SELECT "create_observational_item_table"($(featureName))',
    
    add_unique_constraint: 'CALL "add_unique_constraint"($(tableName), $(uniqueOver))',
    
    add_data_col: 'CALL "add_data_col"($(tableName), $(columnName), $(sqlType), $(isNullable), $(isLocation))',
    
    add_list: 'CALL "add_list"($(itemTableName), $(tableName), $(columnName), $(sqlType), $(isObservational))',
    
    add_factor: 'CALL "add_factor"($(itemTableName), $(tableName), $(columnName), $(sqlType), $(isNullable), $(isObservational))',
    
    add_attribute: 'CALL "add_attribute"($(itemTableName), $(tableName), $(columnName), $(sqlType))',
    
    getReturnables: 'SELECT r.returnable_id AS id, f.table_name AS feature, r.frontend_name as frontendName, r.is_used AS isUsed, r.join_object AS joinObject, r.is_real_geo AS isRealGeo \
                            FROM metadata_returnable AS r LEFT JOIN metadata_feature AS f on r.feature_id = f.feature_id ORDER BY id ASC',
    
    getItemParents: 'SELECT child.table_name AS child, parent.table_name AS parent_, m2m.is_id AS isID \
                              FROM metadata_item AS child \
                              INNER JOIN m2m_metadata_item AS m2m ON child.item_id = m2m.item_id \
                              INNER JOIN metadata_item AS parent ON m2m.referenced_item_id = parent.item_id',
    
    makeItemReturnablesColumnQuery: 'SELECT c.column_id AS columnID, c.column_name AS columnName, c.table_name AS tableName, c.subobservation_table_name AS subobservationTableName, c.frontend_name AS frontendName, r.type_name AS ReferenceTypeName FROM metadata_column AS c INNER JOIN metadata_reference_type AS r ON c.reference_type = r.type_id WHERE c.metadata_item_id = (SELECT i.item_id FROM metadata_item AS i WHERE i.table_name = $(itemName))',
    
    makeItemReturnablesFeatureQuery: 'SELECT f.feature_id AS featureID FROM metadata_feature AS f WHERE f.table_name = $(featureName)',

    makeItemReturbablesItemQuery: 'SELECT i.item_id AS itemID FROM metadata_item AS i WHERE i.table_name = $(itemName)',
    
    makeItemReturnablesSubobservationQuery: 'SELECT f.feature_id AS featureID FROM metadata_feature AS f WHERE f.table_name = $(subobservationTableName)',
    
    insert_metadata_returnable: 'SELECT "insert_metadata_returnable"($(columnID), $(itemID), $(featureID), $(rootFeatureID), $(frontendName), $(isUsed), $(joinObject), $(isRealGeo)) AS returnableid',
        
    // use PROCEDURE instead of FUNCTION for PostgreSQL v10 and below
    checkAuditorNameTrigger: 'CREATE TRIGGER $(tableName:value)_check_auditor_name BEFORE INSERT OR UPDATE ON $(tableName:name) \
    FOR EACH ROW EXECUTE FUNCTION check_auditor_name()',

    insertPresetValues: 'INSERT INTO $(tableName:name) ($(columnName:name)) VALUES ($(value))'

};

/**
 * SQL statements specific to setup.js
 */
const setup = {

    returnableQuery: `SELECT 
        
        f.table_name as f__table_name, f.num_feature_range as f__num_feature_range, f.information as f__information, 
        f.frontend_name as f__frontend_name, 
        
        rf.table_name as rf__table_name, 
        
        c.column_id as c__column_id, c.frontend_name as c__frontend_name, c.column_name as c__column_name, c.table_name as c__table_name, 
        c.observation_table_name as c__observation_table_name, c.subobservation_table_name as c__subobservation_column_name, 
        c.information as c__information, c.is_nullable as c__is_nullable, c.is_default as c__is_default, c.accuracy as c__accuracy, 
        c.is_filterable as c__is_filterable,

        fs.selector_name as fs__selector_name, 
        ins.selector_name as ins__selector_name, 
        sn.selector_name as sn__selector_name,
        sql.type_name as sql__type_name, 
        rt.type_name as rt__type_name, 
        ft.type_name as ft__type_name, ft.type_description as ft__type_description, 
        
        r.returnable_id as r__returnable_id, r.frontend_name as r__frontend_name, r.is_used as r__is_used, r.join_object as r__join_object, 
        r.is_real_geo as r__is_real_geo, r.join_object -> 'attributeType' as r__attribute_type, r.feature_id as r__feature_id, 
        
        i.table_name as i__table_name, i.frontend_name as i__frontend_name 
        
        FROM metadata_returnable as r 
        LEFT JOIN metadata_column AS c ON c.column_id = r.column_id 
        LEFT JOIN metadata_feature AS f ON r.feature_id = f.feature_id 
        LEFT JOIN metadata_feature AS rf ON r.rootfeature_id = rf.feature_id 
        LEFT JOIN metadata_selector AS fs ON c.filter_selector = fs.selector_id 
        LEFT JOIN metadata_selector AS ins ON c.input_selector = ins.selector_id 
        LEFT JOIN metadata_selector_new AS sn ON c.selector_type = sn.selector_id
        LEFT JOIN metadata_sql_type AS sql ON c.sql_type = sql.type_id 
        LEFT JOIN metadata_reference_type AS rt ON c.reference_type = rt.type_id 
        LEFT JOIN metadata_item AS i ON c.metadata_item_id = i.item_id 
        LEFT JOIN metadata_frontend_type AS ft ON c.frontend_type = ft.type_id`,

    columnQuery: 'SELECT \
        \
        c.column_id as c__column_id, c.frontend_name as c__frontend_name, c.column_name as c__column_name, c.table_name as c__table_name, \
        c.observation_table_name as c__observation_table_name, c.subobservation_table_name as c__subobservation_column_name, \
        c.information as c__information, c.is_nullable as c__is_nullable, c.is_default as c__is_default, c.accuracy as c__accuracy, \
        \
        fs.selector_name as fs__selector_name, \
        ins.selector_name as ins__selector_name, \
        sn.selector_name as sn__selector_name, \
        c.is_filterable as c__is_filterable, \
        sql.type_name as sql__type_name, \
        rt.type_name as rt__type_name, \
        ft.type_name as ft__type_name, ft.type_description as ft__type_description, \
        \
        i.table_name as i__table_name, i.frontend_name as i__frontend_name \
        \
        FROM metadata_column as c \
        LEFT JOIN metadata_selector AS fs ON c.filter_selector = fs.selector_id \
        LEFT JOIN metadata_selector AS ins ON c.input_selector = ins.selector_id \
        LEFT JOIN metadata_sql_type AS sql ON c.sql_type = sql.type_id \
        LEFT JOIN metadata_reference_type AS rt ON c.reference_type = rt.type_id \
        LEFT JOIN metadata_item AS i ON c.metadata_item_id = i.item_id \
        LEFT JOIN metadata_frontend_type AS ft ON c.frontend_type = ft.type_id \
        LEFT JOIN metadata_selector_new AS sn ON c.selector_type = sn.selector_id',

    allItems: 'SELECT i.table_name as i__table_name, i.frontend_name as i__frontend_name, t.type_name as t__type_name, \
        qr.type_name as qr__type_name, ur.type_name as ur__type_name, \
        qp.privilege_name as qp__privilege_name, up.privilege_name as up__privilege_name, \
        i.item_id as i__item_id \
        FROM metadata_item AS i \
        LEFT JOIN metadata_item_type AS t ON i.item_type = t.type_id \
        LEFT JOIN tdg_role_type as qr on qr.type_id = i.query_role \
        LEFT JOIN tdg_privilege as qp on qp.privilege_id = i.query_privilege \
        LEFT JOIN tdg_role_type as ur on ur.type_id = i.upload_role \
        LEFT JOIN tdg_privilege as up on up.privilege_id = i.upload_privilege \
        ORDER BY i.item_id ASC',

    itemM2M: 'SELECT i.table_name as i__table_name, i.frontend_name as i__frontend_name, t.type_name as t__type_name, \
        m2m.is_id as m2m__is_id, m2m.is_nullable as m2m__is_nullable, m2m.frontend_name as m2m__frontend_name, \
        ri.table_name as ri__table_name \
        FROM metadata_item AS i \
        LEFT JOIN metadata_item_type AS t ON i.item_type = t.type_id \
        INNER JOIN m2m_metadata_item AS m2m ON m2m.item_id = i.item_id \
        INNER JOIN metadata_item AS ri ON m2m.referenced_item_id = ri.item_id',

    frontendTypes: 'SELECT type_name FROM metadata_frontend_type',

    allFeatures: 'SELECT f.table_name as f__table_name, f.num_feature_range as f__num_feature_range, f.information as f__information, \
        f.frontend_name as f__frontend_name, ff.table_name as ff__table_name, \
        i.table_name as i__table_name, i.frontend_name as i__frontend_name \
        FROM metadata_feature AS f \
        LEFT JOIN metadata_feature as ff ON f.parent_id = ff.feature_id \
        LEFT JOIN metadata_item as i ON f.observable_item_id = i.item_id',

};

// SQL for login.js

const login = {
    password: `
        SELECT 
            tdg_p_hash AS password
            FROM item_user 
                WHERE data_email = $(checkemail)
                AND is_pending = FALSE`,
    isEmailTaken: 'SELECT data_email AS email FROM item_user WHERE data_email = $(checkemail)',
    secret : `
        SELECT * 
        FROM item_user 
        WHERE data_email = $(checkemail)
        AND secret_token = $(token)`,
    authorization: `
        SELECT 
            p.privilege_name AS privilege,
            ARRAY_REMOVE(ARRAY_AGG(rt.type_name), NULL) AS role,
            ARRAY_REMOVE(ARRAY_AGG(r.item_organization_id), NULL) AS "organizationID",
            ARRAY_REMOVE(ARRAY_AGG(o.data_organization_name_text), NULL) AS "organizationName",
            u.item_id as "userID",
            u.data_first_name as "firstName",
            u.data_last_name as "lastName",
            u.api_key is not null as "isApiKeySet"
            FROM item_user AS u
            LEFT JOIN tdg_role AS r ON u.item_id = r.item_user_id
            LEFT JOIN tdg_role_type AS rt ON r.role_type_id = rt.type_id
            LEFT JOIN tdg_privilege AS p ON u.privilege_id = p.privilege_id
            LEFT JOIN item_organization AS o ON r.item_organization_id = o.item_id
                WHERE u.data_email = $(checkemail)
                GROUP BY p.privilege_name, u.item_id
    `,
    apiKeyAuthorization:  `
    SELECT 
        p.privilege_name AS privilege,
        ARRAY_REMOVE(ARRAY_AGG(rt.type_name), NULL) AS role,
        ARRAY_REMOVE(ARRAY_AGG(r.item_organization_id), NULL) AS "organizationID",
        ARRAY_REMOVE(ARRAY_AGG(o.data_organization_name_text), NULL) AS "organizationName",
        u.item_id as "userID",
        u.data_first_name as "firstName",
        u.data_last_name as "lastName",
        u.data_email as "email",
        u.api_key is not null as "isApiKeySet"
        FROM item_user AS u
        LEFT JOIN tdg_role AS r ON u.item_id = r.item_user_id
        LEFT JOIN tdg_role_type AS rt ON r.role_type_id = rt.type_id
        LEFT JOIN tdg_privilege AS p ON u.privilege_id = p.privilege_id
        LEFT JOIN item_organization AS o ON r.item_organization_id = o.item_id
            WHERE u.api_key = $(apiKey)
            GROUP BY p.privilege_name, u.item_id
    `,
    user: `
        SELECT
            p.privilege_name as privilege,
            ARRAY_REMOVE(ARRAY_AGG(rt.type_name), NULL) AS role,
            ARRAY_REMOVE(ARRAY_AGG(r.item_organization_id), NULL) AS "organizationID",
            ARRAY_REMOVE(ARRAY_AGG(o.data_organization_name_text), NULL) AS "organizationName",
            u.data_first_name "firstName",
            u.data_last_name "lastName",
            u.data_email "email",
            u.data_date_of_birth "dateOfBirth",
            u.data_is_email_public "isEmailPublic",
            u.data_is_quarterly_updates "isQuarterlyUpdates"
            FROM item_user AS u
            LEFT JOIN tdg_role AS r ON u.item_id = r.item_user_id
            LEFT JOIN tdg_role_type AS rt ON r.role_type_id = rt.type_id
            LEFT JOIN tdg_privilege AS p ON u.privilege_id = p.privilege_id
            LEFT JOIN item_organization AS o ON r.item_organization_id = o.item_id
                WHERE u.item_id = $(userID)
                GROUP BY p.privilege_name, u.data_first_name, u.data_last_name, u.data_email, u.data_date_of_birth, u.data_is_email_public, u.data_is_quarterly_updates 
    `
    };   

const addingUsers = {
insertingUsers: `
    INSERT INTO item_user (
        data_first_name,
        data_last_name, 
        data_email,
        tdg_p_hash,
        data_is_email_public,
        data_is_quarterly_updates,
        secret_token,
        is_pending,
        privilege_id ) 
        VALUES 
        ($(userfirstname), $(userlastname), $(useremail), $(userpass), $(userpublic), $(userquarterlyupdates), $(token), true, 2)`
    };

const updates  = {
    updateToken: 'UPDATE item_user SET secret_token = $(token) WHERE data_email = $(email) AND is_pending = FALSE',
    updateStatus: 'UPDATE item_user SET is_pending = $(isPending) WHERE data_email = $(email)',
    updatePassword: 'UPDATE item_user SET tdg_p_hash = $(password) WHERE data_email = $(email)'
};

// SQL for generate.js

const generate = {
    userName: 'SELECT u.data_first_name AS first_name, u.data_last_name AS last_name FROM item_user AS u WHERE u.item_id = $(user_id)'
};

module.exports = {
    query,
    construct,
    setup,
    login,
    addingUsers,
    updates,
    generate
};






// OLD construct.js
// Subject to move to legacy.js or deletion
// ============================================================


// Output

let tableNameSQLLookup = {
    feature1: { //ex: toilet and not feature_toilet
        table_name: {query: 'SQL', dependencies: []}
    }
}


// newCreateList: SQL for creating a new list_m2m table

const newCreateListm2m = 'CREATE TABLE $(tableName:value) (\
    observation_id INTEGER NOT NULL,\
    list_id INTEGER NOT NULL)'

// newCreateList: SQL for creating a new list table

const newCreateList = 'CREATE TABLE $(tableName:value) (\
    list_id SERIAL PRIMARY KEY,\
    $(columnName:value) $(sqlDatatype:value) NOT NULL)'

// newAddColumn: SQL for adding a column to an existing table

const newAddColumn = 'ALTER TABLE $(tableName:value) ADD COLUMN $(columnName:value) $(sqlDatatype:value) $(nullable:value)'

// reference: SQL for making one column reference another

var reference = 'ALTER TABLE $(fkTable:value) \
                  ADD FOREIGN KEY ($(fkCol:value)) \
                  REFERENCES $(pkTable:value) ($(pkCol:value))';

// newCreateFeature: SQL for creating new feature table

var newCreateFeature = 
        'CREATE TABLE $(feature:value) (\
            observation_id SERIAL PRIMARY KEY,\
            observation_count_id INTEGER NOT NULL, \
            submission_id INTEGER NOT NULL,\
            featureitem_id INTEGER NOT NULL)'

// newCreateSubfeature: SQL for creating new subfeature table

var newCreateSubfeature = {
    withFeatureItem: 'CREATE TABLE $(feature:value) (\
        parent_id INTEGER NOT NULL, \
        observation_id SERIAL PRIMARY KEY,\
        observation_count_id INTEGER NOT NULL, \
        featureitem_id INTEGER NOT NULL)',
    withoutFeatureItem: 'CREATE TABLE $(feature:value) (\
        parent_id INTEGER NOT NULL, \
        observation_id SERIAL PRIMARY KEY,\
        observation_count_id INTEGER NOT NULL)'
};

// newCreateFeatureItem: SQL for creating new feature item table
// TODO: add unique constraint to group of ID columns

var newCreateFeatureItem = 
        'CREATE TABLE $(feature:value) ( \
            item_id SERIAL PRIMARY KEY, \
            $(location:value) INTEGER NOT NULL)';

// newMetadataFeature: SQL for inserting one row to
// the metadata_feature table, representing a feature (which has no parent)

var newMetadataFeature =
				'INSERT INTO metadata_feature \
					(feature_id, table_name, parent_id, num_feature_range, information, frontend_name) \
					VALUES \
					(DEFAULT, $(tableName), \
					null, \
					$(numFeatureRange), \
					$(information), \
					$(frontendName));'

// newMetadataSubfeature: SQL for inserting one row to
// the metadata_feature table, representing a subfeature (which has a parent)

var newMetadataSubfeature =
				'INSERT INTO metadata_feature \
					(feature_id, table_name, parent_id, num_feature_range, information, frontend_name) \
					VALUES \
					(DEFAULT, $(tableName), \
					(SELECT feature_id FROM metadata_feature WHERE table_name = $(parentTableName)), \
					$(numFeatureRange), \
					$(information), \
					$(frontendName));'

// select[X]ID: SQL to get ID corresponding to non-null name

var selectFeatureID = '(SELECT feature_id from metadata_feature WHERE table_name = $(featureName:value))'
var selectSelectorID = '(SELECT selector_id from metadata_selector WHERE selector_name = $(selectorName:value))'
var selectSqlTypeID = '(SELECT type_id from metadata_sql_type WHERE type_name = $(sqlDatatype:value))'
var selectRefTypeID = '(SELECT type_id from metadata_reference_type WHERE type_name = $(referenceDatatype:value))'
var selectFrontendTypeID = '(SELECT type_id from metadata_frontend_type WHERE type_name = $(frontendDatatype:value))'

var initialSelectStatment = {
    newSelectFeatureID: 'SELECT feature_id, table_name from metadata_feature',
    newSelectSelectorID: 'SELECT selector_id, selector_name from metadata_selector',
    newSelectSqlTypeID: 'SELECT type_id, type_name from metadata_sql_type',
    newSelectRefTypeID: 'SELECT type_id, type_name from metadata_reference_type',
    newSelectFrontendTypeID: 'SELECT type_id, type_name from metadata_frontend_type'
}

// newMetadataColumn: SQL for inserting one row to the metadata_column
// table, representing a feature-associated or global data column

var newMetadataColumn =
'INSERT INTO metadata_column \
(column_id, feature_id, rootfeature_id, frontend_name, column_name, table_name, reference_column_name, reference_table_name, information, filter_selector, input_selector, sql_type, reference_type, frontend_type, is_nullable, is_default, is_global, is_ground_truth) \
VALUES \
(DEFAULT, \
(SELECT feature_id from metadata_feature WHERE table_name = $(featureName)), \
(SELECT feature_id from metadata_feature WHERE table_name = $(rootFeatureName)), \
$(frontendName), \
$(columnName), \
$(tableName), \
$(referenceColumnName:json), \
$(referenceTableName:json), \
$(information), \
(SELECT selector_id from metadata_selector WHERE selector_name = $(filterSelectorName)), \
(SELECT selector_id from metadata_selector WHERE selector_name = $(inputSelectorName)), \
(SELECT type_id from metadata_sql_type WHERE type_name = $(sqlDatatype)), \
(SELECT type_id from metadata_reference_type WHERE type_name = $(referenceDatatype)), \
(SELECT type_id from metadata_frontend_type WHERE type_name = $(frontendDatatype)), \
$(nullable), $(default), $(global), $(groundTruthLocation))'



