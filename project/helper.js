'use strict';
const fs = require("fs");
const mysql = require("mysql");
const request = require("request");
const sessions = require("./sessions.js");
const mapping = require("./mapping.js");
const elasticSearch = require("./db_config/elasticSearch.js")
const conversationGraph = require("./conversationGraphs");
const word_mapping = JSON.parse(fs.readFileSync("./json/word_mapping.json"));
const benefit_tagging = JSON.parse(fs.readFileSync("./json/benefits_mapping.json"));

let db_config = {
    host : 'localhost',
    user : 'root',
    password : 'selekt.in'
};
let connection;
function handleDisconnect() {
    connection = mysql.createConnection(db_config);
    connection.connect(function(err) {
        if(err) {
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000);
        }
    });
    connection.on('error', function(err) {
        console.log('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}
handleDisconnect();

/*
* this will helps to saving the logs data
*/
function logger_api_call(sessionId, tabId, event)
{
    let event_type = event["type"];
    let user_details = sessions.getUserDetails(sessionId);
    user_details["tab_id"] =  tabId;
    let options = {
        method: 'POST',
        url: 'https://www.prodx.in/update_events/website_'+event_type,
        headers: 
        {
            'content-type': 'application/json'
        },
        body: {"user_details":user_details,"event": event},
        json: true
    };
    request(options, function (error, response, body) {
        if (error)
        {
            console.log("\n\nError in events updating ===============");
            console.log(error);
        }
    });
}
/*
* this will helps to get the random value between low and high values
* @param {int} low, high
* return {int}
*/
function random(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

/*
* this will helps to get the random sentence in the array
* @param {string} reason
* return {string}
*/
function get_reason(reason)
{
    let sentence =
        [
            "Go for styles "+reason+".",
            "Pick the ones "+reason+".",
            "Choose clothes "+reason+"."
        ]
    let get_random_number = random(0,sentence.length);
    return sentence[get_random_number];
}

let follows = function(a){
    return a.map(function(item, i){
        return [item, follows(a.slice(i+1))];
    });
};
let combinations = function(a){
    let combs = function(prefix, trie, result){
        trie.forEach(function(node, i){
            result.push((prefix +"  "+ node[0]).trim());
            combs((prefix +"  "+ node[0]).trim(), node[1], result);
        });
        return result;
    };
    return combs('', follows(a), []);
};
/*
* this will helps to check two arrays are equal or not
* @param {array} structureAnswers, contextAnswers
* return {bool}
*/
function arraysEqual(structureAnswers, contextAnswers)
{
    if (structureAnswers == null || contextAnswers == null) return false;
    if (structureAnswers.length != contextAnswers.length) return false;

    let count = 0;
    let result = true;
    for (let i = 0; i < structureAnswers.length; i++) {
        if(typeof structureAnswers[i] !="object")
        {
            if(contextAnswers.indexOf(structureAnswers[i])<0)
            {
                result = false;
                break;
            }
        }
        else
        {
            let sub_result = false;
            for(let j=0;j<structureAnswers[i].length;j++)
            {
                if(contextAnswers.indexOf(structureAnswers[i][j])>0)
                {
                    sub_result = true;
                    break;
                }
            }
            if(!sub_result)
            {
                result = false;
                break;
            }
        }
    }
    return result;
}

/*
* This will generate elastic search query
* @param {string} product_line, sort_type
* @param {int} from
* @param {array} filters, benefits, adjectives, remove_tags
* @param {obj} priority_values
* return {obj}
*/
function buildQuery(product_line, filters, benefits, adjectives, from, priority_values, remove_tags, sort_type, sort_priority_values) 
{
    console.log("In buildQuery function");
    let query = {bool:{must : [],must_not:[],should:[]}};
    let should_query = {bool: {should : []}};

    let benefit_tag = benefit_tagging[product_line];
    console.log("Sort type : ", sort_type);
    let boost_myntra_value_status = true;
    //query for filters
    let cnt_filters = {};
    for(let x in filters)
    {
        let attribute = Object.keys(filters[x])[0];
        if(attribute != "range")
        {
            let push_status = true;
            for(let rm in remove_tags)
            {
                if(("product_filter."+remove_tags[rm].key)==attribute && filters[x][attribute] == remove_tags[rm].value)
                    push_status = false;
            }
            if(push_status)
            {
                if(cnt_filters[attribute] == undefined)
                    cnt_filters[attribute] = [];
                let filter_obj = {};
                filter_obj[attribute] = filters[x][attribute];
                cnt_filters[attribute].push({"match_phrase":filter_obj});
            }
        }
        else
        {
            query.bool.must.push(filters[x]);
        }
    }
    let cnt_keys = Object.keys(cnt_filters);
    for(let y in cnt_keys)
    {
        let output = cnt_filters[cnt_keys[y]];
        query.bool.must.push({"bool":{"should":output}});
    }
    // remove tags
    for(let rm in remove_tags)
    {
        let rm_value = remove_tags[rm];
        if(rm_value.key!="benefit" && rm_value.key!="adjective")
        {
            if(rm_value.key=="range")
            {
                query.bool.must_not.push(rm_value);
            }
            else
            {
                let obj = {};
                if(rm_value.key)
                {
                    obj["product_filter."+rm_value.key] = rm_value.value;
                    query.bool.must_not.push({term:obj});
                }
            }
        }
    }

    //query for important benefits and adjectives
    let pri_benefits = priority_values.benefits;
    let pri_adjectives = priority_values.adjectives;
    boost_myntra_value_status = false;
    for(let pri_ben in pri_benefits)
    {
        query.bool.must.push({"match_phrase":{"benefits":pri_benefits[pri_ben]}});
    }
    boost_myntra_value_status = false;
    for(let pri_adj in pri_adjectives)
    {
        query.bool.must.push({"match_phrase":{"adjectives":pri_adjectives[pri_adj]}});
    }
    //adjectives
    //making all adjectives to must
    let adjectives_should_query = 
    {
        bool:{
            should:[]
        }
    };
    if(sort_type)
    {
        let sort_adjectives = adjectives.concat();
        if(sort_type=="priority")
        {
            //giving priority for benefit based on priority value
            for(let val in sort_priority_values)
            {
                let obj = sort_priority_values[val];
                if(obj.type=="adjective")
                {
                    let adj_value = obj.value;
                    let priority = obj.priority;
                    sort_adjectives.splice(sort_adjectives.indexOf(adj_value),1);
                    adjectives_should_query.bool.should.push({"match_phrase":{"adjectives":{"query":adj_value, "boost":1024/priority}}});
                }
            }
        }
        if(sort_adjectives.length>0)
            adjectives_should_query.bool.should.push({"terms":{"adjectives":sort_adjectives}});
    }
    else
    {
        //Adjectives
        if(adjectives.length>0)
        {
            let adjective_query = {"constant_score": { "filter": {"terms":{"adjectives":adjectives}},"boost":32}};
            boost_myntra_value_status = false;
            adjectives_should_query.bool.should.push(adjective_query);
        }
    }
    if(adjectives_should_query.bool.should.length>0)
    {
        query.bool.must.push(adjectives_should_query);
    }
    //benefits
    if(sort_type)
    {
        let sort_benefits = benefits.concat();
        if(sort_type=="priority")
        {
            //giving priority for benefit based on priority value
            for(let val in sort_priority_values)
            {
                let obj = sort_priority_values[val];
                if(obj.type=="benefit")
                {
                    let ben_value = obj.value;
                    let priority = obj.priority;
                    sort_benefits.splice(sort_benefits.indexOf(ben_value),1);
                    query.bool.should.push({"match_phrase":{"benefits":{"query":ben_value, "boost":1024/priority}}});
                }
            }
        }
        if(sort_benefits.length>0)
            query.bool.should.push({"terms":{"benefits":sort_benefits}});
    }
    else
    {
        let boosting_obj = {};
        for(let i in benefits)
        {
            let benefit_to_be_boost = benefits[i];
            if(benefit_tag.hasOwnProperty(benefit_to_be_boost))
            {
                if(!boosting_obj.hasOwnProperty(benefit_tag[benefit_to_be_boost]))
                {
                    boosting_obj[benefit_tag[benefit_to_be_boost]] = [];
                }
                boosting_obj[benefit_tag[benefit_to_be_boost]].push(benefit_to_be_boost);
            }
            else
            {
                if(!boosting_obj.hasOwnProperty("benefits"))
                {
                    boosting_obj["benefits"] = [];
                }
                boosting_obj["benefits"].push(benefit_to_be_boost);
            }
        }
        let boosting_obj_keys = Object.keys(boosting_obj);
        //console.log(JSON.stringify(boosting_obj));
        for(let key in boosting_obj_keys)
        {
            let type = boosting_obj_keys[key];
            let boost = 1;
            if(type=="broad_occasions")
                boost = 216;
            else if(type=="occasions")
                boost = 128;
            else if(type=="benefits")
                boost = 64;
            /*else if(type=="skintone")
                boost = 32;
            else if(type=="bodyshape")
                boost = 16;
            else if(type=="height")
                boost = 8;
            else if(type=="age")
                boost = 4;
            else if(type=="body_concern")
                boost = 2;*/
            let obj = {"constant_score": { "filter": {"terms":{"benefits":boosting_obj[type]}},"boost":boost}};
            query.bool.should.push(obj);
        }
    }
    if(query.bool.should.length>0)
    {
        boost_myntra_value_status = false;
    }
    if(boost_myntra_value_status)
    {
        query.bool.should.push({
            "term": {
                "product_filter.website": {
                    "value": "myntra",
                    "boost": 2
                }
            }
        },
        {
            "terms": 
            {
                "product_filter.website": 
                [
                    "jabong",
                    "voonik"
                ]
            }
        });
    }
    let sort_by = [];
    if(sort_type=="price_low_to_high")
    {
        sort_by.push({"product_filter.discount_price": {"order": "asc"}});
    }
    if(sort_type=="price_high_to_low")
    {
        sort_by.push({"product_filter.discount_price": {"order": "desc"}});
    }
    if(sort_type=="discount_high_to_low")
    {
        sort_by.push({"product_filter.discount_percent":{"order":"desc"}});
    }
    let query_obj = {
        index: 'product_data',
        type: product_line,
        body: {
            query: query
        },
        from:from*60,
        size: 200
    };
    if(sort_by.length>0)
        query_obj.body.sort = sort_by;
    return query_obj;
}

/*
* Getting the profile benefits and profile reasons
* @param {string} sessionId,tab_id
* @param {string} reason_state
*/
function getProfileBenefits(sessionId,tab_id,reason_state)
{
    console.log("In getProfileBenefits function");
    let benefits = [];
    let profile_reasons = "";
    let bodyconcern_reasons = "";
    let context = sessions.getContext(sessionId, tab_id);
    let product_line = mapping.product_line_to_db_keys[context.product_line]; 
    let user_profile = context.user_profile;
    if(user_profile.hasOwnProperty("age") && user_profile.age!=undefined)
    {
        let benefit = word_mapping[product_line]["age"][user_profile.age];
        if(benefit!=undefined && benefit["entity_key"] && benefit["entity_key"]!="" && checkObjExist(context.remove_tags,{"type":"benefit","value":benefit["entity_key"]}))
        {
            if(context["benefits"].indexOf(benefit["entity_key"])==-1 && context.priority_values["benefits"].indexOf(benefit["entity_key"])==-1 && benefits.indexOf(benefit["entity_key"])==-1)
            {
                benefits.push(benefit["entity_key"]);
            }
            profile_reasons += "Age : "+user_profile.age+"\nBenefit : "+getBenefitname(benefit["entity_key"],product_line,"benefits")+"\n"+get_reason(benefit["reason"])+"\n\n";
        }
    }
    if(user_profile.hasOwnProperty("height") && user_profile.height!=undefined)
    {
        let benefit = word_mapping[product_line]["height"][user_profile.height];
        if(benefit!=undefined && benefit["entity_key"] && benefit["entity_key"]!="" && checkObjExist(context.remove_tags,{"type":"benefit","value":benefit["entity_key"]}))
        {
            if(context["benefits"].indexOf(benefit["entity_key"])==-1 && context.priority_values["benefits"].indexOf(benefit["entity_key"])==-1 && benefits.indexOf(benefit["entity_key"])==-1)
            {
                benefits.push(benefit["entity_key"]);
            }
            profile_reasons += "Height : "+user_profile.height+"\nBenefit : "+getBenefitname(benefit["entity_key"],product_line, "benefits")+"\n"+get_reason(benefit["reason"])+"\n\n";
        }
    }
    if(user_profile.hasOwnProperty("skin_color") && user_profile.skin_color!=undefined)
    {
        let benefit = word_mapping[product_line]["skintone"][user_profile.skin_color];
        if(benefit!=undefined && benefit["entity_key"] && benefit["entity_key"]!="" && checkObjExist(context.remove_tags,{"type":"benefit","value":benefit["entity_key"]}))
        {
            if(context["benefits"].indexOf(benefit["entity_key"])==-1 && context.priority_values["benefits"].indexOf(benefit["entity_key"])==-1 && benefits.indexOf(benefit["entity_key"])==-1)
            {
                benefits.push(benefit["entity_key"]);
            }
            profile_reasons += "Skin Colour : "+user_profile.skin_color+"\nBenefit : "+getBenefitname(benefit["entity_key"],product_line, "benefits")+"\n"+get_reason(benefit["reason"])+"\n\n";
        }
    }
    if(user_profile.hasOwnProperty("body_shape") && user_profile.body_shape!=undefined)
    {
        let benefit = word_mapping[product_line]["bodyshape"][user_profile.body_shape];
        if(benefit!=undefined && benefit["entity_key"] && benefit["entity_key"]!="" && checkObjExist(context.remove_tags,{"type":"benefit","value":benefit["entity_key"]}))
        {
            if(context["benefits"].indexOf(benefit["entity_key"])==-1 && context.priority_values["benefits"].indexOf(benefit["entity_key"])==-1 && benefits.indexOf(benefit["entity_key"])==-1)
            {
                benefits.push(benefit["entity_key"]);
            }
            profile_reasons += "Body Shape : "+user_profile.body_shape+"\nBenefit : "+getBenefitname(benefit["entity_key"],product_line, "benefits")+"\n"+get_reason(benefit["reason"])+"\n\n";
        }
    }
    if(user_profile.hasOwnProperty("body_concerns") && user_profile.body_concerns!=undefined)
    {
        let body_concerns = user_profile.body_concerns;
        for(let i in body_concerns)
        {
            let benefit = word_mapping[product_line]["body_concern"][body_concerns[i].toLowerCase()];
            if(benefit && benefit["benefit_key"] && benefit["benefit_key"]!="" && checkObjExist(context.remove_tags,{"type":"benefit","value":benefit["benefit_key"]}))
            {
                if(context["benefits"].indexOf(benefit["benefit_key"])==-1 && benefits.indexOf(benefit["benefit_key"])==-1)
                {
                    benefits.push(benefit["benefit_key"]);
                }
                bodyconcern_reasons += "Body Concern : "+body_concerns[i]+"\nBenefit : "+getBenefitname(benefit["benefit_key"],product_line, "benefits")+"\n"+get_reason(benefit["reasons"])+"\n\n";
            }
        }
    }
    sessions.storeContext(sessionId,tab_id,context);
    if(reason_state=="profile_reasons")
        return profile_reasons;
    else if(reason_state=="bodyconcern_reasons")
        return bodyconcern_reasons;
    else
        return benefits;
}
function checkObjExist(main_obj, obj)
{
    for(let j in main_obj)
    {
        if(main_obj[j].type == obj.type && main_obj[j].value == obj.value)
        {
            return false;
        }
    }
    return true;
}
/*
* getting the key value from word_mapping file based on the productline and type
* @param {string} benefit, product_line, type
* return {string}
*/
function getBenefitname(benefit, product_line,type)
{
    let all_benefits = word_mapping[product_line][type];
    let benefit_keys = Object.keys(all_benefits);
    for(let i in benefit_keys)
    {
        let benefit_name = benefit_keys[i];
        if(all_benefits[benefit_name].entity_key == benefit)
        {
            return benefit_name;
        }
    }
    return benefit.split("_").join(" ");
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
/*
* check the useragent is contains the crawlers or not
* @param {string} useragent
* return {bool}
*/
function crawlerStatus(useragent)
{
    let not_allowed = ["screaming frog","WebCrawler","google", "bot", "HTTrack"];
    useragent = useragent.toLowerCase();
    for(let i in not_allowed)
    {
        let crawler = not_allowed[i].toLowerCase();
        if(useragent.indexOf(crawler)!=-1)
        {
            console.log("This is Crawler, not allow to save the events");
            return true;
        }
    }
    return false;
}
/*
* array will be sorted based on the order values
* @param {array} array, order
* return {array}
*/
function sortBasedonArray(array, order)
{

    //create a new array for storage
    let newArray = [];

    //loop through order to find a matching id
    for (let i = 0; i < order.length; i++) { 
        //label the inner loop so we can break to it when match found
        dance:
        for (let j = 0; j < array.length; j++) {

            //if we find a match, add it to the storage
            //remove the old item so we don't have to loop long nextime
            //and break since we don't need to find anything after a match
            if (array[j]["es_mysql_id"] == order[i]) {
                newArray.push(array[j]);
                array.splice(j,1);
                break dance;
            }
        }
    }
    return newArray;
}
/*
* this is used to get the require reason message 
* @param {string} sessionId, tabId
*/
function getReasonMessage(sessionId, tabId,  callback)
{
    let string ="";
    let context = sessions.getContext(sessionId, tabId);
    let reason_messages = context["reason_messages"].concat();
    context["reason_messages"] = [];
    sessions.storeContext(sessionId, tabId, context);
    console.log("User Reason Messages : ", reason_messages);
    getTotalProducts(sessionId, tabId, function(current_total_products){
        if(current_total_products!=0)
        {
            let prefix_array = getPrefixReasons(context["product_line"]);
            let previous_message = context["previous_message"];
            if(previous_message && previous_message!="" && reason_messages.length>0)
            {
                previous_message = (previous_message.indexOf(context["product_line"])!=-1)?previous_message:previous_message+" "+context["product_line"];
                string += "I have found "+current_total_products+" "+context["product_line"]+" which are suitable for "+context["previous_message"];
            }
            else
            {
                string += "I have found "+current_total_products+" "+context["product_line"]+" for you";
            }
            for(let i in reason_messages)
            {
                let reason = reason_messages[i];
                if(reason["type"]=="benefit")
                {
                    string += "\n\n";
                    if(reason.hasOwnProperty("value"))
                        string +=reason["value"]+"\n";
                    string += "You should go for : "+reason["display_name"]+"\n"+prefix_array[random(0,prefix_array.length)]+" "+reason["reason"];
                }
                else
                {
                    string += "\n\n";
                    if(reason.hasOwnProperty("value"))
                        string +=reason["value"]+"\n";
                    string +="Adjective : "+reason["display_name"]+"\n"+prefix_array[random(0,prefix_array.length)]+" "+reason["reason"];
                }
            }
        }
        callback(string);
    });
}
function getTotalProducts(sessionId, tabId, callback)
{
    let context = sessions.getContext(sessionId, tabId);
    let product_line = mapping.product_line_to_db_keys[context.product_line];
    let benefits = context['benefits'].concat();
    let adjectives = context['adjectives_new'].concat();

    let filters = context['filters'];
    let from = context['from'];

    let product_query = buildQuery(product_line, filters, benefits, adjectives, from, context.priority_values, context.remove_tags, context["sort_type"], context["sort_priority_values"]);
    delete product_query.from;
    delete product_query.size;
    delete product_query.body.sort;

    //console.log(JSON.stringify(product_query, null, 2));
    elasticSearch.getCount(product_query, function(err, current_total_products)
    {
        callback(current_total_products);
    });
}
/*
* this is used to get the all body profile reasons
* @params {string} context_product_line
* @params {obj} body_profile
* return {array} tags
*/
function getBodyProfileReasons(context_product_line, body_profile)
{
    let body_profile_keys = ["age", "height", "skintone", "bodyshape"];
    let product_line = mapping.product_line_to_db_keys[context_product_line];
    let prefix_array = getPrefixReasons(context_product_line);
    let tags = body_profile_keys.map(function(val){
        if(body_profile.hasOwnProperty(val))
        {
            let profile_info = word_mapping[product_line][val][body_profile[val]];
            let reason = profile_info["reason"];
            if(reason!="" && reason!="na")
            {
                let make_reason = "";
                make_reason += capitalizeFirstLetter(val)+": "+body_profile[val]+"\n";
                make_reason += "You should go for: "+getBenefitname(profile_info["entity_key"], product_line, "benefits")+"\n";
                make_reason += prefix_array[random(0,prefix_array.length)]+" "+reason
                return {value:profile_info["entity_key"], "reason":make_reason};
            }
        }
        return {};
    });
    tags = tags.filter(function(val){
        return Object.keys(val).length>0;
    });
    return tags;
}
/*
* this is used to get the all body profile reasons
* @params {string} context_product_line
* @params {array} body_concerns
* return {array} tags
*/
function getBodyConcernReasons(context_product_line, body_concerns)
{
    let product_line = mapping.product_line_to_db_keys[context_product_line];
    let prefix_array = getPrefixReasons(context_product_line);
    let tags = [];
    let body_concerns_info = word_mapping[product_line]["body_concern"];
    for(let i in body_concerns)
    {
        let concern = body_concerns[i].toLowerCase();
        if(body_concerns_info.hasOwnProperty(concern) && body_concerns_info[concern])
        {
            let concern_info = body_concerns_info[concern];
            let reason = concern_info["reasons"];
            if(reason!="" && reason!="na")
            {
                let make_reason = "";
                make_reason += "Body Concern: "+concern+"\n";
                make_reason += "You should go for : "+getBenefitname(concern_info["benefit_key"], product_line, "benefits")+"\n";
                make_reason += prefix_array[random(0,prefix_array.length)]+" "+reason
                tags.push({value:concern_info["benefit_key"], "reason":make_reason});
            }
        }
    }
    return tags;
}
/*
* this is used to getting all benefits with conflict values and without conflict values
* @params {string} product_line
* @params {array} tags,added_filters
*/
function makeTagReasons(product_line, tags, added_filters, callback)
{
    if(tags.length>0)
    {
        let without_conflict = [], with_conflict = [];
        let getTagDetails = function(tags, index)
        {
            let tag = tags[index];
            let query = {
                index: "styling_rules",
                type: "benefit_rules",
                body: {
                    query:{
                        bool:{
                            must:[
                                {
                                    match_phrase:{
                                        "product_line_name":product_line
                                    }
                                },
                                {
                                    match_phrase:{
                                        "adjective_value":tag["value"]
                                    }
                                }
                            ]
                        }
                    }
                }
            };
            elasticSearch.runQuery(query, function(response, total, err)
            {
                if(!err && total>0)
                {
                    let conflict_object = {};
                    let source = response[0]["_source"];
                    let attribute_dependencies = source["attribute_dependencies"];
                    let conflict_status = false;
                    let filter_count = 0;
                    for(let i in added_filters)
                    {
                        let filters = added_filters[i];
                        let filter_status = true;
                        for(let j in attribute_dependencies)
                        {
                            let attribute_value = attribute_dependencies[j];
                            if(filters["key"]==attribute_value["attribute_type"])
                            {
                                let att_values = attribute_value["attribute_value"].filter(function(a)
                                {
                                    let value_status = filters["values"].indexOf(a)!=-1;
                                    if(!value_status)
                                    {
                                        if(!conflict_object.hasOwnProperty(filters["key"]))
                                        {
                                            conflict_object[filters["key"]] = filters["values"];
                                        }
                                    }
                                    return value_status;
                                });
                                if(att_values.length==0)
                                {
                                    filter_status = false;
                                    break;
                                }
                            }
                        }
                        if(filter_status)
                        {
                            filter_count++;
                        }
                    }
                    if(filter_count!=added_filters.length)
                    {
                        conflict_status = true;
                    }
                    
                    tag["conflict_status"] = conflict_status;
                    if(conflict_status)
                    {
                        tag["conflict_elements"] = conflict_object;
                        with_conflict.push(tag);
                    }
                    else
                    {
                        without_conflict.push(tag);
                    }
                }
                else
                {
                    console.log(tag);
                    console.log(err, total);
                }
                index++;
                if(index<tags.length)
                    getTagDetails(tags, index)
                else
                    callback(with_conflict, without_conflict);
            });
        };
        getTagDetails(tags, 0);
    }
    else
    {
        callback([],[]);
    }
}
/*
* this is used to check the current benefit is having conflict with filters or not
* @params {string} product_line, benefit
* @params {array} applied_filters
*/
function checkFiltersStatusInBenefit(product_line, applied_filters, benefit)
{
    let status, sync = true;
    let benefit_query = 
    {
        index: "styling_rules",
        type: "benefit_rules",
        body: {
            query:{
                bool:{
                    must:[
                        {
                            match_phrase:{
                                "product_line_name":product_line
                            }
                        },
                        {
                            match_phrase:{
                                "adjective_value":benefit
                            }
                        }
                    ]
                }
            }
        }
    };
    elasticSearch.runQuery(benefit_query, function(response, total, err)
    {
        if(!err && total>0)
        {
            let attribute_dependencies = response[0]["_source"]["attribute_dependencies"];
            let filters_count=0;
            for(let i in applied_filters)
            {
                let db_key = applied_filters[i]["key"];
                let filter_values = applied_filters[i]["values"];
                attribute_dependencies = attribute_dependencies.filter(function(a){
                    return a["attribute_type"] == db_key;
                });
                if(attribute_dependencies.length>0)
                {
                    let attribute_obj = attribute_dependencies[0];
                    let common_values = array_intersection(attribute_obj["attribute_value"], filter_values);
                    if(common_values.length>0)
                        filters_count++;
                    else
                    {
                        status = false;
                        break;
                    }
                }
                else
                    filters_count++;
            }
            if(filters_count==applied_filters.length)
                status = true;
            else
                status = false;
        }
        else
        {
            status = true;
        }
        sync = false;
    });
    while(sync) {require('deasync').sleep(100);}
    return status;
}
/*
* this is used to getting the selected adjectives filters
* @params {string} product_line
* @params {array} applied_filters, adjectives
*/
function getAdjectiveFilters(product_line, adjectives, applied_filters)
{
    let status, sync = true;
    console.log("Adjectives :",adjectives);
    if(adjectives.length>0)
    {
        let adjectives_query = 
        {
            index: "styling_rules",
            type: "adjectives_rules",
            body: {
                query:{
                    bool:{
                        must:[
                            {
                                match_phrase:{
                                    "product_line_name":product_line
                                }
                            },
                            {
                                terms:{
                                    "adjective_value":adjectives
                                }
                            }
                        ]
                    }
                }
            }
        };
        elasticSearch.runQuery(adjectives_query, function(response, total, err)
        {
            console.log("Total Adjectives : ", total);
            if(!err && total>0)
            {
                let filter_obj = {};
                for(let i in applied_filters)
                {
                    filter_obj[applied_filters[i]["key"]] = i;
                }
                for(let i in response)
                {
                    let attribute_dependencies = response[i]["_source"]["attribute_dependencies"];
                    for(let j in attribute_dependencies)
                    {
                        let attribute_values = attribute_dependencies[j];
                        if(!filter_obj.hasOwnProperty(attribute_values["attribute_type"]))
                        {
                            filter_obj[attribute_values["attribute_type"]] = applied_filters.length;
                            applied_filters.push({"key":attribute_values["attribute_type"],"values":attribute_values["attribute_value"]})
                        }
                        else
                        {
                            let current_attribute_values = applied_filters[filter_obj[attribute_values["attribute_type"]]]["values"];
                            let unique_filters = attribute_values["attribute_value"].map(function(a){
                                return current_attribute_values.indexOf(a)==-1;
                            });
                            applied_filters[filter_obj[attribute_values["attribute_type"]]]["values"] = current_attribute_values.concat(unique_filters);
                        }
                    }
                }
            }
            sync = false;
        });
    }
    else
    {
        sync = false;
    }
    while(sync) {require('deasync').sleep(100);}
    console.log("Applied Filters : ",applied_filters);
    return applied_filters;
}
/*
* this will helps to get the subset of elements in the array.
* @param {string} product_line
* @param {array} context_answers
*/
function array_intersection(a, b)
{
    let result = [];
    for(let i in a)
    {
        if(b.indexOf(a[i])!=-1)
        {
            result.push(a[i]);
        }
    }
    return result;
}

function getPrefixReasons(product_line_name)
{

    return [
    	"I have chosen "+product_line_name,
    	"I curated "+product_line_name,
    	"I am showing "+product_line_name
    ];
}

function processConversationQuestion(sessionId, tabId, question_type, question, callback)
{
    let user_context = sessions.getContext(sessionId, tabId);
    let product_line = mapping.product_line_to_db_keys[user_context["product_line"]];
    let response = {
        multi_select : question.multi_select,
        text : question.text,
        belongs : "refineListQuestion",
    };
    if(question.multi_select)
        response.type = "multi_select";
    else
        response.type = "single_select";

    // Populating options
    response.options = [];
    let answer_keys = Object.keys(question['options']);
    // conversation options making
    if(question_type=="customize")
    {
        for(let i in answer_keys)
        {
            let key = answer_keys[i];
            let new_questions_key = question_type + "_" + key;
            let push_status = true;
            let new_questions = conversationGraph.conversation_rules[product_line][new_questions_key];
            if(new_questions)
            {
                new_questions = new_questions.filter(function(obj){
                    let next_question = conversationGraph.questions[product_line][obj];
                    return user_context["adjective_attributes"].hasOwnProperty(next_question["attribute"]);
                });
                if(new_questions.length>0)
                {
                    push_status = false;
                }
            }

            let answer_text = question['options'][key]['text'];
            if(push_status)
            {
                let option =
                {
                    key : key,
                    value : capitalizeFirstLetter(answer_text)
                }
                response.options.push(option);
            }
        }
        callback(response);
    }
    else
    {
        function getAnswerKeys(answer_keys, i)
        {
            let key = answer_keys[i];
            let answer_text = question['options'][key]['text'];
            let adjective_value = question['options'][key]['adjective'];
            if(adjective_value)
            {
                user_context["adjectives_new"].push(adjective_value);
            }
            getTotalProducts(sessionId, tabId, function(total_products){
                if(adjective_value)
                {
                    user_context["adjectives_new"].splice(user_context["adjectives_new"].indexOf(adjective_value), 1);
                }
                let option =
                {
                    products_count : total_products,
                    key : key,
                    value : capitalizeFirstLetter(answer_text)
                }
                response.options.push(option);
                i++;
                if(i<answer_keys.length)
                    getAnswerKeys(answer_keys, i);
                else
                    callback(response);
            });
        }
        if(answer_keys.length>0)
            getAnswerKeys(answer_keys, 0);
        else
            callback(response);
    }
}

function saveInSql(database, query)
{
    connection.query('use '+database);
    connection.query(query,function (err,data) {
        if(err) console.error(err);
        else {console.log("saved Successfully");}
    });
}
module.exports = {
    saveInSql: saveInSql,
    random:random,
    get_reason: get_reason,
    combinations: combinations,
    arraysEqual: arraysEqual,
    buildQuery: buildQuery,
    getProfileBenefits: getProfileBenefits,
    checkObjExist: checkObjExist,
    getBenefitname: getBenefitname,
    capitalizeFirstLetter: capitalizeFirstLetter,
    logger_api_call: logger_api_call,
    crawlerStatus: crawlerStatus,
    sortBasedonArray: sortBasedonArray,
    getReasonMessage: getReasonMessage,
    makeTagReasons: makeTagReasons,
    array_intersection: array_intersection,
    checkFiltersStatusInBenefit: checkFiltersStatusInBenefit,
    getAdjectiveFilters: getAdjectiveFilters,
    getBodyProfileReasons: getBodyProfileReasons,
    getBodyConcernReasons: getBodyConcernReasons,
    getTotalProducts: getTotalProducts,
    processConversationQuestion: processConversationQuestion
};
