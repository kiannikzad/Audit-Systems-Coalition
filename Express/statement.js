const pgp = require("pg-promise");
const PS = pgp.PreparedStatement;
let join = {}; //at the end we will put all the variables inside this JS object, but for now just write them all as seperate variable declarations
 
// Select and Where clauses //
const select = {
    query: 'SELECT $(columns:csv) FROM $(feature:name)'
};

const where = { // ex: {clause: 'AND', feature: "item_sop", filter: "sop_name", operation: "=", value: "Example SOP #1"}
    query: '$(clause:value) $(feature:value).$(filter:value) $(operation:value) $(value:value)' 
};

// Column map //

/*
let columnMap = {
    flushometer_condition_name: ''
    flushometer_brand_name:
    basin_condition_name:
    basin_brand_name:
    stall_condition_name:
    sensor_condition_name:
    room_number:
    building_name:
    building_community_name:
}
date_submitted, template_name, sop_name, organization_name

let columnMap = {
    toilet : ['gpf','commentary','date_conducted'],
    audit : ['date_submitted'],
    toilet_s_c : 
}
*/
// New Query Format

let loc = {
    query: 'LEFT JOIN loc ON $(feature:value).location_id = loc.location_id',
    dependencies: [],
    get depth() {return this.dependencies.length}
};

let item_sop = {
    query: 'INNER JOIN sop ON audit_submission.sop_id = item_sop.sop_id',
    dependencies: ['audit_submission'],
    get depth() {return this.dependencies.length}
};

let newQueryFormatTemplate = {
    query: '',
    dependencies: [],
    get depth() {return this.dependencies.length}
};

// Old Query Format

/* 

Commented out because it threw error at runtime. 

let toiletFilter1 = { 
    type: 'toilet',
    query: 'WHERE $(columns)$(operator)$(value);',
    columns: ['gpf', 'commentary', 'date_conducted'],
    operator: ['=','>=']
};

let toiletPathFull = {
    type: 'toilet',
    query: 'SELECT a_t.gpf, a_t.commentary, a_t.date_conducted \
            FROM "audit_toilet" AS a_t \
            INNER JOIN "audit_submission" as a_s ON a_s.audit_id = a_t.audit_id \
            LEFT JOIN "loc" as loc ON a_t.location_id = loc.location_id;',
    columns: [a_t.gpf, a_t.commentary, a_t.date_conducted]
}
let auditSubmissionFilter = {
    type: 'audit',
    query: 'WHERE $(columns)$(operator)$(value);',
    columns: [a_s.date_submitted, a_s.template_id, a_s.sop_id, i_o.organization_name, i_c.community_name, i_c.city, i_c.state, i_c.country],
    operator: ['=','>=']
}

let auditSubmissionPath = {
    type: 'audit',
    query: 'SELECT a_s.date_submitted, a_s.template_id, a_s.sop_id, i_o.organization_name, i_c.community_name, i_c.city, i_c.state, i_c.country \
          FROM ("audit_submission" AS a_s OUTER JOIN "item_template" as i_t ON a_s.organization_id = i_t.organization_id) \
          OUTER JOIN "sop" as sop ON a_s.sop_id = sop.sop_id \
          OUTER JOIN "item_organization" as i_o ON a_s.organization_id = i_o.organization_id \
          OUTER JOIN "item_community" as i_c on i_t.community_id = i_c.community_id \
    ;',
    columns: [a_s.date_submitted, a_s.template_id, a_s.sop_id, i_o.organization_name, i_c.community_name, i_c.city, i_c.state, i_c.country]
}
*/









module.exports = {
    select,
    where,
    join
}; //this will export everything to the query engine 