let mongodb = require('mongodb');
let fs = require('fs');
let assert = require('assert');

let MongoClient = mongodb.MongoClient;
let url = 'mongodb://adminUser:password@35.197.136.136:27017/product_data';
let main_database;
MongoClient.connect(url, function (err, database) {
    if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
        console.log('Connection established to', url);
        main_database = database;
	}
});
// Connect to the db
function runQuery(db_name, product_line, query, callback)
{
	let db = main_database.db(db_name);
	let collection = db.collection(product_line);
	collection.find(query,{}).toArray(function(error,docs){
		callback(docs, error)
		assert.equal(null, error);
	});

}
function getPriceDropHistoryData(page_no)
{
	let query = {};
	runQuery("product_data_price_history","women_dresses",query, function(docs, error){
		let data = {};
		if(!error)
		{
			docs.forEach(function(a){
				let current_price = a["price"][a["price"].length-1];
				let minimum_price = 0;
				let avg_price = 0;
				if(a["price"].length>0)
				{
					minimum_price = arrayMin(a["price"]);
					avg_price = Average(a["price"]);
				}
				if(((avg_price+minimum_price)/2)>current_price)
				{
					let obj = {
						current_price : current_price,
						minimum_price : minimum_price,
						avg_price : Math.round(avg_price*10)/10,
						need : ((avg_price - current_price)/current_price)*100
					};
					data[a["es_mysql_id"]] = obj;
				}
			});
			
			let array_of_ids = Object.keys(data);
			let total_products_length = array_of_ids.length;
			array_of_ids.sort(function(a,b){
				return data[b]["need"]- data[a]["need"];
			});
			array_of_ids = array_of_ids.splice(page_no*30, 30);
			let mongo_query = array_of_ids.map(function(a){ return {"es_mysql_id":parseInt(a)};});
			//console.log(mongo_query)
			runQuery("product_data", "women_dresses", {$or:mongo_query},function(dresses_data, dr_err){
				let main_data = [];
				if(!dr_err)
				{
					
				}
				main_data.sort(function(a,b){
					return b["need"] - a["need"];
				});
				
			});
		}
	});
}
function Average(arr)
{
	return arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;
}
function arrayMax(array) {
	let max;
	try
	{
		let sort_array = array.sort(function(a, b){
			return b - a;
		});
		max = sort_array[0];
	}catch(e){max = array[0];}
	return max;
}
function arrayMin(array) {
	let min;
	try
	{
		let sort_array = array.sort(function(a, b){
			return a-b;
		});
		min = sort_array[0];
	}catch(e){min = array[0];}
	return min;
}
function valueFrequency(array, val)
{
	let filter_array = array.filter(function(a){
		return a==val;
	});
	return filter_array.length;
}