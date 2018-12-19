const fs = require("fs");
const mobile_entities = require('./mobile_entities');
const helper = require('./helper');
const elasticSearch = require('../db_config/elasticSearch');
const actions = 
{
    findAllPhones : function (entities){},
    knowledgeQuestion: function (entities){},
    compareMobiles : function(entities){},
    betterPhoneInTwo : function(entities){},
    betterThanSKU: function(entities){},
    betterThanPhone: function(entities){},
    similarPhones : function(entities){},
    singlePhoneDetails : function(entities){}
};
function mobileUrlMessages(message, from, callback)
{
	mobile_entities.getEntities(message, function(entities)
    {
    	console.log("************ Entities *************");
    	console.log(entities);
    	let query = 
    	{
    		query : {
    			bool : {
    				must : []
    			}
    		},
    		sort : [],
    		size : 5000
    	}
    	if(entities.hasOwnProperty("price_range") && entities.hasOwnProperty("numbers"))
		{
			let price_range = entities["price_range"];
			let numbers = entities["numbers"].sort(function(a,b){return a-b;});
			if(price_range=="above")
			{
				query.query.bool.must.push({"range":{"price":{"gte":numbers[0]}}});
			}
			else if(price_range=="under")
			{
				query.query.bool.must.push({"range":{"price":{"lte":numbers[0]}}});
			}
			else
			{
				query.query.bool.must.push({"range":{"price":{"gte":numbers[0], "lte":numbers[1]}}});
			}
		}
		if(entities.hasOwnProperty("feature_list"))
		{
			let featurelist = entities["feature_list"];
			for(let i in featurelist)
			{
				let feature = featurelist[i]["text"];
				let feature_value = featurelist[i]["value"];
				if(mapping.isSpecSortKeyExists(feature))
				{
					query["sort"].push(mapping.specsSortValue(feature));
				}
			}
		}
    	console.log("\nFunction name : ----------------------------");
        let bot_function = helper.getFunctionName(entities);
        console.log("--------------------------------------------");

    	elasticSearch.getMobilesData(query, function(response, total, error){
    		let product_list = {
	            type : "suggestions",
	            total : total,
	            page_no : 0,
	        };
	        if(!error && total>0)
	        {
	            console.log("Total Mobiles found : ", total);
	            let list = response.concat();
	            list = helper.getList(list, []);
	            product_list["list"] = list.splice(0, list.length>30?30:list.length);
	            console.log(product_list["list"].length)
	        }
	        callback(product_list);
    	});
    });
}
function productDetails(product_id, callback)
{
	console.log(product_id)
	let mobile_query =
	{
		query : {
			match_phrase : {_id : product_id}
		}
	};
	elasticSearch.getMobilesData(mobile_query, function(response, total, error)
	{
		let product_details = {
			type : "single_product",
			data : {}
		};
		if(!error && total>0)
		{
			let source = {};
			source["id"] = response[0]["_id"];
			source = Object.assign(source, response[0]["_source"]);
			product_details["data"] = source;
		}
		callback(product_details);
	});
}
module.exports = 
{
	mobileUrlMessages : mobileUrlMessages,
	productDetails : productDetails
};