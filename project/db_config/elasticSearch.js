const elasticsearch = require('elasticsearch');
const client = new elasticsearch.Client({
  hosts: [
    'https://user:fLxscDBh5zdZ@35.200.199.189/elasticsearch'
    //'https://user:jk4wfZRBJmgd@35.198.210.38/elasticsearch'
  ]
});
/*
* this is used to get elastic search response by using the query
* @param {obj} query
*/
function runQuery(query, callback) {
    // console.log(JSON.stringify(query,null,2));
    query.requestTimeout = 100000;
    client.search(query).then(function (resp) {
        var hits = resp.hits.hits;
        callback && callback(hits,resp.hits.total,null);
    }, function (err) {
        console.log(err);
        console.log(JSON.stringify(query,null,2));
        callback && callback(null,null,err);
    });
}
/*
* this count api gives the count
* @param {obj} query
*/
function getCount(query,callback)
{
    client.count(query,function(err, response)
    {
        callback(err,response.count);
    });
}
/*
* this is a synchronous function, gives the count for products
* @param {obj} query
*/
function getCountSynchronously(query)
{
    let sync = true, output = {};
    client.count(query,function(err, response)
    {
        output["error"] = err;
        output["total"] = response;
        sync = false;
    });
    while(sync) {require('deasync').sleep(100);}
    return output;
}
// mobile section --------------
function getElasticResults(query, callback) {
    query.requestTimeout = 60000;
    client.search(query).then(function (resp) {
        callback(resp,resp.hits.total,null);
    }, function (err) {
        console.log(err);
        console.log(JSON.stringify(query,null,2));
        callback(null,null,err);
    });
}
function getMobilesData(query, callback)
{
    let mobile_query = {
        index : "mobile",
        type : "mobile_data",
        body : query,
        requestTimeout : 60000
    };
    client.search(mobile_query).then(function(resp)
    {
        let hits = resp.hits.hits;
        callback(hits, resp.hits.total, null);
    }, function(err)
    {
        console.log(err);
        callback(null, 0, err);
    });
}
module.exports = {
    runQuery:runQuery,
    getCount : getCount,
    getMobilesData : getMobilesData,
    getElasticResults : getElasticResults,
    getCountSynchronously: getCountSynchronously
};
