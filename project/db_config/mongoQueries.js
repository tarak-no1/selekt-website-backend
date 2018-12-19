let mongodb = require('mongodb');
let fs = require('fs');
let assert = require('assert');

let MongoClient = mongodb.MongoClient;
//let url = 'mongodb://adminUser:password@10.148.0.7:27017/product_data';
let url = 'mongodb://adminUser:password@35.200.202.58/product_data';

let db;
MongoClient.connect(url, function (err, database) {
    if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
        console.log('Connection established to', url);
        db = database;
	}
});
// Connect to the db
function runQuery(product_line, query, callback)
{
	let collection = db.collection(product_line);
	collection.find(query,{}).toArray(function(error,docs){
		callback(docs, error)
		assert.equal(null, error);
	});

}
module.exports = 
{
	runQuery : runQuery
}