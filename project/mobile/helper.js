'use strict';
const fs = require("fs");
const jsonfile = require("jsonfile");
const elasticSearch = require("../db_config/elasticSearch");
const sessions = require('../sessions');
const mapping = require("./mapping");
const question_flow = JSON.parse(fs.readFileSync("./mobile/question_flow_mobile.json"))
function buildMobileQuery(sessionId, tabId)
{	
	let context = sessions.getMobileContext(sessionId, tabId);
	let query = 
	{
		query : { bool : { must:[] } }, sort:[], size:10000
	};
	if(context.hasOwnProperty("price_range"))
	{
		let price_range = context["price_range"];
		if(price_range=="above")
		{
			query.query.bool.must.push({"range":{"price":{"gte":context["start_price"]}}});
		}
		else if(price_range=="under")
		{
			query.query.bool.must.push({"range":{"price":{"lte":context["start_price"]}}});
		}
		else
		{
			query.query.bool.must.push({"range":{"price":{"gte":context["start_price"], "lte":context["end_price"]}}});
		}
	}
	if(context.hasOwnProperty("feature_list"))
	{
		let featurelist = context["feature_list"];
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
	return query;
}
function getList(response, relavant_attributes)
{
	relavant_attributes = getUniqueAttributes(relavant_attributes);
	console.log("................... Relavant Attributes ....................");
	// console.log(JSON.stringify(relavant_attributes,null,2));
	// console.log("............................................................");

	let rel_att_keys = Object.keys(relavant_attributes);
	let list = response.map(function(data)
	{
		let source = data["_source"];
	    let product_id  = data["_id"];
	    let suggestions = [];
	    for(let i in rel_att_keys)
	    {
	    	let att = rel_att_keys[i];
	    	if(source[att])
	    	{
	    		let obj = {
	    			"key"   : relavant_attributes[att],
	    			"value" : source[att] +" "+(mapping.isUnitExists(att)?mapping.getUnitKey(att):"")
	    		};
	    		suggestions.push(obj);
	    	}
	    }
	    return {
	        "id" : product_id,
	        "image_url" : source.pics_urls,
	        "model_name" : source.model_name,
	        "brand" : source.brand,
	        "price" : source.price,
	        "average_rating" : source.average_rating,
	        "no_of_ratings" : source.no_of_ratings,
	        "average_rating_amazon" : source.average_rating_amazon,
	        "no_of_ratings_amazon" : source.no_of_ratings_amazon,
	        "average_rating_flipkart" : source.average_rating_flipkart,
	        "no_of_ratings_flipkart" : source.no_of_ratings_flipkart,
	        "suggestions" : suggestions
	    };
	});
	return list;
}
function sortListBasedOnPercentile(product_list, sessionId, tabId)
{
	console.log("sorting the phone list based on the given Percentile value");
	let context = sessions.getMobileContext(sessionId, tabId);
	let features = context["feature_list"];
	let reason_message = "";
	let answered_questions = context["answered_questions"];
	console.log("Answered Questions *******************");
	console.log(answered_questions);
	console.log("****************************************");

	let relavant_attributes = [];
	let list = product_list.concat();
	let usecase_answers = Object.keys(answered_questions);
	if(usecase_answers.indexOf("display_type")!=-1)
	{
		let ua_obj = answered_questions["display_type"];
		if(ua_obj.answer_key=='1')
		{
			list = list.filter(function(phone)
			{
				try{
					let display_type = phone["_source"]["display_type"];
					display_type = display_type.toLowerCase().trim();
					if(display_type.indexOf("ips")!=-1) return true;
					else if(display_type.indexOf("lcd")!=-1) return true;
					else return false;
				}catch(e){return false;}
			});
			reason_message += "IPS screens will have bright whites,daylight readability and sharp text and images";
			if(ua_obj["suggestion_status"])
			{
				context["answered_questions"]["display_type"]["suggestion_status"] = false;
			}
		}
		else if(ua_obj.answer_key=='2')
		{
			list = list.filter(function(phone){
                try{
                    var display_type = phone["_source"]["display_type"];
                    display_type = display_type.toLowerCase().trim();
                    if(display_type.indexOf("oled") > -1)return true;
                    else if(display_type.indexOf("amoled") > -1)return true;
                    else if(display_type.indexOf("super amoled") > -1)return true;
                    else if(display_type.indexOf("retina") > -1)return true;
                    else return false;
                }catch(e){return false;}
        	});
        	reason_message += "AMOLED screens will have deep blacks,vibrant colors and great battery life.";
        	if(ua_obj["suggestion_status"])
			{
				context["answered_questions"]["display_type"]["suggestion_status"] = false;
			}
		}
		usecase_answers.splice(usecase_answers.indexOf("display_type"), 1);
		relavant_attributes = relavant_attributes.concat(question_flow["display_type"]["relevant_attribute"]);
	}
	if(usecase_answers.indexOf("memory_external")!=-1)
	{
		list = list.sort(sort_by("_source",true,function(source){ return source["performance_score"];}));
		if(list.length>25) list = list.slice(0,25);
		let user_external_memory = answered_questions["memory_external"]["selected_memory"];
		user_external_memory = parseInt(user_external_memory);
		if(user_external_memory!=0)
		{
			list = list.map(function(phone)
			{
				let external_memory = phone["_source"]["expandable_memory"];
            	let internal_memory = phone["_source"]["internal_memory"];
            	phone["_source"]["total_memory"] = external_memory + internal_memory;
            	return phone;
			});
			list = list.sort(sort_by("_source",true,function(source){ return source["total_memory"];}));
		}
		usecase_answers.splice(usecase_answers.indexOf("memory_external"), 1);
		relavant_attributes = relavant_attributes.concat(question_flow["memory_external"]["relevant_attribute"]);
	}
	for(let ua in usecase_answers)
	{
		relavant_attributes = relavant_attributes.concat(question_flow[usecase_answers[ua]]["relevant_attribute"]);
		let ua_obj = answered_questions[usecase_answers[ua]];
		if(ua_obj["percentage"]!="0.01")
		{
			let usecase_answer = usecase_answers[ua];

			let obj = filterPhonesBasedFeatureQuest(list, ua_obj, usecase_answer);
			list = obj["phone_list"];
			reason_message = obj["reason_message"];
			if(ua_obj["suggestion_status"])
			{	
				context["answered_questions"][usecase_answer]["suggestion_status"] = false;
			}
		}
	}
	return {
		"phone_list" : list,
		"relavant_attributes":relavant_attributes,
		"reason_message" : reason_message
	};
}
function filterPhonesBasedFeatureQuest(phone_list, obj, usecase_answer)
{
	let percentage = parseFloat(obj["percentage"]);
	let order = obj["order"];
	let db_key = obj["attribute"];
	console.log("db_key : ",db_key);
	//sorting phone list according to the attribute
	let before_phone_list_ids = phone_list.map(function(a){
		return a["_source"][db_key];
	});
	let csvData = [];
	phone_list = phone_list.sort(sort_by("_source",false,function(source){ return source[db_key] } ));

	let find_percentile_position_value = Math.round(phone_list.length * percentage);
	console.log("Percentile position value : ",find_percentile_position_value);
    let marked_attribute_value = phone_list[find_percentile_position_value]["_source"][db_key];
    console.log("Marked Attribute Value : ",marked_attribute_value)
    let units = mapping.isUnitExists(db_key) ? mapping.getUnitKey(db_key) : "";
    let value = marked_attribute_value + " " + units ;

    if(order == "greater") {
        phone_list = phone_list.filter(function (data) {
            return data["_source"][db_key] >= marked_attribute_value;
        });
    } else if ( order == "lesser"){
        phone_list = phone_list.filter(function (data) {
            return data["_source"][db_key] <= marked_attribute_value;
        });
    }
    console.log("===== FILTER PHONELIST BASED ON "+usecase_answer+" ==========");
    console.log(value);
    console.log("==================================================");
    let reason_message = "";
    if(usecase_answer=="primary_camera")
	{
		reason_message = "Video Resolution is "+order+" than or equals to "+value+" in the given price range.\n";
	}
	else if(usecase_answer=="secondary_camera")
	{
		reason_message = "Front Camera Resolution is "+order+" than or equals to "+value+" in the given price range.\n";
	}
	else if(usecase_answer=="display_size")
	{
		reason_message = "Display Size is "+order+" than or equals to "+value+" in the given price range.\n";
	}
	else if(usecase_answer=="battery_comsumption")
	{
		reason_message = "Talk time is "+order+" than or equals to "+value+" in the given price range.\n";
	}
	else if(usecase_answer=="battery_usage")
	{
		reason_message = "Battery Capacity is "+order+" than or equals to "+value+" in the given price range.\n";
	}
	else if(usecase_answer=="performance_games")
	{

	}
	else if(usecase_answer=="performance_app")
	{
		reason_message = "RAM is "+order+" than or equals to "+value+" in the given price range.\n";
	}
    return {"phone_list": phone_list, "marked_attribute_value":value, "reason_message":reason_message};
}

function sortPhoneListByFeature(phone_list, sessionId, tabId)
{
	let context = sessions.getMobileContext(sessionId, tabId);
	let featurelist = context["feature_list"];

	console.log("Sorting Based on Features");
	//console.log(featurelist);
	let relavant_attributes = [];
	let reason_message = "";
	let pref_message_list = [];
	for(let i in featurelist)
	{
		let feature = featurelist[i]["text"];
		let feature_value = featurelist[i]["value"];
		let suggestion_status = featurelist[i]["suggestion_status"];
		if(feature=="camera")
		{

			phone_list = phone_list.sort(sort_by("_source",true,function(source){ return source[feature_value];}));
			let keyList = ["model_name","primary_camera_resolution","front_camera_resolution",
			"primary_camera_features","video_resolution"];
			pref_message_list = pref_message_list.concat(keyList);
			if(suggestion_status)
			{
				context["feature_list"][i]["suggestion_status"] = false;
				reason_message +="Camera list:\nList has been sorted based on camera, camera expert reviews and as per your preferences\n\n";
			}
		}
		else if(feature=="performance")
		{
			phone_list = phone_list.sort(sort_by("_source",true,function(source){ return source[feature_value];}));
			let keyList = ["model_name","processor_type","ram_memory","no_of_cores","processor_frequency","battery_capacity"];
			pref_message_list = pref_message_list.concat(keyList);
			if(suggestion_status)
			{
				context["feature_list"][i]["suggestion_status"] = false;
				reason_message += "Performance list: \nList has been sorted based on expert performance reviews and as per your preferences\n\n";
			}
		}
		else if(feature=="battery")
		{
			phone_list = phone_list.sort(sort_by("_source",true,function(source){ return source[feature_value];}));
			let keyList = ["model_name","battery_type","ram_memory","talk_time","battery_capacity"];
			pref_message_list = pref_message_list.concat(keyList);
			if(suggestion_status)
			{
				context["feature_list"][i]["suggestion_status"] = false;
				reason_message += "Battery list:\nList has been sorted based on battery specifications, expert and user reviews on battery and as per your requirement\n\n";
			}
		}
		else if(feature=="display")
		{
			phone_list = phone_list.sort(sort_by("_source",true,function(source){ return source[feature_value];}));
			let keyList = ["model_name","processor_type","ram_memory","gpu","no_of_cores","battery_capacity","ram_memory",];
			pref_message_list = pref_message_list.concat(keyList);
			if(suggestion_status)
			{
				context["feature_list"][i]["suggestion_status"] = false;
				reason_message += "Display list:\nList has been sorted based on expert display review, display specs and as per your preferences\n\n";
			}
		}
		else if(feature=="memory")
		{
			let keyList = ["model_name","internal_memory","expandable_memory","micro_sd_slot"];
			pref_message_list = pref_message_list.concat(keyList);
			if(suggestion_status)
			{
				context["feature_list"][i]["suggestion_status"] = false;
				reason_message += "Memory List: \nList has been sorted based on internal memory, micro sd card selected and overall performance.\n\n";
			}
		}
		else if(feature=="overall")
		{
			phone_list = phone_list.sort(sort_by("_source",true,function(source){ return source[feature_value];}));

			let keyList = ["model_name",'screen_size',"primary_camera_resolution","internal_memory","ram_memory"];
			pref_message_list = pref_message_list.concat(keyList);
			if(suggestion_status)
			{
				context["feature_list"][i]["suggestion_status"] = false;
				reason_message += "List has been sorted based on phone specifications,expert reviews and user reviews in your price range.\n\n";
			}
		}
		if(mapping.hasReleventAttriubte(feature))
		{
			relavant_attributes = relavant_attributes.concat(mapping.getRelevantAttribute(feature));
		}
	}
	return {
		"phone_list":phone_list,
		"relavant_attributes":relavant_attributes,
		"reason_message" : reason_message,
		"pref_message_list" : pref_message_list
	};
}
function sort_by(field, reverse, primer)
{
    let key = primer ? function (x) 
    {
        return primer(x[field]);
    } : function (x) {
        return x[field];
    };
    reverse = !reverse ? 1 : -1;
    return function (a, b) {
        return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
    };
}
function getUniqueAttributes(array){
    let attributes = {};
    for(let i in array)
    {
    	let key = Object.keys(array[i])[0];
    	if(!attributes.hasOwnProperty(key))
    		attributes[key] = array[i][key].trim();
    }
    return attributes;
}
function getFunctionName(context)
{
	let functionContextMap = mapping.functionContextMap;
	let function_keys = Object.keys(functionContextMap);
    // Create items array
    var items = function_keys.map(function(key) {
        return [key, functionContextMap[key]];
    });
    // Sort the array based on the second element length
    items = items.sort(function(first, second) {
        return second[1][0].length - first[1][0].length;
    });

    for(var i in items) {
        var flag = true;
        for(var j in items[i][1][0])
        {
            if(!mapping.isKeyExists(items[i][1][0][j],context)) {
                flag = false;
            }
        }
        for(var k in items[i][1][1])
        {
            if(mapping.isKeyExists(items[i][1][1][k],context)) {
                flag = false;
            }
        }
        if (flag) {
        	console.log(items[i]);
            return items[i][0];
        }
    }
    return null;
}
function cleanSource(source)
{
	let source_keys = Object.keys(source);
	for(let i in source_keys)
	{
		let key = source_keys[i];
		let units = mapping.isUnitExists(key)?mapping.getUnitKey(key):"";
		if(units!="")
			source[key] = source[key].toString()+" "+units;
	}
	return source;
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
module.exports = {
	buildMobileQuery : buildMobileQuery,
	getList : getList,
	sortListBasedOnPercentile : sortListBasedOnPercentile,
	sortPhoneListByFeature : sortPhoneListByFeature,
	getFunctionName : getFunctionName,
	cleanSource : cleanSource,
	capitalizeFirstLetter : capitalizeFirstLetter
};