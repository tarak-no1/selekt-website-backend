/**
 * Created by tarak on 13/01/17.
 */
const elasticSearch = require('./db_config/elasticSearch.js');
const helper = require("./helper.js");
const sessions = require("./sessions.js");
let feed_attributes = {};
function get_product_line_filters(product_line, callback) {
    let attribute_value_list_query = {
        index: "styling_rules",
        type: "product_line_filters",
        body: {
            query: {
                match_phrase:{"product_line_name": product_line}
            }
        },
        size: 300
    };
    // console.log("Getting filters for "+product_line);
    elasticSearch.runQuery(attribute_value_list_query,function (result,total) {
        // console.log("Total Fitlers : ",total);
        result = result.sort(function(a, b) {
            a._id = parseInt(a._id);
            b._id = parseInt(b._id);
            return a["_id"] - b["_id"];
        });
        let filter_options = [];
        for(let i in result) {
            let attribute = result[i]["_source"];
            let attribute_name = attribute["product_line_attribute_db_path"].split(".").slice(-1)[0];
            let attribute_value_list = attribute['product_line_attribute_value_list'];
            attribute_value_list = attribute_value_list.sort();
            let option = {
                key : attribute_name,
                display_name : attribute["product_line_attribute"],
                values : attribute_value_list
            };
            filter_options.push(option);
        }
        callback(filter_options);
    });
}
function getCountforFilters(session_id, tab_id, filters, product_line, require_attribute, callback)
{
    let query = { index: 'product_data', type: product_line, body: {query:{bool:{must:[]}}}};
    //getting the already applied filters position from the query...
    let context = sessions.getContext(session_id, tab_id);
    let already_having_values = {};
    let attribute_obj = {};
    let filter_positions = 0;
    let cnt_filters = {};
    for(let x in filters)
    {
        let attribute = Object.keys(filters[x])[0];
        if(attribute != "range")
        {
            already_having_values[attribute] = [];
            if(cnt_filters[attribute] == undefined)
                cnt_filters[attribute] = [];
            if(!attribute_obj.hasOwnProperty(attribute))
                attribute_obj[attribute] = [];
            attribute_obj[attribute].push(filters[x][attribute]);
            let filter_obj = {};
            filter_obj[attribute] = filters[x][attribute];
            cnt_filters[attribute].push({"match_phrase":filter_obj});
        }
        else
        {
            query.body.query.bool.must.push(filters[x]);
            attribute = Object.keys(filters[x]["range"])[0];
            if(!already_having_values.hasOwnProperty(attribute))
                already_having_values[attribute] = [];
            let gte = filters[x]["range"][attribute]["gte"];
            let lte = filters[x]["range"][attribute]["lte"];
            let value = [];
            if(attribute=="product_filter.discount_price")
            {
                if(lte==undefined)
                {
                    value = [gte+" or above"];
                }
                else if(gte==undefined)
                {
                    value = [lte+" or below"];
                }
                else
                {
                    value = [gte+" to "+lte];
                }
            }
            else if(attribute=="product_filter.discount_percent")
            {
                if(gte==0 & lte==10)
                {
                    value = ["less than 10%"];
                }
                else
                {
                    value = [gte+"% or more"];
                }
            }
            attribute_obj[attribute] = value;
            already_having_values[attribute].push(filter_positions);
            filter_positions++;
        }
    }
    let cnt_keys = Object.keys(cnt_filters);
    for(let y in cnt_keys)
    {
        let output = cnt_filters[cnt_keys[y]];
        query.body.query.bool.must.push({"bool":{"should":output}});
        already_having_values[cnt_keys[y]].push(filter_positions);
        filter_positions++;
    }
    
    // console.log("=========== Existing Attributes ===========");
    // console.log(attribute_obj);

    let benefits = context['benefits'].concat();
    let profile_benefits = helper.getProfileBenefits(session_id, tab_id);
    benefits = benefits.concat(profile_benefits);

    let adjectives = context['adjectives_new'].concat();

    //query for important benefits and adjectives
    let priority_values = context.priority_values;
    let pri_benefits = priority_values.benefits;
    let pri_adjectives = priority_values.adjectives;
    for(let p_ben in pri_benefits)
        query.body.query.bool.must.push({match_phrase:{"benefits":pri_benefits[p_ben]}});

    for(let p_adj in pri_adjectives)
        query.body.query.bool.must.push({match_phrase:{"adjectives":pri_adjectives[p_adj]}});

    let should_query = {"bool":{"should":[]}};
    if(adjectives.length > 0)
    {
        should_query.bool.should.push({"bool":{"filter":{"terms":{"adjectives":adjectives}}}});
    }
    if(benefits.length > 0)
    {
        should_query.bool.should.push({"bool":{"filter":{"terms":{"benefits":benefits}}}});
    }
    if(should_query.bool.should.length > 0)
        query.body.query.bool.must.push(should_query);
    //getting all filters for the product line below format
    /*
    [
        {"key":"colour","values":[red,blue,green],"display_name":"Colour"},
        {"key":"occasion","values":[wedding],"display_name":"Occasion"}
    ]
    */

    get_product_line_filters(product_line,function(options)
    {
        //console.log(JSON.stringify(query,null,2));
        //console.log("Already Having Filters with positions : ",JSON.stringify(already_having_values,null,2));
        let count=0,length_of_list=0;
        let filter_options = JSON.parse(JSON.stringify(options));
        for(let i in filter_options)
        {
            filter_options[i]["length"] = 0;
            filter_options[i].values = [];
        }
        let attribute, values, filter_index = -1;
        for(let i in options)
        {
            attribute = options[i].key;
            values = options[i].values;
            filter_index = i;
            if(attribute==require_attribute)
                break;
        }
        length_of_list = values.length;
        filterValues(attribute, values, 0, filter_options, filter_index);
        function filterValues(attribute, values, j, filter_options, filter_index)
        {
            let new_query = JSON.parse(JSON.stringify(query));
            if(already_having_values.hasOwnProperty("product_filter."+attribute))
            {
                let remove_index = 0;
                for(let fil in already_having_values["product_filter."+attribute])
                {
                    new_query.body.query.bool.must.splice(already_having_values["product_filter."+attribute][fil]-remove_index,1);
                    remove_index++;
                }
            }
            let filter = values[j];
            if(attribute=="discount_percent")
            {
                let numbers = filter.match(/[-]{0,1}[\d.]*[\d]+/g);
                if(filter.indexOf("more")!=-1)
                {
                    new_query.body.query.bool.must.push({"range":{"product_filter.discount_percent":{"gte":numbers[0]}}});
                }
                else
                {
                    new_query.body.query.bool.must.push({"range":{"product_filter.discount_percent":{"lte":numbers[0]}}});
                }
            }
            else if(attribute=="discount_price")
            {
                let numbers = filter.match(/[-]{0,1}[\d.]*[\d]+/g);
                if(numbers.length==2)
                {
                    new_query.body.query.bool.must.push({"range":{"product_filter.discount_price":{"gte":numbers[0],"lte":numbers[1]}}});
                }
                else
                {
                    new_query.body.query.bool.must.push({"range":{"product_filter.discount_price":{"gte":numbers[0]}}});
                }
            }
            else
            {
                let match_phrase ={};
                match_phrase["product_filter."+attribute] = filter;
                new_query.body.query.bool.must.push({"match_phrase":match_phrase});
            }
            elasticSearch.getCount(new_query,function(error, total)
            {
                count++;
                if(error==null)
                {
                    if(total>0)
                    {
                        if(!filter_options[filter_index].hasOwnProperty("values"))
                            filter_options[filter_index]["values"] = [];
                        let check_status = false;
                        if(attribute_obj.hasOwnProperty("product_filter."+attribute))
                        {
                            if(attribute_obj["product_filter."+attribute].indexOf(filter)!=-1)
                            {
                                filter_options[filter_index]["length"] +=1;
                                check_status = true;
                            }
                        }
                        filter_options[filter_index]["values"].push({"key":filter,"count":total,"check_status":check_status});
                    }
                }
                if(count==length_of_list)
                {
                    callback(filter_options);
                }
                else if(j<values.length-1)
                {
                    j++;
                    filterValues(attribute, values, j,  filter_options, filter_index);
                }
            });
        }
    });
}

function get_feedback_attributes(product_line,callback)
{
    let query =
    {
        index:"styling_rules",
        type : "adjectives_rules",
        body:
        {
            "query":{"match_phrase":{"product_line_name":product_line}},
            size:1000
        }
    };
    elasticSearch.runQuery(query,function (results,total,err) {
        if(err==null)
        {
            // console.log(total);
            feed_attributes = {};
            for(let i in results)
            {
                let source = results[i]["_source"];
                let dependencies = source["attribute_dependencies"];
                for(let j in dependencies)
                {
                    let attribute = dependencies[j]["attribute_name"];
                    if(!feed_attributes.hasOwnProperty(attribute))
                        feed_attributes[attribute] = [];
                    if(feed_attributes[attribute].indexOf(source["adjective_value"])==-1)
                        feed_attributes[attribute].push(source["adjective_value"]);
                }
            }
            // console.log(Object.keys(feed_attributes));
            callback(Object.keys(feed_attributes));
        }
    })
}
function get_feed_attribute()
{
    return feed_attributes;
}
function getAdjectiveFilters(productLine,adjective,callback)
{
    let output = {}, sync = true;
    let query=
    {
        index: "styling_rules",
        type: "adjectives_rules",
        body:
        {
            query:
            {
                bool: {
                    must: [
                        {
                            match_phrase: {"product_line_name": productLine}
                        },
                        {
                            match_phrase: {"adjective_value": adjective}
                        }
                    ]
                }
            }
        }
    };
    elasticSearch.runQuery(query,function (data,total,error) {
        if(error==null)
        {
            // console.log("Got Adjective");
            let source = data[0]["_source"];
            let dependencies = source["attribute_dependencies"];
            for(let i in dependencies)
            {
                output["key"] = dependencies[i].attribute_type;
                output["values"] = dependencies[i].attribute_value;
            }
        }
        sync = false;
    });
    while(sync) {require('deasync').sleep(100);}
    return output;
}
/*
* this will helps to get the all attributes with filter values and it count.
* @param {string} product_line
* @param {array} fitlers, benefits, adjective, remove_tags
* @param {obj} context_priority_values
*/
function getFilterCount(product_line, filters, context_priority_values, benefits, adjectives, remove_tags, callback)
{
    // console.log("\n\n\n =================== In generateFilterQuery function");
    let query = {
        bool:{
            must : [],
            should : [],
            must_not : []
        }
    };
    let already_having_attributes = {};
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
                {
                    cnt_filters[attribute] = [];
                }
                if(!already_having_attributes.hasOwnProperty(attribute))
                {
                    already_having_attributes[attribute] = {values:[]};
                }
                if(already_having_attributes[attribute]["values"].indexOf(filters[x][attribute]))
                {
                    already_having_attributes[attribute]["values"].push(filters[x][attribute]);
                }
                let filter_obj = {};
                filter_obj[attribute] = filters[x][attribute];
                cnt_filters[attribute].push({"match_phrase":filter_obj});
            }
        }
        else
        {
            already_having_attributes[Object.keys(filters[x]["range"])[0]] = 
            {
                index : query.bool.must.length,
                values : []
            };
            query.bool.must.push(filters[x]);
        }
    }
    
    let cnt_keys = Object.keys(cnt_filters);
    for(let y in cnt_keys)
    {
        let attribute_name = cnt_keys[y];
        let output = cnt_filters[attribute_name];
        already_having_attributes[attribute_name]["index"] = query.bool.must.length;
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
    let priority_benefits = context_priority_values["benefits"];
    let priority_adjectives = context_priority_values["adjectives"];
    for(let i in priority_benefits)
    {
        query.bool.must.push({match_phrase:{"benefits":priority_benefits[i]}});
    }
    for(let i in priority_adjectives)
    {
        query.bool.must.push({match_phrase:{"adjectives":priority_adjectives[i]}});
    }
    if(adjectives.length>0)
    {
        let adjective_query = {
            "terms":{"adjectives":adjectives}
        };
        query.bool.must.push(adjective_query);
    }
    if(benefits.length > 0)
    {
        let benefits_query = {
            "terms":{"benefits":benefits}
        };
        query.bool.should.push(benefits_query);
    }

    let product_filter_query = {
        index : "styling_rules",
        type : "product_line_filters",
        body : {
            "size": 50,
            "query": {
                "match_phrase": {
                   "product_line_name": product_line
                }
            }
        }
    };
    elasticSearch.runQuery(product_filter_query, function(response, total, err)
    {
        if(!err)
        {
            response = response.map(function(attribute){
                return {"attribute_path":attribute["_source"].product_line_attribute_db_path,"display_name":attribute["_source"].product_line_attribute}
            });
            let aggs_query = {};
            // console.log(JSON.stringify(query,null, 2))
            // console.log(already_having_attributes);
            for(let i in response)
            {
                let filter_query = JSON.parse(JSON.stringify(query));
                if(already_having_attributes.hasOwnProperty(response[i]["attribute_path"]))
                    filter_query.bool.must.splice(already_having_attributes[response[i]["attribute_path"]]["index"], 1);
                aggs_query[response[i]["display_name"]] = {
                    filter : filter_query,
                    aggs : { count_is : { terms : { field : response[i]["attribute_path"], size : 1000} } }
                };
            }
            let product_data_query = {
                index : "product_data",
                type : product_line,
                body : {
                    size : 0,
                    aggs : aggs_query
                }
            };
            //console.log(JSON.stringify(product_data_query, null, 2));
            elasticSearch.getElasticResults(product_data_query, function(filter_response, total, error)
            {
                if(!error)
                {
                    let filters = filter_response["aggregations"];
                    let filter_list = [];
                    for(let i in response)
                    {
                        obj = {
                            key : response[i]["attribute_path"].split(".")[1],
                            display_name : response[i]["display_name"],
                            values : []
                        };
                        filter_values = filters[response[i]["display_name"]]["count_is"]["buckets"];
                        if(obj["key"]=="discount_price")
                        {
                            let count_0_500 = 0, count_500_1000 = 0,count_1000_1500 = 0,count_1500_2000=0,count_2000_2500=0,count_2500_above=0;
                            for(let i in filter_values)
                            {
                                let filter_obj = filter_values[i];
                                if(filter_obj["key"]>=0 && filter_obj["key"]<500)
                                {
                                    count_0_500+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=500 && filter_obj["key"]<1000)
                                {
                                    count_500_1000+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=1000 && filter_obj["key"]<1500)
                                {
                                    count_1000_1500+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=1500 && filter_obj["key"]<2000)
                                {
                                    count_1500_2000+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=2000 && filter_obj["key"]<2500)
                                {
                                    count_2000_2500+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=2500)
                                {
                                    count_2500_above+=filter_obj["doc_count"];
                                }
                            }
                            if(count_0_500!=0)
                            {
                                obj["values"].push({"key":"0 to 500","doc_count":count_0_500,check_status:false});
                            }
                            if(count_500_1000!=0)
                            {
                                obj["values"].push({"key":"500 to 1000","doc_count":count_500_1000,check_status:false});
                            }
                            if(count_1000_1500!=0)
                            {
                                obj["values"].push({"key":"1000 to 1500","doc_count":count_1000_1500,check_status:false});
                            }
                            if(count_1500_2000!=0)
                            {
                                obj["values"].push({"key":"1500 to 2000","doc_count":count_1500_2000,check_status:false});
                            }
                            if(count_2000_2500!=0)
                            {
                                obj["values"].push({"key":"2000 to 2500","doc_count":count_2000_2500,check_status:false});
                            }
                            if(count_2500_above!=0)
                            {
                                obj["values"].push({"key":"2500 or above","doc_count":count_2500_above,check_status:false});
                            }
                        }
                        else if(obj["key"]=="discount_percent")
                        {
                            let count_lessthan_10 = 0, count_greater_10 = 0,count_greater_20 = 0,count_greater_30=0;
                            let count_greater_40=0,count_greater_50=0,count_greater_60=0,count_greater_70=0;
                            for(let i in filter_values)
                            {
                                let filter_obj = filter_values[i];
                                if(filter_obj["key"]<10)
                                {
                                    count_lessthan_10+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=10)
                                {
                                    count_greater_10+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=20)
                                {
                                    count_greater_20+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=30)
                                {
                                    count_greater_30+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=40)
                                {
                                    count_greater_40+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=50)
                                {
                                    count_greater_50+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=60)
                                {
                                    count_greater_60+=filter_obj["doc_count"];
                                }
                                if(filter_obj["key"]>=70)
                                {
                                    count_greater_70+=filter_obj["doc_count"];
                                }
                            }
                            if(count_lessthan_10!=0)
                            {
                                obj["values"].push({"key":"Less than 10%","doc_count":count_lessthan_10,check_status:false});
                            }
                            if(count_greater_10!=0)
                            {
                                obj["values"].push({"key":"10% or more","doc_count":count_greater_10,check_status:false});
                            }
                            if(count_greater_20!=0)
                            {
                                obj["values"].push({"key":"20% or more","doc_count":count_greater_20,check_status:false});
                            }
                            if(count_greater_30!=0)
                            {
                                obj["values"].push({"key":"30% or more","doc_count":count_greater_30,check_status:false});
                            }
                            if(count_greater_40!=0)
                            {
                                obj["values"].push({"key":"40% or more","doc_count":count_greater_40,check_status:false});
                            }
                            if(count_greater_50!=0)
                            {
                                obj["values"].push({"key":"50% or more","doc_count":count_greater_50,check_status:false});
                            }
                            if(count_greater_60!=0)
                            {
                                obj["values"].push({"key":"60% or more","doc_count":count_greater_60,check_status:false});
                            }
                            if(count_greater_70!=0)
                            {
                                obj["values"].push({"key":"70% or more","doc_count":count_greater_70,check_status:false});
                            }
                        }
                        else
                        {
                            filter_values = filter_values.filter(function(fil)
                            {
                                return fil["key"]!="na";
                            });
                            obj["values"] = filter_values.map(function(fil){
                                let check_status = false;
                                if(already_having_attributes.hasOwnProperty(response[i]["attribute_path"]))
                                {
                                    if(already_having_attributes[response[i]["attribute_path"]]["values"].indexOf(fil["key"])!=-1)
                                    {
                                        check_status = true;
                                    }
                                }
                                fil["check_status"] = check_status;
                                return fil;
                            });
                        }
                        filter_list.push(obj);
                    }
                    let fl_list = filter_list.concat();
                    filter_list = filter_list.sort(function(a, b){
                        let dp1 = a["display_name"],dp2 = b["display_name"];
                        if (dp1 > dp2) return 1;
                        if (dp1 < dp2) return -1;
                        return 0;
                    });
                    // console.log("Sending Filter count");
                    callback(filter_list);
                }
            });
        }
    });
}
/*
* this will helps to get the all recommended attributes with filter values and it count for conflict benefits.
* @param {string} product_line
* @param {array} filter_result, conflict_benefits, added_filters
*/
function getRecommendedPreferences(product_line, filter_result, conflict_benefits, added_filters, callback)
{
    filter_result = filter_result.map(function(a){
        a["values"] = a["values"].map(function(val){
            val["recommend"] = [];
            return val;
        });
        a["status"] = false;
        return a;
    });
    let query = 
    {
        index: "styling_rules",
        type: "benefit_rules",
        body: {
            query:{
                bool :{
                    must:[
                        {
                            match_phrase:{"product_line_name":product_line}
                        },
                        {
                            terms:{
                                "adjective_value":conflict_benefits
                            }
                        }
                    ]
                }
            }
        }
    };
    elasticSearch.runQuery(query, function(response, total, err)
    {
        if(!err)
        {
            for(let i in response)
            {
                let source = response[i]["_source"];
                let display_name = source["adjective_display_name"];
                let dependencies = source["attribute_dependencies"];
                for(let j in dependencies)
                {
                    let att_value = dependencies[j];
                    filter_result = filter_result.map(function(attribute)
                    {
                        if(attribute["key"]==att_value["attribute_type"])
                        {
                            attribute["values"] = attribute["values"].map(function(val)
                            {
                                if(att_value["attribute_value"].indexOf(val["key"])!=-1)
                                {
                                    let added_filter_values = added_filters.filter(function(a){
                                        return attribute["key"] == a["key"];
                                    });
                                    if(added_filter_values.length>0)
                                    {
                                        let attribute_values = att_value["attribute_value"].filter(function(a)
                                        {
                                            return added_filter_values[0]["values"].indexOf(val)!=-1;
                                        });
                                        if(attribute_values.length==0)
                                        {
                                            attribute["status"] = true;
                                        }
                                    }
                                    if(val["recommend"].indexOf(display_name)==-1)
                                        val["recommend"].push(display_name);
                                }
                                return val;
                            });
                        }
                        return attribute;
                    });
                }
            }
            filter_result = filter_result.filter(function(attribute){
                return attribute["status"];
            });
            callback(filter_result);
        }
    });
}
module.exports = {
    get_product_line_filters : get_product_line_filters,
    get_feedback_attributes : get_feedback_attributes,
    get_feed_attribute:get_feed_attribute,
    getAdjectiveFilters:getAdjectiveFilters,
    getCountforFilters : getCountforFilters,
    getFilterCount : getFilterCount, //29-08-2017
    getRecommendedPreferences: getRecommendedPreferences
}