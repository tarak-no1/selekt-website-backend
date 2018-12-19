let global = require('./global.js');
let helper = require('./helper');
let sessions = require('./sessions');
let mapping = require('./mapping');
let elasticSearch = require('./db_config/elasticSearch');
let mongo = require('./db_config/mongoQueries');
let functions = require('./functions');
let filterList = require('./filter-list');
let entity_bot = require("./entity_bot");
let offline = require("./offline_bot");
let fs = require("fs");
let word_mapping = JSON.parse(fs.readFileSync("./json/word_mapping.json"));
let benefit_tagging = JSON.parse(fs.readFileSync("./json/benefits_mapping.json"));
let ffp_reasons = JSON.parse(fs.readFileSync("./json/ffp_reasons.json"));

const sister_pl = {
    "women_dresses":["women_tops","women_kurta"],
    "women_tops":["women_dresses","women_kurta"],
    "women_kurta":["women_dresses","women_tops"],
    "women_tshirts":["women_jackets","women_shirts"],
    "women_shirts":["women_jackets","women_tshirts"],
    "women_jackets":["women_tshirts","women_shirts"],
    "women_sweaters":["women_sweatshirts","women_blazers"],
    "women_sweatshirts":["women_sweaters","women_blazers"],
    "women_blazers":["women_sweatshirts","women_sweaters"],
    "women_jeans":["women_jeggings","women_trousers"],
    "women_trousers":["women_jeggings","women_jeans"],
    "women_jeggings":["women_jeans","women_trousers"],
    "women_shorts":["women_skirts","women_capris"],
    "women_skirts":["women_shorts","women_capris"],
    "women_capris":["women_shorts","women_capris"],
    "women_casual_shoes":[],
    "women_jumpsuits":[],
    "women_handbags":[],
    "women_flats":[],
    "women_heels" : []
}
/*
* if any new user message is coming from the user this function calls
* @param {string} message
* @param {int} from
* @param {string} result_type
*/
function webProcessMessage(message, from, result_type, callback) {
    //getting the entities
    entity_bot.getEntities(message, undefined, function (entities)
    {
        // basic query for getting the product list from the elastic search
        let query = {
            index:"product_data",
            preference: '_primary',
            body:
            {
                "query":
                {
                    "bool":
                    {
                        "must":[],
                        "should":[]
                    }
                },"from":from,"size":60}
        };
        let product_line="";
        let benefits = []; // these benefits are having the most priority
        let extra_benefits = []; // these are extra benefits, that are coming from the reference values
        let benefit_names =[];
        let links = [];
        let sort_priority_benefits = []; // these are most priority benefits
        let prev_rel_search_status = false;
        // console.log("=================== Entities for url message "+result_type+" ====================");
        // console.log(entities);
        // console.log("=================================================");

        // if url containing the broad category or the occasion_productline_map need to remove from the entities
        // because our starting user query must need the product_line
        if(entities.hasOwnProperty("broad_category"))
        {
            delete entities["broad_category"];
        }
        if(entities.hasOwnProperty("occasion_productline_map"))
        {
            delete entities["occasion_productline_map"];
        }
        // if user query is having some entities, we need to proceed the further processes, otherwise send the blank response
        if(Object.keys(entities).length > 0)
        {
            if(entities.hasOwnProperty("product_line"))
            {
                let entity_productline = entities["product_line"];
                //getting productline db_key from the mapping file
                product_line = mapping.product_line_to_db_keys[entity_productline];
                query["type"] = product_line;
            }
            // checking the entities are having occasion or not
            if(entities.hasOwnProperty("occasion"))
            {
                //check if entities are having the broad_occasion or not, 
                // if not in entities, get the broad occasion from word_mapping file, use occasion as reference
                if(!entities.hasOwnProperty("broad_occasion"))
                {
                    let broad_occasions = (entities["occasion"].broad_occasions).split(".")[1];
                    let broad_occasion = word_mapping[product_line]["broad_occasions"][broad_occasions];
                    if(broad_occasion.benefit_entity_key && broad_occasion.benefit_entity_key!="")
                    {
                        // if benefit_entity_key is exists push it into extra_benefits
                        if(extra_benefits.indexOf(broad_occasion.benefit_entity_key)==-1)
                        {
                            extra_benefits.push(broad_occasion.benefit_entity_key);
                        }
                    }
                }
                if(entities["occasion"].benefit_entity_key && entities["occasion"].benefit_entity_key!="")
                {
                    // if occasion key is exists push it into most priority benefits
                    if(benefits.indexOf(entities["occasion"].benefit_entity_key)==-1)
                    {
                        benefits.push(entities["occasion"].benefit_entity_key);
                    }
                }

               //Sending popular searches based on occasions.
                if(!entities.hasOwnProperty("attribute_values")&&!entities.hasOwnProperty("broad_occasion") && result_type=="related_searches")
                {
                    prev_rel_search_status = true;
                    let offset1 = Object.keys(word_mapping[product_line]["broad_occasions"]).length * 28;
                    let offset2 = Object.keys(word_mapping[product_line]["occasions"]).indexOf(entities["occasion"]["key"]) * 28;
                    let offset = offset1 + offset2;
                    let popular_query = 
                    {
                        index: 'published_links_web',
                        type: product_line,
                        preference: '_primary',
                        body: {
                            "query":  {
                                "bool": {
                                    "should": [
                                        {"term":{"type": "fop"}}
                                    ],
                                    "minimum_should_match": 1
                                }
                            },
                            "from": offset,
                            "size":"28"
                        }
                    };
                    elasticSearch.runQuery(popular_query, function(data,total,err)
                    {
                       if(err==null)
                       {
                            for(let i in data)
                            {
                                // clean the link
                                let pop = data[i]["_source"];
                                let link = pop.link;
                                link = link.replace("https://www.selekt.in/find/","");
                                link = link.split("-").join(" ");
                                links.push({"link":link,"flag":true});
                            }
                        }
                        else{
                            console.log(err);
                        }
                        relatedSearches(product_line, links, entities, function(related_search_result)
                        {
                            callback(related_search_result);
                        });
                    });
                    return;
                }
                //Sending popular searches based on occasion and attribute values
                else if(!entities.hasOwnProperty("broad_occasion") && result_type=="related_searches")
                {
                    prev_rel_search_status = true;
                    let offset1 = Object.keys(word_mapping[product_line]["broad_occasions"]).length * 28;
                    let offset2 = Object.keys(word_mapping[product_line]["occasions"]).length * 28;
                    let offset3 = Object.keys(word_mapping[product_line]["attribute_values"]).indexOf(entities["attribute_values"][0]) * 28;
                    let offset = offset1 + offset2 + offset3;
                    let popular_query = 
                    {
                        index: 'published_links_web',
                        type: product_line,
                        preference: '_primary',
                        body: {
                            "query":  {
                                "bool": {
                                    "should": [
                                        {"term":{"type": "fop"}}
                                    ],
                                    "minimum_should_match": 1
                                }
                            },
                            "from" : offset,
                            "size":"28"
                        }
                    };
                    elasticSearch.runQuery(popular_query, function(data,total,err){
                        if(err==null){
                            for(let i in data)
                            {
                                let pop = data[i]["_source"];
                                let link = pop.link;
                                link = link.replace("https://www.selekt.in/find/","");
                                link = link.split("-").join(" ");
                                links.push({"link":link,"flag":true});
                            }
                            
                        }
                        else{
                            console.log(err);
                        }
                        relatedSearches(product_line, links, entities, function(related_search_result)
                        {
                            callback(related_search_result);
                        });
                    });
                    return;
                }
            }
            //getting the broad occasion benefits if exists
            if(entities.hasOwnProperty("broad_occasion"))
            {
                if(entities["broad_occasion"].benefit_entity_key && entities["broad_occasion"].benefit_entity_key!="")
                {
                    if(benefits.indexOf(entities["broad_occasion"].benefit_entity_key)==-1)
                    {
                        benefits.push(entities["broad_occasion"].benefit_entity_key);
                    }
                }
                // getting the occasion benefits if occasion is not exists in the user query and broad occasion is exists
                if(!entities.hasOwnProperty("occasion"))
                {
                    let occasion_map = entities.broad_occasion.occasion_map;
                    for(let i in occasion_map)
                    {
                        let occasion_value = word_mapping[product_line]["occasions"][occasion_map[i]];
                        if(occasion_value.benefit_entity_key && occasion_value.benefit_entity_key!="")
                        {
                            // pushing these occasion benefits into extra_benefits if benefits are exists
                            if(extra_benefits.indexOf(occasion_value.benefit_entity_key)==-1)
                                extra_benefits.push(occasion_value.benefit_entity_key);
                        }
                    }
                }
                //Sending popular searches based on broad_occasion
                if(result_type=="related_searches")
                {
                    prev_rel_search_status = true;
                    if(!entities.hasOwnProperty("attribute_values")){
                        let offset = Object.keys(word_mapping[product_line]["broad_occasions"]).indexOf(entities["broad_occasion"]["key"]) * 28;
                        let popular_query = 
                        {
                            index: 'published_links_web',
                            type: product_line,
                            preference: '_primary',
                            body: {
                                "query":  {
                                    "bool": {
                                        "should": [
                                            {"term":{"type": "fop"}}
                                        ],
                                        "minimum_should_match": 1
                                    }
                                },
                                "from": offset,
                                "size":"28"
                            }
                        };
                        //getting fop links from the published_links_web
                        elasticSearch.runQuery(popular_query, function(data,total,err){
                            if(err==null){
                                for(let i in data)
                                {
                                    let pop = data[i]["_source"];
                                    let link = pop.link;
                                    link = link.replace("https://www.selekt.in/find/","");
                                    link = link.split("-").join(" ");
                                    links.push({"link":link,"flag":true});
                                }
                                
                            }
                            else{
                                console.log(err);
                            }
                            relatedSearches(product_line, links, entities, function(related_search_result)
                            {
                                callback(related_search_result);
                            });
                        });    
                    }
                    //Sending popular searches based on broad_occasion and attribute values
                    else{
                        let offset1 = Object.keys(word_mapping[product_line]["broad_occasions"]).length * 28;
                        let offset2 = Object.keys(word_mapping[product_line]["occasions"]).length * 28;
                        let offset3 = Object.keys(word_mapping[product_line]["attribute_values"]).indexOf(entities["attribute_values"][0]) * 28;
                        let offset = offset1 + offset2 + offset3;
                        let popular_query = 
                        {
                            index: 'published_links_web',
                            type: product_line,
                            preference: '_primary',
                            body: {
                                "query":  {
                                    "bool": {
                                        "should": [
                                            {"term":{"type": "fop"}}
                                        ],
                                        "minimum_should_match": 1
                                    }
                                },
                                "from" : offset,
                                "size":"28"
                            }
                        };
                        elasticSearch.runQuery(popular_query, function(data,total,err){
                            if(err==null){
                                for(let i in data)
                                {
                                    let pop = data[i]["_source"];
                                    let link = pop.link;
                                    link = link.replace("https://www.selekt.in/find/","");
                                    link = link.split("-").join(" ");
                                    links.push({"link":link,"flag":true});
                                }
                            }
                            else{
                                console.log(err);
                            }
                            relatedSearches(product_line, links, entities, function(related_search_result)
                            {
                                callback(related_search_result);
                            });
                        });
                    }
                    return;
                }
            }
            let filters = {};
            //making the range query based on the user requirements
            if(entities.hasOwnProperty("range"))
            {
                let range;
                try{
                    range = entities.range.type;
                }catch(e){}
                let number = entities.range.numbers;
                let range_query = {"range":{"product_filter.discount_price":{}}};
                if(range=="above" && number!=null)
                {
                    range_query.range["product_filter.discount_price"].gte = number[0];
                }
                else if(range=="under" && number!=null)
                {
                    range_query.range["product_filter.discount_price"].lte = number[0];
                }
                else if(number!=null && (range=="between" || entities.number.length==2))
                {
                    if(number[0]>number[1])
                    {
                        let temp = number[0];
                        number[0] = number[1];
                        number[1] = temp;
                    }
                    
                    range_query.range["product_filter.discount_price"].gte = number[0];
                    range_query.range["product_filter.discount_price"].lte = number[1];
                }
                if(Object.keys(range_query.range["product_filter.discount_price"]).length>0)
                    query.body.query.bool.must.push(range_query);
            }
            // Adding attribute value filters
            if(entities.hasOwnProperty("attribute_values"))
            {
                let attribute_values = entities.attribute_values;
                for(let i in attribute_values)
                {
                    if(!filters.hasOwnProperty("product_filter."+attribute_values[i].db_key))
                        filters["product_filter."+attribute_values[i].db_key] = [];
                    filters["product_filter."+attribute_values[i].db_key].push(attribute_values[i].key);
                }
                //for popular searches.
                //Sending popular searches based on attribute value
                if(result_type=="related_searches")
                {
                    prev_rel_search_status = true;
                    if(!entities.hasOwnProperty("occasion")&&!entities.hasOwnProperty("broad_occasion"))
                    {
                        //Added for sister linking of fp type. June 8, 2017 by Sangeet
                        let sisters = sister_pl[product_line];
                        if(sisters.length>0){
                            let values_count = 0;
                            for(let i = 0; i<2; i++){
                                let query1 = 
                                {
                                    index: 'published_links_web',
                                    type: sisters[i],
                                    preference: '_primary',
                                    body: {
                                        "query":  {
                                            "bool": {
                                                "should": [
                                                    {"term":{"type": "fp"}},
                                                    {"term":{"filter_value1": attribute_values[0]["key"]}}
                                                ],
                                                "minimum_should_match": 2
                                            }
                                        },
                                        "size":"1"
                                    }
                                };
                                elasticSearch.runQuery(query1, function(data,total, error){
                                    values_count++;
                                    if(error==null){
                                        for(let k in data)
                                        {
                                            let pop = data[k]["_source"];
                                            let link = pop.link;
                                            link = link.replace("https://www.selekt.in/find/","");
                                            link = link.split("-").join(" ");
                                            links.push({"link":link,"flag":false});
                                        }
                                    }
                                });
                            }
                        }
                        //Sister link end here

                        if(attribute_values.length > 1)
                        {
                            if(attribute_values[0]["db_key"]!="brand" && attribute_values[1]["db_key"]!="brand"){
                                let adjective_keys_length = Object.keys(word_mapping[product_line]["adjectives"]).length;
                                let offset1 = adjective_keys_length * 28;
                                let offset2 = Object.keys(word_mapping[product_line]["display_link"]["without_brand"]).length * 28;
                                let attribute_value_index = Object.keys(word_mapping[product_line]["display_link"]["without_brand"]).indexOf(attribute_values[0]["key"]);
                                let offset3 = attribute_value_index * 28;
                                let total_offset = offset1 + offset2 + offset3;
                                let popular_query = 
                                {
                                    index: 'published_links_web',
                                    type: product_line,
                                    preference: '_primary',
                                    body: {
                                        "query":  {
                                            "bool": {
                                                "should": [
                                                    {"term":{"type": "ffp"}}
                                                ],
                                                "must_not":[
                                                    {"term":{"attribute1":"brand"}},
                                                    {"term":{"attribute2":"brand"}}
                                                ],
                                                "minimum_should_match": 1
                                            }
                                        },
                                        "from" : total_offset,
                                        "size":"28"
                                    }
                                };
                                elasticSearch.runQuery(popular_query, function(data,total,err){
                                    if(err==null){
                                        for(let i in data)
                                        {
                                          let pop = data[i]["_source"];
                                          let link = pop.link;
                                          link = link.replace("https://www.selekt.in/find/","");
                                          link = link.split("-").join(" ");
                                          links.push({"link":link,"flag":true});
                                        }
                                    }
                                    else{
                                        console.log(err);
                                    }
                                    relatedSearches(product_line, links, entities, function(related_search_result)
                                    {
                                        callback(related_search_result);
                                    });
                                });
                            }
                            else{
                                let offset1 = Object.keys(word_mapping[product_line]["display_link"]["with_brand"]).length * 28;
                                let attribute_value_index = Object.keys(word_mapping[product_line]["display_link"]["with_brand"]).indexOf(attribute_values[0]["key"]);
                                let offset2 = attribute_value_index * 28;
                                let total_offset = offset1 + offset2;
                                let popular_query = 
                                {
                                    index: 'published_links_web',
                                    type: product_line,
                                    preference: '_primary',
                                    body: {
                                        "query":  {
                                            "bool": {
                                                "should": [
                                                    {"term":{"attribute1":"brand"}},
                                                    {"term":{"attribute2":"brand"}}
                                                ],
                                                "must":[
                                                    {"term":{"type": "ffp"}}
                                                ],
                                                "minimum_should_match": 1
                                            }
                                        },
                                        "from" : total_offset,
                                        "size":"28"
                                    }
                                };
                                elasticSearch.runQuery(popular_query, function(data,total,err){
                                    if(err==null){
                                        for(let i in data)
                                        {
                                          let pop = data[i]["_source"];
                                          let link = pop.link;
                                          link = link.replace("https://www.selekt.in/find/","");
                                          link = link.split("-").join(" ");
                                          links.push({"link":link,"flag":true});
                                        }
                                        
                                    }
                                    else{
                                        console.log(err);
                                    }
                                    relatedSearches(product_line, links, entities, function(related_search_result)
                                    {
                                        callback(related_search_result);
                                    });
                                });
                            }
                        }
                        else{
                            if(attribute_values[0]["db_key"]!="brand"){
                                let adjective_keys_length = Object.keys(word_mapping[product_line]["adjectives"]).length;
                                let offset1 = adjective_keys_length * 28;
                                let attribute_value_index = Object.keys(word_mapping[product_line]["display_link"]["without_brand"]).indexOf(attribute_values[0]["key"]);
                                let offset2 = attribute_value_index * 28;
                                let total_offset = offset1 + offset2;
                                let popular_query = 
                                {
                                    index: 'published_links_web',
                                    type: product_line,
                                    preference: '_primary',
                                    body: {
                                        "query":  {
                                            "bool": {
                                                "should": [
                                                    {"term":{"type": "ffp"}}
                                                ],
                                                "must_not":[
                                                    {"term":{"attribute1":"brand"}},
                                                    {"term":{"attribute2":"brand"}}
                                                ],
                                                "minimum_should_match": 1
                                            }
                                        },
                                        "from" : total_offset,
                                        "size":"28"
                                    }
                                };
                                elasticSearch.runQuery(popular_query, function(data,total,err){
                                    if(err==null){
                                        for(let i in data)
                                        {
                                          let pop = data[i]["_source"];
                                          let link = pop.link;
                                          link = link.replace("https://www.selekt.in/find/","");
                                          link = link.split("-").join(" ");
                                          links.push({"link":link,"flag":true});
                                        }
                                    }
                                    else{
                                        console.log(err);
                                    }
                                    relatedSearches(product_line, links, entities, function(related_search_result)
                                    {
                                        callback(related_search_result);
                                    });
                                });
                            }
                            else{
                                let attribute_value_index = Object.keys(word_mapping[product_line]["display_link"]["with_brand"]).indexOf(attribute_values[0]["key"]);
                                let offset = attribute_value_index * 28;
                                let popular_query = 
                                {
                                    index: 'published_links_web',
                                    type: product_line,
                                    preference: '_primary',
                                    body: {
                                        "query":  {
                                            "bool": {
                                                "should": [
                                                    {"term":{"attribute1":"brand"}},
                                                    {"term":{"attribute2":"brand"}}
                                                ],
                                                "must":[
                                                    {"term":{"type": "ffp"}}
                                                ],
                                                "minimum_should_match": 1
                                            }
                                        },
                                        "from" : offset,
                                        "size":"28"
                                    }
                                };
                                elasticSearch.runQuery(popular_query, function(data,total,err){
                                    if(err==null){
                                        for(let i in data)
                                        {
                                          let pop = data[i]["_source"];
                                          let link = pop.link;
                                          link = link.replace("https://www.selekt.in/find/","");
                                          link = link.split("-").join(" ");
                                          links.push({"link":link,"flag":true});
                                        }
                                    }
                                    else{
                                        console.log(err);
                                    }
                                    relatedSearches(product_line, links, entities, function(related_search_result)
                                    {
                                        callback(related_search_result);
                                    });
                                });
                            }
                        }
                    }
                    return;
                }
            }
            //getting benefits if user query having the benefit name
            if(entities.hasOwnProperty("entity_benefits"))
            {
                for(let i in entities.entity_benefits)
                {
                    benefits.push(entities.entity_benefits[i].entity_key);
                }
            }
            // getting age type of benefits from the user query
            if(entities.hasOwnProperty("age"))
            {
                if(entities.age.entity_key!="")
                {
                    benefits.push(entities.age.entity_key);
                }
            }
            // getting height type of benefits from the user query
            if(entities.hasOwnProperty("height"))
            {
                if(entities.height.entity_key!="")
                {
                    benefits.push(entities.height.entity_key);
                }
                let height_value = entities["height"]["key"];
                //sending the FPH links to user
                if(Object.keys(entities).length==2 && result_type=="related_searches")
                {
                    prev_rel_search_status = true;
                    let fph_query = 
                    {
                        index: 'published_links_web',
                        type: product_line,
                        preference: '_primary',
                        body: {
                            query: {
                                bool: {
                                    must: [
                                        {term: {type: {value: "fph"}}},
                                        {term: {attribute3: {value: "height"}}},
                                        {term: {filter_value3: {value: height_value}}}
                                    ]
                                }
                            }
                        }
                    };
                    elasticSearch.runQuery(fph_query, function(data, total, error)
                    {
                        if(!error)
                        {
                            for(let i in data)
                            {
                              let pop = data[i]["_source"];
                              let link = pop.link;
                              link = link.replace("https://www.selekt.in/find/","");
                              link = link.split("-").join(" ");
                              links.push({"link":link,"flag":true});
                            }
                        }
                        relatedSearches(product_line, links, entities, function(related_search_result)
                        {
                            callback(related_search_result);
                        });
                    });
                    return;
                }
            }
            // getting body type of benefits from the user query
            if(entities.hasOwnProperty("bodyshape"))
            {

                if(entities.bodyshape.entity_key!="")
                {
                    benefits.push(entities.bodyshape.entity_key);
                }
                let bodyshape_value = entities["bodyshape"]["key"];
                //sending the FPB links to user
                if(Object.keys(entities).length==2 && result_type=="related_searches")
                {
                    prev_rel_search_status = true;
                    let fpb_query = 
                    {
                        index: 'published_links_web',
                        type: product_line,
                        preference: '_primary',
                        body: {
                            query: {
                                bool: {
                                    must: [
                                        {term: {type: {value: "fpb"}}},
                                        {term: {attribute3: {value: "bodyshape"}}},
                                        {term: {filter_value3: {value: bodyshape_value}}}
                                    ]
                                }
                            }
                        }
                    };
                    elasticSearch.runQuery(fpb_query, function(data, total, error)
                    {
                        if(!error)
                        {
                            for(let i in data)
                            {
                              let pop = data[i]["_source"];
                              let link = pop.link;
                              link = link.replace("https://www.selekt.in/find/","");
                              link = link.split("-").join(" ");
                              links.push({"link":link,"flag":true});
                            }
                        }
                        relatedSearches(product_line, links, entities, function(related_search_result)
                        {
                            callback(related_search_result);
                        });
                    });
                    return;
                }
            }
            // getting skintone type of benefits from the user query
            if(entities.hasOwnProperty("skintone"))
            {
                if(entities.skintone.entity_key!="")
                {
                    benefits.push(entities.skintone.entity_key);
                }
                let skintone_value = entities["skintone"]["key"];
                //sending the fps links to the user
                if(Object.keys(entities).length==2 && result_type=="related_searches")
                {
                    prev_rel_search_status = true;
                    let fps_query = 
                    {
                        index: 'published_links_web',
                        type: product_line,
                        preference: '_primary',
                        body: {
                            query: {
                                bool: {
                                    must: [
                                        {term: {type: {value: "fps"}}},
                                        {term: {attribute3: {value: "skintone"}}},
                                        {term: {filter_value3: {value: skintone_value}}}
                                    ]
                                }
                            }
                        }
                    };
                    elasticSearch.runQuery(fps_query, function(data, total, error)
                    {
                        if(!error)
                        {
                            for(let i in data)
                            {
                              let pop = data[i]["_source"];
                              let link = pop.link;
                              link = link.replace("https://www.selekt.in/find/","");
                              link = link.split("-").join(" ");
                              links.push({"link":link,"flag":true});
                            }
                        }
                        relatedSearches(product_line, links, entities, function(related_search_result)
                        {
                            callback(related_search_result);
                        });
                    });
                    return;
                }
            }
            // getting body concern type of benefits from the user query
            if(entities.hasOwnProperty("body_concerns"))
            {
                let body_concerns = entities["body_concerns"];
                for(let i in body_concerns)
                {
                    let item = body_concerns[i];
                    if(item.benefit_key!="")
                    {
                        if(benefits.indexOf(item.benefit_key)==-1)
                        {
                            benefits.push(item.benefit_key);
                        }
                    }
                }
            }

            //making the elastic search query using the filter in user query
            let filter_keys = Object.keys(filters);
            for(let i in filter_keys)
            {
                let output = {};
                output[filter_keys[i]] = filters[filter_keys[i]];
                query.body.query.bool.must.push({"terms":output});
            }
            let boost_myntra_value_status = true;
            if(benefits.length > 0)
            {
                //making the elastic search query using the benefits in user query
                boost_myntra_value_status = false;
                for(let i in benefits)
                {
                    sort_priority_benefits.push(helper.getBenefitname(benefits[i], product_line, "benefits"));
                    query.body.query.bool.must.push({"match_phrase":{"benefits":benefits[i]}});
                }
            }
            if(extra_benefits.length>0)
            {
                //making the elastic search query using the extra added benefits from the references
                boost_myntra_value_status = false;
                query.body.query.bool.should.push({"terms":{"benefits":extra_benefits}});
            }
            let adjectives = [];
            if(entities.hasOwnProperty("adjectives"))
            {
                let adj = entities.adjectives;
                let count_adj = 0;
                let adj_index = Object.keys(word_mapping[product_line]["adjectives"]);
                for(let i in adj)
                {
                    let index = adj_index.findIndex(item => adj[i]["key"].toLowerCase() === item.toLowerCase());
                    adjectives.push(adj[i].entity_key);
                    sort_priority_benefits.push(helper.getBenefitname(adj[i].entity_key, product_line, "adjectives"));
                    //Sending the related links that belongs to the adjective filters
                    if(result_type=="related_searches")
                    {
                        prev_rel_search_status = true;
                        let adjective_query = 
                        {
                            index: 'styling_rules',
                            type: "adjectives_rules",
                            body: {
                                "query": {
                                    "bool":{
                                        "must":[
                                            {
                                                "match_phrase":{"product_line_name":product_line}
                                            },
                                            {
                                                "match_phrase":{"adjective_value":adj[i].entity_key}
                                            }
                                        ]
                                    }
                                 }
                             }
                         };
                        elasticSearch.runQuery(adjective_query, function(data,total,err)
                        {
                            count_adj++;
                            if(err==null){
                                let source = data[0]["_source"];
                                for(let i in source.attribute_dependencies[0].attribute_value){
                                    links.push({"link":source.attribute_dependencies[0].attribute_value[i],"flag":true})
                                }
                                if(count_adj==adj.length)
                                {
                                    if(!entities.hasOwnProperty("occasion")&&!entities.hasOwnProperty("broad_occasion")){
                                        let popular_query = 
                                        {
                                            index: 'published_links_web',
                                            type: product_line,
                                            preference: '_primary',
                                            body: {
                                                "query":  {
                                                    "bool": {
                                                        "should": [
                                                            {"term":{"type": "ffp"}}
                                                        ],
                                                        "must_not":[
                                                            {"term":{"attribute1":"brand"}},
                                                            {"term":{"attribute2":"brand"}}
                                                        ],
                                                        "minimum_should_match": 1
                                                    }
                                                },
                                                "from" : index*28,
                                                "size":"28"
                                            }
                                        };
                                        elasticSearch.runQuery(popular_query, function(data,total,err){
                                            if(err==null){
                                                for(let i in data)
                                                {
                                                  let pop = data[i]["_source"];
                                                  let link = pop.link;
                                                  link = link.replace("https://www.selekt.in/find/","");
                                                  link = link.split("-").join(" ");
                                                  links.push({"link":link,"flag":true});
                                                }
                                            }
                                            relatedSearches(product_line, links, entities, function(related_search_result)
                                            {
                                                callback(related_search_result);
                                            });
                                        });
                                    }
                                }
                            }
                        });
                        return;
                    }
                }
            }
            if(adjectives.length > 0)
            {
                // making the elastic search query using the adjective values
                boost_myntra_value_status = false;
                query.body.query.bool.must.push({"terms":{"adjectives":adjectives}});
            }
            if(boost_myntra_value_status)
            {
                // if there was no benefits, no filters, no adjectives in the user query, boosting the myntra website links
                query.body.query.bool.should.push({
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

            if(result_type!="related_searches" && result_type!="content")
            {
                // sending the product list to the user
                fetch_Products(benefits.concat(extra_benefits), query, product_line, entities, adjectives,sort_priority_benefits,function(products_list)
                {
                    callback({"product_list":products_list,"entities" : entities});
                });
            }
            else if(result_type=="content")
            {
                // sending the benefit content to the user 
                benefitContent(benefits.concat(extra_benefits),product_line,entities, message, function(benefits_message)
                {
                    callback({"benefits_message":benefits_message});
                });
            }
            else
            {
                if(!prev_rel_search_status)
                {
                    // sending the related searches to the user
                    relatedSearches(product_line, [], entities, function(results)
                    {
                        callback(results);
                    });
                }
            }
        }
        else
        {
            callback({},[]);
        }
    });
}

/*
* this function is helps to getting the filters along with related searches
* @param {string} product_line
* @param {array} links
* @param {obj} entities
*/
function relatedSearches(product_line, links, entities, callback)
{
    // sending all the filters from the product_line_filters database in elasticsearch
    filterList.get_product_line_filters(product_line, function (result) 
    {
        for(let i in result)
        {
            let values = result[i].values;
            values = values.map(function(value)
            {
                return {"key":value}
            });
            result[i].values = values;
        }
        let filter_list = {};
        filter_list.product_line = product_line;
        filter_list.options = result;
        callback({"filter_list":filter_list,"related_searches":links, "entities" : entities});
    });
}
/*
* this function is helps to get the data from the elastic search by using the query
* @param {array} benefits, adjectives, sort_priority_benefits
* @param {string} product_line
* @param {obj} entities
*/
function fetch_Products(benefits, query, product_line, entities,adjectives,sort_priority_benefits,callback)
{
    // getting the products from product_data database in elasticsearch
    elasticSearch.runQuery(query, function (es_result,total,err)
    {
        // console.log(total,err);
        let product_data = {};
        product_data.total_length = total;
        product_data.product_line = entities.product_line;
        if(err==null)
        {
            let result = [], source;
            if(es_result.length>0)
            {
                // making the mongo query using the elastic search _id values
                let mongo_query = es_result.map(function(a){ return {"es_mysql_id":parseInt(a._id)}; });
                mongo.runQuery(product_line,{$or:mongo_query},function(result_set, mongo_error)
                {
                    if(!mongo_error)
                    {
                        let elastic_array = es_result.map(function(a){return a._id; });
                        // arrange the mongo response data based on elastic response data order
                        result_set = helper.sortBasedonArray(result_set.concat(), elastic_array);
                        for(let i in result_set)
                        {
                            let result_source = result_set[i];
                            source = {};
                            source["id"] = result_set[i]["es_mysql_id"];
                            source["product_filter"] = result_source["product_filter"];
                            source["priority_benefits"] = sort_priority_benefits;

                            source["style_image"] = result_source["style_images"];
                            source["landingPageUrl"] = result_source["pdpData"]["landingPageUrl"];
                            try{
                                source["product_benefits"] = offline.getElementsNames(result_source["benefits"], entities.product_line, "benefits");
                                source["product_benefits"] = source["product_benefits"].concat(offline.getElementsNames(result_source["adjectives"],entities.product_line, "adjectives"));
                            }catch(e){console.log(e);}


                            let main_image_url=undefined,front_image_url=undefined,back_image_url=undefined,right_image_url=undefined,left_image_url=undefined,search_image=undefined;
                            try{
                                // cleaning the style_image data
                                if(source["style_image"]!=undefined && Object.keys(source["style_image"]).length!=0)
                                {
                                    if(source["style_image"].hasOwnProperty("default"))
                                    {
                                        search_image = source["style_image"]["default"]["imageURL"];
                                        main_image_url = offline.resolutions(source["style_image"]["default"]);
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
                                        main_image_url = main_image_url.replace("http://","https://");
                                        search_image = search_image.replace("http://","https://");
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
                            }catch(e){console.log(e);};

                            //getting the user selected benefits from the currently existed benefits in this product
                            source["benefits"] = helper.array_intersection(result_source["benefits"], benefits);
                            //getting the names of the benefits
                            source["benefits"] = offline.getElementsNames(source["benefits"],entities.product_line, "benefits");
                            
                            //getting the user selected adjectives from the currently existed adjectives in this product
                            let adj = helper.array_intersection(result_source["adjectives"], adjectives);
                            //getting the adjective names
                            adj = offline.getElementsNames(adj, entities["product_line"], "adjectives");
                            source.benefits = source["benefits"].concat(adj);
                            
                            result.push(source);
                        }
                        // console.log("Sending response", result.length);
                        product_data.list = result;
                        callback(product_data);
                    }
                    else
                    {
                        // if error occurs in the data, sending empty product list
                        let product_data = {};
                        product_data.list = result;
                        product_data.total_length = total;
                        product_data.product_line = entities.product_line;
                        callback(product_data);
                    }
                });
            }
            else
            {
                product_data.list = result;
                callback(product_data);
            }
        }
        else
        {

            product_data.list = [];
            callback({});
        }
    });
}
/*
* this function is helps to get about message
* @param {array} benefits
* @param {string} product_line, user_message
* @param {obj} entities
*/
function benefitContent(benefits,product_line,entities,user_message, callback)
{
    // console.log("==================>>>> Sending benefit Content");
    // console.log(benefits);
    let count = 0;
    let benefits_result = [];
    let attributes = {};
    //seperating the body_concern benefits from the benefits data
    if(entities.hasOwnProperty("body_concerns"))
    {
        for(let i in entities["body_concerns"])
        {
            let body_concern = entities["body_concerns"][i];
            if(body_concern["benefit_key"]!="")
            {
                benefits.splice(benefits.indexOf(body_concern["benefit_key"]), 1);
            }
        }
    }
    let get_products = function(benefits,i)
    {
        // making the benefit content by using the benefit rules in elastic search 
        let product_query =
        {
            "index":"styling_rules",
            "type":"benefit_rules",
            "body":
            {
                "query":{"bool":{"must":[{"match_phrase":{"adjective_value":benefits[i]}},{"match_phrase":{"product_line_name":product_line}}]}}
            }
        };
        elasticSearch.runQuery(product_query, function (result_set,total,err)
        {
            // console.log("count : ",count,"benefit length : ",benefits.length)
            if(err==null && total > 0)
            {
                count++;
                let source = result_set[0]["_source"];
                let answer_key = benefits[i];
                let benefit_name = helper.getBenefitname(answer_key, product_line, "benefits");
                let reason = word_mapping[product_line]["benefits"][benefit_name]["reason"];
                let string = "";

                let header = get_sub_heading(benefit_name,count);
                string += get_intro(count);
                string += "\n"+helper.get_reason(reason);

                let attribute_dependencies = source["attribute_dependencies"];
                let filters = {};
                for(let filter=0;filter<attribute_dependencies.length;filter++)
                {
                    let attribute_type = attribute_dependencies[filter]["attribute_type"];
                    attribute_type = attribute_type.substr(0, 1).toUpperCase() + attribute_type.substr(1);
                    let attribute_value = attribute_dependencies[filter]["attribute_value"];
                    if(!attributes.hasOwnProperty(attribute_type))
                    {
                        attributes[attribute_type] = [];
                    }
                    if(!filters.hasOwnProperty(attribute_type))
                    {
                        filters[attribute_type] = [];
                    }

                    let val;
                    for(val = 0;val<attribute_value.length-1;val++)
                    {
                        if(attributes[attribute_type].indexOf(attribute_value[val])==-1)
                            attributes[attribute_type].push(attribute_value[val]);

                        if(filters[attribute_type].indexOf(attribute_value[val])==-1)
                            filters[attribute_type].push(attribute_value[val]);
                        if(val>3)
                            break;
                    }
                    if(attributes[attribute_type].indexOf(attribute_value[val])==-1)
                        attributes[attribute_type].push(attribute_value[val]);
                    if(filters[attribute_type].indexOf(attribute_value[val])==-1)
                        filters[attribute_type].push(attribute_value[val]);
                    if(filter>2)
                        break;
                }
                string += "\n"+get_filters(filters);
                benefits_result.push({"header":header,"sentence":string});
            }
            else
            {
                count++;
            }
            if(count==benefits.length)
            {
                let message = {"type":"benefits","sentences":benefits_result,"tabular":attributes,"entities":entities};
                callback(message);
            }
            else
            {
                get_products(benefits,count);
            }
        });
    };
    // getting the benefits content if benefits are exists
    if(benefits.length>0)
        get_products(benefits,count);
    else
    {
        // if there is no benefits are present, get content from other values
        // getting content for product line
        let suggestion_message = getProductlineMessage(entities, user_message);
        // getting content for the adjectives
        suggestion_message += getAdjectiveMessage(entities);
        // getting content for the body concerns
        suggestion_message += bodyConcernMessage(entities);
        suggestion_message = suggestion_message.trim();
        if(suggestion_message=="")
            suggestion_message = "Buy from amazing and complete web collection of women western wear "+user_message+" that suits your style";

        let message = {"type":"benefits","sentences":[{"header":suggestion_message,"sentence":""}],"tabular":attributes,"entities":entities};
        
        // sending the content data
        callback(message);
    }
}
/*
* this function is helps to get about message for body_concerns values
* @param {obj} entities
* return {string}
*/
function bodyConcernMessage(entities){

    let body_concern_reasons = {
      "thin legs": "Legs not proportionate to the body, where the legs are thinner compared to the rest of the body making the upper body look huge. Clothes to wear to make them appear fuller are bootcut pants,bottoms that have wide horizontal stripes or bold patterns, Pastel colors can also help.",
      "small torso": "The distance between shoulders and waist is shorter than average.�People with  short torso have long legs. Look for clothing that will elongates your upper body like tops with vertical stripes. Wear longer length tops that end lower than your natural waistline.Wear mid to low rise bottoms.",
      "long torso": "The distance between shoulders and waist is longer than average.�Short legs. Wear skirts a little above the knee to make your legs appear. Try a monochromatic look from waist to toe. high-waisted styles. crop tops",
      "short legs": "The distance between shoulders and waist is longer than average.�Short legs. Wear skirts a little above the knee to make your legs appear. Try a monochromatic look from waist to toe. high-waisted styles. crop tops",
      "long legs": "The distance between shoulders and waist is shorter than average.�People with  short torso have long legs. Look for clothing that will elongates your upper body like tops with vertical stripes. Wear longer length tops that end lower than your natural waistline.Wear mid to low rise bottoms.",
      "small hips": "Slim hips, less curvy. You may have a rectangle body shape, or you might have an inverted-triangle body shape. Horizontal patterns like stripes or a zebra pattern make your hips look wider. A-line skirt, a fitted sheath dress, An empire-waist dress,  low-rise skinny or tapered jeans, bold colors or graphic prints.",
      "big thighs": "Thighs are bigger than any other body part. High waisted pants, wrap dress, vertical stripes, medium length tops, halter neck, light prints, flowy fabrics, flared pants, a lines, etc",
      "wide hips": "Pear body shape is characterized by large hips that are bigger than the rest of the body.�Your legs and lower arms are worth flaunting. Choose lighter color for upper body but darker in the middle and lower body region, strapless, boat necks, wide necks, short skirts and shorts to show off your great legs, tops with embellishments or patterns that add volume to your bust, A-line skirts, boot cut  bottom, mid-rise bottom, well-defined shoulders and waist, shoes with pointed toes.",
      "broad shoulders": "Your upper body is voluminous and should be accentuated to draw away attention from the waist. Wear dark colour tops and light colour bottom. wEar V-neck, scoop, halter, wide straps or gathered necklines, raglan sleeves, dolman sleeves and kimono sleeves wide pants or jeans, A-line and pleated skirt.",
      "large busts": "Oval body, bust will be larger than the rest of your body. The hips will be narrow and the midsection shall look full. Buttocks are flat and legs are slender.V-neck and scoop cut necklines, Shift dresses with darts, A-lines, wrap dresses, shirt dresses and fit and flare silhouettes, soft fabrics, one-button style with stretch, or a semi-fitted soft jacket with narrow lapels.",
      "narrow shoulders": "Shoulder tend to to be narrow than hips. Wear wide shoulders straps, bateau, off-the-shoulders, square and wide V neck , light tops and dark colour bottom, shiny fabric and colours, puffy sleeves and set-in sleeves, shoulder pads, embellishment and detailing on your shoulders, horizontal stripes, wide collars and lapels,  thick textured fabric. Add layering or fabric to your top.",
      "tummy": "Stomach which sticks out, the waist is not very well-defined. An empire-waist dress, A-lines, Loose, Baggy Tops, Tunic And Legging Combo, asymmetric outfits, Drapes / Frills / Layers,  Kaftans, Mid-Rise Jeans, peplum Tops, crossover Sweaters.",
      "big arms": "Chubby arms from shoulder to elbow. Wear long wide sleeves, three-quarter or elbow-length sleeves, batwing and kimono sleeves, go sheer, cold shoulders, wrap dress or top, dark color top. Pick off-shoulder necklines that has long sleeves to cover your underarm.",
      "small busts": "Create the appearance of a fuller bust by wearing high necklines, backless tops/dresses,pants with a slight flare, plunging necklines, wide waist belts or corset style belts, . Wear tops with ruffles or embellishments around the chest area as these add volume without exaggerating a small bust. Any cinching in at the waist helps make your bust appear larger. Draw attention to your arms and shoulders"
    };
    let reason = "";
    // getting the body concern data if user query contains the body concern information
    if(entities.hasOwnProperty("body_concerns"))
    {
        for(let i in entities["body_concerns"])
        {
            let body_concern = entities["body_concerns"][i];
            if(body_concern_reasons.hasOwnProperty(body_concern["key"]))
            {
                reason += body_concern_reasons[body_concern["key"]]+"\n";
            }
        }
    }
    return reason+"\n\n";
}
/*
* this function is helps to get about message for adjectives values
* @param {obj} entities
* return {string}
*/
let adj_reasons = JSON.parse(fs.readFileSync('./json/adjective_reasons.json'));
function getAdjectiveMessage(entities)
{
    let reason_message = "";
    
    // getting the adjective content if user query contains any adjective value
    if(entities.hasOwnProperty("adjectives"))
    {
        let adjectives = entities["adjectives"];
        for(let i in adjectives)
        {
            let adjective = adjectives[i]["key"];
            adjective = adjective.trim();
            if(adj_reasons.hasOwnProperty(adjective))
            {
                reason_message += helper.capitalizeFirstLetter(adj_reasons[adjective])+"\n\n";
            }
        }
    }
    return reason_message+"\n";
}
/*
* this function is helps to get about message for productline
* @param {obj} entities
* @param {string} message
* return {string}
*/
function getProductlineMessage(entities, message)
{
    let productline_messages = 
    {
        "women_jeans" : 
        [
            "Jeans are pants, made from denim material. Jeans are a popular fashion item, and they come in various fits, including skinny, tapered, slim, straight, boot cut, cigarette bottom, narrow bottom, bell bottom, anti-fit, and flare. There are styles available for different body types and shapes as well.",
            "Jeans are a very popular article of casual dress around the world. They are also worn as a protective garment due to their high durability as compared to other common fabrics. Although now they can be worn for almost any occasion for they come in many styles and colors."
        ],
        "women_kurta" : 
        [
            "A kurta is an upper garment for both men and women. The kurta comes in various styles and fittings. They were traditionally worn with loose-fitting paijama (kurta-paijama), loose-fitting shalwars, semi-tight (loose from the waist to the knees, and tight from the calves to the ankles) churidars, or wrapped-around dhotis.",
            "Kurtas are ideal for multiple occasions. They are worn with jeans, shorts, leggings skirts and palazzos. Kurtas are worn as casual everyday wear, during festivals and as a formal dress."
        ],
        "women_tops" :
        [
            "A top is an item of clothing that covers at least the chest, but which usually covers most of the upper human body between the neck and the waistline. The bottom of tops can be as short as mid-torso, or as long as mid-thigh. ",
            "Tops are the most preferred wear these days. Men's tops are generally paired with pants, and women's with pants or skirts. Common types of tops are t-shirts, blouses and shirts."
        ],
        "women_tshirts" :
        [
            "A T-shirt is a style of unisex fabric upper body wear, named after the T shape of the body and sleeves. It is generally associated with short sleeves, a round neckline, with no collar. T-shirts are generally made of a light, inexpensive fabric. ",
            "T shirts were earlier worn as an undershirt. Now it is considered as the most casual clothing item and comes in various patterns and necklines. T-shirts come in with a variety of sleeve designs, Necklines and Patterns"
        ],
        "women_jackets" :
        [
            "A jacket is a waist length layering garment for the upper body. A jacket typically has sleeves, collar and fastens in the front or slightly on the side. A jacket is lighter, fitted, and less insulating than a coat.",
            "Jackets are fashionable. Some Jackets might serve as protective clothing. Jackets are available in various types for every occasion. A denim jacket and a lapel jacket can be considered as wardrobe staples."
        ],
        "women_heels" : 
        [
            "High heels increases wearer’s height significantly. High heels gives the illusion of longer, more slender legs. High heels come in a wide variety of styles and patterns",
            "Heels are found in many different shapes, including stiletto, pump, block, tapered, blade, and wedge. Anything heel which is over 3.5 inches, is considered as high heels."
        ],
        "women_casual_shoes" :
        [
            "Casual shoes are worn for casual day outs as the name suggests. They are comfortable and light weight. Casual shoes varies widely in style, material and cost. Basic shoes may consist of only a thin sole and simple strap and is sold for a low cost.",
            "Casual shoes are most ideal for Casual Occasions. Some might be designer shoes made of expensive materials, complex construction, are sold for hundreds or thousands of dollars a pair. Some shoes are designed for specific activities, such as for mountaineering or skiing or for specific weather."
        ],
        "women_flats" : 
        [
            "Flat footwears are not high-heeled. Flat shoes have various types ranging from ballet flats, gladiators, t-straps, one-toe, and open-toe flats.",
            "Flats can be worn for a variety of occasions. There are different toe shapes (pointed, round, square toe) and patterns (tie-ups, mid tops, ankle loops) available which helps in styling diverse body types."
        ],
        "women_dresses" : 
        [
            "A dress is a one piece garment consisting of a skirt with an attached bodice. It consists of a top piece that covers the torso and hangs down over the legs. A dress can be any one-piece garment which goes below hips. ",
            "Dresses can be worn for formal or informal occasions. The hemlines, necklines, length and sleeve type vary depending on the fashion trend and personal taste of the wearer. The wide range of types of dresses helps in working with different body types."
        ],
        "women_trousers" : 
        [
            "Trousers or pants are an item of clothing worn from the waist to the ankles. Trousers are worn on the hips or waist and are held up by fastenings, a belt or suspenders. They give you a clean and sophisticated look.",
            "Trousers refer to tailored garments with a waistband, belt-loops, and a fly-front. Trousers can be worn in formal as well as informal occasions, depending on the patterns and length. Trousers give a dignified and clean look."
        ],
        "women_blazers" : 
        [
            "Blazer is a modernized version of a suit jacket and a casual or sporty jacket which can be worn on any semi-formal occasion depending upon the detail. Blazer is intermediate between suit jacket and sports jacket, that is, it is not as structured as a suit jacket and not as loose as a sports jacket. Blazers can be styled by clubbing them with different colored bottoms to add statement with attractive details of buttons, pockets and fabrics.",
            "It is recommended that you wear a blazer any time a suit is too formal and a sports jacket is too casual but you still need to dress up. The blazer is a classic staple but the new styles and cuts out there sure make you think twice before refusing to resort to this piece for fashion statement reasons."
        ],
        "women_skirts" : 
        [
            "Skirt is a bottom wear comes in a variety of shapes and styles and are an essential item in a woman’s wardrobe. They are more versatile than dresses because they are more flexible when it comes to being dressed up or dressed down. ",
            "There are different types of skirts majorly classified as flared, pleated, ruffles and body hugging. Choose the right one for the right occasion perfectly for your body type. While selecting a skirt we need to keep these things in mind - wearer’s body type, personal taste, social context and occasion. ",
        ],
        "women_capris" : 
        [
            "Capris are close fitted tapering trousers whose length ranges from below knee to ankle. They are basically the three quarter pants that end at the mid-calf level.  Capris or ankle length cropped pants look perfect under a flowy tunic or a short dress.",
            "Capris are very comfort and easy to carry as they are available in different lengths to choose from. Choose capris with a higher waist if you have short legs. A high waist will draw attention and make your legs appear longer."
        ],
        "women_handbags" : 
        [
            "A handbag is a bag used generally by women to carry their everyday essentials and the easiest way to make a fashion statement. They are the easiest way to incorporate latest fashion trends in your wardrobe. There are different kind and types of bags like slings, cross body bag, Satchel, clutch, tote, etc.",
            "A handbag reflects your style and sense of fashion. Size, color, fabric and embellishment are the features that need to be considered depending upon the purpose of the purchase. A basic color in monochrome along with few trendy ones are must have wardrobe collections."
        ],
        "women_shorts" :
        [
            "Shorts are trousers that reach only to the knees and different lengths above the knee. There are a variety of shorts, ranging from knee-length which can be worn as formal clothes to beachwear and athletic shorts.",
            "Shorts are shorter version of trousers. Shorts come in different styles such as hot pants, skorts, denim shorts, active wear etc. they are worn according to the occasion and body type as they show and flaunt your legs."
        ],
        "women_sweaters" :
        [
            "Sweater is a knitted garment worn as upper body top layer and typically have long sleeves. Sweaters are a versatile item of clothing and can be worn on top of almost any outfit. Sweaters not only give warmth compared to others winter wear but they also avail a wide variety of styles and knits that suit your body.",
            "Sweaters have variety of styles available with different closures and necks like cardigans, ribbed, mock necked, foldovers etc. Go for monochromes which you can style in different ways, a new one each time."
        ],
        "women_sweatshirts" : 
        [
            "A loose warm sweater, worn when exercising or as a leisurewear, is typically made from cotton or on similar fabrics. Sweatshirts are so much more than just the comfy clothes. Sweatshirts look chic and elegant, and not anything like you are just being a bum. ",
            "Sweatshirts are warm, cozy, comfy and basically perfect. Being able to pair them with skirts, jeans and even heels is a treat. Sweatshirts come in different styles like hoodie, oversized etc. Some are fitted and will look more flattering and stylish."
        ],
        "women_shirts" : 
        [
            "Shirt is an upper body garment which has collar and cuffs having a front button down opening. Shirts are basic essentials all need to have in variety to choose. Shirts can be multipurpose and can be paired with trousers, skirts, or blazers, creating a wide variety of distinct fashion ensembles.",
            "Women can include a number of shirt styles that are versatile and flattering to most women's body types. There are different types and patterns from which you can choose your wardrobe essentials."
        ],
        "women_jumpsuits" :
        [
            "Jumpsuit is a garment incorporating trousers and a sleeved top in one piece. The jumpsuit is surely the epitome of easy dressing and can be dressed up with heels or down with sneakers, belted, loose, denim or khaki. It’s classier in the style, and can be easily dressed up with black tuxedo blazer, gold accessories and a dainty handbag.",
            "Jumpsuit will show your clean figure and silhouette that hits the natural waist showing the curve. You can experiment with colour and quirky prints and strapless designs to get a cool trendy look."
        ],
        "women_jeggings" : 
        [
            "A tight-fitting stretch trousers, styled to resemble a pair of denim jeans. The tight fit is like any other ordinary pair of leggings but with the feel and look of a jean. A jegging isn’t strictly a skinny pair, but having the comfort of a knit legging, with an elasticized top and lots of stretch.",
            "Jeggings have a comfort factor, with no waistband to constrict around the middle giving a clean look. This style is stretchy, comfortable and versatile. It can paired up with a tunic and tops."
        ]
    };
    let suggestion = "";
    // get the product line content for the existed product line in the user query
    if(entities.hasOwnProperty("product_line"))
    {
        let entity_productline = entities["product_line"];
        let entity_keys = Object.keys(entities);
        if(entity_keys.length==1 || (entity_keys.length==2 && entities.hasOwnProperty("adjectives")))
        {
            if(entity_productline=="jeans")
            {
                suggestion = productline_messages["women_jeans"][1];
            }
            else if(entity_productline=="kurtas")
            {
                suggestion = productline_messages["women_kurta"][0];
            }
            else if(entity_productline=="tops")
            {
                suggestion = productline_messages["women_tops"][1];
            }
            else if(entity_productline=="tshirts")
            {
                suggestion = productline_messages["women_tshirts"][1];
            }
            else if(entity_productline=="jackets")
            {
                suggestion = productline_messages["women_jackets"][0];
            }
            else if(entity_productline=="heels")
            {
                suggestion = productline_messages["women_heels"][0];
            }
            else if(entity_productline=="casual shoes")
            {
                suggestion = productline_messages["women_casual_shoes"][0];
            }
            else if(entity_productline=="flats")
            {
                suggestion = productline_messages["women_flats"][0];
            }
            else if(entity_productline=="dresses")
            {
                suggestion = productline_messages["women_dresses"][0];
            }
            else if(entity_productline=="trousers")
            {
                suggestion = productline_messages["women_trousers"][0];
            }
            else if(entity_productline=="blazers")
            {
                suggestion = productline_messages["women_blazers"][0];
            }
            else if(entity_productline=="skirts")
            {
                suggestion = productline_messages["women_skirts"][1];
            }
            else if(entity_productline=="capris")
            {
                suggestion = productline_messages["women_capris"][1];
            }
            else if(entity_productline=="handbags")
            {
                suggestion = productline_messages["women_handbags"][0];
            }
            else if(entity_productline=="shorts")
            {
                suggestion = productline_messages["women_shorts"][1];
            }
            else if(entity_productline=="sweaters")
            {
                suggestion = productline_messages["women_sweaters"][0];
            }
            else if(entity_productline=="sweatshirts")
            {
                suggestion = productline_messages["women_sweatshirts"][1];
            }
            else if(entity_productline=="shirts")
            {
                suggestion = productline_messages["women_shirts"][0];
            }
            else if(entity_productline=="jumpsuits")
            {
                suggestion = productline_messages["women_jumpsuits"][0];
            }
            else if(entity_productline=="jeggings")
            {
                suggestion = productline_messages["women_jeggings"][0];
            }
        }
        else
        {
            //getting the product line content if filter valuer are exists in the user query
            if(entities.hasOwnProperty("attribute_values") && entity_keys.length==2)
            {
                let at_values = entities["attribute_values"].map(function(ob){return ob.key});
                let product_line = mapping.product_line_to_db_keys[entity_productline];
                if(ffp_reasons.hasOwnProperty(product_line))
                {
                    suggestion = ffp_reasons[product_line];
                    suggestion = suggestion.split("<<f1>>").join(at_values[0]);
                    suggestion = suggestion.split("<<f2>>").join(at_values[1]);
                }
            }
        }
        suggestion = helper.capitalizeFirstLetter(suggestion)+"\n\n";
    }
    return suggestion;
}
/*
* checking the list is containing the obj or not
* @param {obj} obj
* @param {array} list
* return {bool}
*/
function containsObject(obj, list) {

    let i;
    for (i = 0; i < list.length; i++) {
        if (JSON.stringify(obj) === JSON.stringify(list[i])) {
            return true;
        }
    }
    return false;
}
/*
* this is used to get the random sentence in the sentence array
* @param {string} string
* @param {int} count
* return {string}
*/
function get_sub_heading(string,count)
{
    // getting the random sub heading from the sentence array
    let sentence =
        [
            "These collections are suitable for: "+ string,
            "The following items are ideal for: "+string,
            "For "+string+" these would be a perfect fit",
            string+": Matching Collections",
            "Suitables Styles: "+string
        ];
    let get_random_number = count%sentence.length;
    return sentence[get_random_number];
}

/*
* getting the random sub heading from the sentence array
* @param {int} count
* return {string}
*/
function get_intro(count)
{
    let sentence =
        [
            "The objective here is to make you look awesome. Simple!",
            "Remember that the selection here is not just for looks. You should also feel great in it.",
            "All we need to do is to find that apt clothing that suits you the best.",
            "While making these clothing choices, we only had one thing in mind. How fabulous will these look on you.",
            "3 simple rules we thought of while selecting these - You should look awesome, feel wonderful and be others' envy."
        ];
    let get_random_number = count%sentence.length;
    return sentence[get_random_number];
}
/*
* getting random sentences for filters data
* @param {obj} filters
* return {string}
*/
function get_filters(filters)
{
    let attr1,attr_val1,attr2,attr_val2,attr3,attr_val3;
    let filter_keys = Object.keys(filters);
    let s11="",s12="",s13="",s21="",s22="",s23="",s31="",s32="",s33="";
    if(filter_keys.length>0)
    {
        let make_sentence = function(values)
        {
            let str = "";
            if(values.length>0)
            {
                for(let i=0;i<values.length-1;i++)
                {
                    str +=values[i]+", ";
                }
                str +=values[values.length-1];
            }
            return str;
        };
        attr1 = filter_keys[0].split("_").join(" ");
        attr_val1 = make_sentence(filters[filter_keys[0]]);
        s11 = "We have included "+ attr1 + " like "+ attr_val1 +". These would get you those awesome looks. ";
        s21 = "All we did was to select "+attr_val1+" in "+attr1+" to make you look fabulous. ";
        s31 = "Our pick list has "+attr1+" like "+attr_val1+" to increase the stylish aspect. "

        if(filter_keys[1]!=undefined)
        {
            attr2 = filter_keys[1].split("_").join(" ");
            attr_val2 = make_sentence(filters[filter_keys[1]]);
            s12 = "With respect to the "+attr2+" we have chosen "+attr_val2+". They will look good on you. ";
            s22 = "In addition to it, we went for "+attr_val2+" in "+attr2+". They will enhance the look quotient. ";
            s32 = "We also tried to accentuate your good appearance by going for "+attr_val2+" in "+attr2+". "
        }
        if(filter_keys[2]!=undefined)
        {
            attr3 = filter_keys[2].split("_").join(" ");
            attr_val3 = make_sentence(filters[filter_keys[2]]);
            s13 = "Lastly, to give you that extra style, we went for "+attr_val3+" in "+attr3+".";
            s23 = "And last but not the least, we also picked "+attr_val3+" in "+attr3+".";
            s33 = "And when it came to "+attr3+", we chose "+attr_val3+".";
        }
    }
    let sentences =
        [
            s11+s12+s13,

            s21+s22+s23,

            s31+s32+s33
        ];
    let get_random_number = helper.random(0,sentences.length);
    return sentences[get_random_number];
}

/*
* checking the two arrays are equal or not
* @param {array} structureAnswers, contextAnswers
* return {bool}
*/
function arraysEqual(structureAnswers, contextAnswers) {
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
module.exports = {
    webProcessMessage: webProcessMessage
};