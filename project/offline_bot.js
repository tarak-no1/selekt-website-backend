let global = require('./global.js');
let helper = require('./helper');
let sessions = require('./sessions');
let mapping = require('./mapping');
let elasticSearch = require('./db_config/elasticSearch');
let mongo = require('./db_config/mongoQueries');
let functions = require('./functions');
let filterList = require('./filter-list');
let mysql = require("mysql");
let entity_bot = require("./entity_bot");
let conversationGraph = require('./conversationGraphs');
let fs = require("fs");
let word_mapping = JSON.parse(fs.readFileSync("./json/word_mapping.json"));
let benefit_tagging = JSON.parse(fs.readFileSync("./json/benefits_mapping.json"));

/*
* this is useful for updating the products list
* @param {string} sessionId, tab_id
* @param {string} user_type
*/
function updateProductList(sessionId, tab_id, callback) 
{
    console.log("In updateProductList function");
    let context = sessions.getContext(sessionId, tab_id);
    let remove_tags = context.remove_tags;
    
    for(let i in remove_tags)
    {
        let ben_index = context["benefits"].indexOf(remove_tags[i].value);
        let adj_index = context["adjectives_new"].indexOf(remove_tags[i].value);
        let pri_benefits = context["priority_values"]["benefits"].indexOf(remove_tags[i].value);
        let pri_adjectives = context["priority_values"]["adjectives"].indexOf(remove_tags[i].value);
        // console.log("IN BENEFITS : ",ben_index, remove_tags[i].value);
        // console.log("IN ADJECTIVES : ",adj_index);
        // console.log("IN Priority BENEFITS : ",pri_benefits);
        // console.log("IN Priority ADJECTIVES : ",pri_adjectives);
        if(ben_index!=-1)
        {
            context["benefits"].splice(ben_index, 1);
        }
        if(adj_index!=-1)
        {
            context["adjectives_new"].splice(adj_index, 1);
        }
        if(pri_benefits!=-1)
        {
            context["priority_values"]["benefits"].splice(pri_benefits,1);
        }
        if(pri_adjectives!=-1)
        {
            context["priority_values"]["adjectives"].splice(pri_adjectives,1);
        }
    }
    // console.log(context.benefits, context.adjectives_new,context.priority_values);
    // console.log("removed Tags : ",context.remove_tags);
    sessions.storeContext(sessionId,tab_id, context);
    sendProductsToUser(sessionId, tab_id, function(product_list){
        callback(product_list);
    });
}
/*
* this is used to send products to the user
* @param {string} sessionId, tab_id
*/
function sendProductsToUser(sessionId, tab_id, callback)
{
    console.log("In sendProductsToUser function");
    let context = sessions.getContext(sessionId, tab_id);
    // getting the product list 
    getProducts(sessionId,tab_id,function(result_list)
    {
        // console.log("--------------------- * ------------------------");
        let result_length = result_list[0].total;
        let flow_state = result_list[0].is_flow_complete;
        let product_line = result_list[0].product_line;

        // console.log(result_list[0]);
        // console.log("Priority values : ", context.priority_values);
        // console.log(context.question_queue, context.prev_questions_queue);
        result_list = result_list.slice(1,result_list.length); // removing the first element in the result list
        // Sending the first 60 results
        result_list = result_list.slice(0, (result_list.length<30?result_length:30));// taking only 30 products in the list
        
        //Products Sending
        let product_data = {};
        product_data.current_page = context.from;
        product_data.show_message = flow_state;
        product_data.product_line = product_line;
        product_data.total_length = result_length;
        product_data.list = result_list;
        // console.log("sending product list to user",result_list.length, "title : ", context.title);
        // console.log("previous questions queue : ", context["prev_questions_queue"]);
        // console.log("Question queue : ",context["question_queue"]);
        callback({"product_list":product_data,"title":context.title});
    });
}
/*
* this is used to sending benefits and adjectives to user
* @param {string} sessionId, tab_id
*/
function sendBenefitsToUser(sessionId,tab_id,callback)
{
    let context = sessions.getContext(sessionId,tab_id);
    if(context.product_line!=""){
        let product_line = mapping.product_line_to_db_keys[context.product_line];
        let benefit_tags  = benefit_tagging[product_line];

        let benefits = context["benefits"].concat();

        let adjectives = context["adjectives_new"].concat();
        adjectives = adjectives.concat(context.priority_values.adjectives);

        // let profile_benefits = helper.getProfileBenefits(sessionId, tab_id);
        // benefits = benefits.concat(profile_benefits);

        // benefit type
        let applied_benefits = [];
        let priority_benefits = context.priority_values.benefits;
        // giving the priority for user selected benefits
        for(let i in priority_benefits){
            let value = priority_benefits[i];
            let display_name = helper.getBenefitname(value, product_line,"benefits");
            let priority = 0;
            if(context["sort_type"]=="priority")
            {
                if(context["sort_priority_values"][0])
                {
                    if(context["sort_priority_values"][0].value==value)
                    {
                        priority = context["sort_priority_values"][0].priority;
                    }
                }
                if(context["sort_priority_values"][1])
                {
                    if(context["sort_priority_values"][1].value==value)
                    {
                        priority = context["sort_priority_values"][1].priority;
                    }
                }
            }
            else
            {
                if(benefit_tags[value]=="occasions")
                    priority = 1;
                else if(benefit_tags[value]=="broad_occasions")
                    priority = 2;
                if(priority_benefits.length==1)
                    priority = 1;
            }
            if(helper.checkObjExist(applied_benefits, {"type":"benefit","value" : value, "display_name": display_name}))
                applied_benefits.push({"type":"benefit","value" : value, "display_name": display_name, "priority" : priority});
        }

        for(let i in benefits){
            let value = benefits[i];
            let display_name = helper.getBenefitname(value, product_line,"benefits");
            let priority = 0;
            if(context["sort_type"]=="priority")
            {
                if(context["sort_priority_values"][0])
                {
                    if(context["sort_priority_values"][0].value==value)
                    {
                        priority = context["sort_priority_values"][0].priority;
                    }
                }
                if(context["sort_priority_values"][1])
                {
                    if(context["sort_priority_values"][1].value==value)
                    {
                        priority = context["sort_priority_values"][1].priority;
                    }
                }
            }
            if(helper.checkObjExist(applied_benefits, {"type":"benefit","value" : value, "display_name": display_name}))
                applied_benefits.push({"type":"benefit","value" : value, "display_name": display_name, "priority" : priority});
        }

        //adjective type
        // giving the priority for user selected adjectives
        for(let i in adjectives){
            let value = adjectives[i];
            let display_name = helper.getBenefitname(value, product_line, "adjectives");
            let priority = 0;
            if(context["sort_type"]=="priority")
            {
                if(context["sort_priority_values"][0])
                {
                    if(context["sort_priority_values"][0].value==value)
                    {
                        priority = context["sort_priority_values"][0].priority;
                    }
                }
                if(context["sort_priority_values"][1])
                {
                    if(context["sort_priority_values"][1].value==value)
                    {
                        priority = context["sort_priority_values"][1].priority;
                    }
                }
            }
            if(helper.checkObjExist(applied_benefits, {"type":"adjective","value" : value, "display_name": display_name}))
                applied_benefits.push({"type":"adjective","value" : value, "display_name": display_name,"priority" : priority});
        }
        // getting all benefits
        fetchAllProductlineBenefits(sessionId,tab_id,product_line,function(all_benefits){
            let benefit_data = {};
            benefit_data.type = "benefit_list";
            benefit_data.product_line = context.product_line;
            benefit_data.list = applied_benefits;
            benefit_data.all_benefits = all_benefits;
            callback(benefit_data)
        });
    }
}

/*
* Fetches all the benefits related to a product line regardless of user preferences
* @param {string} session_id, tab_id
* @param {string} product_line
*/
function fetchAllProductlineBenefits(session_id, tab_id, product_line, callback)
{
    let context = sessions.getContext(session_id, tab_id);
    let result = [];
    let benefit_type = {};
    // console.log(product_line);
    let total_benefits = word_mapping[product_line]["benefits"];
    let benefits = Object.keys(total_benefits);
    for(let i in benefits)
    {
        let ben_display_name = benefits[i];
        let ben_object = total_benefits[ben_display_name];
        if(!benefit_type.hasOwnProperty(ben_object.type_display_name))
        {
            benefit_type[ben_object.type_display_name] = {};
            benefit_type[ben_object.type_display_name]["type"] = ben_object.type;
        }
        if(!benefit_type[ben_object.type_display_name].hasOwnProperty("benefits"))
        {
            benefit_type[ben_object.type_display_name]["benefits"] = [];
        }
        benefit_type[ben_object.type_display_name]["benefits"].push({"value":ben_object.entity_key, "display_name":ben_display_name})
    }
    let benefit_keys = Object.keys(benefit_type);
    for(let i in benefit_keys)
    {
        let display_name = benefit_keys[i];
        let type = benefit_type[display_name].type;
        let ben = benefit_type[display_name].benefits;
        result.push({"display_name":display_name, "benefits_type" : type, type:"benefit", "benefits" : ben});
    }
    callback(result)
}

/*
* This function will fetch the products from elasticsearch and prepares display image, adjectives and benefits
* @param {string} session_id, tab_id
*/
function getProducts(session_id, tab_id, callback) 
{
    console.log("In getProducts function");
    let context = sessions.getContext(session_id, tab_id);
    let product_line = mapping.product_line_to_db_keys[context.product_line];
    let benefits = context['benefits'].concat();
    // let profile_benefits = helper.getProfileBenefits(session_id, tab_id);
    // benefits = benefits.concat(profile_benefits);

    let adjectives = context['adjectives_new'].concat();

    let filters = context['filters'];
    let from = context['from'];
    let is_flow_complete = context.is_flow_complete;
    let result_product_line = context.product_line, result_occasion;

    //making elasticsearch query from the current context
    let products_query = helper.buildQuery(product_line, filters, benefits, adjectives, from, context.priority_values, context.remove_tags, context["sort_type"], context["sort_priority_values"]);
    benefits = benefits.concat(context.priority_values.benefits);
    adjectives = adjectives.concat(context.priority_values.adjectives);
    // console.log(JSON.stringify(products_query, null, 2));
    let sort_priority_benefits=[];
    // getting the sort priority values
    if(context["sort_type"])
    {
        if(context["sort_type"]=="priority")
        {
            sort_priority_benefits = context["sort_priority_values"].map(function(obj)
            {
                let value = obj.value;
                if(obj.type=="benefit")
                {
                    value = helper.getBenefitname(value,product_line,"benefits");
                }
                else
                {
                    value = helper.getBenefitname(value,product_line,"adjectives");
                }
                return value;
            });
        }
    }
    else
    {
        let benefit_tags = benefit_tagging[product_line];
        let priority_benefit_values = context.priority_values.benefits;
        for(let ben in priority_benefit_values)
        {
            if(benefit_tags[priority_benefit_values[ben]]=="broad_occasions" || benefit_tags[priority_benefit_values[ben]]=="occasions")
            {
                let ben_name = helper.getBenefitname(priority_benefit_values[ben],product_line,"benefits");
                if(sort_priority_benefits.indexOf(ben_name)==-1)
                    sort_priority_benefits.push(ben_name);
            }
        }
    }
    // console.log("Sort Priority benefits : ", sort_priority_benefits);
    // console.log("Sending to elasticsearch : ", product_line);

    console.log("getting the product list from elasticSearch");
    // Fetching products
    elasticSearch.runQuery(products_query, function (es_result,total,err)
    {
        if(err==null)
        {
            let result = [], productlist = [];
            result.push({"total":total,"is_flow_complete":is_flow_complete, "product_line": result_product_line});
            // console.log("Result length : ", es_result.length);
            if(total>0)
            {
                console.log("Getting the products from mongo db based on the elastic search ids");
                // making the mongo query
                let mongo_query = es_result.map(function(a){ return {"es_mysql_id":parseInt(a._id)}; });
                mongo.runQuery(product_line,{$or:mongo_query},function(result_set, mongo_error)
                {
                    if(!mongo_error)
                    {
                        let elastic_array = es_result.map(function(a){return a._id; });
                        result_set = helper.sortBasedonArray(result_set.concat(), elastic_array);
                        for(let i in result_set)
                        {
                            let result_source = result_set[i];
                            let source = {};
                            source["id"] = result_source["es_mysql_id"];
                            source["product_filter"] = result_source["product_filter"];
                            source["landingPageUrl"] = result_source["pdpData"]["landingPageUrl"];
                            source["priority_benefits"] = sort_priority_benefits;

                            // Some products have 'style_image' and some have 'style_images', so this condition
                            source["style_image"] = result_source["style_images"];

                            let main_image_url=undefined,front_image_url=undefined,back_image_url=undefined,right_image_url=undefined,left_image_url=undefined,search_image=undefined;
                            try{
                                if(source["style_image"]!=undefined && Object.keys(source["style_image"]).length!=0)
                                {
                                    if(source["style_image"].hasOwnProperty("default"))
                                    {
                                        search_image = source["style_image"]["default"]["imageURL"];
                                        main_image_url = resolutions(source["style_image"]["default"]);
                                    }

                                    if(source["style_image"].hasOwnProperty("front"))
                                        front_image_url = source["style_image"]["front"]["imageURL"];

                                    if(source["style_image"].hasOwnProperty("back"))
                                        back_image_url = source["style_image"]["back"]["imageURL"];

                                    if(source["style_image"].hasOwnProperty("right"))
                                        right_image_url = source["style_image"]["right"]["imageURL"];

                                    if(source["style_image"].hasOwnProperty("left"))
                                        left_image_url = source["style_image"]["left"]["imageURL"];

                                    source["style_image"] = {};
                                    source["style_image"]["search"] = {};
                                    if(main_image_url!=undefined)
                                    {
                                        search_image = search_image.replace("http://","https://");
                                        main_image_url = main_image_url.replace("http://","https://");
                                        source["style_image"]["search"]["imageURL"] = search_image;
                                        source["style_image"]["search"]["imageURL1"] = main_image_url;
                                        main_image_url = undefined;
                                    }
                                    if(left_image_url!=undefined)
                                    {
                                        left_image_url = left_image_url.replace("http://","https://");
                                        source["style_image"]["left"] = {};
                                        source["style_image"]["left"]["imageURL"] = left_image_url;
                                        if(source["style_image"]["search"]["imageURL"]==undefined)
                                            source["style_image"]["search"]["imageURL"] = left_image_url;
                                        left_image_url = undefined;
                                    }
                                    if(right_image_url!=undefined)
                                    {
                                        right_image_url = right_image_url.replace("http://","https://");
                                        source["style_image"]["right"] = {};
                                        source["style_image"]["right"]["imageURL"] = right_image_url;
                                        if(source["style_image"]["search"]["imageURL"]==undefined)
                                            source["style_image"]["search"]["imageURL"] = right_image_url;
                                        right_image_url = undefined;
                                    }
                                    if(front_image_url!=undefined)
                                    {
                                        front_image_url = front_image_url.replace("http://","https://");
                                        source["style_image"]["front"] = {};
                                        source["style_image"]["front"]["imageURL"] = front_image_url;
                                        if(source["style_image"]["search"]["imageURL"]==undefined)
                                            source["style_image"]["search"]["imageURL"] = front_image_url;
                                        front_image_url = undefined;
                                    }
                                    if(back_image_url!=undefined)
                                    {
                                        back_image_url = back_image_url.replace("http://","https://");
                                        source["style_image"]["back"] = {};
                                        source["style_image"]["back"]["imageURL"] = back_image_url;
                                        if(source["style_image"]["search"]["imageURL"]==undefined)
                                            source["style_image"]["search"]["imageURL"] = back_image_url;
                                        back_image_url = undefined;
                                    }
                                }
                            }catch(e){};
                            // Adding the benefits and adjectives of the product which are asked by user
                            source["product_benefits"] = getElementsNames(result_source["benefits"],result_product_line, "benefits");
                            source["product_benefits"] = source["product_benefits"].concat(getElementsNames(result_source["adjectives"],result_product_line, "adjectives"));
                            source["benefits"] = helper.array_intersection(result_source["benefits"], benefits);
                            source["benefits"] = getElementsNames(source.benefits,result_product_line, "benefits");
                            
                            let adj = helper.array_intersection(result_source["adjectives"], adjectives);
                            adj = getElementsNames(adj, result_product_line, "adjectives");

                            source.benefits = source["benefits"].concat(adj);

                            source["benefit_percentage"] = Math.round((source["benefits"].length / (benefits.length+context["adjective_questions_count"]))*100);
                            productlist.push(source);
                        }
                        if(context["sort_type"] === "match_score")
                        {
                            // console.log("list is sorting based on the benefit percentage");
                            try{
                                productlist = productlist.sort(function(a, b)
                                {
                                    return b["benefit_percentage"] - a["benefit_percentage"];
                                });
                            }catch(e){}
                        }
                        result = result.concat(productlist);
                        callback(result);
                    }
                    else
                    {
                        callback(result);
                    }
                });
            }
            else
            {
                callback(result);
            }
        }
    });
}

/*
* This function is used to getting require size image url
* @param {obj} source
*/
let resolutions = function(source)
{
    let image_url = undefined;
    let pixel,min_pixels=2080,require_pixel1 = 180, require_pixel2 = 180;
    let require_pixel1_status = false, require_pixel2_status = false, require_pixel1_index,require_pixel2_index;
    try{
        image_url = source["imageURL"];
        let image_resolutions = source["resolutions"];
        if(image_resolutions)
        {
            let res_keys = Object.keys(image_resolutions);
            let require_index = 0;
            for(let res in res_keys)
            {
                pixel = parseInt(res_keys[res].split("X")[0]);
                if(pixel==require_pixel1)
                {
                    require_pixel1_index = res;
                    require_pixel1_status = true;
                    break;
                }
                else if(pixel==require_pixel2)
                {
                    require_pixel2_status = true;
                    require_pixel2_index = res;
                }
                if(pixel>=require_pixel1 && pixel<min_pixels)
                {
                    min_pixels = pixel;
                    require_index = res;
                }
            }
            if(require_pixel1_status)
            {
                require_index = require_pixel1_index;
            }
            else if(require_pixel2_status)
            {
                require_index = require_pixel2_index;
            }
            image_url = image_resolutions[res_keys[require_index]];
        }
    }catch (e){
        // console.log("Error In resolutions method : ",e);
    }
    return image_url;
};
/*
* getting the applied filters from the context
* @param {obj} context_filters
* @return {obj} applied_filters
*/
function getAppliedFilters(context_filters)
{
    let applied_filters = [];
    let json_type = {};
    for(let flt in context_filters)
    {
        let obj = context_filters[flt];
        let attrib = Object.keys(obj)[0];
        if(json_type[attrib]==undefined)
            json_type[attrib] = [];
        json_type[attrib].push(obj[attrib]);
    }
    let json_type_keys = Object.keys(json_type);
    for(let at in json_type_keys)
    {
        if(json_type_keys[at]!="range")
        {
            let key = json_type_keys[at].split('.')[1];
            let values = json_type[json_type_keys[at]];

            applied_filters.push({"key":key,"values":values});
        }
        else
        {
            let range_query = json_type[json_type_keys[at]];

            for(let r_val in range_query)
            {
                let range_key = Object.keys(range_query[r_val])[0];
                let value,key;
                let gte = range_query[r_val][range_key].gte;
                let lte = range_query[r_val][range_key].lte;
                if(range_key=="product_filter.discount_price")
                {
                    key = "discount_price";
                    if(lte==undefined)
                        value = [gte+" or above"];
                    else if(gte==undefined)
                        value = [lte+" or below"];
                    else
                        value = [gte+" to "+lte];
                }
                else if(range_key=="product_filter.discount_percent")
                {
                    key = "discount_percent";
                    if(gte==0 & lte==10)
                        value = ["less than 10%"];
                    else
                        value = [gte+"% or more"];
                }
                applied_filters.push({"key":key,"values":value});
            }
        }
    }
    return applied_filters;
}
/*
* getting display names of array of benefits based on the type.
* @param {array} obj
* @param {string} product_line
* @param {string} type
* @return {array} obj_names
*/
function getElementsNames(obj, product_line, type) {
    let obj_names = [];
    product_line = mapping.product_line_to_db_keys[product_line];
    for(let ben in obj)
    {
        let ben_name = helper.getBenefitname(obj[ben],product_line,type);
        if(!ben_name)
        {
            ben_name = obj[ben];
        }
        obj_names.push(ben_name);
    }
    return obj_names;
}

module.exports =
{
    updateProductList : updateProductList,
    getAppliedFilters : getAppliedFilters,
    getElementsNames : getElementsNames,
    resolutions : resolutions,
    sendProductsToUser : sendProductsToUser,
    sendBenefitsToUser : sendBenefitsToUser
};